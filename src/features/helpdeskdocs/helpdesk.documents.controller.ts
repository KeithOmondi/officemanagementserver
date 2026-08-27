// src/features/helpdesk/helpdesk.documents.controller.ts

import { Request, Response, NextFunction } from 'express';
import { pool } from '../../config/db';
import { HelpdeskDocumentsService } from './helpdesk.documents.service';
import type {
    SubmitDocumentForApprovalBody,
    AddCommentBody,
    LinkDocumentBody,
    BatchUploadBody,
    BulkLinkDocumentsBody,
    BulkUpdateStatusBody,
    // ─── Two-step approval types ──────────────────────────────────────────────
    InternalPreviewDocumentBody,
    InternalApproveDocumentBody,
    InternalRejectDocumentBody,
    InternalRequestChangesBody,
    InternalCancelApprovalBody,
    SendBackToRequesterBody,
    ResubmitDocumentBody,
} from './helpdesk.documents.schema';
import type { CreateHelpdeskDocumentInput } from './helpdesk.documents.types';
import { sendSuccess } from '../../utils/response';
import { AppError } from '../../utils/response';

// ─── Constants ─────────────────────────────────────────────────────────────────

const VALID_ENTITY_TYPES = [
    'circuit', 'bench', 'partHeard', 'serviceWeek', 
    'otherPayment', 'ticket', 'medicalClaim', 
    'generalRequest', 'securityRequest',
    'visa', 'protocol', 'club', 'utility_memo', 
    'consolidated_utility_memo', 'consolidated_fuel_memo',
    'aide', 'sentry', 'conference'
] as const;

const VALID_FORMATS = ['pdf', 'docx', 'xlsx'] as const;

const VALID_STATUSES = ['draft', 'pending_approval', 'approved', 'rejected', 'returned'] as const;

const VALID_INTERNAL_STATUSES = [
    'pending', 'previewed', 'approved_internal', 'rejected_internal',
    'changes_requested_internal', 'changes_ready'
] as const;

const VALID_REQUESTER_STATUSES = [
    'pending_approval', 'approved', 'rejected', 'changes_requested', 'in_revision'
] as const;

const VALID_REQUEST_TYPES = [
    'Driver', 'Bodyguard', 'Firearm', 'Current Station',
    'Force Number', 'Residence Security', 'Sentry'
] as const;

const VALID_STAMP_TYPES = ['approved', 'received', 'official'] as const;

const VALID_CONFERENCE_TYPES = [
    'judicial', 'administrative', 'training', 'workshop', 'seminar', 'other'
] as const;

const VALID_CONFERENCE_STATUSES = [
    'draft', 'pending', 'approved', 'rejected', 'completed', 'cancelled'
] as const;

// ─── Helper Functions ─────────────────────────────────────────────────────────

function getParam(req: Request, key: string): string {
    const value = req.params[key];
    if (Array.isArray(value)) {
        throw new AppError(400, `Parameter ${key} must be a string`);
    }
    if (!value) {
        throw new AppError(400, `Parameter ${key} is required`);
    }
    return value;
}

function isString(value: unknown): value is string {
    return typeof value === 'string';
}

function getQueryParam(req: Request, key: string): string | undefined {
    const value = req.query[key];
    if (Array.isArray(value)) {
        const first = value[0];
        return isString(first) ? first : undefined;
    }
    if (isString(value)) {
        return value;
    }
    return undefined;
}

function getQueryNumber(req: Request, key: string): number | undefined {
    const value = getQueryParam(req, key);
    if (value === undefined) return undefined;
    const num = Number(value);
    return isNaN(num) ? undefined : num;
}

function getQueryBoolean(req: Request, key: string): boolean | undefined {
    const value = getQueryParam(req, key);
    if (value === undefined) return undefined;
    return value === 'true';
}

function getQueryEnum<T extends string>(
    req: Request, 
    key: string, 
    validValues: readonly T[]
): T | undefined {
    const value = getQueryParam(req, key);
    if (value === undefined) return undefined;
    if (validValues.includes(value as T)) {
        return value as T;
    }
    return undefined;
}

// ─── Helper: Clean form-data body ─────────────────────────────────────────────

export function cleanFormDataBody<T extends Record<string, unknown>>(body: T): T {
    const cleaned: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(body)) {
        if (value === undefined) continue;
        
        if (value === null || value === '') {
            cleaned[key] = undefined;
            continue;
        }
        
        if (key === 'entity_id') {
            if (typeof value === 'string' && value.trim()) {
                cleaned[key] = value.trim();
            } else {
                cleaned[key] = undefined;
            }
            continue;
        }
        
        if (typeof value === 'string') {
            if (key === 'status' && !value.trim()) {
                cleaned[key] = 'draft';
                continue;
            }
            cleaned[key] = value.trim() || undefined;
            continue;
        }
        
        // ─── Conference numeric fields ──────────────────────────────────────────
        if (key === 'number_of_pax' || key === 'budget_estimate') {
            if (typeof value === 'string') {
                const num = parseFloat(value);
                cleaned[key] = isNaN(num) ? undefined : num;
            } else if (typeof value === 'number') {
                cleaned[key] = value;
            } else {
                cleaned[key] = undefined;
            }
            continue;
        }
        
        cleaned[key] = value;
    }
    
    return cleaned as T;
}

