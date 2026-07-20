import { pool } from '../../config/db';
import { AppError } from '../../utils/response';
import { sendStoreRequestReceiptEmail } from '../../utils/storeRequestEmail';
import PDFDocument from 'pdfkit';
import { Readable } from 'stream';
import type {
    InventoryItem,
    StoreRequest,
    ProcurementRequest,
    ApprovedProcurementItem,
    ActivityLogEntry,
    InventoryStats,
    Category,
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
import { uploadToCloudinary } from '../../config/cloudinary';
import { generateDocumentFromTemplate } from '../../utils/documentGenerator';
import { MemoData } from '../template/MemoTemplate';

// ─── Constants ─────────────────────────────────────────────────────────────────

const ITEM_SELECT = `
    i.id, i.name, i.subtitle, i.category_id, i.qty_available, i.unit,
    i.location, i.min_stock_threshold, i.created_by, i.is_active,
    i.created_at, i.updated_at,
    c.name AS category_name, c.case_code, c.colour
`;

const STORE_REQUEST_SELECT = `
    sr.id, sr.item_name, sr.item_id, sr.quantity, sr.unit,
    sr.reason, sr.requested_by, ru.full_name AS requested_by_name,
    sr.status, sr.approved_by, au.full_name AS approved_by_name,
    sr.approved_at, sr.rejection_reason,
    sr.issued_by, iu.full_name AS issued_by_name, sr.issued_at,
    sr.received_by, recu.full_name AS received_by_name, sr.received_at,
    sr.created_at, sr.updated_at
`;

const PROCUREMENT_REQUEST_SELECT = `
    pr.id, pr.item_name, pr.category_id, pr.quantity, pr.unit,
    pr.estimated_unit_cost, pr.justification, pr.urgency,
    pr.requested_by, u.full_name AS requested_by_name,
    pr.status, pr.approved_by, au.full_name AS approved_by_name,
    pr.approved_at, pr.rejection_reason,
    pr.is_restock, pr.inventory_item_id,
    pr.memo_url, pr.memo_uploaded_at,
    pr.created_at, pr.updated_at
`;

const APPROVED_PROCUREMENT_SELECT = `
    ap.id, ap.procurement_request_id, ap.item_name, ap.category_id,
    ap.quantity, ap.unit, ap.unit_cost_kes, ap.total_cost_kes,
    ap.requested_by, ru.full_name AS requested_by_name,
    ap.approved_by, au.full_name AS approved_by_name,
    ap.approved_at, ap.is_purchased, ap.purchase_date,
    ap.purchase_reference, ap.created_at, ap.updated_at
`;

function computeStockStatus(qty: number, threshold: number): 'in_stock' | 'low_stock' | 'out_of_stock' {
    if (qty <= 0) return 'out_of_stock';
    if (qty < threshold) return 'low_stock';
    return 'in_stock';
}

// ─── Service Class ────────────────────────────────────────────────────────────

export class InventoryService {

    // ─── Statistics ──────────────────────────────────────────────────────────

    static async getStats(): Promise<InventoryStats> {
        const { rows } = await pool.query(`
            SELECT
                COUNT(*)::int AS total_items,
                COUNT(CASE WHEN qty_available > 0 THEN 1 END)::int AS in_stock,
                COUNT(CASE WHEN qty_available > 0 AND qty_available < min_stock_threshold THEN 1 END)::int AS low_stock,
                COUNT(CASE WHEN qty_available <= 0 THEN 1 END)::int AS out_of_stock,
                (SELECT COUNT(*)::int FROM store_requests WHERE status = 'Pending') AS pending_store_requests,
                (SELECT COUNT(*)::int FROM procurement_requests WHERE status = 'Pending') AS pending_procurement_requests
            FROM inventory_items
            WHERE is_active = true
        `);
        return rows[0];
    }

    // ─── Categories ──────────────────────────────────────────────────────────

    static async findAllCategories(): Promise<Category[]> {
        const { rows } = await pool.query(
            `SELECT id, name, parent_id, case_code, colour, description, created_at, updated_at
             FROM categories
             ORDER BY parent_id NULLS FIRST, name`
        );
        return rows;
    }

    static async findCategoryById(id: string): Promise<Category | null> {
        const { rows } = await pool.query(
            `SELECT id, name, parent_id, case_code, colour, description, created_at, updated_at
             FROM categories WHERE id = $1`,
            [id]
        );
        return rows[0] || null;
    }

    // ─── Inventory Items ─────────────────────────────────────────────────────

    static async findAllItems(categoryId?: string): Promise<InventoryItem[]> {
        let query = `
            SELECT ${ITEM_SELECT}
            FROM inventory_items i
            LEFT JOIN categories c ON i.category_id = c.id
            WHERE i.is_active = true
        `;
        const params: string[] = [];
        if (categoryId) {
            query += ` AND i.category_id = $1`;
            params.push(categoryId);
        }
        query += ` ORDER BY i.name ASC`;

        const { rows } = await pool.query(query, params);
        return rows.map(row => ({
            ...row,
            status: computeStockStatus(row.qty_available, row.min_stock_threshold),
            category: row.category_id ? { id: row.category_id, name: row.category_name, case_code: row.case_code, colour: row.colour } : undefined,
        }));
    }

    static async findItemById(id: string): Promise<InventoryItem | null> {
        const { rows } = await pool.query(
            `SELECT ${ITEM_SELECT}
             FROM inventory_items i
             LEFT JOIN categories c ON i.category_id = c.id
             WHERE i.id = $1 AND i.is_active = true`,
            [id]
        );
        if (rows.length === 0) return null;
        const row = rows[0];
        return {
            ...row,
            status: computeStockStatus(row.qty_available, row.min_stock_threshold),
            category: row.category_id ? { id: row.category_id, name: row.category_name, case_code: row.case_code, colour: row.colour } : undefined,
        };
    }

    static async createItem(
        input: CreateInventoryItemInput,
        createdBy: string
    ): Promise<InventoryItem> {
        const { rows } = await pool.query(
            `INSERT INTO inventory_items (
                name, subtitle, category_id, qty_available, unit, location, min_stock_threshold, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id`,
            [
                input.name.trim(),
                input.subtitle || null,
                input.category_id,
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
        if (input.category_id !== undefined) {
            updates.push(`category_id = $${paramCount++}`);
            values.push(input.category_id);
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
             LEFT JOIN users ru ON ru.id = sr.requested_by
             LEFT JOIN users au ON au.id = sr.approved_by
             LEFT JOIN users iu ON iu.id = sr.issued_by
             LEFT JOIN users recu ON recu.id = sr.received_by
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
             LEFT JOIN users ru ON ru.id = sr.requested_by
             LEFT JOIN users au ON au.id = sr.approved_by
             LEFT JOIN users iu ON iu.id = sr.issued_by
             LEFT JOIN users recu ON recu.id = sr.received_by
             ORDER BY sr.created_at DESC`
        );
        return rows;
    }

    static async findStoreRequestById(id: string): Promise<StoreRequest | null> {
        const { rows } = await pool.query(
            `SELECT ${STORE_REQUEST_SELECT}
             FROM store_requests sr
             LEFT JOIN users ru ON ru.id = sr.requested_by
             LEFT JOIN users au ON au.id = sr.approved_by
             LEFT JOIN users iu ON iu.id = sr.issued_by
             LEFT JOIN users recu ON recu.id = sr.received_by
             WHERE sr.id = $1`,
            [id]
        );
        return rows[0] || null;
    }

    static async createStoreRequest(
        input: CreateStoreRequestInput,
        requestedBy: string
    ): Promise<StoreRequest> {
        if (!input.reason || input.reason.trim().length === 0) {
            throw new AppError(400, 'A reason for the request is required');
        }

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

    static async issueStoreRequest(id: string, issuedBy: string): Promise<StoreRequest> {
        const existing = await this.findStoreRequestById(id);
        if (!existing) throw new AppError(404, 'Store request not found');
        if (existing.status !== 'Approved') {
            throw new AppError(400, 'Only approved requests can be issued');
        }

        const item = await this.findItemById(existing.item_id!);
        if (!item) throw new AppError(404, 'Inventory item not found for this request');
        if (item.qty_available < existing.quantity) {
            throw new AppError(400, `Insufficient stock. Available: ${item.qty_available}, requested: ${existing.quantity}`);
        }

        await pool.query(
            `UPDATE inventory_items SET qty_available = qty_available - $1, updated_at = NOW()
             WHERE id = $2`,
            [existing.quantity, item.id]
        );

        await pool.query(
            `UPDATE store_requests
             SET status = 'Issued', issued_by = $1, issued_at = NOW(), updated_at = NOW()
             WHERE id = $2`,
            [issuedBy, id]
        );

        const updated = await this.findStoreRequestById(id);
        if (!updated) throw new AppError(500, 'Failed to issue item');
        return updated;
    }

    static async receiveStoreRequest(id: string, receivedBy: string): Promise<StoreRequest> {
        const existing = await this.findStoreRequestById(id);
        if (!existing) throw new AppError(404, 'Store request not found');
        if (existing.status !== 'Issued') {
            throw new AppError(400, 'Only issued requests can be received');
        }
        if (existing.requested_by !== receivedBy) {
            throw new AppError(403, 'Only the requester can confirm receipt');
        }

        await pool.query(
            `UPDATE store_requests
             SET status = 'Received', received_by = $1, received_at = NOW(), updated_at = NOW()
             WHERE id = $2`,
            [receivedBy, id]
        );

        const updated = await this.findStoreRequestById(id);
        if (!updated) throw new AppError(500, 'Failed to confirm receipt');

        try {
            const requesterResult = await pool.query(
                `SELECT id, full_name, email, department FROM users WHERE id = $1`,
                [updated.requested_by]
            );
            const issuerResult = await pool.query(
                `SELECT id, full_name, email, department FROM users WHERE id = $1`,
                [updated.issued_by]
            );

            const requester = requesterResult.rows[0];
            const issuer = issuerResult.rows[0];

            if (requester && issuer) {
                await sendStoreRequestReceiptEmail(updated, requester, issuer);
            }
        } catch (emailError) {
            console.error('Failed to send receipt email:', emailError);
        }

        return updated;
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
        if (input.is_restock && !input.inventory_item_id) {
            throw new AppError(400, 'Inventory item ID is required for restock requests');
        }
        if (!input.is_restock && input.inventory_item_id) {
            throw new AppError(400, 'Inventory item ID should not be provided for new items');
        }

        const { rows } = await pool.query(
            `INSERT INTO procurement_requests (
                item_name, category_id, quantity, unit, estimated_unit_cost, 
                justification, urgency, requested_by, is_restock, inventory_item_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id`,
            [
                input.item_name.trim(),
                input.category_id,
                input.quantity,
                input.unit.trim(),
                input.estimated_unit_cost || null,
                input.justification.trim(),
                input.urgency || 'Normal',
                requestedBy,
                input.is_restock || false,
                input.inventory_item_id || null,
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

        // Allow updates only if status is Pending or Submitted (for approving/rejecting)
        if (existing.status !== 'Pending' && existing.status !== 'Submitted') {
            throw new AppError(400, 'Only pending or submitted requests can be updated');
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

    // ─── Memo Generation ─────────────────────────────────────────────────────

    /**
 * Generates a memo PDF for a procurement request using the shared
 * MemoTemplate/HTML pipeline (same one used for circuit memos), uploads
 * to Cloudinary, and updates the request status to 'Submitted'.
 */
static async submitProcurementMemo(
    requestId: string,
    userId: string,
    memoFields: {
        to: string;
        from: string;
        ref: string;
        date: string;
        subject: string;
        body: string;
        signatoryName: string;
        signatoryTitle?: string;
        draftedByInitials?: string;
    }
): Promise<{ memoUrl: string; status: string }> {
    const request = await this.findProcurementRequestById(requestId);
    if (!request) {
        throw new AppError(404, 'Procurement request not found');
    }
    if (request.status !== 'Pending') {
        throw new AppError(400, 'Only pending requests can be submitted for approval');
    }

    // Build the itemised table as HTML and append it to the memo body,
    // matching the table styling already defined in MemoTemplate.ts.
    const unitCost = request.estimated_unit_cost;
    const total = unitCost != null ? unitCost * request.quantity : null;

    const tableHtml = `
        <table>
            <thead>
                <tr>
                    <th>Item</th>
                    <th>Qty</th>
                    <th>Unit</th>
                    <th>Unit Cost (KES)</th>
                    <th>Total (KES)</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>${request.item_name}</td>
                    <td>${request.quantity}</td>
                    <td>${request.unit}</td>
                    <td>${unitCost != null ? unitCost.toLocaleString() : '—'}</td>
                    <td>${total != null ? total.toLocaleString() : '—'}</td>
                </tr>
            </tbody>
        </table>
    `;

    const memoData: MemoData = {
        to: memoFields.to,
        from: memoFields.from,
        ref: memoFields.ref,
        date: memoFields.date,
        subject: memoFields.subject,
        body: `${memoFields.body}\n${tableHtml}`,
        signatureName: memoFields.signatoryName,
        signatureTitle: memoFields.signatoryTitle || 'Registrar, High Court',
        draftedByInitials: memoFields.draftedByInitials,
    };

    // Render through the same Puppeteer/HTML pipeline as every other memo
    let pdfBuffer = await generateDocumentFromTemplate('memo', memoData);

    // TODO: once embedSignature.ts's exported signature is confirmed,
    // stamp the requester/approver's real signature image onto the
    // rendered PDF here, the same way circuit memos do it, e.g.:
    // pdfBuffer = await embedSignature(pdfBuffer, signatureImageUrl);

    // Upload to Cloudinary
    const file = {
        buffer: pdfBuffer,
        originalname: `memo_${requestId.slice(0, 8)}.pdf`,
        mimetype: 'application/pdf',
    } as Express.Multer.File;

    const uploadResult = await uploadToCloudinary(file, 'procurement-memos');
    const memoUrl = uploadResult.secure_url;

    // Update request
    await pool.query(
        `UPDATE procurement_requests
         SET memo_url = $1, memo_uploaded_at = NOW(), status = 'Submitted', updated_at = NOW()
         WHERE id = $2`,
        [memoUrl, requestId]
    );

    const updated = await this.findProcurementRequestById(requestId);
    if (!updated) throw new AppError(500, 'Failed to update request after memo upload');

    return { memoUrl, status: updated.status };
}

    /**
     * Generates the PDF memo using pdfkit.
     */
    private static generateProcurementMemoPDF(
        request: ProcurementRequest,
        memoFields: {
            to: string;
            from: string;
            ref: string;
            date: string;
            subject: string;
            body: string;
            signatoryName: string;
            signatorySignature?: string;
        }
    ): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({ size: 'A4', margin: 50 });
                const chunks: Buffer[] = [];

                doc.on('data', (chunk) => chunks.push(chunk));
                doc.on('end', () => resolve(Buffer.concat(chunks)));
                doc.on('error', reject);

                // ── Header: Judiciary Crest ──
                // Since we need an image, we'll use the crest URL from the frontend; we can include a placeholder.
                // We'll simply add a text-based header for simplicity, or we can embed the crest URL.
                // For now, we'll add a styled header with the court name.
                doc.fontSize(16).font('Helvetica-Bold').text('OFFICE OF THE REGISTRAR HIGH COURT', { align: 'center' });
                doc.fontSize(12).font('Helvetica').text('INTERNAL MEMO', { align: 'center' });
                doc.moveDown();

                // ── Memo Fields ──
                const startY = doc.y;
                doc.fontSize(10).font('Helvetica');

                // Helper to draw a field
                const drawField = (label: string, value: string, x: number = 50) => {
                    doc.text(`${label}:`, x, startY + 5, { continued: true, width: 60 });
                    doc.text(value, { align: 'left' });
                    doc.moveDown(0.8);
                };

                // We'll use a table-like layout for fields
                const leftCol = 50;
                const rightCol = 200;
                const lineHeight = 18;

                let yPos = startY;

                const drawFieldLine = (label: string, value: string) => {
                    doc.text(label + ':', leftCol, yPos, { width: 60 });
                    doc.text(value, rightCol, yPos);
                    yPos += lineHeight;
                };

                drawFieldLine('TO', memoFields.to);
                drawFieldLine('FROM', memoFields.from);
                drawFieldLine('REF', memoFields.ref);
                drawFieldLine('DATE', memoFields.date);
                doc.text('SUBJECT:', leftCol, yPos, { width: 60 });
                doc.text(memoFields.subject, rightCol, yPos);
                yPos += lineHeight * 1.5;

                // ── Body ──
                doc.font('Helvetica').fontSize(10);
                doc.text(memoFields.body, leftCol, yPos, { align: 'left', width: 500 });
                yPos = doc.y + 20;

                // ── Table: Item details ──
                const tableTop = yPos;
                const col1 = 50;
                const col2 = 180;
                const col3 = 300;
                const col4 = 400;
                const rowH = 20;

                doc.font('Helvetica-Bold').fontSize(9);
                doc.text('Item', col1, tableTop);
                doc.text('Qty', col2, tableTop);
                doc.text('Unit', col3, tableTop);
                doc.text('Cost', col4, tableTop);
                doc.moveDown(0.3);
                doc.strokeColor('#000').lineWidth(0.5);
                doc.moveTo(col1, doc.y).lineTo(520, doc.y).stroke();

                yPos = doc.y + 5;
                doc.font('Helvetica').fontSize(9);
                doc.text(request.item_name, col1, yPos);
                doc.text(String(request.quantity), col2, yPos);
                doc.text(request.unit, col3, yPos);
                doc.text(request.estimated_unit_cost ? request.estimated_unit_cost.toFixed(2) : '—', col4, yPos);

                yPos += rowH;
                const total = request.estimated_unit_cost ? (request.estimated_unit_cost * request.quantity) : 0;
                doc.font('Helvetica-Bold').text('Total:', col3, yPos);
                doc.text(total ? total.toFixed(2) : '—', col4, yPos);

                doc.moveDown(2);

                // ── Signatory ──
                doc.font('Helvetica').fontSize(10);
                doc.text('Signed:', 50, doc.y);
                if (memoFields.signatorySignature) {
                    const sigImage = memoFields.signatorySignature;
                    // We can't fetch external images in pdfkit without additional lib, so we skip or use placeholder.
                    // For production, we could fetch the image, but we'll just use text for now.
                }
                doc.text(memoFields.signatoryName, 50, doc.y + 20);
                doc.text(memoFields.from, 50, doc.y + 35);

                doc.end();
            } catch (err) {
                reject(err);
            }
        });
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
                procurement_request_id, item_name, category_id, quantity, unit,
                unit_cost_kes, requested_by, approved_by, purchase_reference
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id`,
            [
                input.procurement_request_id,
                request.item_name,
                request.category_id,
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

        const procurementRequest = await this.findProcurementRequestById(existing.procurement_request_id);
        if (!procurementRequest) {
            throw new AppError(404, 'Linked procurement request not found');
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

        if (procurementRequest.is_restock && procurementRequest.inventory_item_id) {
            await pool.query(
                `UPDATE inventory_items
                 SET qty_available = qty_available + $1, updated_at = NOW()
                 WHERE id = $2`,
                [existing.quantity, procurementRequest.inventory_item_id]
            );
        } else {
            await pool.query(
                `INSERT INTO inventory_items (
                    name, category_id, qty_available, unit, created_by
                ) VALUES ($1, $2, $3, $4, $5)`,
                [
                    existing.item_name,
                    existing.category_id,
                    existing.quantity,
                    existing.unit,
                    existing.approved_by,
                ]
            );
        }

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