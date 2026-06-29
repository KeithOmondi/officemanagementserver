import { pool } from '../../config/db';
import { AppError } from '../../utils/response';
import type {
    VoteLine,
    FinancialActivity,
    ProBonoRequest,
    FinancialAuditEntry,
    MonthlyBudgetReport,
    FinancialStats,
    CreateVoteLineInput,
    UpdateVoteLineInput,
    CreateFinancialActivityInput,
    UpdateFinancialActivityInput,
    CreateProBonoInput,
    UpdateProBonoInput,
    CreateBudgetReportInput,
    ActivityFilters,
    ProBonoFilters,
} from './financial.types';

// ─── Constants ─────────────────────────────────────────────────────────────────

const VOTE_LINE_SELECT = `
    id, name, allocated, spent, committed, available,
    has_allocation, is_active, created_at, updated_at
`;

const ACTIVITY_SELECT = `
    id, activity, payee, vote_id, vote_name, amount,
    date, type, status, created_by, created_at, updated_at, is_active
`;

const PRO_BONO_SELECT = `
    id, organization, service_type, description, value,
    status, submitted_by, submitted_by_name, submitted_date,
    approved_by, approved_date, created_at, updated_at, is_active
`;

const AUDIT_SELECT = `
    id, actor, actor_name, action, detail, timestamp,
    entity_type, entity_id
`;

// ─── Service Class ────────────────────────────────────────────────────────────

export class FinancialService {

    // ─── Statistics ──────────────────────────────────────────────────────────

    static async getStats(): Promise<FinancialStats> {
    const { rows } = await pool.query(`
        SELECT
            (SELECT COALESCE(SUM(allocated), 0) FROM vote_lines WHERE is_active = true)::DECIMAL AS total_allocated,
            (SELECT COALESCE(SUM(amount), 0) FROM financial_activities WHERE status = 'Paid' AND is_active = true)::DECIMAL AS total_paid,
            (SELECT COALESCE(SUM(amount), 0) FROM financial_activities WHERE status = 'Pending' AND is_active = true)::DECIMAL AS committed_unpaid,
            (SELECT COUNT(*)::INTEGER FROM pro_bono_requests WHERE status = 'Approved' AND is_active = true) AS pro_bono_approved
    `);
    return rows[0];
}

    // ─── Vote Lines ──────────────────────────────────────────────────────────

    static async findAllVoteLines(): Promise<VoteLine[]> {
        const { rows } = await pool.query(
            `SELECT ${VOTE_LINE_SELECT} FROM vote_lines WHERE is_active = true ORDER BY name ASC`
        );
        return rows;
    }

    static async findVoteLineById(id: string): Promise<VoteLine | null> {
        const { rows } = await pool.query(
            `SELECT ${VOTE_LINE_SELECT} FROM vote_lines WHERE id = $1 AND is_active = true`,
            [id]
        );
        return rows[0] || null;
    }

    static async createVoteLine(input: CreateVoteLineInput): Promise<VoteLine> {
        const { rows } = await pool.query(
            `INSERT INTO vote_lines (name, allocated, available)
             VALUES ($1, $2, $2)
             RETURNING id`,
            [input.name.trim(), input.allocated || 0]
        );

        const voteLine = await this.findVoteLineById(rows[0].id);
        if (!voteLine) throw new AppError(500, 'Failed to create vote line');
        return voteLine;
    }

    static async updateVoteLine(id: string, input: UpdateVoteLineInput): Promise<VoteLine> {
        const existing = await this.findVoteLineById(id);
        if (!existing) {
            throw new AppError(404, 'Vote line not found');
        }

        const updates: string[] = [];
        const values: unknown[] = [];
        let paramCount = 1;

        if (input.name !== undefined) {
            updates.push(`name = $${paramCount++}`);
            values.push(input.name.trim());
        }
        if (input.allocated !== undefined) {
            updates.push(`allocated = $${paramCount++}`);
            values.push(input.allocated);
        }
        if (input.spent !== undefined) {
            updates.push(`spent = $${paramCount++}`);
            values.push(input.spent);
        }
        if (input.committed !== undefined) {
            updates.push(`committed = $${paramCount++}`);
            values.push(input.committed);
        }
        if (input.has_allocation !== undefined) {
            updates.push(`has_allocation = $${paramCount++}`);
            values.push(input.has_allocation);
        }
        if (input.is_active !== undefined) {
            updates.push(`is_active = $${paramCount++}`);
            values.push(input.is_active);
        }

        if (updates.length === 0) {
            return existing;
        }

        // Recalculate available
        updates.push(`available = allocated - spent - committed`);
        values.push(id);

        await pool.query(
            `UPDATE vote_lines SET ${updates.join(', ')} WHERE id = $${paramCount}`,
            values
        );

        const updated = await this.findVoteLineById(id);
        if (!updated) throw new AppError(500, 'Failed to update vote line');
        return updated;
    }