export function sanitizeFormDataBody(req: Request, _res: Response, next: NextFunction) {
    try {
        req.body = cleanFormDataBody(req.body ?? {});
        next();
    } catch (error) {
        console.error('[sanitizeFormDataBody] Error:', error);
        next(error);
    }
}

export function sanitizeBatchFormDataBody(req: Request, _res: Response, next: NextFunction) {
    try {
        const raw = req.body as BatchUploadBody | undefined;
        if (raw && Array.isArray(raw.documents)) {
            req.body = {
                documents: raw.documents.map((doc) => cleanFormDataBody(doc)),
            };
        }
        next();
    } catch (error) {
        console.error('[sanitizeBatchFormDataBody] Error:', error);
        next(error);
    }
}

// ─── Controller ──────────────────────────────────────────────────────────────

export class HelpdeskDocumentsController {

    // ─── Upload Document ──────────────────────────────────────────────────────

    static async upload(req: Request, res: Response, next: NextFunction) {
        try {
            console.log('🚀🚀🚀 UPLOAD CONTROLLER REACHED 🚀🚀🚀');
            
            const file = req.file;

            if (!file) {
                return res.status(400).json({
                    success: false,
                    message: 'No file provided. Please upload a valid document file.'
                });
            }

            const body = req.body as Record<string, any>;
            
            const requiredFields = ['ref', 'subject', 'entity_type', 'format'];
            const missingFields = requiredFields.filter(field => !body[field]);
            
            if (missingFields.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: `Missing required fields: ${missingFields.join(', ')}`,
                    missingFields
                });
            }

