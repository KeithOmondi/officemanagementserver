// src/utils/documentGenerator.ts

import puppeteer, { Browser } from 'puppeteer';
import pLimit from 'p-limit';
import { AppError } from './response';
import { getMemoHTML, MemoData } from '../features/template/MemoTemplate';
import { getLetterHTML, LetterData } from '../features/template/LetterTemplate';

type TemplateType = 'memo' | 'letter';

// Caps concurrent PDF generations server-wide
const limit = pLimit(3);

// Singleton browser — reused across calls instead of relaunched each time
let browserInstance: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserInstance || !browserInstance.connected) {
    browserInstance = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--font-render-hinting=none',
        '--js-flags=--max-old-space-size=512',
      ],
    });
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

        // 'networkidle0' is only valid for page.goto(); setContent() only
        // supports 'load' | 'domcontentloaded'.
        await page.setContent(html, {
          waitUntil: 'load',
        });

        // page.waitForTimeout() was removed in newer puppeteer versions —
        // use a plain delay instead. This still gives fonts/images a beat
        // to finish rendering before the PDF snapshot.
        await delay(500);

        const pdfBuffer = await page.pdf({
          format: 'A4',
          printBackground: true,
          margin: {
            top: '60px',
            bottom: '40px',
            left: '60px',
            right: '60px',
          },
          displayHeaderFooter: false,
          preferCSSPageSize: true,
        });

        console.log(`✅ ${type} PDF generated successfully! Size: ${Math.round(pdfBuffer.length / 1024)}KB`);
        return Buffer.from(pdfBuffer);
      } finally {
        await page.close(); // always close the page, keep the browser alive
      }
    } catch (error) {
      console.error(`❌ Failed to generate ${type} PDF:`, error);
      throw new AppError(500, `Failed to generate ${type}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });
}

// Optional: call this on server shutdown (SIGTERM/SIGINT handler)
export async function closeBrowser() {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}

// For backward compatibility with existing code that expects DOCX
export async function generateDocumentFromTemplateAsDocx(
  type: TemplateType,
  data: MemoData | LetterData
): Promise<Buffer> {
  console.warn('⚠️ generateDocumentFromTemplateAsDocx is deprecated, use generateDocumentFromTemplate instead');
  return generateDocumentFromTemplate(type, data);
}