// src/features/e-stamp/e-stamp.service.ts

import { pool } from '../../config/db';
import { AppError } from '../../utils/response';
import { deleteFromCloudinary } from '../../config/cloudinary';
import crypto from 'crypto';
import type {
    EStamp,
    GenerateEStampInput,
    EStampVerificationResult,
    EStampType,
} from './e-stamp.types';
import { E_STAMP_TYPE_LABELS } from './e-stamp.types';
import { generateStampOnPdf } from '../../utils/stampGenerator';
import axios from "axios";

// ─── Constants ──────────────────────────────────────────────────────────────

// (E_STAMP_FOLDER is no longer needed since we are not uploading standalone stamps)

// ─── E-Stamp Service ─────────────────────────────────────────────────────────

export class EStampService {

    // ── Generate E-Stamp ─────────────────────────────────────────────────────

    static async generateEStamp(
        input: GenerateEStampInput,
        userId: string
    ): Promise<{
        stampedPdfBuffer: Buffer;
        verificationCode: string;
        verificationHash: string;
        eStampRecord: EStamp;
    }> {
        // 1. Check if the helpdesk_document exists
        const docResult = await pool.query(
            `SELECT d.id, d.subject as title, d.ref as reference_no, d.entity_type as type, d.status,
                    u.full_name as stamped_by_name,
                    u.signature_url
             FROM helpdesk_documents d
             LEFT JOIN users u ON u.id = $1
             WHERE d.id = $2 AND d.is_active = true`,
            [userId, input.document_id]
        );

        if (docResult.rows.length === 0) {
            throw new AppError(404, 'Document not found');
        }

        const doc = docResult.rows[0];

        // 2. Check if document already has this type of e-stamp
        const existingStamp = await pool.query(
            `SELECT id FROM document_e_stamps 
             WHERE document_id = $1 AND stamp_type = $2 AND is_active = true`,
            [input.document_id, input.stamp_type]
        );

        if (existingStamp.rows.length > 0) {
            throw new AppError(409, `Document already has an active ${E_STAMP_TYPE_LABELS[input.stamp_type]} e-stamp`);
        }

        // 3. Generate unique verification code & hash
        const verificationCode = this.generateVerificationCode(doc.id, input.stamp_type);
        const verificationHash = crypto.createHash('sha256').update(verificationCode).digest('hex');

        // 4. Fetch the raw PDF and the signature image from Cloudinary
        let pdfBuffer: Buffer;
        let signatureBuffer: Buffer | null = null;

        try {
            // Fetch PDF
            const pdfRes = await axios.get<ArrayBuffer>(input.original_pdf_url, { 
                responseType: 'arraybuffer' 
            });
            pdfBuffer = Buffer.from(pdfRes.data);

            // Fetch Signature (if provided)
            if (input.signature_url) {
                try {
                    const sigRes = await axios.get<ArrayBuffer>(input.signature_url, { 
                        responseType: 'arraybuffer' 
                    });
                    signatureBuffer = Buffer.from(sigRes.data);
                } catch (sigError) {
                    console.warn('[EStampService] Failed to fetch signature, using fallback squiggle:', sigError);
                }
            }
        } catch (fetchError) {
            console.error('[EStampService] Failed to fetch assets:', fetchError);
            throw new AppError(500, 'Failed to fetch required assets for stamp generation');
        }

        // 5. Generate the stamped PDF using pdf-lib
        const stampedPdfBuffer = await generateStampOnPdf({
            pdfBuffer,
            date: new Date(),
            label: 'APPROVED',
            issuer: 'REGISTRAR HIGH COURT',
            signatureBuffer: signatureBuffer,
            approverName: input.metadata?.department_name || 'REGISTRAR',
            verticalAnchorFraction: 0.16,
            angle: -16,
        });

        // 6. Save stamp metadata to database
        // 🔴 FIX: Added original_pdf_url to the column list and values list
        const { rows } = await pool.query(
            `INSERT INTO document_e_stamps
                (document_id, stamp_type, stamped_by, stamp_image_url, stamp_public_id,
                 original_pdf_url, stamp_data, metadata, verification_code, verification_hash)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             RETURNING *`,
            [
                input.document_id,
                input.stamp_type,
                userId,
                input.original_pdf_url, // Saved here as a reference
                'stamp-placeholder',     // No standalone PNG public ID
                input.original_pdf_url,  // 🔴 Added explicit column for original_pdf_url
                JSON.stringify({
                    reference_no: doc.reference_no,
                    document_title: doc.title,
                    stamped_at: new Date().toISOString(),
                    stamped_by: userId,
                    stamp_type: input.stamp_type,
                    signature_url: input.signature_url || null,
                    department_name: input.metadata?.department_name || null,
                    station_name: input.metadata?.station_name || null,
                    document_type: doc.type,
                    verification_code: verificationCode,
                }),
                JSON.stringify({
                    ip_address: input.metadata?.ip_address || null,
                    user_agent: input.metadata?.user_agent || null,
                    timestamp: new Date().toISOString(),
                    department_id: input.metadata?.department_id || null,
                    station_name: input.metadata?.station_name || null,
                    department_name: input.metadata?.department_name || null,
                }),
                verificationCode,
                verificationHash,
            ]
        );

        const eStampRecord = rows[0];

        // 7. Update helpdesk_documents e_stamp_status (just for tracking)
        await pool.query(
            `UPDATE helpdesk_documents 
             SET e_stamp_status = 'stamped',
                 updated_at = NOW()
             WHERE id = $1`,
            [input.document_id]
        );

        console.log(`[EStampService] E-Stamp metadata saved successfully for ${input.document_id}`);

        // 8. Return the buffer and metadata to the caller (Helpdesk service)
        return {
            stampedPdfBuffer,   // <--- The final PDF with the stamp and signature embedded
            verificationCode,
            verificationHash,
            eStampRecord,
        };
    }

