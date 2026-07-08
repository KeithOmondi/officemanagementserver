// src/templates/MemoTemplate.ts

export interface MemoData {
  to: string;
  from: string;
  ref: string;
  date: string;
  subject: string;
  body: string;
  signatureName: string;
  signatureTitle: string;
  draftedByInitials?: string; // e.g. "JM" — initials of the logged-in user drafting the memo
  logoUrl?: string;
  footerEmblemUrl?: string;
}

export function getMemoHTML(data: MemoData): string {
  // Combined Kenya Coat of Arms + Judiciary crest (single header image, as in the sample)
  const logoUrl = data.logoUrl || 'https://res.cloudinary.com/do0yflasl/image/upload/v1781759596/JOB_LOGO_ubls4m.jpg';

  // Small "Social Transformation" emblem used in the footer of the sample
  const footerEmblemUrl = data.footerEmblemUrl || 'https://res.cloudinary.com/do0yflasl/image/upload/v1782893389/footer-emblem_n0ncm9.jpg';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>MEMO</title>
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

        /* All page spacing lives here, not on 'body'. Because of the global
           box-sizing: border-box rule above, this padding is now INCLUDED
           inside min-height: 1123px (A4 height at 96dpi) instead of being
           added on top of it. Previously the padding sat on 'body', outside
           '.page', so the true required height was 1123px + body's padding
           — taller than a single A4 page — which is what was spilling a
           blank page 2 into the PDF.
           The bottom padding is intentionally large (170px, not 40px) to
           reserve room for the fixed footer below so body content never
           runs into it. */
        .page {
          max-width: 794px;
          min-height: 1123px;
          margin: 0 auto;
          padding: 50px 60px 170px 60px;
          position: relative;
        }

        /* Header — single combined crest, centered */
        .header {
          text-align: center;
          margin-bottom: 20px;
        }

        .header img {
          height: 78px;
          width: auto;
          display: inline-block;
        }

        /* Title block */
        .title-block {
          text-align: center;
          margin: 18px 0 22px 0;
        }

        .title-block h1 {
          font-size: 19px;
          font-weight: bold;
          text-transform: uppercase;
          color: #000000;
          line-height: 1.4;
        }

        /* Thick rule directly under the title, matching the sample */
        .top-rule {
          border-top: 2.5px solid #000000;
          margin-bottom: 10px;
        }

        /* Fields block — bracketed by the top rule above and bottom rule below */
        .fields {
          margin: 10px 0 0 0;
        }

        .field {
          display: flex;
          font-size: 13.5px;
          font-weight: bold;
          line-height: 2;
        }

        .field .label {
          width: 95px;
          flex-shrink: 0;
          text-transform: uppercase;
        }

        .field .colon {
          width: 20px;
          flex-shrink: 0;
        }

        .field .value {
          flex: 1;
        }

        .bottom-rule {
          border-top: 2.5px solid #000000;
          margin-top: 12px;
          margin-bottom: 40px;
        }

        /* Body Content */
        .body-content {
          margin: 0 0 40px 0;
          font-size: 13.5px;
          line-height: 1.8;
          text-align: justify;
          min-height: 260px;
        }

        .body-content p {
          margin-bottom: 10px;
        }

        /* Sign-off block */
        .signature {
          margin-top: 40px;
          font-size: 13.5px;
        }

        /* Signatory's actual name — bold, plain (not underlined) */
        .signature .signatory-name {
          font-weight: bold;
          margin-bottom: 4px;
        }

        /* Org/unit line — bold, underlined, uppercase */
        .signature .org-unit {
          font-weight: bold;
          text-decoration: underline;
          text-transform: uppercase;
        }

        /* rhc/initials line for the drafting user — directly under the org unit */
        .signature .drafted-by {
          font-weight: normal;
          text-transform: lowercase;
          margin-top: 4px;
          font-size: 12px;
          color: #333333;
        }

        /* Footer — pinned to the bottom of the page.
           'position: fixed' is intentional: Chromium's print/PDF engine
           (which is what Puppeteer's page.pdf() uses) keeps fixed-position
           elements anchored to the same spot on every physical page — the
           standard way to get a footer glued to the bottom of a
           Puppeteer-generated PDF. There is deliberately no @media print
           override here: a previous version reset this to
           'position: static; margin-top: 60px;' under @media print, which
           — since Puppeteer renders in print mode by default — pulled the
           footer back into normal document flow, making it appear right
           after the signature block instead of at the bottom of the page,
           and adding enough extra height to spill a blank second page. */
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
          flex: 0 0 70px;
        }

        .footer-emblem img {
          width: 70px;
          height: 70px;
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
          .field { flex-direction: row; }
          .field .label { width: 70px; }
          .footer { left: 20px; right: 20px; }
          .footer-top { flex-direction: column; text-align: center; gap: 10px; }
          .footer-text, .footer-tagline { text-align: center; }
        }
      </style>
    </head>
    <body>
      <div class="page">
        <!-- Header: single combined crest -->
        <div class="header">
          <img src="${logoUrl}" alt="Republic of Kenya / Judiciary Crest" />
        </div>

        <!-- Title -->
        <div class="title-block">
          <h1>OFFICE OF THE REGISTRAR HIGH COURT<br/>INTERNAL MEMO</h1>
        </div>

        <div class="top-rule"></div>

        <!-- Fields -->
        <div class="fields">
          <div class="field">
            <span class="label">TO</span>
            <span class="colon">:</span>
            <span class="value">${escapeHtml(data.to)}</span>
          </div>
          <div class="field">
            <span class="label">FROM</span>
            <span class="colon">:</span>
            <span class="value">${escapeHtml(data.from)}</span>
          </div>
          <div class="field">
            <span class="label">REF</span>
            <span class="colon">:</span>
            <span class="value">${escapeHtml(data.ref)}</span>
          </div>
          <div class="field">
            <span class="label">DATE</span>
            <span class="colon">:</span>
            <span class="value">${escapeHtml(data.date)}</span>
          </div>
          <div class="field">
            <span class="label">SUBJECT</span>
            <span class="colon">:</span>
            <span class="value">${escapeHtml(data.subject)}</span>
          </div>
        </div>

        <div class="bottom-rule"></div>

        <!-- Body -->
        <div class="body-content">
          ${data.body ? data.body.replace(/\n/g, '<br/>') : '<p>&nbsp;</p>'}
        </div>

        <!-- Sign-off: signatory name, org unit (bold underlined), then rhc/initials of drafter -->
        <div class="signature">
          <div class="signatory-name">${escapeHtml(data.signatureName)}</div>
          <div class="org-unit">${escapeHtml(data.signatureTitle)}</div>
          ${data.draftedByInitials ? `<div class="drafted-by">rhc/${escapeHtml(data.draftedByInitials)}</div>` : ''}
        </div>

        <!-- Footer -->
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

// Helper function to escape HTML special characters
function escapeHtml(text: string): string {
  if (!text) return '';
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

// For backward compatibility with existing code
export function getMemoTemplate(data: MemoData): string {
  return getMemoHTML(data);
}