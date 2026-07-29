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

const DEFAULT_LOGO_URL =
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
    /^(YOUR HONOR|DEAR SIR|DEAR MADAM|DEAR JUDGE|RESPECTED SIR|RESPECTED MADAM)[,. ]*$/i;

  let salutationLine = "";
  let locationLine = "";
  let bodyLines = [...lines];

  if (lines.length > 0 && salutationRegex.test(lines[lines.length - 1])) {
    salutationLine = lines.pop()!;
    bodyLines = [...lines];
  }

  if (bodyLines.length > 0) {
    locationLine = bodyLines.pop()!;
  }

  const bodyHtml = bodyLines
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join("");
  const locationHtml = locationLine
    ? `<p class="to-location">${escapeHtml(locationLine)}</p>`
    : "";
  const salutationHtml = salutationLine
    ? `<p class="to-salutation">${escapeHtml(salutationLine)}</p>`
    : "";

  return `<div class="to-block">${bodyHtml}${locationHtml}${salutationHtml}</div>`;
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
      const locationLine = lines[lines.length - 1] || "";
      const bodyLines = lines.slice(0, -1);

      const bodyHtml = bodyLines
        .map((line) => `<p>${escapeHtml(line)}</p>`)
        .join("");
      const locationHtml = locationLine
        ? `<p class="cc-location">${escapeHtml(locationLine)}</p>`
        : "";

      const numberHtml =
        entries.length > 1
          ? `<span class="cc-number">${index + 1}.</span>`
          : "";

      return `
        <div class="cc-entry">
          ${numberHtml}
          <span class="cc-text">${bodyHtml}${locationHtml}</span>
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
        /* ========== Page & Print Setup ========== */
        @page {
  margin: 2cm 2.34cm 1.9cm 2.25cm;  /* top right bottom left, matches Word */
  size: A4;
}

        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
  font-family: Arial, Helvetica, sans-serif;
  font-size: 12pt;
  color: #000;
  background: white;
  /* remove min-height: 100vh entirely — let content define page height */
}

        .page {
  max-width: 794px;
  margin: 0 auto;
  padding: 0 0 150px 0;   /* only reserve what the footer actually needs, no min-height */
  position: relative;
}

        /* ========== Header ========== */
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
          text-transform: uppercase;
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
          margin-bottom: 24px;
        }

        /* ========== Ref / Date ========== */
        .ref-date {
          display: flex;
          justify-content: space-between;
          margin: 0 0 28px 0;
          font-size: 12pt;
          font-weight: bold;
          page-break-inside: avoid;
          break-inside: avoid;
        }

        /* ========== Body Content ========== */
        .body-content {
  line-height: 1.15;      /* was 1.5 — matches Word's actual spacing */
}

        .body-content .to-block {
          margin-bottom: 20px;
          page-break-inside: avoid;
          break-inside: avoid;
        }

        .body-content .to-block p {
          margin: 0;
          line-height: 1.4;
        }

        .body-content .to-block .to-location {
          font-weight: bold;
          text-decoration: underline;
          text-transform: uppercase;
          margin-top: 2px;
        }

        .body-content .to-block .to-salutation {
          font-weight: normal;
          text-decoration: none;
          text-transform: uppercase;
          margin-top: 12px;
        }

        .body-content .subject-line {
          font-weight: bold;
          text-decoration: underline;
          text-transform: uppercase;
          margin: 20px 0;
          line-height: 1.4;
          page-break-inside: avoid;
          break-inside: avoid;
        }

        .body-content p {
          margin-bottom: 12px;
        }

        .body-content ul {
          margin: 12px 0 20px 20px;
          list-style-type: none;
          padding-left: 0;
        }
        .body-content ul li {
          margin-bottom: 6px;
          padding-left: 16px;
          text-indent: -16px;
        }
        .body-content ul li::before {
          content: "- ";
        }

        /* ---------- Table ---------- */
        .body-content table {
          width: 100%;
          border-collapse: collapse;
          font-size: 11pt;
          border: 1px solid #ccc;
          page-break-inside: auto;
          table-layout: fixed;
          margin: 16px 0 24px 0;
        }

        .body-content th,
        .body-content td {
          border: 1px solid #ccc;
          padding: 6px 8px;
          text-align: left;
          vertical-align: top;
          word-wrap: break-word;
          overflow-wrap: break-word;
          max-width: 180px;
          page-break-inside: avoid;
        }

        .body-content th {
          background-color: #f5f5f5;
          font-weight: bold;
        }

        .body-content thead {
          display: table-header-group;
        }

        .body-content tbody {
          page-break-inside: auto;
        }

        .body-content tr {
          page-break-inside: avoid;
          page-break-after: auto;
        }

        /* ========== Signature ========== */
        .signature-section {
          margin-top: 30px;
          page-break-inside: avoid;
          break-inside: avoid;
        }

        .signature-anchor {
          font-size: 1px;
          line-height: 1px;
          height: 1px;
          color: transparent;
          overflow: hidden;
          user-select: none;
          display: block;          /* ensures the anchor is on its own line */
        }

        /* Gap from the signature anchor to the printed name/title below.
           Raised from 45px to 90px — the previous value left too little
           room for embedSignature.ts's tightened anchor-to-name gap
           constants (ANCHOR_BOTTOM_GAP now 0), which started overlapping
           the signatory name/title on some signatures. Brought in line
           with the Memo template's gap, which has been reliable. */
        .signature {
          font-size: 12pt;
          margin-top: 90px;
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

        /* ========== CC Block ========== */
        .cc-block {
          margin-top: 30px;
          font-size: 12pt;
          line-height: 1.5;
          display: flex;
          page-break-inside: avoid;
          break-inside: avoid;
        }

        .cc-block .cc-label {
          flex: 0 0 90px;
          font-weight: bold;
          font-style: italic;
          text-decoration: underline;
        }

        .cc-block .cc-entries {
          flex: 1;
        }

        .cc-entry {
          display: flex;
          margin-bottom: 12px;
          page-break-inside: avoid;
          break-inside: avoid;
        }

        .cc-entry:last-child {
          margin-bottom: 0;
        }

        .cc-entry .cc-number {
          flex: 0 0 24px;
          font-weight: bold;
        }

        .cc-entry .cc-text p {
          margin: 0;
          line-height: 1.4;
        }

        .cc-entry .cc-text .cc-location {
          font-weight: bold;
          text-decoration: underline;
          text-transform: uppercase;
        }

        /* ========== Enclosures ========== */
        .enclosures-block {
          margin-top: 20px;
          font-size: 12pt;
          line-height: 1.5;
          page-break-inside: avoid;
          break-inside: avoid;
        }

        .enclosures-block .label {
          font-weight: bold;
        }

        /* ==================================================
           FOOTER – FIXED ON EVERY PAGE (table-based layout)
           Table-based instead of flexbox so the emblem size,
           bold weights, and green taglines render consistently
           across HTML-to-PDF engines with partial flex support.
           ================================================== */
        .footer {
  position: fixed;
  bottom: 12px;           /* was 20px */
  left: 60px;
  right: 60px;
  border-top: 1px solid #999;
  padding-top: 6px;       /* was 14px */
  background: white;
  page-break-inside: avoid;
}

        .footer-table {
          width: 100%;
          border-collapse: collapse;
        }

        .footer-emblem-cell {
  width: 60px;            /* was 90px */
  vertical-align: middle;
  padding-right: 10px;    /* was 18px */
}

       .footer-emblem-cell img {
  width: 60px;
  height: auto;           /* stop forcing a square — let it stay proportional */
  max-height: 40px;
  object-fit: contain;
}

        .footer-text-cell {
  text-align: right;
  vertical-align: middle;
  font-size: 8.5pt;       /* was 10pt */
  color: #1a1a1a;
  line-height: 1.25;      /* was 1.5 */
  font-stretch: condensed; /* nudges toward the Arial Narrow look where supported */
}

        .footer-tagline-top {
  font-weight: bold;
  font-size: 9.5pt;       /* was 11pt */
  color: #1E4620;
  margin-bottom: 2px;     /* was 4px */
}

       .footer-text-cell p {
  margin: 1px 0;          /* was 2px 0 */
}

        .footer-tagline-bottom {
  text-align: right;
  font-weight: bold;
  font-size: 10pt;        /* was 11pt, closest to Word's 12pt bold-condensed look */
  color: #1E4620;
  margin-top: 4px;        /* was 8px */
}

        /* ========== Responsive ========== */
        @media (max-width: 600px) {
          .page { padding: 30px 20px 200px 20px; }
          .header { flex-direction: column; text-align: center; }
          .logo-container { margin-right: 0; margin-bottom: 10px; }
          .ref-date { flex-direction: column; align-items: flex-start; gap: 5px; }
          .footer { left: 20px; right: 20px; }
          .cc-block { flex-direction: column; }
          .cc-block .cc-label { margin-bottom: 8px; }
        }
      </style>
    </head>
    <body>
      <!-- ===== PAGE CONTENT ===== -->
      <div class="page">

        <!-- Header -->
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

        <!-- Ref / Date -->
        <div class="ref-date">
          <span class="ref">Ref: ${escapeHtml(ref)}</span>
          <span class="date">${escapeHtml(date)}</span>
        </div>

        <!-- Body -->
        <div class="body-content">
          ${to ? formatToBlock(to) : ""}
          ${subject ? `<div class="subject-line">RE: ${escapeHtml(subject)}</div>` : ""}
          ${formatBody(body)}
        </div>

        <!-- Signature -->
        <div class="signature-section">
          <div class="signature-anchor" aria-hidden="true">${SIGNATURE_ANCHOR_TEXT}</div>
          <div class="signature">
            <div class="name">${escapeHtml(sender)}</div>
            <div class="title">${escapeHtml(senderTitle || "Registrar, High Court")}</div>
          </div>
        </div>

        <!-- CC -->
        ${cc ? formatCC(cc) : ""}

        <!-- Enclosures -->
        ${
          enclosures
            ? `
          <div class="enclosures-block">
            <span class="label">Enclosures:</span> ${escapeHtml(enclosures)}
          </div>
        `
            : ""
        }

      </div><!-- end .page -->

      <!-- ===== FOOTER (fixed on every page, with emblem) ===== -->
      <div class="footer">
        <table class="footer-table" cellpadding="0" cellspacing="0">
          <tr>
            <td class="footer-emblem-cell">
              <img src="${escapeHtml(footerEmblemUrl)}" alt="Social Transformation Emblem" width="90" height="90" />
            </td>
            <td class="footer-text-cell">
              <div class="footer-tagline-top">Social Transformation through Access to Justice</div>
              <p>Milimani Law Courts | 3rd Floor, Chamber 337 | P.O. Box 30041-00100 | Nairobi</p>
              <p>Tel. +254 0730 181478 | registrarhighcourt@court.go.ke | www.judiciary.go.ke</p>
              <div class="footer-tagline-bottom">Justice Be Our Shield and Defender</div>
            </td>
          </tr>
        </table>
      </div>

    </body>
    </html>
  `;
}

export const getLetterTemplate = getLetterHTML;
