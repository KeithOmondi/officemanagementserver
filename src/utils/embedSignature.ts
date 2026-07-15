// src/utils/embedSignature.ts
import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';
import axios from 'axios';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

async function fetchBuffer(url: string): Promise<Buffer> {
  const res = await axios.get<ArrayBuffer>(url, { responseType: 'arraybuffer' });
  return Buffer.from(res.data);
}

// ── Manual override marker ──────────────────────────────────────────────────
const SIGNATURE_MARKER = '[[SIGNATURE]]';

// ── How close two text items' X positions must be to be considered the
//    same column ──────────────────────────────────────────────────────────────
const X_TOLERANCE = 80;

// ── Anchor text patterns, in priority order ─────────────────────────────────
const SALUTATION_PATTERNS = [
  /^sincerely,?$/i,
  /^yours\s+sincerely,?$/i,
  /^yours\s+faithfully,?$/i,
  /^respectfully\s+submitted,?$/i,
  /^respectfully\s+yours,?$/i,
  /^best\s+regards,?$/i,
  /^looking\s+forward\s+to/i,
];

// ── Signature block patterns - these are the specific formats we're looking for ──
// The signature block typically has: NAME on one line, TITLE on the next
const SIGNATURE_BLOCK_PATTERNS = [
  // Exact pattern for the registrar signature block
  /CLARA\s+OTIENO\s*[—\-]\s*OMONDI/i,
  /HON\.?\s*CLARA\s+OTIENO\s*[—\-]\s*OMONDI/i,
  // Registrar title patterns
  /REGISTRAR\s*,\s*HIGH\s*COURT/i,
  /REGISTRAR\s+HIGH\s+COURT/i,
  /REGISTRAR\s*[—\-]\s*HIGH\s*COURT/i,
];

// ── Generic signer patterns (fallback) ──────────────────────────────────────
const SIGNER_LINE_PATTERNS = [
  /registrar/i,
  /dean/i,
  /chief\s+justice/i,
  /director/i,
  /^hon\.?\s/i,
  /^prof\.?\s/i,
];

// ── Patterns that appear in headers/body and should be ignored ──────────────
const IGNORE_PATTERNS = [
  /from\s*:\s*registrar/i,
  /office\s+of\s+the\s+registrar/i,
  /greetings\s+from\s+the\s+office\s+of\s+the\s+registrar/i,
  /registrar\s+high\s+court\s+[a-z]/i, // "Registrar High Court" followed by more text = body
];

type TextItem = {
  str: string;
  x: number;
  y: number;
  pageIndex: number;
};

type Anchor = {
  x: number;
  y: number;
  pageIndex: number;
  nextLineY: number | null;
  placement: 'below' | 'above';
  anchorLine: string;
};

/**
 * Extract text items from ALL pages of the PDF
 */
async function extractAllPagesTextItems(pdfBytes: Uint8Array): Promise<{
  items: TextItem[];
  pageHeights: number[];
}> {
  const pdf = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
  const allItems: TextItem[] = [];
  const pageHeights: number[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1 });
    const textContent = await page.getTextContent();

    const items: TextItem[] = textContent.items
      .filter((it: any) => typeof it.str === 'string' && it.str.trim().length > 0)
      .map((it: any) => {
        const [, , , , x, y] = it.transform;
        return {
          str: it.str as string,
          x: x as number,
          y: y as number,
          pageIndex: i - 1,
        };
      });

    allItems.push(...items);
    pageHeights.push(viewport.height);
  }

  return { items: allItems, pageHeights };
}

/**
 * Check if a text item should be ignored (not a real signature block)
 */