            if (!VALID_ENTITY_TYPES.includes(body.entity_type as any)) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid entity_type: ${body.entity_type}. Must be one of: ${VALID_ENTITY_TYPES.join(', ')}`,
                    validEntityTypes: VALID_ENTITY_TYPES
                });
            }

            if (!VALID_FORMATS.includes(body.format as any)) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid format: ${body.format}. Must be one of: ${VALID_FORMATS.join(', ')}`,
                    validFormats: VALID_FORMATS
                });
            }

            const formatToMimeMap: Record<string, string[]> = {
                'pdf': ['application/pdf'],
                'docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
                'xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
            };

            const allowedMimes = formatToMimeMap[body.format];
            if (allowedMimes && !allowedMimes.includes(file.mimetype)) {
                return res.status(400).json({
                    success: false,
                    message: `File type mismatch. Expected ${body.format.toUpperCase()} but received ${file.mimetype}`,
                    expected: body.format,
                    received: file.mimetype
                });
            }

            const MAX_FILE_SIZE = 10 * 1024 * 1024;
            if (file.size > MAX_FILE_SIZE) {
                return res.status(400).json({
                    success: false,
                    message: `File size exceeds maximum allowed (${MAX_FILE_SIZE / 1024 / 1024}MB)`,
                    maxSize: MAX_FILE_SIZE,
                    receivedSize: file.size
                });
            }

            const userId = (req as any).user?.id as string;
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: 'User not authenticated'
                });
            }

            const input: CreateHelpdeskDocumentInput = {
                ref: body.ref,
                subject: body.subject,
                entity_type: body.entity_type,
                entity_id: body.entity_id || undefined,
                format: body.format,
                status: body.status || 'draft',
                request_type: body.request_type || undefined,
                judge_name: body.judge_name || undefined,
                rank: body.rank || undefined,
                reporting_date: body.reporting_date || undefined,
                officer_rank: body.officer_rank || undefined,
                officer_name: body.officer_name || undefined,
                employment_number: body.employment_number || undefined,
                current_station: body.current_station || undefined,
                current_unit: body.current_unit || undefined,
                proposed_assignment: body.proposed_assignment || undefined,
                aide_status: body.aide_status || undefined,
                residence_location: body.residence_location || undefined,
                sentry_status: body.sentry_status || undefined,
                // ─── Conference fields ──────────────────────────────────────────
                conference_type: body.conference_type || undefined,
                start_date: body.start_date || undefined,
                end_date: body.end_date || undefined,
                number_of_pax: body.number_of_pax || undefined,
                venue: body.venue || undefined,
                location: body.location || undefined,
                budget_estimate: body.budget_estimate || undefined,
                conference_status: body.conference_status || undefined,
                // ─── Stamp Type for initial upload ──────────────────────────────
                stamp_type: body.stamp_type || undefined,
            };

            const doc = await HelpdeskDocumentsService.upload(file, input, userId);

            return sendSuccess(res, doc, 'Document saved successfully.', 201);
        } catch (err) {
            console.error('[UPLOAD-CONTROLLER] threw:', err);
            next(err);
        }
    }

    // ─── Update Document File ─────────────────────────────────────────────────

    static async updateDocumentFile(req: Request, res: Response, next: NextFunction) {
        try {
            const id = getParam(req, 'id');
            const file = req.file;
            
            if (!file) {
                return res.status(400).json({
                    success: false,
                    message: 'No file provided. Please upload a valid document file.'
                });
            }

            const body = req.body as any;
            const userId = (req as any).user?.id as string;

            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: 'User not authenticated'
                });
            }

            const doc = await HelpdeskDocumentsService.updateDocumentFile(
                id,
                file,
                body,
                userId
            );

            return sendSuccess(res, doc, 'Document updated successfully.');
        } catch (err) {
            next(err);
        }
    }

    // ─── Batch Upload ─────────────────────────────────────────────────────────

    static async batchUpload(req: Request, res: Response, next: NextFunction) {
        try {
            const files = req.files as Express.Multer.File[];
            if (!files || files.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'No files provided. Please upload at least one document.'
                });
            }

            const body = req.body as BatchUploadBody;
            const userId = (req as any).user?.id as string;

            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: 'User not authenticated'
                });
            }

            if (body.documents.length !== files.length) {
                return res.status(400).json({
                    success: false,
                    message: 'Number of documents metadata does not match number of files uploaded.'
                });
            }

            const results = {
                success: [] as any[],
                failed: [] as { index: number; error: string }[],
            };

            for (let i = 0; i < body.documents.length; i++) {
                try {
                    const doc = await HelpdeskDocumentsService.upload(
                        files[i],
                        body.documents[i],
                        userId
                    );
                    results.success.push(doc);
                } catch (error) {
                    results.failed.push({
                        index: i,
                        error: error instanceof Error ? error.message : 'Unknown error',
                    });
                }
            }

            return sendSuccess(res, results, `${results.success.length} documents uploaded successfully, ${results.failed.length} failed.`);
        } catch (err) {
            next(err);
        }
    }

    // ─── Submit for Approval ─────────────────────────────────────────────────

    static async submitForApproval(req: Request, res: Response, next: NextFunction) {
        try {
            const id = getParam(req, 'id');
            const userId = (req as any).user?.id as string;
            const body = req.body as SubmitDocumentForApprovalBody || {};

            const doc = await HelpdeskDocumentsService.submitForApproval(id, userId, body.comments);

            return sendSuccess(res, doc, 'Document submitted for approval.');
        } catch (err) {
            next(err);
        }
    }

    // ─── List Documents ───────────────────────────────────────────────────────

    static async list(req: Request, res: Response, next: NextFunction) {
        try {
            const entity_type = getQueryEnum(req, 'entity_type', VALID_ENTITY_TYPES);
            const entity_id = getQueryParam(req, 'entity_id');
            const format = getQueryEnum(req, 'format', VALID_FORMATS);
            const status = getQueryEnum(req, 'status', VALID_STATUSES);
            const search = getQueryParam(req, 'search');
            const limit = getQueryNumber(req, 'limit');
            const offset = getQueryNumber(req, 'offset');
            const uploaded_by = getQueryParam(req, 'uploaded_by');
            const pending_my_approval = getQueryBoolean(req, 'pending_my_approval');
            const unlinked = getQueryBoolean(req, 'unlinked');
            const request_type = getQueryEnum(req, 'request_type', VALID_REQUEST_TYPES);
            const judge_name = getQueryParam(req, 'judge_name');
            const date_from = getQueryParam(req, 'date_from');
            const date_to = getQueryParam(req, 'date_to');
            const rank = getQueryParam(req, 'rank');
            const reporting_date = getQueryParam(req, 'reporting_date');
            
            const internal_approval_status = getQueryEnum(req, 'internal_approval_status', VALID_INTERNAL_STATUSES);
            const requester_status = getQueryEnum(req, 'requester_status', VALID_REQUESTER_STATUSES);
            const is_sent_back_to_requester = getQueryBoolean(req, 'is_sent_back_to_requester');
            const pending_internal_approval = getQueryBoolean(req, 'pending_internal_approval');
            const ready_to_send_back = getQueryBoolean(req, 'ready_to_send_back');
            const my_requester_documents = getQueryBoolean(req, 'my_requester_documents');
            
            const officer_rank = getQueryParam(req, 'officer_rank');
            const officer_name = getQueryParam(req, 'officer_name');
            const employment_number = getQueryParam(req, 'employment_number');
            const current_station = getQueryParam(req, 'current_station');
            const current_unit = getQueryParam(req, 'current_unit');
            const aide_status = getQueryParam(req, 'aide_status');
            const residence_location = getQueryParam(req, 'residence_location');
            const sentry_status = getQueryParam(req, 'sentry_status');

            // ─── Conference filters ────────────────────────────────────────────
            const conference_type = getQueryEnum(req, 'conference_type', VALID_CONFERENCE_TYPES);
            const conference_status = getQueryEnum(req, 'conference_status', VALID_CONFERENCE_STATUSES);
            const start_date_from = getQueryParam(req, 'start_date_from');
            const start_date_to = getQueryParam(req, 'start_date_to');
            const location = getQueryParam(req, 'location');
            const venue = getQueryParam(req, 'venue');

            // ─── Stamp filters ───────────────────────────────────────────────────
            const is_stamped = getQueryBoolean(req, 'is_stamped');
            const stamp_type = getQueryEnum(req, 'stamp_type', VALID_STAMP_TYPES);

            const docs = await HelpdeskDocumentsService.findAll({
                entity_type,
                entity_id,
                format,
                status,
                search,
                limit,
                offset,
                uploaded_by,
                pending_my_approval,
                unlinked,
                request_type,
                judge_name,
                date_from,
                date_to,
                rank,
                reporting_date,
                internal_approval_status,
                requester_status,
                is_sent_back_to_requester,
                pending_internal_approval,
                ready_to_send_back,
                my_requester_documents,
                officer_rank,
                officer_name,
                employment_number,
                current_station,
                current_unit,
                aide_status,
                residence_location,
                sentry_status,
                // ─── Conference filters ────────────────────────────────────────
                conference_type,
                conference_status,
                start_date_from,
                start_date_to,
                location,
                venue,
                // ─── Stamp filters ──────────────────────────────────────────────
                is_stamped,
                stamp_type,
            });

            return sendSuccess(res, docs, `Found ${docs.length} documents.`);
        } catch (err) {
            next(err);
        }
    }

    // ─── Get Document by ID ───────────────────────────────────────────────────

    static async getById(req: Request, res: Response, next: NextFunction) {
        try {
            const id = getParam(req, 'id');
            const doc = await HelpdeskDocumentsService.findById(id);

            if (!doc) {
                throw new AppError(404, 'Document not found');
            }

            return sendSuccess(res, doc);
        } catch (err) {
            next(err);
        }
    }

    // ─── Get Documents by Entity ─────────────────────────────────────────────

    static async getByEntity(req: Request, res: Response, next: NextFunction) {
        try {
            const entityType = getParam(req, 'entityType') as any;
            const entityId = getParam(req, 'entityId');
            const status = getQueryParam(req, 'status');
            const limit = getQueryNumber(req, 'limit');
            const offset = getQueryNumber(req, 'offset');

            const docs = await HelpdeskDocumentsService.findByEntity(
                entityType,
                entityId,
                { status, limit, offset }
            );

            return sendSuccess(res, docs, `Found ${docs.length} documents for this entity.`);
        } catch (err) {
            next(err);
        }
    }

    // ─── Document Statistics ─────────────────────────────────────────────────

    static async getStats(req: Request, res: Response, next: NextFunction) {
        try {
            const entityType = getQueryParam(req, 'entityType') as any;
            const dateFrom = getQueryParam(req, 'date_from');
            const dateTo = getQueryParam(req, 'date_to');

            const stats = await HelpdeskDocumentsService.getStats({
                entity_type: entityType,
                date_from: dateFrom,
                date_to: dateTo,
            });

            return sendSuccess(res, stats, 'Document statistics retrieved.');
        } catch (err) {
            next(err);
        }
    }

    // ─── Document Summary ─────────────────────────────────────────────────────

    static async getSummary(req: Request, res: Response, next: NextFunction) {
        try {
            const entityType = getQueryParam(req, 'entityType') as any;

            const summary = await HelpdeskDocumentsService.getSummary({
                entity_type: entityType,
            });

            return sendSuccess(res, summary, 'Document summary retrieved.');
        } catch (err) {
            next(err);
        }
    }

    // ─── TWO-STEP APPROVAL CONTROLLER METHODS ────────────────────────────────

    /**
     * POST /api/helpdesk/documents/:id/internal/preview
     * Super admin previews a document internally
     * Requester does not see this action
     */
    static async internalPreview(req: Request, res: Response, next: NextFunction) {
        try {
            const id = getParam(req, 'id');
            const userId = (req as any).user?.id as string;
            const body = req.body as InternalPreviewDocumentBody;

            const doc = await HelpdeskDocumentsService.internalPreview(
                id,
                {
                    document_id: id,
                    previewed_by: body.previewed_by || userId,
                    previewed_by_name: body.previewed_by_name || (req as any).user?.full_name,
                    comments: body.comments,
                    ip_address: body.ip_address,
                    user_agent: body.user_agent,
                }
            );

            return sendSuccess(res, doc, 'Document previewed successfully.');
        } catch (err) {
            next(err);
        }
    }

    /**
     * POST /api/helpdesk/documents/:id/internal/approve
     * Super admin approves internally with signature AND stamp embedding
     * Requester still sees 'pending_approval' until send back
     */
