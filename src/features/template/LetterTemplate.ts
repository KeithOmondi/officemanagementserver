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

export function getLetterHTML(data: LetterData): string {
  // Combined Kenya Coat of Arms + Judiciary crest (single header image, as in the sample)
  const logoUrl = data.logoUrl || 'https://res.cloudinary.com/do0yflasl/image/upload/v1781759596/JOB_LOGO_ubls4m.jpg';

  // Small "Social Transformation" emblem used in the footer of the sample
  const footerEmblemUrl = data.footerEmblemUrl || 'https://res.cloudinary.com/do0yflasl/image/upload/v1782893389/footer-emblem_n0ncm9.jpg';

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

        /* All page spacing lives here, not on 'body'. Because of the global
           box-sizing: border-box rule above, this padding is now INCLUDED
           inside min-height: 1123px (A4 height at 96dpi) instead of being
           added on top of it. Previously the padding sat on 'body', outside
           '.page', so the true required height was 1123px + body's padding
           — taller than a single A4 page — which is what was spilling a
           blank page 2 into the PDF, independent of the footer fix below.
           The bottom padding is intentionally large (170px, not 40px) to
           reserve room for the fixed footer so body content never runs
           into it. */
        .page {
          max-width: 794px;
          min-height: 1123px;
          margin: 0 auto;
          padding: 50px 60px 170px 60px;
          position: relative;
        }

        /* Header Section */
        .header {
          display: flex;
          align-items: center;
          margin-bottom: 10px;
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

        /* Thin gold rule under the header, matching the judiciary branding */
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
        }

        /* Body Content */
        .body-content {
          margin: 0 0 40px 0;
          font-size: 13px;
          line-height: 1.8;
          text-align: justify;
          min-height: 340px;
        }

        .body-content .to-block {
          margin-bottom: 18px;
        }

        .body-content .to-block p {
          margin: 0;
          line-height: 1.5;
        }

        .body-content .subject-line {
          font-weight: bold;
          text-decoration: underline;
          margin: 18px 0;
        }

        .body-content p {
          margin-bottom: 10px;
        }

        /* Sign-off — bold name, bold underlined title, no closing line or rule */
        .signature {
          margin-top: 50px;
          font-size: 13px;
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

        /* CC and Enclosures */
        .cc-enclosures {
          margin-top: 30px;
          font-size: 12px;
          line-height: 1.6;
        }

        .cc-enclosures .label {
          font-weight: bold;
        }

        /* Footer — pinned to the bottom of the page.
           'position: fixed' is intentional: Chromium's print/PDF engine
           (which is what Puppeteer's page.pdf() uses) keeps fixed-position
           elements anchored to the same spot on every physical page, which
           is the standard way to get a footer glued to the bottom of a
           Puppeteer-generated PDF. Do NOT override this in @media print —
           that was the previous bug (see note below). */
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

        /* Print Styles
           IMPORTANT: an earlier version of this block reset '.footer' to
           'position: static; margin-top: 60px;', which — since Puppeteer
           renders with print media by default — pulled the footer back
           into normal document flow. That made it render immediately
           after the letter body instead of at the bottom of the page, and
           the extra height it added pushed the page past 1123px, which is
           why a near-empty second page was being generated. There is
           deliberately no @media print override at all now — re-adding
           padding here (as a previous version did via 'body { padding }')
           would just reintroduce the same double-padding overflow bug,
           since Puppeteer always renders in print mode.
        */

        /* Responsive (screen preview only — irrelevant to PDF output) */
        @media (max-width: 600px) {
          .page { padding: 30px 20px 170px 20px; }
          .header { flex-direction: column; text-align: center; }
          .logo-container { margin-right: 0; margin-bottom: 10px; }
          .ref-date { flex-direction: column; align-items: flex-start; gap: 5px; }
          .footer { left: 20px; right: 20px; }
          .footer-top { flex-direction: column; text-align: center; gap: 10px; }
          .footer-text, .footer-tagline { text-align: center; }
        }
      </style>
    </head>
    <body>
      <div class="page">
        <!-- Header: crest left, judiciary/office name stacked beside it -->
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

        <!-- Reference and Date -->
        <div class="ref-date">
          <span class="ref">Ref: ${escapeHtml(data.ref)}</span>
          <span class="date">${escapeHtml(data.date)}</span>
        </div>

        <!-- Body -->
        <div class="body-content">
          ${data.to ? `<div class="to-block"><p>${escapeHtml(data.to).replace(/\n/g, '<br/>')}</p></div>` : ''}
          ${data.subject ? `<div class="subject-line">RE: ${escapeHtml(data.subject)}</div>` : ''}
          ${data.body ? data.body.replace(/\n/g, '<br/>') : '<p>&nbsp;</p>'}
        </div>

        <!-- Sign-off: bold name, bold underlined title, no closing phrase or rule -->
        <div class="signature">
          <div class="name">${escapeHtml(data.sender)}</div>
          <div class="title">${escapeHtml(data.senderTitle || 'Registrar, High Court')}</div>
        </div>

        <!-- CC and Enclosures -->
        ${data.cc ? `
          <div class="cc-enclosures">
            <span class="label">CC:</span> ${escapeHtml(data.cc)}
          </div>
        ` : ''}
        ${data.enclosures ? `
          <div class="cc-enclosures">
            <span class="label">Enclosures:</span> ${escapeHtml(data.enclosures)}
          </div>
        ` : ''}

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
export function getLetterTemplate(data: LetterData): string {
  return getLetterHTML(data);
}