// src/utils/emailTemplate.ts

import { sendMail } from "./sendMail";

export interface DocumentNotificationData {
  documentTitle: string;
  documentId: string;
  referenceNo?: string | null;
  markedBy: string;
  markedByDepartment: string;
  assignedTo: string;
  instructions?: string | null;
  priority?: 'low' | 'normal' | 'urgent';
  actionType: 'marked_to_department' | 'assigned_to_user' | 'sent_to_super_admin';
  createdAt: Date;
  documentType: string;
  departmentName: string;
  superAdminName?: string;
}

export const emailTemplates = {
  /**
   * Email template for when a document is marked to a department
   */
  documentMarkedToDepartment: (data: DocumentNotificationData): string => {
    const priorityColor = data.priority === 'urgent' ? '#DC2626' : 
                         data.priority === 'normal' ? '#F59E0B' : '#6B7280';
    const priorityLabel = data.priority ? data.priority.toUpperCase() : 'NORMAL';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Document Marked for Action</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f2f5;font-family:'Segoe UI',Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f0f2f5;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;">

          <!-- Header -->
          <tr>
            <td style="background-color:#1E4620;border-radius:12px 12px 0 0;padding:32px 40px 24px;" align="center">
              <h1 style="margin:0;font-size:20px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">
                📄 Document Assigned
              </h1>
              <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.7);">
                Action Required in the Judiciary Document Management System
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background-color:#ffffff;padding:36px 40px 32px;">
              
              <!-- Priority Badge -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
                <tr>
                  <td align="center">
                    <span style="display:inline-block;padding:4px 16px;background-color:${priorityColor}20;border-radius:20px;border:1px solid ${priorityColor}40;font-size:11px;font-weight:700;color:${priorityColor};letter-spacing:1px;text-transform:uppercase;">
                      ⚡ ${priorityLabel} Priority
                    </span>
                  </td>
                </tr>
              </table>

              <!-- Greeting -->
              <p style="margin:0 0 4px;font-size:14px;color:#374151;line-height:1.6;">
                Dear <strong>${data.assignedTo}</strong>,
              </p>
              <p style="margin:0 0 20px;font-size:14px;color:#374151;line-height:1.6;">
                A document has been marked to your department for action. Please review the details below and take the necessary steps.
              </p>

              <!-- Document Details -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:24px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding:4px 0;font-size:13px;color:#475569;">
                          <strong style="color:#1E293B;">Title:</strong>
                        </td>
                        <td style="padding:4px 0;font-size:13px;color:#1E293B;font-weight:500;">
                          ${data.documentTitle}
                        </td>
                      </tr>
                      ${data.referenceNo ? `
                      <tr>
                        <td style="padding:4px 0;font-size:13px;color:#475569;">
                          <strong style="color:#1E293B;">Reference No:</strong>
                        </td>
                        <td style="padding:4px 0;font-size:13px;color:#1E293B;font-family:'Courier New',monospace;">
                          ${data.referenceNo}
                        </td>
                      </tr>` : ''}
                      <tr>
                        <td style="padding:4px 0;font-size:13px;color:#475569;">
                          <strong style="color:#1E293B;">Document Type:</strong>
                        </td>
                        <td style="padding:4px 0;font-size:13px;color:#1E293B;">
                          ${data.documentType}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:4px 0;font-size:13px;color:#475569;">
                          <strong style="color:#1E293B;">Marked By:</strong>
                        </td>
                        <td style="padding:4px 0;font-size:13px;color:#1E293B;">
                          ${data.markedBy} (${data.markedByDepartment})
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:4px 0;font-size:13px;color:#475569;">
                          <strong style="color:#1E293B;">Date Marked:</strong>
                        </td>
                        <td style="padding:4px 0;font-size:13px;color:#1E293B;">
                          ${new Date(data.createdAt).toLocaleString('en-KE', { 
                            day: '2-digit', 
                            month: 'short', 
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>
                      </tr>
                      ${data.instructions ? `
                      <tr>
                        <td style="padding:4px 0;font-size:13px;color:#475569;vertical-align:top;">
                          <strong style="color:#1E293B;">Instructions:</strong>
                        </td>
                        <td style="padding:4px 0;font-size:13px;color:#1E293B;font-style:italic;">
                          "${data.instructions}"
                        </td>
                      </tr>` : ''}
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Action Button -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
                <tr>
                  <td align="center">
                    <a href="${process.env.CLIENT_URL}/documents/${data.documentId}" 
                       style="display:inline-block;padding:12px 40px;background-color:#1E4620;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;letter-spacing:0.5px;">
                      View Document & Take Action
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Additional Info -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#FFFBEB;border:1px solid #FCD34D;border-radius:8px;padding:14px 16px;margin-bottom:20px;">
                <tr>
                  <td>
                    <p style="margin:0;font-size:12px;color:#92400E;line-height:1.5;">
                      <strong>📌 Next Steps:</strong> Please review the document and take appropriate action. 
                      You can acknowledge receipt, add annotations, or mark as completed through the system.
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin:16px 0 0;font-size:12px;color:#9CA3AF;text-align:center;line-height:1.5;">
                This is an automated notification from the Judiciary Document Management System.<br />
                If you have questions, please contact your department head or system administrator.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#1a2e1b;border-radius:0 0 12px 12px;padding:20px 40px;" align="center">
              <p style="margin:0 0 4px;font-size:11px;color:rgba(255,255,255,0.5);letter-spacing:0.5px;">
                Office of the Registrar — High Court of Kenya
              </p>
              <div style="width:32px;height:1px;background:rgba(255,255,255,0.15);margin:8px auto;"></div>
              <p style="margin:0;font-size:10px;color:rgba(255,255,255,0.3);">
                This is an automated message. Please do not reply directly to this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;
  },

  /**
   * Email template for when a document is assigned to a specific user
   */
  documentAssignedToUser: (data: DocumentNotificationData): string => {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Document Assigned to You</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f2f5;font-family:'Segoe UI',Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f0f2f5;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;">

          <!-- Header -->
          <tr>
            <td style="background-color:#1E4620;border-radius:12px 12px 0 0;padding:32px 40px 24px;" align="center">
              <h1 style="margin:0;font-size:20px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">
                📋 Document Assigned to You
              </h1>
              <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.7);">
                Action Required — Judiciary Document Management System
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background-color:#ffffff;padding:36px 40px 32px;">
              
              <p style="margin:0 0 4px;font-size:14px;color:#374151;line-height:1.6;">
                Dear <strong>${data.assignedTo}</strong>,
              </p>
              <p style="margin:0 0 20px;font-size:14px;color:#374151;line-height:1.6;">
                A document has been <strong>specifically assigned to you</strong> for action. 
                Please review and take necessary steps immediately.
              </p>

              <!-- Document Card -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8fafc;border-radius:8px;border-left:4px solid #1E4620;margin-bottom:24px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding:4px 0;font-size:13px;color:#475569;">
                          <strong style="color:#1E293B;">Document:</strong>
                        </td>
                        <td style="padding:4px 0;font-size:13px;color:#1E293B;font-weight:500;">
                          ${data.documentTitle}
                        </td>
                      </tr>
                      ${data.referenceNo ? `
                      <tr>
                        <td style="padding:4px 0;font-size:13px;color:#475569;">
                          <strong style="color:#1E293B;">Reference:</strong>
                        </td>
                        <td style="padding:4px 0;font-size:13px;color:#1E293B;font-family:'Courier New',monospace;">
                          ${data.referenceNo}
                        </td>
                      </tr>` : ''}
                      <tr>
                        <td style="padding:4px 0;font-size:13px;color:#475569;">
                          <strong style="color:#1E293B;">From Department:</strong>
                        </td>
                        <td style="padding:4px 0;font-size:13px;color:#1E293B;">
                          ${data.markedByDepartment}
                        </td>
                      </tr>
                      ${data.instructions ? `
                      <tr>
                        <td style="padding:4px 0;font-size:13px;color:#475569;vertical-align:top;">
                          <strong style="color:#1E293B;">Instructions:</strong>
                        </td>
                        <td style="padding:4px 0;font-size:13px;color:#1E293B;font-style:italic;">
                          "${data.instructions}"
                        </td>
                      </tr>` : ''}
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Action Button -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
                <tr>
                  <td align="center">
                    <a href="${process.env.CLIENT_URL}/documents/${data.documentId}" 
                       style="display:inline-block;padding:12px 40px;background-color:#1E4620;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">
                      Open Document
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:16px 0 0;font-size:12px;color:#9CA3AF;text-align:center;line-height:1.5;">
                This document requires your attention. Please log in to the system to take action.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#1a2e1b;border-radius:0 0 12px 12px;padding:20px 40px;" align="center">
              <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.5);letter-spacing:0.5px;">
                Office of the Registrar — High Court of Kenya
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;
  },

  /**
   * Email template for when a document is sent to Super Admin
   */
  documentSentToSuperAdmin: (data: DocumentNotificationData): string => {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Document Requires Your Review</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f2f5;font-family:'Segoe UI',Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f0f2f5;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;">

          <!-- Header -->
          <tr>
            <td style="background-color:#1E4620;border-radius:12px 12px 0 0;padding:32px 40px 24px;" align="center">
              <h1 style="margin:0;font-size:20px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">
                📑 Document for Review
              </h1>
              <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.7);">
                Super Admin Review Required
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background-color:#ffffff;padding:36px 40px 32px;">
              
              <p style="margin:0 0 4px;font-size:14px;color:#374151;line-height:1.6;">
                Dear <strong>${data.superAdminName || 'Super Admin'}</strong>,
              </p>
              <p style="margin:0 0 20px;font-size:14px;color:#374151;line-height:1.6;">
                A document has been submitted by <strong>${data.markedBy}</strong> from 
                <strong>${data.markedByDepartment}</strong> and is awaiting your review and e-signature.
              </p>

              <!-- Document Info -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F0FDF4;border-radius:8px;border:1px solid #86EFAC;margin-bottom:24px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding:4px 0;font-size:13px;color:#475569;">
                          <strong style="color:#1E293B;">Title:</strong>
                        </td>
                        <td style="padding:4px 0;font-size:13px;color:#1E293B;font-weight:500;">
                          ${data.documentTitle}
                        </td>
                      </tr>
                      ${data.referenceNo ? `
                      <tr>
                        <td style="padding:4px 0;font-size:13px;color:#475569;">
                          <strong style="color:#1E293B;">Reference:</strong>
                        </td>
                        <td style="padding:4px 0;font-size:13px;color:#1E293B;font-family:'Courier New',monospace;">
                          ${data.referenceNo}
                        </td>
                      </tr>` : ''}
                      <tr>
                        <td style="padding:4px 0;font-size:13px;color:#475569;">
                          <strong style="color:#1E293B;">Type:</strong>
                        </td>
                        <td style="padding:4px 0;font-size:13px;color:#1E293B;">
                          ${data.documentType}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:4px 0;font-size:13px;color:#475569;">
                          <strong style="color:#1E293B;">Submitted By:</strong>
                        </td>
                        <td style="padding:4px 0;font-size:13px;color:#1E293B;">
                          ${data.markedBy} (${data.markedByDepartment})
                        </td>
                      </tr>
                      ${data.instructions ? `
                      <tr>
                        <td style="padding:4px 0;font-size:13px;color:#475569;vertical-align:top;">
                          <strong style="color:#1E293B;">Note:</strong>
                        </td>
                        <td style="padding:4px 0;font-size:13px;color:#1E293B;font-style:italic;">
                          "${data.instructions}"
                        </td>
                      </tr>` : ''}
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Action Buttons -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
                <tr>
                  <td align="center">
                    <a href="${process.env.CLIENT_URL}/documents/${data.documentId}" 
                       style="display:inline-block;padding:12px 40px;background-color:#1E4620;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">
                      Review & Sign Document
                    </a>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#FFFBEB;border:1px solid #FCD34D;border-radius:8px;padding:14px 16px;margin-bottom:20px;">
                <tr>
                  <td>
                    <p style="margin:0;font-size:12px;color:#92400E;line-height:1.5;">
                      <strong>📌 Required Action:</strong> Review the document, add annotations if needed, 
                      and provide your e-signature to finalize the document.
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin:16px 0 0;font-size:12px;color:#9CA3AF;text-align:center;line-height:1.5;">
                This document requires your e-signature before it can be finalized.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#1a2e1b;border-radius:0 0 12px 12px;padding:20px 40px;" align="center">
              <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.5);letter-spacing:0.5px;">
                Office of the Registrar — High Court of Kenya
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;
  },

  /**
   * Generic document notification
   */
  genericDocumentNotification: (data: DocumentNotificationData): string => {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Document Notification</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f2f5;font-family:'Segoe UI',Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f0f2f5;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;">

          <tr>
            <td style="background-color:#1E4620;border-radius:12px 12px 0 0;padding:32px 40px 24px;" align="center">
              <h1 style="margin:0;font-size:20px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">
                📄 Document Notification
              </h1>
              <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.7);">
                Judiciary Document Management System
              </p>
            </td>
          </tr>

          <tr>
            <td style="background-color:#ffffff;padding:36px 40px 32px;">
              
              <p style="margin:0 0 4px;font-size:14px;color:#374151;line-height:1.6;">
                Dear <strong>${data.assignedTo}</strong>,
              </p>
              <p style="margin:0 0 20px;font-size:14px;color:#374151;line-height:1.6;">
                A document has been shared with you in the Judiciary Document Management System.
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:24px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 8px;font-size:15px;font-weight:600;color:#1E293B;">
                      ${data.documentTitle}
                    </p>
                    ${data.referenceNo ? `
                    <p style="margin:0 0 4px;font-size:13px;color:#475569;">
                      <strong>Reference:</strong> ${data.referenceNo}
                    </p>` : ''}
                    <p style="margin:0 0 4px;font-size:13px;color:#475569;">
                      <strong>Type:</strong> ${data.documentType}
                    </p>
                    <p style="margin:0;font-size:13px;color:#475569;">
                      <strong>From:</strong> ${data.markedBy} (${data.markedByDepartment})
                    </p>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center">
                    <a href="${process.env.CLIENT_URL}/documents/${data.documentId}" 
                       style="display:inline-block;padding:12px 40px;background-color:#1E4620;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">
                      View Document
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="background-color:#1a2e1b;border-radius:0 0 12px 12px;padding:20px 40px;" align="center">
              <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.5);">
                Office of the Registrar — High Court of Kenya
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;
  }
};


