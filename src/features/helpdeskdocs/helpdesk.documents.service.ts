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
} from './helpdesk.documents.types';

const FOLDER = 'orhc/helpdesk-documents';
const E_STAMP_FOLDER = 'orhc/helpdesk-documents/e-stamps';

const DOC_SELECT = `
    d.id, d.ref, d.subject, d.entity_type, d.entity_id, d.format,
    d.file_url, d.public_id, d.file_size,
    d.uploaded_by, d.is_active, d.created_at, d.updated_at,
    d.status, d.e_stamp_status, d.e_stamp_url, d.e_stamp_public_id,
    d.approved_at, d.approved_by, d.returned_at, d.returned_by,
    d.rejection_reason,
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
                     file_url, public_id, file_size, uploaded_by, status)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
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
        comments?: string
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

    // ── E-Stamp generation ──────────────────────────────────────────────────

    private static async generateEStamp(doc: HelpdeskDocument): Promise<{ secure_url: string; public_id: string }> {
        // Create an e-stamp image/overlay
        const stampData = {
            ref: doc.ref,
            approvedAt: new Date().toISOString(),
            documentId: doc.id,
        };

        // For now, we'll create a simple text-based stamp
        const stampBuffer = Buffer.from(
            JSON.stringify({
                ...stampData,
                verified: true,
                type: 'E-STAMP',
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

    private static async addComment(
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

    static async linkToEntity(
    id: string,
    entityType: string,
    entityId: string
): Promise<HelpdeskDocument> {
    const doc = await this.findById(id);
    if (!doc) throw new AppError(404, 'Document not found');

    // Guard: don't silently reassign a document that's already progressed
    // through approval and belongs to something else.
    if (doc.entity_id && doc.entity_id !== entityId) {
        throw new AppError(400, 'Document is already linked to another record');
    }

    await pool.query(
        `UPDATE helpdesk_documents
         SET entity_type = $1, entity_id = $2
         WHERE id = $3 AND is_active = true`,
        [entityType, entityId, id]
    );

    const updatedDoc = await this.findById(id);
    if (!updatedDoc) throw new AppError(500, 'Failed to retrieve updated document');
    return updatedDoc;
}
}