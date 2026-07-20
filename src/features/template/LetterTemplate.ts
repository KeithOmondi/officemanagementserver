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
  // signaturePlacement is removed; placement is now automatic via the anchor marker.
}

const DEFAULT_LOGO_URL =
  'https://res.cloudinary.com/do0yflasl/image/upload/v1784363826/ORHC_L_crclut.jpg';
const DEFAULT_FOOTER_EMBLEM_URL =
  'https://res.cloudinary.com/do0yflasl/image/upload/v1784364354/ORHC_EMBLEM_wzmp94.jpg';

// This exact string is what embedSignature.ts looks for to locate the
// signature block reliably. It MUST stay in sync with SIGNATURE_ANCHOR_TEXT
// in src/utils/embedSignature.ts.
export const SIGNATURE_ANCHOR_TEXT = 'RHC-SIGNATURE-ANCHOR';

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

function formatBody(html: string): string {
  if (!html || !html.trim()) return '<p>&nbsp;</p>';

  return html
    .replace(/(?:<div>\s*(?:<br\s*\/?>)?\s*<\/div>\s*){2,}/gi, '<div><br></div>')
    .replace(/(?:<p>\s*(?:<br\s*\/?>)?\s*<\/p>\s*){2,}/gi, '<p><br></p>')
    .replace(/(?:<br\s*\/?>\s*){3,}/gi, '<br/><br/>');
}

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

export function getLetterHTML(data: LetterData): string {
  const {
    ref,
    date,
    to,
    subject,
    body,
    sender,
    senderTitle,
    cc,
    enclosures,
    logoUrl = DEFAULT_LOGO_URL,
    footerEmblemUrl = DEFAULT_FOOTER_EMBLEM_URL,
  } = data;

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

        .page {
          max-width: 794px;
          min-height: 1123px;
          margin: 0 auto;
          padding: 50px 60px 170px 60px;
          position: relative;
        }

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

        .ref-date {
          display: flex;
          justify-content: space-between;
          margin: 0 0 30px 0;
          font-size: 13px;
          font-weight: bold;
          page-break-inside: avoid;
          break-inside: avoid;
        }

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

        /* Signature section container - ensures proper spacing */
        .signature-section {
          margin-top: 50px;
          page-break-inside: avoid;
          break-inside: avoid;
        }

        /* Invisible marker painted immediately before the signature block
           so the PDF/e-sign pipeline can locate it unambiguously instead
           of pattern-matching visible text. See SIGNATURE_ANCHOR_TEXT above. */
        .signature-anchor {
          font-size: 1px;
          line-height: 1px;
          height: 1px;
          color: transparent;
          overflow: hidden;
          user-select: none;
        }

        /* Signature block - displayed right after the anchor */
        .signature {
  font-size: 13px;
  /* Extra clearance above the printed name/title so the embedded
     signature image (placed by embedSignature.ts relative to the
     invisible anchor immediately above this block) has room to sit
     without overlapping the text. Without this, the anchor and the
     name were only ~15-20pt apart, but the signature image is roughly
     40-50pt tall once scaled, so it ended up covering the name. */
  margin-top: 70px;
}

        .signature .name {
          font-weight: bold;
          text-transform: uppercase;
          margin-bottom: 2px;
        }

        .signature .title {
          font-weight: bold;
          text-decoration: underline;
          text-transform: uppercase;
        }

        .cc-block {
          margin-top: 30px;
          font-size: 13px;
          line-height: 1.5;
          display: flex;
          page-break-inside: avoid;
          break-inside: avoid;
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
            <img src="${escapeHtml(logoUrl)}" alt="Republic of Kenya / Judiciary Crest" />
          </div>
          <div class="header-text">
            <div class="judiciary">THE JUDICIARY</div>
            <div class="office-name">OFFICE OF THE REGISTRAR HIGH COURT</div>
          </div>
        </div>

        <div class="header-rule"></div>

        <div class="ref-date">
          <span class="ref">Ref: ${escapeHtml(ref)}</span>
          <span class="date">${escapeHtml(date)}</span>
        </div>

        <div class="body-content">
          ${to ? `<div class="to-block"><p>${escapeHtml(to).replace(/\n/g, '<br/>')}</p></div>` : ''}
          ${subject ? `<div class="subject-line">RE: ${escapeHtml(subject)}</div>` : ''}
          ${formatBody(body)}
        </div>

        <!-- Signature section with anchor marker -->
        <div class="signature-section">
          <!-- Explicit, unambiguous anchor for signature-placement detection -->
          <div class="signature-anchor" aria-hidden="true">${SIGNATURE_ANCHOR_TEXT}</div>

          <!-- Signature block – displayed immediately after the anchor -->
          <div class="signature">
            <div class="name">${escapeHtml(sender)}</div>
            <div class="title">${escapeHtml(senderTitle || 'Registrar, High Court')}</div>
          </div>
        </div>

        ${cc ? formatCC(cc) : ''}
        ${enclosures ? `
          <div class="enclosures-block">
            <span class="label">Enclosures:</span> ${escapeHtml(enclosures)}
          </div>
        ` : ''}

        <div class="footer">
          <div class="footer-top">
            <div class="footer-emblem">
              <img src="${escapeHtml(footerEmblemUrl)}" alt="Social Transformation Emblem" />
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

export const getLetterTemplate = getLetterHTML;