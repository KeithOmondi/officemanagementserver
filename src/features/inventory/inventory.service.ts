import { pool } from '../../config/db';
import { AppError } from '../../utils/response';
import type {
    InventoryItem,
    StoreRequest,
    ProcurementRequest,
    ApprovedProcurementItem,
    ActivityLogEntry,
    InventoryStats,
} from './inventory.types';
import type {
    CreateInventoryItemInput,
    UpdateInventoryItemInput,
    CreateStoreRequestInput,
    UpdateStoreRequestInput,
    CreateProcurementRequestInput,
    UpdateProcurementRequestInput,
    CreateApprovedProcurementInput,
} from './inventory.validator';

// ─── Constants ─────────────────────────────────────────────────────────────────

const ITEM_SELECT = `
    id, name, subtitle, category, qty_available, unit,
    location, status, min_stock_threshold, created_by, is_active,
    created_at, updated_at
`;

const STORE_REQUEST_SELECT = `
    sr.id, sr.item_name, sr.item_id, sr.quantity, sr.unit,
    sr.reason, sr.requested_by, u.full_name AS requested_by_name,
    sr.status, sr.approved_by, au.full_name AS approved_by_name,
    sr.approved_at, sr.rejection_reason, sr.created_at, sr.updated_at
`;

const PROCUREMENT_REQUEST_SELECT = `
    pr.id, pr.item_name, pr.category, pr.quantity, pr.unit,
    pr.estimated_unit_cost, pr.justification, pr.urgency,
    pr.requested_by, u.full_name AS requested_by_name,
    pr.status, pr.approved_by, au.full_name AS approved_by_name,
    pr.approved_at, pr.rejection_reason, pr.created_at, pr.updated_at
`;

const APPROVED_PROCUREMENT_SELECT = `
    ap.id, ap.procurement_request_id, ap.item_name, ap.category,
    ap.quantity, ap.unit, ap.unit_cost_kes, ap.total_cost_kes,
    ap.requested_by, ru.full_name AS requested_by_name,
    ap.approved_by, au.full_name AS approved_by_name,
    ap.approved_at, ap.is_purchased, ap.purchase_date,
    ap.purchase_reference, ap.created_at, ap.updated_at
`;

// ─── Service Class ────────────────────────────────────────────────────────────

export class InventoryService {

    // ─── Statistics ──────────────────────────────────────────────────────────

    static async getStats(): Promise<InventoryStats> {
        const { rows } = await pool.query(`
            SELECT
                COUNT(*)::int AS total_items,
                COUNT(CASE WHEN status = 'in_stock' THEN 1 END)::int AS in_stock,
                COUNT(CASE WHEN status = 'low_stock' THEN 1 END)::int AS low_stock,
                COUNT(CASE WHEN status = 'out_of_stock' THEN 1 END)::int AS out_of_stock,
                COUNT(CASE WHEN status = 'Pending' THEN 1 END)::int AS pending_store_requests,
                (SELECT COUNT(*)::int FROM procurement_requests WHERE status = 'Pending') AS pending_procurement_requests
            FROM inventory_items
            WHERE is_active = true
        `);
        return rows[0];
    }

    // ─── Inventory Items ─────────────────────────────────────────────────────

    static async findAllItems(category?: string): Promise<InventoryItem[]> {
        let query = `SELECT ${ITEM_SELECT} FROM inventory_items WHERE is_active = true`;
        const params: string[] = [];
        
        if (category) {
            query += ` AND category = $1`;
            params.push(category);
        }
        
        query += ` ORDER BY name ASC`;
        
        const { rows } = await pool.query(query, params);
        return rows;
    }

    static async findItemById(id: string): Promise<InventoryItem | null> {
        const { rows } = await pool.query(
            `SELECT ${ITEM_SELECT} FROM inventory_items WHERE id = $1 AND is_active = true`,
            [id]
        );
        return rows[0] || null;
    }

