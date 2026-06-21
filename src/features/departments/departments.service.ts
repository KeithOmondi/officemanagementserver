// src/features/departments/departments.service.ts
import { pool } from '../../config/db';
import { AppError } from '../../utils/response';
import type { Department, DepartmentWithUserCount } from './departments.types';
import type { CreateDepartmentInput, UpdateDepartmentInput } from './departments.validator';

export class DepartmentService {

  static async create(input: CreateDepartmentInput): Promise<Department> {
    const { rows } = await pool.query(
      `INSERT INTO departments (name, code)
       VALUES ($1, $2)
       RETURNING id, name, code, is_active, created_at`,
      [input.name.trim(), input.code?.trim().toUpperCase() ?? null]
    );
    return rows[0];
  }

  static async findAll(): Promise<DepartmentWithUserCount[]> {
    const { rows } = await pool.query(
      `SELECT
         d.id, d.name, d.code, d.is_active, d.created_at,
         COUNT(u.id) FILTER (WHERE u.is_active = true)::int AS user_count
       FROM departments d
       LEFT JOIN users u ON u.department_id = d.id
       GROUP BY d.id
       ORDER BY d.name ASC`
    );
    return rows;
  }

  static async findById(id: string): Promise<DepartmentWithUserCount | null> {
    const { rows } = await pool.query(
      `SELECT
         d.id, d.name, d.code, d.is_active, d.created_at,
         COUNT(u.id) FILTER (WHERE u.is_active = true)::int AS user_count
       FROM departments d
       LEFT JOIN users u ON u.department_id = d.id
       WHERE d.id = $1
       GROUP BY d.id`,
      [id]
    );
    return rows[0] ?? null;
  }

  static async findByIdOrThrow(id: string): Promise<DepartmentWithUserCount> {
    const dept = await this.findById(id);
    if (!dept) throw new AppError(404, 'Department not found');
    return dept;
  }

  static async update(id: string, input: UpdateDepartmentInput): Promise<Department> {
    await this.findByIdOrThrow(id);

    const updates: string[] = [];
    const values: unknown[] = [];
    let p = 1;

    if (input.name      !== undefined) { updates.push(`name = $${p++}`);      values.push(input.name.trim()); }
    if (input.code      !== undefined) { updates.push(`code = $${p++}`);      values.push(input.code.trim().toUpperCase()); }
    if (input.is_active !== undefined) { updates.push(`is_active = $${p++}`); values.push(input.is_active); }

    values.push(id);

    const { rows } = await pool.query(
      `UPDATE departments SET ${updates.join(', ')}
       WHERE id = $${p}
       RETURNING id, name, code, is_active, created_at`,
      values
    );
    return rows[0];
  }

  static async delete(id: string): Promise<void> {
    const dept = await this.findByIdOrThrow(id);
    if (dept.user_count > 0) {
      throw new AppError(
        409,
        `Cannot delete department with ${dept.user_count} active member(s). Reassign them first.`
      );
    }
    await pool.query(`DELETE FROM departments WHERE id = $1`, [id]);
  }

  static async exists(id: string): Promise<boolean> {
    const { rows } = await pool.query(
      `SELECT id FROM departments WHERE id = $1 AND is_active = true`,
      [id]
    );
    return rows.length > 0;
  }
}