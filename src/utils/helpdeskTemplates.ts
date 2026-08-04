// src/utils/helpdeskTemplates.ts

import { sendMail } from "./sendMail";



// ─── Shared Logo & Constants ──────────────────────────────────────────────────

const LOGO_URL =
  "https://res.cloudinary.com/do0yflasl/image/upload/v1781759596/JOB_LOGO_ubls4m.jpg";

const HELPEDSK_HEADER = (title: string, subtitle: string) => `
  <tr>
    <td style="background-color:#1E4620;border-radius:12px 12px 0 0;padding:32px 40px 24px;" align="center">
      <img
        src="${LOGO_URL}"
        alt="Judiciary of Kenya"
        width="80"
        height="80"
        style="display:block;margin:0 auto 16px;border-radius:50%;border:3px solid rgba(255,255,255,0.20);object-fit:cover;"
      />
      <p style="margin:0 0 2px;font-size:10px;font-weight:600;letter-spacing:3px;color:rgba(255,255,255,0.55);text-transform:uppercase;">
        Republic of Kenya
      </p>
      <h1 style="margin:0;font-size:15px;font-weight:700;letter-spacing:1.5px;color:#ffffff;text-transform:uppercase;line-height:1.4;">
        Office of the Registrar
      </h1>
      <p style="margin:2px 0 0;font-size:13px;font-weight:500;letter-spacing:1px;color:rgba(255,255,255,0.75);text-transform:uppercase;">
        High Court
      </p>
      <div style="width:48px;height:2px;background:#C29B38;border-radius:1px;margin:18px auto 0;"></div>
      <p style="margin:12px 0 0;font-size:16px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">
        ${title}
      </p>
      <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.7);">
        ${subtitle}
      </p>
    </td>
  </tr>
`;

const HELPEDSK_FOOTER = `
  <tr>
    <td style="background-color:#1a2e1b;border-radius:0 0 12px 12px;padding:20px 40px;" align="center">
      <p style="margin:0 0 4px;font-size:11px;color:rgba(255,255,255,0.5);letter-spacing:0.5px;">
        Office of the Registrar — High Court of Kenya
      </p>
      <div style="width:32px;height:1px;background:rgba(255,255,255,0.15);margin:8px auto;"></div>
      <p style="margin:0;font-size:10px;color:rgba(255,255,255,0.3);">
        This is an automated notification. Please do not reply directly to this email.
      </p>
    </td>
  </tr>
`;

const HELPEDSK_STATUS_BADGE = (status: 'approved' | 'rejected' | 'changes_requested') => {
  const config = {
    approved: { bg: '#D4EDDA', color: '#155724', text: '✅ Approved' },
    rejected: { bg: '#F8D7DA', color: '#721C24', text: '❌ Rejected' },
    changes_requested: { bg: '#FFF3CD', color: '#856404', text: '🔄 Changes Requested' },
  };
  const style = config[status];
  return `
    <div style="background:${style.bg};border:1px solid ${style.color}40;border-radius:8px;padding:12px 16px;margin-bottom:24px;text-align:center;">
      <p style="margin:0;font-size:16px;font-weight:700;color:${style.color};">
        ${style.text}
      </p>
    </div>
  `;
};

// ─── Template: Document Approved ─────────────────────────────────────────────

interface HelpdeskApprovedOptions {
  to: string;
  requesterName: string;
  ref: string;
  subject: string;
  entityType: string;
  approvedBy: string;
  approvedAt: Date;
  comments?: string;
  documentUrl?: string;
}

