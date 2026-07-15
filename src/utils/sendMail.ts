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
}

export const sendMail = async ({ to, subject, html }: SendMailOptions) => {
  try {
    return await brevo.transactionalEmails.sendTransacEmail({
      sender: { name: env.SENDER_NAME, email: env.SENDER_EMAIL },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent: "Please enable HTML to view this message.",
    });
  } catch (err: any) {
    const errorMsg = err?.response?.body?.message || err.message;
    console.error(`[EMAIL ERROR] to ${to}:`, errorMsg);
    throw new Error(`Email sending failed: ${errorMsg}`);
  }
};

const LOGO_URL =
  "https://res.cloudinary.com/do0yflasl/image/upload/v1781759596/JOB_LOGO_ubls4m.jpg";

/**
 * Dispatches a formatted 6-digit login validation code
 */
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

          <!-- ── Header ── -->
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

          <!-- ── Body ── -->
          <tr>
            <td style="background-color:#ffffff;padding:36px 40px 32px;">

              <p style="margin:0 0 6px;font-size:13px;color:#6b7280;">Login request for PJ Number</p>
              <p style="margin:0 0 24px;font-size:15px;font-weight:700;color:#111827;letter-spacing:0.5px;">${pjNumber}</p>

              <p style="margin:0 0 20px;font-size:14px;color:#374151;line-height:1.6;">
                Use the verification code below to complete your sign-in.
                This code expires in <strong>10 minutes</strong>.
              </p>

              <!-- OTP block -->
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

              <!-- Security notice -->
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

          <!-- ── Footer ── -->
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

/**
 * Sends a general request acknowledgement email with ticket number
 */
interface GeneralRequestAcknowledgementOptions {
  to: string;
  ticketNumber: string;
  judgeName: string;
  request: string;
}