    // ── Verify E-Stamp ──────────────────────────────────────────────────────

    static async verifyEStamp(
        verificationCode: string
    ): Promise<EStampVerificationResult> {
        const { rows } = await pool.query(
            `SELECT es.*, u.full_name as stamped_by_name
             FROM document_e_stamps es
             LEFT JOIN users u ON u.id = es.stamped_by
             WHERE es.verification_code = $1 AND es.is_active = true
             ORDER BY es.created_at DESC LIMIT 1`,
            [verificationCode]
        );

        if (rows.length === 0) {
            return {
                valid: false,
                message: 'Invalid verification code or stamp not found'
            };
        }

        const stamp = rows[0];

        // Check if stamp is still valid (e.g., not expired)
        const createdAt = new Date(stamp.created_at);
        const now = new Date();
        const daysSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

        // Optional: Set expiration (e.g., 365 days)
        if (daysSinceCreation > 365) {
            return {
                valid: false,
                message: 'E-Stamp has expired'
            };
        }

        return {
            valid: true,
            data: {
                ...stamp,
                stamp_data: typeof stamp.stamp_data === 'string'
                    ? JSON.parse(stamp.stamp_data)
                    : stamp.stamp_data,
                metadata: typeof stamp.metadata === 'string'
                    ? JSON.parse(stamp.metadata)
                    : stamp.metadata,
            },
        };
    }

    // ── Revoke E-Stamp ──────────────────────────────────────────────────────

