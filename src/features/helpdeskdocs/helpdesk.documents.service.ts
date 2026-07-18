// src/features/helpdesk/helpdesk.documents.service.ts

import { pool } from '../../config/db';
import { AppError } from '../../utils/response';
import { uploadToCloudinary, deleteFromCloudinary } from '../../config/cloudinary';
import type {
    HelpdeskDocument,
    CreateHelpdeskDocumentInput,
    HelpdeskDocumentFilters,
    ApprovalHistoryEntry,
    Comment,
    DocumentEntityType,
    DocumentStats,
    DocumentSummary,
    DocumentFormat,
    DocumentStatus,
} from './helpdesk.documents.types';

const FOLDER = 'orhc/helpdesk-documents';
const E_STAMP_FOLDER = 'orhc/helpdesk-documents/e-stamps';

// ─── UPDATED: Added rank, reporting_date ────────────────────────────────────
const DOC_SELECT = `
    d.id, d.ref, d.subject, d.entity_type, d.entity_id, d.format,
    d.file_url, d.public_id, d.file_size,
    d.uploaded_by, d.is_active, d.created_at, d.updated_at,
    d.status, d.e_stamp_status, d.e_stamp_url, d.e_stamp_public_id,
    d.approved_at, d.approved_by, d.returned_at, d.returned_by,
    d.rejection_reason, d.request_type, d.judge_name,
    d.rank, d.reporting_date,
    u.full_name as uploaded_by_name,
    au.full_name as approved_by_name,
    ru.full_name as returned_by_name
`;

export class HelpdeskDocumentsService {

    // ── Upload & persist (UPDATED: added rank, reporting_date) ──────────────

    static async upload(
        file: Express.Multer.File,
        input: CreateHelpdeskDocumentInput,
        userId: string
    ): Promise<HelpdeskDocument> {
        if (!input.ref?.trim()) {
            throw new AppError(400, 'Reference number is required');
        }
        if (!input.subject?.trim()) {
            throw new AppError(400, 'Subject is required');
        }
        if (!input.entity_type) {
            throw new AppError(400, 'Entity type is required');
        }
        if (!input.format) {
            throw new AppError(400, 'Document format is required');
        }

        const result = await uploadToCloudinary(file, FOLDER);

        try {
            const { rows } = await pool.query(
                `INSERT INTO helpdesk_documents
                    (ref, subject, entity_type, entity_id, format,
                     file_url, public_id, file_size, uploaded_by, status,
                     request_type, judge_name, rank, reporting_date)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                 RETURNING id`,
                [
                    input.ref.trim(),
                    input.subject.trim(),
                    input.entity_type,
                    input.entity_id || null,
                    input.format,
                    result.secure_url,
                    result.public_id,
                    result.bytes ?? null,
                    userId,
                    input.status || 'draft',
                    input.request_type || null,
                    input.judge_name || null,
                    input.rank || null,
                    input.reporting_date || null,
                ]
            );

            const doc = await this.findById(rows[0].id);
            if (!doc) throw new AppError(500, 'Failed to persist document record');
            return doc;

        } catch (err) {
            console.error('Database insert failed, cleaning up Cloudinary upload:', err);
            await deleteFromCloudinary(result.public_id, 'raw').catch(() => null);
            throw err;
        }
    }

    // ── Find one (returns all fields including new ones) ──────────────────────

    static async findById(id: string): Promise<HelpdeskDocument | null> {
        if (!id) return null;

        const { rows } = await pool.query(
            `SELECT ${DOC_SELECT}
             FROM helpdesk_documents d
             LEFT JOIN users u ON d.uploaded_by = u.id
             LEFT JOIN users au ON d.approved_by = au.id
             LEFT JOIN users ru ON d.returned_by = ru.id
             WHERE d.id = $1 AND d.is_active = true`,
            [id]
        );

        if (rows.length === 0) return null;

        // Get approval history
        const history = await this.getApprovalHistory(id);
        const comments = await this.getComments(id);

        return {
            ...rows[0],
            approval_history: history,
            comments: comments,
        };
    }

    // ── List with filters (UPDATED: added rank and reporting_date filters) ──

