// src/features/service-week/service-week.service.ts

import { pool } from '../../config/db';
import { AppError } from '../../utils/response';
import type {
  ServiceWeekReport,
  CreateServiceWeekPayload,
  UpdateServiceWeekPayload,
  ServiceWeekFilters,
  ServiceWeekStatus,
} from './service-week.types';

const REPORT_SELECT = `
  id, station, division, week_start, week_end, date, judge_name,
  cases, status, 
  prepared_by, prepared_designation, prepared_signature, prepared_date,
  created_by, created_at, updated_at, submitted_at
`;

export class ServiceWeekService {
  // ══════════════════════════════════════════════════════════════════════
  // PUBLIC (no-auth) — user side. Anonymous submitters, identified only
  // by knowledge of their report's id (no accounts, no ownership check).
  // ══════════════════════════════════════════════════════════════════════

  // ─── Create Report ──────────────────────────────────────────────────────

  static async createReport(input: CreateServiceWeekPayload): Promise<ServiceWeekReport> {
    const status: ServiceWeekStatus = input.saveAsDraft ? 'draft' : 'submitted';
    const submittedAt = input.saveAsDraft ? null : new Date().toISOString();

    const { rows } = await pool.query(
      `INSERT INTO service_week_reports (
        station, division, week_start, week_end, date, judge_name,
        cases, status,
        prepared_by, prepared_designation, prepared_signature, prepared_date,
        created_by, submitted_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING ${REPORT_SELECT}`,
      [
        input.station,
        input.division || null,
        input.week_start,
        input.week_end,
        input.date,
        input.judge_name,
        JSON.stringify(input.cases),
        status,
        input.prepared_by,
        input.prepared_designation,
        null,
        input.prepared_date || null,
        null, // created_by — always null; there is no logged-in submitter on this route
        submittedAt,
      ]
    );

    return this.parseReport(rows[0]);
  }

  // ─── Find By ID ────────────────────────────────────────────────────────
  // Shared by both sides: public users fetch their own report by id
  // (the id itself is the only "credential"); admins use it to view any
  // report from the browse list.

  static async findById(id: string): Promise<ServiceWeekReport | null> {
    const { rows } = await pool.query(
      `SELECT ${REPORT_SELECT} FROM service_week_reports WHERE id = $1`,
      [id]
    );
    return rows[0] ? this.parseReport(rows[0]) : null;
  }

  // ─── Update Report ─────────────────────────────────────────────────────

