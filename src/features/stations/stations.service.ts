// src/features/stations/stations.service.ts
import { pool } from '../../config/db';
import { AppError } from '../../utils/response';
import type { Station, StationPaginationResponse } from './stations.types';
import type { CreateStationInput, UpdateStationInput, StationFilters } from './stations.validator';

// ── SELECT fragment ───────────────────────────────────────────────────────────

const STATION_SELECT = `
  s.id, s.name, s.type, s.location, s.is_active, s.created_at, s.updated_at
`;

const ALLOWED_SORT = new Set(['name', 'type', 'created_at']);

// ── Service ───────────────────────────────────────────────────────────────────

export class StationService {

  // ── Create ──────────────────────────────────────────────────────────────────

  static async create(input: CreateStationInput): Promise<Station> {
    const { rows } = await pool.query(
      `INSERT INTO stations (name, type, location)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [input.name.trim(), input.type, input.location?.trim() ?? null]
    );
    return (await this.findById(rows[0].id))!;
  }

  // ── Find all ─────────────────────────────────────────────────────────────────

  static async findAll(filters: StationFilters): Promise<StationPaginationResponse> {
    const {
      search, type,
      is_active,
      page = 1, limit = 20,
      sort_by = 'name', sort_order = 'ASC',
    } = filters;

    const sortCol = ALLOWED_SORT.has(sort_by ?? '') ? `s.${sort_by}` : 's.name';
    const sortDir = sort_order === 'DESC' ? 'DESC' : 'ASC';
    const offset  = (page - 1) * limit;

    const conditions: string[] = [];
    const values: unknown[]    = [];
    let p = 1;

    if (search) {
      conditions.push(`(s.name ILIKE $${p} OR s.location ILIKE $${p})`);
      values.push(`%${search}%`); p++;
    }
    if (type)      { conditions.push(`s.type = $${p}`);      values.push(type);      p++; }
    if (is_active !== undefined) { conditions.push(`s.is_active = $${p}`); values.push(is_active); p++; }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [countResult, dataResult] = await Promise.all([
      pool.query(`SELECT COUNT(*) AS total FROM stations s ${where}`, values),
      pool.query(
        `SELECT ${STATION_SELECT}
         FROM stations s
         ${where}
         ORDER BY ${sortCol} ${sortDir}
         LIMIT $${p} OFFSET $${p + 1}`,
        [...values, limit, offset]
      ),
    ]);

    const total = parseInt(countResult.rows[0]?.total ?? '0', 10);
    return {
      data:       dataResult.rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ── Find single ─────────────────────────────────────────────────────────────

  static async findById(id: string): Promise<Station | null> {
    const { rows } = await pool.query(
      `SELECT ${STATION_SELECT} FROM stations s WHERE s.id = $1`,
      [id]
    );
    return rows[0] ?? null;
  }

  // ── Update ────────────────────────────────────────────────────────────────────

  static async update(id: string, input: UpdateStationInput): Promise<Station> {
    const existing = await this.findById(id);
    if (!existing) throw new AppError(404, 'Station not found');

    const updates: string[] = [];
    const values: unknown[] = [];
    let p = 1;

    if (input.name      !== undefined) { updates.push(`name = $${p++}`);      values.push(input.name.trim()); }
    if (input.type      !== undefined) { updates.push(`type = $${p++}`);      values.push(input.type); }
    if (input.location  !== undefined) { updates.push(`location = $${p++}`);  values.push(input.location.trim()); }
    if (input.is_active !== undefined) { updates.push(`is_active = $${p++}`); values.push(input.is_active); }

    if (!updates.length) return existing;

    updates.push(`updated_at = NOW()`);
    values.push(id);

    await pool.query(
      `UPDATE stations SET ${updates.join(', ')} WHERE id = $${p}`,
      values
    );
    return (await this.findById(id))!;
  }

  // ── Delete ────────────────────────────────────────────────────────────────────

  static async delete(id: string): Promise<void> {
    const existing = await this.findById(id);
    if (!existing) throw new AppError(404, 'Station not found');

    await pool.query(`DELETE FROM stations WHERE id = $1`, [id]);
  }
}