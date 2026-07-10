// src/features/e-stamp/e-stamp.service.ts

import { pool } from '../../config/db';
import { AppError } from '../../utils/response';
import { uploadToCloudinary, deleteFromCloudinary } from '../../config/cloudinary';
import QRCode from 'qrcode';
import crypto from 'crypto';
import type {
    EStamp,
    GenerateEStampInput,
    EStampVerificationResult,
    EStampType,
} from './e-stamp.types';
import { E_STAMP_TYPE_LABELS } from './e-stamp.types';

// ─── Constants ──────────────────────────────────────────────────────────────

const E_STAMP_FOLDER = 'registrar/e-stamps';

// ─── E-Stamp Service ─────────────────────────────────────────────────────────

export class EStampService {

    // ── Generate E-Stamp ─────────────────────────────────────────────────────

    static async generateEStamp(
        input: GenerateEStampInput,
        userId: string
    ): Promise<EStamp> {
        // Check if document exists
        const docResult = await pool.query(
            `SELECT d.id, d.title, d.reference_no, d.type, d.status,
                    u.full_name as stamped_by_name,
                    u.signature_url
             FROM documents d
             LEFT JOIN users u ON u.id = $1
             WHERE d.id = $2 AND d.is_active = true`,
            [userId, input.document_id]
        );

        if (docResult.rows.length === 0) {
            throw new AppError(404, 'Document not found');
        }

        const doc = docResult.rows[0];

        // Check if document already has this type of e-stamp
        const existingStamp = await pool.query(
            `SELECT id FROM document_e_stamps 
             WHERE document_id = $1 AND stamp_type = $2 AND is_active = true`,
            [input.document_id, input.stamp_type]
        );

        if (existingStamp.rows.length > 0) {
            throw new AppError(409, `Document already has an active ${E_STAMP_TYPE_LABELS[input.stamp_type]} e-stamp`);
        }

        // Use provided signature or get from user
        const signatureUrl = input.signature_url || doc.signature_url;

        if (!signatureUrl) {
            throw new AppError(400, 'No signature found. Please upload a signature first.');
        }

        // Generate unique verification code
        const verificationCode = this.generateVerificationCode(doc.id, input.stamp_type);

        // Create stamp image with signature
        const stampImageBuffer = await this.createStampImage({
            documentId: doc.id,
            referenceNo: doc.reference_no || 'N/A',
            title: doc.title,
            stampedBy: doc.stamped_by_name || 'Unknown',
            stampedAt: new Date().toISOString(),
            verificationCode,
            stampType: input.stamp_type,
            signatureUrl: signatureUrl,
            metadata: input.metadata,
        });

        // Upload stamp to Cloudinary
        const uploaded = await this.uploadStampImage(stampImageBuffer, doc.id, input.stamp_type);

        // Save stamp to database
        const { rows } = await pool.query(
            `INSERT INTO document_e_stamps
                (document_id, stamp_type, stamped_by, stamp_image_url, stamp_public_id,
                 stamp_data, metadata, verification_code, verification_hash)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING *`,
            [
                input.document_id,
                input.stamp_type,
                userId,
                uploaded.secure_url,
                uploaded.public_id,
                JSON.stringify({
                    reference_no: doc.reference_no,
                    document_title: doc.title,
                    stamped_at: new Date().toISOString(),
                    stamped_by: userId,
                    stamp_type: input.stamp_type,
                    signature_url: signatureUrl,
                    department_name: input.metadata?.department_name || null,
                    station_name: input.metadata?.station_name || null,
                    document_type: doc.type,
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
                crypto.createHash('sha256').update(verificationCode).digest('hex'),
            ]
        );

        // Update document e_stamp_status
        await pool.query(
            `UPDATE documents 
             SET e_stamp_status = 'stamped',
                 updated_at = NOW()
             WHERE id = $1`,
            [input.document_id]
        );

        return rows[0];
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
        if (otherStamps.rows.length === 0) {
            await pool.query(
                `UPDATE documents 
                 SET e_stamp_status = 'failed',
                     updated_at = NOW()
                 WHERE id = $1`,
                [result.rows[0].document_id]
            );
        }

        // Delete stamp from Cloudinary
        const stamp = await pool.query(
            `SELECT stamp_public_id FROM document_e_stamps WHERE id = $1`,
            [id]
        );
        if (stamp.rows[0]?.stamp_public_id) {
            await deleteFromCloudinary(stamp.rows[0].stamp_public_id).catch(console.error);
        }
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

    private static async createStampImage(data: {
        documentId: string;
        referenceNo: string;
        title: string;
        stampedBy: string;
        stampedAt: string;
        verificationCode: string;
        stampType: EStampType;
        signatureUrl: string;
        metadata?: any;
    }): Promise<Buffer> {
        const {
            referenceNo,
            title,
            stampedBy,
            stampedAt,
            verificationCode,
            stampType,
            signatureUrl,
            metadata
        } = data;

        const isApproved = stampType === 'approved';
        const color = isApproved ? '#1E4620' : '#1a56db';
        const accentColor = isApproved ? '#C29B38' : '#60a5fa';
        const typeLabel = isApproved ? 'APPROVED' : 'RECEIVED';
        const typeSubLabel = isApproved ? 'Registration High Court' : 'Registration High Court';
        const stationName = metadata?.station_name || '';
        const departmentName = metadata?.department_name || 'Office of the Registrar';

        // Fetch the signature image
        let signatureBase64 = '';
        try {
            const response = await fetch(signatureUrl);
            const buffer = await response.arrayBuffer();
            signatureBase64 = Buffer.from(buffer).toString('base64');
        } catch (error) {
            console.error('Failed to fetch signature:', error);
        }

        // Create QR Code for verification
        let qrCodeBase64 = '';
        try {
            const qrData = {
                verification_code: verificationCode,
                document_id: data.documentId,
                reference_no: referenceNo,
                stamp_type: stampType,
                issued_at: new Date().toISOString(),
            };
            qrCodeBase64 = await QRCode.toDataURL(JSON.stringify(qrData), {
                errorCorrectionLevel: 'H',
                margin: 1,
                width: 50,
            });
        } catch (error) {
            console.error('QR Code generation failed:', error);
        }

        // Create SVG stamp with signature
        const svg = `
            <svg xmlns="http://www.w3.org/2000/svg" width="500" height="300">
                <!-- Background -->
                <rect width="500" height="300" fill="${color}" rx="15" ry="15"/>
                
                <!-- Border -->
                <rect x="8" y="8" width="484" height="284" fill="none" stroke="${accentColor}" stroke-width="3" rx="12" ry="12"/>
                
                <!-- Inner border -->
                <rect x="16" y="16" width="468" height="268" fill="none" stroke="${accentColor}" stroke-width="1" rx="10" ry="10" opacity="0.3"/>
                
                <!-- Header -->
                <text x="250" y="35" font-family="Georgia, serif" font-size="16" font-weight="bold" fill="${accentColor}" text-anchor="middle">
                    OFFICE OF THE REGISTRAR HIGH COURT
                </text>
                
                <!-- Subtitle -->
                <text x="250" y="52" font-family="Georgia, serif" font-size="11" fill="#CCCCCC" text-anchor="middle" font-style="italic">
                    ${departmentName}
                </text>
                
                <!-- Divider line -->
                <line x1="80" y1="60" x2="420" y2="60" stroke="${accentColor}" stroke-width="1" opacity="0.5"/>
                
                <!-- Main Stamp Type -->
                <text x="250" y="95" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="${accentColor}" text-anchor="middle" letter-spacing="4">
                    ${typeLabel}
                </text>
                
                <!-- Sub-type -->
                <text x="250" y="115" font-family="Arial, sans-serif" font-size="12" fill="#FFFFFF" text-anchor="middle" letter-spacing="2">
                    ${typeSubLabel}
                </text>
                
                <!-- Document Reference -->
                <text x="250" y="138" font-family="Arial, sans-serif" font-size="10" fill="#CCCCCC" text-anchor="middle">
                    Ref: ${referenceNo}
                </text>
                
                <!-- Document Title -->
                <text x="250" y="155" font-family="Arial, sans-serif" font-size="9" fill="#AAAAAA" text-anchor="middle">
                    ${title.length > 50 ? title.slice(0, 50) + '...' : title}
                </text>
                
                ${stationName ? `
                    <text x="250" y="172" font-family="Arial, sans-serif" font-size="10" fill="#CCCCCC" text-anchor="middle">
                        ${stationName}
                    </text>
                ` : ''}
                
                <!-- Signature Section -->
                ${signatureBase64 ? `
                    <image x="130" y="${stationName ? 185 : 175}" width="240" height="45" 
                           href="data:image/png;base64,${signatureBase64}" 
                           preserveAspectRatio="xMidYMid meet"/>
                ` : `
                    <text x="250" y="${stationName ? 210 : 195}" font-family="Arial, sans-serif" font-size="10" fill="#888888" text-anchor="middle" font-style="italic">
                        [Signature]
                    </text>
                `}
                
                <!-- Stamped By -->
                <text x="250" y="${stationName ? 215 : 200}" font-family="Arial, sans-serif" font-size="9" fill="#AAAAAA" text-anchor="middle">
                    ${isApproved ? 'Approved' : 'Received'} By: ${stampedBy}
                </text>
                
                <!-- Date and Time -->
                <text x="250" y="${stationName ? 232 : 217}" font-family="Arial, sans-serif" font-size="9" fill="#AAAAAA" text-anchor="middle">
                    Date: ${new Date(stampedAt).toLocaleDateString()} • Time: ${new Date(stampedAt).toLocaleTimeString()}
                </text>
                
                <!-- Time Stamp Label -->
                <text x="250" y="${stationName ? 247 : 232}" font-family="Arial, sans-serif" font-size="8" fill="#888888" text-anchor="middle">
                    Time Stamp
                </text>
                
                <!-- Verification Code -->
                <text x="250" y="${stationName ? 262 : 247}" font-family="Arial, sans-serif" font-size="8" fill="#666666" text-anchor="middle">
                    Code: ${verificationCode}
                </text>
                
                ${qrCodeBase64 ? `
                    <!-- QR Code -->
                    <image x="440" y="240" width="40" height="40" 
                           href="${qrCodeBase64}" 
                           preserveAspectRatio="xMidYMid meet"/>
                ` : ''}
                
                <!-- Decorative corners -->
                <circle cx="25" cy="25" r="5" fill="${accentColor}" opacity="0.3"/>
                <circle cx="475" cy="25" r="5" fill="${accentColor}" opacity="0.3"/>
                <circle cx="25" cy="275" r="5" fill="${accentColor}" opacity="0.3"/>
                <circle cx="475" cy="275" r="5" fill="${accentColor}" opacity="0.3"/>
            </svg>
        `;

        return Buffer.from(svg);
    }

    private static async uploadStampImage(
        imageBuffer: Buffer,
        documentId: string,
        stampType: EStampType
    ): Promise<{ secure_url: string; public_id: string }> {
        const multerFile: Express.Multer.File = {
            buffer: imageBuffer,
            originalname: `${stampType}-stamp-${documentId}.png`,
            mimetype: 'image/png',
            size: imageBuffer.length,
            fieldname: 'file',
            encoding: '7bit',
            stream: null as any,
            destination: '',
            filename: '',
            path: '',
        };

        return await uploadToCloudinary(multerFile, `${E_STAMP_FOLDER}/${stampType}`);
    }
}