    static async deleteVoteLine(id: string): Promise<void> {
        const { rows } = await pool.query(
            `UPDATE vote_lines 
             SET is_active = false
             WHERE id = $1 AND is_active = true
             RETURNING id`,
            [id]
        );

        if (rows.length === 0) {
            throw new AppError(404, 'Vote line not found');
        }
    }

    // ─── Financial Activities ────────────────────────────────────────────────

    static async findAllActivities(filters: ActivityFilters = {}): Promise<FinancialActivity[]> {
        let query = `SELECT ${ACTIVITY_SELECT} FROM financial_activities WHERE is_active = true`;
        const params: unknown[] = [];
        let paramCount = 1;

        if (filters.search) {
            query += ` AND (activity ILIKE $${paramCount} OR payee ILIKE $${paramCount})`;
            params.push(`%${filters.search}%`);
            paramCount++;
        }

        if (filters.vote && filters.vote !== 'All Votes') {
            query += ` AND vote_name = $${paramCount}`;
            params.push(filters.vote);
            paramCount++;
        }

        if (filters.type && filters.type !== 'All Types') {
            query += ` AND type = $${paramCount}`;
            params.push(filters.type);
            paramCount++;
        }

        if (filters.status && filters.status !== 'All Statuses') {
            query += ` AND status = $${paramCount}`;
            params.push(filters.status);
            paramCount++;
        }

        query += ` ORDER BY date DESC, created_at DESC`;

        if (filters.limit) {
            query += ` LIMIT $${paramCount}`;
            params.push(filters.limit);
            paramCount++;
        }

        if (filters.offset) {
            query += ` OFFSET $${paramCount}`;
            params.push(filters.offset);
        }

        const { rows } = await pool.query(query, params);
        return rows;
    }

    static async findActivityById(id: string): Promise<FinancialActivity | null> {
        const { rows } = await pool.query(
            `SELECT ${ACTIVITY_SELECT} FROM financial_activities WHERE id = $1 AND is_active = true`,
            [id]
        );
        return rows[0] || null;
    }

    static async createActivity(
    input: CreateFinancialActivityInput,
    userId: string
): Promise<FinancialActivity> {
    const { rows } = await pool.query(
        `INSERT INTO financial_activities (
            activity, payee, vote_id, vote_name, amount, date, type, status, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id`,
        [
            input.activity.trim(),
            input.payee.trim(),
            input.vote_id || null,  // Handle null/undefined
            input.vote_name.trim(),
            input.amount,
            input.date,
            input.type,
            input.status || 'Pending',
            userId,
        ]
    );

    const activity = await this.findActivityById(rows[0].id);
    if (!activity) throw new AppError(500, 'Failed to create financial activity');
    return activity;
}

    static async updateActivity(
        id: string,
        input: UpdateFinancialActivityInput
    ): Promise<FinancialActivity> {
        const existing = await this.findActivityById(id);
        if (!existing) {
            throw new AppError(404, 'Financial activity not found');
        }

        const updates: string[] = [];
        const values: unknown[] = [];
        let paramCount = 1;

        if (input.activity !== undefined) {
            updates.push(`activity = $${paramCount++}`);
            values.push(input.activity.trim());
        }
        if (input.payee !== undefined) {
            updates.push(`payee = $${paramCount++}`);
            values.push(input.payee.trim());
        }
        if (input.vote_id !== undefined) {
            updates.push(`vote_id = $${paramCount++}`);
            values.push(input.vote_id);
        }
        if (input.vote_name !== undefined) {
            updates.push(`vote_name = $${paramCount++}`);
            values.push(input.vote_name.trim());
        }
        if (input.amount !== undefined) {
            updates.push(`amount = $${paramCount++}`);
            values.push(input.amount);
        }
        if (input.date !== undefined) {
            updates.push(`date = $${paramCount++}`);
            values.push(input.date);
        }
        if (input.type !== undefined) {
            updates.push(`type = $${paramCount++}`);
            values.push(input.type);
        }
        if (input.status !== undefined) {
            updates.push(`status = $${paramCount++}`);
            values.push(input.status);
        }
        if (input.is_active !== undefined) {
            updates.push(`is_active = $${paramCount++}`);
            values.push(input.is_active);
        }

        if (updates.length === 0) {
            return existing;
        }

        values.push(id);

        await pool.query(
            `UPDATE financial_activities SET ${updates.join(', ')} WHERE id = $${paramCount}`,
            values
        );

        const updated = await this.findActivityById(id);
        if (!updated) throw new AppError(500, 'Failed to update financial activity');
        return updated;
    }

