// src/features/template/CertificateTemplate.ts

export interface CertificateData {
  title: string;                 // e.g. "CERTIFICATE OF SERVICE OF FOREIGN PROCESS"
  ruleReference?: string;        // e.g. "Order 5 Rule 32(e) of the Civil Procedure Rules"
  ref?: string;                  // optional Ref, shown top-right like Letter/Memo if provided
  date?: string;                 // optional Date, shown top-right if provided
  body: string;                  // rich HTML: the "I, <NAME>, Registrar..." paragraph + numbered clauses + closing paragraph
  datedLine: string;             // e.g. "Dated, Signed and Sealed this 23rd July, 2026."
  signatoryLines: string[];      // e.g. ["REGISTRAR,", "HIGH COURT OF KENYA"] — NO name line; name lives only in the body
  draftedByInitials?: string;
  logoUrl?: string;
  footerEmblemUrl?: string;
  footerAddress?: string;
  footerContact?: string;
  footerTagline?: string;
}

// MUST stay identical to SIGNATURE_ANCHOR_TEXT in LetterTemplate.ts / MemoTemplate.ts
// and to the constant of the same name in embedSignature.ts.
export const SIGNATURE_ANCHOR_TEXT = 'RHC-SIGNATURE-ANCHOR';

const DEFAULTS = {
  logoUrl:
    'https://res.cloudinary.com/do0yflasl/image/upload/v1784363826/ORHC_L_crclut.jpg',
  footerEmblemUrl:
    'https://res.cloudinary.com/do0yflasl/image/upload/v1784364354/ORHC_EMBLEM_wzmp94.jpg',
  footerAddress:
    'Milimani Law Courts | 3rd Floor, Chamber 337 | P.O. Box 30041-00100 | Nairobi',
  footerContact:
    'Tel. +254 0730 181478 | registrarhighcourt@court.go.ke | www.judiciary.go.ke',
  footerTagline: 'Justice Be Our Shield and Defender',
};

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

// Same collapsing behaviour as LetterTemplate's formatBody, so rich-text
// editor output (TipTap/Quill-style empty <p>/<div> spam) doesn't produce
// oversized gaps in the rendered certificate.
function formatBody(html: string): string {
  if (!html || !html.trim()) return '<p>&nbsp;</p>';

  return html
    .replace(/(?:<div>\s*(?:<br\s*\/?>)?\s*<\/div>\s*){2,}/gi, '<div><br></div>')
    .replace(/(?:<p>\s*(?:<br\s*\/?>)?\s*<\/p>\s*){2,}/gi, '<p><br></p>')
    .replace(/(?:<br\s*\/?>\s*){3,}/gi, '<br/><br/>');
}

