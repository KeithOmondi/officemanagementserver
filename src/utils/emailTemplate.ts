// src/utils/emailTemplate.ts

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
                    <a href="${process.env.FRONTEND_URL}/documents/${data.documentId}" 
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
                    <a href="${process.env.FRONTEND_URL}/documents/${data.documentId}" 
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
                    <a href="${process.env.FRONTEND_URL}/documents/${data.documentId}" 
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
                    <a href="${process.env.FRONTEND_URL}/documents/${data.documentId}" 
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




export default emailTemplates;