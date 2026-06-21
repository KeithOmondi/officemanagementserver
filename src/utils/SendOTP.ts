// src/utils/sendOTP.ts
import crypto from 'crypto';

export interface GeneratedOTP {
  rawOTP: string;
  hashedOTP: string;
  expiresAt: Date;
}

export const generateOTP = (expiryMinutes: number = 10): GeneratedOTP => {
  // Generate a cryptographically secure 6-digit number string
  const rawOTP = Math.floor(100000 + crypto.randomInt(900000)).toString();
  
  // Hash the OTP so if the database is leaked, OTPs cannot be read in plaintext
  const hashedOTP = crypto.createHash('sha256').update(rawOTP).digest('hex');
  
  const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

  return {
    rawOTP,
    hashedOTP,
    expiresAt,
  };
};