// src/features/stations/stations.service.ts
import { pool } from '../../config/db';
import { AppError } from '../../utils/response';
import type { Station, StationPaginationResponse } from './stations.types';
import type { CreateStationInput, UpdateStationInput, StationFilters } from './stations.validator';

// ── SELECT fragment ───────────────────────────────────────────────────────────

const STATION_SELECT = `
  s.id, s.ref_no, s.name, s.type, s.location, s.is_active, s.created_at, s.updated_at
`;

const ALLOWED_SORT = new Set(['name', 'type', 'created_at', 'ref_no']);

// ── Service ───────────────────────────────────────────────────────────────────

export class StationService {

  // ── Create ──────────────────────────────────────────────────────────────────

  static async create(input: CreateStationInput): Promise<Station> {
    // If ref_no is provided, check if it already exists
    if (input.ref_no) {
      const { rows: existing } = await pool.query(
        `SELECT id FROM stations WHERE ref_no = $1`,
        [input.ref_no]
      );
      if (existing.length) {
        throw new AppError(409, `Station with reference ${input.ref_no} already exists`);
      }
    }

    // For court types, ref_no is required
    if (input.type !== 'sub_registry' && !input.ref_no) {
      throw new AppError(400, 'Reference number is required for courts');
    }

    const { rows } = await pool.query(
      `INSERT INTO stations (ref_no, name, type, location)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [input.ref_no ?? null, input.name.trim(), input.type, input.location?.trim() ?? null]
    );
    return (await this.findById(rows[0].id))!;
  }

  // ── Find all ─────────────────────────────────────────────────────────────────

  static async findAll(filters: StationFilters): Promise<StationPaginationResponse> {
    const {
      search, type,
      is_active,
      has_ref,
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
      conditions.push(`(s.name ILIKE $${p} OR s.location ILIKE $${p} OR s.ref_no ILIKE $${p})`);
      values.push(`%${search}%`); p++;
    }
    if (type)      { conditions.push(`s.type = $${p}`);      values.push(type);      p++; }
    if (is_active !== undefined) { conditions.push(`s.is_active = $${p}`); values.push(is_active); p++; }
    if (has_ref !== undefined) {
      if (has_ref) {
        conditions.push(`s.ref_no IS NOT NULL`);
      } else {
        conditions.push(`s.ref_no IS NULL`);
      }
    }

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

  // ── Find by reference number ───────────────────────────────────────────────

  static async findByRefNo(refNo: string): Promise<Station | null> {
    const { rows } = await pool.query(
      `SELECT ${STATION_SELECT} FROM stations s WHERE s.ref_no = $1`,
      [refNo]
    );
    return rows[0] ?? null;
  }

  // ── Update ────────────────────────────────────────────────────────────────────

  static async update(id: string, input: UpdateStationInput): Promise<Station> {
    const existing = await this.findById(id);
    if (!existing) throw new AppError(404, 'Station not found');

    // If ref_no is being updated, check for duplicates
    if (input.ref_no !== undefined && input.ref_no !== null) {
      const { rows: duplicate } = await pool.query(
        `SELECT id FROM stations WHERE ref_no = $1 AND id != $2`,
        [input.ref_no, id]
      );
      if (duplicate.length) {
        throw new AppError(409, `Station with reference ${input.ref_no} already exists`);
      }
    }

    const updates: string[] = [];
    const values: unknown[] = [];
    let p = 1;

    if (input.ref_no     !== undefined) { updates.push(`ref_no = $${p++}`);      values.push(input.ref_no); }
    if (input.name       !== undefined) { updates.push(`name = $${p++}`);        values.push(input.name.trim()); }
    if (input.type       !== undefined) { updates.push(`type = $${p++}`);        values.push(input.type); }
    if (input.location   !== undefined) { updates.push(`location = $${p++}`);    values.push(input.location?.trim() ?? null); }
    if (input.is_active  !== undefined) { updates.push(`is_active = $${p++}`);   values.push(input.is_active); }

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

    // Check if station has any active registry entries
    const { rows: entries } = await pool.query(
      `SELECT COUNT(*) FROM document_registry WHERE station_id = $1 AND is_active = true`,
      [id]
    );
    if (parseInt(entries[0].count, 10) > 0) {
      throw new AppError(409, 'Cannot delete station with active documents on record');
    }

    await pool.query(`DELETE FROM stations WHERE id = $1`, [id]);
  }

  // ── Get active stations with counts ─────────────────────────────────────────

  static async getActiveStationsWithCounts(): Promise<Station[]> {
    const { rows } = await pool.query(
      `SELECT ${STATION_SELECT},
              COUNT(reg.id) FILTER (WHERE reg.is_active = true) AS file_count
       FROM stations s
       LEFT JOIN document_registry reg ON reg.station_id = s.id
       WHERE s.is_active = true
       GROUP BY s.id
       ORDER BY s.name ASC`
    );
    return rows;
  }

  // ── Get stations by type ────────────────────────────────────────────────────

  static async findByType(type: string): Promise<Station[]> {
    const { rows } = await pool.query(
      `SELECT ${STATION_SELECT}
       FROM stations s
       WHERE s.type = $1 AND s.is_active = true
       ORDER BY s.name ASC`,
      [type]
    );
    return rows;
  }

  // ── Get court stations (non sub-registry) ───────────────────────────────────

  static async getCourtStations(): Promise<Station[]> {
    const { rows } = await pool.query(
      `SELECT ${STATION_SELECT}
       FROM stations s
       WHERE s.type != 'sub_registry' AND s.is_active = true
       ORDER BY s.ref_no ASC NULLS LAST, s.name ASC`
    );
    return rows;
  }
}