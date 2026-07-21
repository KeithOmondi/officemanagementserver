export interface MemoData {
  to: string;
  from: string;
  ref: string;
  date: string;
  subject: string;
  body: string;
  signatureName: string;
  signatureTitle: string;
  draftedByInitials?: string;
  enclosure?: string;
  logoUrl?: string;
  footerEmblemUrl?: string;
  footerAddress?: string;
  footerContact?: string;
  footerTagline?: string;
  fromFirst?: boolean;
}

export const SIGNATURE_ANCHOR_TEXT = 'RHC-SIGNATURE-ANCHOR';

const DEFAULTS = {
  logoUrl:
    "https://res.cloudinary.com/do0yflasl/image/upload/v1784363826/ORHC_L_crclut.jpg",
  footerEmblemUrl:
    "https://res.cloudinary.com/do0yflasl/image/upload/v1784364354/ORHC_EMBLEM_wzmp94.jpg",
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

function formatBodyHtml(rawBody: string): string {
  if (!rawBody || !rawBody.trim()) return "<p>&nbsp;</p>";

  const parts = rawBody.split(/(<table[\s\S]*?<\/table>)/gi);

  return parts
    .map((part) => {
      if (/^<table[\s\S]*<\/table>$/i.test(part.trim())) {
        return part.replace(/>\s*\n\s*</g, "><").trim();
      }
      return part.replace(/\n/g, "<br/>");
    })
    .join("");
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
    enclosure,
    logoUrl = DEFAULTS.logoUrl,
    footerEmblemUrl = DEFAULTS.footerEmblemUrl,
    footerAddress = DEFAULTS.footerAddress,
    footerContact = DEFAULTS.footerContact,
    footerTagline = DEFAULTS.footerTagline,
    fromFirst = false,
  } = data;

  const escaped = (value: string) => escapeHtml(value);

  const fields = [
    { label: "TO", value: to },
    { label: "FROM", value: from },
    { label: "CC", value: "" }, // Left flexible if needed
    { label: "REF", value: ref },
    { label: "DATE", value: date },
    { label: "SUBJECT", value: subject },
  ].filter((f) => f.label !== "CC" || f.value);

  const orderedFields = fromFirst
    ? [fields[1], fields[0], ...fields.slice(2)]
    : fields;

  const fieldsHtml = orderedFields
    .map(
      ({ label, value }) => `
    <div class="field">
      <span class="label">${label}</span>
      <span class="colon">:</span>
      <span class="value">${escaped(value)}</span>
    </div>`
    )
    .join("");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>MEMO</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: Tahoma, Geneva, Verdana, sans-serif; 
      color: #000; 
      background: #fff; 
    }
    .page { max-width: 794px; min-height: 1123px; margin: 0 auto; padding: 50px 60px 170px; position: relative; }
    .header { text-align: center; margin-bottom: 15px; }
    .header img { height: 78px; width: auto; display: inline-block; }
    
    /* Header Titles: Arial Bold 18 & 16 */
    .title-block { text-align: center; margin: 18px 0 22px; font-family: Arial, Helvetica, sans-serif; }
    .title-block .office-title { font-size: 18px; font-weight: bold; text-transform: uppercase; line-height: 1.3; }
    .title-block .memo-title { font-size: 16px; font-weight: bold; text-transform: uppercase; line-height: 1.3; margin-top: 4px; }
    
    .top-rule { border-top: 2.5px solid #000; margin-bottom: 10px; }
    .fields { margin: 10px 0 0; }
    
    /* Fields: Tahoma Bold 12pt (16px) */
    .field { display: flex; font-size: 12pt; font-weight: bold; line-height: 2; font-family: Tahoma, Geneva, Verdana, sans-serif; }
    .field .label { width: 110px; flex-shrink: 0; text-transform: uppercase; }
    .field .colon { width: 25px; flex-shrink: 0; }
    .field .value { flex: 1; text-transform: uppercase; }
    
    .bottom-rule { border-top: 2.5px solid #000; margin: 12px 0 30px; }
    
    /* Body: Tahoma Bold 12pt (16px) */
    .body-content { 
      margin: 0 0 30px; 
      font-size: 12pt; 
      font-weight: bold; 
      line-height: 1.8; 
      text-align: justify; 
      min-height: 120px; 
      font-family: Tahoma, Geneva, Verdana, sans-serif;
    }
    .body-content p { margin-bottom: 12px; }
    .body-content table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 11pt; page-break-inside: avoid; break-inside: avoid; }
    .body-content table th, .body-content table td { border: 1px solid #333; padding: 6px 10px; text-align: left; vertical-align: top; }
    .body-content table th { background: #f0ede4; font-weight: bold; text-transform: uppercase; font-size: 10pt; }

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
    }

    /* Signature: Tahoma Bold 12pt (16px) */
    .signature {
      font-size: 12pt;
      font-weight: bold;
      text-align: left;
      margin-top: 45px;
      page-break-inside: avoid;
      break-inside: avoid;
      font-family: Tahoma, Geneva, Verdana, sans-serif;
    }
    .signature .signatory-name { text-transform: uppercase; margin-bottom: 2px; }
    .signature .org-unit { text-transform: uppercase; }
    
    /* Enclosure: Tahoma 12pt */
    .signature .enclosure { font-weight: normal; font-size: 12pt; margin-top: 8px; }
    
    /* Drafted By: Tahoma 6pt Italic Underline */
    .signature .drafted-by { 
      font-weight: normal; 
      font-style: italic; 
      text-decoration: underline; 
      text-transform: lowercase; 
      margin-top: 6px; 
      font-size: 6pt; 
      color: #000; 
    }

    .footer { position: fixed; bottom: 30px; left: 60px; right: 60px; border-top: 1px solid #999; padding-top: 14px; }
    .footer-top { display: flex; align-items: center; gap: 18px; }
    .footer-emblem { flex: 0 0 70px; }
    .footer-emblem img { width: 70px; height: 70px; display: block; object-fit: contain; }
    .footer-text { flex: 1; text-align: right; font-size: 10pt; color: #1a1a1a; }
    .footer-text p { margin: 2px 0; line-height: 1.5; }
    .footer-tagline { text-align: right; font-size: 11pt; font-weight: bold; color: #1E4620; margin-top: 8px; }

    @media (max-width: 600px) {
      .page { padding: 30px 20px 170px; }
      .field .label { width: 80px; }
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
    <div class="office-title">OFFICE OF THE REGISTRAR HIGH COURT</div>
    <div class="memo-title">INTERNAL MEMO</div>
  </div>

  <div class="top-rule"></div>

  <div class="fields">
    ${fieldsHtml}
  </div>

  <div class="bottom-rule"></div>

  <div class="body-content">
    ${formatBodyHtml(body)}
  </div>

  <div class="signature-section">
    <div class="signature-anchor" aria-hidden="true">${SIGNATURE_ANCHOR_TEXT}</div>

    <div class="signature">
      <div class="signatory-name">${escaped(signatureName || from || "")}</div>
      <div class="org-unit">${escaped(signatureTitle || "REGISTRAR, HIGH COURT")}</div>
      ${enclosure ? `<div class="enclosure">${escaped(enclosure)}</div>` : ""}
      ${draftedByInitials ? `<div class="drafted-by">rhc/${escaped(draftedByInitials)}</div>` : ""}
    </div>
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

export const getMemoTemplate = getMemoHTML;