    static async deleteActivity(id: string): Promise<void> {
        const { rows } = await pool.query(
            `UPDATE financial_activities 
             SET is_active = false
             WHERE id = $1 AND is_active = true
             RETURNING id`,
            [id]
        );

        if (rows.length === 0) {
            throw new AppError(404, 'Financial activity not found');
        }
    }

    // ─── Pro Bono Requests ──────────────────────────────────────────────────

    static async findAllProBono(filters: ProBonoFilters = {}): Promise<ProBonoRequest[]> {
        let query = `SELECT ${PRO_BONO_SELECT} FROM pro_bono_requests WHERE is_active = true`;
        const params: unknown[] = [];
        let paramCount = 1;

        if (filters.search) {
            query += ` AND (organization ILIKE $${paramCount} OR service_type ILIKE $${paramCount} OR description ILIKE $${paramCount})`;
            params.push(`%${filters.search}%`);
            paramCount++;
        }

        if (filters.status && filters.status !== 'All Statuses') {
            query += ` AND status = $${paramCount}`;
            params.push(filters.status);
            paramCount++;
        }

        query += ` ORDER BY submitted_date DESC, created_at DESC`;

        if (filters.limit) {
            query += ` LIMIT $${paramCount}`;
            params.push(filters.limit);
            paramCount++;
        }

        if (filters.offset) {
            query += ` OFFSET $${paramCount}`;
            params.push(filters.offset);
        }

        const { rows } = await pool.query(query, params);
        return rows;
    }

    static async findProBonoById(id: string): Promise<ProBonoRequest | null> {
        const { rows } = await pool.query(
            `SELECT ${PRO_BONO_SELECT} FROM pro_bono_requests WHERE id = $1 AND is_active = true`,
            [id]
        );
        return rows[0] || null;
    }

    static async createProBono(
        input: CreateProBonoInput,
        userId: string
    ): Promise<ProBonoRequest> {
        const { rows } = await pool.query(
            `INSERT INTO pro_bono_requests (
                organization, service_type, description, value, status,
                submitted_by, submitted_by_name, submitted_date
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id`,
            [
                input.organization.trim(),
                input.service_type.trim(),
                input.description || null,
                input.value,
                input.status || 'Pending',
                userId,
                input.submitted_by_name || null,
                input.submitted_date || new Date().toISOString().split('T')[0],
            ]
        );

        const request = await this.findProBonoById(rows[0].id);
        if (!request) throw new AppError(500, 'Failed to create pro bono request');
        return request;
    }

    static async updateProBono(
        id: string,
        input: UpdateProBonoInput,
        userId?: string
    ): Promise<ProBonoRequest> {
        const existing = await this.findProBonoById(id);
        if (!existing) {
            throw new AppError(404, 'Pro bono request not found');
        }

        const updates: string[] = [];
        const values: unknown[] = [];
        let paramCount = 1;

        if (input.organization !== undefined) {
            updates.push(`organization = $${paramCount++}`);
            values.push(input.organization.trim());
        }
        if (input.service_type !== undefined) {
            updates.push(`service_type = $${paramCount++}`);
            values.push(input.service_type.trim());
        }
        if (input.description !== undefined) {
            updates.push(`description = $${paramCount++}`);
            values.push(input.description);
        }
        if (input.value !== undefined) {
            updates.push(`value = $${paramCount++}`);
            values.push(input.value);
        }
        if (input.status !== undefined) {
            updates.push(`status = $${paramCount++}`);
            values.push(input.status);
            
            // If status is Approved or Completed, set approved_by and approved_date
            if (input.status === 'Approved' || input.status === 'Completed') {
                updates.push(`approved_by = $${paramCount++}`);
                values.push(userId || null);
                updates.push(`approved_date = NOW()`);
            }
        }
        if (input.is_active !== undefined) {
            updates.push(`is_active = $${paramCount++}`);
            values.push(input.is_active);
        }

        if (updates.length === 0) {
            return existing;
        }

        values.push(id);

        await pool.query(
            `UPDATE pro_bono_requests SET ${updates.join(', ')} WHERE id = $${paramCount}`,
            values
        );

        const updated = await this.findProBonoById(id);
        if (!updated) throw new AppError(500, 'Failed to update pro bono request');
        return updated;
    }