    static async createItem(
        input: CreateInventoryItemInput,
        createdBy: string
    ): Promise<InventoryItem> {
        const { rows } = await pool.query(
            `INSERT INTO inventory_items (
                name, subtitle, category, qty_available, unit, location, min_stock_threshold, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id`,
            [
                input.name.trim(),
                input.subtitle || null,
                input.category,
                input.qty_available || 0,
                input.unit.trim(),
                input.location || null,
                input.min_stock_threshold || 5,
                createdBy,
            ]
        );

        const item = await this.findItemById(rows[0].id);
        if (!item) throw new AppError(500, 'Failed to create inventory item');
        return item;
    }

    static async updateItem(
        id: string,
        input: UpdateInventoryItemInput
    ): Promise<InventoryItem> {
        const existing = await this.findItemById(id);
        if (!existing) {
            throw new AppError(404, 'Inventory item not found');
        }

        const updates: string[] = [];
        const values: unknown[] = [];
        let paramCount = 1;

        if (input.name !== undefined) {
            updates.push(`name = $${paramCount++}`);
            values.push(input.name.trim());
        }
        if (input.subtitle !== undefined) {
            updates.push(`subtitle = $${paramCount++}`);
            values.push(input.subtitle);
        }
        if (input.category !== undefined) {
            updates.push(`category = $${paramCount++}`);
            values.push(input.category);
        }
        if (input.qty_available !== undefined) {
            updates.push(`qty_available = $${paramCount++}`);
            values.push(input.qty_available);
        }
        if (input.unit !== undefined) {
            updates.push(`unit = $${paramCount++}`);
            values.push(input.unit.trim());
        }
        if (input.location !== undefined) {
            updates.push(`location = $${paramCount++}`);
            values.push(input.location);
        }
        if (input.min_stock_threshold !== undefined) {
            updates.push(`min_stock_threshold = $${paramCount++}`);
            values.push(input.min_stock_threshold);
        }
        if (input.is_active !== undefined) {
            updates.push(`is_active = $${paramCount++}`);
            values.push(input.is_active);
        }

        if (updates.length === 0) {
            return existing;
        }

        updates.push(`updated_at = NOW()`);
        values.push(id);

        await pool.query(
            `UPDATE inventory_items SET ${updates.join(', ')} WHERE id = $${paramCount}`,
            values
        );

        const updated = await this.findItemById(id);
        if (!updated) throw new AppError(500, 'Failed to update inventory item');
        return updated;
    }

    static async deleteItem(id: string): Promise<void> {
        const { rows } = await pool.query(
            `UPDATE inventory_items 
             SET is_active = false, updated_at = NOW()
             WHERE id = $1 AND is_active = true
             RETURNING id`,
            [id]
        );

        if (rows.length === 0) {
            throw new AppError(404, 'Inventory item not found');
        }
    }

    // ─── Store Requests ──────────────────────────────────────────────────────

    static async findUserStoreRequests(userId: string): Promise<StoreRequest[]> {
        const { rows } = await pool.query(
            `SELECT ${STORE_REQUEST_SELECT}
             FROM store_requests sr
             LEFT JOIN users u ON u.id = sr.requested_by
             LEFT JOIN users au ON au.id = sr.approved_by
             WHERE sr.requested_by = $1
             ORDER BY sr.created_at DESC`,
            [userId]
        );
        return rows;
    }

    static async findAllStoreRequests(): Promise<StoreRequest[]> {
        const { rows } = await pool.query(
            `SELECT ${STORE_REQUEST_SELECT}
             FROM store_requests sr
             LEFT JOIN users u ON u.id = sr.requested_by
             LEFT JOIN users au ON au.id = sr.approved_by
             ORDER BY sr.created_at DESC`
        );
        return rows;
    }

    static async findStoreRequestById(id: string): Promise<StoreRequest | null> {
        const { rows } = await pool.query(
            `SELECT ${STORE_REQUEST_SELECT}
             FROM store_requests sr
             LEFT JOIN users u ON u.id = sr.requested_by
             LEFT JOIN users au ON au.id = sr.approved_by
             WHERE sr.id = $1`,
            [id]
        );
        return rows[0] || null;
    }

