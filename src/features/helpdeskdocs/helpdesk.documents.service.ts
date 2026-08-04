import { pool } from '../../config/db';
import { AppError } from '../../utils/response';
import { uploadToCloudinary, deleteFromCloudinary } from '../../config/cloudinary';
//import axios from 'axios';
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
    //EStampStatus,
    UpdateDocumentFileInput,
    //InternalApprovalStatus,
    RequesterVisibleStatus,
    InternalApprovalRequest,
    InternalPreviewRequest,
    SendBackToRequesterRequest,
    ResubmitAfterChangesRequest,
    CancelInternalApprovalRequest,
    PendingInternalApprovalsSummary,
    RequesterDocumentView,
    StampType,
} from './helpdesk.documents.types';
import { EStampService } from '../e-stamp/e-stamp.service';
import { embedSignatureBlockIntoPDF } from '../../utils/signatureBlock';
import { sendHelpdeskChangesRequested } from '../../utils/helpdeskTemplates';
import { sendHelpdeskApproved, sendHelpdeskRejected } from '../../utils/sendMail';

const FOLDER = 'orhc/helpdesk-documents';
//const E_STAMP_FOLDER = 'orhc/helpdesk-documents/e-stamps';

// ─── SELECT Fragment (UPDATED: Added stamped_file columns) ──────────────────

const DOC_SELECT = `
    d.id, d.ref, d.subject, d.entity_type, d.entity_id, d.format,
    d.file_url, d.public_id, d.file_size,
    d.uploaded_by, d.is_active, d.created_at, d.updated_at,
    d.status, d.e_stamp_status, d.e_stamp_url, d.e_stamp_public_id,
    d.approved_at, d.approved_by, d.returned_at, d.returned_by,
    d.rejection_reason, d.request_type, d.judge_name,
    d.rank, d.reporting_date,
    d.officer_rank, d.officer_name, d.employment_number,
    d.current_station, d.current_unit, d.proposed_assignment, d.aide_status,
    d.residence_location, d.sentry_status,
    -- Two-step approval fields
    d.internal_approval_status, d.internal_approved_by, d.internal_approved_by_name,
    d.internal_approved_at, d.internal_comments, d.internal_changes_requested,
    d.internal_rejection_reason, d.internal_preview_count, d.internal_previewed_at,
    d.internal_previewed_by, d.internal_previewed_by_name,
    d.requester_status, d.requester_visible_at, d.requester_visible_by,
    d.requester_visible_by_name, d.resubmit_count, d.last_resubmitted_at,
    d.last_resubmitted_by, d.is_internal_approval_complete,
    d.is_sent_back_to_requester, d.is_requester_notified,
    -- Signature fields
    d.is_signed, d.signed_by, d.signed_by_name, d.signed_at,
    d.signature_position_x, d.signature_position_y,
    d.signature_position_width, d.signature_position_height,
    -- Stamp fields
    d.is_stamped, d.stamped_by, d.stamped_by_name, d.stamped_at,
    d.stamp_type, d.stamp_position_x, d.stamp_position_y,
    d.stamp_position_width, d.stamp_position_height,
    -- NEW: Final Generated PDF fields
    d.stamped_file_url, d.stamped_file_public_id, d.stamped_file_size,
    u.full_name as uploaded_by_name,
    au.full_name as approved_by_name,
    ru.full_name as returned_by_name,
    su.full_name as signed_by_name,
    stu.full_name as stamped_by_name
`;

// ─── Helper: Clean input for database ─────────────────────────────────────────

