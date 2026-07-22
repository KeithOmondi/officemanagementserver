// src/services/aide.service.ts

import { pool } from '../../config/db';
import { AppError } from '../../utils/response';
import type {
  CreateAideRequestInput,
  UpdateAideRequestInput,
  AideRequestFilters,
  AideRequest,
  AideRequestStats,
  AideStatus,
  OfficerRank,
  UnitType,
} from './aides.types';

// ─── SELECT fragments ──────────────────────────────────────────────────────────

const AIDE_SELECT = `
  ar.id, ar.judge_name, ar.officer_rank, ar.officer_name,
  ar.employment_number, ar.current_station, ar.current_unit,
  ar.proposed_assignment, ar.reporting_date,
  ar.status, ar.remarks,
  ar.created_by, u.full_name AS created_by_name,
  ar.created_at, ar.updated_at
`;

const AIDE_JOIN = `
  FROM aide_requests ar
  LEFT JOIN users u ON u.id = ar.created_by
`;

const ALLOWED_SORT = new Set(['created_at', 'updated_at', 'judge_name', 'status']);

// ─── Custom Error Classes ─────────────────────────────────────────────────────

export class AideRequestNotFoundError extends AppError {
  constructor(id: string) {
    super(404, `Aide request with ID "${id}" not found`);
    this.name = 'AideRequestNotFoundError';
  }
}