  static async updateReport(
    id: string,
    input: UpdateServiceWeekPayload
  ): Promise<ServiceWeekReport> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new AppError(404, 'Service week report not found');
    }

    if (existing.status === 'submitted') {
      throw new AppError(400, 'Cannot edit a submitted report. Please create a new one.');
    }

    const fields: string[] = [];
    const values: unknown[] = [];
    let paramCount = 1;

    const setField = (column: string, value: unknown) => {
      if (value !== undefined) {
        fields.push(`${column} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    };

    setField('station', input.station);
    setField('division', input.division);
    setField('week_start', input.week_start);
    setField('week_end', input.week_end);
    setField('date', input.date);
    setField('judge_name', input.judge_name);

    if (input.cases !== undefined) {
      fields.push(`cases = $${paramCount}`);
      values.push(JSON.stringify(input.cases));
      paramCount++;
    }

    setField('prepared_by', input.prepared_by);
    setField('prepared_designation', input.prepared_designation);
    setField('prepared_date', input.prepared_date);

    if (input.status) {
      setField('status', input.status);
      if (input.status === 'submitted') {
        setField('submitted_at', new Date().toISOString());
      }
    }

    if (fields.length === 0) {
      return existing;
    }

    fields.push(`updated_at = now()`);
    values.push(id);

    await pool.query(
      `UPDATE service_week_reports SET ${fields.join(', ')} WHERE id = $${paramCount}`,
      values
    );

    const updated = await this.findById(id);
    if (!updated) throw new AppError(500, 'Failed to update service week report');
    return updated;
  }

  // ─── Submit Report (Draft → Submitted) ──────────────────────────────────

  static async submitReport(id: string): Promise<ServiceWeekReport> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new AppError(404, 'Service week report not found');
    }

    if (existing.status === 'submitted') {
      throw new AppError(400, 'Report is already submitted');
    }

    if (!existing.cases || existing.cases.length === 0) {
      throw new AppError(400, 'Cannot submit empty report. Add at least one case.');
    }

    const { rows } = await pool.query(
      `UPDATE service_week_reports 
       SET status = 'submitted', 
           submitted_at = now(),
           updated_at = now()
       WHERE id = $1
       RETURNING ${REPORT_SELECT}`,
      [id]
    );

    return this.parseReport(rows[0]);
  }

  // ══════════════════════════════════════════════════════════════════════
  // ADMIN (auth required) — read + generate only. Admins never create,
  // edit, or submit report content; they browse what's already been sent
  // and produce PDFs/summaries from it.
  // ══════════════════════════════════════════════════════════════════════

  // ─── Find All Reports (browse/list) ─────────────────────────────────────

  static async findAll(
    filters: ServiceWeekFilters = {}
  ): Promise<{ data: ServiceWeekReport[]; total: number; page: number; limit: number; totalPages: number }> {
    let query = `SELECT ${REPORT_SELECT} FROM service_week_reports WHERE 1=1`;
    const params: unknown[] = [];
    let paramCount = 1;

    if (filters.station) {
      query += ` AND station ILIKE $${paramCount}`;
      params.push(`%${filters.station}%`);
      paramCount++;
    }

    if (filters.judge_name) {
      query += ` AND judge_name ILIKE $${paramCount}`;
      params.push(`%${filters.judge_name}%`);
      paramCount++;
    }

    if (filters.week_start) {
      query += ` AND week_start >= $${paramCount}`;
      params.push(filters.week_start);
      paramCount++;
    }

    if (filters.week_end) {
      query += ` AND week_end <= $${paramCount}`;
      params.push(filters.week_end);
      paramCount++;
    }

    if (filters.status) {
      query += ` AND status = $${paramCount}`;
      params.push(filters.status);
      paramCount++;
    }

    const countQuery = `SELECT COUNT(*) as total FROM service_week_reports WHERE 1=1`;
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0]?.total || '0', 10);

    const limit = filters.limit || 20;
    const page = Math.max(1, Math.floor((filters.offset || 0) / limit) + 1);
    const offset = (page - 1) * limit;

    query += ` ORDER BY created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const { rows } = await pool.query(query, params);
    const data = rows.map(row => this.parseReport(row));

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ─── Delete Report (moderation) ─────────────────────────────────────────

  static async deleteReport(id: string): Promise<void> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new AppError(404, 'Service week report not found');
    }

    if (existing.status === 'submitted') {
      throw new AppError(400, 'Cannot delete a submitted report.');
    }

    await pool.query(`DELETE FROM service_week_reports WHERE id = $1`, [id]);
  }

  // ─── Aggregate Summary (for admin's rollup report) ──────────────────────
  // Pulls every submitted report matching the filters (e.g. a given
  // week range and/or station) so the export layer can combine them into
  // one weekly summary PDF, rather than a single per-report PDF.

  static async findForSummary(filters: ServiceWeekFilters): Promise<ServiceWeekReport[]> {
    let query = `SELECT ${REPORT_SELECT} FROM service_week_reports WHERE status = 'submitted'`;
    const params: unknown[] = [];
    let paramCount = 1;

    if (filters.station) {
      query += ` AND station ILIKE $${paramCount}`;
      params.push(`%${filters.station}%`);
      paramCount++;
    }

    if (filters.week_start) {
      query += ` AND week_start >= $${paramCount}`;
      params.push(filters.week_start);
      paramCount++;
    }

    if (filters.week_end) {
      query += ` AND week_end <= $${paramCount}`;
      params.push(filters.week_end);
      paramCount++;
    }

    query += ` ORDER BY station ASC, judge_name ASC, week_start ASC`;

    const { rows } = await pool.query(query, params);
    return rows.map(row => this.parseReport(row));
  }

  // ─── Parse Report ─────────────────────────────────────────────────────

  private static parseReport(row: any): ServiceWeekReport {
    return {
      id: row.id,
      station: row.station,
      division: row.division,
      week_start: row.week_start,
      week_end: row.week_end,
      date: row.date,
      judge_name: row.judge_name,
      cases: row.cases || [],
      status: row.status || 'draft',
      prepared_by: row.prepared_by,
      prepared_designation: row.prepared_designation,
      prepared_signature: row.prepared_signature,
      prepared_date: row.prepared_date,
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
      submitted_at: row.submitted_at,
    };
  }
}