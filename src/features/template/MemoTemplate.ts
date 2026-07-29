export interface MemoData {
  to: string;
  from: string;
  ref: string;
  date: string;
  subject: string;
  body: string; // Accepts raw plain text OR HTML string (including <table>)
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

/**
 * Safely formats the memo body.
 * If rawBody already contains HTML tables or tags, it keeps them intact.
 * If it is plain text, it converts line breaks to <br/>.
 */
function formatBodyHtml(rawBody: string): string {
  if (!rawBody || !rawBody.trim()) return "<p>&nbsp;</p>";

  const isHtml = /<[a-z][\s\S]*>/i.test(rawBody);

  if (isHtml) {
    return rawBody;
  }

  return rawBody
    .split(/\n\n+/)
    .map((p) => `<p>${escapeHtml(p.trim()).replace(/\n/g, "<br/>")}</p>`)
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
    { label: "CC", value: "" },
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
    @page {
      size: A4;
      margin: 15mm 15mm 32mm 15mm; /* 32mm bottom margin leaves reserved space for fixed footer */
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: Tahoma, Geneva, Verdana, sans-serif; 
      color: #000; 
      background: #fff; 
    }
    .page { 
      width: 100%; 
      max-width: 794px; 
      margin: 0 auto; 
      padding-bottom: 110px; /* Reserves clear clearance above fixed footer */
      position: relative; 
    }
    .header { text-align: center; margin-bottom: 12px; }
    .header img { height: 70px; width: auto; display: inline-block; }
    
    .title-block { text-align: center; margin: 14px 0 16px; font-family: Arial, Helvetica, sans-serif; }
    .title-block .office-title { font-size: 16px; font-weight: bold; text-transform: uppercase; line-height: 1.2; }
    .title-block .memo-title { font-size: 14px; font-weight: bold; text-transform: uppercase; line-height: 1.2; margin-top: 3px; }
    
    .top-rule { border-top: 2.5px solid #000; margin-bottom: 8px; }
    .fields { margin: 6px 0 0; }
    
    .field { display: flex; font-size: 11pt; font-weight: bold; line-height: 1.6; font-family: Tahoma, Geneva, Verdana, sans-serif; }
    .field .label { width: 100px; flex-shrink: 0; text-transform: uppercase; }
    .field .colon { width: 20px; flex-shrink: 0; }
    .field .value { flex: 1; text-transform: uppercase; }
    
    .bottom-rule { border-top: 2.5px solid #000; margin: 10px 0 16px; }
    
    .body-content { 
      margin: 0 0 16px; 
      font-size: 11pt; 
      line-height: 1.45; 
      text-align: justify; 
      font-family: Tahoma, Geneva, Verdana, sans-serif;
    }
    .body-content p { margin-bottom: 8px; }
    
    /* Styled Table Support */
    .body-content table { 
      width: 100%; 
      border-collapse: collapse; 
      margin: 12px 0; 
      font-size: 10.5pt; 
      page-break-inside: avoid; 
      break-inside: avoid; 
    }
    .body-content table th, .body-content table td { 
      border: 1px solid #333; 
      padding: 6px 10px; 
      text-align: left; 
      vertical-align: top; 
    }
    .body-content table th { 
      background: #f0ede4; 
      font-weight: bold; 
      text-transform: uppercase; 
      font-size: 9.5pt; 
    }

    .signature-section {
      margin-top: 12px;
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

    .signature {
      font-size: 11pt;
      font-weight: bold;
      text-align: left;
      margin-top: 45px;
      page-break-inside: avoid;
      break-inside: avoid;
      font-family: Tahoma, Geneva, Verdana, sans-serif;
    }
    .signature .signatory-name { text-transform: uppercase; margin-bottom: 2px; }
    .signature .org-unit { text-transform: uppercase; }
    
    .signature .enclosure { font-weight: normal; font-size: 11pt; margin-top: 6px; }
    
    .signature .drafted-by { 
      font-weight: normal; 
      font-style: italic; 
      text-decoration: underline; 
      text-transform: lowercase; 
      margin-top: 4px; 
      font-size: 8pt; 
      color: #000; 
    }

    /* Fixed Footer Setup to prevent overlapping and unwanted page pushes */
    .footer { 
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      border-top: 1px solid #999; 
      padding-top: 6px; 
      background: #fff;
      page-break-inside: avoid;
    }
    .footer-top { display: flex; align-items: center; justify-content: space-between; gap: 14px; }
    .footer-emblem { flex: 0 0 50px; }
    .footer-emblem img { width: 50px; height: 50px; display: block; object-fit: contain; }
    .footer-text { flex: 1; text-align: right; font-size: 8.5pt; color: #1a1a1a; }
    .footer-text p { margin: 1px 0; line-height: 1.3; }
    .footer-tagline { text-align: right; font-size: 9.5pt; font-weight: bold; color: #1E4620; margin-top: 4px; }
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