// src/features/auth/auth.service.ts
import { pool } from '../../config/db';
import { CreateUserInput, AdminUserRow } from './auth.schema';

export class AuthService {

  static async findExistingUser(pjNumber: string, email: string): Promise<boolean> {
    const { rows } = await pool.query(
      'SELECT id FROM users WHERE UPPER(pj_number) = UPPER($1) OR LOWER(email) = LOWER($2)',
      [pjNumber.trim(), email.trim()]
    );
    return rows.length > 0;
  }

  static async createAdminAccount(input: CreateUserInput): Promise<AdminUserRow> {
    const { rows } = await pool.query(
      `INSERT INTO users (full_name, email, pj_number, role, department_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, full_name, email, pj_number, role, department_id, created_at`,
      [
        input.full_name.trim(),
        input.email.trim().toLowerCase(),
        input.pj_number.trim().toUpperCase(),
        input.role,
        input.department_id ?? null,
      ]
    );
    return rows[0];
  }

  static async findAdminByPjNumber(pjNumber: string): Promise<AdminUserRow | null> {
    const { rows } = await pool.query(
      `SELECT u.id, u.full_name, u.email, u.pj_number, u.role, u.department_id,
              d.code AS department_code,
              u.hashed_otp, u.otp_expires_at, u.created_at
       FROM users u
       LEFT JOIN departments d ON d.id = u.department_id
       WHERE UPPER(u.pj_number) = UPPER($1)`,
      [pjNumber.trim()]
    );
    return rows[0] ?? null;
  }

  static async findAdminById(id: string): Promise<AdminUserRow | null> {
    const { rows } = await pool.query(
      `SELECT u.id, u.full_name, u.email, u.pj_number, u.role, u.department_id,
              d.code AS department_code,
              u.hashed_otp, u.otp_expires_at, u.created_at
       FROM users u
       LEFT JOIN departments d ON d.id = u.department_id
       WHERE u.id = $1`,
      [id]
    );
    return rows[0] ?? null;
  }

  static async updateOtpChallenge(
    adminId: string,
    hashedOtp: string | null,
    expiresAt: Date | null
  ): Promise<void> {
    await pool.query(
      'UPDATE users SET hashed_otp = $1, otp_expires_at = $2 WHERE id = $3',
      [hashedOtp, expiresAt, adminId]
    );
  }
}