    static async deleteProBono(id: string): Promise<void> {
        const { rows } = await pool.query(
            `UPDATE pro_bono_requests 
             SET is_active = false
             WHERE id = $1 AND is_active = true
             RETURNING id`,
            [id]
        );

        if (rows.length === 0) {
            throw new AppError(404, 'Pro bono request not found');
        }
    }

    // ─── Audit Log ───────────────────────────────────────────────────────────

    static async getAuditLog(limit: number = 50): Promise<FinancialAuditEntry[]> {
        const { rows } = await pool.query(
            `SELECT ${AUDIT_SELECT} FROM financial_audit_log 
             WHERE is_active = true
             ORDER BY timestamp DESC
             LIMIT $1`,
            [limit]
        );
        return rows;
    }

    // ─── Monthly Budget Reports ──────────────────────────────────────────────

    static async createBudgetReport(
        input: CreateBudgetReportInput,
        userId: string
    ): Promise<MonthlyBudgetReport> {
        // Get current totals
        const { rows: totals } = await pool.query(`
            SELECT 
                COALESCE(SUM(allocated), 0) AS total_allocated,
                COALESCE(SUM(spent), 0) AS total_spent,
                COALESCE(SUM(committed), 0) AS total_committed,
                COALESCE(SUM(available), 0) AS total_available
            FROM vote_lines
            WHERE is_active = true
        `);

        const { rows } = await pool.query(
            `INSERT INTO monthly_budget_reports (
                report_month, total_allocated, total_spent, total_committed,
                total_available, submitted_by, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id`,
            [
                input.report_month,
                totals[0].total_allocated,
                totals[0].total_spent,
                totals[0].total_committed,
                totals[0].total_available,
                userId,
                'Draft',
            ]
        );

        const report = await this.findBudgetReportById(rows[0].id);
        if (!report) throw new AppError(500, 'Failed to create budget report');
        return report;
    }

    static async findBudgetReportById(id: string): Promise<MonthlyBudgetReport | null> {
        const { rows } = await pool.query(
            `SELECT * FROM monthly_budget_reports WHERE id = $1`,
            [id]
        );
        return rows[0] || null;
    }

    static async getAllBudgetReports(): Promise<MonthlyBudgetReport[]> {
        const { rows } = await pool.query(
            `SELECT * FROM monthly_budget_reports ORDER BY report_month DESC`
        );
        return rows;
    }

    static async submitBudgetReport(id: string, userId: string): Promise<MonthlyBudgetReport> {
        const existing = await this.findBudgetReportById(id);
        if (!existing) {
            throw new AppError(404, 'Budget report not found');
        }

        await pool.query(
            `UPDATE monthly_budget_reports 
             SET status = 'Submitted', submitted_date = NOW()
             WHERE id = $1`,
            [id]
        );

        const updated = await this.findBudgetReportById(id);
        if (!updated) throw new AppError(500, 'Failed to submit budget report');
        return updated;
    }

    static async approveBudgetReport(id: string, userId: string): Promise<MonthlyBudgetReport> {
        const existing = await this.findBudgetReportById(id);
        if (!existing) {
            throw new AppError(404, 'Budget report not found');
        }

        if (existing.status !== 'Submitted') {
            throw new AppError(400, 'Only submitted reports can be approved');
        }

        await pool.query(
            `UPDATE monthly_budget_reports 
             SET status = 'Approved', approved_by = $1, approved_date = NOW()
             WHERE id = $2`,
            [userId, id]
        );

        const updated = await this.findBudgetReportById(id);
        if (!updated) throw new AppError(500, 'Failed to approve budget report');
        return updated;
    }
}