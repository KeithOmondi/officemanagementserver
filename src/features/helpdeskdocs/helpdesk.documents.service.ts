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
} from './helpdesk.documents.types';

const FOLDER = 'orhc/helpdesk-documents';
const E_STAMP_FOLDER = 'orhc/helpdesk-documents/e-stamps';

const DOC_SELECT = `
    d.id, d.ref, d.subject, d.entity_type, d.entity_id, d.format,
    d.file_url, d.public_id, d.file_size,
    d.uploaded_by, d.is_active, d.created_at, d.updated_at,
    d.status, d.e_stamp_status, d.e_stamp_url, d.e_stamp_public_id,
    d.approved_at, d.approved_by, d.returned_at, d.returned_by,
    d.rejection_reason, d.request_type, d.judge_name,
    u.full_name as uploaded_by_name,
    au.full_name as approved_by_name,
    ru.full_name as returned_by_name
`;

export class HelpdeskDocumentsService {

    // ── Upload & persist ─────────────────────────────────────────────────────

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
                     request_type, judge_name)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
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

    // ── Find one ─────────────────────────────────────────────────────────────

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

    // ── List with filters ────────────────────────────────────────────────────

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

    // ── Find documents by entity ─────────────────────────────────────────────

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

    // ─── Get Document Stats ──────────────────────────────────────────────────

    static async getStats(filters?: { entity_type?: DocumentEntityType; date_from?: string; date_to?: string }): Promise<DocumentStats> {
        let query = `
            SELECT 
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE status = 'pending_approval') as pending_approval,
                COUNT(*) FILTER (WHERE status = 'approved') as approved,
                COUNT(*) FILTER (WHERE status = 'rejected') as rejected,
                COUNT(*) FILTER (WHERE status = 'returned') as returned,
                COUNT(*) FILTER (WHERE status = 'draft') as draft
            FROM helpdesk_documents
            WHERE is_active = true
        `;
        const params: unknown[] = [];
        let p = 1;

        if (filters?.entity_type) {
            query += ` AND entity_type = $${p}`;
            params.push(filters.entity_type);
            p++;
        }
        if (filters?.date_from) {
            query += ` AND created_at >= $${p}::date`;
            params.push(filters.date_from);
            p++;
        }
        if (filters?.date_to) {
            query += ` AND created_at <= $${p}::date`;
            params.push(filters.date_to);
            p++;
        }

        const { rows } = await pool.query(query, params);
        const stats = rows[0];

        // Get by entity breakdown
        const { rows: entityRows } = await pool.query(
            `SELECT 
                entity_type,
                COUNT(*) as count,
                COUNT(*) FILTER (WHERE status = 'pending_approval') as pending,
                COUNT(*) FILTER (WHERE status = 'approved') as approved
             FROM helpdesk_documents
             WHERE is_active = true
               AND entity_type IS NOT NULL
             GROUP BY entity_type
             ORDER BY count DESC`
        );

        // Get recent activity
        const { rows: activityRows } = await pool.query(
            `SELECT 
                d.id, d.ref, d.subject, 
                h.action, fu.full_name as user_name, h.created_at
             FROM helpdesk_document_approval_history h
             JOIN helpdesk_documents d ON h.document_id = d.id
             LEFT JOIN users fu ON h.from_user_id = fu.id
             WHERE d.is_active = true
             ORDER BY h.created_at DESC
             LIMIT 10`
        );

        return {
            total: Number(stats.total) || 0,
            pending_approval: Number(stats.pending_approval) || 0,
            approved: Number(stats.approved) || 0,
            rejected: Number(stats.rejected) || 0,
            returned: Number(stats.returned) || 0,
            draft: Number(stats.draft) || 0,
            by_entity: entityRows.map(row => ({
                entity_type: row.entity_type,
                count: Number(row.count) || 0,
                pending: Number(row.pending) || 0,
                approved: Number(row.approved) || 0,
            })),
            recent_activity: activityRows.map(row => ({
                id: row.id,
                ref: row.ref,
                subject: row.subject,
                action: row.action,
                user_name: row.user_name || 'Unknown User',
                created_at: row.created_at,
            })),
        };
    }

    // ── Submit for approval ──────────────────────────────────────────────────

    static async submitForApproval(
        id: string,
        userId: string,
        comments?: string
    ): Promise<HelpdeskDocument> {
        const doc = await this.findById(id);
        if (!doc) throw new AppError(404, 'Document not found');

        if (doc.status !== 'draft') {
            throw new AppError(400, 'Only draft documents can be submitted for approval');
        }

        // Update status
        await pool.query(
            `UPDATE helpdesk_documents
             SET status = 'pending_approval'
             WHERE id = $1 AND is_active = true`,
            [id]
        );

        // Record approval history
        await this.addApprovalHistory(id, userId, 'submitted', undefined, comments);

        // Fetch and return the updated document (with null check)
        const updatedDoc = await this.findById(id);
        if (!updatedDoc) throw new AppError(500, 'Failed to retrieve updated document');
        return updatedDoc;
    }

    // ── Approve document ─────────────────────────────────────────────────────

    static async approveDocument(
        id: string,
        userId: string,
        comments?: string,
        approvedByName?: string
    ): Promise<HelpdeskDocument> {
        const doc = await this.findById(id);
        if (!doc) throw new AppError(404, 'Document not found');

        if (doc.status !== 'pending_approval') {
            throw new AppError(400, 'Only pending documents can be approved');
        }

        // Generate and apply e-stamp
        const eStampResult = await this.generateEStamp(doc);

        // Update status
        await pool.query(
            `UPDATE helpdesk_documents
             SET status = 'approved',
                 approved_by = $1,
                 approved_at = NOW(),
                 e_stamp_status = 'stamped',
                 e_stamp_url = $2,
                 e_stamp_public_id = $3
             WHERE id = $4 AND is_active = true`,
            [userId, eStampResult.secure_url, eStampResult.public_id, id]
        );

        // Record approval history
        await this.addApprovalHistory(id, userId, 'approved', undefined, comments);

        // Fetch and return the updated document (with null check)
        const updatedDoc = await this.findById(id);
        if (!updatedDoc) throw new AppError(500, 'Failed to retrieve updated document');
        return updatedDoc;
    }

    // ── Reject document ──────────────────────────────────────────────────────

    static async rejectDocument(
        id: string,
        userId: string,
        reason: string,
        comments?: string
    ): Promise<HelpdeskDocument> {
        const doc = await this.findById(id);
        if (!doc) throw new AppError(404, 'Document not found');

        if (doc.status !== 'pending_approval') {
            throw new AppError(400, 'Only pending documents can be rejected');
        }

        await pool.query(
            `UPDATE helpdesk_documents
             SET status = 'rejected',
                 rejection_reason = $1
             WHERE id = $2 AND is_active = true`,
            [reason, id]
        );

        await this.addApprovalHistory(id, userId, 'rejected', undefined, comments || reason);

        // Fetch and return the updated document (with null check)
        const updatedDoc = await this.findById(id);
        if (!updatedDoc) throw new AppError(500, 'Failed to retrieve updated document');
        return updatedDoc;
    }

    // ── Return document ──────────────────────────────────────────────────────

    static async returnDocument(
        id: string,
        userId: string,
        comments?: string,
        instructions?: string
    ): Promise<HelpdeskDocument> {
        const doc = await this.findById(id);
        if (!doc) throw new AppError(404, 'Document not found');

        if (doc.status !== 'approved') {
            throw new AppError(400, 'Only approved documents can be returned');
        }

        await pool.query(
            `UPDATE helpdesk_documents
             SET status = 'returned',
                 returned_by = $1,
                 returned_at = NOW()
             WHERE id = $2 AND is_active = true`,
            [userId, id]
        );

        await this.addApprovalHistory(id, userId, 'returned', undefined, comments || instructions);

        // Fetch and return the updated document (with null check)
        const updatedDoc = await this.findById(id);
        if (!updatedDoc) throw new AppError(500, 'Failed to retrieve updated document');
        return updatedDoc;
    }

    // ── Update E-Stamp ──────────────────────────────────────────────────────

    static async updateEStamp(
        id: string,
        eStampUrl?: string,
        eStampPublicId?: string,
        status: 'pending' | 'stamped' | 'failed' = 'stamped'
    ): Promise<HelpdeskDocument> {
        const doc = await this.findById(id);
        if (!doc) throw new AppError(404, 'Document not found');

        await pool.query(
            `UPDATE helpdesk_documents
             SET e_stamp_url = COALESCE($1, e_stamp_url),
                 e_stamp_public_id = COALESCE($2, e_stamp_public_id),
                 e_stamp_status = $3
             WHERE id = $4 AND is_active = true`,
            [eStampUrl || null, eStampPublicId || null, status, id]
        );

        const updatedDoc = await this.findById(id);
        if (!updatedDoc) throw new AppError(500, 'Failed to retrieve updated document');
        return updatedDoc;
    }

    // ── E-Stamp generation ──────────────────────────────────────────────────

    private static async generateEStamp(doc: HelpdeskDocument): Promise<{ secure_url: string; public_id: string }> {
        // Create an e-stamp image/overlay
        const stampData = {
            ref: doc.ref,
            approvedAt: new Date().toISOString(),
            documentId: doc.id,
            entityType: doc.entity_type,
            requestType: doc.request_type,
            judgeName: doc.judge_name,
        };

        // For now, we'll create a simple text-based stamp
        const stampBuffer = Buffer.from(
            JSON.stringify({
                ...stampData,
                verified: true,
                type: 'E-STAMP',
                timestamp: new Date().toISOString(),
            })
        );

        // Upload the stamp to Cloudinary
        const result = await uploadToCloudinary(
            {
                buffer: stampBuffer,
                originalname: `estampe-${doc.ref}.png`,
                mimetype: 'image/png',
                size: stampBuffer.length,
            } as Express.Multer.File,
            E_STAMP_FOLDER
        );

        return {
            secure_url: result.secure_url,
            public_id: result.public_id,
        };
    }

    // ── Approval History ─────────────────────────────────────────────────────

    private static async addApprovalHistory(
        documentId: string,
        fromUserId: string,
        action: 'submitted' | 'approved' | 'rejected' | 'returned',
        toUserId?: string,
        comments?: string
    ): Promise<void> {
        await pool.query(
            `INSERT INTO helpdesk_document_approval_history
                (document_id, from_user_id, to_user_id, action, comments)
             VALUES ($1, $2, $3, $4, $5)`,
            [documentId, fromUserId, toUserId || null, action, comments || null]
        );
    }

    private static async getApprovalHistory(documentId: string): Promise<ApprovalHistoryEntry[]> {
        const { rows } = await pool.query(
            `SELECT 
                h.id, h.document_id, h.action, h.comments, h.created_at,
                h.from_user_id,
                fu.full_name as from_user_name,
                h.to_user_id,
                tu.full_name as to_user_name
             FROM helpdesk_document_approval_history h
             LEFT JOIN users fu ON h.from_user_id = fu.id
             LEFT JOIN users tu ON h.to_user_id = tu.id
             WHERE h.document_id = $1
             ORDER BY h.created_at ASC`,
            [documentId]
        );
        return rows;
    }

    // ── Comments ─────────────────────────────────────────────────────────────

    static async addComment(
        documentId: string,
        userId: string,
        comment: string,
        isInternal: boolean
    ): Promise<Comment> {
        const { rows } = await pool.query(
            `INSERT INTO helpdesk_document_comments
                (document_id, user_id, comment, is_internal)
             VALUES ($1, $2, $3, $4)
             RETURNING id, document_id, user_id, comment, is_internal, created_at`,
            [documentId, userId, comment, isInternal]
        );

        // Get user name
        const user = await pool.query(
            `SELECT full_name FROM users WHERE id = $1`,
            [userId]
        );

        return {
            ...rows[0],
            user_name: user.rows[0]?.full_name || 'Unknown User',
        };
    }

    private static async getComments(documentId: string): Promise<Comment[]> {
        const { rows } = await pool.query(
            `SELECT 
                c.id, c.document_id, c.user_id, c.comment, c.is_internal, c.created_at,
                u.full_name as user_name
             FROM helpdesk_document_comments c
             LEFT JOIN users u ON c.user_id = u.id
             WHERE c.document_id = $1
             ORDER BY c.created_at DESC`,
            [documentId]
        );
        return rows;
    }

    // ── Delete comment ───────────────────────────────────────────────────────

    static async deleteComment(commentId: string, userId: string): Promise<void> {
        const { rows } = await pool.query(
            `DELETE FROM helpdesk_document_comments
             WHERE id = $1 AND user_id = $2
             RETURNING id`,
            [commentId, userId]
        );

        if (rows.length === 0) {
            throw new AppError(404, 'Comment not found or you are not the author');
        }
    }

    // ── Soft-delete (DB) + hard-delete (Cloudinary) ──────────────────────────

    static async delete(id: string): Promise<void> {
        if (!id) {
            throw new AppError(400, 'Document ID is required');
        }

        const doc = await this.findById(id);
        if (!doc) {
            throw new AppError(404, 'Document not found');
        }

        const result = await pool.query(
            `UPDATE helpdesk_documents SET is_active = false WHERE id = $1 RETURNING id`,
            [id]
        );

        if (result.rowCount === 0) {
            throw new AppError(404, 'Document not found or already deleted');
        }

        // Remove from Cloudinary
        try {
            if (doc.public_id) {
                await deleteFromCloudinary(doc.public_id, 'raw');
            }
            if (doc.e_stamp_public_id) {
                await deleteFromCloudinary(doc.e_stamp_public_id, 'raw');
            }
        } catch (err) {
            console.error('Cloudinary delete failed:', err);
        }
    }

    // ── Link to Entity ──────────────────────────────────────────────────────

    static async linkToEntity(
        id: string,
        entityType: string,
        entityId: string,
        requestType?: string,
        judgeName?: string
    ): Promise<HelpdeskDocument> {
        const doc = await this.findById(id);
        if (!doc) throw new AppError(404, 'Document not found');

        // Guard: don't silently reassign a document that's already progressed
        // through approval and belongs to something else.
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

    // ── Bulk Link Documents ──────────────────────────────────────────────────

    static async bulkLinkToEntity(
        documentIds: string[],
        entityType: string,
        entityId: string,
        requestType?: string,
        judgeName?: string
    ): Promise<{ success: string[]; failed: string[] }> {
        const success: string[] = [];
        const failed: string[] = [];

        for (const id of documentIds) {
            try {
                await this.linkToEntity(id, entityType, entityId, requestType, judgeName);
                success.push(id);
            } catch (error) {
                console.error(`Failed to link document ${id}:`, error);
                failed.push(id);
            }
        }

        return { success, failed };
    }

    // ── Bulk Update Status ──────────────────────────────────────────────────

    static async bulkUpdateStatus(
        documentIds: string[],
        status: string,
        comments?: string
    ): Promise<{ success: string[]; failed: string[] }> {
        const success: string[] = [];
        const failed: string[] = [];

        for (const id of documentIds) {
            try {
                await pool.query(
                    `UPDATE helpdesk_documents
                     SET status = $1, updated_at = NOW()
                     WHERE id = $2 AND is_active = true`,
                    [status, id]
                );
                success.push(id);
            } catch (error) {
                console.error(`Failed to update status for document ${id}:`, error);
                failed.push(id);
            }
        }

        return { success, failed };
    }

    // ── Get Document Summary ──────────────────────────────────────────────────

    static async getSummary(filters?: { entity_type?: DocumentEntityType }): Promise<DocumentSummary> {
        let query = `
            SELECT 
                COUNT(*) as total,
                jsonb_object_agg(
                    status, status_count
                ) as by_status,
                jsonb_object_agg(
                    entity_type, entity_count
                ) as by_entity_type,
                jsonb_object_agg(
                    format, format_count
                ) as by_format
            FROM (
                SELECT 
                    status,
                    COUNT(*) as status_count,
                    entity_type,
                    COUNT(*) as entity_count,
                    format,
                    COUNT(*) as format_count
                FROM helpdesk_documents
                WHERE is_active = true
                ${filters?.entity_type ? 'AND entity_type = $1' : ''}
                GROUP BY status, entity_type, format
            ) sub
        `;

        const params = filters?.entity_type ? [filters.entity_type] : [];
        const { rows } = await pool.query(query, params);

        const result = rows[0] || {};
        
        // Get counts by status
        const { rows: statusRows } = await pool.query(
            `SELECT status, COUNT(*) as count
             FROM helpdesk_documents
             WHERE is_active = true
             ${filters?.entity_type ? 'AND entity_type = $1' : ''}
             GROUP BY status`,
            params
        );

        const byStatus: Record<string, number> = {};
        statusRows.forEach(row => {
            byStatus[row.status] = Number(row.count) || 0;
        });

        return {
            total: Number(result.total) || 0,
            by_status: byStatus,
            by_entity_type: result.by_entity_type || {},
            by_format: result.by_format || {},
            pending_approval: byStatus['pending_approval'] || 0,
            draft: byStatus['draft'] || 0,
            approved: byStatus['approved'] || 0,
            rejected: byStatus['rejected'] || 0,
            returned: byStatus['returned'] || 0,
        };
    }
}