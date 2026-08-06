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
  cc?: string; // Added CC field
  attachments?: Array<{ name: string; url: string }>; // Added attachments support
  logoUrl?: string;
  footerEmblemUrl?: string;
  footerAddress?: string;
  footerContact?: string;
  footerTagline?: string;
  
  // Simple control: User decides which field appears first
  fromFirst?: boolean; // true = FROM first, false = TO first (default: false)
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
 * Safely formats the memo body with enhanced table support.
 * If rawBody already contains HTML tables or tags, it keeps them intact.
 * If it is plain text, it converts line breaks to <br/>.
 */
function formatBodyHtml(rawBody: string): string {
  if (!rawBody || !rawBody.trim()) return "<p>&nbsp;</p>";

  // Check if it's HTML content
  const isHtml = /<[a-z][\s\S]*>/i.test(rawBody);

  if (isHtml) {
    let html = rawBody;
    
    // Add responsive table wrapper for better display
    html = html.replace(/<table/g, '<div class="table-wrapper"><table');
    html = html.replace(/<\/table>/g, '</table></div>');
    
    return html;
  }

  // Plain text formatting with paragraph detection
  return rawBody
    .split(/\n\n+/) // Split by double line breaks for paragraphs
    .map((p) => {
      const trimmed = p.trim();
      if (!trimmed) return '';
      
      // Check if this paragraph looks like a table (contains pipe separators or tabs)
      if (trimmed.includes('|') && trimmed.includes('\n')) {
        return convertPipeTableToHtml(trimmed);
      }
      
      return `<p>${escapeHtml(trimmed).replace(/\n/g, "<br/>")}</p>`;
    })
    .join("");
}

/**
 * Converts pipe-separated tables to HTML tables
 */
