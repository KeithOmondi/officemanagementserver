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
          padding: 50px 60px 40px 60px;
          color: #000000;
          background: white;
        }

        .page {
          max-width: 794px;
          margin: 0 auto;
          min-height: 1123px;
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

        /* Sign-off — bold, underlined organization/unit name only */
        .signature {
          margin-top: 40px;
          font-size: 13.5px;
          font-weight: bold;
          text-decoration: underline;
          text-transform: uppercase;
        }

        /* Footer */
        .footer {
          position: absolute;
          bottom: 30px;
          left: 0;
          right: 0;
          border-top: 1px solid #999;
          padding-top: 10px;
        }

        .footer-top {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .footer-emblem {
          flex: 0 0 44px;
        }

        .footer-emblem img {
          width: 44px;
          height: 44px;
          display: block;
        }

        .footer-text {
          flex: 1;
          text-align: right;
          font-size: 9.5px;
          color: #1a1a1a;
        }

        .footer-text p {
          margin: 1px 0;
          line-height: 1.5;
        }

        .footer-tagline {
          text-align: right;
          font-size: 10px;
          font-weight: bold;
          margin-top: 6px;
        }

        /* Print Styles */
        @media print {
          body { padding: 40px 50px; }
          .footer { position: static; margin-top: 60px; }
        }

        /* Responsive */
        @media (max-width: 600px) {
          body { padding: 30px 20px; }
          .field { flex-direction: row; }
          .field .label { width: 70px; }
          .footer-top { flex-direction: column; text-align: center; gap: 8px; }
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

        <!-- Sign-off: bold underlined unit/org name only, no title/contact block -->
        <div class="signature">
          ${escapeHtml(data.signatureName)}
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