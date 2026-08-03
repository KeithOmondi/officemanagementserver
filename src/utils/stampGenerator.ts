// server/src/utils/stampGenerator.ts

import { PDFDocument, rgb, degrees, StandardFonts, type PDFFont, type PDFPage } from 'pdf-lib';

export interface StampGenerationOptions {
  /** The raw PDF buffer to stamp */
  pdfBuffer: Buffer;
  /** Date to print on the stamp. Defaults to now. */
  date?: Date;
  /** Big center line. Defaults to "APPROVED" */
  label?: string;
  /** Small line above the label. Defaults to "REGISTRAR HIGH COURT" */
  issuer?: string;
  /** Real signature PNG/JPG buffer to embed inside the stamp */
  signatureBuffer?: Buffer | null;
  /** Name of the approver to display on the stamp */
  approverName?: string;
  /** Vertical anchor for the stamp, as a fraction of page height from the bottom. Defaults to 0.16 */
  verticalAnchorFraction?: number;
  /** Rotation in degrees. Defaults to -16 */
  angle?: number;
  /** Which page to stamp (0-indexed). Defaults to the last page. */
  pageIndex?: number;
}

// ─── Helper Functions (Port from pdfStamp.ts) ───────────────────────────────

function rotatePoint(px: number, py: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: px * Math.cos(rad) - py * Math.sin(rad),
    y: px * Math.sin(rad) + py * Math.cos(rad),
  };
}

function drawRotatedRect(
  page: PDFPage,
  centerX: number,
  centerY: number,
  localOffsetX: number,
  localOffsetY: number,
  width: number,
  height: number,
  angle: number,
  color: ReturnType<typeof rgb>,
  borderWidth: number
) {
  const anchor = rotatePoint(localOffsetX, localOffsetY, angle);
  page.drawRectangle({
    x: centerX + anchor.x,
    y: centerY + anchor.y,
    width,
    height,
    borderColor: color,
    borderWidth,
    rotate: degrees(angle),
  });
}

function drawRotatedCenteredText(
  page: PDFPage,
  font: PDFFont,
  text: string,
  centerX: number,
  centerY: number,
  localOffsetY: number,
  size: number,
  angle: number,
  color: ReturnType<typeof rgb>,
  charSpacing = 0
) {
  const textWidth = font.widthOfTextAtSize(text, size) + charSpacing * (text.length - 1);
  const anchor = rotatePoint(-textWidth / 2, localOffsetY, angle);

  if (charSpacing === 0) {
    page.drawText(text, {
      x: centerX + anchor.x,
      y: centerY + anchor.y,
      size,
      font,
      color,
      rotate: degrees(angle),
    });
    return;
  }

  let cursor = 0;
  for (const ch of text) {
    const chWidth = font.widthOfTextAtSize(ch, size);
    const chAnchor = rotatePoint(-textWidth / 2 + cursor, localOffsetY, angle);
    page.drawText(ch, {
      x: centerX + chAnchor.x,
      y: centerY + chAnchor.y,
      size,
      font,
      color,
      rotate: degrees(angle),
    });
    cursor += chWidth + charSpacing;
  }
}

// ─── Main Export ─────────────────────────────────────────────────────────────

export async function generateStampOnPdf(
  options: StampGenerationOptions
): Promise<Buffer> {
  const {
    pdfBuffer,
    date = new Date(),
    label = 'APPROVED',
    issuer = 'REGISTRAR HIGH COURT',
    signatureBuffer = null,
    approverName = 'REGISTRAR',
    verticalAnchorFraction = 0.16,
    angle = -16,
    pageIndex,
  } = options;

  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const pages = pdfDoc.getPages();
  const targetPageIndex = pageIndex ?? pages.length - 1;
  const page = pages[targetPageIndex];
  const { width, height } = page.getSize();

  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const color = rgb(0.09, 0.24, 0.6); // Official stamp blue

  const dateStr = date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const centerX = width / 2;
  const centerY = height * verticalAnchorFraction;

  // ─── STAMP BOX DIMENSIONS ──────────────────────────────────────────────────
  const boxWidth = 220;
  const boxHeight = 140;

  // 1. Draw Outer Border
  drawRotatedRect(page, centerX, centerY, -boxWidth / 2, -boxHeight / 2, boxWidth, boxHeight, angle, color, 3);
  
  // 2. Draw Inner Border
  drawRotatedRect(
    page,
    centerX,
    centerY,
    -boxWidth / 2 + 6,
    -boxHeight / 2 + 6,
    boxWidth - 12,
    boxHeight - 12,
    angle,
    color,
    1
  );

  // 3. Draw Issuer
  drawRotatedCenteredText(page, font, issuer, centerX, centerY, boxHeight / 2 - 16, 9.5, angle, color, 1);
  
  // 4. Draw Label (APPROVED)
  drawRotatedCenteredText(page, font, label, centerX, centerY, boxHeight / 2 - 40, 20, angle, color);
  
  // 5. Draw Approver Name
  drawRotatedCenteredText(page, font, approverName.toUpperCase(), centerX, centerY, boxHeight / 2 - 58, 9, angle, color);
  
  // 6. Draw Date
  drawRotatedCenteredText(page, font, dateStr, centerX, centerY, boxHeight / 2 - 76, 9, angle, color);

  // 7. Draw Signature Image inside Stamp (if provided)
  if (signatureBuffer) {
    try {
      const sigImage = await pdfDoc.embedPng(signatureBuffer);
      const sigLocalOffsetY = -boxHeight / 2 + 28;
      const anchor = rotatePoint(0, sigLocalOffsetY, angle);
      const sigDims = sigImage.scaleToFit(boxWidth - 50, 28);
      
      page.drawImage(sigImage, {
        x: centerX + anchor.x - sigDims.width / 2,
        y: centerY + anchor.y,
        width: sigDims.width,
        height: sigDims.height,
        rotate: degrees(angle),
      });
    } catch (error) {
      console.warn('[stampGenerator] Failed to embed signature inside stamp:', error);
    }
  }

  return Buffer.from(await pdfDoc.save());
}