    static async createStoreRequest(
        input: CreateStoreRequestInput,
        requestedBy: string
    ): Promise<StoreRequest> {
        // Validate reason is provided
        if (!input.reason || input.reason.trim().length === 0) {
            throw new AppError(400, 'A reason for the request is required');
        }

        // Find item to get unit if not provided
        let unit = input.unit;
        if (!unit) {
            const { rows } = await pool.query(
                `SELECT unit FROM inventory_items WHERE name ILIKE $1 AND is_active = true LIMIT 1`,
                [input.item_name]
            );
            if (rows.length > 0) {
                unit = rows[0].unit;
            } else {
                unit = 'pieces';
            }
        }

        // Get item_id if exists
        const { rows: itemRows } = await pool.query(
            `SELECT id FROM inventory_items WHERE name ILIKE $1 AND is_active = true LIMIT 1`,
            [input.item_name]
        );
        const itemId = itemRows.length > 0 ? itemRows[0].id : null;

        const { rows } = await pool.query(
            `INSERT INTO store_requests (
                item_name, item_id, quantity, unit, reason, requested_by
            ) VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id`,
            [input.item_name.trim(), itemId, input.quantity, unit, input.reason.trim(), requestedBy]
        );

        const request = await this.findStoreRequestById(rows[0].id);
        if (!request) throw new AppError(500, 'Failed to create store request');
        return request;
    }

    static async updateStoreRequest(
        id: string,
        input: UpdateStoreRequestInput,
        userId: string
    ): Promise<StoreRequest> {
        const existing = await this.findStoreRequestById(id);
        if (!existing) {
            throw new AppError(404, 'Store request not found');
        }

        if (existing.status !== 'Pending') {
            throw new AppError(400, 'Only pending requests can be updated');
        }

        const updates: string[] = [];
        const values: unknown[] = [];
        let paramCount = 1;

        if (input.status !== undefined) {
            updates.push(`status = $${paramCount++}`);
            values.push(input.status);
            if (input.status === 'Approved') {
                updates.push(`approved_by = $${paramCount++}`);
                values.push(userId);
                updates.push(`approved_at = NOW()`);
            } else if (input.status === 'Rejected') {
                updates.push(`approved_by = $${paramCount++}`);
                values.push(userId);
                updates.push(`approved_at = NOW()`);
            }
        }
        if (input.rejection_reason !== undefined && input.status === 'Rejected') {
            updates.push(`rejection_reason = $${paramCount++}`);
            values.push(input.rejection_reason);
        }

        if (updates.length === 0) {
            return existing;
        }

        updates.push(`updated_at = NOW()`);
        values.push(id);

        await pool.query(
            `UPDATE store_requests SET ${updates.join(', ')} WHERE id = $${paramCount}`,
            values
        );

        // If approved, update inventory quantity
        if (input.status === 'Approved') {
            await pool.query(
                `UPDATE inventory_items 
                 SET qty_available = qty_available - $1, updated_at = NOW()
                 WHERE name ILIKE $2 AND is_active = true`,
                [existing.quantity, existing.item_name]
            );
        }

        const updated = await this.findStoreRequestById(id);
        if (!updated) throw new AppError(500, 'Failed to update store request');
        return updated;
    }

    static async deleteStoreRequest(id: string): Promise<void> {
        const { rows } = await pool.query(
            `DELETE FROM store_requests
             WHERE id = $1
             RETURNING id`,
            [id]
        );

        if (rows.length === 0) {
            throw new AppError(404, 'Store request not found');
        }
    }

    // ─── Procurement Requests ────────────────────────────────────────────────

