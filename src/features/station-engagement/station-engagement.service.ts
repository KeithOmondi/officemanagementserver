// ============================================================
// src/features/station-engagement/station-engagement.service.ts
// ============================================================

import { pool } from '../../config/db';
import { AppError } from '../../utils/response';
import { SuccessionCourtCategory } from '../successioncourts/succession-courts.types';
import type {
  EngagementReportFilters,
  StationEngagementReport,
  CreateEngagementReportPayload,
  UpdateEngagementReportPayload,
  ReviewReportPayload,
  ReportSummary,
  EngagementStats,
  Urgency,
} from './station-engagement.types';
import { isReportEditable } from './station-engagement.types';

const ENGAGEMENT_REPORT_SELECT = `
  id, week_start, week_end, 
  categories, support_person_id, total_stations_assigned,
  executive_summary, engagements, unengaged_stations, escalations,
  additional_issues, recurring_patterns, priorities,
  submitted_by, submitted_at, reviewed_by, reviewed_at,
  approved_by, approved_at, status, feedback,
  created_at, updated_at
`;

// Use full_name from the users table
const ENGAGEMENT_REPORT_SELECT_WITH_DISPLAY = `
  r.id, r.week_start, r.week_end, 
  r.categories, r.support_person_id, r.total_stations_assigned,
  r.executive_summary, r.engagements, r.unengaged_stations, r.escalations,
  r.additional_issues, r.recurring_patterns, r.priorities,
  r.submitted_by, r.submitted_at, r.reviewed_by, r.reviewed_at,
  r.approved_by, r.approved_at, r.status, r.feedback,
  r.created_at, r.updated_at,
  submitter.full_name as submitted_by_display,
  reviewer.full_name as reviewed_by_display,
  approver.full_name as approved_by_display
`;

export class StationEngagementService {
  // ─── Create Report ──────────────────────────────────────────────────────

  static async createReport(
    input: CreateEngagementReportPayload,
    userId: string
  ): Promise<StationEngagementReport> {
    this.validateWeekRange(input.week_start, input.week_end);
    this.validateEngagements(input.engagements);
    this.validateEscalations(input.escalations);

    const { rows } = await pool.query(
      `INSERT INTO station_engagement_reports (
        week_start, week_end, categories, support_person_id, total_stations_assigned,
        executive_summary, engagements, unengaged_stations, escalations,
        additional_issues, recurring_patterns, priorities,
        submitted_by, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING ${ENGAGEMENT_REPORT_SELECT}`,
      [
        input.week_start,
        input.week_end,
        JSON.stringify(input.categories),
        input.support_person_id,
        input.total_stations_assigned,
        input.executive_summary,
        JSON.stringify(input.engagements || []),
        JSON.stringify(input.unengaged_stations || []),
        JSON.stringify(input.escalations || []),
        input.additional_issues || '',
        input.recurring_patterns || '',
        input.priorities || '',
        userId,
        'draft',
      ]
    );

    return await this.parseReportWithStationNames(rows[0]);
  }

  // ─── Find All Reports ──────────────────────────────────────────────────