export const sendHelpdeskApproved = async ({
  to,
  requesterName,
  ref,
  subject,
  entityType,
  approvedBy,
  approvedAt,
  comments,
  documentUrl,
}: HelpdeskApprovedOptions) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Document Approved</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f2f5;font-family:'Segoe UI',Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f0f2f5;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">

          ${HELPEDSK_HEADER('✅ Document Approved', 'Your document has been approved')}

          <!-- ── Body ── -->
          <tr>
            <td style="background-color:#ffffff;padding:36px 40px 32px;">

              <div style="text-align:center;margin-bottom:24px;">
                <div style="display:inline-block;background:#D4EDDA;border-radius:50%;width:64px;height:64px;line-height:64px;font-size:32px;color:#155724;">
                  ✓
                </div>
              </div>

              ${HELPEDSK_STATUS_BADGE('approved')}

              <p style="margin:0 0 4px;font-size:14px;color:#374151;line-height:1.6;">
                Dear <strong>${requesterName}</strong>,
              </p>
              <p style="margin:0 0 24px;font-size:14px;color:#374151;line-height:1.6;">
                Your document has been reviewed and <strong>approved</strong> by ${approvedBy}.
              </p>

              <!-- Document Details -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:24px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding:4px 0;font-size:13px;color:#475569;">
                          <strong style="color:#1E293B;">Reference:</strong>
                        </td>
                        <td style="padding:4px 0;font-size:13px;color:#1E293B;font-weight:500;">
                          ${ref}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:4px 0;font-size:13px;color:#475569;">
                          <strong style="color:#1E293B;">Subject:</strong>
                        </td>
                        <td style="padding:4px 0;font-size:13px;color:#1E293B;">
                          ${subject}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:4px 0;font-size:13px;color:#475569;">
                          <strong style="color:#1E293B;">Type:</strong>
                        </td>
                        <td style="padding:4px 0;font-size:13px;color:#1E293B;">
                          ${entityType}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:4px 0;font-size:13px;color:#475569;">
                          <strong style="color:#1E293B;">Approved By:</strong>
                        </td>
                        <td style="padding:4px 0;font-size:13px;color:#1E293B;">
                          ${approvedBy}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:4px 0;font-size:13px;color:#475569;">
                          <strong style="color:#1E293B;">Approved On:</strong>
                        </td>
                        <td style="padding:4px 0;font-size:13px;color:#1E293B;">
                          ${approvedAt.toLocaleString('en-KE', { 
                            day: '2-digit', 
                            month: 'short', 
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              ${comments ? `
              <div style="background:#F0FDF4;border:1px solid #86EFAC;border-radius:8px;padding:12px 16px;margin-bottom:24px;">
                <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#166534;">
                  📝 Comments from Approver:
                </p>
                <p style="margin:0;font-size:13px;color:#166534;line-height:1.6;">
                  ${comments}
                </p>
              </div>` : ''}

              ${documentUrl ? `
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
                <tr>
                  <td align="center">
                    <a href="${documentUrl}" 
                       style="display:inline-block;padding:12px 40px;background-color:#1E4620;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">
                      📄 View Document
                    </a>
                  </td>
                </tr>
              </table>` : ''}

              <p style="margin:0;font-size:12px;color:#9CA3AF;text-align:center;line-height:1.5;">
                Your document has been approved and is now available. You can view it in the system.
              </p>

            </td>
          </tr>

          ${HELPEDSK_FOOTER}

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;

  return await sendMail({ to, subject: `✅ Document Approved: ${ref}`, html });
};

// ─── Template: Document Rejected ─────────────────────────────────────────────

interface HelpdeskRejectedOptions {
  to: string;
  requesterName: string;
  ref: string;
  subject: string;
  entityType: string;
  rejectedBy: string;
  rejectedAt: Date;
  reason: string;
  comments?: string;
}

export const sendHelpdeskRejected = async ({
  to,
  requesterName,
  ref,
  subject,
  entityType,
  rejectedBy,
  rejectedAt,
  reason,
  comments,
}: HelpdeskRejectedOptions) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Document Rejected</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f2f5;font-family:'Segoe UI',Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f0f2f5;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">

          ${HELPEDSK_HEADER('❌ Document Rejected', 'Your document has been rejected')}

          <!-- ── Body ── -->
          <tr>
            <td style="background-color:#ffffff;padding:36px 40px 32px;">

              <div style="text-align:center;margin-bottom:24px;">
                <div style="display:inline-block;background:#F8D7DA;border-radius:50%;width:64px;height:64px;line-height:64px;font-size:32px;color:#721C24;">
                  ✕
                </div>
              </div>

              ${HELPEDSK_STATUS_BADGE('rejected')}

              <p style="margin:0 0 4px;font-size:14px;color:#374151;line-height:1.6;">
                Dear <strong>${requesterName}</strong>,
              </p>
              <p style="margin:0 0 24px;font-size:14px;color:#374151;line-height:1.6;">
                Your document has been reviewed and <strong>rejected</strong> by ${rejectedBy}.
              </p>

              <!-- Document Details -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:24px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding:4px 0;font-size:13px;color:#475569;">
                          <strong style="color:#1E293B;">Reference:</strong>
                        </td>
                        <td style="padding:4px 0;font-size:13px;color:#1E293B;font-weight:500;">
                          ${ref}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:4px 0;font-size:13px;color:#475569;">
                          <strong style="color:#1E293B;">Subject:</strong>
                        </td>
                        <td style="padding:4px 0;font-size:13px;color:#1E293B;">
                          ${subject}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:4px 0;font-size:13px;color:#475569;">
                          <strong style="color:#1E293B;">Type:</strong>
                        </td>
                        <td style="padding:4px 0;font-size:13px;color:#1E293B;">
                          ${entityType}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:4px 0;font-size:13px;color:#475569;">
                          <strong style="color:#1E293B;">Rejected By:</strong>
                        </td>
                        <td style="padding:4px 0;font-size:13px;color:#1E293B;">
                          ${rejectedBy}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Rejection Reason -->
              <div style="background:#FEF2F2;border:1px solid #FCA5A5;border-radius:8px;padding:12px 16px;margin-bottom:24px;">
                <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#991B1B;">
                  📝 Rejection Reason:
                </p>
                <p style="margin:0;font-size:13px;color:#991B1B;line-height:1.6;">
                  ${reason}
                </p>
              </div>

              ${comments ? `
              <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:12px 16px;margin-bottom:24px;">
                <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#475569;">
                  📝 Additional Comments:
                </p>
                <p style="margin:0;font-size:13px;color:#475569;line-height:1.6;">
                  ${comments}
                </p>
              </div>` : ''}

              <div style="background:#FFFBEB;border:1px solid #FCD34D;border-radius:8px;padding:12px 16px;margin-bottom:24px;">
                <p style="margin:0;font-size:12px;color:#92400E;line-height:1.5;">
                  <strong>📌 What to do next:</strong> You may revise your document based on the feedback above 
                  and resubmit it for approval. If you believe this rejection was in error, please contact the 
                  Help Desk team.
                </p>
              </div>

              <p style="margin:0;font-size:12px;color:#9CA3AF;text-align:center;line-height:1.5;">
                Your document has been rejected. Please review the feedback and make the necessary changes.
              </p>

            </td>
          </tr>

          ${HELPEDSK_FOOTER}

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;

  return await sendMail({ to, subject: `❌ Document Rejected: ${ref}`, html });
};

// ─── Template: Changes Requested ────────────────────────────────────────────

interface HelpdeskChangesRequestedOptions {
  to: string;
  requesterName: string;
  ref: string;
  subject: string;
  entityType: string;
  requestedBy: string;
  requestedAt: Date;
  changes: string[];
  comments?: string;
}

export const sendHelpdeskChangesRequested = async ({
  to,
  requesterName,
  ref,
  subject,
  entityType,
  requestedBy,
  requestedAt,
  changes,
  comments,
}: HelpdeskChangesRequestedOptions) => {
  const changesList = changes.map(c => `<li style="margin-bottom:6px;font-size:13px;color:#1E293B;line-height:1.6;">${c}</li>`).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Changes Requested</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f2f5;font-family:'Segoe UI',Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f0f2f5;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">

          ${HELPEDSK_HEADER('🔄 Changes Requested', 'Action required on your document')}

          <!-- ── Body ── -->
          <tr>
            <td style="background-color:#ffffff;padding:36px 40px 32px;">

              <div style="text-align:center;margin-bottom:24px;">
                <div style="display:inline-block;background:#FFF3CD;border-radius:50%;width:64px;height:64px;line-height:64px;font-size:32px;color:#856404;">
                  🔄
                </div>
              </div>

              ${HELPEDSK_STATUS_BADGE('changes_requested')}

              <p style="margin:0 0 4px;font-size:14px;color:#374151;line-height:1.6;">
                Dear <strong>${requesterName}</strong>,
              </p>
              <p style="margin:0 0 24px;font-size:14px;color:#374151;line-height:1.6;">
                Your document has been reviewed by <strong>${requestedBy}</strong> and requires changes before it can be approved.
              </p>

              <!-- Document Details -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:24px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding:4px 0;font-size:13px;color:#475569;">
                          <strong style="color:#1E293B;">Reference:</strong>
                        </td>
                        <td style="padding:4px 0;font-size:13px;color:#1E293B;font-weight:500;">
                          ${ref}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:4px 0;font-size:13px;color:#475569;">
                          <strong style="color:#1E293B;">Subject:</strong>
                        </td>
                        <td style="padding:4px 0;font-size:13px;color:#1E293B;">
                          ${subject}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:4px 0;font-size:13px;color:#475569;">
                          <strong style="color:#1E293B;">Type:</strong>
                        </td>
                        <td style="padding:4px 0;font-size:13px;color:#1E293B;">
                          ${entityType}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:4px 0;font-size:13px;color:#475569;">
                          <strong style="color:#1E293B;">Requested By:</strong>
                        </td>
                        <td style="padding:4px 0;font-size:13px;color:#1E293B;">
                          ${requestedBy}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Changes Required -->
              <div style="background:#FFFBEB;border:1px solid #FCD34D;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
                <p style="margin:0 0 12px;font-size:13px;font-weight:600;color:#92400E;">
                  📝 Changes Required:
                </p>
                <ul style="margin:0;padding-left:20px;">
                  ${changesList}
                </ul>
              </div>

              ${comments ? `
              <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:12px 16px;margin-bottom:24px;">
                <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#475569;">
                  📝 Additional Comments from Approver:
                </p>
                <p style="margin:0;font-size:13px;color:#475569;line-height:1.6;">
                  ${comments}
                </p>
              </div>` : ''}

              <div style="background:#EFF6FF;border:1px solid #93C5FD;border-radius:8px;padding:12px 16px;margin-bottom:24px;">
                <p style="margin:0;font-size:12px;color:#1E40AF;line-height:1.5;">
                  <strong>📌 What to do next:</strong> Please make the requested changes to your document and 
                  <strong>resubmit it for approval</strong>. Once resubmitted, it will be reviewed again.
                </p>
              </div>

              <p style="margin:0;font-size:12px;color:#9CA3AF;text-align:center;line-height:1.5;">
                Please address the requested changes and resubmit your document at your earliest convenience.
              </p>

            </td>
          </tr>

          ${HELPEDSK_FOOTER}

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;

  return await sendMail({ to, subject: `🔄 Changes Requested: ${ref}`, html });
};

// ─── Template: General Request Acknowledgement ──────────────────────────────

interface GeneralRequestAcknowledgementOptions {
  to: string;
  ticketNumber: string;
  judgeName: string;
  request: string;
  department?: string;
}

export const sendGeneralRequestAcknowledgement = async ({
  to,
  ticketNumber,
  judgeName,
  request,
  department = 'Help Desk',
}: GeneralRequestAcknowledgementOptions) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>General Request Acknowledgement</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f2f5;font-family:'Segoe UI',Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f0f2f5;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">

          ${HELPEDSK_HEADER('📋 Request Received', 'Your request has been received and is under review')}

          <!-- ── Body ── -->
          <tr>
            <td style="background-color:#ffffff;padding:36px 40px 32px;">

              <div style="text-align:center;margin-bottom:24px;">
                <div style="display:inline-block;background:#E8F5E9;border-radius:50%;width:64px;height:64px;line-height:64px;font-size:32px;color:#1E4620;">
                  ✓
                </div>
              </div>

              <!-- Ticket Number -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
                <tr>
                  <td align="center" style="background:linear-gradient(135deg,#f8fdf8 0%,#eef7ef 100%);border:1.5px solid #c6e0c8;border-radius:10px;padding:20px;">
                    <p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:3px;color:#1E4620;text-transform:uppercase;">
                      Ticket Number
                    </p>
                    <p style="margin:0;font-size:28px;font-weight:800;letter-spacing:4px;color:#1E4620;font-family:'Courier New',monospace;">
                      ${ticketNumber}
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Request Details -->
              <div style="background:#f9fafb;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
                <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">
                  Judge
                </p>
                <p style="margin:0 0 12px;font-size:15px;font-weight:500;color:#111827;">
                  ${judgeName}
                </p>
                <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">
                  Request
                </p>
                <p style="margin:0 0 12px;font-size:14px;color:#374151;line-height:1.6;">
                  ${request}
                </p>
                <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">
                  Department
                </p>
                <p style="margin:0;font-size:14px;color:#374151;">
                  ${department}
                </p>
              </div>

              <!-- Status -->
              <div style="background:#FFFBEB;border:1px solid #FCD34D;border-radius:8px;padding:12px 16px;margin-bottom:24px;">
                <p style="margin:0;font-size:13px;color:#92400E;line-height:1.5;text-align:center;">
                  <strong>Status:</strong> Pending Review
                </p>
              </div>

              <p style="margin:0;font-size:12px;color:#9CA3AF;text-align:center;line-height:1.5;">
                You will receive updates on this request via email.<br />
                Please keep your ticket number for reference.
              </p>

            </td>
          </tr>

          ${HELPEDSK_FOOTER}

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;

  return await sendMail({ to, subject: `📋 Request Received: ${ticketNumber}`, html });
};