    static async findUserProcurementRequests(userId: string): Promise<ProcurementRequest[]> {
        const { rows } = await pool.query(
            `SELECT ${PROCUREMENT_REQUEST_SELECT}
             FROM procurement_requests pr
             LEFT JOIN users u ON u.id = pr.requested_by
             LEFT JOIN users au ON au.id = pr.approved_by
             WHERE pr.requested_by = $1
             ORDER BY 
                 CASE pr.urgency 
                     WHEN 'Critical' THEN 1 
                     WHEN 'Urgent' THEN 2 
                     ELSE 3 
                 END,
                 pr.created_at DESC`,
            [userId]
        );
        return rows;
    }

    static async findAllProcurementRequests(): Promise<ProcurementRequest[]> {
        const { rows } = await pool.query(
            `SELECT ${PROCUREMENT_REQUEST_SELECT}
             FROM procurement_requests pr
             LEFT JOIN users u ON u.id = pr.requested_by
             LEFT JOIN users au ON au.id = pr.approved_by
             ORDER BY 
                 CASE pr.urgency 
                     WHEN 'Critical' THEN 1 
                     WHEN 'Urgent' THEN 2 
                     ELSE 3 
                 END,
                 pr.created_at DESC`
        );
        return rows;
    }

    static async findProcurementRequestById(id: string): Promise<ProcurementRequest | null> {
        const { rows } = await pool.query(
            `SELECT ${PROCUREMENT_REQUEST_SELECT}
             FROM procurement_requests pr
             LEFT JOIN users u ON u.id = pr.requested_by
             LEFT JOIN users au ON au.id = pr.approved_by
             WHERE pr.id = $1`,
            [id]
        );
        return rows[0] || null;
    }

    static async createProcurementRequest(
        input: CreateProcurementRequestInput,
        requestedBy: string
    ): Promise<ProcurementRequest> {
        const { rows } = await pool.query(
            `INSERT INTO procurement_requests (
                item_name, category, quantity, unit, estimated_unit_cost, 
                justification, urgency, requested_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id`,
            [
                input.item_name.trim(),
                input.category,
                input.quantity,
                input.unit.trim(),
                input.estimated_unit_cost || null,
                input.justification.trim(),
                input.urgency || 'Normal',
                requestedBy,
            ]
        );

        const request = await this.findProcurementRequestById(rows[0].id);
        if (!request) throw new AppError(500, 'Failed to create procurement request');
        return request;
    }

    static async updateProcurementRequest(
        id: string,
        input: UpdateProcurementRequestInput,
        userId: string
    ): Promise<ProcurementRequest> {
        const existing = await this.findProcurementRequestById(id);
        if (!existing) {
            throw new AppError(404, 'Procurement request not found');
        }

        if (existing.status !== 'Pending') {
            throw new AppError(400, 'Only pending requests can be updated');
        }

        const updates: string[] = [];
        const values: unknown[] = [];
        let paramCount = 1;

        if (input.status !== undefined) {
            updates.push(`status = $${paramCount++}`);
            values.push(input.status);
            if (input.status === 'Approved') {
                updates.push(`approved_by = $${paramCount++}`);
                values.push(userId);
                updates.push(`approved_at = NOW()`);
            } else if (input.status === 'Rejected') {
                updates.push(`approved_by = $${paramCount++}`);
                values.push(userId);
                updates.push(`approved_at = NOW()`);
            }
        }
        if (input.rejection_reason !== undefined && input.status === 'Rejected') {
            updates.push(`rejection_reason = $${paramCount++}`);
            values.push(input.rejection_reason);
        }
        if (input.estimated_unit_cost !== undefined) {
            updates.push(`estimated_unit_cost = $${paramCount++}`);
            values.push(input.estimated_unit_cost);
        }

        if (updates.length === 0) {
            return existing;
        }

        updates.push(`updated_at = NOW()`);
        values.push(id);

        await pool.query(
            `UPDATE procurement_requests SET ${updates.join(', ')} WHERE id = $${paramCount}`,
            values
        );

        const updated = await this.findProcurementRequestById(id);
        if (!updated) throw new AppError(500, 'Failed to update procurement request');
        return updated;
    }