  static async findAll(
    filters: EngagementReportFilters = {}
  ): Promise<{ data: StationEngagementReport[]; total: number; page: number; limit: number; totalPages: number }> {
    let query = `
      SELECT ${ENGAGEMENT_REPORT_SELECT_WITH_DISPLAY}
      FROM station_engagement_reports r
      LEFT JOIN users submitter ON submitter.id = r.submitted_by
      LEFT JOIN users reviewer ON reviewer.id = r.reviewed_by
      LEFT JOIN users approver ON approver.id = r.approved_by
      WHERE 1=1
    `;
    const params: unknown[] = [];
    let paramCount = 1;

    if (filters.category) {
      query += ` AND r.categories @> $${paramCount}::jsonb`;
      params.push(JSON.stringify([filters.category]));
      paramCount++;
    }
    if (filters.urgency) {
      query += ` AND (
        EXISTS (
          SELECT 1 FROM jsonb_array_elements(r.engagements::jsonb) AS e
          WHERE e->>'urgency' = $${paramCount}
        )
        OR EXISTS (
          SELECT 1 FROM jsonb_array_elements(r.escalations::jsonb) AS esc
          WHERE esc->>'urgency' = $${paramCount}
        )
      )`;
      params.push(filters.urgency);
      paramCount++;
    }
    if (filters.status) {
      query += ` AND r.status = $${paramCount}`;
      params.push(filters.status);
      paramCount++;
    }
    if (filters.week_start) {
      query += ` AND r.week_start >= $${paramCount}`;
      params.push(filters.week_start);
      paramCount++;
    }
    if (filters.week_end) {
      query += ` AND r.week_end <= $${paramCount}`;
      params.push(filters.week_end);
      paramCount++;
    }
    if (filters.submitted_by) {
      query += ` AND r.submitted_by = $${paramCount}`;
      params.push(filters.submitted_by);
      paramCount++;
    }
    if (filters.support_person_id) {
      query += ` AND r.support_person_id = $${paramCount}`;
      params.push(filters.support_person_id);
      paramCount++;
    }

    // Get total count
    const countQuery = `
      SELECT COUNT(r.id) as total
      FROM station_engagement_reports r
      WHERE 1=1
    `;
    
    let countWhere = '';
    const countParams: unknown[] = [];
    let countParamCount = 1;

    if (filters.category) {
      countWhere += ` AND r.categories @> $${countParamCount}::jsonb`;
      countParams.push(JSON.stringify([filters.category]));
      countParamCount++;
    }
    if (filters.urgency) {
      countWhere += ` AND (
        EXISTS (
          SELECT 1 FROM jsonb_array_elements(r.engagements::jsonb) AS e
          WHERE e->>'urgency' = $${countParamCount}
        )
        OR EXISTS (
          SELECT 1 FROM jsonb_array_elements(r.escalations::jsonb) AS esc
          WHERE esc->>'urgency' = $${countParamCount}
        )
      )`;
      countParams.push(filters.urgency);
      countParamCount++;
    }
    if (filters.status) {
      countWhere += ` AND r.status = $${countParamCount}`;
      countParams.push(filters.status);
      countParamCount++;
    }
    if (filters.week_start) {
      countWhere += ` AND r.week_start >= $${countParamCount}`;
      countParams.push(filters.week_start);
      countParamCount++;
    }
    if (filters.week_end) {
      countWhere += ` AND r.week_end <= $${countParamCount}`;
      countParams.push(filters.week_end);
      countParamCount++;
    }
    if (filters.submitted_by) {
      countWhere += ` AND r.submitted_by = $${countParamCount}`;
      countParams.push(filters.submitted_by);
      countParamCount++;
    }
    if (filters.support_person_id) {
      countWhere += ` AND r.support_person_id = $${countParamCount}`;
      countParams.push(filters.support_person_id);
      countParamCount++;
    }

    const countResult = await pool.query(countQuery + countWhere, countParams);
    const total = parseInt(countResult.rows[0]?.total || '0', 10);

    const limit = filters.limit || 20;
    const page = Math.max(1, Math.floor((filters.offset || 0) / limit) + 1);
    const offset = (page - 1) * limit;

    query += ` ORDER BY r.week_start DESC, r.updated_at DESC`;
    query += ` LIMIT $${paramCount}`;
    params.push(limit);
    paramCount++;
    query += ` OFFSET $${paramCount}`;
    params.push(offset);

    const { rows } = await pool.query(query, params);
    const data = await Promise.all(rows.map(row => this.parseReportWithStationNames(row)));

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ─── Find By ID ────────────────────────────────────────────────────────

  static async findById(id: string): Promise<StationEngagementReport | null> {
    const { rows } = await pool.query(
      `SELECT ${ENGAGEMENT_REPORT_SELECT_WITH_DISPLAY}
       FROM station_engagement_reports r
       LEFT JOIN users submitter ON submitter.id = r.submitted_by
       LEFT JOIN users reviewer ON reviewer.id = r.reviewed_by
       LEFT JOIN users approver ON approver.id = r.approved_by
       WHERE r.id = $1`,
      [id]
    );
    return rows[0] ? await this.parseReportWithStationNames(rows[0]) : null;
  }

  // ─── Update Report ─────────────────────────────────────────────────────

  static async updateReport(
    id: string,
    input: UpdateEngagementReportPayload,
    userId: string
  ): Promise<StationEngagementReport> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new AppError(404, 'Engagement report not found');
    }

    if (!isReportEditable(existing.status)) {
      throw new AppError(400, `Cannot update a report with status '${existing.status}'. Only draft or rejected reports can be edited.`);
    }

    if (input.engagements) {
      this.validateEngagements(input.engagements);
    }

    if (input.escalations) {
      this.validateEscalations(input.escalations);
    }

    const fields: string[] = [];
    const values: unknown[] = [];
    let paramCount = 1;

