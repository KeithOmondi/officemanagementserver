// src/utils/embedSignature.ts

import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';
import axios from 'axios';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

async function fetchBuffer(url: string): Promise<Buffer> {
  console.log('[fetchBuffer] Fetching:', url);
  const res = await axios.get<ArrayBuffer>(url, { responseType: 'arraybuffer' });
  console.log('[fetchBuffer] Fetched:', res.data.byteLength, 'bytes');
  return Buffer.from(res.data);
}

type TextItem = {
  str: string;
  x: number;
  y: number;
  pageIndex: number;
};

async function extractTextItems(pdfBytes: Uint8Array): Promise<{
  items: TextItem[];
  pageHeights: number[];
}> {
  console.log('[extractTextItems] Starting extraction...');
  const pdf = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
  console.log('[extractTextItems] PDF loaded, pages:', pdf.numPages);

  const allItems: TextItem[] = [];
  const pageHeights: number[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    console.log(`[extractTextItems] Processing page ${i}...`);
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1 });
    const textContent = await page.getTextContent();
    console.log(`[extractTextItems] Page ${i} has ${textContent.items.length} text items`);

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

    console.log(`[extractTextItems] Page ${i} extracted ${items.length} items`);
    items.slice(0, 10).forEach((item, idx) => {
      console.log(`  [${idx}] "${item.str.trim()}" at x:${item.x.toFixed(0)}, y:${item.y.toFixed(0)}`);
    });

    allItems.push(...items);
    pageHeights.push(viewport.height);
  }

  console.log(`[extractTextItems] Total items: ${allItems.length}`);
  return { items: allItems, pageHeights };
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Must stay in sync with SIGNATURE_ANCHOR_TEXT in src/templates/LetterTemplate.ts.
const SIGNATURE_ANCHOR_TEXT = 'RHC-SIGNATURE-ANCHOR';

// Lines that should never be mistaken for a signatory name — the loose
// DEFAULT_NAME_PATTERN fallback (used when no signerName is supplied)
// matches any two-capitalized-word run, which "Yours Sincerely" or
// "Dear Sir" would also satisfy. Explicitly skip these before testing
// name patterns against a line, in both Pass 1 and Pass 2 below.
const EXCLUDED_LINE_PATTERNS = [
  /^yours\s+(sincerely|faithfully|truly)/i,
  /^respectfully/i,
  /^regards/i,
  /^dear\b/i,
  /^ref\s*:/i,
  /^date\s*:/i,
];

function isExcludedLine(text: string): boolean {
  return EXCLUDED_LINE_PATTERNS.some((p) => p.test(text.trim()));
}

/**
 * Default pattern to match a signatory name line, used only when no
 * signerName is supplied. Tightened to require at least two capitalized
 * words (matching the template's uppercase signature styling) rather
 * than any arbitrary run of letters — the previous version matched
 * phrases like "Yours sincerely" just as easily as an actual name.
 */
