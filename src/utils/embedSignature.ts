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
  fontSize: number;
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
        const [, , , d, x, y] = it.transform;
        return {
          str: it.str as string,
          x: x as number,
          y: y as number,
          pageIndex: i - 1,
          fontSize: Math.abs(d as number) || 12,
        };
      });

    console.log(`[extractTextItems] Page ${i} extracted ${items.length} items`);
    items.slice(0, 10).forEach((item, idx) => {
      console.log(
        `  [${idx}] "${item.str.trim()}" at x:${item.x.toFixed(0)}, y:${item.y.toFixed(0)}, fontSize:${item.fontSize.toFixed(1)}`
      );
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

// Must stay in sync with SIGNATURE_ANCHOR_TEXT in LetterTemplate.ts,
// MemoTemplate.ts, and CertificateTemplate.ts.
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
// name's left edge. Used only by the left-aligned Memo/Letter passes
// (Pass 1 / Pass 2).
const SIGNATURE_Y_OFFSET = 12;
const SIGNATURE_X_OFFSET = -10;

// Separate horizontal nudge for the CENTERED anchor case (Certificate-style
// templates). Positive = shift right. Needed because centerX is computed
// from the "HIGH COURT SUPPORT OFFICE" text line, and small measurement
// artifacts (kerning, glyph-width rounding) can leave the image sitting a
// touch left of the block's true visual center — this is a pure cosmetic
// tuning knob, independent of SIGNATURE_X_OFFSET above.
const CENTERED_X_NUDGE = 18;

// ── Gap-measurement tuning (shared by ALL detection passes) ────────────────
// The image's height is capped to whatever fits inside the MEASURED gap
// between the line above the signature and the reference line below it —
// not a flat assumption — because different templates leave very different
// amounts of space there. Clearances are derived from the ACTUAL font size
// of each boundary line (via TextItem.fontSize) rather than fixed point
// values: a fixed 4pt buffer above a 14pt line's baseline sits inside the
// letters' ascent, which is what caused the memo/letter overlap. These
// multipliers are typical ascent/descent ratios for common fonts.
const ASCENT_RATIO = 0.82;   // fraction of font size that sits above the baseline
const DESCENT_RATIO = 0.22;  // fraction of font size that sits below the baseline
const MIN_CLEARANCE = 4;     // absolute floor, even for tiny fonts

const DEFAULT_MAX_HEIGHT = 100;   // ceiling only — still clamped by the measured gap
const MIN_SIGNATURE_HEIGHT = 26;  // never shrink below this — a smaller image just looks like a stamp/artifact, not a signature

/**
 * Clearance needed below a line so an image sitting above it doesn't clip
 * that line's ascenders (the tall parts of letters like "h", "l", capitals).
 */
function ascentClearance(fontSize: number): number {
  return Math.max(MIN_CLEARANCE, fontSize * ASCENT_RATIO);
}

/**
 * Clearance needed above a line so an image sitting below it doesn't clip
 * that line's descenders (the parts of letters like "g", "y" that dip below
 * the baseline) — smaller than ascent clearance since descenders are shallower.
 */
function descentClearance(fontSize: number): number {
  return Math.max(MIN_CLEARANCE, fontSize * DESCENT_RATIO);
}

/**
 * Given the y of the reference line the signature must clear (referenceY,
 * with its font size — this is the line spatially BELOW the image) and, if
 * known, the y/fontSize of the line spatially ABOVE the image (larger y,
 * since PDF y increases upward), compute a height cap that fits inside the
 * real measured gap. Falls back to DEFAULT_MAX_HEIGHT when there's no line
 * above to measure against (e.g. reference line is the topmost line on the
 * page).
 *
 * IMPORTANT: `above.y` must be > `referenceY`. Passing these two swapped
 * silently produces a negative "gap" that clamps to MIN_SIGNATURE_HEIGHT —
 * this was the cause of a real bug where anchor-based (Certificate-style)
 * signatures rendered tiny despite large visible whitespace, because the
 * anchor line (above) and signatory block (below/reference) were passed in
 * reverse. See the belowAnchor branch in embedSignatureIntoPDF.
 */
function computeHeightCap(
  referenceY: number,
  referenceFontSize: number,
  above: { y: number; fontSize: number } | undefined
): number {
  if (above === undefined) {
    return DEFAULT_MAX_HEIGHT;
  }
  const topClearance = descentClearance(above.fontSize);
  const bottomClearance = ascentClearance(referenceFontSize);
  const availableGap = above.y - referenceY - topClearance - bottomClearance;
  const heightCap = Math.max(MIN_SIGNATURE_HEIGHT, Math.min(DEFAULT_MAX_HEIGHT, availableGap));
  if (availableGap < MIN_SIGNATURE_HEIGHT) {
    console.warn(
      `[embedSignature] Measured gap (${availableGap.toFixed(1)}pt, using ascent/descent-aware clearances) is ` +
        `smaller than MIN_SIGNATURE_HEIGHT (${MIN_SIGNATURE_HEIGHT}pt) — signature will be clamped to the ` +
        `minimum and MAY STILL OVERLAP adjacent text, because the template itself doesn't leave enough blank ` +
        `space around the signatory block. This can only be fixed by adding vertical space (a blank paragraph ` +
        `or spacer) in the template between "Yours sincerely," and the signatory name/title — no amount of ` +
        `image scaling can create room that isn't in the source document.`
    );
  }
  return heightCap;
}

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
      const fullPattern = words.map((w) => escapeRegex(w)).join('\\s*[-–—\\s]*\\s*');
      const suffix = '(?:,?\\s*(?:OGW|CBS|MBS|EBS|HSC|EGH)\\.?)?';
      patterns.push(new RegExp(fullPattern + suffix, 'i'));
      patterns.push(new RegExp(`HON\\.?\\s*${fullPattern}${suffix}`, 'i'));
      if (words.length > 1) {
        const last = escapeRegex(words[words.length - 1]);
        patterns.push(new RegExp(`\\b${last}\\b${suffix}`, 'i'));
      }
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
 * their strings in left-to-right order. Also tracks the max font size on
 * the line, and the line's horizontal midpoint (centerX) — used to center
 * images on centered layouts like CertificateTemplate.
 */
function groupItemsByLine(
  items: TextItem[],
  tolerance = 3
): { y: number; text: string; items: TextItem[]; fontSize: number; centerX: number }[] {
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
  for (const g of groups) {
    g.items.sort((a, b) => a.x - b.x);
  }
  return groups.map((g) => {
    const xs = g.items.map((it) => it.x);
    return {
      y: g.y,
      text: g.items.map((it) => it.str).join(' ').trim(),
      items: g.items,
      fontSize: Math.max(...g.items.map((it) => it.fontSize)),
      centerX: (Math.min(...xs) + Math.max(...xs)) / 2,
    };
  });
}

interface DetectedPosition {
  y: number;
  pageIndex: number;
  x: number;
  fontSize: number;
  // True only for the Pass-0 anchor-marker result. The image must be drawn
  // BELOW this y (not above it, like the name/title passes), which —
  // because drawImage extends upward from (x, y) — requires knowing the
  // image's height. See embedSignatureIntoPDF.
  belowAnchor?: boolean;
  // The line immediately below the anchor (typically the first line of the
  // signatory block). Used to MEASURE the actual available gap, and — via
  // centerX — to horizontally center the image on centered layouts.
  nextLine?: { y: number; fontSize: number; centerX: number };
  // The line immediately ABOVE the detected reference line (spatially),
  // used by the name/title passes (1 & 2) to measure the gap the same way
  // nextLine does for the anchor pass.
  aboveLine?: { y: number; fontSize: number };
}

/**
 * @param anchorOnly - When true, ONLY the explicit SIGNATURE_ANCHOR_TEXT
 *   marker (Pass 0) is trusted. If no anchor is found, this returns null
 *   immediately instead of falling through to the fuzzy name/title passes.
 */
function findSignatureBlockPosition(
  items: TextItem[],
  pageHeights: number[],
  signerName?: string | null,
  anchorOnly: boolean = false
): DetectedPosition | null {
  console.log('[findSignatureBlockPosition] Searching for signature block...');
  console.log('[findSignatureBlockPosition] Items:', items.length);
  console.log('[findSignatureBlockPosition] Signer name:', signerName ?? '(none provided)');
  console.log('[findSignatureBlockPosition] anchorOnly:', anchorOnly);

  const itemsByPage: Record<number, TextItem[]> = {};
  for (const item of items) {
    if (!itemsByPage[item.pageIndex]) {
      itemsByPage[item.pageIndex] = [];
    }
    itemsByPage[item.pageIndex].push(item);
  }

  const pageIndices = Object.keys(itemsByPage).map(Number).sort((a, b) => b - a);
  console.log('[findSignatureBlockPosition] Pages:', pageIndices);

  const namePatterns = buildNamePatterns(signerName);
  const titlePatterns = [
    /REGISTRAR\s*,\s*HIGH\s*COURT/i,
    /REGISTRAR\s+HIGH\s+COURT/i,
    /REGISTRAR\s*[—\-]\s*HIGH\s*COURT/i,
    /HIGH\s*COURT/i,
    /registrar/i,
  ];

  // ── Pass 0: explicit anchor marker (line-based, robust to item splitting) ──
  console.log('[findSignatureBlockPosition] Pass 0: Searching for explicit signature anchor...');
  for (const pageIndex of pageIndices) {
    const pageItems = itemsByPage[pageIndex];
    const lines = groupItemsByLine(pageItems);
    const linesTopToBottom = [...lines].sort((a, b) => b.y - a.y);
    const anchorIdx = linesTopToBottom.findIndex((l) => l.text.includes(SIGNATURE_ANCHOR_TEXT));

    if (anchorIdx !== -1) {
      const anchorLine = linesTopToBottom[anchorIdx];
      const anchorItem = anchorLine.items[0];
      const nextLine = linesTopToBottom[anchorIdx + 1];
      console.log(
        `[findSignatureBlockPosition] Found anchor marker (line: "${anchorLine.text}") at y=${anchorLine.y}` +
          (nextLine
            ? `, next line: "${nextLine.text}" at y=${nextLine.y}, fontSize=${nextLine.fontSize.toFixed(
                1
              )}, centerX=${nextLine.centerX.toFixed(0)}`
            : ', no next line found on this page') +
          `, page=${pageIndex + 1}`
      );
      return {
        y: anchorLine.y,
        pageIndex,
        x: anchorItem.x || 60,
        fontSize: anchorLine.fontSize,
        belowAnchor: true,
        nextLine: nextLine
          ? { y: nextLine.y, fontSize: nextLine.fontSize, centerX: nextLine.centerX }
          : undefined,
      };
    }
  }

  if (anchorOnly) {
    console.warn(
      '[findSignatureBlockPosition] anchorOnly=true and no anchor marker found — refusing to fall back to fuzzy matching. Returning null.'
    );
    return null;
  }

  console.log('[findSignatureBlockPosition] No anchor marker found, falling back to fuzzy matching');

  for (const pageIndex of pageIndices) {
    const pageItems = itemsByPage[pageIndex];
    const lines = groupItemsByLine(pageItems);
    // Ascending y = index 0 is BOTTOM of page, index length-1 is TOP.
    lines.sort((a, b) => a.y - b.y);

    console.log(`[findSignatureBlockPosition] Page ${pageIndex + 1} has ${lines.length} lines`);

    // ── Pass 1: Direct name match (bottom-most occurrence) ──────────────────
    console.log('[findSignatureBlockPosition] Pass 1: Searching directly for signer name in lines...');
    let nameLine: { y: number; text: string; items: TextItem[]; fontSize: number; centerX: number } | null = null;
    let nameLineIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (isExcludedLine(line.text)) continue;
      for (const pattern of namePatterns) {
        if (pattern.test(line.text)) {
          nameLine = line;
          nameLineIdx = i;
          console.log(`[findSignatureBlockPosition] Found name in line: "${line.text}" at y: ${line.y}`);
          break;
        }
      }
      if (nameLine) break;
    }

    if (nameLine) {
      const signatureY = nameLine.y + SIGNATURE_Y_OFFSET;
      const x = nameLine.items.length > 0 ? Math.min(...nameLine.items.map((it) => it.x)) : 60;
      const aboveLine = lines[nameLineIdx + 1];
      console.log(
        `[findSignatureBlockPosition] RETURNING (name line): y=${signatureY}, x=${x + SIGNATURE_X_OFFSET}, page=${
          pageIndex + 1
        }${aboveLine ? `, aboveLine="${aboveLine.text}"` : ', no line above to measure gap'}`
      );
      return {
        y: signatureY,
        pageIndex,
        x: Math.max(10, x + SIGNATURE_X_OFFSET),
        fontSize: nameLine.fontSize,
        aboveLine: aboveLine ? { y: aboveLine.y, fontSize: aboveLine.fontSize } : undefined,
      };
    }

    // ── Pass 2: Title + name above title ────────────────────────────────────
    console.log('[findSignatureBlockPosition] Pass 2: Searching for title + name above...');
    let titleLine: { y: number; text: string; items: TextItem[]; fontSize: number; centerX: number } | null = null;
    let titleIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const pattern of titlePatterns) {
        if (pattern.test(line.text)) {
          titleLine = line;
          titleIdx = i;
          console.log(`[findSignatureBlockPosition] Found title line: "${line.text}" at y: ${line.y}`);
          break;
        }
      }
      if (titleLine) break;
    }

    if (titleLine) {
      let nameAbove: { y: number; text: string; items: TextItem[]; fontSize: number; centerX: number } | null = null;
      let nameAboveIdx = -1;
      for (let i = titleIdx + 1; i < lines.length; i++) {
        const line = lines[i];
        if (isExcludedLine(line.text)) continue;
        for (const pattern of namePatterns) {
          if (pattern.test(line.text)) {
            nameAbove = line;
            nameAboveIdx = i;
            console.log(`[findSignatureBlockPosition] Found name above title: "${line.text}" at y: ${line.y}`);
            break;
          }
        }
        if (nameAbove) break;
      }

      if (nameAbove) {
        const signatureY = nameAbove.y + SIGNATURE_Y_OFFSET;
        const x = nameAbove.items.length > 0 ? Math.min(...nameAbove.items.map((it) => it.x)) : 60;
        const aboveLine = lines[nameAboveIdx + 1];
        console.log(
          `[findSignatureBlockPosition] RETURNING (name above title): y=${signatureY}, x=${
            x + SIGNATURE_X_OFFSET
          }, page=${pageIndex + 1}`
        );
        return {
          y: signatureY,
          pageIndex,
          x: Math.max(10, x + SIGNATURE_X_OFFSET),
          fontSize: nameAbove.fontSize,
          aboveLine: aboveLine ? { y: aboveLine.y, fontSize: aboveLine.fontSize } : undefined,
        };
      } else {
        const signatureY = titleLine.y + SIGNATURE_Y_OFFSET;
        const x = titleLine.items.length > 0 ? Math.min(...titleLine.items.map((it) => it.x)) : 60;
        const aboveLine = lines[titleIdx + 1];
        console.log(
          `[findSignatureBlockPosition] RETURNING (title only): y=${signatureY}, x=${
            x + SIGNATURE_X_OFFSET
          }, page=${pageIndex + 1}`
        );
        return {
          y: signatureY,
          pageIndex,
          x: Math.max(10, x + SIGNATURE_X_OFFSET),
          fontSize: titleLine.fontSize,
          aboveLine: aboveLine ? { y: aboveLine.y, fontSize: aboveLine.fontSize } : undefined,
        };
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
      return { y: signatureY, pageIndex: lastItem.pageIndex, x: lastItem.x || 60, fontSize: lastItem.fontSize };
    }
  }

  console.log('[findSignatureBlockPosition] No position found, returning null');
  return null;
}