// ─── Template: Super Admin Approval Notification ─────────────────────────────

interface SuperAdminApprovalNotificationOptions {
  to: string;
  superAdminName: string;
  requestType: string;
  requestTitle: string;
  requestId: string;
  submittedBy: string;
  submittedByDepartment: string;
  submittedAt: Date;
  details: string;
  priority: 'low' | 'normal' | 'urgent';
  additionalInfo?: Record<string, any>;
  documentUrl?: string;
}

export const sendSuperAdminApprovalNotification = async ({
  to,
  superAdminName,
  requestType,
  requestTitle,
  requestId,
  submittedBy,
  submittedByDepartment,
  submittedAt,
  details,
  priority = 'normal',
  additionalInfo,
  documentUrl,
}: SuperAdminApprovalNotificationOptions) => {
  const priorityColors = {
    urgent: { bg: '#FEE2E2', border: '#DC2626', text: '#991B1B', label: 'URGENT' },
    normal: { bg: '#FEF3C7', border: '#F59E0B', text: '#92400E', label: 'NORMAL' },
    low: { bg: '#E5E7EB', border: '#6B7280', text: '#374151', label: 'LOW' },
  };

  const priorityStyle = priorityColors[priority] || priorityColors.normal;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${requestType} Approval Request</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f2f5;font-family:'Segoe UI',Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f0f2f5;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">

          ${HELPEDSK_HEADER('📋 Approval Required', `${requestType} submitted for your review`)}

          <!-- ── Body ── -->
          <tr>
            <td style="background-color:#ffffff;padding:36px 40px 32px;">

              <!-- Priority Badge -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
                <tr>
                  <td align="center">
                    <span style="display:inline-block;padding:4px 16px;background-color:${priorityStyle.bg};border-radius:20px;border:1px solid ${priorityStyle.border};font-size:11px;font-weight:700;color:${priorityStyle.text};letter-spacing:1px;text-transform:uppercase;">
                      ⚡ ${priorityStyle.label} Priority
                    </span>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 4px;font-size:14px;color:#374151;line-height:1.6;">
                Dear <strong>${superAdminName}</strong>,
              </p>
              <p style="margin:0 0 24px;font-size:14px;color:#374151;line-height:1.6;">
                A ${requestType.toLowerCase()} has been submitted by the Help Desk team and is awaiting your approval.
                Please review the details below and take appropriate action.
              </p>

              <!-- Request Details -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:24px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding:4px 0;font-size:13px;color:#475569;">
                          <strong style="color:#1E293B;">Request Type:</strong>
                        </td>
                        <td style="padding:4px 0;font-size:13px;color:#1E293B;font-weight:500;">
                          ${requestType}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:4px 0;font-size:13px;color:#475569;">
                          <strong style="color:#1E293B;">Title / Activity:</strong>
                        </td>
                        <td style="padding:4px 0;font-size:13px;color:#1E293B;font-weight:500;">
                          ${requestTitle}
                        </td>
                      </tr>
                      ${additionalInfo?.venue ? `
                      <tr>
                        <td style="padding:4px 0;font-size:13px;color:#475569;">
                          <strong style="color:#1E293B;">Venue:</strong>
                        </td>
                        <td style="padding:4px 0;font-size:13px;color:#1E293B;">
                          ${additionalInfo.venue}
                        </td>
                      </tr>` : ''}
                      ${additionalInfo?.period ? `
                      <tr>
                        <td style="padding:4px 0;font-size:13px;color:#475569;">
                          <strong style="color:#1E293B;">Period:</strong>
                        </td>
                        <td style="padding:4px 0;font-size:13px;color:#1E293B;">
                          ${additionalInfo.period}
                        </td>
                      </tr>` : ''}
                      <tr>
                        <td style="padding:4px 0;font-size:13px;color:#475569;">
                          <strong style="color:#1E293B;">Submitted By:</strong>
                        </td>
                        <td style="padding:4px 0;font-size:13px;color:#1E293B;">
                          ${submittedBy} (${submittedByDepartment})
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:4px 0;font-size:13px;color:#475569;">
                          <strong style="color:#1E293B;">Date Submitted:</strong>
                        </td>
                        <td style="padding:4px 0;font-size:13px;color:#1E293B;">
                          ${submittedAt.toLocaleString('en-KE', { 
                            day: '2-digit', 
                            month: 'short', 
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Details -->
              <div style="background:#f9fafb;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
                <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#1E293B;">
                  Details:
                </p>
                <p style="margin:0;font-size:13px;color:#475569;line-height:1.6;white-space:pre-wrap;">
                  ${details}
                </p>
              </div>

              ${additionalInfo?.totalDsa ? `
              <div style="background:#F0FDF4;border:1px solid #86EFAC;border-radius:8px;padding:12px 16px;margin-bottom:24px;">
                <p style="margin:0;font-size:13px;color:#166534;text-align:center;">
                  <strong>Total DSA:</strong> KES ${additionalInfo.totalDsa.toLocaleString()} 
                  ${additionalInfo?.memberCount ? `• ${additionalInfo.memberCount} member(s) assigned` : ''}
                </p>
              </div>` : ''}

              ${documentUrl ? `
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
                <tr>
                  <td align="center">
                    <a href="${documentUrl}" 
                       style="display:inline-block;padding:12px 40px;background-color:#1E4620;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">
                      📄 Review Document
                    </a>
                  </td>
                </tr>
              </table>` : ''}

              <div style="background:#FFFBEB;border:1px solid #FCD34D;border-radius:8px;padding:12px 16px;margin-bottom:24px;">
                <p style="margin:0;font-size:12px;color:#92400E;line-height:1.5;">
                  <strong>📌 Required Action:</strong> Please review the request details, verify the information, 
                  and either approve or reject the request. You may also request additional information if needed.
                </p>
              </div>

              <p style="margin:0;font-size:12px;color:#9CA3AF;text-align:center;line-height:1.5;">
                This request will remain pending until you take action. Please respond at your earliest convenience.
              </p>

            </td>
          </tr>

          ${HELPEDSK_FOOTER}

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;

  return await sendMail({ to, subject: `[Action Required] ${requestType} Approval Request - ${requestTitle}`, html });
};