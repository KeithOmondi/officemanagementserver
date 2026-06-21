// src/utils/sendToken.ts
import { Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { UserRole } from '../middleware/auth.middleware';

export interface TokenPayload {
  id:               string;
  email:            string;
  full_name:        string;
  role:             UserRole;
  department_id:    string | null;
  department_code:  string | null;
}

export const sendTokenResponse = (
  user: TokenPayload,
  statusCode: number,
  res: Response
) => {
  // Access token — carries everything protect middleware needs
  const accessToken = jwt.sign(
    {
      id:               user.id,
      email:            user.email,
      full_name:        user.full_name,
      role:             user.role,
      department_id:    user.department_id,
      department_code:  user.department_code,
    },
    env.JWT_SECRET,
    { expiresIn: '15m' }
  );

  // Refresh token — minimal, only id needed to re-fetch user from DB
  const refreshToken = jwt.sign(
    { id: user.id },
    env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure:   env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge:   7 * 24 * 60 * 60 * 1000,
  });

  return res.status(statusCode).json({
    success: true,
    accessToken,
    user: {
      id:               user.id,
      full_name:        user.full_name,
      email:            user.email,
      role:             user.role,
      department_id:    user.department_id,
      department_code:  user.department_code,
    },
  });
};