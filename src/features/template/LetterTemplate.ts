// =====================================================
// Interfaces & Constants
// =====================================================

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

const DEFAULT_HEADER_BANNER_URL =
  "https://res.cloudinary.com/do0yflasl/image/upload/v1784363826/ORHC_L_crclut.jpg";
const DEFAULT_FOOTER_EMBLEM_URL =
  "https://res.cloudinary.com/do0yflasl/image/upload/v1784364354/ORHC_EMBLEM_wzmp94.jpg";

export const SIGNATURE_ANCHOR_TEXT = "RHC-SIGNATURE-ANCHOR";

// =====================================================
// Helper Functions
// =====================================================

function escapeHtml(text: string): string {
  if (!text) return "";
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

function formatBody(html: string): string {
  if (!html || !html.trim()) return "<p>&nbsp;</p>";

  return html
    .replace(
      /(?:<div>\s*(?:<br\s*\/?>)?\s*<\/div>\s*){2,}/gi,
      "<div><br></div>",
    )
    .replace(/(?:<p>\s*(?:<br\s*\/?>)?\s*<\/p>\s*){2,}/gi, "<p><br></p>")
    .replace(/(?:<br\s*\/?>\s*){3,}/gi, "<br/><br/>");
}

function formatToBlock(toText: string): string {
  if (!toText) return "";
  const lines = toText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return "";

  const salutationRegex =
    /^(YOUR HONOR|YOUR HONOUR|DEAR SIR|DEAR MADAM|DEAR JUDGE|RESPECTED SIR|RESPECTED MADAM)[,. ]*$/i;

  let salutationLine = "";
  let bodyLines = [...lines];

  if (lines.length > 0 && salutationRegex.test(lines[lines.length - 1])) {
    salutationLine = lines.pop()!;
    bodyLines = [...lines];
  }

  const bodyHtml = bodyLines
    .map((line) => `<p class="to-line">${escapeHtml(line)}</p>`)
    .join("");

  const salutationHtml = salutationLine
    ? `<div class="to-salutation">${escapeHtml(salutationLine)}</div>`
    : "";

  return `
    <div class="to-block">
      ${bodyHtml}
    </div>
    ${salutationHtml}
  `;
}

function formatCC(cc: string): string {
  const entries = cc
    .split(/\n\s*\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (entries.length === 0) return "";

  const entriesHtml = entries
    .map((entry, index) => {
      const lines = entry
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

      const linesHtml = lines
        .map((line) => `<p>${escapeHtml(line)}</p>`)
        .join("");

      return `
        <div class="cc-entry">
          <span class="cc-number">${index + 1}.</span>
          <span class="cc-text">${linesHtml}</span>
        </div>
      `;
    })
    .join("");

  return `
    <div class="cc-block">
      <span class="cc-label">Copy to:</span>
      <div class="cc-entries">${entriesHtml}</div>
    </div>
  `;
}

// =====================================================
// Main Letter Generation
// =====================================================

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
    logoUrl = DEFAULT_HEADER_BANNER_URL,
    footerEmblemUrl = DEFAULT_FOOTER_EMBLEM_URL,
  } = data;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>LETTER</title>
      <style>
        @page {
          size: A4;
          margin: 15mm 20mm 10mm 20mm;
        }

        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        html, body {
          background: white;
          font-family: Arial, Helvetica, sans-serif;
          font-size: 11pt;
          color: #000;
        }

        .page-table {
          width: 100%;
          border-collapse: collapse;
        }

        .page-footer-space {
          height: 120px;
        }

        /* Flow Header (Appears only on Page 1) */
        .first-page-header {
          padding-bottom: 10px;
          margin-bottom: 20px;
          border-bottom: 1.5px solid #C29B38;
        }

        .header-banner {
          display: flex;
          justify-content: flex-start;
          align-items: center;
        }

        .header-banner img {
          max-height: 105px; /* Increased logo size */
          width: auto;
          margin-right: 20px;
        }

        .header-text {
          text-align: left;
          margin-bottom: 0;
        }

        .header-text .judiciary {
          font-size: 14pt;
          font-weight: bold;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .header-text .office-name {
          font-size: 11pt;
          font-weight: bold;
          text-transform: uppercase;
          font-style: normal;
          letter-spacing: 0.3px;
          margin-top: 3px;
        }

        /* Fixed Footer */
        .footer-wrapper {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          background: white;
          z-index: 1000;
        }

        .footer {
          border-top: 1px solid #C29B38;
          padding-top: 4px;
          padding-bottom: 2px;
          background: white;
        }

        .footer-table {
          width: 100%;
          border-collapse: collapse;
        }

        .footer-emblem-cell {
          width: 175px;
          vertical-align: middle;
          padding-right: 10px;
        }

        .footer-emblem-cell img {
          width: 165px;
          max-height: 60px;
          height: auto;
          object-fit: contain;
          display: block;
        }

        .footer-text-cell {
          text-align: right;
          vertical-align: middle;
          font-size: 8pt;
          color: #333333;
          line-height: 1.3;
        }

        .footer-text-cell p {
          margin: 1px 0;
        }

        .footer-tagline-top {
          font-weight: bold;
          font-size: 8.5pt;
          color: #1E4620;
          margin-bottom: 2px;
        }

        .footer-tagline-bottom {
          text-align: right;
          font-weight: bold;
          font-size: 9.5pt;
          color: #1E4620;
          margin-top: 4px;
        }

        /* Ref & Date Layout */
        .ref-date-row {
          display: flex;
          justify-content: normal;
          align-items: flex-start;
          margin-bottom: 16px;
          font-size: 11pt;
        }

        .ref-date-row .ref {
          font-weight: bold;
          margin-right: auto;
        }

        .ref-date-row .date {
          font-weight: normal;
        }

        /* Body Content Styles */
        .body-content {
          line-height: 1.4;
        }

        .to-block {
          margin-bottom: 12px;
        }

        .to-block p {
          margin: 0;
          line-height: 1.3;
        }

        .to-salutation {
          margin-bottom: 16px;
          font-weight: normal;
        }

        .subject-line {
          font-weight: bold;
          text-decoration: underline;
          text-transform: uppercase;
          margin: 16px 0;
          line-height: 1.35;
        }

        .body-content p {
          margin-bottom: 10px;
          text-align: left;
          orphans: 3;
          widows: 3;
        }

        /* Tables inside body */
        .body-content table {
          width: 100%;
          border-collapse: collapse;
          font-size: 10pt;
          margin: 14px 0;
        }

        .body-content th,
        .body-content td {
          border: 1px solid #000;
          padding: 6px 8px;
          text-align: left;
          vertical-align: top;
        }

        .body-content th {
          background-color: #f2f2f2;
          font-weight: bold;
        }

        /* Signature Section */
        .signature-section {
          margin-top: 28px;
          page-break-inside: avoid;
        }

        .signature-anchor {
          height: 1px;
          color: transparent;
        }

        .signature-section img,
        .signature img {
          max-height: 115px !important;
          width: auto;
          display: block;
          margin-bottom: 6px;
        }

        .signature {
          margin-top: 14px;
        }

        .signature .name {
          font-weight: bold;
          font-size: 11.5pt;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        .signature .title {
          font-weight: bold;
          font-size: 11.5pt;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          margin-top: 2px;
        }

        /* CC & Enclosure Blocks */
        .cc-block {
          margin-top: 16px;
          font-size: 10.5pt;
          page-break-inside: avoid;
        }

        .cc-label {
          font-weight: normal;
          margin-bottom: 4px;
          display: block;
        }

        .cc-entry {
          display: flex;
          margin-bottom: 4px;
        }

        .cc-entry .cc-number {
          width: 20px;
        }

        .cc-entry .cc-text p {
          margin: 0;
        }

        .enclosures-block {
          margin-top: 12px;
          font-size: 10.5pt;
          font-weight: bold;
        }
      </style>
    </head>
    <body>

      <!-- Main Page Flow with Foot Spacer -->
      <table class="page-table">
        <tbody>
          <tr>
            <td>
              <!-- Header rendered inline on page 1 only -->
              <div class="first-page-header">
                <div class="header-banner">
                  <img src="${escapeHtml(logoUrl)}" alt="Republic of Kenya & Judiciary Logos" />
                  <div class="header-text">
                    <div class="judiciary">THE JUDICIARY</div>
                    <div class="office-name">OFFICE OF THE REGISTRAR HIGH COURT</div>
                  </div>
                </div>
              </div>

              <div class="ref-date-row">
                <span class="ref">${escapeHtml(ref)}</span>
                <span class="date">${escapeHtml(date)}</span>
              </div>

              <div class="body-content">
                ${to ? formatToBlock(to) : ""}
                ${subject ? `<div class="subject-line">RE: ${escapeHtml(subject)}</div>` : ""}
                ${formatBody(body)}
              </div>

              <div class="signature-section">
                <div class="signature-anchor" aria-hidden="true">${SIGNATURE_ANCHOR_TEXT}</div>
                
                <div class="signature">
                  <div class="name">${escapeHtml(sender)}</div>
                  <div class="title">${escapeHtml(senderTitle || "REGISTRAR HIGH COURT")}</div>
                </div>
              </div>

              ${enclosures ? `<div class="enclosures-block">Encl</div>` : ""}
              ${cc ? formatCC(cc) : ""}
            </td>
          </tr>
        </tbody>

        <tfoot>
          <tr>
            <td><div class="page-footer-space"></div></td>
          </tr>
        </tfoot>
      </table>

      <!-- Fixed Printable Footer -->
      <div class="footer-wrapper">
        <div class="footer">
          <table class="footer-table" cellpadding="0" cellspacing="0">
            <tr>
              <td class="footer-emblem-cell">
                <img src="${escapeHtml(footerEmblemUrl)}" alt="STAJ Emblem" />
              </td>
              <td class="footer-text-cell">
                <div class="footer-tagline-top">Social Transformation through Access to Justice</div>
                <p>Milimani Law Courts | 3<sup>rd</sup> Floor, Chamber 337 | P.O. Box 30041-00100 | Nairobi</p>
                <p>Tel. +254 0730 181478 | registrarhighcourt@court.go.ke | www.judiciary.go.ke</p>
                <div class="footer-tagline-bottom">Justice Be Our Shield and Defender</div>
              </td>
            </tr>
          </table>
        </div>
      </div>

    </body>
    </html>
  `;
}

export const getLetterTemplate = getLetterHTML;