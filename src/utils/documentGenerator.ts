// src/utils/documentGenerator.ts

// This file runs in Node, but the callback passed to page.evaluate() below
// executes inside the browser (Chromium), not Node — so it legitimately
// needs `document`, `HTMLImageElement`, etc. Node's tsconfig `lib` doesn't
// include "dom", so without this reference TS reports `document`/`img` as
// unknown even though the code is valid and runs fine at runtime. This
// pulls in DOM types for THIS FILE ONLY, without touching the project's
// global tsconfig (which would risk clashing Node's `fetch`/`Response`
// types with DOM's versions of the same names elsewhere).
/// <reference lib="dom" />

import type { Browser, Page } from 'puppeteer';
import pLimit from 'p-limit';
import { AppError } from './response';
import { getMemoHTML, MemoData } from '../features/template/MemoTemplate';
import { getLetterHTML, LetterData } from '../features/template/LetterTemplate';
import { getCertificateHTML, CertificateData } from '../features/template/CertificateTemplate';

type TemplateType = 'memo' | 'letter' | 'certificate';
type TemplateData = MemoData | LetterData | CertificateData;

// Caps concurrent PDF generations server-wide
const limit = pLimit(3);

// Singleton browser — reused across calls instead of relaunched each time
let browserInstance: Browser | null = null;

// In production (Render), use puppeteer-core + @sparticuz/chromium
const IS_RENDER = !!process.env.RENDER;

// Increase timeout for slow page loads
const PAGE_LOAD_TIMEOUT = 30000; // 30 seconds

// Hard cap on how long we'll wait for fonts/images to settle before print.
// This is a SAFETY CEILING, not the expected wait — waitForRenderReady
// below resolves as soon as fonts/images are actually ready, almost
// always well under this. It exists only so a genuinely stuck resource
// (e.g. a dead Cloudinary URL) can't hang PDF generation indefinitely;
// if it's ever hit, printing proceeds with whatever state exists at that
// point rather than failing the whole request.
const RENDER_READY_TIMEOUT = 8000; // 8 seconds

