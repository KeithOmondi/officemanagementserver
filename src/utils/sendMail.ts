// src/utils/email.ts

import { BrevoClient } from "@getbrevo/brevo";
import { env } from "../config/env";

const brevo = new BrevoClient({
  apiKey: env.BREVO_API_KEY,
});

interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  attachments?: {
    content: string;
    filename: string;
    type: string;
    disposition?: 'attachment' | 'inline';
  }[];
}

export const sendMail = async ({ to, subject, html, attachments }: SendMailOptions) => {
  try {
    const payload: any = {
      sender: { name: env.SENDER_NAME, email: env.SENDER_EMAIL },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent: 'Please enable HTML to view this message.',
    };

    if (attachments && attachments.length > 0) {
      payload.attachment = attachments.map((att) => ({
        content: att.content,
        name: att.filename,
        type: att.type,
        disposition: att.disposition || 'attachment',
      }));
    }

    return await brevo.transactionalEmails.sendTransacEmail(payload);
  } catch (err: any) {
    const errorMsg = err?.response?.body?.message || err.message;
    console.error(`[EMAIL ERROR] to ${to}:`, errorMsg);
    throw new Error(`Email sending failed: ${errorMsg}`);
  }
};

// ─── Shared Constants ─────────────────────────────────────────────────────────

export const LOGO_URL =
  "https://res.cloudinary.com/do0yflasl/image/upload/v1781759596/JOB_LOGO_ubls4m.jpg";

// ─── AUTH EMAILS ─────────────────────────────────────────────────────────────

export const sendOtpMail = async (
  email: string,
  pjNumber: string,
  otp: string,
) => {
  const subject = "Your Secure Portal Login Code";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Secure Portal Login Code</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f2f5;font-family:'Segoe UI',Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f0f2f5;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">

          <tr>
            <td align="center" style="background-color:#1E4620;border-radius:12px 12px 0 0;padding:32px 40px 24px;">
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
            </td>
          </tr>

          <tr>
            <td style="background-color:#ffffff;padding:36px 40px 32px;">
              <p style="margin:0 0 6px;font-size:13px;color:#6b7280;">Login request for PJ Number</p>
              <p style="margin:0 0 24px;font-size:15px;font-weight:700;color:#111827;letter-spacing:0.5px;">${pjNumber}</p>
              <p style="margin:0 0 20px;font-size:14px;color:#374151;line-height:1.6;">
                Use the verification code below to complete your sign-in.
                This code expires in <strong>10 minutes</strong>.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="background:linear-gradient(135deg,#f8fdf8 0%,#eef7ef 100%);border:1.5px solid #c6e0c8;border-radius:10px;padding:28px 20px;">
                    <p style="margin:0 0 8px;font-size:10px;font-weight:700;letter-spacing:3px;color:#1E4620;text-transform:uppercase;">
                      Verification Code
                    </p>
                    <p style="margin:0;font-size:38px;font-weight:800;letter-spacing:14px;color:#1E4620;font-family:'Courier New',monospace;">
                      ${otp}
                    </p>
                  </td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;">
                <tr>
                  <td style="background-color:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:12px 16px;">
                    <p style="margin:0;font-size:12px;color:#92400e;line-height:1.5;">
                      <strong>Security notice:</strong> This code is valid for a single sign-in only.
                      Never share it with anyone. Court staff will never ask for your OTP.
                    </p>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;text-align:center;line-height:1.5;">
                If you did not initiate this request, please disregard this email.<br />
                No changes have been made to your account.
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
                Do not reply to this email &middot; For support contact your system administrator
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;

  return await sendMail({ to: email, subject, html });
};

// ─── GENERAL REQUEST EMAILS ──────────────────────────────────────────────────
// Simplified to only use the core fields: Requester name, status, type, remarks, details, request date

interface GeneralRequestEmailOptions {
  to: string;
  ticketNumber: string;
  judgeName: string;
  request: string;
  requestType?: string;
  status: string;
  remarks?: string;
  requestDate?: string;
}

/**
 * General Request Acknowledgement - Sent when a request is created
 */
