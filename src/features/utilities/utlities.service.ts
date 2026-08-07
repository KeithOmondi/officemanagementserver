// ============================================================
// utilities.service.ts
// ============================================================

import { pool } from '../../config/db';
import type { PoolClient } from 'pg';
import { AppError } from '../../utils/response';
import type {
    JudgeUtility,
    UtilityItem,
    UtilityFilters,
    CreateUtilityInput,
    AddUtilityItemInput,
    UpdateUtilityItemInput,
    UpdateUtilityInput,
    DeleteUtilityItemInput,
    DeleteUtilityInput,
    GenerateMemoInput,
    ConsolidatedMemo,
    MemoFilters,
    UtilityApprovalStatus,
    ConsolidatedMemoType,
    UtilityStatus,
} from './utilities.types';

// ─── Constants ─────────────────────────────────────────────────────────────────

const UTILITY_REQUEST_SELECT = `
    id, pj_number, judge_name, created_by, created_at, updated_at
`;

const UTILITY_ITEM_SELECT = `
    id, request_id, utility_type, requisition_number, amount::float8 AS amount, period, description,
    date_received, date_forwarded_dass, date_paid, status,
    supporting_document_url, 
    approval_status, memo_id, memo_sent_at,
    created_at, updated_at
`;

const CONSOLIDATED_MEMO_SELECT = `
    id, type, entity_id, title, period, generated_at, sent_at, approved_at, rejected_at,
    status, utility_item_ids, total_amount::float8 AS total_amount,
    created_by, created_at, updated_at
`;

// ─── Service Class ────────────────────────────────────────────────────────────

export class UtilitiesService {

    // ============================================================
    // JUDGE UTILITIES
    // ============================================================

    private static async getUtilityItems(requestId: string): Promise<UtilityItem[]> {
        const { rows } = await pool.query(
            `SELECT ${UTILITY_ITEM_SELECT}
             FROM utilities_items
             WHERE request_id = $1 AND is_active = true
             ORDER BY created_at ASC`,
            [requestId]
        );
        return rows;
    }

    static async findAllUtilities(filters: UtilityFilters = {}): Promise<JudgeUtility[]> {
        let query = `SELECT ${UTILITY_REQUEST_SELECT} FROM utilities_requests WHERE is_active = true`;
        const params: unknown[] = [];
        let paramCount = 1;

        if (filters.search) {
            query += ` AND (judge_name ILIKE $${paramCount} OR pj_number ILIKE $${paramCount})`;
            params.push(`%${filters.search}%`);
            paramCount++;
        }
        if (filters.judge_name) {
            query += ` AND judge_name ILIKE $${paramCount}`;
            params.push(`%${filters.judge_name}%`);
            paramCount++;
        }
        if (filters.pj_number) {
            query += ` AND pj_number ILIKE $${paramCount}`;
            params.push(`%${filters.pj_number}%`);
            paramCount++;
        }

        query += ` ORDER BY created_at DESC`;
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

        for (const request of rows) {
            let items = await this.getUtilityItems(request.id);
            
            // Apply filters
            if (filters.status) {
                items = items.filter((item) => item.status === filters.status);
            }
            if (filters.approval_status) {
                items = items.filter((item) => item.approval_status === filters.approval_status);
            }
            if (filters.period) {
                items = items.filter((item) => item.period === filters.period);
            }
            
            request.items = items;
        }

        const result = (filters.status || filters.approval_status || filters.period) 
            ? rows.filter((r) => r.items.length > 0) 
            : rows;
        return result;
    }

    static async findUtilityById(id: string): Promise<JudgeUtility | null> {
        const { rows } = await pool.query(
            `SELECT ${UTILITY_REQUEST_SELECT} FROM utilities_requests WHERE id = $1 AND is_active = true`,
            [id]
        );
        if (rows.length === 0) return null;

        const request = rows[0];
        request.items = await this.getUtilityItems(id);
        return request;
    }

    static async findUtilityByPjNumber(pjNumber: string): Promise<JudgeUtility | null> {
        const { rows } = await pool.query(
            `SELECT ${UTILITY_REQUEST_SELECT} FROM utilities_requests 
             WHERE pj_number = $1 AND is_active = true`,
            [pjNumber]
        );
        if (rows.length === 0) return null;

        const request = rows[0];
        request.items = await this.getUtilityItems(request.id);
        return request;
    }