async function launchBrowser(): Promise<Browser> {
  const commonArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--disable-gpu',
    '--font-render-hinting=none',
    '--js-flags=--max-old-space-size=512',
  ];

  if (IS_RENDER) {
    const chromiumImport: any = await import('@sparticuz/chromium');
    const chromium = chromiumImport.default ?? chromiumImport;

    const { default: puppeteerCore } = await import('puppeteer-core');

    if (!Array.isArray(chromium.args)) {
      throw new Error(
        `@sparticuz/chromium loaded but chromium.args is not an array (got ${typeof chromium.args}). ` +
        `Check the installed @sparticuz/chromium / puppeteer-core version compatibility.`
      );
    }

    return puppeteerCore.launch({
      headless: chromium.headless,
      args: [...chromium.args, ...commonArgs],
      executablePath: await chromium.executablePath(),
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const puppeteer = require('puppeteer');
  return puppeteer.launch({
    headless: true,
    args: commonArgs,
  });
}

async function getBrowser(): Promise<Browser> {
  if (!browserInstance || !browserInstance.connected) {
    browserInstance = await launchBrowser();
  }
  return browserInstance;
}

function renderTemplateHTML(type: TemplateType, data: TemplateData): string {
  switch (type) {
    case 'memo':
      return getMemoHTML(data as MemoData);
    case 'letter':
      return getLetterHTML(data as LetterData);
    case 'certificate':
      return getCertificateHTML(data as CertificateData);
    default: {
      const _exhaustive: never = type;
      throw new AppError(400, `Unknown template type: ${_exhaustive}`);
    }
  }
}

/**
 * Wait for the page to actually be safe to print, instead of guessing with
 * a fixed delay.
 *
 * THIS REPLACES THE OLD `await delay(500)`.
 *
 * The previous code called `page.setContent(html, { waitUntil: 'load' })`
 * followed by a flat 500ms pause before calling `page.pdf()`. Neither of
 * those actually guarantees the page is ready:
 *
 * - `waitUntil: 'load'` fires on the DOM/same-document-resource load
 *   event. It does NOT guarantee that a `@font-face` pulled in via a CSS
 *   `@import url(...)` (see LetterTemplate.ts's Google Fonts import) has
 *   finished downloading and been applied — font loading is asynchronous
 *   and can complete after `load` fires.
 * - The flat 500ms delay was a guess standing in for "hopefully the font
 *   and Cloudinary images finished by now." Whether that's true varies
 *   run to run depending on network/CDN latency, which is why the SAME
 *   document could render correctly one attempt and reflow differently
 *   (different line-wrapping, different page breaks) the next — pushing
 *   the signature block onto a different page non-deterministically.
 *
 * This function waits for two concrete, verifiable conditions instead:
 *   1. `document.fonts.ready` — resolves once all fonts referenced by the
 *      page (including the @import'd Arimo) have loaded and are ready to
 *      be used for layout. This is the actual signal we were missing.
 *   2. Every `<img>` on the page has finished loading (`complete` and
 *      `naturalWidth > 0`) — covers the header/footer logo images from
 *      Cloudinary, so their real dimensions are used for layout instead
 *      of a placeholder/zero size while they're still in flight.
 *
 * Both are raced against RENDER_READY_TIMEOUT so a single dead/slow
 * resource can't hang document generation indefinitely — if the timeout
 * is hit, we log a warning and proceed anyway, same failure mode as
 * before, but now it's the rare exception instead of an unmarked guess
 * on every single generation.
 */
async function waitForRenderReady(page: Page): Promise<void> {
  try {
    await page.evaluate(() => {
      const fontsReady = (document as any).fonts?.ready
        ? (document as any).fonts.ready
        : Promise.resolve();

      const images = Array.from(document.images);
      const imagesReady = Promise.all(
        images.map((img) => {
          if (img.complete && img.naturalWidth > 0) return Promise.resolve();
          return new Promise<void>((resolve) => {
            img.addEventListener('load', () => resolve(), { once: true });
            img.addEventListener('error', () => resolve(), { once: true }); // don't hang on a broken image
          });
        })
      );

      return Promise.all([fontsReady, imagesReady]);
    });
  } catch (err) {
    console.warn('[waitForRenderReady] page.evaluate failed, proceeding without confirmed font/image readiness:', err);
  }
}

export async function generateDocumentFromTemplate(
  type: TemplateType,
  data: TemplateData
): Promise<Buffer> {
  return limit(async () => {
    let page = null;
    try {
      console.log(`📄 Generating ${type} PDF from HTML template...`);

      const html = renderTemplateHTML(type, data);
      const browser = await getBrowser();
      page = await browser.newPage();

      // Suggestion: Set timeout for page operations
      page.setDefaultTimeout(PAGE_LOAD_TIMEOUT);

      await page.setViewport({
        width: 1200,
        height: 1600,
        deviceScaleFactor: 1,
      });

      await page.setContent(html, {
        waitUntil: 'load',
        timeout: PAGE_LOAD_TIMEOUT,
      });

      // Deterministic readiness wait — replaces the old fixed 500ms guess.
      // See waitForRenderReady() above for exactly why this was the
      // source of the "works one attempt, breaks the next" flakiness.
      await Promise.race([
        waitForRenderReady(page),
        new Promise((resolve) => setTimeout(resolve, RENDER_READY_TIMEOUT)),
      ]);

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '0px',
          bottom: '0px',
          left: '0px',
          right: '0px',
        },
        displayHeaderFooter: false,
      });

      console.log(`✅ ${type} PDF generated successfully! Size: ${Math.round(pdfBuffer.length / 1024)}KB`);
      return Buffer.from(pdfBuffer);
    } catch (error) {
      console.error(`❌ Failed to generate ${type} PDF:`, error);
      throw new AppError(500, `Failed to generate ${type}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      if (page) {
        await page.close().catch(console.warn);
      }
    }
  });
}

export async function closeBrowser() {
  if (browserInstance) {
    await browserInstance.close().catch(console.warn);
    browserInstance = null;
  }
}

// Optional: Health check function
export async function checkBrowserHealth(): Promise<boolean> {
  try {
    const browser = await getBrowser();
    return browser.connected;
  } catch {
    return false;
  }
}

export async function generateDocumentFromTemplateAsDocx(
  type: TemplateType,
  data: TemplateData
): Promise<Buffer> {
  console.warn('⚠️ generateDocumentFromTemplateAsDocx is deprecated, use generateDocumentFromTemplate instead');
  return generateDocumentFromTemplate(type, data);
}