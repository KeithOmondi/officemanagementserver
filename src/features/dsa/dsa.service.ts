// src/features/dsa/dsa.service.ts
import { pool } from '../../config/db';
import { AppError } from '../../utils/response';
import type {
    DsaActivity,
    DsaStaffEntry,
    DsaStats,
    StaffEquitySuggestion,
    DsaEntryWithActivity,
} from './dsa.types';
import type {
    CreateActivityInput,
    UpdateActivityInput,
    AddStaffEntryInput,
    UpdateStaffEntryInput,
} from './dsa.validator';

// ── Constants ─────────────────────────────────────────────────────────────────
// Cast date columns to TEXT in YYYY-MM-DD format so the frontend
// <input type="date"> receives the correct format without timezone shifts.

const ACTIVITY_SELECT = `
    a.id,
    a.name,
    TO_CHAR(a.date_from, 'YYYY-MM-DD') AS date_from,
    TO_CHAR(a.date_to,   'YYYY-MM-DD') AS date_to,
    a.night_outs,
    a.created_by,
    a.is_active,
    a.created_at,
    a.updated_at,
    COUNT(DISTINCT e.id)::int          AS staff_count,
    COALESCE(SUM(e.total_kes), 0)::int AS total_kes
`;

const ACTIVITY_JOIN = `
    FROM dsa_activities a
    LEFT JOIN dsa_staff_entries e ON e.activity_id = a.id AND e.is_active = true
`;

const ENTRY_SELECT = `
    e.id,
    e.activity_id,
    a.name                             AS activity_name,
    TO_CHAR(a.date_from, 'YYYY-MM-DD') AS date_from,
    TO_CHAR(a.date_to,   'YYYY-MM-DD') AS date_to,
    a.night_outs,
    e.user_id,
    u.full_name,
    e.rate_per_night,
    e.total_kes,
    e.created_at,
    e.updated_at
`;

const ENTRY_JOIN = `
    FROM dsa_staff_entries e
    JOIN dsa_activities a ON a.id = e.activity_id AND a.is_active = true
    JOIN users u ON u.id = e.user_id AND u.is_active = true
`;

// ── Helper Functions ──────────────────────────────────────────────────────────

const calculateNightOuts = (dateFrom: string, dateTo: string): number => {
    const from = new Date(dateFrom);
    const to   = new Date(dateTo);
    const diffTime = Math.abs(to.getTime() - from.getTime());
    return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
};

// ── Service Class ─────────────────────────────────────────────────────────────

export class DsaService {

    // ── Statistics ────────────────────────────────────────────────────────────

    static async getStats(): Promise<DsaStats> {
        const { rows } = await pool.query(`
            SELECT
                COUNT(DISTINCT a.id)::int          AS total_activities,
                COALESCE(SUM(a.night_outs), 0)::int AS total_night_outs,
                COUNT(DISTINCT e.user_id)::int      AS staff_involved,
                COALESCE(SUM(e.total_kes), 0)::int  AS total_kes_payable
            FROM dsa_activities a
            LEFT JOIN dsa_staff_entries e ON e.activity_id = a.id AND e.is_active = true
            WHERE a.is_active = true
        `);
        return rows[0];
    }

    // ── Activities ────────────────────────────────────────────────────────────

    static async findAllActivities(): Promise<DsaActivity[]> {
        const { rows } = await pool.query(
            `SELECT ${ACTIVITY_SELECT} ${ACTIVITY_JOIN}
             WHERE a.is_active = true
             GROUP BY a.id
             ORDER BY a.date_from DESC, a.created_at DESC`
        );
        return rows;
    }

    static async findActivityById(id: string): Promise<DsaActivity | null> {
        const { rows } = await pool.query(
            `SELECT ${ACTIVITY_SELECT} ${ACTIVITY_JOIN}
             WHERE a.id = $1 AND a.is_active = true
             GROUP BY a.id`,
            [id]
        );
        return rows[0] || null;
    }

    static async createActivity(
        input: CreateActivityInput,
        createdBy: string
    ): Promise<DsaActivity> {
        const nightOuts = calculateNightOuts(input.date_from, input.date_to);

        const { rows } = await pool.query(
            `INSERT INTO dsa_activities (name, date_from, date_to, night_outs, created_by)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id`,
            [input.name.trim(), input.date_from, input.date_to, nightOuts, createdBy]
        );

        const activity = await this.findActivityById(rows[0].id);
        if (!activity) throw new AppError(500, 'Failed to create activity');
        return activity;
    }

    static async updateActivity(
        id: string,
        input: UpdateActivityInput
    ): Promise<DsaActivity> {
        const existing = await this.findActivityById(id);
        if (!existing) throw new AppError(404, 'Activity not found');

        const updates: string[] = [];
        const values: unknown[] = [];
        let p = 1;

        if (input.name !== undefined) {
            updates.push(`name = $${p++}`);
            values.push(input.name.trim());
        }
        if (input.is_active !== undefined) {
            updates.push(`is_active = $${p++}`);
            values.push(input.is_active);
        }

        const newFrom = input.date_from ?? existing.date_from;
        const newTo   = input.date_to   ?? existing.date_to;

        if (input.date_from !== undefined || input.date_to !== undefined) {
            const nightOuts = calculateNightOuts(newFrom, newTo);
            updates.push(`date_from = $${p++}`); values.push(newFrom);
            updates.push(`date_to   = $${p++}`); values.push(newTo);
            updates.push(`night_outs = $${p++}`); values.push(nightOuts);
        }

        if (updates.length === 0) return existing;

        updates.push(`updated_at = NOW()`);
        values.push(id);

        await pool.query(
            `UPDATE dsa_activities SET ${updates.join(', ')} WHERE id = $${p}`,
            values
        );

        const updated = await this.findActivityById(id);
        if (!updated) throw new AppError(500, 'Failed to update activity');
        return updated;
    }