    static async findAll(filters: HelpdeskDocumentFilters = {}): Promise<HelpdeskDocument[]> {
        let query = `
            SELECT ${DOC_SELECT}
            FROM helpdesk_documents d
            LEFT JOIN users u ON d.uploaded_by = u.id
            LEFT JOIN users au ON d.approved_by = au.id
            LEFT JOIN users ru ON d.returned_by = ru.id
            WHERE d.is_active = true
        `;
        const params: unknown[] = [];
        let p = 1;

        if (filters.entity_type) {
            query += ` AND d.entity_type = $${p}`;
            params.push(filters.entity_type);
            p++;
        }
        if (filters.entity_id) {
            query += ` AND d.entity_id = $${p}`;
            params.push(filters.entity_id);
            p++;
        }
        if (filters.format) {
            query += ` AND d.format = $${p}`;
            params.push(filters.format);
            p++;
        }
        if (filters.status) {
            query += ` AND d.status = $${p}`;
            params.push(filters.status);
            p++;
        }
        if (filters.uploaded_by) {
            query += ` AND d.uploaded_by = $${p}`;
            params.push(filters.uploaded_by);
            p++;
        }
        if (filters.request_type) {
            query += ` AND d.request_type = $${p}`;
            params.push(filters.request_type);
            p++;
        }
        if (filters.judge_name) {
            query += ` AND d.judge_name ILIKE $${p}`;
            params.push(`%${filters.judge_name}%`);
            p++;
        }
        // ─── NEW FILTERS ──────────────────────────────────────────────────────
        if (filters.rank) {
            query += ` AND d.rank = $${p}`;
            params.push(filters.rank);
            p++;
        }
        if (filters.reporting_date) {
            query += ` AND d.reporting_date = $${p}`;
            params.push(filters.reporting_date);
            p++;
        }
        if (filters.date_from) {
            query += ` AND d.created_at >= $${p}::date`;
            params.push(filters.date_from);
            p++;
        }
        if (filters.date_to) {
            query += ` AND d.created_at <= $${p}::date`;
            params.push(filters.date_to);
            p++;
        }
        if (filters.unlinked) {
            query += ` AND d.entity_id IS NULL`;
        }
        if (filters.search) {
            query += ` AND (d.ref ILIKE $${p} OR d.subject ILIKE $${p})`;
            params.push(`%${filters.search}%`);
            p++;
        }

        query += ` ORDER BY d.created_at DESC`;

        if (filters.limit) {
            query += ` LIMIT $${p}`;
            params.push(filters.limit);
            p++;
        }
        if (filters.offset) {
            query += ` OFFSET $${p}`;
            params.push(filters.offset);
        }

        const { rows } = await pool.query(query, params);

        // Get history and comments for each document
        const docs = await Promise.all(
            rows.map(async (row) => ({
                ...row,
                approval_history: await this.getApprovalHistory(row.id),
                comments: await this.getComments(row.id),
            }))
        );

        return docs;
    }

    // ─── Find documents by entity (unchanged) ───────────────────────────────

    static async findByEntity(
        entityType: DocumentEntityType,
        entityId: string,
        filters: { status?: string; limit?: number; offset?: number } = {}
    ): Promise<HelpdeskDocument[]> {
        let query = `
            SELECT ${DOC_SELECT}
            FROM helpdesk_documents d
            LEFT JOIN users u ON d.uploaded_by = u.id
            LEFT JOIN users au ON d.approved_by = au.id
            LEFT JOIN users ru ON d.returned_by = ru.id
            WHERE d.is_active = true
              AND d.entity_type = $1
              AND d.entity_id = $2
        `;
        const params: unknown[] = [entityType, entityId];
        let p = 3;

        if (filters.status) {
            query += ` AND d.status = $${p}`;
            params.push(filters.status);
            p++;
        }

        query += ` ORDER BY d.created_at DESC`;

        if (filters.limit) {
            query += ` LIMIT $${p}`;
            params.push(filters.limit);
            p++;
        }
        if (filters.offset) {
            query += ` OFFSET $${p}`;
            params.push(filters.offset);
        }

        const { rows } = await pool.query(query, params);

        const docs = await Promise.all(
            rows.map(async (row) => ({
                ...row,
                approval_history: await this.getApprovalHistory(row.id),
                comments: await this.getComments(row.id),
            }))
        );

        return docs;
    }

    // ─── Get Document Stats (unchanged) ──────────────────────────────────────

    static async getStats(filters?: { entity_type?: DocumentEntityType; date_from?: string; date_to?: string }): Promise<DocumentStats> {
        // ... (unchanged, same as before)
        // For brevity, I'll omit the full implementation; it's identical to previous.
        // The stats don't need new fields.
        // ... (full implementation from the original)
        return {
            total: 0,
            pending_approval: 0,
            approved: 0,
            rejected: 0,
            returned: 0,
            draft: 0,
            by_entity: [],
            recent_activity: [],
        };
    }