/**
 * Embed a signature image into a PDF.
 */
export async function embedSignatureIntoPDF(
  pdfBuffer: Buffer,
  signatureUrl: string,
  position?: { x: number; y: number; width: number; height: number } | null,
  signerName?: string | null,
  anchorOnly: boolean = false
): Promise<Buffer> {
  console.log(`[embedSignature] signer: ${signerName ?? '(none provided)'}, anchorOnly: ${anchorOnly}`);

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
    console.log(
      `[embedSignature] Using custom position: x=${position.x}, y=${position.y}, w=${position.width}, h=${position.height}`
    );

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

    targetPage.drawImage(sigImage, { x, y, width: sigDims.width, height: sigDims.height });

    return Buffer.from(await pdfDoc.save());
  }

  // ── No custom position: detect signature block via text extraction ──────
  let detected: DetectedPosition | null = null;
  try {
    const { items, pageHeights } = await extractTextItems(new Uint8Array(pdfBuffer));
    detected = findSignatureBlockPosition(items, pageHeights, signerName, anchorOnly);
  } catch (err) {
    console.warn('[embedSignature] Text-based signature detection failed, will skip embedding', err);
  }

  if (detected) {
    const targetPage = pages[detected.pageIndex] ?? pages[pages.length - 1];
    const { width, height } = targetPage.getSize();
    const widthCap = Math.min(220, width * 0.32);

    let sigDims: { width: number; height: number };
    let x: number;
    let y: number;

    if (detected.belowAnchor) {
      // Reference line is the signatory block below the image (nextLine);
      // the line above the image is the anchor itself (detected.y). See
      // computeHeightCap's docstring for why this ordering matters.
      const heightCap = detected.nextLine
        ? computeHeightCap(detected.nextLine.y, detected.nextLine.fontSize, {
            y: detected.y,
            fontSize: detected.fontSize,
          })
        : DEFAULT_MAX_HEIGHT; // no line below the anchor on this page to measure against
      sigDims = sigImage.scaleToFit(widthCap, heightCap);

      y =
        detected.nextLine !== undefined
          ? detected.nextLine.y + ascentClearance(detected.nextLine.fontSize)
          : detected.y - descentClearance(detected.fontSize) - sigDims.height;

      // Center the image on the signatory block's actual text midpoint
      // (nextLine.centerX) rather than the anchor's own x — the anchor is
      // a near-zero-width invisible marker whose x doesn't reflect where a
      // much wider image should start from on a CENTERED layout (unlike
      // Memo/Letter, which are left-aligned). CENTERED_X_NUDGE applies a
      // small cosmetic correction on top of the measured center. Falls back
      // to the anchor's x (old behavior) only if there's no next line to
      // measure — e.g. anchor is the last line on the page.
      x = detected.nextLine
        ? detected.nextLine.centerX - sigDims.width / 2 + CENTERED_X_NUDGE
        : detected.x || 60;
        console.log(`[embedSignature] CENTERED path: nextLine.centerX=${detected.nextLine?.centerX}, sigDims.width=${sigDims.width}, CENTERED_X_NUDGE=${CENTERED_X_NUDGE}, computed x=${x}`);
    } else {
      // detected.y already sits SIGNATURE_Y_OFFSET above the name/title
      // baseline; treat detected.y - SIGNATURE_Y_OFFSET as that baseline
      // for gap measurement purposes.
      const referenceBaselineY = detected.y - SIGNATURE_Y_OFFSET;
      const heightCap = computeHeightCap(referenceBaselineY, detected.fontSize, detected.aboveLine);
      sigDims = sigImage.scaleToFit(widthCap, heightCap);
      y = detected.y;
      x = detected.x || 60;
    }

    x = Math.max(10, Math.min(x, width - sigDims.width - 10));
    y = Math.max(10, Math.min(y, height - sigDims.height - 10));

    console.log(
      `[embedSignature] Text-detected position on page ${detected.pageIndex + 1}: x=${x.toFixed(0)}, y=${y.toFixed(
        0
      )}, belowAnchor=${!!detected.belowAnchor}, imgHeight=${sigDims.height.toFixed(1)}, imgWidth=${sigDims.width.toFixed(
        1
      )}`
    );

    targetPage.drawImage(sigImage, { x, y, width: sigDims.width, height: sigDims.height });

    return Buffer.from(await pdfDoc.save());
  }

  // If detection fails (or anchorOnly=true and no anchor was found), return
  // the PDF unchanged (no signature) rather than guessing.
  console.warn('[embedSignature] No signature block detected; returning original PDF without signature.');
  return pdfBuffer;
}

/**
 * Embed a signature image into an HTML document. Unchanged from before —
 * this path relies on normal document flow (a block-level <div> pushes
 * subsequent content down), so it doesn't have the same baseline-overlap
 * risk the PDF path does; there's nothing here that needed the gap fix.
 */
export function embedSignatureIntoHTML(
  htmlBody: string,
  signatureUrl: string,
  signerName?: string | null,
  anchorOnly: boolean = false
): string {
  console.log(`[embedSignatureHTML] signer: ${signerName ?? '(none provided)'}, anchorOnly: ${anchorOnly}`);

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

  // ── anchorOnly guard: refuse to guess ───────────────────────────────────
  if (anchorOnly) {
    console.warn(
      '[embedSignatureHTML] anchorOnly=true and no anchor marker found — refusing to fall back to fuzzy matching. Returning HTML unchanged.'
    );
    return htmlBody;
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