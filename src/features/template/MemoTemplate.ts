// src/templates/MemoTemplate.ts

export interface MemoData {
  to: string;
  from: string;        // This is the department/office name (e.g., "HIGH COURT SUPPORT OFFICE")
  ref: string;
  date: string;
  subject: string;
  body: string;
  signatureName: string;  // ✅ The actual person's name (e.g., "Keith Dennis")
  signatureTitle: string; // ✅ The person's title (e.g., "Registrar, High Court")
  draftedByInitials?: string;
  logoUrl?: string;
  footerEmblemUrl?: string;
  footerAddress?: string;
  footerContact?: string;
  footerTagline?: string;
}

export function getMemoHTML(data: MemoData): string {
  const logoUrl = data.logoUrl || 'https://res.cloudinary.com/do0yflasl/image/upload/v1781759596/JOB_LOGO_ubls4m.jpg';
  const footerEmblemUrl = data.footerEmblemUrl || 'https://res.cloudinary.com/do0yflasl/image/upload/v1782893389/footer-emblem_n0ncm9.jpg';

  // ✅ Default footer content - always visible
  const footerAddress = data.footerAddress || 'Milimani Law Courts | 3rd Floor, Chamber 337 | P.O. Box 30041-00100 | Nairobi';
  const footerContact = data.footerContact || 'Tel. +254 0730 181478 | registrarhighcourt@court.go.ke | www.judiciary.go.ke';
  const footerTagline = data.footerTagline || 'Justice Be Our Shield and Defender';

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

        .page {
          max-width: 794px;
          min-height: 1123px;
          margin: 0 auto;
          padding: 50px 60px 170px 60px;
          position: relative;
        }

        .header {
          text-align: center;
          margin-bottom: 20px;
        }

        .header img {
          height: 78px;
          width: auto;
          display: inline-block;
        }

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

        .top-rule {
          border-top: 2.5px solid #000000;
          margin-bottom: 10px;
        }

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

        /* ✅ Sign-off section - properly separated from FROM field */
        .signature {
          margin-top: 40px;
          font-size: 13.5px;
        }

        /* ✅ The actual person's name - bold, uppercase */
        .signature .signatory-name {
          font-weight: bold;
          text-transform: uppercase;
          margin-bottom: 4px;
        }

        /* ✅ The person's title - bold, underlined, uppercase */
        .signature .org-unit {
          font-weight: bold;
          text-decoration: underline;
          text-transform: uppercase;
        }

        .signature .drafted-by {
          font-weight: normal;
          text-transform: lowercase;
          margin-top: 4px;
          font-size: 12px;
          color: #333333;
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
        <!-- Header -->
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

        <!-- ✅ Sign-off: Uses signatureName (person) and signatureTitle (their title) -->
        <div class="signature">
          <div class="signatory-name">${escapeHtml(data.signatureName || data.from || '')}</div>
          <div class="org-unit">${escapeHtml(data.signatureTitle || 'Registrar, High Court')}</div>
          ${data.draftedByInitials ? `<div class="drafted-by">rhc/${escapeHtml(data.draftedByInitials)}</div>` : ''}
        </div>

        <!-- ✅ Footer with default content -->
        <div class="footer">
          <div class="footer-top">
            <div class="footer-emblem">
              <img src="${footerEmblemUrl}" alt="Social Transformation Emblem" />
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

export function getMemoTemplate(data: MemoData): string {
  return getMemoHTML(data);
}