export function getCertificateHTML(data: CertificateData): string {
  const {
    title,
    ruleReference,
    ref,
    date,
    body,
    datedLine,
    signatoryLines,
    draftedByInitials,
    logoUrl = DEFAULTS.logoUrl,
    footerEmblemUrl = DEFAULTS.footerEmblemUrl,
    footerAddress = DEFAULTS.footerAddress,
    footerContact = DEFAULTS.footerContact,
    footerTagline = DEFAULTS.footerTagline,
  } = data;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>CERTIFICATE</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
          font-family: Arial, Helvetica, sans-serif;
          color: #000000;
          background: white;
          font-size: 12pt;
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
          justify-content: center;
          margin-bottom: 20px;
          page-break-inside: avoid;
          break-inside: avoid;
        }

        .header img {
          height: 78px;
          width: auto;
          display: block;
        }

        .ref-date {
          display: flex;
          justify-content: space-between;
          margin: 0 0 24px 0;
          font-size: 12pt;
          font-weight: bold;
          page-break-inside: avoid;
          break-inside: avoid;
        }

        .cert-title {
          text-align: center;
          font-weight: bold;
          text-transform: uppercase;
          margin: 4px 0 6px;
          font-size: 14pt;
          line-height: 1.4;
        }

        .cert-rule {
          text-align: center;
          font-weight: bold;
          margin-bottom: 28px;
          font-size: 12pt;
          line-height: 1.4;
        }

        .cert-body {
          text-align: justify;
          font-size: 12pt;
          line-height: 1.6;
          margin-bottom: 8px;
        }

        .cert-body p { margin-bottom: 12px; }

        .cert-body ol {
          margin: 4px 0 16px 0;
          padding-left: 26px;
        }

        .cert-body li {
          margin-bottom: 10px;
          line-height: 1.6;
          text-align: justify;
        }

        .dated-line {
          text-align: center;
          margin-top: 36px;
          margin-bottom: 0;
          font-size: 12pt;
        }

        /* Groups the anchor with the signatory block so page-break-inside:
           avoid keeps them atomically together on the same page — mirrors
           Letter/Memo's .signature-section wrapper.

           WITHOUT this wrapper: .signature-anchor and .signatory-block are
           independent siblings, and only .signatory-block carries
           page-break-inside: avoid. If the block doesn't fit in the
           remaining space on a page (which depends on exact body/font
           layout — longer certificate bodies, or even font-metric
           differences between environments, push this over the edge), the
           pagination engine pushes .signatory-block WHOLE onto the next
           page while the anchor — having no such protection — is left
           behind on the page it was already placed on. embedSignature.ts's
           Pass 0 then can't find a "next line" on the anchor's page,
           falls back to an unmeasured/unclamped placement, and the
           signature can bleed into the footer. This was the root cause of
           certificate signatures overlapping the footer in production
           while letter/memo (which already group anchor+signature under
           one wrapper) were unaffected. */
        .signature-block-wrapper {
          page-break-inside: avoid;
          break-inside: avoid;
        }

        /* Invisible marker: real text on the page (so PDF text-extraction
           can locate it), but zero visual footprint. Kept centered inline
           so its detected x-coordinate lands near the page's horizontal
           center, matching this template's centered signatory block —
           unlike Letter/Memo's left-margin anchor. */
        .signature-anchor {
          font-size: 1px;
          line-height: 1px;
          height: 1px;
          color: transparent;
          overflow: hidden;
          user-select: none;
          text-align: center;
        }

        /* Gives the embedded signature image (drawn between the anchor
           above and this block) room to sit without crowding either the
           dated line or "REGISTRAR, HIGH COURT OF KENYA" below. The
           signature can be up to ~80px tall as rendered here, so this
           needs to stay comfortably larger than that. If the signature
           still looks cramped against either side, raise this further
           before touching the placement math in embedSignature.ts. */
        .signatory-block {
          text-align: center;
          font-weight: bold;
          text-transform: uppercase;
          margin-top: 120px;
          page-break-inside: avoid;
          break-inside: avoid;
        }

        .signatory-block p {
          margin: 2px 0;
          line-height: 1.4;
        }

        .drafted-by {
          font-weight: normal;
          font-style: italic;
          text-decoration: underline;
          text-transform: lowercase;
          margin-top: 16px;
          font-size: 6pt;
          color: #000;
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

        .footer-emblem { flex: 0 0 90px; }

        .footer-emblem img {
          width: 90px;
          height: 90px;
          display: block;
          object-fit: contain;
        }

        .footer-text {
          flex: 1;
          text-align: right;
          font-size: 10pt;
          color: #1a1a1a;
        }

        .footer-text p { margin: 2px 0; line-height: 1.5; }

        .footer-tagline {
          text-align: right;
          font-size: 11pt;
          font-weight: bold;
          color: #1E4620;
          margin-top: 8px;
        }

        @media (max-width: 600px) {
          .page { padding: 30px 20px 170px 20px; }
          .footer { left: 20px; right: 20px; }
          .footer-top { flex-direction: column; text-align: center; gap: 10px; }
          .footer-text, .footer-tagline { text-align: center; }
        }
      </style>
    </head>
    <body>
      <div class="page">
        <div class="header">
          <img src="${escapeHtml(logoUrl)}" alt="Republic of Kenya / Judiciary Crest" />
        </div>

        ${(ref || date) ? `
          <div class="ref-date">
            <span class="ref">${ref ? `Ref: ${escapeHtml(ref)}` : ''}</span>
            <span class="date">${date ? escapeHtml(date) : ''}</span>
          </div>
        ` : ''}

        <div class="cert-title">${escapeHtml(title)}</div>
        ${ruleReference ? `<div class="cert-rule">(${escapeHtml(ruleReference)})</div>` : ''}

        <div class="cert-body">
          ${formatBody(body)}
        </div>

        <div class="dated-line">${escapeHtml(datedLine)}</div>

        <div class="signature-block-wrapper">
          <div class="signature-anchor" aria-hidden="true">${SIGNATURE_ANCHOR_TEXT}</div>

          <div class="signatory-block">
            ${signatoryLines.map((line) => `<p>${escapeHtml(line)}</p>`).join('')}
            ${draftedByInitials ? `<div class="drafted-by">rhc/${escapeHtml(draftedByInitials)}</div>` : ''}
          </div>
        </div>

        <div class="footer">
          <div class="footer-top">
            <div class="footer-emblem">
              <img src="${escapeHtml(footerEmblemUrl)}" alt="Social Transformation Emblem" />
            </div>
            <div class="footer-text">
              <p>${escapeHtml(footerAddress)}</p>
              <p>${escapeHtml(footerContact)}</p>
            </div>
          </div>
          <div class="footer-tagline">${escapeHtml(footerTagline)}</div>
        </div>
      </div>
    </body>
    </html>
  `;
}

export const getCertificateTemplate = getCertificateHTML;