    static async createUtility(
        input: CreateUtilityInput,
        userId: string
    ): Promise<JudgeUtility> {
        if (!input.pj_number || input.pj_number.trim() === '') {
            throw new AppError(400, 'PJ number is required to create a utility record');
        }

        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            const { rows } = await client.query(
                `INSERT INTO utilities_requests (pj_number, judge_name, created_by)
                 VALUES ($1, $2, $3)
                 RETURNING id`,
                [input.pj_number.trim(), input.judge_name.trim(), userId]
            );

            const requestId = rows[0].id;

            for (const item of input.items) {
                await client.query(
                    `INSERT INTO utilities_items (
                        request_id, utility_type, requisition_number, amount, period, description,
                        date_received, date_forwarded_dass, date_paid, status,
                        approval_status
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
                    [
                        requestId,
                        item.utility_type,
                        item.requisition_number || null,
                        item.amount,
                        item.period.trim(),
                        item.description || null,
                        item.date_received || null,
                        item.date_forwarded_dass || null,
                        item.date_paid || null,
                        item.status || 'Awaiting',
                        item.approval_status || 'pending',
                    ]
                );
            }

            await client.query('COMMIT');

            const utility = await this.findUtilityById(requestId);
            if (!utility) throw new AppError(500, 'Failed to create judge utility record');
            return utility;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    static async addUtilityItem(
        input: AddUtilityItemInput
    ): Promise<JudgeUtility> {
        if (!input.pj_number || input.pj_number.trim() === '') {
            throw new AppError(400, 'PJ number is required to add a utility item');
        }

        const existing = await this.findUtilityByPjNumber(input.pj_number);
        if (!existing) {
            throw new AppError(404, `Judge utility record not found for PJ number: ${input.pj_number}`);
        }

        const requestId = existing.id;

        await pool.query(
            `INSERT INTO utilities_items (
                request_id, utility_type, requisition_number, amount, period, description,
                date_received, date_forwarded_dass, date_paid, status,
                approval_status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
                requestId,
                input.utility_type,
                input.requisition_number || null,
                input.amount,
                input.period.trim(),
                input.description || null,
                input.date_received || null,
                input.date_forwarded_dass || null,
                input.date_paid || null,
                input.status || 'Awaiting',
                'pending',
            ]
        );

        const updated = await this.findUtilityById(requestId);
        if (!updated) throw new AppError(500, 'Failed to add utility item');
        return updated;
    }

    static async updateUtilityItem(
        requestId: string,
        itemId: string,
        input: UpdateUtilityItemInput
    ): Promise<JudgeUtility> {
        const request = await this.findUtilityById(requestId);
        if (!request) {
            throw new AppError(404, 'Judge utility record not found');
        }

        const item = request.items.find((i) => i.id === itemId);
        if (!item) {
            throw new AppError(404, 'Utility item not found');
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

        setField('status', input.status);
        setField('date_received', input.date_received);
        setField('date_forwarded_dass', input.date_forwarded_dass);
        setField('date_paid', input.date_paid);
        setField('amount', input.amount);
        setField('period', input.period?.trim());
        setField('description', input.description);
        setField('utility_type', input.utility_type);
        setField('requisition_number', input.requisition_number);
        setField('approval_status', input.approval_status);
        setField('memo_id', input.memo_id);

        if (fields.length === 0) {
            return request;
        }

        fields.push(`updated_at = now()`);
        values.push(itemId);

        await pool.query(
            `UPDATE utilities_items SET ${fields.join(', ')} WHERE id = $${paramCount}`,
            values
        );

        const updated = await this.findUtilityById(requestId);
        if (!updated) throw new AppError(500, 'Failed to update utility item');
        return updated;
    }

    static async updateUtility(
        id: string,
        input: UpdateUtilityInput
    ): Promise<JudgeUtility> {
        const existing = await this.findUtilityById(id);
        if (!existing) {
            throw new AppError(404, 'Judge utility record not found');
        }

        if (input.pj_number === undefined && input.judge_name === undefined) {
            throw new AppError(400, 'At least one field (pj_number or judge_name) must be provided for update');
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

        setField('pj_number', input.pj_number?.trim());
        setField('judge_name', input.judge_name?.trim());

        fields.push(`updated_at = now()`);
        values.push(id);

        await pool.query(
            `UPDATE utilities_requests SET ${fields.join(', ')} WHERE id = $${paramCount}`,
            values
        );

        const updated = await this.findUtilityById(id);
        if (!updated) throw new AppError(500, 'Failed to update judge utility record');
        return updated;
    }

    static async deleteUtilityItem(requestId: string, itemId: string): Promise<void> {
        const { rows } = await pool.query(
            `UPDATE utilities_items
             SET is_active = false
             WHERE id = $1 AND request_id = $2
             RETURNING id`,
            [itemId, requestId]
        );
        if (rows.length === 0) {
            throw new AppError(404, 'Utility item not found');
        }
    }

    static async deleteUtility(id: string): Promise<void> {
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            const { rows } = await client.query(
                `UPDATE utilities_requests SET is_active = false WHERE id = $1 RETURNING id`,
                [id]
            );
            if (rows.length === 0) {
                throw new AppError(404, 'Judge utility record not found');
            }

            await client.query(
                `UPDATE utilities_items SET is_active = false WHERE request_id = $1`,
                [id]
            );

            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    // ============================================================
    // CONSOLIDATED MEMOS
    // ============================================================

    static async findAllMemos(filters: MemoFilters = {}): Promise<ConsolidatedMemo[]> {
        let query = `SELECT ${CONSOLIDATED_MEMO_SELECT} FROM consolidated_memos WHERE is_active = true`;
        const params: unknown[] = [];
        let paramCount = 1;

        if (filters.period) {
            query += ` AND period = $${paramCount}`;
            params.push(filters.period);
            paramCount++;
        }
        if (filters.type) {
            query += ` AND type = $${paramCount}`;
            params.push(filters.type);
            paramCount++;
        }
        if (filters.status) {
            query += ` AND status = $${paramCount}`;
            params.push(filters.status);
            paramCount++;
        }

        query += ` ORDER BY generated_at DESC`;
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

    static async findMemoById(id: string): Promise<ConsolidatedMemo | null> {
        const { rows } = await pool.query(
            `SELECT ${CONSOLIDATED_MEMO_SELECT} FROM consolidated_memos 
             WHERE id = $1 AND is_active = true`,
            [id]
        );
        return rows[0] || null;
    }

    static async findMemoByEntityId(entityId: string): Promise<ConsolidatedMemo | null> {
        const { rows } = await pool.query(
            `SELECT ${CONSOLIDATED_MEMO_SELECT} FROM consolidated_memos 
             WHERE entity_id = $1 AND is_active = true`,
            [entityId]
        );
        return rows[0] || null;
    }

    static async generateMemo(
        input: GenerateMemoInput,
        userId: string
    ): Promise<ConsolidatedMemo> {
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Validate all items exist and are pending
            const { rows: items } = await client.query(
                `SELECT id, amount, period FROM utilities_items 
                 WHERE id = ANY($1) AND is_active = true AND approval_status = 'pending'`,
                [input.utility_item_ids]
            );

            if (items.length !== input.utility_item_ids.length) {
                throw new AppError(400, 'Some selected items are not available (they may have been sent already)');
            }

            // Verify all items have the same period
            const periods = [...new Set(items.map((item: any) => item.period))];
            if (periods.length > 1) {
                throw new AppError(400, 'All selected items must have the same period');
            }

            // Calculate total amount
            const totalAmount = items.reduce((sum: number, item: any) => sum + Number(item.amount), 0);

            // Generate entity ID
            const entityId = `cons-${input.type}-${input.period.replace(/\s/g, '-')}`;

            // Check if memo already exists for this period and type
            const existing = await this.findMemoByEntityId(entityId);
            if (existing) {
                throw new AppError(400, `A memo already exists for ${input.period} (${input.type})`);
            }

            // Create the memo
            const { rows } = await client.query(
                `INSERT INTO consolidated_memos (
                    type, entity_id, title, period, generated_at, status,
                    utility_item_ids, total_amount, created_by
                ) VALUES ($1, $2, $3, $4, NOW(), $5, $6, $7, $8)
                RETURNING id`,
                [
                    input.type,
                    entityId,
                    input.title || `${input.type === 'fuel' ? 'Fuel' : 'Utility'} Memo - ${input.period}`,
                    input.period,
                    'draft',
                    input.utility_item_ids,
                    totalAmount,
                    userId,
                ]
            );

            const memoId = rows[0].id;

            // Update utility items to reference the memo
            await client.query(
                `UPDATE utilities_items 
                 SET memo_id = $1, approval_status = 'sent', memo_sent_at = NOW(), updated_at = NOW()
                 WHERE id = ANY($2)`,
                [memoId, input.utility_item_ids]
            );

            await client.query('COMMIT');

            const memo = await this.findMemoById(memoId);
            if (!memo) throw new AppError(500, 'Failed to generate memo');
            return memo;

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    static async sendMemoForApproval(id: string): Promise<ConsolidatedMemo> {
        const memo = await this.findMemoById(id);
        if (!memo) {
            throw new AppError(404, 'Memo not found');
        }

        if (memo.status !== 'draft') {
            throw new AppError(400, `Cannot send memo with status: ${memo.status}`);
        }

        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Update memo status
            await client.query(
                `UPDATE consolidated_memos 
                 SET status = 'sent', sent_at = NOW(), updated_at = NOW()
                 WHERE id = $1`,
                [id]
            );

            // Update utility items to reflect sent status
            await client.query(
                `UPDATE utilities_items 
                 SET approval_status = 'sent', memo_sent_at = NOW(), updated_at = NOW()
                 WHERE memo_id = $1`,
                [id]
            );

            await client.query('COMMIT');

            const updated = await this.findMemoById(id);
            if (!updated) throw new AppError(500, 'Failed to send memo for approval');
            return updated;

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    static async approveMemo(
        id: string,
        approvedBy: string,
        notes?: string
    ): Promise<ConsolidatedMemo> {
        const memo = await this.findMemoById(id);
        if (!memo) {
            throw new AppError(404, 'Memo not found');
        }

        if (memo.status !== 'sent') {
            throw new AppError(400, `Cannot approve memo with status: ${memo.status}`);
        }

        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Update memo status
            await client.query(
                `UPDATE consolidated_memos 
                 SET status = 'approved', approved_at = NOW(), updated_at = NOW()
                 WHERE id = $1`,
                [id]
            );

            // Update utility items to reflect approved status
            await client.query(
                `UPDATE utilities_items 
                 SET approval_status = 'approved', updated_at = NOW()
                 WHERE memo_id = $1`,
                [id]
            );

            await client.query('COMMIT');

            const updated = await this.findMemoById(id);
            if (!updated) throw new AppError(500, 'Failed to approve memo');
            return updated;

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    static async rejectMemo(
        id: string,
        rejectedBy: string,
        reason?: string
    ): Promise<ConsolidatedMemo> {
        const memo = await this.findMemoById(id);
        if (!memo) {
            throw new AppError(404, 'Memo not found');
        }

        if (memo.status !== 'sent') {
            throw new AppError(400, `Cannot reject memo with status: ${memo.status}`);
        }

        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Update memo status
            await client.query(
                `UPDATE consolidated_memos 
                 SET status = 'rejected', rejected_at = NOW(), updated_at = NOW()
                 WHERE id = $1`,
                [id]
            );

            // Reset utility items to pending so they can be resent
            await client.query(
                `UPDATE utilities_items 
                 SET approval_status = 'pending', memo_id = NULL, memo_sent_at = NULL, updated_at = NOW()
                 WHERE memo_id = $1`,
                [id]
            );

            await client.query('COMMIT');

            const updated = await this.findMemoById(id);
            if (!updated) throw new AppError(500, 'Failed to reject memo');
            return updated;

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    static async cancelMemo(id: string): Promise<ConsolidatedMemo> {
        const memo = await this.findMemoById(id);
        if (!memo) {
            throw new AppError(404, 'Memo not found');
        }

        if (memo.status === 'approved') {
            throw new AppError(400, 'Cannot cancel an approved memo');
        }

        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Update memo status
            await client.query(
                `UPDATE consolidated_memos 
                 SET status = 'cancelled', updated_at = NOW()
                 WHERE id = $1`,
                [id]
            );

            // Reset utility items to pending so they can be resent
            await client.query(
                `UPDATE utilities_items 
                 SET approval_status = 'pending', memo_id = NULL, memo_sent_at = NULL, updated_at = NOW()
                 WHERE memo_id = $1`,
                [id]
            );

            await client.query('COMMIT');

            const updated = await this.findMemoById(id);
            if (!updated) throw new AppError(500, 'Failed to cancel memo');
            return updated;

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    // ============================================================
    // UTILITY QUERY HELPERS
    // ============================================================

    /**
     * Get pending utilities (not yet sent for approval)
     */
    static async getPendingUtilities(
        period?: string,
        utilityType?: string,
        judgeName?: string,
        pjNumber?: string,
        limit?: number,
        offset?: number
    ): Promise<UtilityItem[]> {
        let query = `
            SELECT ${UTILITY_ITEM_SELECT}
            FROM utilities_items
            WHERE is_active = true AND approval_status = 'pending'
        `;
        const params: unknown[] = [];
        let paramCount = 1;

        if (period) {
            query += ` AND period = $${paramCount}`;
            params.push(period);
            paramCount++;
        }
        if (utilityType) {
            query += ` AND utility_type = $${paramCount}`;
            params.push(utilityType);
            paramCount++;
        }
        if (judgeName) {
            query += ` AND request_id IN (
                SELECT id FROM utilities_requests 
                WHERE judge_name ILIKE $${paramCount} AND is_active = true
            )`;
            params.push(`%${judgeName}%`);
            paramCount++;
        }
        if (pjNumber) {
            query += ` AND request_id IN (
                SELECT id FROM utilities_requests 
                WHERE pj_number ILIKE $${paramCount} AND is_active = true
            )`;
            params.push(`%${pjNumber}%`);
            paramCount++;
        }

        query += ` ORDER BY created_at DESC`;
        if (limit) {
            query += ` LIMIT $${paramCount}`;
            params.push(limit);
            paramCount++;
        }
        if (offset) {
            query += ` OFFSET $${paramCount}`;
            params.push(offset);
        }

        const { rows } = await pool.query(query, params);
        return rows;
    }

    /**
     * Get utilities by approval status
     */
    static async getUtilitiesByApprovalStatus(
        approvalStatus: UtilityApprovalStatus,
        period?: string,
        utilityType?: string,
        limit?: number,
        offset?: number
    ): Promise<UtilityItem[]> {
        let query = `
            SELECT ${UTILITY_ITEM_SELECT}
            FROM utilities_items
            WHERE is_active = true AND approval_status = $1
        `;
        const params: unknown[] = [approvalStatus];
        let paramCount = 2;

        if (period) {
            query += ` AND period = $${paramCount}`;
            params.push(period);
            paramCount++;
        }
        if (utilityType) {
            query += ` AND utility_type = $${paramCount}`;
            params.push(utilityType);
            paramCount++;
        }

        query += ` ORDER BY created_at DESC`;
        if (limit) {
            query += ` LIMIT $${paramCount}`;
            params.push(limit);
            paramCount++;
        }
        if (offset) {
            query += ` OFFSET $${paramCount}`;
            params.push(offset);
        }

        const { rows } = await pool.query(query, params);
        return rows;
    }

    /**
     * Get memo summary statistics
     */
    static async getMemoSummary(period?: string): Promise<{
        totalMemos: number;
        byStatus: Record<string, number>;
        totalAmount: number;
        pendingItems: number;
    }> {
        let query = `
            SELECT 
                COUNT(*)::int as total_memos,
                status,
                COALESCE(SUM(total_amount)::float8, 0) as total_amount
            FROM consolidated_memos
            WHERE is_active = true
        `;
        const params: unknown[] = [];
        let paramCount = 1;

        if (period) {
            query += ` AND period = $${paramCount}`;
            params.push(period);
            paramCount++;
        }

        query += ` GROUP BY status`;

        const { rows } = await pool.query(query, params);

        const byStatus: Record<string, number> = {};
        let totalAmount = 0;
        let totalMemos = 0;

        for (const row of rows) {
            byStatus[row.status] = row.total_memos;
            totalMemos += row.total_memos;
            totalAmount += Number(row.total_amount);
        }

        // Get pending items count
        const pendingQuery = `
            SELECT COUNT(*)::int as count
            FROM utilities_items
            WHERE is_active = true AND approval_status = 'pending'
            ${period ? `AND period = $1` : ''}
        `;
        const pendingParams = period ? [period] : [];
        const { rows: pendingRows } = await pool.query(pendingQuery, pendingParams);
        const pendingItems = pendingRows[0]?.count || 0;

        return {
            totalMemos,
            byStatus,
            totalAmount,
            pendingItems,
        };
    }

    /**
     * Bulk update utility items (for mass operations)
     */
    static async bulkUpdateUtilityItems(
        itemIds: string[],
        approvalStatus: UtilityApprovalStatus,
        memoId?: string | null
    ): Promise<{ updated: number }> {
        if (itemIds.length === 0) {
            throw new AppError(400, 'No items selected');
        }

        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            const result = await client.query(
                `UPDATE utilities_items 
                 SET approval_status = $1, 
                     memo_id = COALESCE($2, memo_id),
                     updated_at = NOW()
                 WHERE id = ANY($3) AND is_active = true
                 RETURNING id`,
                [approvalStatus, memoId || null, itemIds]
            );

            await client.query('COMMIT');
            return { updated: result.rowCount || 0 };

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    // ============================================================
    // UTILITY STATISTICS
    // ============================================================

    static async getUtilityStats(): Promise<{
        totalRequests: number;
        totalItems: number;
        byStatus: Record<UtilityStatus, number>;
        byApprovalStatus: Record<UtilityApprovalStatus, number>;
        byType: Record<string, number>;
        totalAmount: number;
    }> {
        // Get total requests
        const { rows: requestRows } = await pool.query(
            `SELECT COUNT(*)::int as count FROM utilities_requests WHERE is_active = true`
        );

        // Get total items
        const { rows: itemRows } = await pool.query(
            `SELECT COUNT(*)::int as count FROM utilities_items WHERE is_active = true`
        );

        // Get items by status
        const { rows: statusRows } = await pool.query(
            `SELECT status, COUNT(*)::int as count, COALESCE(SUM(amount)::float8, 0) as total
             FROM utilities_items 
             WHERE is_active = true 
             GROUP BY status`
        );

        // Get items by approval status
        const { rows: approvalRows } = await pool.query(
            `SELECT approval_status, COUNT(*)::int as count
             FROM utilities_items 
             WHERE is_active = true 
             GROUP BY approval_status`
        );

        // Get items by type
        const { rows: typeRows } = await pool.query(
            `SELECT utility_type, COUNT(*)::int as count, COALESCE(SUM(amount)::float8, 0) as total
             FROM utilities_items 
             WHERE is_active = true 
             GROUP BY utility_type`
        );

        const byStatus = statusRows.reduce((acc, row) => {
            acc[row.status] = row.count;
            return acc;
        }, {} as Record<UtilityStatus, number>);

        const byApprovalStatus = approvalRows.reduce((acc, row) => {
            acc[row.approval_status] = row.count;
            return acc;
        }, {} as Record<UtilityApprovalStatus, number>);

        const byType = typeRows.reduce((acc, row) => {
            acc[row.utility_type] = row.count;
            return acc;
        }, {} as Record<string, number>);

        const totalAmount = typeRows.reduce((sum, row) => sum + Number(row.total), 0);

        return {
            totalRequests: requestRows[0]?.count || 0,
            totalItems: itemRows[0]?.count || 0,
            byStatus,
            byApprovalStatus,
            byType,
            totalAmount,
        };
    }

    /**
     * Get available periods for memo generation
     */
    static async getAvailablePeriods(): Promise<string[]> {
        const { rows } = await pool.query(
            `SELECT DISTINCT period 
             FROM utilities_items 
             WHERE is_active = true AND approval_status = 'pending'
             ORDER BY period DESC`
        );
        return rows.map((row) => row.period).filter(Boolean);
    }

} // end UtilitiesService