const DEFAULT_NAME_PATTERN =
  /(?:HON\.?\s*)?\b([A-Z][A-Za-z'-]*\s+[A-Z][A-Za-z'-]*(?:\s+[A-Z][A-Za-z'-]*)?)\b(?:\s*,\s*(?:OGW|CBS|MBS|EBS|HSC|EGH)\.?)?/;

// Tunable placement offsets — adjust these two numbers to nudge the
// signature relative to the detected name line without touching the
// detection logic itself. In PDF coordinates, y grows UPWARD, so a
// SMALLER SIGNATURE_Y_OFFSET moves the signature DOWN (closer to the
// name); a NEGATIVE SIGNATURE_X_OFFSET shifts it LEFT relative to the
// name's left edge.
const SIGNATURE_Y_OFFSET = 12;
const SIGNATURE_X_OFFSET = -10;

/**
 * Build a set of case-insensitive regexes that match a signer's name.
 * If no name is given, falls back to the default pattern above.
 */
function buildNamePatterns(fullName?: string | null): RegExp[] {
  if (fullName && fullName.trim()) {
    const cleaned = fullName
      .replace(/^(hon\.?|dr\.?|mr\.?|mrs\.?|ms\.?|prof\.?)\s+/i, '')
      .replace(/,?\s*(OGW|CBS|MBS|EBS|HSC|EGH)\.?\s*$/i, '')
      .trim();

    const words = cleaned.split(/\s+/).filter(Boolean);
    if (words.length > 0) {
      const patterns: RegExp[] = [];
      // Full name with flexible whitespace/hyphens
      const fullPattern = words.map((w) => escapeRegex(w)).join('\\s*[-–—\\s]*\\s*');
      const suffix = '(?:,?\\s*(?:OGW|CBS|MBS|EBS|HSC|EGH)\\.?)?';
      patterns.push(new RegExp(fullPattern + suffix, 'i'));
      patterns.push(new RegExp(`HON\\.?\\s*${fullPattern}${suffix}`, 'i'));
      // Last name alone
      if (words.length > 1) {
        const last = escapeRegex(words[words.length - 1]);
        patterns.push(new RegExp(`\\b${last}\\b${suffix}`, 'i'));
      }
      // Also try each word (e.g., first name alone)
      for (const w of words) {
        patterns.push(new RegExp(`\\b${escapeRegex(w)}\\b`, 'i'));
      }
      return patterns;
    }
  }
  return [DEFAULT_NAME_PATTERN];
}

/**
 * Group text items by visual line (same y within tolerance) and concatenate
 * their strings in left-to-right order.
 */
function groupItemsByLine(items: TextItem[], tolerance = 3): { y: number; text: string; items: TextItem[] }[] {
  const groups: { y: number; items: TextItem[] }[] = [];
  for (const item of items) {
    let found = false;
    for (const g of groups) {
      if (Math.abs(g.y - item.y) <= tolerance) {
        g.items.push(item);
        found = true;
        break;
      }
    }
    if (!found) {
      groups.push({ y: item.y, items: [item] });
    }
  }
  // Sort each group's items by x ascending
  for (const g of groups) {
    g.items.sort((a, b) => a.x - b.x);
  }
  // Concatenate and compute average y
  return groups.map((g) => ({
    y: g.y,
    text: g.items.map((it) => it.str).join(' ').trim(),
    items: g.items,
  }));
}

function findSignatureBlockPosition(
  items: TextItem[],
  pageHeights: number[],
  signerName?: string | null
): { y: number; pageIndex: number; x: number } | null {
  console.log('[findSignatureBlockPosition] Searching for signature block...');
  console.log('[findSignatureBlockPosition] Items:', items.length);
  console.log('[findSignatureBlockPosition] Signer name:', signerName ?? '(none provided)');

  const itemsByPage: Record<number, TextItem[]> = {};
  for (const item of items) {
    if (!itemsByPage[item.pageIndex]) {
      itemsByPage[item.pageIndex] = [];
    }
    itemsByPage[item.pageIndex].push(item);
  }

  const pageIndices = Object.keys(itemsByPage).map(Number).sort((a, b) => b - a);
  console.log('[findSignatureBlockPosition] Pages:', pageIndices);

  // Build name and title patterns
  const namePatterns = buildNamePatterns(signerName);
  const titlePatterns = [
    /REGISTRAR\s*,\s*HIGH\s*COURT/i,
    /REGISTRAR\s+HIGH\s+COURT/i,
    /REGISTRAR\s*[—\-]\s*HIGH\s*COURT/i,
    /HIGH\s*COURT/i,
    /registrar/i,
  ];

  // ── Pass 0: explicit anchor marker ──────────────────────────────────────────
// ── Pass 0: explicit anchor marker (line-based, robust to item splitting) ──
  console.log('[findSignatureBlockPosition] Pass 0: Searching for explicit signature anchor...');
  for (const pageIndex of pageIndices) {
    const pageItems = itemsByPage[pageIndex];
    const lines = groupItemsByLine(pageItems);
    for (const line of lines) {
    if (line.text.includes(SIGNATURE_ANCHOR_TEXT)) {
  const anchorItem = line.items[0];
  // Nudged down slightly from -5 for better spacing under the anchor;
  // still well clear of the -35 overlap issue from before.
  const signatureY = line.y - 25;
  console.log(`[findSignatureBlockPosition] Found anchor marker (line: "${line.text}"), RETURNING: y=${signatureY}, page=${pageIndex + 1}`);
  return { y: signatureY, pageIndex, x: anchorItem.x || 60 };
}
    }
  }
  console.log('[findSignatureBlockPosition] No anchor marker found, falling back to fuzzy matching');

  // ── Prepare lines per page ──────────────────────────────────────────────────
  // We'll process pages from last to first.
  for (const pageIndex of pageIndices) {
    const pageItems = itemsByPage[pageIndex];
    const lines = groupItemsByLine(pageItems);
    // Sort lines from bottom to top (lower y first) because PDF y increases upward.
    lines.sort((a, b) => a.y - b.y);

    console.log(`[findSignatureBlockPosition] Page ${pageIndex + 1} has ${lines.length} lines`);

    // ── Pass 1: Direct name match (prefer bottom-most occurrence) ─────────────
    console.log('[findSignatureBlockPosition] Pass 1: Searching directly for signer name in lines...');
    let nameLine: { y: number; text: string; items: TextItem[] } | null = null;
    // Iterate from bottom to top (since we want the last occurrence)
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      if (isExcludedLine(line.text)) continue; // skip "Yours sincerely," etc.
      for (const pattern of namePatterns) {
        if (pattern.test(line.text)) {
          nameLine = line;
          console.log(`[findSignatureBlockPosition] Found name in line: "${line.text}" at y: ${line.y}`);
          break;
        }
      }
      if (nameLine) break;
    }

    if (nameLine) {
      // Place signature above the name line
      const signatureY = nameLine.y + SIGNATURE_Y_OFFSET;
      // Use the leftmost x of the line items
      const x = nameLine.items.length > 0 ? Math.min(...nameLine.items.map(it => it.x)) : 60;
      console.log(`[findSignatureBlockPosition] RETURNING (name line): y=${signatureY}, x=${x + SIGNATURE_X_OFFSET}, page=${pageIndex + 1}`);
      return { y: signatureY, pageIndex, x: Math.max(10, x + SIGNATURE_X_OFFSET) };
    }

    // ── Pass 2: Title + name above title ──────────────────────────────────────
    console.log('[findSignatureBlockPosition] Pass 2: Searching for title + name above...');
    let titleLine: { y: number; text: string; items: TextItem[] } | null = null;
    // Find title (prefer bottom-most)
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      for (const pattern of titlePatterns) {
        if (pattern.test(line.text)) {
          titleLine = line;
          console.log(`[findSignatureBlockPosition] Found title line: "${line.text}" at y: ${line.y}`);
          break;
        }
      }
      if (titleLine) break;
    }

    if (titleLine) {
      // Find the line immediately above the title (higher y) that matches a name pattern
      const titleIdx = lines.indexOf(titleLine);
      let nameAbove: { y: number; text: string; items: TextItem[] } | null = null;
      // Look upwards from title (indices > titleIdx because sorted ascending y)
      for (let i = titleIdx + 1; i < lines.length; i++) {
        const line = lines[i];
        if (isExcludedLine(line.text)) continue; // skip "Yours sincerely," etc.
        for (const pattern of namePatterns) {
          if (pattern.test(line.text)) {
            nameAbove = line;
            console.log(`[findSignatureBlockPosition] Found name above title: "${line.text}" at y: ${line.y}`);
            break;
          }
        }
        if (nameAbove) break;
      }

      if (nameAbove) {
        const signatureY = nameAbove.y + SIGNATURE_Y_OFFSET;
        const x = nameAbove.items.length > 0 ? Math.min(...nameAbove.items.map(it => it.x)) : 60;
        console.log(`[findSignatureBlockPosition] RETURNING (name above title): y=${signatureY}, x=${x + SIGNATURE_X_OFFSET}, page=${pageIndex + 1}`);
        return { y: signatureY, pageIndex, x: Math.max(10, x + SIGNATURE_X_OFFSET) };
      } else {
        // Fallback: place above the title line itself
        const signatureY = titleLine.y + SIGNATURE_Y_OFFSET;
        const x = titleLine.items.length > 0 ? Math.min(...titleLine.items.map(it => it.x)) : 60;
        console.log(`[findSignatureBlockPosition] RETURNING (title only): y=${signatureY}, x=${x + SIGNATURE_X_OFFSET}, page=${pageIndex + 1}`);
        return { y: signatureY, pageIndex, x: Math.max(10, x + SIGNATURE_X_OFFSET) };
      }
    }
  }

  // ── Last resort: bottom of last page ──────────────────────────────────────
  console.log('[findSignatureBlockPosition] No title found, using last resort');
  const lastPageIndex = pageIndices[0];
  const lastPageItems = itemsByPage[lastPageIndex];
  if (lastPageItems && lastPageItems.length > 0) {
    const sorted = [...lastPageItems].sort((a, b) => b.y - a.y);
    const lastItem = sorted[0];
    if (lastItem) {
      const signatureY = lastItem.y + 50;
      console.log(`[findSignatureBlockPosition] LAST RESORT: y=${signatureY}, page=${lastItem.pageIndex + 1}`);
      return { y: signatureY, pageIndex: lastItem.pageIndex, x: lastItem.x || 60 };
    }
  }

  console.log('[findSignatureBlockPosition] No position found, returning null');
  return null;
}

/**
 * Embed a signature image into a PDF.
 * The signature is placed directly above the signatory block (name + title)
 * by scanning the document text. No placement options are provided; the
 * detection is automatic.
 *
 * @param pdfBuffer - The PDF buffer to embed the signature into
 * @param signatureUrl - URL of the signature image
 * @param position - Optional custom position { x, y, width, height }
 *                   where x,y are from TOP of the document (frontend coordinates)
 * @param signerName - Optional signer's full name; if provided, it is used to
 *                     build name-matching patterns; otherwise a default pattern
 *                     matching typical ORHC signatories is used.
 * @returns The modified PDF buffer, or the original if placement failed.
 */
export async function embedSignatureIntoPDF(
  pdfBuffer: Buffer,
  signatureUrl: string,
  position?: { x: number; y: number; width: number; height: number } | null,
  signerName?: string | null
): Promise<Buffer> {
  console.log(`[embedSignature] signer: ${signerName ?? '(none provided)'}`);

  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const pages = pdfDoc.getPages();

  if (pages.length === 0) {
    return pdfBuffer;
  }

  const sigBuffer = await fetchBuffer(signatureUrl);
  const sigPng = await sharp(sigBuffer).png().toBuffer();
  const sigImage = await pdfDoc.embedPng(sigPng);

  // ── If custom position is provided ──────────────────────────────────────────
  if (position) {
    console.log(`[embedSignature] Using custom position: x=${position.x}, y=${position.y}, w=${position.width}, h=${position.height}`);

    let targetPageIndex = 0;
    let yWithinPage = position.y;
    let cumulativeHeight = 0;

    const pageHeights = pages.map((p) => p.getSize().height);

    for (let i = 0; i < pageHeights.length; i++) {
      const h = pageHeights[i];
      if (position.y < cumulativeHeight + h) {
        targetPageIndex = i;
        yWithinPage = position.y - cumulativeHeight;
        break;
      }
      cumulativeHeight += h;
    }

    if (targetPageIndex === pages.length - 1 && position.y >= cumulativeHeight) {
      const lastPageHeight = pageHeights[pageHeights.length - 1];
      yWithinPage = Math.min(position.y - cumulativeHeight, lastPageHeight - 10);
    }

    console.log(`[embedSignature] Mapped to page ${targetPageIndex + 1}, yWithinPage=${yWithinPage.toFixed(2)}`);

    const targetPage = pages[targetPageIndex];
    const { width, height } = targetPage.getSize();


const targetWidth = Math.min(position.width || 150, width * 0.28);
const targetHeight = Math.min(position.height || 60, targetWidth * 0.35);
    const sigDims = sigImage.scaleToFit(targetWidth, targetHeight);

    let x = position.x;
    let y = height - yWithinPage - sigDims.height;

    x = Math.max(10, Math.min(x, width - sigDims.width - 10));
    y = Math.max(10, Math.min(y, height - sigDims.height - 10));

    console.log(`[embedSignature] Page ${targetPageIndex + 1}: x=${x.toFixed(0)}, y=${y.toFixed(0)}`);

    targetPage.drawImage(sigImage, {
      x,
      y,
      width: sigDims.width,
      height: sigDims.height,
    });

    return Buffer.from(await pdfDoc.save());
  }

  // ── No custom position: detect signature block via text extraction ──────
  let detected: { y: number; pageIndex: number; x: number } | null = null;
  try {
    const { items, pageHeights } = await extractTextItems(new Uint8Array(pdfBuffer));
    detected = findSignatureBlockPosition(items, pageHeights, signerName);
  } catch (err) {
    console.warn('[embedSignature] Text-based signature detection failed, will skip embedding', err);
  }

  if (detected) {
    const targetPage = pages[detected.pageIndex] ?? pages[pages.length - 1];
    const { width, height } = targetPage.getSize();

    const signatureWidth = Math.min(170, width * 0.30);
const signatureHeight = Math.min(65, signatureWidth * 0.35);
    const sigDims = sigImage.scaleToFit(signatureWidth, signatureHeight);

    let x = detected.x || 60;
    let y = detected.y;

    // Clamp to page bounds
    x = Math.max(10, Math.min(x, width - sigDims.width - 10));
    y = Math.max(10, Math.min(y, height - sigDims.height - 10));

    console.log(`[embedSignature] Text-detected position on page ${detected.pageIndex + 1}: x=${x.toFixed(0)}, y=${y.toFixed(0)}`);

    targetPage.drawImage(sigImage, {
      x,
      y,
      width: sigDims.width,
      height: sigDims.height,
    });

    return Buffer.from(await pdfDoc.save());
  }

  // If detection fails, return the PDF unchanged (no signature)
  console.warn('[embedSignature] No signature block detected; returning original PDF without signature.');
  return pdfBuffer;
}

/**
 * Embed a signature image into an HTML document.
 * The signature is placed directly above the signatory block (name + title)
 * by scanning the HTML text. No placement options are provided.
 *
 * @param htmlBody - The HTML body content (as a string)
 * @param signatureUrl - URL of the signature image
 * @param signerName - Optional signer's full name; if provided, it is used to
 *                     build name-matching patterns; otherwise a default pattern
 *                     matching typical ORHC signatories is used.
 * @returns The modified HTML string
 */
export function embedSignatureIntoHTML(
  htmlBody: string,
  signatureUrl: string,
  signerName?: string | null
): string {
  console.log(`[embedSignatureHTML] signer: ${signerName ?? '(none provided)'}`);

  const imgTag = `<img src="${signatureUrl}" alt="Official Signature" style="max-width:200px; max-height:80px; display:block;" />`;
  const wrapImg = (align: 'center' | 'left' | 'right') => {
    const justifyContent = align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center';
    return `<div style="display:flex; justify-content:${justifyContent}; margin:16px 0;">${imgTag}</div>`;
  };

  // ── 0. Explicit anchor marker ─────────────────────────────────────────────
  const anchorIndex = htmlBody.indexOf(SIGNATURE_ANCHOR_TEXT);
  if (anchorIndex !== -1) {
    console.log('[embedSignatureHTML] Found anchor marker, inserting at marker position');
    const before = htmlBody.slice(0, anchorIndex);
    const after = htmlBody.slice(anchorIndex);
    return before + wrapImg('center') + after;
  }

  // ── 1. Signatory block detection ──────────────────────────────────────────
  const titlePatterns = [
    /REGISTRAR\s*,\s*HIGH\s*COURT/i,
    /REGISTRAR\s+HIGH\s+COURT/i,
    /REGISTRAR\s*[—\-]\s*HIGH\s*COURT/i,
    /HIGH\s*COURT/i,
    /registrar/i,
  ];

  const namePatterns = buildNamePatterns(signerName);

  let bestMatch: { index: number; length: number } | null = null;

  // Find title and then name below
  let titleMatch: RegExpExecArray | null = null;
  for (const pattern of titlePatterns) {
    const global = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
    const matches = [...htmlBody.matchAll(global)];
    if (matches.length > 0) {
      titleMatch = matches[matches.length - 1] as RegExpExecArray;
      break;
    }
  }

  if (titleMatch) {
    const startIdx = titleMatch.index! + titleMatch[0].length;
    const substring = htmlBody.substring(startIdx, startIdx + 500);
    for (const namePat of namePatterns) {
      const nameMatch = namePat.exec(substring);
      if (nameMatch) {
        const globalIndex = startIdx + nameMatch.index;
        bestMatch = { index: globalIndex, length: nameMatch[0].length };
        console.log(`[embedSignatureHTML] Found signatory block: "${nameMatch[0]}" after title`);
        break;
      }
    }
  }

  // If title+name not found, search for name alone (last occurrence),
  // skipping any match that falls on an excluded line like a salutation.
  if (!bestMatch) {
    for (const namePat of namePatterns) {
      const global = new RegExp(namePat.source, namePat.flags.includes('g') ? namePat.flags : namePat.flags + 'g');
      const matches = [...htmlBody.matchAll(global)];
      for (let i = matches.length - 1; i >= 0; i--) {
        const match = matches[i];
        const lineStart = htmlBody.lastIndexOf('\n', match.index!) + 1;
        const lineEnd = htmlBody.indexOf('\n', match.index!);
        const line = htmlBody.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
        if (isExcludedLine(line)) continue;
        bestMatch = { index: match.index!, length: match[0].length };
        console.log(`[embedSignatureHTML] Found name alone: "${match[0]}"`);
        break;
      }
      if (bestMatch) break;
    }
  }

  if (bestMatch) {
    const before = htmlBody.slice(0, bestMatch.index);
    const after = htmlBody.slice(bestMatch.index);
    return before + wrapImg('center') + '<br/>' + after;
  }

  // ── 2. Fallback: if nothing found, return original ──────────────────────
  console.warn('[embedSignatureHTML] No signatory block or salutation found; returning HTML unchanged.');
  return htmlBody;
}