static async internalApprove(req: Request, res: Response, next: NextFunction) {
    try {
        const id = getParam(req, 'id');
        const userId = (req as any).user?.id as string;
        const body = req.body as InternalApproveDocumentBody;

        // Check if the user has a signature uploaded
        const { rows: userRows } = await pool.query(
            `SELECT signature_url FROM users WHERE id = $1 AND is_active = true`,
            [userId]
        );
        
        if (!userRows[0]?.signature_url) {
            console.warn(`[InternalApprove] User ${userId} has no signature uploaded. Signature will not be embedded.`);
        }

        const doc = await HelpdeskDocumentsService.internalApprove(
            id,
            {
                document_id: id,
                action: 'approve',
                approved_by: body.approved_by || userId,
                approved_by_name: body.approved_by_name || (req as any).user?.full_name,
                comments: body.comments,
                generate_e_stamp: body.generate_e_stamp ?? true,
                signature_position_x: body.signature_position_x,
                signature_position_y: body.signature_position_y,
                signature_position_width: body.signature_position_width,
                signature_position_height: body.signature_position_height,
                stamp_position_x: body.stamp_position_x,
                stamp_position_y: body.stamp_position_y,
                stamp_position_width: body.stamp_position_width,
                stamp_position_height: body.stamp_position_height,
                stamp_type: body.stamp_type,
                sync_utilities: body.sync_utilities ?? true, // ← ADD THIS
            }
        );

        const signatureMessage = doc.is_signed 
            ? 'Document approved and signed. Send back to requester when ready.' 
            : 'Document approved (signature not embedded - no signature found). Send back to requester when ready.';

        return sendSuccess(res, doc, signatureMessage);
    } catch (err) {
        next(err);
    }
}


    /**
     * POST /api/helpdesk/documents/:id/internal/reject
     * Super admin rejects internally
     * Requester still sees 'pending_approval' until send back
     */
    static async internalReject(req: Request, res: Response, next: NextFunction) {
        try {
            const id = getParam(req, 'id');
            const userId = (req as any).user?.id as string;
            const body = req.body as InternalRejectDocumentBody;

            if (!body.rejection_reason) {
                throw new AppError(400, 'Rejection reason is required');
            }

            const doc = await HelpdeskDocumentsService.internalReject(
                id,
                {
                    document_id: id,
                    action: 'reject',
                    approved_by: body.rejected_by || userId,
                    approved_by_name: body.rejected_by_name || (req as any).user?.full_name,
                    comments: body.comments,
                    rejection_reason: body.rejection_reason,
                }
            );

            return sendSuccess(res, doc, 'Document rejected internally. Send back to requester when ready.');
        } catch (err) {
            next(err);
        }
    }

    /**
     * POST /api/helpdesk/documents/:id/internal/request-changes
     * Super admin requests changes internally
     * Requester still sees 'pending_approval' until send back
     */
    static async internalRequestChanges(req: Request, res: Response, next: NextFunction) {
        try {
            const id = getParam(req, 'id');
            const userId = (req as any).user?.id as string;
            const body = req.body as InternalRequestChangesBody;

            if (!body.changes_requested || body.changes_requested.length === 0) {
                throw new AppError(400, 'At least one change request is required');
            }

            const doc = await HelpdeskDocumentsService.internalRequestChanges(
                id,
                {
                    document_id: id,
                    action: 'request_changes',
                    approved_by: body.requested_by || userId,
                    approved_by_name: body.requested_by_name || (req as any).user?.full_name,
                    comments: body.comments,
                    changes_requested: body.changes_requested,
                }
            );

            return sendSuccess(res, doc, 'Changes requested internally. Send back to requester when ready.');
        } catch (err) {
            next(err);
        }
    }

    /**
     * POST /api/helpdesk/documents/:id/internal/cancel
     * Super admin cancels internal approval decision
     * Resets document back to pending
     */
    static async internalCancelApproval(req: Request, res: Response, next: NextFunction) {
        try {
            const id = getParam(req, 'id');
            const userId = (req as any).user?.id as string;
            const body = req.body as InternalCancelApprovalBody;

            const doc = await HelpdeskDocumentsService.cancelInternalApproval(
                id,
                {
                    document_id: id,
                    cancelled_by: body.cancelled_by || userId,
                    cancelled_by_name: body.cancelled_by_name || (req as any).user?.full_name,
                    reason: body.reason,
                }
            );

            return sendSuccess(res, doc, 'Internal approval decision cancelled.');
        } catch (err) {
            next(err);
        }
    }

    /**
     * POST /api/helpdesk/documents/:id/send-back
     * Super admin sends document back to requester
     * THIS is when the requester finally sees the status change
     */
