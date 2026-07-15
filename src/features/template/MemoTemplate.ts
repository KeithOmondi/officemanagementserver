// src/templates/MemoTemplate.ts

export interface MemoData {
  to: string;
  from: string; // department/office name (e.g., "HIGH COURT SUPPORT OFFICE")
  ref: string;
  date: string;
  subject: string;
  body: string;
  signatureName: string; // actual person's name (e.g., "Keith Dennis")
  signatureTitle: string; // person's title (e.g., "Registrar, High Court")
  draftedByInitials?: string;
  logoUrl?: string;
  footerEmblemUrl?: string;
  footerAddress?: string;
  footerContact?: string;
  footerTagline?: string;
}

const DEFAULTS = {
  logoUrl:
    "https://res.cloudinary.com/do0yflasl/image/upload/v1781759596/JOB_LOGO_ubls4m.jpg",
  footerEmblemUrl:
    "https://res.cloudinary.com/do0yflasl/image/upload/v1782893389/footer-emblem_n0ncm9.jpg",
  footerAddress:
    "Milimani Law Courts | 3rd Floor, Chamber 337 | P.O. Box 30041-00100 | Nairobi",
  footerContact:
    "Tel. +254 0730 181478 | registrarhighcourt@court.go.ke | www.judiciary.go.ke",
  footerTagline: "Justice Be Our Shield and Defender",
};

function escapeHtml(text: string): string {
  if (!text) return "";
  const replacements: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (ch) => replacements[ch]);
}

export function getMemoHTML(data: MemoData): string {
  const {
    to,
    from,
    ref,
    date,
    subject,
    body,
    signatureName,
    signatureTitle,
    draftedByInitials,
    logoUrl = DEFAULTS.logoUrl,
    footerEmblemUrl = DEFAULTS.footerEmblemUrl,
    footerAddress = DEFAULTS.footerAddress,
    footerContact = DEFAULTS.footerContact,
    footerTagline = DEFAULTS.footerTagline,
  } = data;

  const escaped = (value: string) => escapeHtml(value);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>MEMO</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #000; background: #fff; }
    .page { max-width: 794px; min-height: 1123px; margin: 0 auto; padding: 50px 60px 170px; position: relative; }
    .header { text-align: center; margin-bottom: 20px; }
    .header img { height: 78px; width: auto; display: inline-block; }
    .title-block { text-align: center; margin: 18px 0 22px; }
    .title-block h1 { font-size: 19px; font-weight: bold; text-transform: uppercase; line-height: 1.4; }
    .top-rule { border-top: 2.5px solid #000; margin-bottom: 10px; }
    .fields { margin: 10px 0 0; }
    .field { display: flex; font-size: 13.5px; font-weight: bold; line-height: 2; }
    .field .label { width: 95px; flex-shrink: 0; text-transform: uppercase; }
    .field .colon { width: 20px; flex-shrink: 0; }
    .field .value { flex: 1; }
    .bottom-rule { border-top: 2.5px solid #000; margin: 12px 0 40px; }
    .body-content { margin: 0 0 40px; font-size: 13.5px; line-height: 1.8; text-align: justify; min-height: 260px; }
    .body-content p { margin-bottom: 10px; }
    .body-content table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 12.5px; page-break-inside: avoid; break-inside: avoid; }
    .body-content table th, .body-content table td { border: 1px solid #333; padding: 6px 10px; text-align: left; vertical-align: top; }
    .body-content table th { background: #f0ede4; font-weight: bold; text-transform: uppercase; font-size: 11px; }
    .signature { margin-top: 40px; font-size: 13.5px; page-break-inside: avoid; break-inside: avoid; }
    .signature .signatory-name { font-weight: bold; text-transform: uppercase; margin-bottom: 4px; }
    .signature .org-unit { font-weight: bold; text-decoration: underline; text-transform: uppercase; }
    .signature .drafted-by { font-weight: normal; text-transform: lowercase; margin-top: 4px; font-size: 12px; color: #333; }
    .footer { position: fixed; bottom: 30px; left: 60px; right: 60px; border-top: 1px solid #999; padding-top: 14px; }
    .footer-top { display: flex; align-items: center; gap: 18px; }
    .footer-emblem { flex: 0 0 70px; }
    .footer-emblem img { width: 70px; height: 70px; display: block; object-fit: contain; }
    .footer-text { flex: 1; text-align: right; font-size: 11px; color: #1a1a1a; }
    .footer-text p { margin: 2px 0; line-height: 1.5; }
    .footer-tagline { text-align: right; font-size: 12px; font-weight: bold; color: #1E4620; margin-top: 8px; }
    @media (max-width: 600px) {
      .page { padding: 30px 20px 170px; }
      .field .label { width: 70px; }
      .footer { left: 20px; right: 20px; }
      .footer-top { flex-direction: column; text-align: center; gap: 10px; }
      .footer-text, .footer-tagline { text-align: center; }
    }
  </style>
</head>
<body>
<div class="page">
  <div class="header">
    <img src="${escaped(logoUrl)}" alt="Republic of Kenya / Judiciary Crest" />
  </div>

  <div class="title-block">
    <h1>OFFICE OF THE REGISTRAR HIGH COURT<br/>INTERNAL MEMO</h1>
  </div>

  <div class="top-rule"></div>

  <div class="fields">
    <div class="field"><span class="label">TO</span><span class="colon">:</span><span class="value">${escaped(to)}</span></div>
    <div class="field"><span class="label">FROM</span><span class="colon">:</span><span class="value">${escaped(from)}</span></div>
    <div class="field"><span class="label">REF</span><span class="colon">:</span><span class="value">${escaped(ref)}</span></div>
    <div class="field"><span class="label">DATE</span><span class="colon">:</span><span class="value">${escaped(date)}</span></div>
    <div class="field"><span class="label">SUBJECT</span><span class="colon">:</span><span class="value">${escaped(subject)}</span></div>
  </div>

  <div class="bottom-rule"></div>

  <div class="body-content">
    ${body ? body.replace(/\n/g, "<br/>") : "<p>&nbsp;</p>"}
  </div>

  <div class="signature">
    <div class="signatory-name">${escaped(signatureName || from || "")}</div>
    <div class="org-unit">${escaped(signatureTitle || "Registrar, High Court")}</div>
    ${draftedByInitials ? `<div class="drafted-by">rhc/${escaped(draftedByInitials)}</div>` : ""}
  </div>

  <div class="footer">
    <div class="footer-top">
      <div class="footer-emblem">
        <img src="${escaped(footerEmblemUrl)}" alt="Social Transformation Emblem" />
      </div>
      <div class="footer-text">
        <p>${escaped(footerAddress)}</p>
        <p>${escaped(footerContact)}</p>
      </div>
    </div>
    <div class="footer-tagline">${escaped(footerTagline)}</div>
  </div>
</div>
</body>
</html>`;
}

// Convenience export (same as getMemoHTML)
export const getMemoTemplate = getMemoHTML;