export const sendGeneralRequestAcknowledgement = async ({
  to,
  ticketNumber,
  judgeName,
  request,
  requestType,
  status,
  remarks,
  requestDate,
}: GeneralRequestEmailOptions) => {
  const subject = `General Request Acknowledgement - ${ticketNumber}`;

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

          <tr>
            <td align="center" style="background-color:#1E4620;border-radius:12px 12px 0 0;padding:32px 40px 24px;">
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
            </td>
          </tr>

          <tr>
            <td style="background-color:#ffffff;padding:36px 40px 32px;">
              <div style="text-align:center;margin-bottom:28px;">
                <div style="display:inline-block;background:#e8f5e9;border-radius:50%;width:64px;height:64px;line-height:64px;font-size:32px;color:#1E4620;">
                  ✓
                </div>
              </div>
              <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;text-align:center;">
                Request Received
              </h2>
              <p style="margin:0 0 24px;font-size:14px;color:#6b7280;text-align:center;line-height:1.6;">
                Your request has been received and is under review.
              </p>

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

              <!-- Details -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;margin-bottom:24px;">
                <tr><td style="padding:16px 20px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr><td style="padding:4px 0;font-size:13px;color:#6b7280;"><strong>Requester:</strong></td><td style="padding:4px 0;font-size:13px;color:#111827;font-weight:500;">${judgeName}</td></tr>
                    ${requestType ? `<tr><td style="padding:4px 0;font-size:13px;color:#6b7280;"><strong>Type:</strong></td><td style="padding:4px 0;font-size:13px;color:#111827;">${requestType}</td></tr>` : ''}
                    <tr><td style="padding:4px 0;font-size:13px;color:#6b7280;"><strong>Status:</strong></td><td style="padding:4px 0;font-size:13px;color:#92400e;font-weight:500;">${status}</td></tr>
                    ${requestDate ? `<tr><td style="padding:4px 0;font-size:13px;color:#6b7280;"><strong>Date:</strong></td><td style="padding:4px 0;font-size:13px;color:#111827;">${requestDate}</td></tr>` : ''}
                    <tr><td style="padding:4px 0;font-size:13px;color:#6b7280;"><strong>Details:</strong></td><td style="padding:4px 0;font-size:13px;color:#374151;">${request}</td></tr>
                    ${remarks ? `<tr><td style="padding:4px 0;font-size:13px;color:#6b7280;"><strong>Remarks:</strong></td><td style="padding:4px 0;font-size:13px;color:#374151;">${remarks}</td></tr>` : ''}
                  </table>
                </td></tr>
              </table>

              <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;line-height:1.5;">
                Please keep your ticket number for reference.<br />
                You will receive updates on this request via email.
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
 * General Request Status Update - Sent when status changes (Resolved, Rejected, In Progress)
 */
export const sendGeneralRequestStatusUpdate = async ({
  to,
  ticketNumber,
  judgeName,
  request,
  requestType,
  status,
  remarks,
  requestDate,
}: GeneralRequestEmailOptions & { status: string }) => {
  const statusColors: Record<string, string> = {
    'Resolved': '#065f46',
    'In Progress': '#d97706',
    'Rejected': '#991b1b',
    'Pending': '#92400e',
  };
  const statusIcons: Record<string, string> = {
    'Resolved': '✅',
    'In Progress': '⏳',
    'Rejected': '❌',
    'Pending': '⏰',
  };
  
  const statusMessages: Record<string, string> = {
    'Resolved': 'Your request has been resolved.',
    'In Progress': 'Your request is now being processed.',
    'Rejected': 'Your request has been rejected.',
    'Pending': 'Your request is still under review.',
  };

  const color = statusColors[status] || '#92400e';
  const icon = statusIcons[status] || '📋';
  const message = statusMessages[status] || 'Your request status has been updated.';

  const subject = `General Request ${status} - ${ticketNumber}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>General Request ${status}</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f2f5;font-family:'Segoe UI',Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f0f2f5;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">

          <tr>
            <td align="center" style="background-color:${color};border-radius:12px 12px 0 0;padding:32px 40px 24px;">
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
              <p style="margin:12px 0 0;font-size:18px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">
                ${icon} ${status}
              </p>
            </td>
          </tr>

          <tr>
            <td style="background-color:#ffffff;padding:36px 40px 32px;">
              <p style="margin:0 0 4px;font-size:14px;color:#374151;line-height:1.6;">Dear <strong>${judgeName}</strong>,</p>
              <p style="margin:0 0 20px;font-size:14px;color:#374151;line-height:1.6;">${message}</p>

              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;margin-bottom:24px;">
                <tr><td style="padding:16px 20px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr><td style="padding:4px 0;font-size:13px;color:#6b7280;"><strong>Ticket Number:</strong></td><td style="padding:4px 0;font-size:13px;color:#111827;font-weight:600;">${ticketNumber}</td></tr>
                    <tr><td style="padding:4px 0;font-size:13px;color:#6b7280;"><strong>Requester:</strong></td><td style="padding:4px 0;font-size:13px;color:#111827;">${judgeName}</td></tr>
                    ${requestType ? `<tr><td style="padding:4px 0;font-size:13px;color:#6b7280;"><strong>Type:</strong></td><td style="padding:4px 0;font-size:13px;color:#111827;">${requestType}</td></tr>` : ''}
                    <tr><td style="padding:4px 0;font-size:13px;color:#6b7280;"><strong>Status:</strong></td><td style="padding:4px 0;font-size:13px;color:${color};font-weight:600;">${status}</td></tr>
                    ${requestDate ? `<tr><td style="padding:4px 0;font-size:13px;color:#6b7280;"><strong>Date:</strong></td><td style="padding:4px 0;font-size:13px;color:#111827;">${requestDate}</td></tr>` : ''}
                    <tr><td style="padding:4px 0;font-size:13px;color:#6b7280;"><strong>Details:</strong></td><td style="padding:4px 0;font-size:13px;color:#374151;">${request}</td></tr>
                    ${remarks ? `<tr><td style="padding:4px 0;font-size:13px;color:#6b7280;"><strong>Remarks:</strong></td><td style="padding:4px 0;font-size:13px;color:#374151;">${remarks}</td></tr>` : ''}
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

// ─── HELPDESK DOCUMENT EMAILS ──────────────────────────────────────────────

interface HelpdeskDocumentEmailOptions {
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
}: HelpdeskDocumentEmailOptions) => {
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

          <tr>
            <td style="background-color:#1E4620;border-radius:12px 12px 0 0;padding:32px 40px 24px;" align="center">
              <img src="${LOGO_URL}" alt="Judiciary of Kenya" width="80" height="80" style="display:block;margin:0 auto 16px;border-radius:50%;border:3px solid rgba(255,255,255,0.20);object-fit:cover;"/>
              <p style="margin:0 0 2px;font-size:10px;font-weight:600;letter-spacing:3px;color:rgba(255,255,255,0.55);text-transform:uppercase;">Republic of Kenya</p>
              <h1 style="margin:0;font-size:15px;font-weight:700;letter-spacing:1.5px;color:#ffffff;text-transform:uppercase;line-height:1.4;">Office of the Registrar</h1>
              <p style="margin:2px 0 0;font-size:13px;font-weight:500;letter-spacing:1px;color:rgba(255,255,255,0.75);text-transform:uppercase;">High Court</p>
              <div style="width:48px;height:2px;background:#C29B38;border-radius:1px;margin:18px auto 0;"></div>
              <p style="margin:12px 0 0;font-size:16px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">✅ Document Approved</p>
            </td>
          </tr>

          <tr>
            <td style="background-color:#ffffff;padding:36px 40px 32px;">
              <p style="margin:0 0 4px;font-size:14px;color:#374151;line-height:1.6;">Dear <strong>${requesterName}</strong>,</p>
              <p style="margin:0 0 24px;font-size:14px;color:#374151;line-height:1.6;">Your document has been reviewed and <strong>approved</strong> by ${approvedBy}.</p>

              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:24px;">
                <tr><td style="padding:16px 20px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr><td style="padding:4px 0;font-size:13px;color:#475569;"><strong>Reference:</strong></td><td style="padding:4px 0;font-size:13px;color:#1E293B;font-weight:500;">${ref}</td></tr>
                    <tr><td style="padding:4px 0;font-size:13px;color:#475569;"><strong>Subject:</strong></td><td style="padding:4px 0;font-size:13px;color:#1E293B;">${subject}</td></tr>
                    <tr><td style="padding:4px 0;font-size:13px;color:#475569;"><strong>Type:</strong></td><td style="padding:4px 0;font-size:13px;color:#1E293B;">${entityType}</td></tr>
                    <tr><td style="padding:4px 0;font-size:13px;color:#475569;"><strong>Approved By:</strong></td><td style="padding:4px 0;font-size:13px;color:#1E293B;">${approvedBy}</td></tr>
                    <tr><td style="padding:4px 0;font-size:13px;color:#475569;"><strong>Approved On:</strong></td><td style="padding:4px 0;font-size:13px;color:#1E293B;">${approvedAt.toLocaleString('en-KE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td></tr>
                  </table>
                </td></tr>
              </table>

              ${comments ? `<div style="background:#F0FDF4;border:1px solid #86EFAC;border-radius:8px;padding:12px 16px;margin-bottom:24px;">
                <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#166534;">📝 Comments:</p>
                <p style="margin:0;font-size:13px;color:#166534;line-height:1.6;">${comments}</p>
              </div>` : ''}

              ${documentUrl ? `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
                <tr><td align="center"><a href="${documentUrl}" style="display:inline-block;padding:12px 40px;background-color:#1E4620;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">📄 View Document</a></td></tr>
              </table>` : ''}

              <p style="margin:0;font-size:12px;color:#9CA3AF;text-align:center;line-height:1.5;">Your document has been approved and is now available.</p>
            </td>
          </tr>

          <tr>
            <td style="background-color:#1a2e1b;border-radius:0 0 12px 12px;padding:20px 40px;" align="center">
              <p style="margin:0 0 4px;font-size:11px;color:rgba(255,255,255,0.5);letter-spacing:0.5px;">Office of the Registrar — High Court of Kenya</p>
              <p style="margin:0;font-size:10px;color:rgba(255,255,255,0.3);">This is an automated notification. Please do not reply directly to this email.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;

  return await sendMail({ to, subject: `✅ Document Approved: ${ref}`, html });
};