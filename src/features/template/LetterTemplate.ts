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
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, Helvetica, sans-serif; color: #000; background: #fff; }

        .page {
          max-width: 794px;
          min-height: 1123px;
          margin: 0 auto;
          padding: 50px 60px 170px;
          position: relative;
        }

        .header {
          display: flex;
          align-items: center;
          margin-bottom: 10px;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        .logo-container { flex: 0 0 75px; margin-right: 16px; }
        .logo-container img { width: 70px; height: auto; display: block; }
        .header-text .judiciary { font-size: 18px; font-weight: bold; line-height: 1.3; }
        .header-text .office-name {
          font-size: 14px;
          font-weight: bold;
          text-transform: uppercase;
          margin-top: 2px;
          line-height: 1.3;
        }
        .header-rule { border-top: 1.5px solid #C29B38; margin-bottom: 28px; }

        .ref-date {
          display: flex;
          justify-content: space-between;
          margin: 0 0 30px;
          font-size: 13px;
          font-weight: bold;
          page-break-inside: avoid;
          break-inside: avoid;
        }

        .body-content {
          margin: 0 0 40px;
          font-size: 13px;
          line-height: 1.8;
          text-align: justify;
        }
        .body-content .to-block { margin-bottom: 18px; page-break-inside: avoid; break-inside: avoid; }
        .body-content .to-block p { margin: 0; line-height: 1.5; }
        .body-content .subject-line {
          font-weight: bold;
          text-decoration: underline;
          margin: 18px 0;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        .body-content p { margin-bottom: 10px; }

        .signature {
          margin-top: 50px;
          font-size: 13px;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        .signature .name { font-weight: bold; text-transform: uppercase; }
        .signature .title {
          font-weight: bold;
          text-decoration: underline;
          text-transform: uppercase;
          margin-top: 2px;
        }

        /* ── CC block ────────────────────────────────────────────────────────── */
        .cc-block {
          margin-top: 30px;
          font-size: 13px;
          line-height: 1.5;
        }
        .cc-label {
          font-style: italic;
          text-decoration: underline;
          display: block;
          margin-bottom: 8px;
        }
        .cc-entries {
          margin-left: 24px;          /* indent the whole list */
        }
        .cc-entry {
          display: flex;
          margin-bottom: 16px;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        .cc-entry:last-child { margin-bottom: 0; }
        .cc-number {
          flex: 0 0 28px;             /* space for "1." etc. */
        }
        .cc-text {
          flex: 1;
        }
        .cc-text p {
          margin: 0;
          line-height: 1.5;
        }
        .cc-location {
          font-weight: bold;
          text-transform: uppercase;   /* matches the image (e.g. NAIROBI) */
          /* no underline – matches the image */
        }

        .enclosures-block {
          margin-top: 20px;
          font-size: 12px;
          line-height: 1.6;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        .enclosures-block .label { font-weight: bold; }

        /* ── Footer (fixed) ──────────────────────────────────────────────────── */
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
        .footer-emblem { flex: 0 0 90px; }
        .footer-emblem img { width: 90px; height: 90px; display: block; object-fit: contain; }
        .footer-text {
          flex: 1;
          text-align: right;
          font-size: 11px;
          color: #1a1a1a;
        }
        .footer-text p { margin: 2px 0; line-height: 1.5; }
        .footer-tagline {
          text-align: right;
          font-size: 12px;
          font-weight: bold;
          color: #1E4620;
          margin-top: 8px;
        }

        @media (max-width: 600px) {
          .page { padding: 30px 20px 170px; }
          .header { flex-direction: column; text-align: center; }
          .logo-container { margin-right: 0; margin-bottom: 10px; }
          .ref-date { flex-direction: column; align-items: flex-start; gap: 5px; }
          .footer { left: 20px; right: 20px; }
          .footer-top { flex-direction: column; text-align: center; gap: 10px; }
          .footer-text, .footer-tagline { text-align: center; }
          .cc-entries { margin-left: 16px; }
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

/**
 * Clean up excessive blank lines from contentEditable HTML.
 */
function formatBody(html: string): string {
  if (!html || !html.trim()) return '<p>&nbsp;</p>';
  return html
    .replace(/(?:<div>\s*(?:<br\s*\/?>)?\s*<\/div>\s*){2,}/gi, '<div><br></div>')
    .replace(/(?:<p>\s*(?:<br\s*\/?>)?\s*<\/p>\s*){2,}/gi, '<p><br></p>')
    .replace(/(?:<br\s*\/?>\s*){3,}/gi, '<br/><br/>');
}

/**
 * Parses a multi‑entry CC string.
 *
 * Expected input format:
 *   Each recipient is a block of lines, separated from the next by a blank line.
 *   The last line of each block is treated as the location (e.g. "NAIROBI")
 *   and is rendered bold + uppercase.
 *
 * Example:
 *   Presiding Judge,
 *   Civil Division
 *   NAIROBI
 *
 *   Presiding Judge,
 *   Tribunals Appeal Division,
 *   NAIROBI
 *
 *   Registrar
 *   High Court of Kenya
 */
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

// Backward‑compatible alias
export const getLetterTemplate = getLetterHTML;