function convertPipeTableToHtml(tableText: string): string {
  const lines = tableText.split('\n').filter(line => line.trim());
  if (lines.length < 2) return `<p>${escapeHtml(tableText)}</p>`;
  
  let html = '<div class="table-wrapper"><table>';
  let isHeader = true;
  
  for (const line of lines) {
    if (/^\|[\s:-]+\|$/.test(line.trim())) continue;
    
    const cells = line.split('|')
      .map(cell => cell.trim())
      .filter(cell => cell !== '');
    
    if (cells.length === 0) continue;
    
    if (isHeader) {
      html += '<thead><tr>';
      cells.forEach(cell => {
        html += `<th>${escapeHtml(cell)}</th>`;
      });
      html += '</tr></thead><tbody>';
      isHeader = false;
    } else {
      html += '<tr>';
      cells.forEach(cell => {
        html += `<td>${escapeHtml(cell)}</td>`;
      });
      html += '</tr>';
    }
  }
  
  html += '</tbody></table></div>';
  return html;
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
    cc,
    attachments = [],
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
    { label: "CC", value: cc || "" },
    { label: "REF", value: ref },
    { label: "DATE", value: date },
    { label: "SUBJECT", value: subject },
  ];

  const filteredFields = fields.filter(f => f.label !== "CC" || f.value);

  const orderedFields = fromFirst
    ? [filteredFields[1], filteredFields[0], ...filteredFields.slice(2)]
    : filteredFields;

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

  const attachmentsHtml = attachments.length > 0 ? `
    <div class="attachments-section">
      <div class="attachments-title">Attachments:</div>
      <ul class="attachments-list">
        ${attachments.map(att => `
          <li>
            <a href="${escaped(att.url)}" target="_blank" rel="noopener noreferrer">
              <svg class="attachment-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              ${escaped(att.name)}
            </a>
          </li>
        `).join('')}
      </ul>
    </div>
  ` : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>MEMO</title>
  <style>
    @page {
      size: A4;
      margin: 15mm 15mm 32mm 15mm;
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
      padding-bottom: 110px;
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
    
    /* Enhanced Table Support */
    .table-wrapper {
      overflow-x: auto;
      margin: 12px 0;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .body-content table { 
      width: 100%; 
      border-collapse: collapse; 
      font-size: 10.5pt; 
      page-break-inside: avoid; 
      break-inside: avoid; 
    }
    .body-content table th, 
    .body-content table td { 
      border: 1px solid #333; 
      padding: 8px 12px; 
      text-align: left; 
      vertical-align: top; 
    }
    .body-content table th { 
      background: #f0ede4; 
      font-weight: bold; 
      text-transform: uppercase; 
      font-size: 9.5pt; 
      color: #1a1a1a;
    }
    .body-content table tr:nth-child(even) {
      background-color: #f9f9f9;
    }
    .body-content table tr:hover {
      background-color: #f5f3eb;
    }
    
    .body-content table caption {
      font-weight: bold;
      margin-bottom: 6px;
      text-align: left;
      font-size: 10.5pt;
    }

    /* Attachments Styles */
    .attachments-section {
      margin: 8px 0 12px 0;
      font-family: Tahoma, Geneva, Verdana, sans-serif;
    }
    .attachments-title {
      font-size: 10.5pt;
      font-weight: bold;
      margin-bottom: 4px;
      color: #333;
    }
    .attachments-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .attachments-list li {
      margin: 2px 0;
      padding: 2px 0;
    }
    .attachments-list a {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: #1E4620;
      text-decoration: none;
      font-size: 10pt;
      font-weight: normal;
      border-bottom: 1px dashed #c9a84c;
      padding-bottom: 1px;
    }
    .attachments-list a:hover {
      color: #c9a84c;
      border-bottom-color: #1E4620;
    }
    .attachment-icon {
      width: 14px;
      height: 14px;
      flex-shrink: 0;
      color: #c9a84c;
    }

    /* Signature Section - Reserved Box for Stamper (Mimicking Letter structure) */
    .signature-section {
      margin-top: 8px;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      font-family: Tahoma, Geneva, Verdana, sans-serif;
    }

    .signature-anchor {
      display: block;
      width: 220px;
      height: 65px;
      margin-top: 6px;
      margin-bottom: 4px;
      font-size: 1pt;
      color: transparent;
      line-height: 1;
      user-select: none;
      overflow: hidden;
    }

    /* Styling if stamp injects an <img> tag into .signature-anchor */
    .signature-anchor img,
    .signature-section img {
      height: 60px !important;
      width: auto !important;
      max-width: 220px;
      object-fit: contain;
      display: block;
    }

    .signature {
      margin-top: 0;
    }

    .signature .name {
      font-weight: bold;
      font-size: 11pt;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    .signature .title {
      font-weight: bold;
      font-size: 11pt;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      margin-top: 1px;
    }
    
    .signature .enclosure { 
      font-weight: normal; 
      font-size: 11pt; 
      margin-top: 6px; 
    }
    
    .signature .drafted-by { 
      font-weight: normal; 
      font-style: italic; 
      text-decoration: underline; 
      text-transform: lowercase; 
      margin-top: 4px; 
      font-size: 8pt; 
      color: #000; 
    }

    /* Footer Styles */
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

    /* Print Styles */
    @media print {
      body { background: #fff; }
      .page { max-width: 100%; }
      .table-wrapper { overflow-x: visible; }
      .body-content table { page-break-inside: avoid; }
      .body-content table tr { page-break-inside: avoid; }
      .attachments-list a { 
        color: #1E4620 !important;
        border-bottom: 1px dashed #c9a84c !important;
      }
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

  ${attachmentsHtml}

  <div class="signature-section">
    <div class="signature-anchor">${SIGNATURE_ANCHOR_TEXT}</div>

    <div class="signature">
      <div class="name">${escaped(signatureName || from || "")}</div>
      <div class="title">${escaped(signatureTitle || "REGISTRAR HIGH COURT")}</div>
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