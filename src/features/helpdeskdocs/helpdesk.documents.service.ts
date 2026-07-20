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
    EStampStatus,
} from './helpdesk.documents.types';

const FOLDER = 'orhc/helpdesk-documents';
const E_STAMP_FOLDER = 'orhc/helpdesk-documents/e-stamps';

// ─── SELECT Fragment ──────────────────────────────────────────────────────────

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

// ─── Helper: Clean input for database ─────────────────────────────────────────

/**
 * Cleans the input by converting null/undefined/empty strings to appropriate values
 * for database insertion.
 */
function cleanInput(input: CreateHelpdeskDocumentInput): CreateHelpdeskDocumentInput {
    return {
        ref: input.ref?.trim() || '',
        subject: input.subject?.trim() || '',
        entity_type: input.entity_type,
        // ✅ Convert null to undefined for entity_id
        entity_id: input.entity_id === null ? undefined : input.entity_id?.trim() || undefined,
        format: input.format,
        status: input.status || 'draft',
        // ✅ Convert null to undefined for optional fields
        request_type: input.request_type === null ? undefined : input.request_type?.trim() || undefined,
        judge_name: input.judge_name === null ? undefined : input.judge_name?.trim() || undefined,
        rank: input.rank === null ? undefined : input.rank?.trim() || undefined,
        reporting_date: input.reporting_date === null ? undefined : input.reporting_date?.trim() || undefined,
    };
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class HelpdeskDocumentsService {

    // ─── Upload & Persist ─────────────────────────────────────────────────────

    static async upload(
        file: Express.Multer.File,
        input: CreateHelpdeskDocumentInput,
        userId: string
    ): Promise<HelpdeskDocument> {
        // Clean the input first
        const cleaned = cleanInput(input);

        if (!cleaned.ref?.trim()) {
            throw new AppError(400, 'Reference number is required');
        }
        if (!cleaned.subject?.trim()) {
            throw new AppError(400, 'Subject is required');
        }
        if (!cleaned.entity_type) {
            throw new AppError(400, 'Entity type is required');
        }
        if (!cleaned.format) {
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
                    cleaned.ref.trim(),
                    cleaned.subject.trim(),
                    cleaned.entity_type,
                    cleaned.entity_id || null,  // Convert undefined to null for DB
                    cleaned.format,
                    result.secure_url,
                    result.public_id,
                    result.bytes ?? null,
                    userId,
                    cleaned.status || 'draft',
                    cleaned.request_type || null,
                    cleaned.judge_name || null,
                    cleaned.rank || null,
                    cleaned.reporting_date || null,
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

    // ─── Find One ─────────────────────────────────────────────────────────────

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

        const history = await this.getApprovalHistory(id);
        const comments = await this.getComments(id);

        return {
            ...rows[0],
            approval_history: history,
            comments: comments,
        };
    }

    // ─── Find All with Filters ───────────────────────────────────────────────

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

        // Pending my approval filter
        if (filters.pending_my_approval && filters.uploaded_by) {
            // This would need to check the approval workflow
            // For now, we'll just filter by status
            query += ` AND d.status = 'pending_approval'`;
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

    // ─── Find by Entity ──────────────────────────────────────────────────────

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

    // ─── Get Statistics ──────────────────────────────────────────────────────

    static async getStats(filters?: { entity_type?: DocumentEntityType; date_from?: string; date_to?: string }): Promise<DocumentStats> {
        const params: unknown[] = [];
        let whereClause = 'WHERE d.is_active = true';
        let p = 1;

        if (filters?.entity_type) {
            whereClause += ` AND d.entity_type = $${p}`;
            params.push(filters.entity_type);
            p++;
        }
        if (filters?.date_from) {
            whereClause += ` AND d.created_at >= $${p}::date`;
            params.push(filters.date_from);
            p++;
        }
        if (filters?.date_to) {
            whereClause += ` AND d.created_at <= $${p}::date`;
            params.push(filters.date_to);
            p++;
        }

        // Total
        const totalQuery = `SELECT COUNT(*) as total FROM helpdesk_documents d ${whereClause}`;
        const { rows: totalRows } = await pool.query(totalQuery, params);
        const total = Number(totalRows[0]?.total) || 0;

        // Status breakdown
        const statusQuery = `SELECT d.status, COUNT(*) as count FROM helpdesk_documents d ${whereClause} GROUP BY d.status`;
        const { rows: statusRows } = await pool.query(statusQuery, params);
        const statusCounts: Record<string, number> = {};
        statusRows.forEach(row => {
            statusCounts[row.status] = Number(row.count);
        });

        // By entity
        const entityQuery = `
            SELECT d.entity_type, COUNT(*) as count, 
                   COUNT(CASE WHEN d.status = 'pending_approval' THEN 1 END) as pending,
                   COUNT(CASE WHEN d.status = 'approved' THEN 1 END) as approved
            FROM helpdesk_documents d ${whereClause}
            GROUP BY d.entity_type
        `;
        const { rows: entityRows } = await pool.query(entityQuery, params);

        // Recent activity
        const activityQuery = `
            SELECT d.id, d.ref, d.subject, 'submitted' as action, u.full_name as user_name, d.created_at
            FROM helpdesk_documents d
            LEFT JOIN users u ON d.uploaded_by = u.id
            ${whereClause}
            ORDER BY d.created_at DESC
            LIMIT 10
        `;
        const { rows: activityRows } = await pool.query(activityQuery, params);

        return {
            total,
            pending_approval: statusCounts.pending_approval || 0,
            approved: statusCounts.approved || 0,
            rejected: statusCounts.rejected || 0,
            returned: statusCounts.returned || 0,
            draft: statusCounts.draft || 0,
            by_entity: entityRows.map(row => ({
                entity_type: row.entity_type,
                count: Number(row.count),
                pending: Number(row.pending) || 0,
                approved: Number(row.approved) || 0,
            })),
            recent_activity: activityRows.map(row => ({
                id: row.id,
                ref: row.ref,
                subject: row.subject,
                action: row.action,
                user_name: row.user_name || 'System',
                created_at: row.created_at,
            })),
        };
    }

    // ─── Get Summary ─────────────────────────────────────────────────────────

    static async getSummary(filters?: { entity_type?: DocumentEntityType }): Promise<DocumentSummary> {
        const params: unknown[] = [];
        let whereClause = 'WHERE d.is_active = true';
        let p = 1;

        if (filters?.entity_type) {
            whereClause += ` AND d.entity_type = $${p}`;
            params.push(filters.entity_type);
            p++;
        }

        const summaryQuery = `
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN d.status = 'draft' THEN 1 END) as draft,
                COUNT(CASE WHEN d.status = 'pending_approval' THEN 1 END) as pending_approval,
                COUNT(CASE WHEN d.status = 'approved' THEN 1 END) as approved,
                COUNT(CASE WHEN d.status = 'rejected' THEN 1 END) as rejected,
                COUNT(CASE WHEN d.status = 'returned' THEN 1 END) as returned
            FROM helpdesk_documents d
            ${whereClause}
        `;
        const { rows } = await pool.query(summaryQuery, params);
        const summary = rows[0];

        // By status
        const statusQuery = `SELECT d.status, COUNT(*) as count FROM helpdesk_documents d ${whereClause} GROUP BY d.status`;
        const { rows: statusRows } = await pool.query(statusQuery, params);
        const byStatus: Record<string, number> = {};
        statusRows.forEach(row => {
            byStatus[row.status] = Number(row.count);
        });

        // By entity type
        const entityQuery = `SELECT d.entity_type, COUNT(*) as count FROM helpdesk_documents d ${whereClause} GROUP BY d.entity_type`;
        const { rows: entityRows } = await pool.query(entityQuery, params);
        const byEntityType: Record<string, number> = {};
        entityRows.forEach(row => {
            byEntityType[row.entity_type] = Number(row.count);
        });

        // By format
        const formatQuery = `SELECT d.format, COUNT(*) as count FROM helpdesk_documents d ${whereClause} GROUP BY d.format`;
        const { rows: formatRows } = await pool.query(formatQuery, params);
        const byFormat: Record<string, number> = {};
        formatRows.forEach(row => {
            byFormat[row.format] = Number(row.count);
        });

        return {
            total: Number(summary.total) || 0,
            by_status: byStatus as Record<DocumentStatus, number>,
            by_entity_type: byEntityType as Record<DocumentEntityType, number>,
            by_format: byFormat as Record<DocumentFormat, number>,
            pending_approval: Number(summary.pending_approval) || 0,
            draft: Number(summary.draft) || 0,
            approved: Number(summary.approved) || 0,
            rejected: Number(summary.rejected) || 0,
            returned: Number(summary.returned) || 0,
        };
    }

    // ─── Submit for Approval ────────────────────────────────────────────────

    static async submitForApproval(
        id: string,
        userId: string,
        comments?: string
    ): Promise<HelpdeskDocument> {
        const doc = await this.findById(id);
        if (!doc) {
            throw new AppError(404, 'Document not found');
        }

        if (doc.status !== 'draft' && doc.status !== 'returned') {
            throw new AppError(400, `Cannot submit document with status: ${doc.status}`);
        }

        if (!doc.entity_id) {
            throw new AppError(400, 'Document must be linked to an entity before submission');
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            await client.query(
                `UPDATE helpdesk_documents
                 SET status = 'pending_approval',
                     updated_at = NOW()
                 WHERE id = $1 AND is_active = true`,
                [id]
            );

            await this.addApprovalHistory(
                id,
                userId,
                'submitted',
                undefined,
                comments || 'Document submitted for approval'
            );

            await client.query('COMMIT');

            const updatedDoc = await this.findById(id);
            if (!updatedDoc) throw new AppError(500, 'Failed to retrieve updated document');
            return updatedDoc;
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    // ─── Approve Document ────────────────────────────────────────────────────

    static async approveDocument(
        id: string,
        userId: string,
        comments?: string,
        approvedByName?: string
    ): Promise<HelpdeskDocument> {
        const doc = await this.findById(id);
        if (!doc) {
            throw new AppError(404, 'Document not found');
        }

        if (doc.status !== 'pending_approval') {
            throw new AppError(400, `Cannot approve document with status: ${doc.status}`);
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Generate e-stamp
            const eStamp = await this.generateEStamp(doc);

            await client.query(
                `UPDATE helpdesk_documents
                 SET status = 'approved',
                     approved_by = $1,
                     approved_at = NOW(),
                     e_stamp_url = $2,
                     e_stamp_public_id = $3,
                     e_stamp_status = 'stamped',
                     updated_at = NOW()
                 WHERE id = $4 AND is_active = true`,
                [userId, eStamp.secure_url, eStamp.public_id, id]
            );

            await this.addApprovalHistory(
                id,
                userId,
                'approved',
                doc.uploaded_by || undefined,
                comments || 'Document approved'
            );

            await client.query('COMMIT');

            const updatedDoc = await this.findById(id);
            if (!updatedDoc) throw new AppError(500, 'Failed to retrieve updated document');
            return updatedDoc;
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    // ─── Reject Document ─────────────────────────────────────────────────────

    static async rejectDocument(
        id: string,
        userId: string,
        reason: string,
        comments?: string
    ): Promise<HelpdeskDocument> {
        const doc = await this.findById(id);
        if (!doc) {
            throw new AppError(404, 'Document not found');
        }

        if (doc.status !== 'pending_approval') {
            throw new AppError(400, `Cannot reject document with status: ${doc.status}`);
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            await client.query(
                `UPDATE helpdesk_documents
                 SET status = 'rejected',
                     rejection_reason = $1,
                     updated_at = NOW()
                 WHERE id = $2 AND is_active = true`,
                [reason, id]
            );

            const fullComment = comments 
                ? `Rejection reason: ${reason}. ${comments}` 
                : `Rejection reason: ${reason}`;

            await this.addApprovalHistory(
                id,
                userId,
                'rejected',
                doc.uploaded_by || undefined,
                fullComment
            );

            await client.query('COMMIT');

            const updatedDoc = await this.findById(id);
            if (!updatedDoc) throw new AppError(500, 'Failed to retrieve updated document');
            return updatedDoc;
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    // ─── Return Document ─────────────────────────────────────────────────────

    static async returnDocument(
        id: string,
        userId: string,
        comments?: string,
        instructions?: string
    ): Promise<HelpdeskDocument> {
        const doc = await this.findById(id);
        if (!doc) {
            throw new AppError(404, 'Document not found');
        }

        if (doc.status !== 'pending_approval' && doc.status !== 'approved') {
            throw new AppError(400, `Cannot return document with status: ${doc.status}`);
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            await client.query(
                `UPDATE helpdesk_documents
                 SET status = 'returned',
                     returned_by = $1,
                     returned_at = NOW(),
                     updated_at = NOW()
                 WHERE id = $2 AND is_active = true`,
                [userId, id]
            );

            const fullComment = instructions 
                ? `${comments || ''} Instructions: ${instructions}`.trim()
                : comments || 'Document returned for revision';

            await this.addApprovalHistory(
                id,
                userId,
                'returned',
                doc.uploaded_by || undefined,
                fullComment
            );

            await client.query('COMMIT');

            const updatedDoc = await this.findById(id);
            if (!updatedDoc) throw new AppError(500, 'Failed to retrieve updated document');
            return updatedDoc;
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    // ─── Update E-Stamp ──────────────────────────────────────────────────────

    static async updateEStamp(
        id: string,
        eStampUrl?: string,
        eStampPublicId?: string,
        status: EStampStatus = 'stamped'
    ): Promise<HelpdeskDocument> {
        const doc = await this.findById(id);
        if (!doc) {
            throw new AppError(404, 'Document not found');
        }

        const updates: string[] = [];
        const values: unknown[] = [];
        let p = 1;

        if (eStampUrl !== undefined) {
            updates.push(`e_stamp_url = $${p}`);
            values.push(eStampUrl);
            p++;
        }
        if (eStampPublicId !== undefined) {
            updates.push(`e_stamp_public_id = $${p}`);
            values.push(eStampPublicId);
            p++;
        }
        updates.push(`e_stamp_status = $${p}`);
        values.push(status);
        p++;
        updates.push(`updated_at = NOW()`);
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

    // ─── Generate E-Stamp ────────────────────────────────────────────────────

    private static async generateEStamp(doc: HelpdeskDocument): Promise<{ secure_url: string; public_id: string }> {
        // In a real implementation, this would generate an e-stamp PDF
        // For now, we'll return a placeholder
        return {
            secure_url: doc.file_url,
            public_id: doc.public_id || 'estampt-placeholder',
        };
    }

    // ─── Link to Entity ──────────────────────────────────────────────────────

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

        updates.push(`updated_at = NOW()`);
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

    // ─── Bulk Link Documents ─────────────────────────────────────────────────

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

    // ─── Bulk Update Status ──────────────────────────────────────────────────

    static async bulkUpdateStatus(
        documentIds: string[],
        status: string,
        comments?: string
    ): Promise<{ success: string[]; failed: string[] }> {
        const success: string[] = [];
        const failed: string[] = [];

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            for (const id of documentIds) {
                try {
                    const doc = await this.findById(id);
                    if (!doc) {
                        failed.push(id);
                        continue;
                    }

                    // Validate status transition
                    const validTransitions: Record<string, string[]> = {
                        draft: ['pending_approval'],
                        pending_approval: ['approved', 'rejected', 'returned'],
                        approved: ['returned'],
                        rejected: ['draft'],
                        returned: ['draft'],
                    };

                    if (!validTransitions[doc.status]?.includes(status)) {
                        failed.push(id);
                        continue;
                    }

                    await client.query(
                        `UPDATE helpdesk_documents
                         SET status = $1,
                             updated_at = NOW()
                         WHERE id = $2 AND is_active = true`,
                        [status, id]
                    );

                    // Add to history
                    await this.addApprovalHistory(
                        id,
                        'system',
                        status as any,
                        undefined,
                        comments || `Bulk status update to ${status}`
                    );

                    success.push(id);
                } catch (error) {
                    console.error(`Failed to update status for document ${id}:`, error);
                    failed.push(id);
                }
            }

            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }

        return { success, failed };
    }

    // ─── Comments ─────────────────────────────────────────────────────────────

    static async addComment(
        documentId: string,
        userId: string,
        comment: string,
        isInternal: boolean
    ): Promise<Comment> {
        const doc = await this.findById(documentId);
        if (!doc) {
            throw new AppError(404, 'Document not found');
        }

        const { rows } = await pool.query(
            `INSERT INTO helpdesk_document_comments
                (document_id, user_id, comment, is_internal)
             VALUES ($1, $2, $3, $4)
             RETURNING id`,
            [documentId, userId, comment, isInternal]
        );

        const { rows: result } = await pool.query(
            `SELECT c.id, c.document_id, c.user_id, c.comment, c.is_internal, c.created_at,
                    u.full_name as user_name
             FROM helpdesk_document_comments c
             LEFT JOIN users u ON c.user_id = u.id
             WHERE c.id = $1`,
            [rows[0].id]
        );

        return result[0];
    }

    static async deleteComment(commentId: string, userId: string): Promise<void> {
        const { rows } = await pool.query(
            `SELECT id, user_id FROM helpdesk_document_comments
             WHERE id = $1`,
            [commentId]
        );

        if (!rows.length) {
            throw new AppError(404, 'Comment not found');
        }

        if (rows[0].user_id !== userId) {
            throw new AppError(403, 'You can only delete your own comments');
        }

        await pool.query(
            `DELETE FROM helpdesk_document_comments WHERE id = $1`,
            [commentId]
        );
    }

    // ─── Approval History ────────────────────────────────────────────────────

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
            `SELECT h.id, h.document_id, h.action, h.comments, h.created_at,
                    h.from_user_id, fu.full_name as from_user_name,
                    h.to_user_id, tu.full_name as to_user_name
             FROM helpdesk_document_approval_history h
             LEFT JOIN users fu ON h.from_user_id = fu.id
             LEFT JOIN users tu ON h.to_user_id = tu.id
             WHERE h.document_id = $1
             ORDER BY h.created_at ASC`,
            [documentId]
        );

        return rows.map(row => ({
            ...row,
            from_user_name: row.from_user_name || 'System',
        }));
    }

    private static async getComments(documentId: string): Promise<Comment[]> {
        const { rows } = await pool.query(
            `SELECT c.id, c.document_id, c.user_id, c.comment, c.is_internal, c.created_at,
                    u.full_name as user_name
             FROM helpdesk_document_comments c
             LEFT JOIN users u ON c.user_id = u.id
             WHERE c.document_id = $1
             ORDER BY c.created_at ASC`,
            [documentId]
        );

        return rows;
    }

    // ─── Delete Document ─────────────────────────────────────────────────────

    static async delete(id: string): Promise<void> {
        const doc = await this.findById(id);
        if (!doc) {
            throw new AppError(404, 'Document not found');
        }

        if (!doc.is_active) {
            throw new AppError(400, 'Document is already deleted');
        }

        // Prevent deleting approved documents (unless forced)
        if (doc.status === 'approved') {
            throw new AppError(400, 'Cannot delete approved documents. Return them first.');
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Soft delete the document
            const { rowCount } = await client.query(
                `UPDATE helpdesk_documents 
                 SET is_active = false, 
                     updated_at = NOW() 
                 WHERE id = $1 AND is_active = true`,
                [id]
            );

            if (rowCount === 0) {
                throw new AppError(404, 'Document not found or already deleted');
            }

            // Soft delete related comments (keep for audit trail)
            await client.query(
                `UPDATE helpdesk_document_comments
                 SET is_active = false
                 WHERE document_id = $1`,
                [id]
            );

            await client.query('COMMIT');

            // Delete from Cloudinary after DB transaction succeeds
            if (doc.public_id) {
                try {
                    await deleteFromCloudinary(doc.public_id, 'raw');
                } catch (error) {
                    console.error('Failed to delete file from Cloudinary:', error);
                }
            }

            if (doc.e_stamp_public_id) {
                try {
                    await deleteFromCloudinary(doc.e_stamp_public_id, 'raw');
                } catch (error) {
                    console.error('Failed to delete e-stamp from Cloudinary:', error);
                }
            }

        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    // ─── Hard Delete (Admin Only) ───────────────────────────────────────────

    static async hardDelete(id: string): Promise<void> {
        const doc = await this.findById(id);
        if (!doc) {
            throw new AppError(404, 'Document not found');
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Delete comments
            await client.query(
                `DELETE FROM helpdesk_document_comments WHERE document_id = $1`,
                [id]
            );

            // Delete approval history
            await client.query(
                `DELETE FROM helpdesk_document_approval_history WHERE document_id = $1`,
                [id]
            );

            // Delete the document
            const { rowCount } = await client.query(
                `DELETE FROM helpdesk_documents WHERE id = $1`,
                [id]
            );

            if (rowCount === 0) {
                throw new AppError(404, 'Document not found');
            }

            await client.query('COMMIT');

            // Delete from Cloudinary
            if (doc.public_id) {
                try {
                    await deleteFromCloudinary(doc.public_id, 'raw');
                } catch (error) {
                    console.error('Failed to delete file from Cloudinary:', error);
                }
            }

            if (doc.e_stamp_public_id) {
                try {
                    await deleteFromCloudinary(doc.e_stamp_public_id, 'raw');
                } catch (error) {
                    console.error('Failed to delete e-stamp from Cloudinary:', error);
                }
            }

        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }
}