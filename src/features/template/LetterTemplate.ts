// src/templates/LetterTemplate.ts

export interface LetterData {
  ref: string;
  date: string;
  to: string;
  subject: string;
  body: string;
  sender: string;
  senderTitle: string;
  cc?: string;
  enclosures?: string;
  logoUrl?: string;
  footerEmblemUrl?: string;
}

const DEFAULT_LOGO_URL =
  'https://res.cloudinary.com/do0yflasl/image/upload/v1781759596/JOB_LOGO_ubls4m.jpg';
const DEFAULT_FOOTER_EMBLEM_URL =
  'https://res.cloudinary.com/do0yflasl/image/upload/v1782893389/footer-emblem_n0ncm9.jpg';

export function getLetterHTML(data: LetterData): string {
  const logoUrl = data.logoUrl || DEFAULT_LOGO_URL;
  const footerEmblemUrl = data.footerEmblemUrl || DEFAULT_FOOTER_EMBLEM_URL;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>LETTER</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: Arial, Helvetica, sans-serif;
          color: #000000;
          background: white;
        }

        /* Page padding is included in min-height (box-sizing: border-box).
           Bottom padding is large (170px) to reserve space for the fixed
           footer so body content never runs into it. */
        .page {
          max-width: 794px;
          min-height: 1123px; /* A4 height at 96dpi */
          margin: 0 auto;
          padding: 50px 60px 170px 60px;
          position: relative;
        }

        /* Header */
        .header {
          display: flex;
          align-items: center;
          margin-bottom: 10px;
          page-break-inside: avoid;
          break-inside: avoid;
        }

        .logo-container {
          flex: 0 0 75px;
          margin-right: 16px;
        }

        .logo-container img {
          width: 70px;
          height: auto;
          display: block;
        }

        .header-text .judiciary {
          font-size: 18px;
          font-weight: bold;
          color: #000000;
          line-height: 1.3;
        }

        .header-text .office-name {
          font-size: 14px;
          font-weight: bold;
          text-transform: uppercase;
          color: #000000;
          margin-top: 2px;
          line-height: 1.3;
        }

        .header-rule {
          border-top: 1.5px solid #C29B38;
          margin-bottom: 28px;
        }

        /* Reference and Date */
        .ref-date {
          display: flex;
          justify-content: space-between;
          margin: 0 0 30px 0;
          font-size: 13px;
          font-weight: bold;
          page-break-inside: avoid;
          break-inside: avoid;
        }

        /* Body content — height is driven purely by actual letter length,
           no fixed min-height, so pagination reflects real content. */
        .body-content {
          margin: 0 0 40px 0;
          font-size: 13px;
          line-height: 1.8;
          text-align: justify;
        }

        .body-content .to-block {
          margin-bottom: 18px;
          page-break-inside: avoid;
          break-inside: avoid;
        }

        .body-content .to-block p {
          margin: 0;
          line-height: 1.5;
        }

        .body-content .subject-line {
          font-weight: bold;
          text-decoration: underline;
          margin: 18px 0;
          page-break-inside: avoid;
          break-inside: avoid;
        }

        .body-content p {
          margin-bottom: 10px;
        }

        /* Sign-off block is atomic: page-break-inside: avoid keeps the
           name and title together instead of splitting across pages. */
        .signature {
          margin-top: 50px;
          font-size: 13px;
          page-break-inside: avoid;
          break-inside: avoid;
        }

        .signature .name {
          font-weight: bold;
          text-transform: uppercase;
        }

        .signature .title {
          font-weight: bold;
          text-decoration: underline;
          text-transform: uppercase;
          margin-top: 2px;
        }

        /* CC ("Copy to:") — numbered list, each entry's last line
           (typically the station/location) rendered bold + underlined.
           NOTE: .cc-block itself is intentionally NOT page-break-inside:
           avoid. If it were, Chromium would push the *entire* block to
           the next page whenever it doesn't fully fit in the remaining
           space on the current page — leaving a large dead gap above
           the footer, like a Word doc bug. Instead, only individual
           .cc-entry items are protected from splitting, so the block
           flows naturally: as many entries as fit stay on the current
           page, the rest continue on the next, exactly like Word. */
        .cc-block {
          margin-top: 30px;
          font-size: 13px;
          line-height: 1.5;
          display: flex;
        }

        .cc-block .cc-label {
          flex: 0 0 90px;
          font-style: italic;
          text-decoration: underline;
        }

        .cc-block .cc-entries {
          flex: 1;
        }

        .cc-entry {
          display: flex;
          margin-bottom: 16px;
          page-break-inside: avoid;
          break-inside: avoid;
        }

        .cc-entry:last-child {
          margin-bottom: 0;
        }

        .cc-entry .cc-number {
          flex: 0 0 24px;
        }

        .cc-entry .cc-text p {
          margin: 0;
          line-height: 1.5;
        }

        .cc-entry .cc-text .cc-location {
          font-weight: bold;
          text-decoration: underline;
        }

        /* Enclosures kept as a simple label:value line */
        .enclosures-block {
          margin-top: 20px;
          font-size: 12px;
          line-height: 1.6;
          page-break-inside: avoid;
          break-inside: avoid;
        }

        .enclosures-block .label {
          font-weight: bold;
        }

        /* Footer pinned to page bottom. position: fixed is required for
           Puppeteer's Chromium print engine to anchor it on every page.
           Do not override this in @media print. */
        .footer {
          position: fixed;
          bottom: 30px;
          left: 60px;
          right: 60px;
          border-top: 1px solid #999;
          padding-top: 14px;
        }

        .footer-top {
          display: flex;
          align-items: center;
          gap: 18px;
        }

        .footer-emblem {
          flex: 0 0 90px;
        }

        .footer-emblem img {
          width: 90px;
          height: 90px;
          display: block;
          object-fit: contain;
        }

        .footer-text {
          flex: 1;
          text-align: right;
          font-size: 11px;
          color: #1a1a1a;
        }

        .footer-text p {
          margin: 2px 0;
          line-height: 1.5;
        }

        .footer-tagline {
          text-align: right;
          font-size: 12px;
          font-weight: bold;
          color: #1E4620;
          margin-top: 8px;
        }

        /* Responsive (screen preview only — irrelevant to PDF output) */
        @media (max-width: 600px) {
          .page { padding: 30px 20px 170px 20px; }
          .header { flex-direction: column; text-align: center; }
          .logo-container { margin-right: 0; margin-bottom: 10px; }
          .ref-date { flex-direction: column; align-items: flex-start; gap: 5px; }
          .footer { left: 20px; right: 20px; }
          .footer-top { flex-direction: column; text-align: center; gap: 10px; }
          .footer-text, .footer-tagline { text-align: center; }
          .cc-block { flex-direction: column; }
          .cc-block .cc-label { margin-bottom: 8px; }
        }
      </style>
    </head>
    <body>
      <div class="page">
        <div class="header">
          <div class="logo-container">
            <img src="${logoUrl}" alt="Republic of Kenya / Judiciary Crest" />
          </div>
          <div class="header-text">
            <div class="judiciary">THE JUDICIARY</div>
            <div class="office-name">OFFICE OF THE REGISTRAR HIGH COURT</div>
          </div>
        </div>

        <div class="header-rule"></div>

        <div class="ref-date">
          <span class="ref">Ref: ${escapeHtml(data.ref)}</span>
          <span class="date">${escapeHtml(data.date)}</span>
        </div>

        <div class="body-content">
          ${data.to ? `<div class="to-block"><p>${escapeHtml(data.to).replace(/\n/g, '<br/>')}</p></div>` : ''}
          ${data.subject ? `<div class="subject-line">RE: ${escapeHtml(data.subject)}</div>` : ''}
          ${formatBody(data.body)}
        </div>

        <div class="signature">
          <div class="name">${escapeHtml(data.sender)}</div>
          <div class="title">${escapeHtml(data.senderTitle || 'Registrar, High Court')}</div>
        </div>

        ${data.cc ? formatCC(data.cc) : ''}
        ${data.enclosures ? `
          <div class="enclosures-block">
            <span class="label">Enclosures:</span> ${escapeHtml(data.enclosures)}
          </div>
        ` : ''}

        <div class="footer">
          <div class="footer-top">
            <div class="footer-emblem">
              <img src="${footerEmblemUrl}" alt="Social Transformation Emblem" />
            </div>
            <div class="footer-text">
              <p>Milimani Law Courts | 3rd Floor, Chamber 337 | P.O. Box 30041-00100 | Nairobi</p>
              <p>Tel. +254 0730 181478 | registrarhighcourt@court.go.ke | www.judiciary.go.ke</p>
            </div>
          </div>
          <div class="footer-tagline">Justice Be Our Shield and Defender</div>
        </div>
      </div>
    </body>
    </html>
  `;
}

// data.body is real HTML (contentEditable's innerHTML from the composer,
// NOT plain text with literal newlines) — it's rendered as-is elsewhere
// via dangerouslySetInnerHTML, so it must NOT be HTML-escaped here, and
// splitting on '\n' has no effect since contentEditable uses one <div>
// per line rather than newline characters.
//
// The visible bug (a large blank gap between paragraphs, which bloats
// body height enough to shove the signature block onto page 2) comes
// from Chrome's contentEditable behaviour: hitting Enter on a blank
// line produces an empty <div><br></div>. Two or three blank lines the
// person typed become two or three full empty lines at the body's
// line-height: 1.8. This collapses any run of 2+ stacked empty
// block-level elements down to a single blank line, without touching
// real content or formatting (bold/italic/lists etc. pass through
// untouched).
function formatBody(html: string): string {
  if (!html || !html.trim()) return '<p>&nbsp;</p>';

  return html
    // 2+ consecutive empty <div>s (with or without a lone <br>) -> one
    .replace(/(?:<div>\s*(?:<br\s*\/?>)?\s*<\/div>\s*){2,}/gi, '<div><br></div>')
    // 2+ consecutive empty <p>s -> one
    .replace(/(?:<p>\s*(?:<br\s*\/?>)?\s*<\/p>\s*){2,}/gi, '<p><br></p>')
    // 3+ raw stacked <br> tags -> a single paragraph-sized gap
    .replace(/(?:<br\s*\/?>\s*){3,}/gi, '<br/><br/>');
}

// CC input format: entries separated by a blank line (double newline).
// Within each entry, lines are separated by a single newline; the LAST
// line of each entry is treated as the station/location and rendered
// bold + underlined (matching the "NAIROBI" / "High Court of Kenya"
// styling in the reference template). Falls back to a single unnumbered
// entry if no blank-line separators are present, so existing plain
// single-line CC values (e.g. "The Registrar, Milimani Law Courts")
// still render sensibly.
//
// Composer-side: each CC recipient should be entered as its own
// multi-line block, separated from the next recipient by a blank line,
// e.g.:
//   Presiding Judge,
//   Civil Division
//   NAIROBI
//
//   Presiding Judge,
//   Tribunals Appeal Division,
//   NAIROBI
function formatCC(cc: string): string {
  const entries = cc
    .split(/\n\s*\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (entries.length === 0) return '';

  const entriesHtml = entries
    .map((entry, index) => {
      const lines = entry.split('\n').map((line) => line.trim()).filter(Boolean);
      const locationLine = lines[lines.length - 1] || '';
      const bodyLines = lines.slice(0, -1);

      const bodyHtml = bodyLines.map((line) => `<p>${escapeHtml(line)}</p>`).join('');
      const locationHtml = locationLine
        ? `<p class="cc-location">${escapeHtml(locationLine)}</p>`
        : '';

      return `
        <div class="cc-entry">
          <span class="cc-number">${index + 1}.</span>
          <span class="cc-text">${bodyHtml}${locationHtml}</span>
        </div>
      `;
    })
    .join('');

  return `
    <div class="cc-block">
      <span class="cc-label">Copy to:</span>
      <div class="cc-entries">${entriesHtml}</div>
    </div>
  `;
}

function escapeHtml(text: string): string {
  if (!text) return '';
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

// Backward-compatible alias
export const getLetterTemplate = getLetterHTML;