function shouldIgnoreText(str: string): boolean {
  const trimmed = str.trim();
  for (const pattern of IGNORE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if a text item is likely part of a signature block.
 *
 * NOTE: This previously also required the item to sit in the bottom 35%
 * of the page (`item.y < pageHeight * 0.35`). That gate broke short
 * documents: with little body content, "Yours sincerely," and the
 * name/title block naturally render well above the bottom-35% line,
 * since there's no bulk of text pushing them down the page. Every
 * anchor candidate (signature block, salutation, and generic signer
 * patterns) was being rejected on short letters, causing
 * findAnchorPosition() to return null and silently fall back to a
 * fixed page-percentage position — landing the signature near the
 * footer, disconnected from "sincerely" or the name.
 *
 * IGNORE_PATTERNS already excludes header occurrences of "Registrar" /
 * "Office of the Registrar", and the anchor search already scans from
 * the bottom of the page upward and takes the LAST match — so position
 * gating is redundant for correctness and only hurts short documents.
 * pageHeight is kept as a parameter so call sites don't need to change.
 */
function isSignatureBlockCandidate(item: TextItem, _pageHeight: number): boolean {
  return !shouldIgnoreText(item.str);
}

/**
 * Walk upward through consecutive tightly-spaced lines, in the SAME COLUMN
 * as the starting item, to find the top of the name/title block.
 */
function findBlockTop(
  items: TextItem[],
  startIndex: number,
  pageIndex: number
): TextItem {
  let topItem = items[startIndex];
  const LINE_GAP_THRESHOLD = 28;

  for (let i = startIndex - 1; i >= 0; i--) {
    const current = items[i];
    if (current.pageIndex !== pageIndex) break;

    const gap = Math.abs(current.y - topItem.y);
    if (gap >= LINE_GAP_THRESHOLD) break;

    const sameColumn = Math.abs(current.x - topItem.x) < X_TOLERANCE;
    if (sameColumn) {
      topItem = current;
    }
  }

  return topItem;
}

/**
 * Get the Y of the next line below a given item, restricted to the same column.
 */
function getNextLineBelow(sorted: TextItem[], index: number): number | null {
  const anchorX = sorted[index].x;
  for (let i = index + 1; i < sorted.length; i++) {
    if (sorted[i].y < sorted[index].y && Math.abs(sorted[i].x - anchorX) < X_TOLERANCE) {
      return sorted[i].y;
    }
  }
  return null;
}

/**
 * Find the signature block anchor - looks for the LAST occurrence of
 * signature patterns on each page (bottom of the document).
 */
function findAnchorPosition(
  items: TextItem[],
  pageHeights: number[]
): Anchor | null {
  const itemsByPage: Record<number, TextItem[]> = {};
  for (const item of items) {
    if (!itemsByPage[item.pageIndex]) {
      itemsByPage[item.pageIndex] = [];
    }
    itemsByPage[item.pageIndex].push(item);
  }

  const pageIndices = Object.keys(itemsByPage).map(Number).sort((a, b) => b - a);

  for (const pageIndex of pageIndices) {
    const pageItems = itemsByPage[pageIndex];
    const sorted = [...pageItems].sort((a, b) => b.y - a.y);
    const pageHeight = pageHeights[pageIndex] || 842;

    // ── Manual override ──────────────────────────────────────────────────────────
    const markerIdx = sorted.findIndex((it) => it.str.includes(SIGNATURE_MARKER));
    if (markerIdx !== -1) {
      const m = sorted[markerIdx];
      return {
        x: m.x,
        y: m.y,
        pageIndex: m.pageIndex,
        nextLineY: getNextLineBelow(sorted, markerIdx),
        placement: 'below',
        anchorLine: m.str.trim(),
      };
    }

    // ── 1. Find signature block patterns (most specific) ──────────────────────
    // Look for the specific signature block format (NAME + TITLE)
    let signatureMatch: { index: number; item: TextItem } | null = null;
    
    for (const pattern of SIGNATURE_BLOCK_PATTERNS) {
      for (let i = sorted.length - 1; i >= 0; i--) {
        const item = sorted[i];
        if (pattern.test(item.str.trim()) && isSignatureBlockCandidate(item, pageHeight)) {
          signatureMatch = { index: i, item };
          break;
        }
      }
      if (signatureMatch) break;
    }

    if (signatureMatch) {
      const m = signatureMatch.item;
      const idx = signatureMatch.index;
      
      // Walk up to find the top of the name/title block
      const blockTop = findBlockTop(sorted, idx, m.pageIndex);
      const blockTopIdx = sorted.indexOf(blockTop);
      
      return {
        x: blockTop.x,
        y: blockTop.y,
        pageIndex: blockTop.pageIndex,
        nextLineY: getNextLineBelow(sorted, blockTopIdx),
        placement: 'above',
        anchorLine: blockTop.str.trim(),
      };
    }

    // ── 2. Find salutation patterns (strongest signal) ────────────────────────
    let salutationMatch: { index: number; item: TextItem } | null = null;
    for (const pattern of SALUTATION_PATTERNS) {
      for (let i = sorted.length - 1; i >= 0; i--) {
        const item = sorted[i];
        if (pattern.test(item.str.trim()) && isSignatureBlockCandidate(item, pageHeight)) {
          salutationMatch = { index: i, item };
          break;
        }
      }
      if (salutationMatch) break;
    }

    if (salutationMatch) {
      const m = salutationMatch.item;
      const idx = salutationMatch.index;
      return {
        x: m.x,
        y: m.y,
        pageIndex: m.pageIndex,
        nextLineY: getNextLineBelow(sorted, idx),
        placement: 'below',
        anchorLine: m.str.trim(),
      };
    }

    // ── 3. Find generic signer patterns (fallback) ─────────────────────────────
    let signerMatch: { index: number; item: TextItem } | null = null;
    for (const pattern of SIGNER_LINE_PATTERNS) {
      for (let i = sorted.length - 1; i >= 0; i--) {
        const item = sorted[i];
        if (pattern.test(item.str.trim()) && isSignatureBlockCandidate(item, pageHeight)) {
          signerMatch = { index: i, item };
          break;
        }
      }
      if (signerMatch) break;
    }

    if (signerMatch) {
      const m = signerMatch.item;
      const idx = signerMatch.index;
      
      const blockTop = findBlockTop(sorted, idx, m.pageIndex);
      const blockTopIdx = sorted.indexOf(blockTop);
      
      return {
        x: blockTop.x,
        y: blockTop.y,
        pageIndex: blockTop.pageIndex,
        nextLineY: getNextLineBelow(sorted, blockTopIdx),
        placement: 'above',
        anchorLine: blockTop.str.trim(),
      };
    }
  }

  return null;
}

/**
 * Fallback: place on the last page if no anchor found
 */
function fallbackPosition(pageHeights: number[]): { y: number; pageIndex: number } {
  const lastPageIndex = pageHeights.length - 1;
  const height = pageHeights[lastPageIndex] || 842;

  let yPosition: number;
  if (height >= 800) yPosition = height * 0.12;
  else if (height >= 700) yPosition = height * 0.10;
  else yPosition = height * 0.08;

  const minY = 40;
  const maxY = height * 0.25;

  return {
    y: Math.min(Math.max(yPosition, minY), maxY),
    pageIndex: lastPageIndex,
  };
}

export async function embedSignatureIntoPDF(
  pdfBuffer: Buffer,
  signatureUrl: string
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const pages = pdfDoc.getPages();

  const sigBuffer = await fetchBuffer(signatureUrl);
  const sigPng = await sharp(sigBuffer).png().toBuffer();
  const sigImage = await pdfDoc.embedPng(sigPng);

  let targetPageIndex = pages.length - 1;
  let x = 60;
  let y: number;
  let targetWidth = 180;
  let targetHeight = 80;
  const GAP_ABOVE_NEXT_LINE = 8;
  const DROP_BELOW_ANCHOR = 6;
  const MIN_SIG_HEIGHT = 28;
  const MAX_SIG_HEIGHT = 80;
  const MAX_PLAUSIBLE_ABOVE_GAP = 200;

  try {
    const { items, pageHeights } = await extractAllPagesTextItems(
      new Uint8Array(pdfBuffer)
    );
    const anchor = findAnchorPosition(items, pageHeights);

    if (anchor) {
      targetPageIndex = anchor.pageIndex;
      x = anchor.x;

      if (anchor.placement === 'below') {
        // ── Place signature below salutation ──────────────────────────────────────
        if (anchor.nextLineY !== null) {
          const gap = anchor.y - anchor.nextLineY - GAP_ABOVE_NEXT_LINE - DROP_BELOW_ANCHOR;
          targetHeight = Math.max(MIN_SIG_HEIGHT, Math.min(MAX_SIG_HEIGHT, gap));
          targetWidth = targetHeight * (180 / 80);
          y = anchor.nextLineY + GAP_ABOVE_NEXT_LINE;
        } else {
          targetHeight = MAX_SIG_HEIGHT;
          targetWidth = 180;
          y = anchor.y - DROP_BELOW_ANCHOR - targetHeight;
        }
      } else {
        // ── Place signature above name/title block ────────────────────────────────
        const pageItems = items.filter((it) => it.pageIndex === anchor.pageIndex);
        const sorted = [...pageItems].sort((a, b) => b.y - a.y);
        const anchorIndex = sorted.findIndex(
          (it) => it.x === anchor.x && it.y === anchor.y
        );

        // Find the line above the block with a significant gap, same column only
        let prevLineY: number | null = null;

        for (let i = anchorIndex - 1; i >= 0; i--) {
          if (sorted[i].y > anchor.y) {
            const sameColumn = Math.abs(sorted[i].x - anchor.x) < X_TOLERANCE;
            if (!sameColumn) continue;
            const gap = sorted[i].y - anchor.y;
            if (gap > 30) {
              prevLineY = sorted[i].y;
              break;
            }
          }
        }

        if (prevLineY !== null) {
          const availableSpace = prevLineY - anchor.y;

          if (availableSpace > MAX_PLAUSIBLE_ABOVE_GAP) {
            targetHeight = MAX_SIG_HEIGHT * 0.7;
            targetWidth = targetHeight * (180 / 80);
            y = anchor.y + 12;
          } else {
            targetHeight = Math.max(MIN_SIG_HEIGHT, Math.min(MAX_SIG_HEIGHT, availableSpace * 0.55));
            targetWidth = targetHeight * (180 / 80);
            y = anchor.y + (availableSpace - targetHeight) * 0.4;
          }
        } else {
          // Place directly above the name block
          targetHeight = MAX_SIG_HEIGHT * 0.7;
          targetWidth = targetHeight * (180 / 80);
          y = anchor.y + 12;
        }
      }
    } else {
      const fallback = fallbackPosition(pageHeights);
      targetPageIndex = fallback.pageIndex;
      y = fallback.y;
    }
  } catch (err) {
    console.error('Signature placement: text extraction failed, using fallback', err);
    const height = pages[pages.length - 1].getSize().height;
    y = fallbackPosition([height]).y;
    targetPageIndex = pages.length - 1;
  }

  // ── Apply the signature to the correct page ─────────────────────────────────
  const targetPage = pages[targetPageIndex];
  const { height } = targetPage.getSize();

  if (y < 20) y = 20;
  if (y + targetHeight > height - 20) y = height - targetHeight - 20;

  const sigDims = sigImage.scaleToFit(targetWidth, targetHeight);

  targetPage.drawImage(sigImage, {
    x,
    y,
    width: sigDims.width,
    height: sigDims.height,
  });

  return Buffer.from(await pdfDoc.save());
}

export function embedSignatureIntoHTML(
  htmlBody: string,
  signatureUrl: string
): string {
  const sigImg = `<img 
    src="${signatureUrl}" 
    alt="Official Signature"
    style="max-width:200px; max-height:80px; display:block; margin:0 0 6px 0;"
  />`;

  // ── Method 1: Replace explicit placeholder ──────────────────────────────────
  if (htmlBody.includes('id="sig-placeholder"')) {
    return htmlBody.replace(
      /<div[^>]*id="sig-placeholder"[^>]*>.*?<\/div>/s,
      sigImg
    );
  }

  // ── Method 2: Look for signature block patterns ─────────────────────────────
  const signatureBlockPatterns = [
    /CLARA\s+OTIENO\s*[—\-]\s*OMONDI/i,
    /HON\.?\s*CLARA\s+OTIENO\s*[—\-]\s*OMONDI/i,
    /REGISTRAR\s*,\s*HIGH\s*COURT/i,
    /REGISTRAR\s+HIGH\s+COURT/i,
  ];

  for (const pattern of signatureBlockPatterns) {
    const matches = [...htmlBody.matchAll(new RegExp(pattern, 'gi'))];
    if (matches.length > 0) {
      const lastMatch = matches[matches.length - 1];
      const pos = lastMatch.index!;
      const before = htmlBody.slice(0, pos);
      const after = htmlBody.slice(pos);
      return before + sigImg + '<br>' + after;
    }
  }

  // ── Method 3: Look for salutation patterns ──────────────────────────────────
  const salutationPatterns = [
    /Sincerely,?/i,
    /Yours\s+sincerely,?/i,
    /Yours\s+faithfully,?/i,
    /Respectfully\s+submitted,?/i,
    /Best\s+regards,?/i,
    /Looking\s+forward\s+to/i,
  ];

  for (const pattern of salutationPatterns) {
    const matches = [...htmlBody.matchAll(new RegExp(pattern, 'gi'))];
    if (matches.length > 0) {
      const lastMatch = matches[matches.length - 1];
      const pos = lastMatch.index! + lastMatch[0].length;
      return htmlBody.slice(0, pos) + `<br>${sigImg}` + htmlBody.slice(pos);
    }
  }

  // ── Method 4: Look for generic name patterns (fallback) ─────────────────────
  const namePatterns = [
    /Hon\.?\s*Clara\s*Otieno[-\s]Omondi/i,
    /Registrar\s*[—\-]\s*High\s*Court/i,
  ];

  for (const pattern of namePatterns) {
    const matches = [...htmlBody.matchAll(new RegExp(pattern, 'gi'))];
    if (matches.length > 0) {
      const lastMatch = matches[matches.length - 1];
      const pos = lastMatch.index!;
      const before = htmlBody.slice(0, pos);
      const after = htmlBody.slice(pos);
      return before + sigImg + '<br>' + after;
    }
  }

  // ── Method 5: Look for signature block class ────────────────────────────────
  const sigBlockPatterns = [
    /<div[^>]*class="[^"]*signature-block[^"]*"[^>]*>[\s\S]*?<\/div>/si,
    /<div[^>]*class="[^"]*sig-block[^"]*"[^>]*>[\s\S]*?<\/div>/si,
  ];

  for (const pattern of sigBlockPatterns) {
    const matches = [...htmlBody.matchAll(pattern)];
    if (matches.length > 0) {
      const lastMatch = matches[matches.length - 1];
      return htmlBody.replace(
        lastMatch[0],
        lastMatch[0].replace(/>/, `>${sigImg}`)
      );
    }
  }

  // ── Fallback: Insert near the end of the body ─────────────────────────────
  const bodyEnd = htmlBody.lastIndexOf('</body>');
  if (bodyEnd !== -1) {
    const beforeEnd = htmlBody.substring(0, bodyEnd);
    const afterEnd = htmlBody.substring(bodyEnd);
    const lastP = beforeEnd.match(/<p[^>]*>.*?<\/p>/gi);
    if (lastP && lastP.length > 0) {
      const lastParagraph = lastP[lastP.length - 1];
      const lastPIndex = beforeEnd.lastIndexOf(lastParagraph);
      if (lastPIndex !== -1) {
        const beforeP = beforeEnd.substring(0, lastPIndex + lastParagraph.length);
        const afterP = beforeEnd.substring(lastPIndex + lastParagraph.length);
        return beforeP + `<br>${sigImg}` + afterP + afterEnd;
      }
    }
    return `${beforeEnd}<div style="margin-top:20px;">${sigImg}</div>${afterEnd}`;
  }

  return htmlBody + `<div style="margin-top:20px;">${sigImg}</div>`;
}