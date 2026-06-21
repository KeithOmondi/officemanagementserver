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

/**
 * Dispatches a formatted 6-digit login validation code
 */
export const sendOtpMail = async (email: string, pjNumber: string, otp: string) => {
  const subject = "Your Secure Portal Login Code";
  const html = `
    <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 8px; max-width: 500px; margin: 0 auto;">
      <h2 style="color: #333; text-align: center;">Secure Portal Access</h2>
      <p>A login request was initiated for PJ Number: <strong>${pjNumber}</strong>.</p>
      <p>Use the verification code below to complete your authentication. This code expires in 10 minutes:</p>
      
      <div style="background: #f4f6f9; padding: 15px; font-size: 28px; font-weight: bold; text-align: center; letter-spacing: 6px; color: #1a73e8; border-radius: 4px; margin: 25px 0;">
        ${otp}
      </div>
      
      <p style="color: #666; font-size: 12px; text-align: center;">
        If you did not make this request, you can safely ignore this email.
      </p>
    </div>
  `;

  return await sendMail({ to: email, subject, html });
};