export class AideRequestDuplicateError extends AppError {
  constructor() {
    super(409, 'A duplicate aide request already exists');
    this.name = 'AideRequestDuplicateError';
  }
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class AideService {
  // ─── Create ─────────────────────────────────────────────────────────────────

  /**
   * Create a new aide request
   */
  static async createAideRequest(
    data: CreateAideRequestInput,
    userId: string,
    userName: string
  ): Promise<AideRequest> {
    console.log('[AideService] Creating aide request...');

    try {
      const { rows } = await pool.query(
        `INSERT INTO aide_requests
          (judge_name, officer_rank, officer_name, employment_number,
           current_station, current_unit, proposed_assignment,
           reporting_date, status, remarks, created_by, created_by_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING id`,
        [
          data.judge_name.trim(),
          data.officer_rank,
          data.officer_name.trim(),
          data.employment_number.trim(),
          data.current_station.trim(),
          data.current_unit,
          data.proposed_assignment.trim(),
          this.normalizeDate(data.reporting_date),
          data.status || 'in_progress',
          data.remarks?.trim() || null,
          userId,
          userName,
        ]
      );

      console.log(`[AideService] Aide request created with ID: ${rows[0].id}`);
      return (await this.findById(rows[0].id))!;
    } catch (error: any) {
      // Check for unique constraint violation
      if (error.code === '23505') {
        throw new AideRequestDuplicateError();
      }
      console.error('[AideService] Error creating aide request:', error);
      throw error;
    }
  }

  // ─── Read ────────────────────────────────────────────────────────────────────

  /**
   * Get all aide requests with pagination and filters
   */
  static async getAideRequests(
    filters: AideRequestFilters
  ): Promise<{
    data: AideRequest[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const {
      status,
      judge_name,
      officer_name,
      current_station,
      page = 1,
      limit = 20,
      sort_by = 'created_at',
      sort_order = 'DESC',
    } = filters;

    const sortCol = ALLOWED_SORT.has(sort_by) ? `ar.${sort_by}` : 'ar.created_at';
    const sortDir = sort_order === 'ASC' ? 'ASC' : 'DESC';
    const offset = (page - 1) * limit;

    const conditions: string[] = ['ar.is_active = true'];
    const values: unknown[] = [];
    let p = 1;

    if (status) {
      conditions.push(`ar.status = $${p}`);
      values.push(status);
      p++;
    }

    if (judge_name) {
      conditions.push(`ar.judge_name ILIKE $${p}`);
      values.push(`%${judge_name}%`);
      p++;
    }

    if (officer_name) {
      conditions.push(`ar.officer_name ILIKE $${p}`);
      values.push(`%${officer_name}%`);
      p++;
    }

    if (current_station) {
      conditions.push(`ar.current_station ILIKE $${p}`);
      values.push(`%${current_station}%`);
      p++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [countResult, dataResult] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) AS total ${AIDE_JOIN} ${where}`,
        values
      ),
      pool.query(
        `SELECT ${AIDE_SELECT} ${AIDE_JOIN}
         ${where}
         ORDER BY ${sortCol} ${sortDir}
         LIMIT $${p} OFFSET $${p + 1}`,
        [...values, limit, offset]
      ),
    ]);

    const total = parseInt(countResult.rows[0]?.total ?? '0', 10);
    return {
      data: dataResult.rows.map(this.mapToAideRequest),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get a single aide request by ID
   */
  static async findById(id: string): Promise<AideRequest | null> {
    const { rows } = await pool.query(
      `SELECT ${AIDE_SELECT} ${AIDE_JOIN}
       WHERE ar.id = $1 AND ar.is_active = true`,
      [id]
    );
    return rows[0] ? this.mapToAideRequest(rows[0]) : null;
  }

  /**
   * Get a single aide request by ID (throws if not found)
   */
  static async findByIdOrThrow(id: string): Promise<AideRequest> {
    const result = await this.findById(id);
    if (!result) {
      throw new AideRequestNotFoundError(id);
    }
    return result;
  }

  // ─── Update ──────────────────────────────────────────────────────────────────

  /**
   * Update an aide request
   */
  static async updateAideRequest(
    id: string,
    data: UpdateAideRequestInput
  ): Promise<AideRequest> {
    console.log(`[AideService] Updating aide request ${id}`);

    // Check if exists
    await this.findByIdOrThrow(id);

    const updates: string[] = [];
    const values: unknown[] = [];
    let p = 1;

    if (data.judge_name !== undefined) {
      updates.push(`judge_name = $${p++}`);
      values.push(data.judge_name.trim());
    }
    if (data.officer_rank !== undefined) {
      updates.push(`officer_rank = $${p++}`);
      values.push(data.officer_rank);
    }
    if (data.officer_name !== undefined) {
      updates.push(`officer_name = $${p++}`);
      values.push(data.officer_name.trim());
    }
    if (data.employment_number !== undefined) {
      updates.push(`employment_number = $${p++}`);
      values.push(data.employment_number.trim());
    }
    if (data.current_station !== undefined) {
      updates.push(`current_station = $${p++}`);
      values.push(data.current_station.trim());
    }
    if (data.current_unit !== undefined) {
      updates.push(`current_unit = $${p++}`);
      values.push(data.current_unit);
    }
    if (data.proposed_assignment !== undefined) {
      updates.push(`proposed_assignment = $${p++}`);
      values.push(data.proposed_assignment.trim());
    }
    if (data.reporting_date !== undefined) {
      updates.push(`reporting_date = $${p++}`);
      values.push(this.normalizeDate(data.reporting_date));
    }
    if (data.status !== undefined) {
      updates.push(`status = $${p++}`);
      values.push(data.status);
    }
    if (data.remarks !== undefined) {
      updates.push(`remarks = $${p++}`);
      values.push(data.remarks?.trim() || null);
    }

    if (!updates.length) {
      throw new AppError(400, 'No fields to update');
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    await pool.query(
      `UPDATE aide_requests SET ${updates.join(', ')} WHERE id = $${p}`,
      values
    );

    console.log(`[AideService] Aide request ${id} updated successfully`);
    return (await this.findById(id))!;
  }

  // ─── Delete ──────────────────────────────────────────────────────────────────

  /**
   * Delete an aide request (soft delete)
   */
  static async deleteAideRequest(id: string): Promise<void> {
    console.log(`[AideService] Deleting aide request ${id}`);

    const existing = await this.findById(id);
    if (!existing) {
      throw new AideRequestNotFoundError(id);
    }

    await pool.query(
      `UPDATE aide_requests SET is_active = false, updated_at = NOW() WHERE id = $1`,
      [id]
    );

    console.log(`[AideService] Aide request ${id} deleted successfully`);
  }

  // ─── Stats ──────────────────────────────────────────────────────────────────

  /**
   * Get statistics for aide requests
   */
  static async getAideStats(startDate?: string, endDate?: string): Promise<AideRequestStats> {
    const conditions: string[] = ['ar.is_active = true'];
    const values: unknown[] = [];
    let p = 1;

    if (startDate) {
      conditions.push(`ar.created_at >= $${p}`);
      values.push(new Date(startDate));
      p++;
    }

    if (endDate) {
      conditions.push(`ar.created_at <= $${p}`);
      values.push(new Date(endDate));
      p++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [totalResult, statusResult, stationResult, unitResult] = await Promise.all([
      pool.query(`SELECT COUNT(*) AS total ${AIDE_JOIN} ${where}`, values),
      pool.query(
        `SELECT status, COUNT(*) AS count ${AIDE_JOIN} ${where}
         GROUP BY status`,
        values
      ),
      pool.query(
        `SELECT current_station, COUNT(*) AS count ${AIDE_JOIN} ${where}
         GROUP BY current_station
         ORDER BY count DESC`,
        values
      ),
      pool.query(
        `SELECT current_unit, COUNT(*) AS count ${AIDE_JOIN} ${where}
         GROUP BY current_unit
         ORDER BY count DESC`,
        values
      ),
    ]);

    const total = parseInt(totalResult.rows[0]?.total ?? '0', 10);

    const statusMap = statusResult.rows.reduce((acc: Record<string, number>, row) => {
      acc[row.status] = parseInt(row.count, 10);
      return acc;
    }, {});

    const stationMap = stationResult.rows.reduce((acc: Record<string, number>, row) => {
      acc[row.current_station] = parseInt(row.count, 10);
      return acc;
    }, {});

    const unitMap = unitResult.rows.reduce((acc: Record<string, number>, row) => {
      acc[row.current_unit] = parseInt(row.count, 10);
      return acc;
    }, {});

    return {
      total,
      in_progress: statusMap['in_progress'] || 0,
      rejected: statusMap['rejected'] || 0,
      attached: statusMap['attached'] || 0,
      by_station: stationMap,
      by_unit: unitMap,
    };
  }

  // ─── Private Helpers ────────────────────────────────────────────────────────

  /**
   * Normalize date input to Date object
   */
  private static normalizeDate(date: Date | string): Date {
    return typeof date === 'string' ? new Date(date) : date;
  }

  /**
   * Map database row to AideRequest type
   */
  private static mapToAideRequest(row: any): AideRequest {
    return {
      id: row.id,
      judge_name: row.judge_name,
      officer_rank: row.officer_rank as OfficerRank,
      officer_name: row.officer_name,
      employment_number: row.employment_number,
      current_station: row.current_station,
      current_unit: row.current_unit as UnitType,
      proposed_assignment: row.proposed_assignment,
      reporting_date: row.reporting_date,
      status: row.status as AideStatus,
      remarks: row.remarks,
      created_by: row.created_by,
      created_by_name: row.created_by_name,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

// ─── Export singleton ────────────────────────────────────────────────────────

export default new AideService();