// src/utils/email.ts

// ─── AUTH EMAILS ─────────────────────────────────────────────────────────────
// (Keep existing sendOtpMail)

// ─── GENERAL REQUEST EMAILS ──────────────────────────────────────────────────
// (Keep existing sendGeneralRequestAcknowledgement and sendGeneralRequestStatusUpdate)

// ─── UTILITY MEMO EMAILS ─────────────────────────────────────────────────────

interface UtilityMemoEmailOptions {
  to: string;
  judgeName: string;
  ref: string;
  utilityType: string;
  amount: number;
  period: string;
  status: string;
  submittedBy: string;
  submittedAt: Date;
}

export const sendUtilityMemoNotification = async ({
  to,
  judgeName,
  ref,
  utilityType,
  amount,
  period,
  status,
  submittedBy,
  submittedAt,
}: UtilityMemoEmailOptions) => {
  const subject = `Utility Memo Notification - ${ref}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Utility Memo Notification</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f2f5;font-family:'Segoe UI',Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f0f2f5;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">

          <tr>
            <td align="center" style="background-color:#1E4620;border-radius:12px 12px 0 0;padding:32px 40px 24px;">
              <img
                src="https://res.cloudinary.com/do0yflasl/image/upload/v1784363826/ORHC_L_crclut.jpg"
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
            </td>
          </tr>

          <tr>
            <td style="background-color:#ffffff;padding:36px 40px 32px;">
              <div style="text-align:center;margin-bottom:28px;">
                <div style="display:inline-block;background:#e8f5e9;border-radius:50%;width:64px;height:64px;line-height:64px;font-size:32px;color:#1E4620;">
                  📄
                </div>
              </div>
              <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;text-align:center;">
                Utility Memo Submitted
              </h2>
              <p style="margin:0 0 24px;font-size:14px;color:#6b7280;text-align:center;line-height:1.6;">
                A utility memo has been submitted for processing.
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;margin-bottom:24px;">
                <tr><td style="padding:16px 20px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr><td style="padding:4px 0;font-size:13px;color:#6b7280;"><strong>Reference:</strong></td><td style="padding:4px 0;font-size:13px;color:#111827;font-weight:600;">${ref}</td></tr>
                    <tr><td style="padding:4px 0;font-size:13px;color:#6b7280;"><strong>Judge:</strong></td><td style="padding:4px 0;font-size:13px;color:#111827;">${judgeName}</td></tr>
                    <tr><td style="padding:4px 0;font-size:13px;color:#6b7280;"><strong>Utility Type:</strong></td><td style="padding:4px 0;font-size:13px;color:#111827;">${utilityType}</td></tr>
                    <tr><td style="padding:4px 0;font-size:13px;color:#6b7280;"><strong>Amount:</strong></td><td style="padding:4px 0;font-size:13px;color:#111827;">KES ${amount.toLocaleString()}</td></tr>
                    <tr><td style="padding:4px 0;font-size:13px;color:#6b7280;"><strong>Period:</strong></td><td style="padding:4px 0;font-size:13px;color:#111827;">${period}</td></tr>
                    <tr><td style="padding:4px 0;font-size:13px;color:#6b7280;"><strong>Status:</strong></td><td style="padding:4px 0;font-size:13px;color:#92400e;font-weight:500;">${status}</td></tr>
                    <tr><td style="padding:4px 0;font-size:13px;color:#6b7280;"><strong>Submitted By:</strong></td><td style="padding:4px 0;font-size:13px;color:#111827;">${submittedBy}</td></tr>
                    <tr><td style="padding:4px 0;font-size:13px;color:#6b7280;"><strong>Submitted On:</strong></td><td style="padding:4px 0;font-size:13px;color:#111827;">${submittedAt.toLocaleString('en-KE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td></tr>
                  </table>
                </td></tr>
              </table>

              <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;line-height:1.5;">
                Please review this utility memo at your earliest convenience.
              </p>
            </td>
          </tr>

          <tr>
            <td style="background-color:#1a2e1b;border-radius:0 0 12px 12px;padding:20px 40px;">
              <p style="margin:0 0 4px;font-size:11px;color:rgba(255,255,255,0.5);text-align:center;letter-spacing:0.5px;">
                This is an automated message from the
              </p>
              <p style="margin:0 0 12px;font-size:11px;font-weight:600;color:rgba(255,255,255,0.75);text-align:center;letter-spacing:1px;text-transform:uppercase;">
                Office of the Registrar — High Court of Kenya
              </p>
              <div style="width:32px;height:1px;background:rgba(255,255,255,0.15);margin:0 auto 12px;"></div>
              <p style="margin:0;font-size:10px;color:rgba(255,255,255,0.3);text-align:center;">
                Do not reply to this email &middot; For support contact the Help Desk
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;

  return await sendMail({ to, subject, html });
};

// ─── CIRCUIT / BENCH / PART-HEARD / SERVICE WEEK / OTHER PAYMENT EMAILS ──────

interface DSAMemoEmailOptions {
  to: string;
  judgeName: string;
  ref: string;
  moduleType: string; // 'Circuit', 'Bench', 'Part-Heard', 'Service Week', 'Other Payment'
  activityName: string;
  startDate: string;
  endDate: string;
  totalDSA: number;
  memberCount: number;
  status: string;
  submittedBy: string;
  submittedAt: Date;
  memoUrl?: string;
}

export const sendDSAMemoNotification = async ({
  to,
  judgeName,
  ref,
  moduleType,
  activityName,
  startDate,
  endDate,
  totalDSA,
  memberCount,
  status,
  submittedBy,
  submittedAt,
  memoUrl,
}: DSAMemoEmailOptions) => {
  const subject = `${moduleType} Memo Notification - ${ref}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${moduleType} Memo Notification</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f2f5;font-family:'Segoe UI',Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f0f2f5;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">

          <tr>
            <td align="center" style="background-color:#1E4620;border-radius:12px 12px 0 0;padding:32px 40px 24px;">
              <img
                src="https://res.cloudinary.com/do0yflasl/image/upload/v1784363826/ORHC_L_crclut.jpg"
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
            </td>
          </tr>

          <tr>
            <td style="background-color:#ffffff;padding:36px 40px 32px;">
              <div style="text-align:center;margin-bottom:28px;">
                <div style="display:inline-block;background:#e8f5e9;border-radius:50%;width:64px;height:64px;line-height:64px;font-size:32px;color:#1E4620;">
                  📋
                </div>
              </div>
              <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;text-align:center;">
                ${moduleType} Memo Submitted
              </h2>
              <p style="margin:0 0 24px;font-size:14px;color:#6b7280;text-align:center;line-height:1.6;">
                A ${moduleType} memo has been submitted for processing.
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;margin-bottom:24px;">
                <tr><td style="padding:16px 20px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr><td style="padding:4px 0;font-size:13px;color:#6b7280;"><strong>Reference:</strong></td><td style="padding:4px 0;font-size:13px;color:#111827;font-weight:600;">${ref}</td></tr>
                    <tr><td style="padding:4px 0;font-size:13px;color:#6b7280;"><strong>${moduleType}:</strong></td><td style="padding:4px 0;font-size:13px;color:#111827;">${activityName}</td></tr>
                    <tr><td style="padding:4px 0;font-size:13px;color:#6b7280;"><strong>Period:</strong></td><td style="padding:4px 0;font-size:13px;color:#111827;">${startDate} — ${endDate}</td></tr>
                    <tr><td style="padding:4px 0;font-size:13px;color:#6b7280;"><strong>Total DSA:</strong></td><td style="padding:4px 0;font-size:13px;color:#111827;font-weight:600;">KES ${totalDSA.toLocaleString()}</td></tr>
                    <tr><td style="padding:4px 0;font-size:13px;color:#6b7280;"><strong>Members:</strong></td><td style="padding:4px 0;font-size:13px;color:#111827;">${memberCount}</td></tr>
                    <tr><td style="padding:4px 0;font-size:13px;color:#6b7280;"><strong>Status:</strong></td><td style="padding:4px 0;font-size:13px;color:#92400e;font-weight:500;">${status}</td></tr>
                    <tr><td style="padding:4px 0;font-size:13px;color:#6b7280;"><strong>Submitted By:</strong></td><td style="padding:4px 0;font-size:13px;color:#111827;">${submittedBy}</td></tr>
                    <tr><td style="padding:4px 0;font-size:13px;color:#6b7280;"><strong>Submitted On:</strong></td><td style="padding:4px 0;font-size:13px;color:#111827;">${submittedAt.toLocaleString('en-KE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td></tr>
                  </table>
                </td></tr>
              </table>

              ${memoUrl ? `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
                <tr><td align="center"><a href="${memoUrl}" style="display:inline-block;padding:12px 40px;background-color:#1E4620;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">📄 View Memo</a></td></tr>
              </table>` : ''}

              <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;line-height:1.5;">
                Please review this ${moduleType} memo at your earliest convenience.
              </p>
            </td>
          </tr>

          <tr>
            <td style="background-color:#1a2e1b;border-radius:0 0 12px 12px;padding:20px 40px;">
              <p style="margin:0 0 4px;font-size:11px;color:rgba(255,255,255,0.5);text-align:center;letter-spacing:0.5px;">
                This is an automated message from the
              </p>
              <p style="margin:0 0 12px;font-size:11px;font-weight:600;color:rgba(255,255,255,0.75);text-align:center;letter-spacing:1px;text-transform:uppercase;">
                Office of the Registrar — High Court of Kenya
              </p>
              <div style="width:32px;height:1px;background:rgba(255,255,255,0.15);margin:0 auto 12px;"></div>
              <p style="margin:0;font-size:10px;color:rgba(255,255,255,0.3);text-align:center;">
                Do not reply to this email &middot; For support contact the Help Desk
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;

  return await sendMail({ to, subject, html });
};

// ─── MEDICAL CLAIM EMAILS ─────────────────────────────────────────────────────

interface MedicalClaimEmailOptions {
  to: string;
  officerName: string;
  ref: string;
  claimAmount: number;
  dateForwarded: string;
  status: string;
  remarks?: string;
  submittedBy: string;
  submittedAt: Date;
}

export const sendMedicalClaimNotification = async ({
  to,
  officerName,
  ref,
  claimAmount,
  dateForwarded,
  status,
  remarks,
  submittedBy,
  submittedAt,
}: MedicalClaimEmailOptions) => {
  const subject = `Medical Claim Notification - ${ref}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Medical Claim Notification</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f2f5;font-family:'Segoe UI',Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f0f2f5;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">

          <tr>
            <td align="center" style="background-color:#1E4620;border-radius:12px 12px 0 0;padding:32px 40px 24px;">
              <img
                src="https://res.cloudinary.com/do0yflasl/image/upload/v1784363826/ORHC_L_crclut.jpg"
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
            </td>
          </tr>

          <tr>
            <td style="background-color:#ffffff;padding:36px 40px 32px;">
              <div style="text-align:center;margin-bottom:28px;">
                <div style="display:inline-block;background:#e8f5e9;border-radius:50%;width:64px;height:64px;line-height:64px;font-size:32px;color:#1E4620;">
                  💊
                </div>
              </div>
              <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;text-align:center;">
                Medical Claim Submitted
              </h2>
              <p style="margin:0 0 24px;font-size:14px;color:#6b7280;text-align:center;line-height:1.6;">
                A medical expense claim has been submitted for processing.
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;margin-bottom:24px;">
                <tr><td style="padding:16px 20px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr><td style="padding:4px 0;font-size:13px;color:#6b7280;"><strong>Reference:</strong></td><td style="padding:4px 0;font-size:13px;color:#111827;font-weight:600;">${ref}</td></tr>
                    <tr><td style="padding:4px 0;font-size:13px;color:#6b7280;"><strong>Officer:</strong></td><td style="padding:4px 0;font-size:13px;color:#111827;">${officerName}</td></tr>
                    <tr><td style="padding:4px 0;font-size:13px;color:#6b7280;"><strong>Claim Amount:</strong></td><td style="padding:4px 0;font-size:13px;color:#111827;font-weight:600;">KES ${claimAmount.toLocaleString()}</td></tr>
                    <tr><td style="padding:4px 0;font-size:13px;color:#6b7280;"><strong>Date Forwarded to DHR:</strong></td><td style="padding:4px 0;font-size:13px;color:#111827;">${dateForwarded}</td></tr>
                    ${remarks ? `<tr><td style="padding:4px 0;font-size:13px;color:#6b7280;"><strong>Remarks:</strong></td><td style="padding:4px 0;font-size:13px;color:#111827;">${remarks}</td></tr>` : ''}
                    <tr><td style="padding:4px 0;font-size:13px;color:#6b7280;"><strong>Status:</strong></td><td style="padding:4px 0;font-size:13px;color:#92400e;font-weight:500;">${status}</td></tr>
                    <tr><td style="padding:4px 0;font-size:13px;color:#6b7280;"><strong>Submitted By:</strong></td><td style="padding:4px 0;font-size:13px;color:#111827;">${submittedBy}</td></tr>
                    <tr><td style="padding:4px 0;font-size:13px;color:#6b7280;"><strong>Submitted On:</strong></td><td style="padding:4px 0;font-size:13px;color:#111827;">${submittedAt.toLocaleString('en-KE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td></tr>
                  </table>
                </td></tr>
              </table>

              <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;line-height:1.5;">
                Please review this medical claim at your earliest convenience.
              </p>
            </td>
          </tr>

          <tr>
            <td style="background-color:#1a2e1b;border-radius:0 0 12px 12px;padding:20px 40px;">
              <p style="margin:0 0 4px;font-size:11px;color:rgba(255,255,255,0.5);text-align:center;letter-spacing:0.5px;">
                This is an automated message from the
              </p>
              <p style="margin:0 0 12px;font-size:11px;font-weight:600;color:rgba(255,255,255,0.75);text-align:center;letter-spacing:1px;text-transform:uppercase;">
                Office of the Registrar — High Court of Kenya
              </p>
              <div style="width:32px;height:1px;background:rgba(255,255,255,0.15);margin:0 auto 12px;"></div>
              <p style="margin:0;font-size:10px;color:rgba(255,255,255,0.3);text-align:center;">
                Do not reply to this email &middot; For support contact the Help Desk
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;

  return await sendMail({ to, subject, html });
};

// ─── VISA REQUEST EMAILS ─────────────────────────────────────────────────────

interface VisaRequestEmailOptions {
  to: string;
  judgeName: string;
  ref: string;
  destinationCountry: string;
  dateOfTravel: string;
  dateOfReturn: string;
  visaType: string;
  purposeOfTravel?: string;
  status: string;
  remarks?: string;
  submittedBy: string;
  submittedAt: Date;
}

export const sendVisaRequestNotification = async ({
  to,
  judgeName,
  ref,
  destinationCountry,
  dateOfTravel,
  dateOfReturn,
  visaType,
  purposeOfTravel,
  status,
  remarks,
  submittedBy,
  submittedAt,
}: VisaRequestEmailOptions) => {
  const subject = `Visa Request Notification - ${ref}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Visa Request Notification</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f2f5;font-family:'Segoe UI',Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f0f2f5;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">

          <tr>
            <td align="center" style="background-color:#1E4620;border-radius:12px 12px 0 0;padding:32px 40px 24px;">
              <img
                src="https://res.cloudinary.com/do0yflasl/image/upload/v1784363826/ORHC_L_crclut.jpg"
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
            </td>
          </tr>

          <tr>
            <td style="background-color:#ffffff;padding:36px 40px 32px;">
              <div style="text-align:center;margin-bottom:28px;">
                <div style="display:inline-block;background:#e8f5e9;border-radius:50%;width:64px;height:64px;line-height:64px;font-size:32px;color:#1E4620;">
                  ✈️
                </div>
              </div>
              <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;text-align:center;">
                Visa Request Submitted
              </h2>
              <p style="margin:0 0 24px;font-size:14px;color:#6b7280;text-align:center;line-height:1.6;">
                A visa support request has been submitted for processing.
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;margin-bottom:24px;">
                <tr><td style="padding:16px 20px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr><td style="padding:4px 0;font-size:13px;color:#6b7280;"><strong>Reference:</strong></td><td style="padding:4px 0;font-size:13px;color:#111827;font-weight:600;">${ref}</td></tr>
                    <tr><td style="padding:4px 0;font-size:13px;color:#6b7280;"><strong>Judge:</strong></td><td style="padding:4px 0;font-size:13px;color:#111827;">${judgeName}</td></tr>
                    <tr><td style="padding:4px 0;font-size:13px;color:#6b7280;"><strong>Destination:</strong></td><td style="padding:4px 0;font-size:13px;color:#111827;">${destinationCountry}</td></tr>
                    <tr><td style="padding:4px 0;font-size:13px;color:#6b7280;"><strong>Travel Date:</strong></td><td style="padding:4px 0;font-size:13px;color:#111827;">${dateOfTravel}</td></tr>
                    <tr><td style="padding:4px 0;font-size:13px;color:#6b7280;"><strong>Return Date:</strong></td><td style="padding:4px 0;font-size:13px;color:#111827;">${dateOfReturn}</td></tr>
                    <tr><td style="padding:4px 0;font-size:13px;color:#6b7280;"><strong>Visa Type:</strong></td><td style="padding:4px 0;font-size:13px;color:#111827;">${visaType}</td></tr>
                    ${purposeOfTravel ? `<tr><td style="padding:4px 0;font-size:13px;color:#6b7280;"><strong>Purpose:</strong></td><td style="padding:4px 0;font-size:13px;color:#111827;">${purposeOfTravel}</td></tr>` : ''}
                    ${remarks ? `<tr><td style="padding:4px 0;font-size:13px;color:#6b7280;"><strong>Remarks:</strong></td><td style="padding:4px 0;font-size:13px;color:#111827;">${remarks}</td></tr>` : ''}
                    <tr><td style="padding:4px 0;font-size:13px;color:#6b7280;"><strong>Status:</strong></td><td style="padding:4px 0;font-size:13px;color:#92400e;font-weight:500;">${status}</td></tr>
                    <tr><td style="padding:4px 0;font-size:13px;color:#6b7280;"><strong>Submitted By:</strong></td><td style="padding:4px 0;font-size:13px;color:#111827;">${submittedBy}</td></tr>
                    <tr><td style="padding:4px 0;font-size:13px;color:#6b7280;"><strong>Submitted On:</strong></td><td style="padding:4px 0;font-size:13px;color:#111827;">${submittedAt.toLocaleString('en-KE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td></tr>
                  </table>
                </td></tr>
              </table>

              <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;line-height:1.5;">
                Please review this visa request at your earliest convenience.
              </p>
            </td>
          </tr>

          <tr>
            <td style="background-color:#1a2e1b;border-radius:0 0 12px 12px;padding:20px 40px;">
              <p style="margin:0 0 4px;font-size:11px;color:rgba(255,255,255,0.5);text-align:center;letter-spacing:0.5px;">
                This is an automated message from the
              </p>
              <p style="margin:0 0 12px;font-size:11px;font-weight:600;color:rgba(255,255,255,0.75);text-align:center;letter-spacing:1px;text-transform:uppercase;">
                Office of the Registrar — High Court of Kenya
              </p>
              <div style="width:32px;height:1px;background:rgba(255,255,255,0.15);margin:0 auto 12px;"></div>
              <p style="margin:0;font-size:10px;color:rgba(255,255,255,0.3);text-align:center;">
                Do not reply to this email &middot; For support contact the Help Desk
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;

  return await sendMail({ to, subject, html });
};

// ─── PROTOCOL EVENT EMAILS ───────────────────────────────────────────────────

interface ProtocolEventEmailOptions {
  to: string;
  activity: string;
  ref: string;
  venue?: string;
  periodFrom: string;
  periodTo: string;
  officersAssigned?: string;
  dsaRequired: boolean;
  totalDSA: number;
  memberCount: number;
  status: string;
  remarks?: string;
  submittedBy: string;
  submittedAt: Date;
}

export const sendProtocolEventNotification = async ({
  to,
  activity,
  ref,
  venue,
  periodFrom,
  periodTo,
  officersAssigned,
  dsaRequired,
  totalDSA,
  memberCount,
  status,
  remarks,
  submittedBy,
  submittedAt,
}: ProtocolEventEmailOptions) => {
  const subject = `Protocol Event Notification - ${ref}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Protocol Event Notification</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f2f5;font-family:'Segoe UI',Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f0f2f5;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">

          <tr>
            <td align="center" style="background-color:#1E4620;border-radius:12px 12px 0 0;padding:32px 40px 24px;">
              <img
                src="https://res.cloudinary.com/do0yflasl/image/upload/v1784363826/ORHC_L_crclut.jpg"
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
            </td>
          </tr>

          <tr>
            <td style="background-color:#ffffff;padding:36px 40px 32px;">
              <div style="text-align:center;margin-bottom:28px;">
                <div style="display:inline-block;background:#e8f5e9;border-radius:50%;width:64px;height:64px;line-height:64px;font-size:32px;color:#1E4620;">
                  📅
                </div>
              </div>
              <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;text-align:center;">
                Protocol Event Submitted
              </h2>
              <p style="margin:0 0 24px;font-size:14px;color:#6b7280;text-align:center;line-height:1.6;">
                A protocol support event has been submitted for processing.
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;margin-bottom:24px;">
                <tr><td style="padding:16px 20px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr><td style="padding:4px 0;font-size:13px;color:#6b7280;"><strong>Reference:</strong></td><td style="padding:4px 0;font-size:13px;color:#111827;font-weight:600;">${ref}</td></tr>
                    <tr><td style="padding:4px 0;font-size:13px;color:#6b7280;"><strong>Activity:</strong></td><td style="padding:4px 0;font-size:13px;color:#111827;">${activity}</td></tr>
                    ${venue ? `<tr><td style="padding:4px 0;font-size:13px;color:#6b7280;"><strong>Venue:</strong></td><td style="padding:4px 0;font-size:13px;color:#111827;">${venue}</td></tr>` : ''}
                    <tr><td style="padding:4px 0;font-size:13px;color:#6b7280;"><strong>Period:</strong></td><td style="padding:4px 0;font-size:13px;color:#111827;">${periodFrom} — ${periodTo}</td></tr>
                    ${officersAssigned ? `<tr><td style="padding:4px 0;font-size:13px;color:#6b7280;"><strong>Officers Assigned:</strong></td><td style="padding:4px 0;font-size:13px;color:#111827;">${officersAssigned}</td></tr>` : ''}
                    <tr><td style="padding:4px 0;font-size:13px;color:#6b7280;"><strong>DSA Required:</strong></td><td style="padding:4px 0;font-size:13px;color:#111827;">${dsaRequired ? 'Yes' : 'No'}</td></tr>
                    ${dsaRequired ? `<tr><td style="padding:4px 0;font-size:13px;color:#6b7280;"><strong>Total DSA:</strong></td><td style="padding:4px 0;font-size:13px;color:#111827;font-weight:600;">KES ${totalDSA.toLocaleString()}</td></tr>` : ''}
                    ${dsaRequired ? `<tr><td style="padding:4px 0;font-size:13px;color:#6b7280;"><strong>Members:</strong></td><td style="padding:4px 0;font-size:13px;color:#111827;">${memberCount}</td></tr>` : ''}
                    ${remarks ? `<tr><td style="padding:4px 0;font-size:13px;color:#6b7280;"><strong>Remarks:</strong></td><td style="padding:4px 0;font-size:13px;color:#111827;">${remarks}</td></tr>` : ''}
                    <tr><td style="padding:4px 0;font-size:13px;color:#6b7280;"><strong>Status:</strong></td><td style="padding:4px 0;font-size:13px;color:#92400e;font-weight:500;">${status}</td></tr>
                    <tr><td style="padding:4px 0;font-size:13px;color:#6b7280;"><strong>Submitted By:</strong></td><td style="padding:4px 0;font-size:13px;color:#111827;">${submittedBy}</td></tr>
                    <tr><td style="padding:4px 0;font-size:13px;color:#6b7280;"><strong>Submitted On:</strong></td><td style="padding:4px 0;font-size:13px;color:#111827;">${submittedAt.toLocaleString('en-KE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td></tr>
                  </table>
                </td></tr>
              </table>

              <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;line-height:1.5;">
                Please review this protocol event at your earliest convenience.
              </p>
            </td>
          </tr>

          <tr>
            <td style="background-color:#1a2e1b;border-radius:0 0 12px 12px;padding:20px 40px;">
              <p style="margin:0 0 4px;font-size:11px;color:rgba(255,255,255,0.5);text-align:center;letter-spacing:0.5px;">
                This is an automated message from the
              </p>
              <p style="margin:0 0 12px;font-size:11px;font-weight:600;color:rgba(255,255,255,0.75);text-align:center;letter-spacing:1px;text-transform:uppercase;">
                Office of the Registrar — High Court of Kenya
              </p>
              <div style="width:32px;height:1px;background:rgba(255,255,255,0.15);margin:0 auto 12px;"></div>
              <p style="margin:0;font-size:10px;color:rgba(255,255,255,0.3);text-align:center;">
                Do not reply to this email &middot; For support contact the Help Desk
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;

  return await sendMail({ to, subject, html });
};

// ─── CLUB MEMBERSHIP EMAILS ──────────────────────────────────────────────────

interface ClubMembershipEmailOptions {
  to: string;
  judgeName: string;
  ref: string;
  clubName: string;
  entryFee: number;
  annualFee: number;
  court?: string;
  status: string;
  remarks?: string;
  submittedBy: string;
  submittedAt: Date;
}

export const sendClubMembershipNotification = async ({
  to,
  judgeName,
  ref,
  clubName,
  entryFee,
  annualFee,
  court,
  status,
  remarks,
  submittedBy,
  submittedAt,
}: ClubMembershipEmailOptions) => {
  const subject = `Club Membership Notification - ${ref}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Club Membership Notification</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f2f5;font-family:'Segoe UI',Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f0f2f5;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">

          <tr>
            <td align="center" style="background-color:#1E4620;border-radius:12px 12px 0 0;padding:32px 40px 24px;">
              <img
                src="https://res.cloudinary.com/do0yflasl/image/upload/v1784363826/ORHC_L_crclut.jpg"
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
            </td>
          </tr>

          <tr>
            <td style="background-color:#ffffff;padding:36px 40px 32px;">
              <div style="text-align:center;margin-bottom:28px;">
                <div style="display:inline-block;background:#e8f5e9;border-radius:50%;width:64px;height:64px;line-height:64px;font-size:32px;color:#1E4620;">
                  🏛️
                </div>
              </div>
              <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;text-align:center;">
                Club Membership Submitted
              </h2>
              <p style="margin:0 0 24px;font-size:14px;color:#6b7280;text-align:center;line-height:1.6;">
                A club membership request has been submitted for processing.
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;margin-bottom:24px;">
                <tr><td style="padding:16px 20px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr><td style="padding:4px 0;font-size:13px;color:#6b7280;"><strong>Reference:</strong></td><td style="padding:4px 0;font-size:13px;color:#111827;font-weight:600;">${ref}</td></tr>
                    <tr><td style="padding:4px 0;font-size:13px;color:#6b7280;"><strong>Judge:</strong></td><td style="padding:4px 0;font-size:13px;color:#111827;">${judgeName}</td></tr>
                    <tr><td style="padding:4px 0;font-size:13px;color:#6b7280;"><strong>Club:</strong></td><td style="padding:4px 0;font-size:13px;color:#111827;">${clubName}</td></tr>
                    <tr><td style="padding:4px 0;font-size:13px;color:#6b7280;"><strong>Entry Fee:</strong></td><td style="padding:4px 0;font-size:13px;color:#111827;">KES ${entryFee.toLocaleString()}</td></tr>
                    <tr><td style="padding:4px 0;font-size:13px;color:#6b7280;"><strong>Annual Fee:</strong></td><td style="padding:4px 0;font-size:13px;color:#111827;">KES ${annualFee.toLocaleString()}</td></tr>
                    ${court ? `<tr><td style="padding:4px 0;font-size:13px;color:#6b7280;"><strong>Court:</strong></td><td style="padding:4px 0;font-size:13px;color:#111827;">${court}</td></tr>` : ''}
                    ${remarks ? `<tr><td style="padding:4px 0;font-size:13px;color:#6b7280;"><strong>Remarks:</strong></td><td style="padding:4px 0;font-size:13px;color:#111827;">${remarks}</td></tr>` : ''}
                    <tr><td style="padding:4px 0;font-size:13px;color:#6b7280;"><strong>Status:</strong></td><td style="padding:4px 0;font-size:13px;color:#92400e;font-weight:500;">${status}</td></tr>
                    <tr><td style="padding:4px 0;font-size:13px;color:#6b7280;"><strong>Submitted By:</strong></td><td style="padding:4px 0;font-size:13px;color:#111827;">${submittedBy}</td></tr>
                    <tr><td style="padding:4px 0;font-size:13px;color:#6b7280;"><strong>Submitted On:</strong></td><td style="padding:4px 0;font-size:13px;color:#111827;">${submittedAt.toLocaleString('en-KE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td></tr>
                  </table>
                </td></tr>
              </table>

              <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;line-height:1.5;">
                Please review this club membership request at your earliest convenience.
              </p>
            </td>
          </tr>

          <tr>
            <td style="background-color:#1a2e1b;border-radius:0 0 12px 12px;padding:20px 40px;">
              <p style="margin:0 0 4px;font-size:11px;color:rgba(255,255,255,0.5);text-align:center;letter-spacing:0.5px;">
                This is an automated message from the
              </p>
              <p style="margin:0 0 12px;font-size:11px;font-weight:600;color:rgba(255,255,255,0.75);text-align:center;letter-spacing:1px;text-transform:uppercase;">
                Office of the Registrar — High Court of Kenya
              </p>
              <div style="width:32px;height:1px;background:rgba(255,255,255,0.15);margin:0 auto 12px;"></div>
              <p style="margin:0;font-size:10px;color:rgba(255,255,255,0.3);text-align:center;">
                Do not reply to this email &middot; For support contact the Help Desk
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;

  return await sendMail({ to, subject, html });
};


// src/utils/email.ts

// ... existing code ...

/**
 * General Request Resolved - Sent when a request is marked as Resolved
 */
export const sendGeneralRequestResolved = async ({
  to,
  ticketNumber,
  judgeName,
  request,
  resolution,
  resolvedBy,
}: {
  to: string;
  ticketNumber: string;
  judgeName: string;
  request: string;
  resolution: string;
  resolvedBy: string;
}) => {
  const subject = `General Request Resolved - ${ticketNumber}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>General Request Resolved</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f2f5;font-family:'Segoe UI',Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f0f2f5;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">

          <tr>
            <td align="center" style="background-color:#065f46;border-radius:12px 12px 0 0;padding:32px 40px 24px;">
              <img
                src="https://res.cloudinary.com/do0yflasl/image/upload/v1784363826/ORHC_L_crclut.jpg"
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
              <p style="margin:12px 0 0;font-size:18px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">
                ✅ Resolved
              </p>
            </td>
          </tr>

          <tr>
            <td style="background-color:#ffffff;padding:36px 40px 32px;">
              <p style="margin:0 0 4px;font-size:14px;color:#374151;line-height:1.6;">Dear <strong>${judgeName}</strong>,</p>
              <p style="margin:0 0 20px;font-size:14px;color:#374151;line-height:1.6;">
                Your request has been <strong>resolved</strong> by ${resolvedBy}.
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;margin-bottom:24px;">
                <tr><td style="padding:16px 20px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr><td style="padding:4px 0;font-size:13px;color:#6b7280;"><strong>Ticket Number:</strong></td><td style="padding:4px 0;font-size:13px;color:#111827;font-weight:600;">${ticketNumber}</td></tr>
                    <tr><td style="padding:4px 0;font-size:13px;color:#6b7280;"><strong>Request:</strong></td><td style="padding:4px 0;font-size:13px;color:#374151;">${request}</td></tr>
                    <tr><td style="padding:4px 0;font-size:13px;color:#6b7280;"><strong>Resolution:</strong></td><td style="padding:4px 0;font-size:13px;color:#065f46;font-weight:500;">${resolution}</td></tr>
                    <tr><td style="padding:4px 0;font-size:13px;color:#6b7280;"><strong>Resolved By:</strong></td><td style="padding:4px 0;font-size:13px;color:#111827;">${resolvedBy}</td></tr>
                  </table>
                </td></tr>
              </table>

              <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;line-height:1.5;">
                If you have any questions, please contact the Help Desk.
              </p>
            </td>
          </tr>

          <tr>
            <td style="background-color:#1a2e1b;border-radius:0 0 12px 12px;padding:20px 40px;">
              <p style="margin:0 0 4px;font-size:11px;color:rgba(255,255,255,0.5);text-align:center;letter-spacing:0.5px;">
                This is an automated message from the
              </p>
              <p style="margin:0 0 12px;font-size:11px;font-weight:600;color:rgba(255,255,255,0.75);text-align:center;letter-spacing:1px;text-transform:uppercase;">
                Office of the Registrar — High Court of Kenya
              </p>
              <div style="width:32px;height:1px;background:rgba(255,255,255,0.15);margin:0 auto 12px;"></div>
              <p style="margin:0;font-size:10px;color:rgba(255,255,255,0.3);text-align:center;">
                Do not reply to this email &middot; For support contact the Help Desk
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;

  return await sendMail({ to, subject, html });
};

/**
 * General Request Rejected - Sent when a request is marked as Rejected
 */
export const sendGeneralRequestRejected = async ({
  to,
  ticketNumber,
  judgeName,
  request,
  reason,
  rejectedBy,
}: {
  to: string;
  ticketNumber: string;
  judgeName: string;
  request: string;
  reason: string;
  rejectedBy: string;
}) => {
  const subject = `General Request Rejected - ${ticketNumber}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>General Request Rejected</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f2f5;font-family:'Segoe UI',Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f0f2f5;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">

          <tr>
            <td align="center" style="background-color:#991b1b;border-radius:12px 12px 0 0;padding:32px 40px 24px;">
              <img
                src="https://res.cloudinary.com/do0yflasl/image/upload/v1784363826/ORHC_L_crclut.jpg"
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
              <p style="margin:12px 0 0;font-size:18px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">
                ❌ Rejected
              </p>
            </td>
          </tr>

          <tr>
            <td style="background-color:#ffffff;padding:36px 40px 32px;">
              <p style="margin:0 0 4px;font-size:14px;color:#374151;line-height:1.6;">Dear <strong>${judgeName}</strong>,</p>
              <p style="margin:0 0 20px;font-size:14px;color:#374151;line-height:1.6;">
                Your request has been <strong>rejected</strong> by ${rejectedBy}.
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;margin-bottom:24px;">
                <tr><td style="padding:16px 20px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr><td style="padding:4px 0;font-size:13px;color:#6b7280;"><strong>Ticket Number:</strong></td><td style="padding:4px 0;font-size:13px;color:#111827;font-weight:600;">${ticketNumber}</td></tr>
                    <tr><td style="padding:4px 0;font-size:13px;color:#6b7280;"><strong>Request:</strong></td><td style="padding:4px 0;font-size:13px;color:#374151;">${request}</td></tr>
                    <tr><td style="padding:4px 0;font-size:13px;color:#6b7280;"><strong>Reason:</strong></td><td style="padding:4px 0;font-size:13px;color:#991b1b;font-weight:500;">${reason}</td></tr>
                    <tr><td style="padding:4px 0;font-size:13px;color:#6b7280;"><strong>Rejected By:</strong></td><td style="padding:4px 0;font-size:13px;color:#111827;">${rejectedBy}</td></tr>
                  </table>
                </td></tr>
              </table>

              <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;line-height:1.5;">
                If you have any questions, please contact the Help Desk.
              </p>
            </td>
          </tr>

          <tr>
            <td style="background-color:#1a2e1b;border-radius:0 0 12px 12px;padding:20px 40px;">
              <p style="margin:0 0 4px;font-size:11px;color:rgba(255,255,255,0.5);text-align:center;letter-spacing:0.5px;">
                This is an automated message from the
              </p>
              <p style="margin:0 0 12px;font-size:11px;font-weight:600;color:rgba(255,255,255,0.75);text-align:center;letter-spacing:1px;text-transform:uppercase;">
                Office of the Registrar — High Court of Kenya
              </p>
              <div style="width:32px;height:1px;background:rgba(255,255,255,0.15);margin:0 auto 12px;"></div>
              <p style="margin:0;font-size:10px;color:rgba(255,255,255,0.3);text-align:center;">
                Do not reply to this email &middot; For support contact the Help Desk
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;

  return await sendMail({ to, subject, html });
};





export default emailTemplates;