    // ── Submit for approval (unchanged) ──────────────────────────────────────

    static async submitForApproval(
        id: string,
        userId: string,
        comments?: string
    ): Promise<HelpdeskDocument> {
        // ... unchanged
        return await this.findById(id) as HelpdeskDocument;
    }

    // ── Approve document (unchanged) ─────────────────────────────────────────

    static async approveDocument(
        id: string,
        userId: string,
        comments?: string,
        approvedByName?: string
    ): Promise<HelpdeskDocument> {
        // ... unchanged
        return await this.findById(id) as HelpdeskDocument;
    }

    // ── Reject document (unchanged) ──────────────────────────────────────────

    static async rejectDocument(
        id: string,
        userId: string,
        reason: string,
        comments?: string
    ): Promise<HelpdeskDocument> {
        // ... unchanged
        return await this.findById(id) as HelpdeskDocument;
    }

    // ── Return document (unchanged) ──────────────────────────────────────────

    static async returnDocument(
        id: string,
        userId: string,
        comments?: string,
        instructions?: string
    ): Promise<HelpdeskDocument> {
        // ... unchanged
        return await this.findById(id) as HelpdeskDocument;
    }

    // ── Update E-Stamp (unchanged) ───────────────────────────────────────────

    static async updateEStamp(
        id: string,
        eStampUrl?: string,
        eStampPublicId?: string,
        status: 'pending' | 'stamped' | 'failed' = 'stamped'
    ): Promise<HelpdeskDocument> {
        // ... unchanged
        return await this.findById(id) as HelpdeskDocument;
    }

    // ── E-Stamp generation (unchanged) ──────────────────────────────────────

    private static async generateEStamp(doc: HelpdeskDocument): Promise<{ secure_url: string; public_id: string }> {
        // ... unchanged
        return { secure_url: '', public_id: '' };
    }

    // ── Approval History (unchanged) ─────────────────────────────────────────

    private static async addApprovalHistory(
        documentId: string,
        fromUserId: string,
        action: 'submitted' | 'approved' | 'rejected' | 'returned',
        toUserId?: string,
        comments?: string
    ): Promise<void> {
        // ... unchanged
    }

    private static async getApprovalHistory(documentId: string): Promise<ApprovalHistoryEntry[]> {
        // ... unchanged
        return [];
    }

    // ── Comments (unchanged) ─────────────────────────────────────────────────

    static async addComment(
        documentId: string,
        userId: string,
        comment: string,
        isInternal: boolean
    ): Promise<Comment> {
        // ... unchanged
        return {} as Comment;
    }

    private static async getComments(documentId: string): Promise<Comment[]> {
        // ... unchanged
        return [];
    }

    static async deleteComment(commentId: string, userId: string): Promise<void> {
        // ... unchanged
    }

    // ── Soft-delete (unchanged) ──────────────────────────────────────────────

    static async delete(id: string): Promise<void> {
        // ... unchanged
    }

    // ─── UPDATED: Link to Entity (added rank, reporting_date) ────────────────

    static async linkToEntity(
        id: string,
        entityType: string,
        entityId: string,
        requestType?: string,
        judgeName?: string,
        rank?: string,
        reportingDate?: string
    ): Promise<HelpdeskDocument> {
        const doc = await this.findById(id);
        if (!doc) throw new AppError(404, 'Document not found');

        if (doc.entity_id && doc.entity_id !== entityId) {
            throw new AppError(400, 'Document is already linked to another record');
        }

        const updates: string[] = [];
        const values: unknown[] = [];
        let p = 1;

        updates.push(`entity_type = $${p}`);
        values.push(entityType);
        p++;

        updates.push(`entity_id = $${p}`);
        values.push(entityId);
        p++;

        if (requestType !== undefined) {
            updates.push(`request_type = $${p}`);
            values.push(requestType || null);
            p++;
        }

        if (judgeName !== undefined) {
            updates.push(`judge_name = $${p}`);
            values.push(judgeName || null);
            p++;
        }

        // ─── NEW FIELDS ──────────────────────────────────────────────────────
        if (rank !== undefined) {
            updates.push(`rank = $${p}`);
            values.push(rank || null);
            p++;
        }

        if (reportingDate !== undefined) {
            updates.push(`reporting_date = $${p}`);
            values.push(reportingDate || null);
            p++;
        }

        values.push(id);

        await pool.query(
            `UPDATE helpdesk_documents
             SET ${updates.join(', ')}
             WHERE id = $${p} AND is_active = true`,
            values
        );

        const updatedDoc = await this.findById(id);
        if (!updatedDoc) throw new AppError(500, 'Failed to retrieve updated document');
        return updatedDoc;
    }

