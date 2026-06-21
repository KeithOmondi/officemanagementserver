// src/features/users/users.service.ts
import { pool } from '../../config/db';
import { AppError } from '../../utils/response';
import type { User, UpdateUserInput, UserFilters, UserPaginationResponse, CreateUserInput } from './users.types';

const ALLOWED_SORT_COLUMNS = new Set(['created_at', 'updated_at', 'full_name', 'email', 'pj_number', 'last_login']);

const USER_SELECT = `
  u.id, u.full_name, u.email, u.pj_number, u.role, u.department_id,
  u.is_active, u.created_at, u.updated_at, u.last_login
`;

export class UserService {

  static async create(input: CreateUserInput): Promise<User> {
    const existing = await pool.query(
      'SELECT id FROM users WHERE LOWER(email) = LOWER($1) OR UPPER(pj_number) = UPPER($2)',
      [input.email, input.pj_number]
    );
    if (existing.rows.length > 0) throw new AppError(409, 'Email or PJ number already in use');

    const { rows } = await pool.query(
      `INSERT INTO users (full_name, email, pj_number, role, department_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${USER_SELECT.replace(/u\./g, '')}`,
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

  static async findById(id: string): Promise<User | null> {
    const { rows } = await pool.query(
      `SELECT ${USER_SELECT} FROM users u WHERE u.id = $1`,
      [id]
    );
    return rows[0] ?? null;
  }

  static async findAll(filters: UserFilters): Promise<UserPaginationResponse> {
    const {
      search, department_id, role, is_active,
      page = 1, limit = 20, sort_by = 'created_at', sort_order = 'DESC',
    } = filters;

    const sortCol = ALLOWED_SORT_COLUMNS.has(sort_by ?? '') ? sort_by : 'created_at';
    const sortDir = sort_order === 'ASC' ? 'ASC' : 'DESC';
    const offset  = (page - 1) * limit;

    const conditions: string[] = [];
    const values: unknown[]    = [];
    let p = 1;

    if (search) {
      conditions.push(`(u.full_name ILIKE $${p} OR u.email ILIKE $${p} OR u.pj_number ILIKE $${p})`);
      values.push(`%${search}%`); p++;
    }
    if (is_active !== undefined) {
      conditions.push(`u.is_active = $${p}`); values.push(is_active); p++;
    }
    if (role) {
      conditions.push(`u.role = $${p}`); values.push(role); p++;
    }
    if (department_id) {
      conditions.push(`u.department_id = $${p}`); values.push(department_id); p++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) AS total FROM users u ${where}`,
      values
    );
    const total = parseInt(countResult.rows[0]?.total ?? '0', 10);

    const dataResult = await pool.query(
      `SELECT ${USER_SELECT} FROM users u ${where}
       ORDER BY u.${sortCol} ${sortDir}
       LIMIT $${p} OFFSET $${p + 1}`,
      [...values, limit, offset]
    );

    return { data: dataResult.rows, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  static async update(id: string, input: UpdateUserInput): Promise<User> {
    const existing = await this.findById(id);
    if (!existing) throw new AppError(404, 'User not found');

    const updates: string[] = [];
    const values: unknown[] = [];
    let p = 1;

    if (input.full_name     !== undefined) { updates.push(`full_name = $${p++}`);     values.push(input.full_name.trim()); }
    if (input.email         !== undefined) { updates.push(`email = $${p++}`);          values.push(input.email.trim().toLowerCase()); }
    if (input.role          !== undefined) { updates.push(`role = $${p++}`);           values.push(input.role); }
    if (input.department_id !== undefined) { updates.push(`department_id = $${p++}`);  values.push(input.department_id); }
    if (input.is_active     !== undefined) { updates.push(`is_active = $${p++}`);      values.push(input.is_active); }

    if (!updates.length) throw new AppError(400, 'No valid fields provided to update');

    updates.push(`updated_at = NOW()`);
    values.push(id);

    await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${p}`,
      values
    );

    return (await this.findById(id))!;
  }

  static async softDelete(id: string): Promise<void> {
    const { rows } = await pool.query(
      `UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id`,
      [id]
    );
    if (!rows.length) throw new AppError(404, 'User not found');
  }

  static async hardDelete(id: string): Promise<void> {
    const { rows } = await pool.query(
      `DELETE FROM users WHERE id = $1 RETURNING id`,
      [id]
    );
    if (!rows.length) throw new AppError(404, 'User not found');
  }

  static async updateLastLogin(id: string): Promise<void> {
    await pool.query(`UPDATE users SET last_login = NOW() WHERE id = $1`, [id]);
  }

  static async getStats(): Promise<{
    totalUsers:    number;
    activeUsers:   number;
    byRole:        { role: string; count: number }[];
    byDepartment:  { department_id: string; name: string; count: number }[];
  }> {
    const [userStats, roleStats, deptStats] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*)                                  AS "totalUsers",
          COUNT(*) FILTER (WHERE is_active = true)  AS "activeUsers"
        FROM users
      `),
      pool.query(`
        SELECT role, COUNT(*) AS count
        FROM users
        GROUP BY role
        ORDER BY role
      `),
      pool.query(`
        SELECT d.id AS department_id, d.name, COUNT(u.id) AS count
        FROM departments d
        LEFT JOIN users u ON u.department_id = d.id
        GROUP BY d.id, d.name
        ORDER BY d.name
      `),
    ]);

    const r = userStats.rows[0];
    return {
      totalUsers:   parseInt(r.totalUsers,  10),
      activeUsers:  parseInt(r.activeUsers, 10),
      byRole:       roleStats.rows.map((r) => ({ ...r, count: parseInt(r.count, 10) })),
      byDepartment: deptStats.rows.map((d) => ({ ...d, count: parseInt(d.count, 10) })),
    };
  }
}