export const sendGeneralRequestAcknowledgement = async ({
  to,
  ticketNumber,
  judgeName,
  request,
}: GeneralRequestAcknowledgementOptions) => {
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

          <!-- ── Header ── -->
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

          <!-- ── Body ── -->
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
                <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">
                  ${request}
                </p>
              </div>

              <!-- Status -->
              <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:12px 16px;margin-bottom:24px;">
                <p style="margin:0;font-size:13px;color:#92400e;line-height:1.5;text-align:center;">
                  <strong>Status:</strong> Pending Review
                </p>
              </div>

              <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;line-height:1.5;">
                You will receive updates on this request via email.<br />
                Please keep your ticket number for reference.
              </p>

            </td>
          </tr>

          <!-- ── Footer ── -->
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
                Do not reply to this email &middot; For support contact the Support Desk
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


// src/utils/sendMail.ts - Add these new functions

/**
 * Sends a general request resolved notification
 */
interface GeneralRequestResolvedOptions {
  to: string;
  ticketNumber: string;
  judgeName: string;
  request: string;
  resolution: string;
  resolvedBy: string;
}

export const sendGeneralRequestResolved = async ({
  to,
  ticketNumber,
  judgeName,
  request,
  resolution,
  resolvedBy,
}: GeneralRequestResolvedOptions) => {
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

          <!-- ── Header ── -->
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

          <!-- ── Body ── -->
          <tr>
            <td style="background-color:#ffffff;padding:36px 40px 32px;">

              <div style="text-align:center;margin-bottom:28px;">
                <div style="display:inline-block;background:#d4edda;border-radius:50%;width:64px;height:64px;line-height:64px;font-size:32px;color:#155724;">
                  ✓
                </div>
              </div>

              <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;text-align:center;">
                Request Resolved
              </h2>
              
              <p style="margin:0 0 24px;font-size:14px;color:#6b7280;text-align:center;line-height:1.6;">
                Your general request has been resolved and closed.
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

              <!-- Request Details -->
              <div style="background:#f9fafb;border-radius:8px;padding:16px 20px;margin-bottom:16px;">
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
                  Resolution
                </p>
                <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">
                  ${resolution || 'Request has been resolved satisfactorily.'}
                </p>
              </div>

              <!-- Resolved By -->
              <div style="background:#f9fafb;border-radius:8px;padding:12px 16px;margin-bottom:16px;">
                <p style="margin:0;font-size:13px;color:#6b7280;text-align:center;">
                  <strong>Resolved by:</strong> ${resolvedBy}
                </p>
              </div>

              <!-- Status -->
              <div style="background:#d4edda;border:1px solid #c3e6cb;border-radius:8px;padding:12px 16px;margin-bottom:24px;">
                <p style="margin:0;font-size:13px;color:#155724;line-height:1.5;text-align:center;">
                  <strong>Status:</strong> Resolved ✓
                </p>
              </div>

              <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;line-height:1.5;">
                This ticket is now closed. If you have any questions, please contact the Support Desk.
              </p>

            </td>
          </tr>

          <!-- ── Footer ── -->
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
                Do not reply to this email &middot; For support contact the Support Desk
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
 * Sends a general request rejected notification
 */
interface GeneralRequestRejectedOptions {
  to: string;
  ticketNumber: string;
  judgeName: string;
  request: string;
  reason: string;
  rejectedBy: string;
}

export const sendGeneralRequestRejected = async ({
  to,
  ticketNumber,
  judgeName,
  request,
  reason,
  rejectedBy,
}: GeneralRequestRejectedOptions) => {
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

          <!-- ── Header ── -->
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

          <!-- ── Body ── -->
          <tr>
            <td style="background-color:#ffffff;padding:36px 40px 32px;">

              <div style="text-align:center;margin-bottom:28px;">
                <div style="display:inline-block;background:#f8d7da;border-radius:50%;width:64px;height:64px;line-height:64px;font-size:32px;color:#721c24;">
                  ✕
                </div>
              </div>

              <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;text-align:center;">
                Request Rejected
              </h2>
              
              <p style="margin:0 0 24px;font-size:14px;color:#6b7280;text-align:center;line-height:1.6;">
                Your general request has been rejected.
              </p>

              <!-- Ticket Number -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
                <tr>
                  <td align="center" style="background:linear-gradient(135deg,#fdf8f8 0%,#f5e6e6 100%);border:1.5px solid #f5c6cb;border-radius:10px;padding:20px;">
                    <p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:3px;color:#721c24;text-transform:uppercase;">
                      Ticket Number
                    </p>
                    <p style="margin:0;font-size:28px;font-weight:800;letter-spacing:4px;color:#721c24;font-family:'Courier New',monospace;">
                      ${ticketNumber}
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Request Details -->
              <div style="background:#f9fafb;border-radius:8px;padding:16px 20px;margin-bottom:16px;">
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
                  Rejection Reason
                </p>
                <p style="margin:0;font-size:14px;color:#dc3545;line-height:1.6;">
                  ${reason || 'No specific reason provided.'}
                </p>
              </div>

              <!-- Rejected By -->
              <div style="background:#f9fafb;border-radius:8px;padding:12px 16px;margin-bottom:16px;">
                <p style="margin:0;font-size:13px;color:#6b7280;text-align:center;">
                  <strong>Rejected by:</strong> ${rejectedBy}
                </p>
              </div>

              <!-- Status -->
              <div style="background:#f8d7da;border:1px solid #f5c6cb;border-radius:8px;padding:12px 16px;margin-bottom:24px;">
                <p style="margin:0;font-size:13px;color:#721c24;line-height:1.5;text-align:center;">
                  <strong>Status:</strong> Rejected ✕
                </p>
              </div>

              <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;line-height:1.5;">
                This ticket is now closed. If you believe this rejection was in error, please contact the Support Desk.
              </p>

            </td>
          </tr>

          <!-- ── Footer ── -->
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
                Do not reply to this email &middot; For support contact the Support Desk
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