function cleanInput(input: CreateHelpdeskDocumentInput): CreateHelpdeskDocumentInput {
    const cleaned: CreateHelpdeskDocumentInput = {
        ref: input.ref?.trim() || '',
        subject: input.subject?.trim() || '',
        entity_type: input.entity_type,
        entity_id: input.entity_id === null ? undefined : input.entity_id?.trim() || undefined,
        format: input.format,
        status: input.status || 'draft',
        request_type: input.request_type === null ? undefined : input.request_type?.trim() || undefined,
        judge_name: input.judge_name === null ? undefined : input.judge_name?.trim() || undefined,
        rank: input.rank === null ? undefined : input.rank?.trim() || undefined,
        reporting_date: input.reporting_date === null ? undefined : input.reporting_date?.trim() || undefined,
        officer_rank: input.officer_rank === null ? undefined : input.officer_rank?.trim() || undefined,
        officer_name: input.officer_name === null ? undefined : input.officer_name?.trim() || undefined,
        employment_number: input.employment_number === null ? undefined : input.employment_number?.trim() || undefined,
        current_station: input.current_station === null ? undefined : input.current_station?.trim() || undefined,
        current_unit: input.current_unit === null ? undefined : input.current_unit?.trim() || undefined,
        proposed_assignment: input.proposed_assignment === null ? undefined : input.proposed_assignment?.trim() || undefined,
        aide_status: input.aide_status === null ? undefined : input.aide_status?.trim() || undefined,
        residence_location: input.residence_location === null ? undefined : input.residence_location?.trim() || undefined,
        sentry_status: input.sentry_status === null ? undefined : input.sentry_status?.trim() || undefined,
        stamp_type: input.stamp_type === null ? undefined : input.stamp_type,
    };
    return cleaned;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class HelpdeskDocumentsService {

    // ─── Upload & Persist ─────────────────────────────────────────────────────

    static async upload(
        file: Express.Multer.File | undefined,
        input: CreateHelpdeskDocumentInput,
        userId: string
    ): Promise<HelpdeskDocument> {
        if (!file) {
            throw new AppError(400, 'No file uploaded. Please attach a file to upload.');
        }

        const MAX_FILE_SIZE = 10 * 1024 * 1024;
        if (file.size > MAX_FILE_SIZE) {
            throw new AppError(400, `File size exceeds maximum allowed (${MAX_FILE_SIZE / 1024 / 1024}MB)`);
        }

        const allowedMimeTypes = [
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ];
        
        if (!allowedMimeTypes.includes(file.mimetype)) {
            throw new AppError(400, `Invalid file type. Allowed types: PDF, DOCX, XLSX. Received: ${file.mimetype}`);
        }

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

        const formatToMimeMap: Record<string, string[]> = {
            'pdf': ['application/pdf'],
            'docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
            'xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
        };

        const allowedMimesForFormat = formatToMimeMap[cleaned.format];
        if (allowedMimesForFormat && !allowedMimesForFormat.includes(file.mimetype)) {
            throw new AppError(
                400, 
                `File type mismatch. Expected ${cleaned.format.toUpperCase()} but received ${file.mimetype}`
            );
        }

        const result = await uploadToCloudinary(file, FOLDER);

        try {
            const { rows } = await pool.query(
                `INSERT INTO helpdesk_documents
                    (ref, subject, entity_type, entity_id, format,
                     file_url, public_id, file_size, uploaded_by, status,
                     request_type, judge_name, rank, reporting_date,
                     officer_rank, officer_name, employment_number,
                     current_station, current_unit, proposed_assignment, aide_status,
                     residence_location, sentry_status,
                     internal_approval_status, requester_status,
                     is_stamped, stamp_type)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 
                         $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27)
                 RETURNING id`,
                [
                    cleaned.ref.trim(),
                    cleaned.subject.trim(),
                    cleaned.entity_type,
                    cleaned.entity_id || null,
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
                    cleaned.officer_rank || null,
                    cleaned.officer_name || null,
                    cleaned.employment_number || null,
                    cleaned.current_station || null,
                    cleaned.current_unit || null,
                    cleaned.proposed_assignment || null,
                    cleaned.aide_status || null,
                    cleaned.residence_location || null,
                    cleaned.sentry_status || null,
                    'pending',
                    'pending_approval',
                    false, // is_stamped
                    cleaned.stamp_type || null, // stamp_type
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

    // ─── Update Document File (UPDATED: Save Stamped File Metadata) ────────────

    static async updateDocumentFile(
        id: string,
        file: Express.Multer.File | undefined,
        input: UpdateDocumentFileInput,
        userId?: string
    ): Promise<HelpdeskDocument> {
        if (!file) {
            throw new AppError(400, 'No file uploaded. Please attach a file to update.');
        }

        const MAX_FILE_SIZE = 10 * 1024 * 1024;
        if (file.size > MAX_FILE_SIZE) {
            throw new AppError(400, `File size exceeds maximum allowed (${MAX_FILE_SIZE / 1024 / 1024}MB)`);
        }

        const allowedMimeTypes = [
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ];
        
        if (!allowedMimeTypes.includes(file.mimetype)) {
            throw new AppError(400, `Invalid file type. Allowed types: PDF, DOCX, XLSX. Received: ${file.mimetype}`);
        }

        const doc = await this.findById(id);
        if (!doc) {
            throw new AppError(404, 'Document not found');
        }

        const formatToMimeMap: Record<string, string[]> = {
            'pdf': ['application/pdf'],
            'docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
            'xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
        };

        const allowedMimesForFormat = formatToMimeMap[doc.format];
        if (allowedMimesForFormat && !allowedMimesForFormat.includes(file.mimetype)) {
            throw new AppError(
                400, 
                `File type mismatch. Expected ${doc.format.toUpperCase()} but received ${file.mimetype}`
            );
        }

        const result = await uploadToCloudinary(file, FOLDER);

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const updates: string[] = [];
            const values: unknown[] = [];
            let p = 1;

            updates.push(`file_url = $${p}`);
            values.push(result.secure_url);
            p++;

            updates.push(`public_id = $${p}`);
            values.push(result.public_id);
            p++;

            updates.push(`file_size = $${p}`);
            values.push(result.bytes ?? null);
            p++;

            if (input.status) {
                updates.push(`status = $${p}`);
                values.push(input.status);
                p++;
            }

            if (input.e_stamp_url !== undefined) {
                updates.push(`e_stamp_url = $${p}`);
                values.push(input.e_stamp_url);
                p++;
            }

            if (input.e_stamp_public_id !== undefined) {
                updates.push(`e_stamp_public_id = $${p}`);
                values.push(input.e_stamp_public_id);
                p++;
            }

            if (input.e_stamp_status !== undefined) {
                updates.push(`e_stamp_status = $${p}`);
                values.push(input.e_stamp_status);
                p++;
            }

            if (input.approved_by !== undefined) {
                updates.push(`approved_by = $${p}`);
                values.push(input.approved_by);
                p++;
            }

            if (input.approved_by_name !== undefined) {
                updates.push(`approved_by_name = $${p}`);
                values.push(input.approved_by_name);
                p++;
            }

            if (input.returned_by !== undefined) {
                updates.push(`returned_by = $${p}`);
                values.push(input.returned_by);
                p++;
            }

            if (input.returned_by_name !== undefined) {
                updates.push(`returned_by_name = $${p}`);
                values.push(input.returned_by_name);
                p++;
            }

            if (input.rejection_reason !== undefined) {
                updates.push(`rejection_reason = $${p}`);
                values.push(input.rejection_reason);
                p++;
            }

            // ─── Signature fields ──────────────────────────────────────────────
            if (input.is_signed !== undefined) {
                updates.push(`is_signed = $${p}`);
                values.push(input.is_signed);
                p++;
            }

            if (input.signed_by !== undefined) {
                updates.push(`signed_by = $${p}`);
                values.push(input.signed_by);
                p++;
            }

            if (input.signed_by_name !== undefined) {
                updates.push(`signed_by_name = $${p}`);
                values.push(input.signed_by_name);
                p++;
            }

            if (input.signed_at !== undefined) {
                updates.push(`signed_at = $${p}`);
                values.push(input.signed_at);
                p++;
            }

            // ─── Stamp fields ──────────────────────────────────────────────
            if (input.is_stamped !== undefined) {
                updates.push(`is_stamped = $${p}`);
                values.push(input.is_stamped);
                p++;
            }

            if (input.stamped_by !== undefined) {
                updates.push(`stamped_by = $${p}`);
                values.push(input.stamped_by);
                p++;
            }

            if (input.stamped_by_name !== undefined) {
                updates.push(`stamped_by_name = $${p}`);
                values.push(input.stamped_by_name);
                p++;
            }

            if (input.stamped_at !== undefined) {
                updates.push(`stamped_at = $${p}`);
                values.push(input.stamped_at);
                p++;
            }

            if (input.stamp_type !== undefined) {
                updates.push(`stamp_type = $${p}`);
                values.push(input.stamp_type);
                p++;
            }

            if (input.stamp_position_x !== undefined) {
                updates.push(`stamp_position_x = $${p}`);
                values.push(input.stamp_position_x);
                p++;
            }

            if (input.stamp_position_y !== undefined) {
                updates.push(`stamp_position_y = $${p}`);
                values.push(input.stamp_position_y);
                p++;
            }

            if (input.stamp_position_width !== undefined) {
                updates.push(`stamp_position_width = $${p}`);
                values.push(input.stamp_position_width);
                p++;
            }

            if (input.stamp_position_height !== undefined) {
                updates.push(`stamp_position_height = $${p}`);
                values.push(input.stamp_position_height);
                p++;
            }

            // ─── NEW: Final Stamped PDF fields ──────────────────────────────────────
            if (input.stamped_file_url !== undefined) {
                updates.push(`stamped_file_url = $${p}`);
                values.push(input.stamped_file_url);
                p++;
            }

            if (input.stamped_file_public_id !== undefined) {
                updates.push(`stamped_file_public_id = $${p}`);
                values.push(input.stamped_file_public_id);
                p++;
            }

            if (input.stamped_file_size !== undefined) {
                updates.push(`stamped_file_size = $${p}`);
                values.push(input.stamped_file_size);
                p++;
            }

            updates.push(`updated_at = NOW()`);

            if (input.status === 'approved') {
                updates.push(`approved_at = NOW()`);
            }

            if (input.status === 'returned') {
                updates.push(`returned_at = NOW()`);
            }

            values.push(id);

            await client.query(
                `UPDATE helpdesk_documents
                 SET ${updates.join(', ')}
                 WHERE id = $${p} AND is_active = true`,
                values
            );

            if (input.status && input.status !== doc.status) {
                let action: 'submitted' | 'approved' | 'rejected' | 'returned';
                switch (input.status) {
                    case 'approved':
                        action = 'approved';
                        break;
                    case 'rejected':
                        action = 'rejected';
                        break;
                    case 'returned':
                        action = 'returned';
                        break;
                    default:
                        action = 'submitted';
                        break;
                }

                await this.addApprovalHistory(
                    id,
                    userId || 'system',
                    action,
                    doc.uploaded_by || undefined,
                    input.comments || `Document updated to ${input.status}`
                );
            }

            await client.query('COMMIT');

            if (doc.public_id) {
                try {
                    await deleteFromCloudinary(doc.public_id, 'raw');
                } catch (error) {
                    console.error('Failed to delete old file from Cloudinary:', error);
                }
            }

            const updatedDoc = await this.findById(id);
            if (!updatedDoc) throw new AppError(500, 'Failed to retrieve updated document');
            return updatedDoc;

        } catch (err) {
            await client.query('ROLLBACK');
            try {
                await deleteFromCloudinary(result.public_id, 'raw');
            } catch (cleanupError) {
                console.error('Failed to clean up Cloudinary upload:', cleanupError);
            }
            throw err;
        } finally {
            client.release();
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
             LEFT JOIN users su ON d.signed_by = su.id
             LEFT JOIN users stu ON d.stamped_by = stu.id
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
            LEFT JOIN users su ON d.signed_by = su.id
            LEFT JOIN users stu ON d.stamped_by = stu.id
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
        if (filters.officer_rank) {
            query += ` AND d.officer_rank = $${p}`;
            params.push(filters.officer_rank);
            p++;
        }
        if (filters.officer_name) {
            query += ` AND d.officer_name ILIKE $${p}`;
            params.push(`%${filters.officer_name}%`);
            p++;
        }
        if (filters.employment_number) {
            query += ` AND d.employment_number = $${p}`;
            params.push(filters.employment_number);
            p++;
        }
        if (filters.current_station) {
            query += ` AND d.current_station ILIKE $${p}`;
            params.push(`%${filters.current_station}%`);
            p++;
        }
        if (filters.current_unit) {
            query += ` AND d.current_unit = $${p}`;
            params.push(filters.current_unit);
            p++;
        }
        if (filters.aide_status) {
            query += ` AND d.aide_status = $${p}`;
            params.push(filters.aide_status);
            p++;
        }
        if (filters.residence_location) {
            query += ` AND d.residence_location ILIKE $${p}`;
            params.push(`%${filters.residence_location}%`);
            p++;
        }
        if (filters.sentry_status) {
            query += ` AND d.sentry_status = $${p}`;
            params.push(filters.sentry_status);
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

        // ─── Two-step approval filters ──────────────────────────────────────────
        if (filters.internal_approval_status) {
            query += ` AND d.internal_approval_status = $${p}`;
            params.push(filters.internal_approval_status);
            p++;
        }
        if (filters.requester_status) {
            query += ` AND d.requester_status = $${p}`;
            params.push(filters.requester_status);
            p++;
        }
        if (filters.is_sent_back_to_requester !== undefined) {
            query += ` AND d.is_sent_back_to_requester = $${p}`;
            params.push(filters.is_sent_back_to_requester);
            p++;
        }
        if (filters.pending_internal_approval) {
            query += ` AND d.internal_approval_status IN ('pending', 'previewed')`;
        }
        if (filters.ready_to_send_back) {
            query += ` AND d.internal_approval_status IN ('approved_internal', 'rejected_internal', 'changes_requested_internal')`;
        }
        if (filters.pending_my_approval && filters.uploaded_by) {
            query += ` AND d.status = 'pending_approval'`;
        }

        // ─── Stamp filters ──────────────────────────────────────────────────
        if (filters.is_stamped !== undefined) {
            query += ` AND d.is_stamped = $${p}`;
            params.push(filters.is_stamped);
            p++;
        }
        if (filters.stamp_type) {
            query += ` AND d.stamp_type = $${p}`;
            params.push(filters.stamp_type);
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
            LEFT JOIN users su ON d.signed_by = su.id
            LEFT JOIN users stu ON d.stamped_by = stu.id
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

        const totalQuery = `SELECT COUNT(*) as total FROM helpdesk_documents d ${whereClause}`;
        const { rows: totalRows } = await pool.query(totalQuery, params);
        const total = Number(totalRows[0]?.total) || 0;

        const statusQuery = `SELECT d.status, COUNT(*) as count FROM helpdesk_documents d ${whereClause} GROUP BY d.status`;
        const { rows: statusRows } = await pool.query(statusQuery, params);
        const statusCounts: Record<string, number> = {};
        statusRows.forEach(row => {
            statusCounts[row.status] = Number(row.count);
        });

        const entityQuery = `
            SELECT d.entity_type, COUNT(*) as count, 
                   COUNT(CASE WHEN d.status = 'pending_approval' THEN 1 END) as pending,
                   COUNT(CASE WHEN d.status = 'approved' THEN 1 END) as approved
            FROM helpdesk_documents d ${whereClause}
            GROUP BY d.entity_type
        `;
        const { rows: entityRows } = await pool.query(entityQuery, params);

        const activityQuery = `
            SELECT d.id, d.ref, d.subject, 'submitted' as action, u.full_name as user_name, d.created_at
            FROM helpdesk_documents d
            LEFT JOIN users u ON d.uploaded_by = u.id
            ${whereClause}
            ORDER BY d.created_at DESC
            LIMIT 10
        `;
        const { rows: activityRows } = await pool.query(activityQuery, params);

        const internalStatsQuery = `
            SELECT 
                COUNT(CASE WHEN d.internal_approval_status IN ('pending', 'previewed') THEN 1 END) as pending_internal,
                COUNT(CASE WHEN d.is_internal_approval_complete = true AND d.is_sent_back_to_requester = false THEN 1 END) as ready_to_send_back
            FROM helpdesk_documents d
            ${whereClause}
        `;
        const { rows: internalStatsRows } = await pool.query(internalStatsQuery, params);

        const stampStatsQuery = `
            SELECT 
                COUNT(CASE WHEN d.is_stamped = true THEN 1 END) as stamped_count,
                COUNT(CASE WHEN d.is_signed = true THEN 1 END) as signed_count,
                COUNT(CASE WHEN d.is_signed = true AND d.is_stamped = true THEN 1 END) as signed_and_stamped_count
            FROM helpdesk_documents d
            ${whereClause}
        `;
        const { rows: stampStatsRows } = await pool.query(stampStatsQuery, params);

        return {
            total,
            pending_approval: statusCounts.pending_approval || 0,
            approved: statusCounts.approved || 0,
            rejected: statusCounts.rejected || 0,
            returned: statusCounts.returned || 0,
            draft: statusCounts.draft || 0,
            by_entity: entityRows.map(row => ({
                entity_type: row.entity_type as DocumentEntityType,
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
            pending_internal: Number(internalStatsRows[0]?.pending_internal) || 0,
            ready_to_send_back: Number(internalStatsRows[0]?.ready_to_send_back) || 0,
            stamped_count: Number(stampStatsRows[0]?.stamped_count) || 0,
            signed_count: Number(stampStatsRows[0]?.signed_count) || 0,
            signed_and_stamped_count: Number(stampStatsRows[0]?.signed_and_stamped_count) || 0,
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
                COUNT(CASE WHEN d.status = 'returned' THEN 1 END) as returned,
                COUNT(CASE WHEN d.internal_approval_status = 'pending' THEN 1 END) as internal_pending,
                COUNT(CASE WHEN d.internal_approval_status = 'previewed' THEN 1 END) as internal_previewed,
                COUNT(CASE WHEN d.internal_approval_status = 'approved_internal' THEN 1 END) as internal_approved,
                COUNT(CASE WHEN d.internal_approval_status = 'rejected_internal' THEN 1 END) as internal_rejected,
                COUNT(CASE WHEN d.internal_approval_status = 'changes_requested_internal' THEN 1 END) as internal_changes_requested,
                COUNT(CASE WHEN d.internal_approval_status = 'changes_ready' THEN 1 END) as internal_changes_ready,
                COUNT(CASE WHEN d.requester_status = 'pending_approval' THEN 1 END) as requester_pending,
                COUNT(CASE WHEN d.requester_status = 'approved' THEN 1 END) as requester_approved,
                COUNT(CASE WHEN d.requester_status = 'rejected' THEN 1 END) as requester_rejected,
                COUNT(CASE WHEN d.requester_status = 'changes_requested' THEN 1 END) as requester_changes_requested,
                COUNT(CASE WHEN d.requester_status = 'in_revision' THEN 1 END) as requester_in_revision,
                COUNT(CASE WHEN d.is_signed = true THEN 1 END) as signed_count,
                COUNT(CASE WHEN d.is_stamped = true THEN 1 END) as stamped_count,
                COUNT(CASE WHEN d.is_signed = true AND d.is_stamped = true THEN 1 END) as signed_and_stamped_count
            FROM helpdesk_documents d
            ${whereClause}
        `;
        const { rows } = await pool.query(summaryQuery, params);
        const summary = rows[0];

        const statusQuery = `SELECT d.status, COUNT(*) as count FROM helpdesk_documents d ${whereClause} GROUP BY d.status`;
        const { rows: statusRows } = await pool.query(statusQuery, params);
        const byStatus: Record<DocumentStatus, number> = {
            draft: 0,
            pending_approval: 0,
            approved: 0,
            rejected: 0,
            returned: 0,
        };
        statusRows.forEach(row => {
            const status = row.status as DocumentStatus;
            if (status in byStatus) {
                byStatus[status] = Number(row.count);
            }
        });

        const entityQuery = `SELECT d.entity_type, COUNT(*) as count FROM helpdesk_documents d ${whereClause} GROUP BY d.entity_type`;
        const { rows: entityRows } = await pool.query(entityQuery, params);
        const byEntityType: Record<DocumentEntityType, number> = {} as Record<DocumentEntityType, number>;
        entityRows.forEach(row => {
            byEntityType[row.entity_type as DocumentEntityType] = Number(row.count);
        });

        const formatQuery = `SELECT d.format, COUNT(*) as count FROM helpdesk_documents d ${whereClause} GROUP BY d.format`;
        const { rows: formatRows } = await pool.query(formatQuery, params);
        const byFormat: Record<DocumentFormat, number> = {
            pdf: 0,
            docx: 0,
            xlsx: 0,
        };
        formatRows.forEach(row => {
            const format = row.format as DocumentFormat;
            if (format in byFormat) {
                byFormat[format] = Number(row.count);
            }
        });

        const requesterStatusSummary: Record<RequesterVisibleStatus, number> = {
            pending_approval: Number(summary.requester_pending) || 0,
            approved: Number(summary.requester_approved) || 0,
            rejected: Number(summary.requester_rejected) || 0,
            changes_requested: Number(summary.requester_changes_requested) || 0,
            in_revision: Number(summary.requester_in_revision) || 0,
        };

        return {
            total: Number(summary.total) || 0,
            by_status: byStatus,
            by_entity_type: byEntityType,
            by_format: byFormat,
            pending_approval: Number(summary.pending_approval) || 0,
            draft: Number(summary.draft) || 0,
            approved: Number(summary.approved) || 0,
            rejected: Number(summary.rejected) || 0,
            returned: Number(summary.returned) || 0,
            internal_approval_summary: {
                pending: Number(summary.internal_pending) || 0,
                previewed: Number(summary.internal_previewed) || 0,
                approved_internal: Number(summary.internal_approved) || 0,
                rejected_internal: Number(summary.internal_rejected) || 0,
                changes_requested_internal: Number(summary.internal_changes_requested) || 0,
                changes_ready: Number(summary.internal_changes_ready) || 0,
            },
            requester_status_summary: requesterStatusSummary,
            signed_count: Number(summary.signed_count) || 0,
            stamped_count: Number(summary.stamped_count) || 0,
            signed_and_stamped_count: Number(summary.signed_and_stamped_count) || 0,
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
                     internal_approval_status = 'pending',
                     requester_status = 'pending_approval',
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

    // ─── TWO-STEP APPROVAL METHODS ───────────────────────────────────────────

    /**
     * Internal Preview - Super admin previews the document
     * This updates internal status only, requester doesn't see this
     */
    static async internalPreview(
        id: string,
        input: InternalPreviewRequest
    ): Promise<HelpdeskDocument> {
        const doc = await this.findById(id);
        if (!doc) {
            throw new AppError(404, 'Document not found');
        }

        if (doc.status !== 'pending_approval') {
            throw new AppError(400, `Cannot preview document with status: ${doc.status}`);
        }

        if (doc.internal_approval_status !== 'pending' && doc.internal_approval_status !== 'changes_ready') {
            throw new AppError(400, `Document is not in a previewable state: ${doc.internal_approval_status}`);
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const newPreviewCount = (doc.internal_preview_count || 0) + 1;

            await client.query(
                `UPDATE helpdesk_documents
                 SET internal_approval_status = 'previewed',
                     internal_previewed_by = $1,
                     internal_previewed_by_name = $2,
                     internal_previewed_at = NOW(),
                     internal_preview_count = $3,
                     internal_comments = COALESCE($4, internal_comments),
                     updated_at = NOW()
                 WHERE id = $5 AND is_active = true`,
                [
                    input.previewed_by || null,
                    input.previewed_by_name || null,
                    newPreviewCount,
                    input.comments || null,
                    id
                ]
            );

            await this.addApprovalHistory(
                id,
                input.previewed_by || 'system',
                'previewed',
                doc.uploaded_by || undefined,
                input.comments || 'Document previewed'
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

       /**
     * Internal Approve - Super admin approves internally with signature AND STAMP embedding
     * Requester still sees 'pending_approval' until send back
     */
    static async internalApprove(
        id: string,
        input: InternalApprovalRequest
    ): Promise<HelpdeskDocument> {
        const doc = await this.findById(id);
        if (!doc) {
            throw new AppError(404, 'Document not found');
        }

        if (doc.status !== 'pending_approval') {
            throw new AppError(400, `Cannot approve document with status: ${doc.status}`);
        }

        if (!doc.entity_id) {
            throw new AppError(400, 'Document must be linked to an entity before approval');
        }

        if (!['pending', 'previewed', 'changes_ready'].includes(doc.internal_approval_status)) {
            throw new AppError(400, `Cannot approve from internal status: ${doc.internal_approval_status}`);
        }

        // ─── FETCH SIGNER'S SIGNATURE ──────────────────────────────────────────────
        const { rows: userRows } = await pool.query(
            `SELECT full_name, signature_url FROM users 
             WHERE id = $1 AND is_active = true`,
            [input.approved_by]
        );
        const signer = userRows[0];
        
        console.log('[InternalApprove] Signer details:', {
            id: input.approved_by,
            found: !!signer,
            hasSignature: signer?.signature_url ? true : false,
            signatureUrl: signer?.signature_url || 'null',
        });
        
        if (!signer) {
            throw new AppError(404, 'User not found');
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            let finalFileUrl = doc.file_url;
            let finalPublicId = doc.public_id;
            let finalFileSize: number | null = null;
            let wasSigned = false; // Tracks if the file was modified (stamp or signature)
            let eStampRecordId: string | null = null;

            // ─── BRANCH: E-STAMP OR SIGNATURE BLOCK ────────────────────────────────────
            if (input.generate_e_stamp) {
                // ─── APPROVE & STAMP ──────────────────────────────────────────────────
                try {
                    console.log(`[InternalApprove] Generating E-Stamp for document ${id}...`);

                    // Call the updated EStampService (which returns a PDF buffer)
                    const { stampedPdfBuffer, eStampRecord } = await EStampService.generateEStamp(
                        {
                            document_id: id,
                            stamp_type: input.stamp_type || 'approved',
                            original_pdf_url: doc.file_url,      // The raw memo URL
                            signature_url: signer.signature_url, // The real signature
                            metadata: {
                                department_name: 'Office of the Registrar',
                                station_name: 'High Court',
                            },
                        },
                        input.approved_by || 'system'
                    );

                    eStampRecordId = eStampRecord.id;

                    // Upload the final merged PDF to Cloudinary
                    const multerFile: Express.Multer.File = {
                        buffer: stampedPdfBuffer,
                        mimetype: 'application/pdf',
                        originalname: doc.file_url.split('/').pop() || 'stamped-document.pdf',
                        size: stampedPdfBuffer.length,
                        fieldname: 'file',
                        encoding: '7bit',
                        stream: null as any,
                        destination: '',
                        filename: '',
                        path: '',
                    };
                    const uploaded = await uploadToCloudinary(multerFile, FOLDER);

                    finalFileUrl = uploaded.secure_url;
                    finalPublicId = uploaded.public_id;
                    finalFileSize = uploaded.bytes || uploaded.size || stampedPdfBuffer.length;
                    wasSigned = true;

                    console.log(`[InternalApprove] Successfully generated & uploaded stamped PDF for ${id}`);

                } catch (stampError) {
                    console.error(`[InternalApprove] Failed to generate e-stamp for ${id}:`, stampError);
                    let errorMessage = 'Unknown error during e-stamp generation';
                    if (stampError instanceof Error) {
                        errorMessage = stampError.message;
                    } else if (typeof stampError === 'string') {
                        errorMessage = stampError;
                    }
                    throw new AppError(500, `Failed to generate e-stamp: ${errorMessage}`);
                }
            } else {
                // ─── APPROVE & SIGN (No stamp, just a clean signature block) ──────────
                try {
                    console.log(`[InternalApprove] Generating Signature Block for document ${id}...`);

                    // Call the new signature block utility
                    const signedPdfBuffer = await embedSignatureBlockIntoPDF(
                        doc.file_url,
                        signer.signature_url!,
                        signer.full_name || 'Registrar, High Court',
                        'Registrar, High Court',
                        
                    );

                    // Upload the signed PDF to Cloudinary
                    const multerFile: Express.Multer.File = {
                        buffer: signedPdfBuffer,
                        mimetype: 'application/pdf',
                        originalname: doc.file_url.split('/').pop() || 'signed-document.pdf',
                        size: signedPdfBuffer.length,
                        fieldname: 'file',
                        encoding: '7bit',
                        stream: null as any,
                        destination: '',
                        filename: '',
                        path: '',
                    };
                    const uploaded = await uploadToCloudinary(multerFile, FOLDER);

                    finalFileUrl = uploaded.secure_url;
                    finalPublicId = uploaded.public_id;
                    finalFileSize = uploaded.bytes || uploaded.size || signedPdfBuffer.length;
                    wasSigned = true; // Document is now signed

                    console.log(`[InternalApprove] Successfully generated & uploaded signed PDF for ${id}`);

                } catch (signError) {
                    console.error(`[InternalApprove] Failed to generate signature block for ${id}:`, signError);
                    let errorMessage = 'Unknown error during signature block generation';
                    if (signError instanceof Error) {
                        errorMessage = signError.message;
                    } else if (typeof signError === 'string') {
                        errorMessage = signError;
                    }
                    throw new AppError(500, `Failed to generate signature block: ${errorMessage}`);
                }
            }

            // ─── UPDATE THE DOCUMENT IN THE DATABASE ──────────────────────────────────
            // Note: We always update the document regardless of which path was taken.
            const updateQuery = `
                UPDATE helpdesk_documents
                SET internal_approval_status = 'approved_internal',
                    internal_approved_by = $1::uuid,
                    internal_approved_by_name = $2::varchar,
                    internal_approved_at = NOW(),
                    internal_comments = COALESCE($3::text, internal_comments),
                    is_internal_approval_complete = true,
                    e_stamp_url = $4::text,
                    e_stamp_public_id = $5::varchar,
                    e_stamp_status = CASE WHEN $4::text IS NOT NULL THEN 'stamped' ELSE e_stamp_status END,
                    is_signed = $6::boolean,
                    signed_by = CASE WHEN $6::boolean THEN $1::uuid ELSE signed_by END,
                    signed_by_name = CASE WHEN $6::boolean THEN $2::varchar ELSE signed_by_name END,
                    signed_at = CASE WHEN $6::boolean THEN NOW() ELSE signed_at END,
                    file_url = $7::text,
                    public_id = $8::varchar,
                    is_stamped = $9::boolean,
                    stamped_by = CASE WHEN $9::boolean THEN $1::uuid ELSE stamped_by END,
                    stamped_by_name = CASE WHEN $9::boolean THEN $2::varchar ELSE stamped_by_name END,
                    stamped_at = CASE WHEN $9::boolean THEN NOW() ELSE stamped_at END,
                    stamp_type = $10::varchar,
                    stamp_position_x = $11::float,
                    stamp_position_y = $12::float,
                    stamp_position_width = $13::float,
                    stamp_position_height = $14::float,
                    stamped_file_url = CASE WHEN $6::boolean THEN $7::text ELSE stamped_file_url END,
                    stamped_file_public_id = CASE WHEN $6::boolean THEN $8::varchar ELSE stamped_file_public_id END,
                    stamped_file_size = CASE WHEN $6::boolean THEN $15::int ELSE stamped_file_size END,
                    updated_at = NOW()
                WHERE id = $16::uuid AND is_active = true
            `;

            await client.query(updateQuery, [
                input.approved_by || null,
                input.approved_by_name || null,
                input.comments || null,
                doc.e_stamp_url, // Keep existing or null
                doc.e_stamp_public_id, // Keep existing or null
                wasSigned,
                finalFileUrl,
                finalPublicId,
                wasSigned && input.generate_e_stamp, // is_stamped only true if we went the stamp path
                input.stamp_type || 'approved',
                input.stamp_position_x || null,
                input.stamp_position_y || null,
                input.stamp_position_width || null,
                input.stamp_position_height || null,
                finalFileSize,
                id
            ]);

            // Delete old file if it was replaced
            if (doc.public_id && doc.public_id !== finalPublicId && finalFileUrl !== doc.file_url) {
                try {
                    await deleteFromCloudinary(doc.public_id, 'raw');
                    console.log(`[InternalApprove] Deleted old file ${doc.public_id}`);
                } catch (error) {
                    console.error('Failed to delete old file from Cloudinary:', error);
                }
            }

            await this.addApprovalHistory(
                id,
                input.approved_by || 'system',
                'approved',
                doc.uploaded_by || undefined,
                input.comments || `Document approved internally${wasSigned ? (input.generate_e_stamp ? ', stamped, and signed' : ', signed') : ''} (pending send back)`
            );

            await client.query('COMMIT');

            const updatedDoc = await this.findById(id);
            if (!updatedDoc) throw new AppError(500, 'Failed to retrieve updated document');
            return updatedDoc;

        } catch (err) {
            await client.query('ROLLBACK');
            console.error('[InternalApprove] Error:', err);
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Internal Reject - Super admin rejects internally
     * Requester still sees 'pending_approval' until send back
     */
    static async internalReject(
        id: string,
        input: InternalApprovalRequest
    ): Promise<HelpdeskDocument> {
        const doc = await this.findById(id);
        if (!doc) {
            throw new AppError(404, 'Document not found');
        }

        if (doc.status !== 'pending_approval') {
            throw new AppError(400, `Cannot reject document with status: ${doc.status}`);
        }

        if (!['pending', 'previewed', 'changes_ready'].includes(doc.internal_approval_status)) {
            throw new AppError(400, `Cannot reject from internal status: ${doc.internal_approval_status}`);
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            await client.query(
                `UPDATE helpdesk_documents
                 SET internal_approval_status = 'rejected_internal',
                     internal_rejection_reason = $1,
                     internal_comments = COALESCE($2, internal_comments),
                     is_internal_approval_complete = true,
                     updated_at = NOW()
                 WHERE id = $3 AND is_active = true`,
                [
                    input.rejection_reason || 'No reason provided',
                    input.comments || null,
                    id
                ]
            );

            await this.addApprovalHistory(
                id,
                input.approved_by || 'system',
                'rejected',
                doc.uploaded_by || undefined,
                `Rejected internally: ${input.rejection_reason}`
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

    /**
     * Internal Request Changes - Super admin requests changes internally
     * Requester still sees 'pending_approval' until send back
     */
    static async internalRequestChanges(
        id: string,
        input: InternalApprovalRequest
    ): Promise<HelpdeskDocument> {
        const doc = await this.findById(id);
        if (!doc) {
            throw new AppError(404, 'Document not found');
        }

        if (doc.status !== 'pending_approval') {
            throw new AppError(400, `Cannot request changes for document with status: ${doc.status}`);
        }

        if (!['pending', 'previewed', 'changes_ready'].includes(doc.internal_approval_status)) {
            throw new AppError(400, `Cannot request changes from internal status: ${doc.internal_approval_status}`);
        }

        if (!input.changes_requested || input.changes_requested.length === 0) {
            throw new AppError(400, 'At least one change request is required');
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            await client.query(
                `UPDATE helpdesk_documents
                 SET internal_approval_status = 'changes_requested_internal',
                     internal_changes_requested = $1,
                     internal_comments = COALESCE($2, internal_comments),
                     is_internal_approval_complete = true,
                     updated_at = NOW()
                 WHERE id = $3 AND is_active = true`,
                [
                    input.changes_requested,
                    input.comments || null,
                    id
                ]
            );

            await this.addApprovalHistory(
                id,
                input.approved_by || 'system',
                'returned',
                doc.uploaded_by || undefined,
                `Changes requested internally: ${input.changes_requested.join(', ')}`
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

    /**
     * Cancel Internal Approval - Reset internal approval decision
     */
    static async cancelInternalApproval(
        id: string,
        input: CancelInternalApprovalRequest
    ): Promise<HelpdeskDocument> {
        const doc = await this.findById(id);
        if (!doc) {
            throw new AppError(404, 'Document not found');
        }

        if (doc.status !== 'pending_approval') {
            throw new AppError(400, `Cannot cancel internal approval for document with status: ${doc.status}`);
        }

        if (doc.internal_approval_status === 'pending') {
            throw new AppError(400, 'Document is already pending review');
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            await client.query(
                `UPDATE helpdesk_documents
                 SET internal_approval_status = 'pending',
                     internal_approved_by = NULL,
                     internal_approved_by_name = NULL,
                     internal_approved_at = NULL,
                     internal_rejection_reason = NULL,
                     internal_changes_requested = NULL,
                     is_internal_approval_complete = false,
                     updated_at = NOW()
                 WHERE id = $1 AND is_active = true`,
                [id]
            );

            await this.addApprovalHistory(
                id,
                input.cancelled_by || 'system',
                'submitted',
                doc.uploaded_by || undefined,
                input.reason || 'Internal approval decision cancelled'
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

  /**
 * Send Back to Requester - This is when the requester finally sees the status
 */
static async sendBackToRequester(
    id: string,
    input: SendBackToRequesterRequest
): Promise<HelpdeskDocument> {
    const doc = await this.findById(id);
    if (!doc) {
        throw new AppError(404, 'Document not found');
    }

    if (!doc.is_internal_approval_complete) {
        throw new AppError(400, 'Internal approval decision must be made before sending back');
    }

    const internalToRequesterMap: Record<string, RequesterVisibleStatus> = {
        'approved_internal': 'approved',
        'rejected_internal': 'rejected',
        'changes_requested_internal': 'changes_requested',
    };

    const requesterStatus = internalToRequesterMap[doc.internal_approval_status];
    if (!requesterStatus) {
        throw new AppError(400, `Cannot send back from internal status: ${doc.internal_approval_status}`);
    }

    const finalStatus = input.final_status || requesterStatus;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        let newStatus: DocumentStatus;
        switch (finalStatus) {
            case 'approved':
                newStatus = 'approved';
                break;
            case 'rejected':
                newStatus = 'rejected';
                break;
            case 'changes_requested':
                newStatus = 'returned';
                break;
            default:
                newStatus = 'pending_approval';
        }

        await client.query(
            `UPDATE helpdesk_documents
             SET requester_status = $1,
                 status = $2,
                 requester_visible_at = NOW(),
                 requester_visible_by = $3,
                 requester_visible_by_name = $4,
                 is_sent_back_to_requester = true,
                 is_requester_notified = $5,
                 updated_at = NOW()
             WHERE id = $6 AND is_active = true`,
            [
                finalStatus,
                newStatus,
                input.sent_by || null,
                input.sent_by_name || null,
                input.notify_requester || false,
                id
            ]
        );

        await this.addApprovalHistory(
            id,
            input.sent_by || 'system',
            'sent_back',
            doc.uploaded_by || undefined,
            `Document sent back to requester with status: ${finalStatus}`
        );

        await client.query('COMMIT');

        const updatedDoc = await this.findById(id);
        if (!updatedDoc) throw new AppError(500, 'Failed to retrieve updated document');

        // ─── 🚀 SEND EMAIL NOTIFICATION AFTER COMMIT ──────────────────────
        // Send after successful commit so we know the document is updated
        if (input.notify_requester !== false && doc.uploaded_by) {
            await this.sendApprovalNotification(updatedDoc, doc.uploaded_by, finalStatus);
        }

        return updatedDoc;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

// ─── NEW: Send approval notification email ──────────────────────────────────

private static async sendApprovalNotification(
    doc: HelpdeskDocument,
    requesterId: string,
    status: 'approved' | 'rejected' | 'changes_requested'
): Promise<void> {
    try {
        // Get requester's details
        const { rows } = await pool.query(
            `SELECT full_name, email FROM users WHERE id = $1 AND is_active = true`,
            [requesterId]
        );

        if (rows.length === 0) {
            console.warn(`[sendApprovalNotification] Requester ${requesterId} not found`);
            return;
        }

        const requester = rows[0];

        // Send based on status
        switch (status) {
            case 'approved':
                await sendHelpdeskApproved({
                    to: requester.email,
                    requesterName: requester.full_name,
                    ref: doc.ref,
                    subject: doc.subject,
                    entityType: doc.entity_type,
                    approvedBy: doc.internal_approved_by_name || 'Super Admin',
                    approvedAt: new Date(doc.internal_approved_at || doc.updated_at),
                    comments: doc.internal_comments || undefined,
                    documentUrl: doc.stamped_file_url || doc.file_url,
                });
                console.log(`[sendApprovalNotification] ✅ Approved email sent to ${requester.email} for ${doc.ref}`);
                break;

            case 'rejected':
                await sendHelpdeskRejected({
                    to: requester.email,
                    requesterName: requester.full_name,
                    ref: doc.ref,
                    subject: doc.subject,
                    entityType: doc.entity_type,
                    rejectedBy: doc.internal_approved_by_name || 'Super Admin',
                    rejectedAt: new Date(doc.internal_approved_at || doc.updated_at),
                    reason: doc.internal_rejection_reason || 'No specific reason provided',
                    comments: doc.internal_comments || undefined,
                });
                console.log(`[sendApprovalNotification] ❌ Rejected email sent to ${requester.email} for ${doc.ref}`);
                break;

            case 'changes_requested':
                await sendHelpdeskChangesRequested({
                    to: requester.email,
                    requesterName: requester.full_name,
                    ref: doc.ref,
                    subject: doc.subject,
                    entityType: doc.entity_type,
                    requestedBy: doc.internal_approved_by_name || 'Super Admin',
                    requestedAt: new Date(doc.internal_approved_at || doc.updated_at),
                    changes: doc.internal_changes_requested || ['Please review the comments for required changes.'],
                    comments: doc.internal_comments || undefined,
                });
                console.log(`[sendApprovalNotification] 🔄 Changes requested email sent to ${requester.email} for ${doc.ref}`);
                break;
        }

    } catch (error) {
        // Don't block the main flow if email fails - just log the error
        console.error('[sendApprovalNotification] ❌ Failed to send email:', error);
    }
}
    /**
     * Resubmit After Changes - Requester resubmits after making changes
     */
    static async resubmitAfterChanges(
        id: string,
        input: ResubmitAfterChangesRequest
    ): Promise<HelpdeskDocument> {
        const doc = await this.findById(id);
        if (!doc) {
            throw new AppError(404, 'Document not found');
        }

        if (!['changes_requested', 'rejected'].includes(doc.requester_status)) {
            throw new AppError(400, `Cannot resubmit document with requester status: ${doc.requester_status}`);
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const newResubmitCount = (doc.resubmit_count || 0) + 1;

            await client.query(
                `UPDATE helpdesk_documents
                 SET status = 'pending_approval',
                     requester_status = 'pending_approval',
                     internal_approval_status = 'changes_ready',
                     resubmit_count = $1,
                     last_resubmitted_at = NOW(),
                     last_resubmitted_by = $2,
                     is_internal_approval_complete = false,
                     is_sent_back_to_requester = false,
                     updated_at = NOW()
                 WHERE id = $3 AND is_active = true`,
                [
                    newResubmitCount,
                    input.submitted_by || null,
                    id
                ]
            );

            await this.addApprovalHistory(
                id,
                input.submitted_by || 'system',
                'resubmitted',
                undefined,
                input.comments || `Resubmitted after changes (attempt ${newResubmitCount})`
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

    // ─── Pending Internal Approvals (Super Admin Dashboard) ──────────────────

    static async getPendingInternalApprovals(
        filters: HelpdeskDocumentFilters = {}
    ): Promise<HelpdeskDocument[]> {
        const pendingFilters: HelpdeskDocumentFilters = {
            ...filters,
            pending_internal_approval: true,
            status: 'pending_approval',
        };
        
        return this.findAll(pendingFilters);
    }

    static async getPendingInternalApprovalsSummary(
        filters?: { entity_type?: DocumentEntityType }
    ): Promise<PendingInternalApprovalsSummary> {
        const params: unknown[] = [];
        let whereClause = 'WHERE d.is_active = true AND d.status = \'pending_approval\'';
        let p = 1;

        if (filters?.entity_type) {
            whereClause += ` AND d.entity_type = $${p}`;
            params.push(filters.entity_type);
            p++;
        }

        const query = `
            SELECT 
                COUNT(*) as total_pending,
                COUNT(CASE WHEN d.internal_approval_status = 'pending' THEN 1 END) as pending_review,
                COUNT(CASE WHEN d.internal_approval_status = 'previewed' THEN 1 END) as previewed,
                COUNT(CASE WHEN d.internal_approval_status = 'approved_internal' THEN 1 END) as approved_internal,
                COUNT(CASE WHEN d.internal_approval_status = 'rejected_internal' THEN 1 END) as rejected_internal,
                COUNT(CASE WHEN d.internal_approval_status = 'changes_requested_internal' THEN 1 END) as changes_requested_internal,
                COUNT(CASE WHEN d.is_internal_approval_complete = true THEN 1 END) as ready_to_send_back,
                MIN(d.created_at) as oldest_pending,
                AVG(EXTRACT(EPOCH FROM (NOW() - d.created_at)) / 3600) as avg_review_hours
            FROM helpdesk_documents d
            ${whereClause}
        `;

        const { rows } = await pool.query(query, params);
        const result = rows[0];

        const entityQuery = `
            SELECT d.entity_type, COUNT(*) as count
            FROM helpdesk_documents d
            ${whereClause}
            GROUP BY d.entity_type
        `;
        const { rows: entityRows } = await pool.query(entityQuery, params);
        const byEntityType: Record<DocumentEntityType, number> = {} as Record<DocumentEntityType, number>;
        entityRows.forEach(row => {
            byEntityType[row.entity_type as DocumentEntityType] = Number(row.count);
        });

        let oldestPendingDays = 0;
        if (result.oldest_pending) {
            oldestPendingDays = Math.floor((Date.now() - new Date(result.oldest_pending).getTime()) / (1000 * 60 * 60 * 24));
        }

        const urgentQuery = `
            SELECT COUNT(*) as urgent
            FROM helpdesk_documents d
            ${whereClause}
            AND d.created_at < NOW() - INTERVAL '2 days'
        `;
        const { rows: urgentRows } = await pool.query(urgentQuery, params);

        return {
            total_pending_internal: Number(result.total_pending) || 0,
            pending_review: Number(result.pending_review) || 0,
            previewed: Number(result.previewed) || 0,
            approved_internal: Number(result.approved_internal) || 0,
            rejected_internal: Number(result.rejected_internal) || 0,
            changes_requested_internal: Number(result.changes_requested_internal) || 0,
            ready_to_send_back: Number(result.ready_to_send_back) || 0,
            by_entity_type: byEntityType,
            urgent_pending: Number(urgentRows[0]?.urgent) || 0,
            oldest_pending_days: oldestPendingDays,
            average_review_time_hours: result.avg_review_hours ? Number(result.avg_review_hours) : undefined,
        };
    }

    // ─── Requester Dashboard ──────────────────────────────────────────────────

    static async getRequesterDocuments(
        userId: string,
        filters: HelpdeskDocumentFilters = {}
    ): Promise<RequesterDocumentView[]> {
        const docFilters: HelpdeskDocumentFilters = {
            ...filters,
            uploaded_by: userId,
            is_sent_back_to_requester: true,
        };

        const docs = await this.findAll(docFilters);

        return docs.map(doc => ({
            document_id: doc.id,
            ref: doc.ref,
            subject: doc.subject,
            status: doc.requester_status,
            submitted_at: doc.created_at,
            last_updated_at: doc.updated_at,
            comments: doc.internal_comments,
            entity_type: doc.entity_type,
            entity_id: doc.entity_id || undefined,
            approved_rejected_at: doc.internal_approved_at,
            approved_rejected_by: doc.internal_approved_by_name,
            changes_requested: doc.internal_changes_requested,
            rejection_reason: doc.internal_rejection_reason,
            can_resubmit: ['changes_requested', 'rejected'].includes(doc.requester_status),
            is_signed: doc.is_signed || false,
            signed_by_name: doc.signed_by_name,
            signed_at: doc.signed_at,
            is_stamped: doc.is_stamped || false,
            stamped_by_name: doc.stamped_by_name,
            stamped_at: doc.stamped_at,
            stamp_type: doc.stamp_type as StampType | undefined,
            // ─── NEW: Pass the final file URL to the requester view ─────────────
            stamped_file_url: doc.stamped_file_url || null,
        }));
    }

    // ─── Link to Entity ──────────────────────────────────────────────────────

    static async linkToEntity(
        id: string,
        entityType: DocumentEntityType,
        entityId: string,
        requestType?: string,
        judgeName?: string,
        rank?: string,
        reportingDate?: string,
        officerRank?: string,
        officerName?: string,
        employmentNumber?: string,
        currentStation?: string,
        currentUnit?: string,
        proposedAssignment?: string,
        aideStatus?: string,
        residenceLocation?: string,
        sentryStatus?: string
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

        if (officerRank !== undefined) {
            updates.push(`officer_rank = $${p}`);
            values.push(officerRank || null);
            p++;
        }

        if (officerName !== undefined) {
            updates.push(`officer_name = $${p}`);
            values.push(officerName || null);
            p++;
        }

        if (employmentNumber !== undefined) {
            updates.push(`employment_number = $${p}`);
            values.push(employmentNumber || null);
            p++;
        }

        if (currentStation !== undefined) {
            updates.push(`current_station = $${p}`);
            values.push(currentStation || null);
            p++;
        }

        if (currentUnit !== undefined) {
            updates.push(`current_unit = $${p}`);
            values.push(currentUnit || null);
            p++;
        }

        if (proposedAssignment !== undefined) {
            updates.push(`proposed_assignment = $${p}`);
            values.push(proposedAssignment || null);
            p++;
        }

        if (aideStatus !== undefined) {
            updates.push(`aide_status = $${p}`);
            values.push(aideStatus || null);
            p++;
        }

        if (residenceLocation !== undefined) {
            updates.push(`residence_location = $${p}`);
            values.push(residenceLocation || null);
            p++;
        }

        if (sentryStatus !== undefined) {
            updates.push(`sentry_status = $${p}`);
            values.push(sentryStatus || null);
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
        entityType: DocumentEntityType,
        entityId: string,
        requestType?: string,
        judgeName?: string,
        rank?: string,
        reportingDate?: string,
        officerRank?: string,
        officerName?: string,
        employmentNumber?: string,
        currentStation?: string,
        currentUnit?: string,
        proposedAssignment?: string,
        aideStatus?: string,
        residenceLocation?: string,
        sentryStatus?: string
    ): Promise<{ success: string[]; failed: string[] }> {
        const success: string[] = [];
        const failed: string[] = [];

        for (const id of documentIds) {
            try {
                await this.linkToEntity(
                    id, 
                    entityType, 
                    entityId, 
                    requestType, 
                    judgeName, 
                    rank, 
                    reportingDate,
                    officerRank,
                    officerName,
                    employmentNumber,
                    currentStation,
                    currentUnit,
                    proposedAssignment,
                    aideStatus,
                    residenceLocation,
                    sentryStatus
                );
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
        status: DocumentStatus,
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

                    const validTransitions: Record<DocumentStatus, DocumentStatus[]> = {
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

                    let action: 'approved' | 'rejected' | 'returned' | 'submitted';
                    switch (status) {
                        case 'approved':
                            action = 'approved';
                            break;
                        case 'rejected':
                            action = 'rejected';
                            break;
                        case 'returned':
                            action = 'returned';
                            break;
                        default:
                            action = 'submitted';
                            break;
                    }

                    await this.addApprovalHistory(
                        id,
                        'system',
                        action,
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
        action: 'submitted' | 'approved' | 'rejected' | 'returned' | 'previewed' | 'sent_back' | 'resubmitted' | 'signed' | 'stamped',
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

    /**
     * Soft delete a document - sets is_active to false
     * Permission checks should be handled by the controller
     */
    static async delete(id: string): Promise<void> {
        const doc = await this.findById(id);
        if (!doc) {
            throw new AppError(404, 'Document not found');
        }

        if (!doc.is_active) {
            throw new AppError(400, 'Document is already deleted');
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Soft delete - set is_active to false
            const { rowCount } = await client.query(
                `UPDATE helpdesk_documents 
                 SET is_active = false, 
                     deleted_at = NOW(),
                     updated_at = NOW()
                 WHERE id = $1 AND is_active = true`,
                [id]
            );

            if (rowCount === 0) {
                throw new AppError(404, 'Document not found or already deleted');
            }

            // Soft delete comments
            await client.query(
                `UPDATE helpdesk_document_comments
                 SET is_active = false
                 WHERE document_id = $1`,
                [id]
            );

            await client.query('COMMIT');

            // Delete the original file from Cloudinary
            if (doc.public_id) {
                try {
                    await deleteFromCloudinary(doc.public_id, 'raw');
                    console.log(`[Delete] Deleted file ${doc.public_id} from Cloudinary`);
                } catch (error) {
                    console.error('Failed to delete file from Cloudinary:', error);
                }
            }

            // Delete e-stamp from Cloudinary if exists
            if (doc.e_stamp_public_id) {
                try {
                    await deleteFromCloudinary(doc.e_stamp_public_id, 'raw');
                    console.log(`[Delete] Deleted e-stamp ${doc.e_stamp_public_id} from Cloudinary`);
                } catch (error) {
                    console.error('Failed to delete e-stamp from Cloudinary:', error);
                }
            }
            
            // ─── NEW: Delete the final generated stamped file ──────────────────────
            if (doc.stamped_file_public_id) {
                try {
                    await deleteFromCloudinary(doc.stamped_file_public_id, 'raw');
                    console.log(`[Delete] Deleted final stamped file ${doc.stamped_file_public_id} from Cloudinary`);
                } catch (error) {
                    console.error('Failed to delete stamped file from Cloudinary:', error);
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

            // Delete the original file from Cloudinary
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

            // ─── NEW: Delete the final generated stamped file ──────────────────────
            if (doc.stamped_file_public_id) {
                try {
                    await deleteFromCloudinary(doc.stamped_file_public_id, 'raw');
                } catch (error) {
                    console.error('Failed to delete stamped file from Cloudinary:', error);
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