    static async deleteActivity(id: string): Promise<void> {
        const { rows } = await pool.query(
            `UPDATE dsa_activities
             SET is_active = false, updated_at = NOW()
             WHERE id = $1 AND is_active = true
             RETURNING id`,
            [id]
        );
        if (rows.length === 0) throw new AppError(404, 'Activity not found');

        await pool.query(
            `UPDATE dsa_staff_entries
             SET is_active = false, updated_at = NOW()
             WHERE activity_id = $1 AND is_active = true`,
            [id]
        );
    }

    // ── Staff Entries ─────────────────────────────────────────────────────────

    static async getEntriesForActivity(activityId: string): Promise<DsaStaffEntry[]> {
        const { rows } = await pool.query(
            `SELECT ${ENTRY_SELECT} ${ENTRY_JOIN}
             WHERE e.activity_id = $1 AND e.is_active = true
             ORDER BY u.full_name ASC`,
            [activityId]
        );
        return rows;
    }

    static async addStaffEntry(
        activityId: string,
        input: AddStaffEntryInput
    ): Promise<DsaStaffEntry> {
        const activity = await this.findActivityById(activityId);
        if (!activity) throw new AppError(404, 'Activity not found');

        const { rows: userCheck } = await pool.query(
            `SELECT id FROM users WHERE id = $1 AND is_active = true`,
            [input.user_id]
        );
        if (userCheck.length === 0) throw new AppError(404, 'Staff member not found');

        const totalKes = activity.night_outs * input.rate_per_night;

        const { rows } = await pool.query(
            `INSERT INTO dsa_staff_entries (activity_id, user_id, rate_per_night, total_kes)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (activity_id, user_id)
             WHERE is_active = true DO NOTHING
             RETURNING id`,
            [activityId, input.user_id, input.rate_per_night, totalKes]
        );

        if (rows.length === 0) throw new AppError(409, 'Staff member already added to this activity');

        const { rows: entry } = await pool.query(
            `SELECT ${ENTRY_SELECT} ${ENTRY_JOIN} WHERE e.id = $1`,
            [rows[0].id]
        );
        return entry[0];
    }

    static async updateStaffEntry(
        activityId: string,
        entryId: string,
        input: UpdateStaffEntryInput
    ): Promise<DsaStaffEntry> {
        const activity = await this.findActivityById(activityId);
        if (!activity) throw new AppError(404, 'Activity not found');

        const totalKes = activity.night_outs * input.rate_per_night;

        const { rows } = await pool.query(
            `UPDATE dsa_staff_entries
             SET rate_per_night = $1, total_kes = $2, updated_at = NOW()
             WHERE id = $3 AND activity_id = $4 AND is_active = true
             RETURNING id`,
            [input.rate_per_night, totalKes, entryId, activityId]
        );
        if (rows.length === 0) throw new AppError(404, 'Entry not found');

        const { rows: entry } = await pool.query(
            `SELECT ${ENTRY_SELECT} ${ENTRY_JOIN} WHERE e.id = $1`,
            [entryId]
        );
        return entry[0];
    }

    static async removeStaffEntry(activityId: string, entryId: string): Promise<void> {
        const { rows } = await pool.query(
            `UPDATE dsa_staff_entries
             SET is_active = false, updated_at = NOW()
             WHERE id = $1 AND activity_id = $2 AND is_active = true
             RETURNING id`,
            [entryId, activityId]
        );
        if (rows.length === 0) throw new AppError(404, 'Entry not found');
    }

    // ── Equity Suggestions ────────────────────────────────────────────────────

    static async getEquitySuggestions(): Promise<StaffEquitySuggestion[]> {
        const { rows } = await pool.query(`
            SELECT
                u.id AS user_id,
                u.full_name,
                COALESCE(SUM(a.night_outs), 0)::int     AS total_nights,
                COUNT(DISTINCT e.activity_id)::int       AS total_activities,
                MAX(TO_CHAR(a.date_to, 'YYYY-MM-DD'))   AS last_sent
            FROM users u
            LEFT JOIN dsa_staff_entries e ON e.user_id = u.id AND e.is_active = true
            LEFT JOIN dsa_activities a ON a.id = e.activity_id AND a.is_active = true
            WHERE u.is_active = true
              AND u.role IN ('super_admin', 'dept_head', 'staff')
            GROUP BY u.id, u.full_name
            ORDER BY total_nights ASC, u.full_name ASC
        `);
        return rows;
    }

    // ── All Entries (for Export) ───────────────────────────────────────────────

    static async getAllEntries(): Promise<DsaEntryWithActivity[]> {
        const { rows } = await pool.query(`
            SELECT
                e.id,
                e.activity_id,
                a.name                             AS activity_name,
                TO_CHAR(a.date_from, 'YYYY-MM-DD') AS date_from,
                TO_CHAR(a.date_to,   'YYYY-MM-DD') AS date_to,
                a.night_outs,
                e.user_id,
                u.full_name,
                e.rate_per_night,
                e.total_kes,
                e.created_at,
                e.updated_at
            FROM dsa_staff_entries e
            JOIN dsa_activities a ON a.id = e.activity_id AND a.is_active = true
            JOIN users u ON u.id = e.user_id AND u.is_active = true
            WHERE e.is_active = true
            ORDER BY a.date_from DESC, u.full_name ASC
        `);
        return rows;
    }
}