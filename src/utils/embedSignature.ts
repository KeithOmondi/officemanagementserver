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

/**
 * Trim transparent/blank padding from a signature image before embedding.
 *
 * Signature-pad exports and scanned signatures very commonly have a large
 * transparent (or uniform white) margin around the actual ink. The
 * placement math below anchors the image's BOUNDING BOX tightly above the
 * name line, but if the visible strokes sit in the upper portion of that
 * box, the box can be flush against the name while the ink still LOOKS
 * like it's floating with a gap above it. Trimming here makes the bounding
 * box match the visible ink, which is what actually controls the
 * perceived gap in the final PDF.
 *
 * sharp's .trim() removes "boring" edges by comparing to the top-left
 * pixel; for a PNG with real transparency this correctly strips the
 * transparent border. threshold is kept low (10) so it only strips truly
 * blank/near-blank edges and doesn't eat into faint pen strokes.
 */
async function trimSignatureImage(buffer: Buffer): Promise<Buffer> {
  try {
    const trimmed = await sharp(buffer)
      .trim({ threshold: 10 })
      .png()
      .toBuffer();
    console.log(
      `[trimSignatureImage] Trimmed: ${buffer.length} -> ${trimmed.length} bytes`
    );
    return trimmed;
  } catch (err) {
    console.warn('[trimSignatureImage] Trim failed, using original image', err);
    return buffer;
  }
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
// name's left edge.
const SIGNATURE_Y_OFFSET = 12;
const SIGNATURE_X_OFFSET = -10;

// ── Anchor-based placement (Pass 0) tuning ──────────────────────────────────
// Padding kept clear above the next line (the title/name line right below
// the anchor) and below the anchor line itself. The image's height is then
// capped to whatever fits inside the MEASURED gap between those two lines —
// not a flat assumption — because different templates (Certificate vs.
// Letter/Memo) leave very different amounts of space there. A fixed max
// height that looked right on one template overlapped badly on another.
const ANCHOR_TOP_GAP = 6;     // clearance below the anchor line
// Tightened further (4 -> 2 -> 0): this is clearance between the image's
// bounding box and the name line's ink. The prior 2pt value plus
// NEXT_LINE_CAP_HEIGHT_ESTIMATE still left a visible gap in testing, so
// this is now 0 — NEXT_LINE_CAP_HEIGHT_ESTIMATE alone provides the
// clearance needed to avoid touching the glyphs. If the signature ever
// starts touching the top of the name text, raise this back up in small
// increments (2, then 4) rather than jumping back to the original value.
const ANCHOR_BOTTOM_GAP = 0;  // clearance above the next line (title/name)
const ANCHOR_DEFAULT_MAX_HEIGHT = 65; // default cap — matches Letter/Memo's spacious ~46pt anchor-to-name gap; DO NOT lower this, it's what keeps their existing (working) placement unchanged
const ANCHOR_MIN_HEIGHT = 20; // never shrink the signature below this, even if the gap is tighter

// pdf.js reports a text item's y as its BASELINE, not its visible top.
// For bold uppercase text (the signatory block's styling on every
// template), the glyphs themselves rise roughly this far above that
// baseline. Treating the full anchor-to-baseline distance as free space
// (as the gap math previously did) let the signature image's bottom edge
// get sized/placed down into the glyphs of the next line, cutting through
// it. Subtracting this estimate from the available gap — and adding it
// back when computing where the image's bottom edge should sit — keeps
// the image above the next line's actual ink, not just its baseline.
// ~0.72 of a 12pt bold-caps font ≈ 8.5pt; this is an estimate, not a
// per-glyph measurement, but it comfortably covers the cap-height of the
// bold uppercase signatory lines used across Letter/Memo/Certificate.
const NEXT_LINE_CAP_HEIGHT_ESTIMATE = 8.5;

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
 *
 * INCREASED TOLERANCE: From 3 to 6 pixels to handle production PDF
 * rendering variations where text items on the same line may have
 * slightly different y-coordinates.
 */
function groupItemsByLine(items: TextItem[], tolerance = 6): { y: number; text: string; items: TextItem[] }[] {
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

interface DetectedPosition {
  y: number;
  pageIndex: number;
  x: number;
  // True only for the Pass-0 anchor-marker result. The image must be drawn
  // BELOW this y (not above it, like the name/title passes), which — because
  // drawImage extends upward from (x, y) — requires knowing the image's
  // height. See embedSignatureIntoPDF.
  belowAnchor?: boolean;
  // The y of the line immediately below the anchor (typically the first
  // line of the signatory block, e.g. "REGISTRAR, HIGH COURT" or the
  // printed name), when one exists on the same page. Used to MEASURE the
  // actual available gap so the image is sized to fit it, rather than
  // assuming a fixed height that may be wrong for a given template. NOTE:
  // this is a BASELINE y, not the line's visible top — see
  // NEXT_LINE_CAP_HEIGHT_ESTIMATE above for why that distinction matters.
  nextLineY?: number;
  // Leftmost x of the line immediately below the anchor (the name line).
  // Used to align the signature to where the name actually starts,
  // instead of centering it across the full page width — page-centering
  // put the signature well to the right of a left-margin-aligned name,
  // which read as misaligned even once the vertical gap was fixed.
  nextLineX?: number;
}

/**
 * Find the anchor or signature block position in the PDF text.
 *
 * Pass 0: Explicit SIGNATURE_ANCHOR_TEXT marker (most reliable)
 *   - Handles split anchor text across multiple lines
 *   - Uses increased tolerance for production PDF variations
 *
 * Pass 1 & 2: Fuzzy matching (only used when anchorOnly=false)
 *   - Falls back to name and title pattern matching
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

  // Build name and title patterns
  const namePatterns = buildNamePatterns(signerName);
  const titlePatterns = [
    /REGISTRAR\s*,\s*HIGH\s*COURT/i,
    /REGISTRAR\s+HIGH\s+COURT/i,
    /REGISTRAR\s*[—\-]\s*HIGH\s*COURT/i,
    /HIGH\s*COURT/i,
    /registrar/i,
  ];

  // ── Pass 0: explicit anchor marker (robust to item splitting) ──
  console.log('[findSignatureBlockPosition] Pass 0: Searching for explicit signature anchor...');

  for (const pageIndex of pageIndices) {
    const pageItems = itemsByPage[pageIndex];
    const lines = groupItemsByLine(pageItems);
    // Sort top-to-bottom (descending y, since PDF y grows upward)
    const linesTopToBottom = [...lines].sort((a, b) => b.y - a.y);

    // First, try to find the anchor in a single line
    let anchorIdx = linesTopToBottom.findIndex((l) => l.text.includes(SIGNATURE_ANCHOR_TEXT));

    // If not found, check if the anchor text is split across adjacent lines
    if (anchorIdx === -1) {
      console.log('[findSignatureBlockPosition] Anchor not found in single line, checking for split anchor...');

      // Look for the anchor text parts across adjacent lines
      for (let i = 0; i < linesTopToBottom.length - 1; i++) {
        const currentLine = linesTopToBottom[i];
        const nextLine = linesTopToBottom[i + 1];

        // Check if the combined text of current + next line contains the anchor
        const combinedText = currentLine.text + ' ' + nextLine.text;
        if (combinedText.includes(SIGNATURE_ANCHOR_TEXT)) {
          // The anchor is split across these two lines
          // Use the first line's y as the anchor position
          anchorIdx = i;
          console.log(`[findSignatureBlockPosition] Found split anchor across lines ${i} and ${i+1}`);
          console.log(`  Line ${i}: "${currentLine.text}"`);
          console.log(`  Line ${i+1}: "${nextLine.text}"`);
          break;
        }
      }
    }

    // If still not found, try checking three consecutive lines
    if (anchorIdx === -1) {
      console.log('[findSignatureBlockPosition] Checking for anchor across 3 consecutive lines...');

      for (let i = 0; i < linesTopToBottom.length - 2; i++) {
        const combinedText =
          linesTopToBottom[i].text + ' ' +
          linesTopToBottom[i + 1].text + ' ' +
          linesTopToBottom[i + 2].text;

        if (combinedText.includes(SIGNATURE_ANCHOR_TEXT)) {
          anchorIdx = i;
          console.log(`[findSignatureBlockPosition] Found split anchor across lines ${i}, ${i+1}, ${i+2}`);
          break;
        }
      }
    }

    if (anchorIdx !== -1) {
      const anchorLine = linesTopToBottom[anchorIdx];
      const anchorItem = anchorLine.items[0];
      const nextLine = linesTopToBottom[anchorIdx + 1];

      console.log(
        `[findSignatureBlockPosition] Found anchor marker (line: "${anchorLine.text.substring(0, 50)}...") at y=${anchorLine.y}` +
        (nextLine ? `, next line: "${nextLine.text.substring(0, 50)}..." at y=${nextLine.y}` : ', no next line found on this page') +
        `, page=${pageIndex + 1}`
      );

      const nextLineX =
        nextLine && nextLine.items.length > 0
          ? Math.min(...nextLine.items.map((it) => it.x))
          : undefined;

      return {
        y: anchorLine.y,
        pageIndex,
        // Use the page width to center the signature instead of the anchor's x position
        x: -1, // Signal that we want to center it
        belowAnchor: true,
        nextLineY: nextLine?.y,
        nextLineX,
      };
    }
  }

  // ── anchorOnly guard: refuse to guess ───────────────────────────────────
  // If the caller told us this template can't be trusted with fuzzy
  // matching (name appears elsewhere in the body, and/or the sign-off
  // block has no name line), stop here rather than risk a wrong placement.
  if (anchorOnly) {
    console.warn('[findSignatureBlockPosition] anchorOnly=true and no anchor marker found — refusing to fall back to fuzzy matching. Returning null.');
    return null;
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
 * @param anchorOnly - When true, only the explicit SIGNATURE_ANCHOR_TEXT marker
 *                     is trusted; if it's not found, no signature is embedded
 *                     rather than guessing via fuzzy name/title matching. Pass
 *                     true for templates (e.g. Certificate) where the signer's
 *                     name may appear earlier in the body, or where the closing
 *                     block has no name line for the fuzzy passes to anchor on.
 * @param anchorMaxHeight - Only affects the anchor-marker path (belowAnchor).
 *                     Caps how tall the signature image is allowed to be when
 *                     placed below the anchor, both when a real gap was
 *                     measured AND in the no-next-line-found fallback.
 *                     Defaults to 65pt, which matches Letter/Memo's real,
 *                     measured ~46pt anchor-to-name gap comfortably — leave
 *                     this at the default for those. Pass a smaller value
 *                     (e.g. ~35) for templates with a tighter traditional
 *                     signature envelope, such as Certificate's ~32pt gap —
 *                     otherwise the no-next-line fallback can compute a y
 *                     so low it gets clamped to the page bottom, landing on
 *                     top of the footer.
 * @returns The modified PDF buffer, or the original if placement failed.
 */
export async function embedSignatureIntoPDF(
  pdfBuffer: Buffer,
  signatureUrl: string,
  position?: { x: number; y: number; width: number; height: number } | null,
  signerName?: string | null,
  anchorOnly: boolean = false,
  anchorMaxHeight: number = ANCHOR_DEFAULT_MAX_HEIGHT
): Promise<Buffer> {
  console.log(`[embedSignature] signer: ${signerName ?? '(none provided)'}, anchorOnly: ${anchorOnly}, anchorMaxHeight: ${anchorMaxHeight}`);

  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const pages = pdfDoc.getPages();

  if (pages.length === 0) {
    return pdfBuffer;
  }

  const rawSigBuffer = await fetchBuffer(signatureUrl);
  // Trim the signature image's own blank/transparent padding BEFORE
  // scaling and placement math runs, so the bounding box we position
  // matches the visible ink rather than an oversized, mostly-empty
  // canvas. See trimSignatureImage() above for why this matters.
  const trimmedSigBuffer = await trimSignatureImage(rawSigBuffer);
  const sigPng = await sharp(trimmedSigBuffer).png().toBuffer();
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
    const widthCap = Math.min(170, width * 0.30);

    let sigDims: { width: number; height: number };
    let x: number;
    let y: number;

    if (detected.belowAnchor) {
      // Measure the actual gap between the anchor and whatever line comes
      // after it (the signatory block's first line), and size the image to
      // fit inside it — rather than assuming a fixed max height, which
      // works for a spacious template (e.g. Letter's measured ~46pt gap)
      // but overlaps a tight one. anchorMaxHeight is also the ceiling here
      // (not just ANCHOR_DEFAULT_MAX_HEIGHT), so a template with a smaller
      // traditional envelope (e.g. Certificate's ~32pt) doesn't end up with
      // an oversized signature even when a generous gap happens to measure
      // larger than that template's authentic proportions.
      //
      // nextLineY is a BASELINE, not the line's visible top, so
      // NEXT_LINE_CAP_HEIGHT_ESTIMATE is subtracted from the available gap
      // here (and added back below when placing y) — otherwise the image
      // is sized/placed as if the glyphs' cap-height were free space, and
      // its bottom edge cuts through the top of the next line's text.
      let heightCap = anchorMaxHeight;
      if (detected.nextLineY !== undefined) {
        const availableGap =
          detected.y - detected.nextLineY - ANCHOR_TOP_GAP - ANCHOR_BOTTOM_GAP - NEXT_LINE_CAP_HEIGHT_ESTIMATE;
        heightCap = Math.max(ANCHOR_MIN_HEIGHT, Math.min(anchorMaxHeight, availableGap));
        if (availableGap < ANCHOR_MIN_HEIGHT) {
          console.warn(
            `[embedSignature] Anchor-to-next-line gap (${availableGap.toFixed(1)}pt, after accounting for ` +
            `next-line cap-height) is smaller than ANCHOR_MIN_HEIGHT (${ANCHOR_MIN_HEIGHT}pt) — signature ` +
            `will be clamped to the minimum and may still touch adjacent text. Consider adding more vertical ` +
            `space in the template around the anchor.`
          );
        }
      } else {
        // No next line was found on the anchor's page — most likely the
        // signatory block got paginated onto a different page than the
        // anchor. This is the scenario that previously let the fallback
        // compute a y low enough to clamp to the page bottom, landing on
        // the footer. Capping to anchorMaxHeight here (35pt for
        // certificates, passed from DocumentService.sign) instead of the
        // old flat 65pt keeps this fallback from reaching nearly that far
        // down in the first place.
        console.warn(
          '[embedSignature] No next line found below the anchor on its page — using the ' +
          `no-next-line fallback with anchorMaxHeight=${anchorMaxHeight}pt. If this fires ` +
          'regularly for a given template, its anchor and signatory block are likely being ' +
          'split across pages; check that they are wrapped together with page-break-inside: avoid.'
        );
        heightCap = anchorMaxHeight;
      }
      sigDims = sigImage.scaleToFit(widthCap, heightCap);

      // ALIGN TO THE NAME'S LEFT EDGE when we know it (nextLineX), matching
      // where "CLARA OTIENO-OMONDI, OGW" / "REGISTRAR, HIGH COURT" actually
      // starts on the page. Page-centering the signature independent of
      // that left margin was what made it read as floating off to the
      // right of the name. Only fall back to page-centering if no next
      // line was found at all (nextLineX undefined).
      if (detected.nextLineX !== undefined) {
        x = detected.nextLineX + SIGNATURE_X_OFFSET;
      } else {
        x = (width - sigDims.width) / 2;
      }

      // Ensure x is within page bounds
      x = Math.max(10, Math.min(x, width - sigDims.width - 10));

      y = detected.nextLineY !== undefined
        // Anchor bottom edge just above the next line's actual ink — the
        // next line's baseline PLUS its estimated cap-height, plus the
        // usual clearance gap. Without the cap-height term this sits at
        // the baseline, i.e. underneath the glyphs, which let the image's
        // bottom edge (sized above using the un-corrected gap) overlap the
        // top of "HIGH COURT SUPPORT OFFICE"-style bold caps lines.
        ? detected.nextLineY + ANCHOR_BOTTOM_GAP + NEXT_LINE_CAP_HEIGHT_ESTIMATE
        // No next line was found (anchor was the last line on the page) —
        // fall back to placing it a fixed gap below the anchor, using the
        // (now correctly capped) sigDims.height computed above.
        : detected.y - ANCHOR_TOP_GAP - sigDims.height;
    } else {
      // Name/title-based passes (1 & 2): y is already meant to be the
      // image's bottom, sitting just above the printed name — unchanged
      // from before.
      sigDims = sigImage.scaleToFit(widthCap, ANCHOR_DEFAULT_MAX_HEIGHT);

      // For non-anchor detection, we need to check if x is -1 (center signal)
      if (detected.x === -1) {
        // Center the signature
        x = (width - sigDims.width) / 2;
        x = Math.max(10, Math.min(x, width - sigDims.width - 10));
      } else {
        x = detected.x || 60;
        // Clamp to page bounds
        x = Math.max(10, Math.min(x, width - sigDims.width - 10));
      }

      y = detected.y;
    }

    // Clamp y to page bounds
    y = Math.max(10, Math.min(y, height - sigDims.height - 10));

    const xAlignment = detected.belowAnchor
      ? (detected.nextLineX !== undefined ? 'left-aligned-to-name' : 'page-centered-fallback')
      : (detected.x === -1 ? 'centered' : 'left-aligned');
    console.log(
      `[embedSignature] Text-detected position on page ${detected.pageIndex + 1}: x=${x.toFixed(0)}, y=${y.toFixed(0)}, ` +
      `belowAnchor=${!!detected.belowAnchor}, imgHeight=${sigDims.height.toFixed(1)}, xAlignment=${xAlignment}`
    );

    targetPage.drawImage(sigImage, {
      x,
      y,
      width: sigDims.width,
      height: sigDims.height,
    });

    return Buffer.from(await pdfDoc.save());
  }

  // If detection fails (or anchorOnly=true and no anchor was found), return
  // the PDF unchanged (no signature) rather than guessing.
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
 * @param anchorOnly - When true, only the explicit SIGNATURE_ANCHOR_TEXT marker
 *                     is trusted; if it's not present in htmlBody, the HTML is
 *                     returned unchanged rather than guessing via fuzzy
 *                     name/title matching. Pass true for templates (e.g.
 *                     Certificate) where the signer's name may legitimately
 *                     appear earlier in the body.
 * @returns The modified HTML string
 */
export function embedSignatureIntoHTML(
  htmlBody: string,
  signatureUrl: string,
  signerName?: string | null,
  anchorOnly: boolean = false
): string {
  console.log(`[embedSignatureHTML] signer: ${signerName ?? '(none provided)'}, anchorOnly: ${anchorOnly}`);

  const imgTag = `<img src="${signatureUrl}" alt="Official Signature" style="max-width:200px; max-height:80px; display:block; margin:0 auto;" />`;
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
    // Always center the signature when anchor is found
    return before + wrapImg('center') + after;
  }

  // ── anchorOnly guard: refuse to guess ───────────────────────────────────
  if (anchorOnly) {
    console.warn('[embedSignatureHTML] anchorOnly=true and no anchor marker found — refusing to fall back to fuzzy matching. Returning HTML unchanged.');
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
    // Always center the signature for certificates
    return before + wrapImg('center') + '<br/>' + after;
  }

  // ── 2. Fallback: if nothing found, return original ──────────────────────
  console.warn('[embedSignatureHTML] No signatory block or salutation found; returning HTML unchanged.');
  return htmlBody;
}