    const setField = (column: string, value: unknown, isJson: boolean = false) => {
      if (value !== undefined) {
        fields.push(`${column} = $${paramCount}`);
        values.push(isJson ? JSON.stringify(value) : value);
        paramCount++;
      }
    };

    setField('executive_summary', input.executive_summary);
    setField('engagements', input.engagements, true);
    setField('unengaged_stations', input.unengaged_stations, true);
    setField('escalations', input.escalations, true);
    setField('additional_issues', input.additional_issues);
    setField('recurring_patterns', input.recurring_patterns);
    setField('priorities', input.priorities);

    if (input.status && input.status !== existing.status) {
      if (input.status === 'draft' && existing.status === 'rejected') {
        setField('status', 'draft');
        setField('feedback', null);
      } else if (existing.status === 'draft' || existing.status === 'rejected') {
        setField('status', input.status);
      } else {
        throw new AppError(400, `Cannot change status from '${existing.status}' to '${input.status}'`);
      }
    }

    if (fields.length === 0) {
      return existing;
    }

    fields.push(`updated_at = now()`);
    values.push(id);

    await pool.query(
      `UPDATE station_engagement_reports
       SET ${fields.join(', ')}
       WHERE id = $${paramCount}`,
      values
    );

    const updated = await this.findById(id);
    if (!updated) throw new AppError(500, 'Failed to update engagement report');
    return updated;
  }

  // ─── Submit Report ─────────────────────────────────────────────────────

  static async submitReport(id: string, userId: string): Promise<StationEngagementReport> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new AppError(404, 'Engagement report not found');
    }

    if (existing.status === 'submitted' || existing.status === 'reviewed' || existing.status === 'approved') {
      throw new AppError(400, `Report with status '${existing.status}' cannot be submitted`);
    }

    const engagements = existing.engagements || [];
    const unengagedStations = existing.unengaged_stations || [];

    if (engagements.length === 0 && unengagedStations.length === 0) {
      throw new AppError(400, 'Cannot submit empty report. Add at least one engagement or unengaged station.');
    }

    this.validateWeekRange(existing.week_start, existing.week_end);

    const { rows } = await pool.query(
      `UPDATE station_engagement_reports
       SET status = 'submitted',
           submitted_by = $1,
           submitted_at = now(),
           updated_at = now()
       WHERE id = $2
       RETURNING ${ENGAGEMENT_REPORT_SELECT}`,
      [userId, id]
    );

    return await this.parseReportWithStationNames(rows[0]);
  }

  // ─── Review Report ─────────────────────────────────────────────────────

  static async reviewReport(
    id: string,
    input: ReviewReportPayload,
    reviewerId: string
  ): Promise<StationEngagementReport> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new AppError(404, 'Engagement report not found');
    }

    if (existing.status !== 'submitted') {
      throw new AppError(400, `Only submitted reports can be reviewed. Current status: ${existing.status}`);
    }

    const status = input.status;
    const feedback = input.feedback || '';

    let query = `
      UPDATE station_engagement_reports
      SET status = $1,
          feedback = $2,
          reviewed_by = $3,
          reviewed_at = now(),
          updated_at = now()
    `;

    const values: unknown[] = [status, feedback, reviewerId];

    if (status === 'approved') {
      query += `,
          approved_by = $4,
          approved_at = now()
      `;
      values.push(reviewerId);
      query += ` WHERE id = $5 RETURNING ${ENGAGEMENT_REPORT_SELECT}`;
    } else {
      query += ` WHERE id = $4 RETURNING ${ENGAGEMENT_REPORT_SELECT}`;
    }

    const { rows } = await pool.query(query, values);
    return await this.parseReportWithStationNames(rows[0]);
  }

  // ─── Delete Report ─────────────────────────────────────────────────────

  static async deleteReport(id: string): Promise<void> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new AppError(404, 'Engagement report not found');
    }

    if (!isReportEditable(existing.status)) {
      throw new AppError(400, `Cannot delete a report with status '${existing.status}'. Only draft or rejected reports can be deleted.`);
    }

    await pool.query(
      `DELETE FROM station_engagement_reports WHERE id = $1`,
      [id]
    );
  }

  // ─── Get Report Summary ─────────────────────────────────────────────────

  static async getReportSummary(id: string): Promise<ReportSummary | null> {
    const { rows } = await pool.query(
      `SELECT
        r.id,
        r.week_start,
        r.week_end,
        r.categories,
        r.total_stations_assigned as total_stations,
        COALESCE(jsonb_array_length(r.engagements::jsonb), 0) as engaged_count,
        COALESCE(jsonb_array_length(r.unengaged_stations::jsonb), 0) as unengaged_count,
        COALESCE(jsonb_array_length(r.escalations::jsonb), 0) as escalated_count,
        r.status,
        r.submitted_by,
        r.submitted_at
       FROM station_engagement_reports r
       WHERE r.id = $1`,
      [id]
    );

    if (!rows[0]) return null;

    const row = rows[0];
    return {
      id: row.id,
      week_start: row.week_start,
      week_end: row.week_end,
      categories: row.categories || [],
      total_stations: parseInt(row.total_stations, 10),
      engaged_count: parseInt(row.engaged_count, 10),
      unengaged_count: parseInt(row.unengaged_count, 10),
      escalated_count: parseInt(row.escalated_count, 10),
      status: row.status,
      submitted_by: row.submitted_by,
      submitted_at: row.submitted_at,
    };
  }

  // ─── Get Engagement Stats ──────────────────────────────────────────────

  static async getEngagementStats(
    category?: SuccessionCourtCategory,
    dateFrom?: string,
    dateTo?: string
  ): Promise<EngagementStats> {
    let query = `
      SELECT
        COUNT(*) as total_reports,
        COUNT(DISTINCT CASE WHEN categories @> '["A"]'::jsonb THEN id END) as category_a,
        COUNT(DISTINCT CASE WHEN categories @> '["B"]'::jsonb THEN id END) as category_b,
        COUNT(DISTINCT CASE WHEN categories @> '["C"]'::jsonb THEN id END) as category_c,
        COUNT(DISTINCT CASE WHEN categories @> '["D"]'::jsonb THEN id END) as category_d,
        COUNT(CASE WHEN status = 'draft' THEN 1 END) as status_draft,
        COUNT(CASE WHEN status = 'submitted' THEN 1 END) as status_submitted,
        COUNT(CASE WHEN status = 'reviewed' THEN 1 END) as status_reviewed,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as status_approved,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as status_rejected,
        COUNT(CASE WHEN EXISTS (
          SELECT 1 FROM jsonb_array_elements(engagements::jsonb) AS e
          WHERE e->>'urgency' = 'high'
        ) OR EXISTS (
          SELECT 1 FROM jsonb_array_elements(escalations::jsonb) AS esc
          WHERE esc->>'urgency' = 'high'
        ) THEN 1 END) as urgency_high,
        COUNT(CASE WHEN EXISTS (
          SELECT 1 FROM jsonb_array_elements(engagements::jsonb) AS e
          WHERE e->>'urgency' = 'medium'
        ) OR EXISTS (
          SELECT 1 FROM jsonb_array_elements(escalations::jsonb) AS esc
          WHERE esc->>'urgency' = 'medium'
        ) THEN 1 END) as urgency_medium,
        COUNT(CASE WHEN EXISTS (
          SELECT 1 FROM jsonb_array_elements(engagements::jsonb) AS e
          WHERE e->>'urgency' = 'low'
        ) OR EXISTS (
          SELECT 1 FROM jsonb_array_elements(escalations::jsonb) AS esc
          WHERE esc->>'urgency' = 'low'
        ) THEN 1 END) as urgency_low,
        AVG(COALESCE(jsonb_array_length(engagements::jsonb), 0)) as avg_engagements,
        AVG(COALESCE(jsonb_array_length(escalations::jsonb), 0)) as avg_escalations
      FROM station_engagement_reports
      WHERE 1=1
    `;

    const params: unknown[] = [];
    let paramCount = 1;

    if (category) {
      query += ` AND categories @> $${paramCount}::jsonb`;
      params.push(JSON.stringify([category]));
      paramCount++;
    }

    if (dateFrom) {
      query += ` AND week_start >= $${paramCount}`;
      params.push(dateFrom);
      paramCount++;
    }

    if (dateTo) {
      query += ` AND week_end <= $${paramCount}`;
      params.push(dateTo);
      paramCount++;
    }

    const { rows } = await pool.query(query, params);
    const stats = rows[0];

    return {
      total_reports: parseInt(stats.total_reports, 10) || 0,
      by_category: {
        A: parseInt(stats.category_a, 10) || 0,
        B: parseInt(stats.category_b, 10) || 0,
        C: parseInt(stats.category_c, 10) || 0,
        D: parseInt(stats.category_d, 10) || 0,
      },
      by_status: {
        draft: parseInt(stats.status_draft, 10) || 0,
        submitted: parseInt(stats.status_submitted, 10) || 0,
        reviewed: parseInt(stats.status_reviewed, 10) || 0,
        approved: parseInt(stats.status_approved, 10) || 0,
        rejected: parseInt(stats.status_rejected, 10) || 0,
      },
      by_urgency: {
        high: parseInt(stats.urgency_high, 10) || 0,
        medium: parseInt(stats.urgency_medium, 10) || 0,
        low: parseInt(stats.urgency_low, 10) || 0,
      },
      engagement_rate: parseFloat(stats.avg_engagements) || 0,
      escalation_rate: parseFloat(stats.avg_escalations) || 0,
    };
  }

  // ─── Get Reports by User ────────────────────────────────────────────────

  static async getReportsByUser(
    userId: string,
    filters: EngagementReportFilters = {}
  ): Promise<{ data: StationEngagementReport[]; total: number }> {
    let query = `
      SELECT ${ENGAGEMENT_REPORT_SELECT_WITH_DISPLAY}
      FROM station_engagement_reports r
      LEFT JOIN users submitter ON submitter.id = r.submitted_by
      LEFT JOIN users reviewer ON reviewer.id = r.reviewed_by
      LEFT JOIN users approver ON approver.id = r.approved_by
      WHERE r.submitted_by = $1
    `;
    const params: unknown[] = [userId];
    let paramCount = 2;

    if (filters.category) {
      query += ` AND r.categories @> $${paramCount}::jsonb`;
      params.push(JSON.stringify([filters.category]));
      paramCount++;
    }
    if (filters.status) {
      query += ` AND r.status = $${paramCount}`;
      params.push(filters.status);
      paramCount++;
    }

    const countQuery = query.replace(
      `SELECT ${ENGAGEMENT_REPORT_SELECT_WITH_DISPLAY}`,
      'SELECT COUNT(r.id) as total'
    );
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0]?.total || '0', 10);

    query += ` ORDER BY r.week_start DESC, r.updated_at DESC`;

    const { rows } = await pool.query(query, params);
    const data = await Promise.all(rows.map(row => this.parseReportWithStationNames(row)));

    return { data, total };
  }

  // ─── Get Reports by Reviewer ────────────────────────────────────────────

  static async getReportsByReviewer(
    reviewerId: string,
    filters: EngagementReportFilters = {}
  ): Promise<StationEngagementReport[]> {
    let query = `
      SELECT ${ENGAGEMENT_REPORT_SELECT_WITH_DISPLAY}
      FROM station_engagement_reports r
      LEFT JOIN users submitter ON submitter.id = r.submitted_by
      LEFT JOIN users reviewer ON reviewer.id = r.reviewed_by
      LEFT JOIN users approver ON approver.id = r.approved_by
      WHERE r.reviewed_by = $1
    `;
    const params: unknown[] = [reviewerId];
    let paramCount = 2;

    if (filters.category) {
      query += ` AND r.categories @> $${paramCount}::jsonb`;
      params.push(JSON.stringify([filters.category]));
      paramCount++;
    }
    if (filters.status) {
      query += ` AND r.status = $${paramCount}`;
      params.push(filters.status);
      paramCount++;
    }

    query += ` ORDER BY r.week_start DESC, r.updated_at DESC`;

    const { rows } = await pool.query(query, params);
    return await Promise.all(rows.map(row => this.parseReportWithStationNames(row)));
  }

  // ─── Get Reports by Week ────────────────────────────────────────────────

  static async getReportsByWeek(
    weekStart: string,
    weekEnd: string,
    filters: EngagementReportFilters = {}
  ): Promise<{ data: StationEngagementReport[]; total: number }> {
    let query = `
      SELECT ${ENGAGEMENT_REPORT_SELECT_WITH_DISPLAY}
      FROM station_engagement_reports r
      LEFT JOIN users submitter ON submitter.id = r.submitted_by
      LEFT JOIN users reviewer ON reviewer.id = r.reviewed_by
      LEFT JOIN users approver ON approver.id = r.approved_by
      WHERE r.week_start = $1 AND r.week_end = $2
    `;
    const params: unknown[] = [weekStart, weekEnd];
    let paramCount = 3;

    if (filters.category) {
      query += ` AND r.categories @> $${paramCount}::jsonb`;
      params.push(JSON.stringify([filters.category]));
      paramCount++;
    }
    if (filters.status) {
      query += ` AND r.status = $${paramCount}`;
      params.push(filters.status);
      paramCount++;
    }

    const countQuery = query.replace(
      `SELECT ${ENGAGEMENT_REPORT_SELECT_WITH_DISPLAY}`,
      'SELECT COUNT(r.id) as total'
    );
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0]?.total || '0', 10);

    query += ` ORDER BY r.categories ASC, r.updated_at DESC`;

    const { rows } = await pool.query(query, params);
    const data = await Promise.all(rows.map(row => this.parseReportWithStationNames(row)));

    return { data, total };
  }

  // ─── Helper Methods ─────────────────────────────────────────────────────

  private static validateWeekRange(weekStart: string, weekEnd: string): void {
    const start = new Date(weekStart);
    const end = new Date(weekEnd);
    const dayStart = start.getDay();
    const dayEnd = end.getDay();

    if (dayStart !== 1 || dayEnd !== 5) {
      throw new AppError(400, 'Week must start on Monday and end on Friday');
    }

    const diffTime = end.getTime() - start.getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    if (diffDays !== 4) {
      throw new AppError(400, 'Week must be exactly 5 days (Monday to Friday)');
    }
  }

  private static validateEngagements(engagements: any[]): void {
    if (!engagements || engagements.length === 0) return;

    for (const engagement of engagements) {
      if (engagement.status === 'escalated' && !engagement.urgency) {
        throw new AppError(400, `Engagement at station '${engagement.station_name}' has status 'escalated' but no urgency set`);
      }
      if (engagement.urgency && !engagement.why_needs_escalation) {
        throw new AppError(400, `Engagement at station '${engagement.station_name}' has urgency set but no escalation reason provided`);
      }
      if (!engagement.station_category) {
        throw new AppError(400, `Engagement at station '${engagement.station_name}' is missing station_category`);
      }
    }
  }

  private static validateEscalations(escalations: any[]): void {
    if (!escalations || escalations.length === 0) return;

    for (const escalation of escalations) {
      if (!escalation.urgency) {
        throw new AppError(400, `Escalation at station '${escalation.station_name}' is missing urgency`);
      }
    }
  }

  // ─── Parse Report with Station Names ───────────────────────────────────

  private static async parseReportWithStationNames(row: any): Promise<StationEngagementReport> {
    const report: StationEngagementReport = {
      id: row.id,
      week_start: row.week_start,
      week_end: row.week_end,
      categories: row.categories || [],
      support_person_id: row.support_person_id,
      total_stations_assigned: row.total_stations_assigned,
      executive_summary: row.executive_summary,
      engagements: row.engagements || [],
      unengaged_stations: row.unengaged_stations || [],
      escalations: row.escalations || [],
      additional_issues: row.additional_issues || '',
      recurring_patterns: row.recurring_patterns || '',
      priorities: row.priorities || '',
      submitted_by: row.submitted_by,
      submitted_at: row.submitted_at,
      reviewed_by: row.reviewed_by,
      reviewed_at: row.reviewed_at,
      approved_by: row.approved_by,
      approved_at: row.approved_at,
      status: row.status,
      feedback: row.feedback,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };

    // Collect all station IDs from engagements and unengaged stations
    const stationIds = new Set<string>();
    
    report.engagements?.forEach(e => {
      if (e.station_id) stationIds.add(e.station_id);
    });
    
    report.unengaged_stations?.forEach(s => {
      if (s.station_id) stationIds.add(s.station_id);
    });

    // Fetch station names from the database using the 'station' column
    if (stationIds.size > 0) {
      const ids = Array.from(stationIds);
      const { rows: stationRows } = await pool.query(
        `SELECT id, station FROM succession_courts WHERE id = ANY($1)`,
        [ids]
      );
      
      const stationNameMap = new Map();
      stationRows.forEach(row => {
        stationNameMap.set(row.id, row.station);
      });

      // Update engagements with station names
      report.engagements = report.engagements.map(engagement => ({
        ...engagement,
        station_name: stationNameMap.get(engagement.station_id) || engagement.station_name || engagement.station_id,
      }));

      // Update unengaged stations with station names
      report.unengaged_stations = report.unengaged_stations.map(station => ({
        ...station,
      station_name: stationNameMap.get(station.station_id) || station.station_name || station.station_id,
      }));
    }

    // Attach display names as extra properties
    Object.assign(report, {
      submitted_by_display: row.submitted_by_display || row.submitted_by,
      reviewed_by_display: row.reviewed_by_display || row.reviewed_by,
      approved_by_display: row.approved_by_display || row.approved_by,
    });

    return report;
  }
}