    static async revokeEStamp(
        id: string,
        userId: string,
        reason: string
    ): Promise<void> {
        const result = await pool.query(
            `UPDATE document_e_stamps 
             SET is_active = false, 
                 revoked_at = NOW(), 
                 revoked_by = $1, 
                 revocation_reason = $2
             WHERE id = $3 AND is_active = true
             RETURNING document_id`,
            [userId, reason, id]
        );

        if (result.rows.length === 0) {
            throw new AppError(404, 'No active e-stamp found');
        }

        // Check if document has any other active stamps
        const otherStamps = await pool.query(
            `SELECT id FROM document_e_stamps 
             WHERE document_id = $1 AND is_active = true`,
            [result.rows[0].document_id]
        );

        // Update document e_stamp_status if no other stamps exist
        // 🔴 FIX: Changed 'documents' to 'helpdesk_documents'
        if (otherStamps.rows.length === 0) {
            await pool.query(
                `UPDATE helpdesk_documents 
                 SET e_stamp_status = 'failed',
                     updated_at = NOW()
                 WHERE id = $1`,
                [result.rows[0].document_id]
            );
        }

        // We no longer delete a standalone PNG from Cloudinary because the stamp is embedded in the PDF.
        // If we ever need to clean up the original PDF, that is handled by the Helpdesk service.
    }

    // ── Get E-Stamp by Document ──────────────────────────────────────────────

    static async getEStampByDocument(
        documentId: string,
        stampType?: EStampType
    ): Promise<EStamp | null> {
        let query = `
            SELECT es.*, u.full_name as stamped_by_name
            FROM document_e_stamps es
            LEFT JOIN users u ON u.id = es.stamped_by
            WHERE es.document_id = $1 AND es.is_active = true
        `;
        const params: any[] = [documentId];
        let p = 2;

        if (stampType) {
            query += ` AND es.stamp_type = $${p}`;
            params.push(stampType);
            p++;
        }

        query += ` ORDER BY es.created_at DESC LIMIT 1`;

        const { rows } = await pool.query(query, params);

        if (rows.length === 0) return null;

        return {
            ...rows[0],
            stamp_data: typeof rows[0].stamp_data === 'string'
                ? JSON.parse(rows[0].stamp_data)
                : rows[0].stamp_data,
            metadata: typeof rows[0].metadata === 'string'
                ? JSON.parse(rows[0].metadata)
                : rows[0].metadata,
        };
    }

    // ── List E-Stamps ─────────────────────────────────────────────────────────

    static async listEStamps(filters: {
        document_id?: string;
        stamp_type?: EStampType;
        status?: string;
        limit?: number;
        offset?: number;
    }): Promise<EStamp[]> {
        let query = `
            SELECT es.*, u.full_name as stamped_by_name
            FROM document_e_stamps es
            LEFT JOIN users u ON u.id = es.stamped_by
            WHERE 1=1
        `;
        const params: any[] = [];
        let p = 1;

        if (filters.document_id) {
            query += ` AND es.document_id = $${p}`;
            params.push(filters.document_id);
            p++;
        }

        if (filters.stamp_type) {
            query += ` AND es.stamp_type = $${p}`;
            params.push(filters.stamp_type);
            p++;
        }

        if (filters.status) {
            if (filters.status === 'active') {
                query += ` AND es.is_active = true`;
            } else if (filters.status === 'revoked') {
                query += ` AND es.is_active = false`;
            }
        }

        query += ` ORDER BY es.created_at DESC`;

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

        return rows.map((row) => ({
            ...row,
            stamp_data: typeof row.stamp_data === 'string'
                ? JSON.parse(row.stamp_data)
                : row.stamp_data,
            metadata: typeof row.metadata === 'string'
                ? JSON.parse(row.metadata)
                : row.metadata,
        }));
    }

    // ── Private Helpers ──────────────────────────────────────────────────────

    private static generateVerificationCode(documentId: string, stampType: EStampType): string {
        const prefix = stampType === 'approved' ? 'ORHC-APPR' : 'ORHC-RCVD';
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = crypto.randomBytes(4).toString('hex').toUpperCase();
        const docHash = documentId.slice(0, 8).toUpperCase();
        return `${prefix}-${docHash}-${timestamp.slice(-6)}-${random}`;
    }
}