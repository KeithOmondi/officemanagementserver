// src/utils/documentGenerator.ts

import type { Browser } from 'puppeteer';
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

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
        waitUntil: 'load', // or 'networkidle0' if you have external resources
        timeout: PAGE_LOAD_TIMEOUT,
      });

      // Small delay for rendering
      await delay(500);

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