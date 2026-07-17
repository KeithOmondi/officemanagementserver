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
  draftedByInitials?: string;
  logoUrl?: string;
  footerEmblemUrl?: string;
  footerAddress?: string;
  footerContact?: string;
  footerTagline?: string;
  fromFirst?: boolean;
  // signaturePlacement is removed; placement is now automatic via the anchor
  // marker, matching LetterTemplate.ts. The old top/bottom/left/right
  // variants are gone — anchor-based detection in embedSignature.ts always
  // places the signature directly above the printed name/title block.
}

// This exact string is what embedSignature.ts looks for to locate the
// signature block reliably. It MUST stay in sync with SIGNATURE_ANCHOR_TEXT
// in src/utils/embedSignature.ts — the same constant LetterTemplate.ts uses.
export const SIGNATURE_ANCHOR_TEXT = 'RHC-SIGNATURE-ANCHOR';

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
    fromFirst = false,
  } = data;

  const escaped = (value: string) => escapeHtml(value);

  const fields = [
    { label: "TO", value: to },
    { label: "FROM", value: from },
    { label: "REF", value: ref },
    { label: "DATE", value: date },
    { label: "SUBJECT", value: subject },
  ];

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

    /* Signature section container - ensures proper spacing, mirrors LetterTemplate.ts */
    .signature-section {
      margin-top: 50px;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    /* Invisible marker painted immediately before the signature block so
       the PDF/e-sign pipeline can locate it unambiguously instead of
       pattern-matching visible text. See SIGNATURE_ANCHOR_TEXT above. */
    .signature-anchor {
      font-size: 1px;
      line-height: 1px;
      height: 1px;
      color: transparent;
      overflow: hidden;
      user-select: none;
    }

    /* Signature block - displayed right after the anchor. margin-top gives
       the embedded signature image (placed relative to the anchor above)
       clearance so it doesn't overlap the printed name/title text. */
    .signature {
      font-size: 13.5px;
      text-align: left;
      margin-top: 70px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
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
    ${fieldsHtml}
  </div>

  <div class="bottom-rule"></div>

  <div class="body-content">
    ${body ? body.replace(/\n/g, "<br/>") : "<p>&nbsp;</p>"}
  </div>

  <!-- Signature section with anchor marker -->
  <div class="signature-section">
    <!-- Explicit, unambiguous anchor for signature-placement detection -->
    <div class="signature-anchor" aria-hidden="true">${SIGNATURE_ANCHOR_TEXT}</div>

    <!-- Signature block – displayed immediately after the anchor -->
    <div class="signature">
      <div class="signatory-name">${escaped(signatureName || from || "")}</div>
      <div class="org-unit">${escaped(signatureTitle || "Registrar, High Court")}</div>
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