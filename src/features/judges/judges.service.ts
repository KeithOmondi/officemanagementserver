// src/features/judges/judges.service.ts

import { pool } from '../../config/db';
import { AppError } from '../../utils/response';
import type {
  Judge,
  CreateJudgeInput,
  UpdateJudgeInput,
  JudgeFilters,
  JudgePaginationResponse,
  JudgeStats,
} from './judges.types';

export class JudgesService {
  static async findAll(filters: JudgeFilters = {}): Promise<JudgePaginationResponse> {
    const {
      search,
      is_active,
      page = 1,
      limit = 20,
      sort_by = 's_no',
      sort_order = 'ASC',
    } = filters;

    const conditions: string[] = [];
    const values: unknown[] = [];
    let p = 1;

    if (is_active !== undefined) {
      conditions.push(`is_active = $${p++}`);
      values.push(is_active);
    }

    if (search) {
      conditions.push(`(name ILIKE $${p} OR pj_number ILIKE $${p})`);
      values.push(`%${search}%`);
      p++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sortCol = sort_by || 's_no';
    const sortDir = sort_order === 'DESC' ? 'DESC' : 'ASC';
    const offset = (page - 1) * limit;

    const [countResult, dataResult] = await Promise.all([
      pool.query(`SELECT COUNT(*) AS total FROM judges ${where}`, values),
      pool.query(
        `SELECT * FROM judges ${where} ORDER BY ${sortCol} ${sortDir} LIMIT $${p} OFFSET $${p + 1}`,
        [...values, limit, offset]
      ),
    ]);

    const total = parseInt(countResult.rows[0]?.total ?? '0', 10);

    return {
      data: dataResult.rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  static async findById(id: string): Promise<Judge> {
    const { rows } = await pool.query(
      'SELECT * FROM judges WHERE id = $1',
      [id]
    );

    if (!rows[0]) {
      throw new AppError(404, 'Judge not found');
    }

    return rows[0];
  }

  static async findByPJNumber(pjNumber: string): Promise<Judge | null> {
    const { rows } = await pool.query(
      'SELECT * FROM judges WHERE pj_number = $1',
      [pjNumber]
    );
    return rows[0] || null;
  }

  static async searchByName(searchTerm: string): Promise<Judge[]> {
    const { rows } = await pool.query(
      `SELECT * FROM judges 
       WHERE is_active = true 
       AND name ILIKE $1 
       ORDER BY s_no ASC`,
      [`%${searchTerm}%`]
    );
    return rows;
  }

  static async create(input: CreateJudgeInput): Promise<Judge> {
    // Check if PJ number already exists
    const existing = await this.findByPJNumber(input.pj_number);
    if (existing) {
      throw new AppError(409, `Judge with PJ number ${input.pj_number} already exists`);
    }

    const { rows } = await pool.query(
      `INSERT INTO judges (s_no, name, pj_number, daily_dsa_rate)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [input.s_no, input.name, input.pj_number, input.daily_dsa_rate || 25000]
    );

    return rows[0];
  }

  static async update(id: string, input: UpdateJudgeInput): Promise<Judge> {
    // Check if judge exists
    await this.findById(id);

    // If updating PJ number, check uniqueness
    if (input.pj_number) {
      const existing = await this.findByPJNumber(input.pj_number);
      if (existing && existing.id !== id) {
        throw new AppError(409, `Judge with PJ number ${input.pj_number} already exists`);
      }
    }

    const updates: string[] = [];
    const values: unknown[] = [];
    let p = 1;

    if (input.s_no !== undefined) {
      updates.push(`s_no = $${p++}`);
      values.push(input.s_no);
    }
    if (input.name !== undefined) {
      updates.push(`name = $${p++}`);
      values.push(input.name);
    }
    if (input.pj_number !== undefined) {
      updates.push(`pj_number = $${p++}`);
      values.push(input.pj_number);
    }
    if (input.daily_dsa_rate !== undefined) {
      updates.push(`daily_dsa_rate = $${p++}`);
      values.push(input.daily_dsa_rate);
    }
    if (input.is_active !== undefined) {
      updates.push(`is_active = $${p++}`);
      values.push(input.is_active);
    }

    if (updates.length === 0) {
      throw new AppError(400, 'No fields to update');
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const { rows } = await pool.query(
      `UPDATE judges SET ${updates.join(', ')} WHERE id = $${p} RETURNING *`,
      values
    );

    return rows[0];
  }

  static async delete(id: string): Promise<void> {
    const result = await pool.query(
      'DELETE FROM judges WHERE id = $1 RETURNING id',
      [id]
    );

    if (!result.rows[0]) {
      throw new AppError(404, 'Judge not found');
    }
  }

  static async getStats(): Promise<JudgeStats> {
    const { rows } = await pool.query(
      `SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN is_active = true THEN 1 END) as active,
        COUNT(CASE WHEN is_active = false THEN 1 END) as inactive
       FROM judges`
    );
    return {
      total: parseInt(rows[0].total, 10),
      active: parseInt(rows[0].active, 10),
      inactive: parseInt(rows[0].inactive, 10),
    };
  }

  static async bulkCreate(judges: CreateJudgeInput[]): Promise<{ inserted: number; skipped: number }> {
    let inserted = 0;
    let skipped = 0;

    for (const judge of judges) {
      try {
        // Check if exists
        const existing = await this.findByPJNumber(judge.pj_number);
        if (existing) {
          skipped++;
          continue;
        }

        await this.create(judge);
        inserted++;
      } catch (error) {
        console.error(`Failed to insert judge ${judge.name}:`, error);
        skipped++;
      }
    }

    return { inserted, skipped };
  }
}