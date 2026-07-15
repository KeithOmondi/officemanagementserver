// src/utils/documentGenerator.ts

import type { Browser } from 'puppeteer';
import pLimit from 'p-limit';
import { AppError } from './response';
import { getMemoHTML, MemoData } from '../features/template/MemoTemplate';
import { getLetterHTML, LetterData } from '../features/template/LetterTemplate';

type TemplateType = 'memo' | 'letter';

// Caps concurrent PDF generations server-wide
const limit = pLimit(3);

// Singleton browser — reused across calls instead of relaunched each time
let browserInstance: Browser | null = null;

// In production (Render), use puppeteer-core + @sparticuz/chromium: a
// prebuilt binary bundled with the package itself, with no separate
// download-and-cache step to survive between build and runtime. Locally,
// use full `puppeteer`, which manages its own bundled Chromium and
// already works fine in dev.
const IS_RENDER = !!process.env.RENDER;

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
  // @sparticuz/chromium's own type declarations don't line up with its
  // actual runtime shape when loaded via dynamic import() — TypeScript
  // resolves the default export to `typeof Chromium` (the module/class
  // shape) rather than the real instance object, so properties like
  // `.headless` and `.args` fail type-checking even though they exist
  // fine at runtime. Typed as `any` here; the Array.isArray guard below
  // is what actually protects us at runtime, not the (broken) types.
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

export async function generateDocumentFromTemplate(
  type: TemplateType,
  data: MemoData | LetterData
): Promise<Buffer> {
  return limit(async () => {
    try {
      console.log(`📄 Generating ${type} PDF from HTML template...`);

      const html = type === 'memo'
        ? getMemoHTML(data as MemoData)
        : getLetterHTML(data as LetterData);

      const browser = await getBrowser();
      const page = await browser.newPage();

      try {
        await page.setViewport({
          width: 1200,
          height: 1600,
          deviceScaleFactor: 1,
        });

        await page.setContent(html, {
          waitUntil: 'load',
        });

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
      } finally {
        await page.close();
      }
    } catch (error) {
      console.error(`❌ Failed to generate ${type} PDF:`, error);
      throw new AppError(500, `Failed to generate ${type}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });
}

export async function closeBrowser() {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}

export async function generateDocumentFromTemplateAsDocx(
  type: TemplateType,
  data: MemoData | LetterData
): Promise<Buffer> {
  console.warn('⚠️ generateDocumentFromTemplateAsDocx is deprecated, use generateDocumentFromTemplate instead');
  return generateDocumentFromTemplate(type, data);
}