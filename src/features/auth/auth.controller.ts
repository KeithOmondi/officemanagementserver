// src/features/auth/auth.controller.ts
import { Request, Response } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { asyncHandler } from '../../utils/asyncHandler';
import { AppError, sendSuccess } from '../../utils/response';
import { sendTokenResponse } from '../../utils/sendToken';
import { AuthService } from './auth.service';
import { generateOTP } from '../../utils/SendOTP';
import { sendOtpMail } from '../../utils/sendMail';
import { env } from '../../config/env';

interface RefreshTokenPayload {
  id: string;
}

export const authController = {
  createUser: asyncHandler(async (req: Request, res: Response) => {
    const { full_name, email, pj_number, role, department_id } = req.body;

    const isDuplicate = await AuthService.findExistingUser(pj_number, email);
    if (isDuplicate) {
      throw new AppError(409, 'An administrative account with that PJ number or email already exists.');
    }

    const newUser = await AuthService.createAdminAccount({
      full_name,
      email,
      pj_number,
      role,
      department_id,
    });

    return sendSuccess(res, newUser, 'User account created successfully.', 201);
  }),

  requestLogin: asyncHandler(async (req: Request, res: Response) => {
    const { pj_number } = req.body;
    const baselineMessage =
      'If your registration details match, a verification code has been dispatched to your registered email.';

    const user = await AuthService.findAdminByPjNumber(pj_number);
    if (!user) return sendSuccess(res, null, baselineMessage, 200);

    const { rawOTP, hashedOTP, expiresAt } = generateOTP(10);
    await AuthService.updateOtpChallenge(user.id, hashedOTP, expiresAt);

    try {
      await sendOtpMail(user.email, user.pj_number, rawOTP);
    } catch (error) {
      await AuthService.updateOtpChallenge(user.id, null, null);
      console.error('Email Gateway Error:', error);
      throw new AppError(500, 'The mailing engine encountered an issue processing your verification code delivery.');
    }

    return sendSuccess(res, null, baselineMessage, 200);
  }),

  verifyLogin: asyncHandler(async (req: Request, res: Response) => {
    const { pj_number, otp } = req.body;

    const user = await AuthService.findAdminByPjNumber(pj_number);
    if (!user) throw new AppError(401, 'Invalid credential signatures or expired code verification match.');

    if (!user.hashed_otp || !user.otp_expires_at) {
      throw new AppError(400, 'No active authentication challenges discovered. Please request a fresh challenge code.');
    }
    if (new Date() > new Date(user.otp_expires_at)) {
      throw new AppError(401, 'The verification code has expired. Please request a new one.');
    }

    const inputHash = crypto.createHash('sha256').update(otp.trim()).digest('hex');
    if (inputHash !== user.hashed_otp) {
      throw new AppError(401, 'Invalid credential signatures or expired code verification match.');
    }

    await AuthService.updateOtpChallenge(user.id, null, null);

    return sendTokenResponse(
      {
        id:               user.id,
        email:            user.email,
        full_name:        user.full_name,
        role:             user.role,
        department_id:    user.department_id,
        department_code:  user.department_code,
      },
      200,
      res
    );
  }),

  refreshToken: asyncHandler(async (req: Request, res: Response) => {
    const token = req.cookies?.refreshToken as string | undefined;

    if (!token) {
      throw new AppError(401, 'No refresh token provided.');
    }

    let payload: RefreshTokenPayload;
    try {
      payload = jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
    } catch {
      res.clearCookie('refreshToken', {
        httpOnly: true,
        secure:   env.NODE_ENV === 'production',
        sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
      });
      throw new AppError(401, 'Refresh token is invalid or expired. Please log in again.');
    }

    const user = await AuthService.findAdminById(payload.id);
    if (!user) throw new AppError(401, 'User account no longer exists.');

    return sendTokenResponse(
      {
        id:               user.id,
        email:            user.email,
        full_name:        user.full_name,
        role:             user.role,
        department_id:    user.department_id,
        department_code:  user.department_code,
      },
      200,
      res
    );
  }),

  logout: asyncHandler(async (_req: Request, res: Response) => {
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure:   env.NODE_ENV === 'production',
      sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
    });
    return sendSuccess(res, null, 'Logged out successfully.', 200);
  }),
};