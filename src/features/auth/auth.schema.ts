// src/features/auth/auth.schema.ts
import { z } from 'zod';
import { UserRole } from '../../middleware/auth.middleware';

export const createUserSchema = z.object({
  body: z.object({
    full_name:     z.string().min(1).trim(),
    email:         z.string().email().toLowerCase().trim(),
    pj_number:     z.string().min(1).toUpperCase().trim(),
    role:          z.enum(['super_admin', 'dept_head', 'staff', 'viewer']),
    department_id: z.string().uuid().nullable().default(null),
  }),
});

export const requestLoginSchema = z.object({
  body: z.object({
    pj_number: z.string().min(1, 'PJ Number is required.').toUpperCase().trim(),
  }),
});

export const verifyLoginSchema = z.object({
  body: z.object({
    pj_number: z.string().min(1, 'PJ Number is required.').toUpperCase().trim(),
    otp:       z.string().length(6, 'The verification code must be exactly 6 digits.').trim(),
  }),
});

export type CreateUserInput = z.infer<typeof createUserSchema>['body'];

export interface AdminUserRow {
  id:               string;
  full_name:        string;
  email:             string;
  pj_number:         string;
  role:              UserRole;
  department_id:     string | null;
  department_code:   string | null;  // joined from departments.code — null for super_admin or unassigned
  hashed_otp:        string | null;
  otp_expires_at:    Date | null;
  created_at:        Date;
}