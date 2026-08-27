// ============================================================
// utilities.service.ts - UPDATED with Document Sync Support
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
    DocumentStatus,
    SyncUtilityItemsInput,
    DocumentReference,
} from './utilities.types';

// ─── Constants ─────────────────────────────────────────────────────────────────

const UTILITY_REQUEST_SELECT = `
    id, pj_number, judge_name, created_by, created_at, updated_at
`;

// ─── UPDATED: Added document sync fields ─────────────────────────────────────
const UTILITY_ITEM_SELECT = `
    id, request_id, utility_type, requisition_number, amount::float8 AS amount, period, description,
    date_received, date_forwarded_dass, date_paid, status,
    supporting_document_url, 
    approval_status, memo_id, memo_sent_at,
    document_sync_status, document_synced_at, document_sync_error,
    last_document_id, last_document_status,
    created_at, updated_at
`;

// ─── UPDATED: Added document reference fields ────────────────────────────────
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
            // ─── NEW: Document sync filters ──────────────────────────────────────
            if (filters.document_sync_status) {
                items = items.filter((item) => item.document_sync_status === filters.document_sync_status);
            }
            if (filters.has_document !== undefined) {
                if (filters.has_document) {
                    items = items.filter((item) => item.last_document_id !== null);
                } else {
                    items = items.filter((item) => item.last_document_id === null);
                }
            }
            
            request.items = items;
        }

        const result = (filters.status || filters.approval_status || filters.period || filters.document_sync_status) 
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
                        approval_status, document_sync_status
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
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
                        'not_applicable', // document_sync_status
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
                approval_status, document_sync_status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
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
                'not_applicable',
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
        // ─── NEW: Document sync fields ──────────────────────────────────────────
        setField('document_sync_status', input.document_sync_status);
        setField('last_document_id', input.last_document_id);
        setField('last_document_status', input.last_document_status);

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
        
        // ─── NEW: Add document reference for each memo ──────────────────────────
        for (const memo of rows) {
            const docRef = await this.getDocumentReferenceForMemo(memo.id);
            memo.document_reference = docRef;
            memo.has_document = !!docRef;
            memo.document_status = docRef?.document_status || null;
        }
        
        return rows;
    }

    static async findMemoById(id: string): Promise<ConsolidatedMemo | null> {
        const { rows } = await pool.query(
            `SELECT ${CONSOLIDATED_MEMO_SELECT} FROM consolidated_memos 
             WHERE id = $1 AND is_active = true`,
            [id]
        );
        if (rows.length === 0) return null;
        
        const memo = rows[0];
        const docRef = await this.getDocumentReferenceForMemo(memo.id);
        memo.document_reference = docRef;
        memo.has_document = !!docRef;
        memo.document_status = docRef?.document_status || null;
        
        return memo;
    }

    static async findMemoByEntityId(entityId: string): Promise<ConsolidatedMemo | null> {
        const { rows } = await pool.query(
            `SELECT ${CONSOLIDATED_MEMO_SELECT} FROM consolidated_memos 
             WHERE entity_id = $1 AND is_active = true`,
            [entityId]
        );
        if (rows.length === 0) return null;
        
        const memo = rows[0];
        const docRef = await this.getDocumentReferenceForMemo(memo.id);
        memo.document_reference = docRef;
        memo.has_document = !!docRef;
        memo.document_status = docRef?.document_status || null;
        
        return memo;
    }

    // ─── NEW: Get document reference for a memo ──────────────────────────────
    private static async getDocumentReferenceForMemo(memoId: string): Promise<DocumentReference | null> {
        const { rows } = await pool.query(
            `SELECT 
                id as document_id,
                ref as document_ref,
                status as document_status,
                entity_type as document_entity_type,
                entity_id as document_entity_id,
                created_at,
                updated_at
             FROM helpdesk_documents
             WHERE entity_id = $1 
               AND entity_type IN ('consolidated_utility_memo', 'consolidated_fuel_memo')
               AND is_active = true
             ORDER BY created_at DESC
             LIMIT 1`,
            [memoId]
        );
        return rows[0] || null;
    }

    // ─── UPDATED: generateMemo with document check ──────────────────────────
    static async generateMemo(
        input: GenerateMemoInput,
        userId: string
    ): Promise<ConsolidatedMemo> {
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // ─── Validate items are available ──────────────────────────────────────
            // Check for: pending, rejected, or in_memo (only if they're in a draft that expired)
            let statusFilter = "approval_status IN ('pending', 'rejected')";
            
            // If excluding items with documents, add that filter
            if (input.exclude_items_with_documents !== false) {
                // Items with last_document_status = 'approved' cannot be reused
                // Items with last_document_status = 'rejected' or 'returned' can be reused
                statusFilter += ` AND (last_document_status IS NULL OR last_document_status NOT IN ('approved', 'pending_approval'))`;
            }

            const { rows: items } = await client.query(
                `SELECT id, amount, period, approval_status, last_document_status, memo_id
                 FROM utilities_items 
                 WHERE id = ANY($1) AND is_active = true AND ${statusFilter}`,
                [input.utility_item_ids]
            );

            if (items.length !== input.utility_item_ids.length) {
                const foundIds = new Set(items.map((i: any) => i.id));
                const missingIds = input.utility_item_ids.filter(id => !foundIds.has(id));
                throw new AppError(400, `Some selected items are not available: ${missingIds.join(', ')}`);
            }

            // Check if any items are already in a memo
            const itemsInMemo = items.filter((item: any) => item.memo_id !== null);
            if (itemsInMemo.length > 0) {
                const memoIds = [...new Set(itemsInMemo.map((i: any) => i.memo_id))];
                const { rows: memoRows } = await client.query(
                    `SELECT id, status FROM consolidated_memos WHERE id = ANY($1) AND is_active = true`,
                    [memoIds]
                );
                const activeMemos = memoRows.filter((m: any) => ['draft', 'sent'].includes(m.status));
                if (activeMemos.length > 0) {
                    throw new AppError(400, `Some items are already in active memos: ${activeMemos.map((m: any) => m.id).join(', ')}`);
                }
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

            // ─── UPDATE: Set to 'in_memo' instead of 'sent' ──────────────────────
            await client.query(
                `UPDATE utilities_items 
                 SET memo_id = $1, 
                     approval_status = 'in_memo', 
                     memo_sent_at = NULL, 
                     updated_at = NOW()
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

    // ─── UPDATED: sendMemoForApproval ──────────────────────────────────────────
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
                 SET approval_status = 'sent', 
                     memo_sent_at = NOW(), 
                     updated_at = NOW()
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

    // ─── UPDATED: approveMemo with document sync ──────────────────────────────
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
            // Also set document_sync_status to 'pending' since document will be created
            await client.query(
                `UPDATE utilities_items 
                 SET approval_status = 'approved', 
                     document_sync_status = 'pending',
                     updated_at = NOW()
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

    // ─── UPDATED: rejectMemo with document sync ──────────────────────────────
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
            // Also clear document sync fields
            await client.query(
                `UPDATE utilities_items 
                 SET approval_status = 'rejected', 
                     memo_id = NULL, 
                     memo_sent_at = NULL, 
                     document_sync_status = 'not_applicable',
                     updated_at = NOW()
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

    // ─── UPDATED: cancelMemo with document sync ──────────────────────────────
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
                 SET approval_status = 'pending', 
                     memo_id = NULL, 
                     memo_sent_at = NULL, 
                     document_sync_status = 'not_applicable',
                     updated_at = NOW()
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
    // ─── NEW: DOCUMENT SYNC METHODS ──────────────────────────────────────────
    // ============================================================

    /**
     * Sync utility items with document status
     * Called when a document is approved/rejected/returned
     */
    static async syncUtilitiesWithDocument(
        input: SyncUtilityItemsInput
    ): Promise<{ success: boolean; updatedCount: number; message: string }> {
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Find the memo
            const { rows: memoRows } = await client.query(
                `SELECT id, utility_item_ids, status FROM consolidated_memos 
                 WHERE id = $1 AND is_active = true`,
                [input.memo_id]
            );

            if (memoRows.length === 0) {
                throw new AppError(404, 'Memo not found');
            }

            const memo = memoRows[0];
            const itemIds = memo.utility_item_ids || [];

            if (itemIds.length === 0) {
                await client.query('COMMIT');
                return { success: true, updatedCount: 0, message: 'No items to sync' };
            }

            // Map document status to utility approval status
            let newApprovalStatus: string;
            let shouldResetMemo = false;

            switch (input.document_status) {
                case 'approved':
                    newApprovalStatus = 'approved';
                    break;
                case 'rejected':
                    newApprovalStatus = 'rejected';
                    shouldResetMemo = true;
                    break;
                case 'returned':
                    newApprovalStatus = 'pending';
                    shouldResetMemo = true;
                    break;
                case 'pending_approval':
                    newApprovalStatus = 'sent';
                    break;
                case 'draft':
                    newApprovalStatus = 'in_memo';
                    break;
                default:
                    newApprovalStatus = 'pending';
                    shouldResetMemo = true;
            }

            // Update utility items
            const result = await client.query(
                `UPDATE utilities_items 
                 SET approval_status = $1,
                     document_sync_status = 'synced',
                     document_synced_at = NOW(),
                     document_sync_error = NULL,
                     last_document_id = $2,
                     last_document_status = $3,
                     updated_at = NOW()
                 WHERE id = ANY($4::uuid[]) AND is_active = true
                 RETURNING id`,
                [
                    newApprovalStatus,
                    input.document_id,
                    input.document_status,
                    itemIds
                ]
            );

            // If rejected or returned, also reset memo_id
            if (shouldResetMemo) {
                await client.query(
                    `UPDATE utilities_items 
                     SET memo_id = NULL, 
                         memo_sent_at = NULL
                     WHERE id = ANY($1::uuid[]) AND is_active = true`,
                    [itemIds]
                );
            }

            // Update memo document reference
            await client.query(
                `UPDATE consolidated_memos 
                 SET updated_at = NOW()
                 WHERE id = $1`,
                [input.memo_id]
            );

            await client.query('COMMIT');

            return {
                success: true,
                updatedCount: result.rowCount || 0,
                message: `Synced ${result.rowCount || 0} items to status: ${newApprovalStatus}`
            };

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('[syncUtilitiesWithDocument] Error:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Get items available for memo generation
     */
    static async getItemsAvailableForMemo(
        period: string,
        utilityType?: string,
        excludeWithDocuments: boolean = true
    ): Promise<UtilityItem[]> {
        let query = `
            SELECT ui.*, ur.judge_name, ur.pj_number
            FROM utilities_items ui
            JOIN utilities_requests ur ON ur.id = ui.request_id
            WHERE ui.is_active = true 
                AND ui.period = $1
                AND ui.approval_status IN ('pending', 'rejected')
                AND (ui.memo_id IS NULL OR ui.memo_id NOT IN (
                    SELECT id FROM consolidated_memos 
                    WHERE status IN ('draft', 'sent') 
                    AND is_active = true
                ))
        `;
        const params: unknown[] = [period];
        let paramCount = 2;

        if (excludeWithDocuments) {
            query += ` AND (ui.last_document_status IS NULL OR ui.last_document_status NOT IN ('approved', 'pending_approval'))`;
        }

        if (utilityType) {
            query += ` AND ui.utility_type = $${paramCount}`;
            params.push(utilityType);
            paramCount++;
        }

        query += ` ORDER BY ur.judge_name, ui.created_at`;

        const { rows } = await pool.query(query, params);
        return rows;
    }

    /**
     * Get utility items with document status
     */
    static async getItemsWithDocumentStatus(
        documentStatus?: DocumentStatus,
        period?: string,
        utilityType?: string,
        limit?: number,
        offset?: number
    ): Promise<UtilityItem[]> {
        let query = `
            SELECT ui.*, ur.judge_name, ur.pj_number
            FROM utilities_items ui
            JOIN utilities_requests ur ON ur.id = ui.request_id
            WHERE ui.is_active = true 
                AND ui.last_document_id IS NOT NULL
        `;
        const params: unknown[] = [];
        let paramCount = 1;

        if (documentStatus) {
            query += ` AND ui.last_document_status = $${paramCount}`;
            params.push(documentStatus);
            paramCount++;
        }
        if (period) {
            query += ` AND ui.period = $${paramCount}`;
            params.push(period);
            paramCount++;
        }
        if (utilityType) {
            query += ` AND ui.utility_type = $${paramCount}`;
            params.push(utilityType);
            paramCount++;
        }

        query += ` ORDER BY ui.updated_at DESC`;
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
     * Get memo with document reference
     */
    static async getMemoWithDocument(id: string): Promise<{
        memo: ConsolidatedMemo | null;
        document: any | null;
    }> {
        const memo = await this.findMemoById(id);
        if (!memo) {
            return { memo: null, document: null };
        }

        const docRef = await this.getDocumentReferenceForMemo(memo.id);
        
        let document = null;
        if (docRef) {
            const { rows } = await pool.query(
                `SELECT * FROM helpdesk_documents WHERE id = $1 AND is_active = true`,
                [docRef.document_id]
            );
            document = rows[0] || null;
        }

        return { memo, document };
    }

    // ============================================================
    // UTILITY QUERY HELPERS
    // ============================================================

    /**
     * Get pending utilities (not yet sent for approval)
     * ─── UPDATED: Excludes items with approved documents ──────────────────────
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
            WHERE is_active = true 
                AND approval_status IN ('pending', 'rejected')
                AND (last_document_status IS NULL OR last_document_status NOT IN ('approved', 'pending_approval'))
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
     * ─── UPDATED: Added document stats ─────────────────────────────────────────
     */
    static async getMemoSummary(period?: string): Promise<{
        totalMemos: number;
        byStatus: Record<string, number>;
        totalAmount: number;
        pendingItems: number;
        memosWithDocuments: number;
        memosWithoutDocuments: number;
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

        // ─── NEW: Get document stats ──────────────────────────────────────────────
        let docQuery = `
            SELECT 
                COUNT(CASE WHEN d.id IS NOT NULL THEN 1 END) as with_documents,
                COUNT(CASE WHEN d.id IS NULL THEN 1 END) as without_documents
            FROM consolidated_memos cm
            LEFT JOIN helpdesk_documents d ON d.entity_id = cm.id 
                AND d.entity_type IN ('consolidated_utility_memo', 'consolidated_fuel_memo')
                AND d.is_active = true
            WHERE cm.is_active = true
        `;
        if (period) {
            docQuery += ` AND cm.period = $1`;
        }
        const { rows: docRows } = await pool.query(docQuery, period ? [period] : []);

        return {
            totalMemos,
            byStatus,
            totalAmount,
            pendingItems,
            memosWithDocuments: Number(docRows[0]?.with_documents) || 0,
            memosWithoutDocuments: Number(docRows[0]?.without_documents) || 0,
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
        // ─── NEW: Document sync stats ──────────────────────────────────────────
        documentSyncStats: {
            synced: number;
            pending: number;
            failed: number;
            notApplicable: number;
        };
        itemsWithApprovedDocuments: number;
        itemsWithRejectedDocuments: number;
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

        // ─── NEW: Document sync stats ──────────────────────────────────────────────
        const { rows: syncRows } = await pool.query(
            `SELECT 
                document_sync_status,
                COUNT(*)::int as count
             FROM utilities_items 
             WHERE is_active = true 
             GROUP BY document_sync_status`
        );

        const { rows: docStatusRows } = await pool.query(
            `SELECT 
                last_document_status,
                COUNT(*)::int as count
             FROM utilities_items 
             WHERE is_active = true AND last_document_id IS NOT NULL
             GROUP BY last_document_status`
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

        const documentSyncStats = {
            synced: 0,
            pending: 0,
            failed: 0,
            notApplicable: 0,
        };
        syncRows.forEach((row) => {
            if (row.document_sync_status in documentSyncStats) {
                documentSyncStats[row.document_sync_status as keyof typeof documentSyncStats] = row.count;
            }
        });

        let itemsWithApprovedDocuments = 0;
        let itemsWithRejectedDocuments = 0;
        docStatusRows.forEach((row) => {
            if (row.last_document_status === 'approved') {
                itemsWithApprovedDocuments += row.count;
            } else if (row.last_document_status === 'rejected') {
                itemsWithRejectedDocuments += row.count;
            }
        });

        return {
            totalRequests: requestRows[0]?.count || 0,
            totalItems: itemRows[0]?.count || 0,
            byStatus,
            byApprovalStatus,
            byType,
            totalAmount,
            documentSyncStats,
            itemsWithApprovedDocuments,
            itemsWithRejectedDocuments,
        };
    }

    /**
     * Get available periods for memo generation
     * ─── UPDATED: Excludes periods where all items have approved documents ──────
     */
    static async getAvailablePeriods(): Promise<string[]> {
        const { rows } = await pool.query(
            `SELECT DISTINCT period 
             FROM utilities_items 
             WHERE is_active = true 
               AND approval_status IN ('pending', 'rejected')
               AND (last_document_status IS NULL OR last_document_status NOT IN ('approved', 'pending_approval'))
             ORDER BY period DESC`
        );
        return rows.map((row) => row.period).filter(Boolean);
    }

    /**
     * Check if items are available for memo
     */
    static async checkItemsAvailability(
        itemIds: string[],
        excludeWithDocuments: boolean = true
    ): Promise<{
        available: string[];
        unavailable: Array<{ id: string; reason: string }>;
    }> {
        if (itemIds.length === 0) {
            return { available: [], unavailable: [] };
        }

        let query = `
            SELECT id, approval_status, memo_id, last_document_status
            FROM utilities_items 
            WHERE id = ANY($1) AND is_active = true
        `;
        const { rows } = await pool.query(query, [itemIds]);

        const available: string[] = [];
        const unavailable: Array<{ id: string; reason: string }> = [];

        for (const item of rows) {
            let isAvailable = false;
            let reason = '';

            if (item.approval_status === 'pending' || item.approval_status === 'rejected') {
                if (excludeWithDocuments && item.last_document_status === 'approved') {
                    reason = 'Item already has an approved document';
                } else if (item.memo_id !== null) {
                    const { rows: memoRows } = await pool.query(
                        `SELECT status FROM consolidated_memos WHERE id = $1 AND is_active = true`,
                        [item.memo_id]
                    );
                    if (memoRows.length > 0 && ['draft', 'sent'].includes(memoRows[0].status)) {
                        reason = `Item is in an active memo (${memoRows[0].status})`;
                    } else {
                        isAvailable = true;
                    }
                } else {
                    isAvailable = true;
                }
            } else {
                reason = `Item has status: ${item.approval_status}`;
            }

            if (isAvailable) {
                available.push(item.id);
            } else {
                unavailable.push({ id: item.id, reason: reason || 'Item is not available' });
            }
        }

        return { available, unavailable };
    }

} // end UtilitiesService