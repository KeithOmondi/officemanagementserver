// src/features/helpdesk/helpdesk.documents.service.ts

import { pool }                   from '../../config/db';
import { AppError }               from '../../utils/response';
import { uploadToCloudinary, deleteFromCloudinary } from '../../config/cloudinary';
import type {
    HelpdeskDocument,
    CreateHelpdeskDocumentInput,
    HelpdeskDocumentFilters,
} from './helpdesk.documents.types';

// ─── Cloudinary folder ───────────────────────────────────────────────────────

const FOLDER = 'orhc/helpdesk-documents';

// ─── SELECT fragment ─────────────────────────────────────────────────────────

const DOC_SELECT = `
    id, ref, subject, entity_type, entity_id, format,
    file_url, public_id, file_size,
    uploaded_by, is_active, created_at, updated_at
`;

// ─── Service ─────────────────────────────────────────────────────────────────

export class HelpdeskDocumentsService {

    // ── Upload & persist ─────────────────────────────────────────────────────

    static async upload(
        file: Express.Multer.File,
        input: CreateHelpdeskDocumentInput,
        userId: string
    ): Promise<HelpdeskDocument> {
        // 1. Push to Cloudinary
        const result = await uploadToCloudinary(file, FOLDER);

        // 2. Persist metadata to DB
        try {
            const { rows } = await pool.query(
                `INSERT INTO helpdesk_documents
                    (ref, subject, entity_type, entity_id, format,
                     file_url, public_id, file_size, uploaded_by)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
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
                ]
            );

            const doc = await this.findById(rows[0].id);
            if (!doc) throw new AppError(500, 'Failed to persist document record');
            return doc;

        } catch (err) {
            // If DB insert fails, clean up the Cloudinary upload
            await deleteFromCloudinary(result.public_id, 'raw').catch(() => null);
            throw err;
        }
    }

    // ── Find one ─────────────────────────────────────────────────────────────

    static async findById(id: string): Promise<HelpdeskDocument | null> {
        const { rows } = await pool.query(
            `SELECT ${DOC_SELECT}
             FROM helpdesk_documents
             WHERE id = $1 AND is_active = true`,
            [id]
        );
        return rows[0] || null;
    }

    // ── List with filters ────────────────────────────────────────────────────

    static async findAll(filters: HelpdeskDocumentFilters = {}): Promise<HelpdeskDocument[]> {
        let query  = `SELECT ${DOC_SELECT} FROM helpdesk_documents WHERE is_active = true`;
        const params: unknown[] = [];
        let p = 1;

        if (filters.entity_type) {
            query += ` AND entity_type = $${p}`;
            params.push(filters.entity_type);
            p++;
        }
        if (filters.entity_id) {
            query += ` AND entity_id = $${p}`;
            params.push(filters.entity_id);
            p++;
        }
        if (filters.format) {
            query += ` AND format = $${p}`;
            params.push(filters.format);
            p++;
        }
        if (filters.search) {
            query += ` AND (ref ILIKE $${p} OR subject ILIKE $${p})`;
            params.push(`%${filters.search}%`);
            p++;
        }

        query += ` ORDER BY created_at DESC`;

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
        return rows;
    }

    // ── Soft-delete (DB) + hard-delete (Cloudinary) ──────────────────────────

    static async delete(id: string): Promise<void> {
        const doc = await this.findById(id);
        if (!doc) throw new AppError(404, 'Document not found');

        // Soft-delete in DB first
        await pool.query(
            `UPDATE helpdesk_documents SET is_active = false WHERE id = $1`,
            [id]
        );

        // Best-effort remove from Cloudinary (don't fail the request if this errors)
        await deleteFromCloudinary(doc.public_id, 'raw').catch((err) => {
            console.error('Cloudinary delete failed for', doc.public_id, err);
        });
    }
}