static async sendBackToRequester(req: Request, res: Response, next: NextFunction) {
    try {
        const id = getParam(req, 'id');
        const userId = (req as any).user?.id as string;
        const body = req.body as SendBackToRequesterBody;

        if (!body.final_status) {
            throw new AppError(400, 'Final status is required');
        }

        const validStatuses = ['approved', 'rejected', 'changes_requested'];
        if (!validStatuses.includes(body.final_status)) {
            throw new AppError(400, `Final status must be one of: ${validStatuses.join(', ')}`);
        }

        const doc = await HelpdeskDocumentsService.sendBackToRequester(
            id,
            {
                document_id: id,
                sent_by: body.sent_by || userId,
                sent_by_name: body.sent_by_name || (req as any).user?.full_name,
                comments: body.comments,
                final_status: body.final_status as 'approved' | 'rejected' | 'changes_requested',
                requester_message: body.requester_message,
                notify_requester: body.notify_requester ?? true,
                sync_utilities: body.sync_utilities ?? true, // ← ADD THIS
            }
        );

        const statusMessages: Record<string, string> = {
            approved: 'Document approved and sent back to requester with signature.',
            rejected: 'Document rejected and sent back to requester.',
            changes_requested: 'Changes requested and sent back to requester.',
        };

        return sendSuccess(res, doc, statusMessages[body.final_status] || 'Document sent back to requester.');
    } catch (err) {
        next(err);
    }
}

    /**
     * POST /api/helpdesk/documents/:id/resubmit
     * Requester resubmits document after making changes
     */
    static async resubmitDocument(req: Request, res: Response, next: NextFunction) {
        try {
            const id = getParam(req, 'id');
            const userId = (req as any).user?.id as string;
            const body = req.body as ResubmitDocumentBody;

            const doc = await HelpdeskDocumentsService.resubmitAfterChanges(
                id,
                {
                    document_id: id,
                    submitted_by: body.submitted_by || userId,
                    submitted_by_name: body.submitted_by_name || (req as any).user?.full_name,
                    comments: body.comments,
                    file_update: body.file_update || false,
                }
            );

            return sendSuccess(res, doc, 'Document resubmitted successfully.');
        } catch (err) {
            next(err);
        }
    }

    // ─── TWO-STEP APPROVAL DASHBOARD METHODS ──────────────────────────────────

    /**
     * GET /api/helpdesk/documents/pending-internal
     * Super admin dashboard - get pending internal approvals
     */
    static async getPendingInternalApprovals(req: Request, res: Response, next: NextFunction) {
        try {
            const entity_type = getQueryEnum(req, 'entity_type', VALID_ENTITY_TYPES);
            const internal_approval_status = getQueryEnum(req, 'internal_approval_status', VALID_INTERNAL_STATUSES);
            const search = getQueryParam(req, 'search');
            const limit = getQueryNumber(req, 'limit');
            const offset = getQueryNumber(req, 'offset');

            const docs = await HelpdeskDocumentsService.getPendingInternalApprovals({
                entity_type,
                internal_approval_status,
                search,
                limit,
                offset,
            });

            const summary = await HelpdeskDocumentsService.getPendingInternalApprovalsSummary({
                entity_type,
            });

            return sendSuccess(res, {
                documents: docs,
                summary,
            }, `Found ${docs.length} pending internal approvals.`);
        } catch (err) {
            next(err);
        }
    }

    /**
     * GET /api/helpdesk/documents/pending-internal/summary
     * Get internal approval summary stats for super admin dashboard
     */
    static async getPendingInternalSummary(req: Request, res: Response, next: NextFunction) {
        try {
            const entity_type = getQueryParam(req, 'entity_type') as any;

            const summary = await HelpdeskDocumentsService.getPendingInternalApprovalsSummary({
                entity_type,
            });

            return sendSuccess(res, summary, 'Pending internal approvals summary retrieved.');
        } catch (err) {
            next(err);
        }
    }

    /**
     * GET /api/helpdesk/documents/requester-dashboard
     * Requester dashboard - get documents visible to requester
     */
    static async getRequesterDashboard(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).user?.id as string;
            
            if (!userId) {
                throw new AppError(401, 'User not authenticated');
            }

            const requester_status = getQueryEnum(req, 'requester_status', VALID_REQUESTER_STATUSES);
            const entity_type = getQueryEnum(req, 'entity_type', VALID_ENTITY_TYPES);
            const search = getQueryParam(req, 'search');
            const limit = getQueryNumber(req, 'limit');
            const offset = getQueryNumber(req, 'offset');

            const docs = await HelpdeskDocumentsService.getRequesterDocuments(userId, {
                requester_status,
                entity_type,
                search,
                limit,
                offset,
            });

            const allDocs = await HelpdeskDocumentsService.getRequesterDocuments(userId, {
                requester_status,
                entity_type,
            });

            const summary = {
                total: allDocs.length,
                by_status: allDocs.reduce((acc, doc) => {
                    acc[doc.status] = (acc[doc.status] || 0) + 1;
                    return acc;
                }, {} as Record<string, number>),
                can_resubmit: allDocs.filter(doc => doc.can_resubmit).length,
                stamped_count: allDocs.filter(doc => doc.is_stamped).length,
                signed_count: allDocs.filter(doc => doc.is_signed).length,
                signed_and_stamped_count: allDocs.filter(doc => doc.is_signed && doc.is_stamped).length,
            };

            return sendSuccess(res, {
                documents: docs,
                summary,
            }, `Found ${docs.length} documents for requester.`);
        } catch (err) {
            next(err);
        }
    }

    // ─── Add Comment ─────────────────────────────────────────────────────────

    static async addComment(req: Request, res: Response, next: NextFunction) {
        try {
            const id = getParam(req, 'id');
            const userId = (req as any).user?.id as string;
            const { comment, is_internal } = req.body as AddCommentBody;

            if (!comment) {
                throw new AppError(400, 'Comment is required');
            }

            const newComment = await HelpdeskDocumentsService.addComment(
                id,
                userId,
                comment,
                is_internal || false
            );

            return sendSuccess(res, newComment, 'Comment added successfully.');
        } catch (err) {
            next(err);
        }
    }

    // ─── Delete Comment ──────────────────────────────────────────────────────

    static async deleteComment(req: Request, res: Response, next: NextFunction) {
        try {
            const commentId = getParam(req, 'commentId');
            const userId = (req as any).user?.id as string;

            await HelpdeskDocumentsService.deleteComment(commentId, userId);

            return sendSuccess(res, null, 'Comment deleted successfully.');
        } catch (err) {
            next(err);
        }
    }

    // ─── Link Document to Entity ─────────────────────────────────────────────

    static async link(req: Request, res: Response, next: NextFunction) {
        try {
            const id = getParam(req, 'id');
            const body = req.body as LinkDocumentBody;

            if (!body.entity_type) {
                throw new AppError(400, 'Entity type is required');
            }
            if (!body.entity_id) {
                throw new AppError(400, 'Entity ID is required');
            }

            const cleanedRank = body.rank === null ? undefined : body.rank;
            const cleanedReportingDate = body.reporting_date === null ? undefined : body.reporting_date;
            const cleanedOfficerRank = body.officer_rank === null ? undefined : body.officer_rank;
            const cleanedOfficerName = body.officer_name === null ? undefined : body.officer_name;
            const cleanedEmploymentNumber = body.employment_number === null ? undefined : body.employment_number;
            const cleanedCurrentStation = body.current_station === null ? undefined : body.current_station;
            const cleanedCurrentUnit = body.current_unit === null ? undefined : body.current_unit;
            const cleanedProposedAssignment = body.proposed_assignment === null ? undefined : body.proposed_assignment;
            const cleanedAideStatus = body.aide_status === null ? undefined : body.aide_status;
            const cleanedResidenceLocation = body.residence_location === null ? undefined : body.residence_location;
            const cleanedSentryStatus = body.sentry_status === null ? undefined : body.sentry_status;
            
            // ─── Conference fields ──────────────────────────────────────────────
            const cleanedConferenceType = body.conference_type === null ? undefined : body.conference_type;
            const cleanedStartDate = body.start_date === null ? undefined : body.start_date;
            const cleanedEndDate = body.end_date === null ? undefined : body.end_date;
            const cleanedNumberOfPax = body.number_of_pax === null ? undefined : body.number_of_pax;
            const cleanedVenue = body.venue === null ? undefined : body.venue;
            const cleanedLocation = body.location === null ? undefined : body.location;
            const cleanedBudgetEstimate = body.budget_estimate === null ? undefined : body.budget_estimate;
            const cleanedConferenceStatus = body.conference_status === null ? undefined : body.conference_status;

            const doc = await HelpdeskDocumentsService.linkToEntity(
                id, 
                body.entity_type, 
                body.entity_id,
                body.request_type,
                body.judge_name,
                cleanedRank,
                cleanedReportingDate,
                cleanedOfficerRank,
                cleanedOfficerName,
                cleanedEmploymentNumber,
                cleanedCurrentStation,
                cleanedCurrentUnit,
                cleanedProposedAssignment,
                cleanedAideStatus,
                cleanedResidenceLocation,
                cleanedSentryStatus,
                cleanedConferenceType,
                cleanedStartDate,
                cleanedEndDate,
                cleanedNumberOfPax,
                cleanedVenue,
                cleanedLocation,
                cleanedBudgetEstimate,
                cleanedConferenceStatus
            );

            return sendSuccess(res, doc, 'Document linked successfully.');
        } catch (err) {
            next(err);
        }
    }

    // ─── Bulk Link Documents ─────────────────────────────────────────────────

    static async bulkLink(req: Request, res: Response, next: NextFunction) {
        try {
            const body = req.body as BulkLinkDocumentsBody;

            if (!body.document_ids || body.document_ids.length === 0) {
                throw new AppError(400, 'At least one document ID is required');
            }
            if (!body.entity_type) {
                throw new AppError(400, 'Entity type is required');
            }
            if (!body.entity_id) {
                throw new AppError(400, 'Entity ID is required');
            }

            const cleanedRank = body.rank === null ? undefined : body.rank;
            const cleanedReportingDate = body.reporting_date === null ? undefined : body.reporting_date;
            const cleanedOfficerRank = body.officer_rank === null ? undefined : body.officer_rank;
            const cleanedOfficerName = body.officer_name === null ? undefined : body.officer_name;
            const cleanedEmploymentNumber = body.employment_number === null ? undefined : body.employment_number;
            const cleanedCurrentStation = body.current_station === null ? undefined : body.current_station;
            const cleanedCurrentUnit = body.current_unit === null ? undefined : body.current_unit;
            const cleanedProposedAssignment = body.proposed_assignment === null ? undefined : body.proposed_assignment;
            const cleanedAideStatus = body.aide_status === null ? undefined : body.aide_status;
            const cleanedResidenceLocation = body.residence_location === null ? undefined : body.residence_location;
            const cleanedSentryStatus = body.sentry_status === null ? undefined : body.sentry_status;
            
            // ─── Conference fields ──────────────────────────────────────────────
            const cleanedConferenceType = body.conference_type === null ? undefined : body.conference_type;
            const cleanedStartDate = body.start_date === null ? undefined : body.start_date;
            const cleanedEndDate = body.end_date === null ? undefined : body.end_date;
            const cleanedNumberOfPax = body.number_of_pax === null ? undefined : body.number_of_pax;
            const cleanedVenue = body.venue === null ? undefined : body.venue;
            const cleanedLocation = body.location === null ? undefined : body.location;
            const cleanedBudgetEstimate = body.budget_estimate === null ? undefined : body.budget_estimate;
            const cleanedConferenceStatus = body.conference_status === null ? undefined : body.conference_status;

            const result = await HelpdeskDocumentsService.bulkLinkToEntity(
                body.document_ids,
                body.entity_type,
                body.entity_id,
                body.request_type,
                body.judge_name,
                cleanedRank,
                cleanedReportingDate,
                cleanedOfficerRank,
                cleanedOfficerName,
                cleanedEmploymentNumber,
                cleanedCurrentStation,
                cleanedCurrentUnit,
                cleanedProposedAssignment,
                cleanedAideStatus,
                cleanedResidenceLocation,
                cleanedSentryStatus,
                cleanedConferenceType,
                cleanedStartDate,
                cleanedEndDate,
                cleanedNumberOfPax,
                cleanedVenue,
                cleanedLocation,
                cleanedBudgetEstimate,
                cleanedConferenceStatus
            );

            return sendSuccess(res, result, `${result.success.length} documents linked successfully.`);
        } catch (err) {
            next(err);
        }
    }

    // ─── Bulk Update Status ──────────────────────────────────────────────────

    static async bulkUpdateStatus(req: Request, res: Response, next: NextFunction) {
        try {
            const { document_ids, status, comments } = req.body as BulkUpdateStatusBody;

            if (!document_ids || document_ids.length === 0) {
                throw new AppError(400, 'At least one document ID is required');
            }
            if (!status) {
                throw new AppError(400, 'Status is required');
            }

            const result = await HelpdeskDocumentsService.bulkUpdateStatus(
                document_ids,
                status,
                comments
            );

            return sendSuccess(res, result, `${result.success.length} documents updated successfully.`);
        } catch (err) {
            next(err);
        }
    }

    // ─── Delete Document ─────────────────────────────────────────────────────

    static async remove(req: Request, res: Response, next: NextFunction) {
        try {
            const id = getParam(req, 'id');
            const userId = (req as any).user?.id;
            const userRole = (req as any).user?.role;

            const doc = await HelpdeskDocumentsService.findById(id);
            if (!doc) {
                throw new AppError(404, 'Document not found');
            }

            if (!doc.is_active) {
                throw new AppError(400, 'Document is already deleted');
            }

            const isOwner = doc.uploaded_by === userId;
            const isDeptHead = userRole === 'dept_head';
            const isSuperAdmin = userRole === 'super_admin';
            const isStaff = userRole === 'staff';

            // ─── Permission Matrix ───────────────────────────────────────────
            // | Role        | Draft | Returned | Rejected | Pending | Approved |
            // |-------------|-------|----------|----------|---------|----------|
            // | Super Admin | ✅    | ✅       | ✅       | ✅      | ✅       |
            // | Dept Head   | ✅    | ✅       | ✅       | ✅      | ✅       |
            // | Staff (own) | ✅    | ✅       | ✅       | ✅      | ❌       |
            // | Staff (other)| ❌   | ❌       | ❌       | ❌      | ❌       |
            // ───────────────────────────────────────────────────────────────────

            if (!isSuperAdmin && !isDeptHead && !isStaff) {
                throw new AppError(403, 'You do not have permission to delete documents');
            }

            if (isStaff && !isOwner) {
                throw new AppError(403, 'You can only delete documents you uploaded');
            }

            if (isStaff) {
                if (!['draft', 'returned', 'rejected', 'pending_approval'].includes(doc.status)) {
                    throw new AppError(403, 'You can only delete draft, returned, rejected, or pending approval documents. Approved documents must be deleted by a department head or super admin.');
                }
            }

            await HelpdeskDocumentsService.delete(id);

            return sendSuccess(res, null, 'Document deleted successfully.');
        } catch (err) {
            console.error('[DELETE] Error:', err);
            next(err);
        }
    }

    // ─── Hard Delete (Admin Only) ───────────────────────────────────────────

    static async hardRemove(req: Request, res: Response, next: NextFunction) {
        try {
            const id = getParam(req, 'id');
            const userRole = (req as any).user?.role;

            if (userRole !== 'super_admin') {
                throw new AppError(403, 'Only super admins can permanently delete documents');
            }

            const doc = await HelpdeskDocumentsService.findById(id);
            if (!doc) {
                throw new AppError(404, 'Document not found');
            }

            await HelpdeskDocumentsService.hardDelete(id);

            return sendSuccess(res, null, 'Document permanently deleted.');
        } catch (err) {
            next(err);
        }
    }
}