    static async deleteProcurementRequest(id: string): Promise<void> {
        const { rows } = await pool.query(
            `DELETE FROM procurement_requests
             WHERE id = $1
             RETURNING id`,
            [id]
        );

        if (rows.length === 0) {
            throw new AppError(404, 'Procurement request not found');
        }
    }

    // ─── Approved Procurement ─────────────────────────────────────────────────

    static async findAllApprovedProcurement(): Promise<ApprovedProcurementItem[]> {
        const { rows } = await pool.query(
            `SELECT ${APPROVED_PROCUREMENT_SELECT}
             FROM approved_procurement_items ap
             LEFT JOIN users ru ON ru.id = ap.requested_by
             LEFT JOIN users au ON au.id = ap.approved_by
             ORDER BY ap.approved_at DESC`
        );
        return rows;
    }

    static async findApprovedProcurementById(id: string): Promise<ApprovedProcurementItem | null> {
        const { rows } = await pool.query(
            `SELECT ${APPROVED_PROCUREMENT_SELECT}
             FROM approved_procurement_items ap
             LEFT JOIN users ru ON ru.id = ap.requested_by
             LEFT JOIN users au ON au.id = ap.approved_by
             WHERE ap.id = $1`,
            [id]
        );
        return rows[0] || null;
    }

    static async createApprovedProcurement(
        input: CreateApprovedProcurementInput,
        userId: string
    ): Promise<ApprovedProcurementItem> {
        const request = await this.findProcurementRequestById(input.procurement_request_id);
        if (!request) {
            throw new AppError(404, 'Procurement request not found');
        }

        if (request.status !== 'Approved') {
            throw new AppError(400, 'Only approved requests can be added to procurement list');
        }

        const { rows } = await pool.query(
            `INSERT INTO approved_procurement_items (
                procurement_request_id, item_name, category, quantity, unit,
                unit_cost_kes, requested_by, approved_by, purchase_reference
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id`,
            [
                input.procurement_request_id,
                request.item_name,
                request.category,
                request.quantity,
                request.unit,
                input.unit_cost_kes,
                request.requested_by,
                userId,
                input.purchase_reference || null,
            ]
        );

        const item = await this.findApprovedProcurementById(rows[0].id);
        if (!item) throw new AppError(500, 'Failed to create approved procurement item');
        return item;
    }

    static async markProcurementPurchased(
        id: string,
        purchaseReference?: string
    ): Promise<ApprovedProcurementItem> {
        const existing = await this.findApprovedProcurementById(id);
        if (!existing) {
            throw new AppError(404, 'Approved procurement item not found');
        }

        if (existing.is_purchased) {
            throw new AppError(400, 'Item already marked as purchased');
        }

        await pool.query(
            `UPDATE approved_procurement_items
             SET is_purchased = true, 
                 purchase_date = NOW(),
                 purchase_reference = COALESCE($1, purchase_reference),
                 updated_at = NOW()
             WHERE id = $2`,
            [purchaseReference || null, id]
        );

        await pool.query(
            `INSERT INTO inventory_items (
                name, category, qty_available, unit, created_by
            ) VALUES ($1, $2, $3, $4, $5)`,
            [existing.item_name, existing.category, existing.quantity, existing.unit, existing.approved_by]
        );

        const updated = await this.findApprovedProcurementById(id);
        if (!updated) throw new AppError(500, 'Failed to update procurement item');
        return updated;
    }

    // ─── Activity Log ──────────────────────────────────────────────────────────

    static async getActivityLog(limit: number = 50): Promise<ActivityLogEntry[]> {
        const { rows } = await pool.query(
            `SELECT 
                al.id, al.icon, al.title, al.description,
                al.user_id, u.full_name AS user_name,
                al.entity_type, al.entity_id, al.metadata,
                al.created_at
             FROM inventory_activity_log al
             LEFT JOIN users u ON u.id = al.user_id
             ORDER BY al.created_at DESC
             LIMIT $1`,
            [limit]
        );
        return rows;
    }
}