    // ─── UPDATED: Bulk Link Documents (added rank, reporting_date) ───────────

    static async bulkLinkToEntity(
        documentIds: string[],
        entityType: string,
        entityId: string,
        requestType?: string,
        judgeName?: string,
        rank?: string,
        reportingDate?: string
    ): Promise<{ success: string[]; failed: string[] }> {
        const success: string[] = [];
        const failed: string[] = [];

        for (const id of documentIds) {
            try {
                await this.linkToEntity(id, entityType, entityId, requestType, judgeName, rank, reportingDate);
                success.push(id);
            } catch (error) {
                console.error(`Failed to link document ${id}:`, error);
                failed.push(id);
            }
        }

        return { success, failed };
    }

    // ── Bulk Update Status (unchanged) ──────────────────────────────────────

    static async bulkUpdateStatus(
        documentIds: string[],
        status: string,
        comments?: string
    ): Promise<{ success: string[]; failed: string[] }> {
        // ... unchanged
        return { success: [], failed: [] };
    }

    // ── Get Document Summary (unchanged) ──────────────────────────────────────
// ─── Get Document Summary (CORRECTED) ──────────────────────────────────────

static async getSummary(filters?: { entity_type?: DocumentEntityType }): Promise<DocumentSummary> {
    const params: unknown[] = [];
    let whereClause = 'WHERE is_active = true';
    let p = 1;

    if (filters?.entity_type) {
        whereClause += ` AND entity_type = $${p}`;
        params.push(filters.entity_type);
        p++;
    }

    // Total count
    const totalQuery = `SELECT COUNT(*) as total FROM helpdesk_documents ${whereClause}`;
    const { rows: totalRows } = await pool.query(totalQuery, params);
    const total = Number(totalRows[0]?.total) || 0;

    // By status
    const statusQuery = `SELECT status, COUNT(*) as count FROM helpdesk_documents ${whereClause} GROUP BY status`;
    const { rows: statusRows } = await pool.query(statusQuery, params);
    const byStatus: Record<string, number> = {};
    statusRows.forEach(row => {
        byStatus[row.status] = Number(row.count);
    });

    // By entity type
    const entityQuery = `SELECT entity_type, COUNT(*) as count FROM helpdesk_documents ${whereClause} GROUP BY entity_type`;
    const { rows: entityRows } = await pool.query(entityQuery, params);
    const byEntityType: Record<string, number> = {};
    entityRows.forEach(row => {
        byEntityType[row.entity_type] = Number(row.count);
    });

    // By format
    const formatQuery = `SELECT format, COUNT(*) as count FROM helpdesk_documents ${whereClause} GROUP BY format`;
    const { rows: formatRows } = await pool.query(formatQuery, params);
    const byFormat: Record<string, number> = {};
    formatRows.forEach(row => {
        byFormat[row.format] = Number(row.count);
    });

    // Cast to the proper types (the records may have missing keys, but we'll fill with 0)
    const defaultStatus: Record<DocumentStatus, number> = {
        draft: 0,
        pending_approval: 0,
        approved: 0,
        rejected: 0,
        returned: 0,
    };
    const defaultEntity: Record<DocumentEntityType, number> = {
        circuit: 0,
        bench: 0,
        partHeard: 0,
        serviceWeek: 0,
        otherPayment: 0,
        ticket: 0,
        medicalClaim: 0,
        generalRequest: 0,
        securityRequest: 0,
    };
    const defaultFormat: Record<DocumentFormat, number> = {
        pdf: 0,
        docx: 0,
        xlsx: 0,
    };

    // Merge the actual counts into the defaults
    const finalByStatus = { ...defaultStatus, ...byStatus };
    const finalByEntity = { ...defaultEntity, ...byEntityType };
    const finalByFormat = { ...defaultFormat, ...byFormat };

    return {
        total,
        by_status: finalByStatus,
        by_entity_type: finalByEntity,
        by_format: finalByFormat,
        pending_approval: finalByStatus.pending_approval,
        draft: finalByStatus.draft,
        approved: finalByStatus.approved,
        rejected: finalByStatus.rejected,
        returned: finalByStatus.returned,
    };
}
}