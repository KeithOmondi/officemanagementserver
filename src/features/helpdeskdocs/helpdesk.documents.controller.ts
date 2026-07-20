// src/features/helpdesk/helpdesk.documents.controller.ts

import { Request, Response, NextFunction } from 'express';
import { HelpdeskDocumentsService } from './helpdesk.documents.service';
import type {
    UploadHelpdeskDocumentBody,
    SubmitDocumentForApprovalBody,
    ApproveDocumentBody,
    RejectDocumentBody,
    ReturnDocumentBody,
    AddCommentBody,
    LinkDocumentBody,
    ListHelpdeskDocumentsQuery,
    BatchUploadBody,
    BulkLinkDocumentsBody,
    BulkUpdateStatusBody,
    UpdateEStampBody,
} from './helpdesk.documents.schema';
import { sendSuccess } from '../../utils/response';
import { AppError } from '../../utils/response';

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

/**
 * Cleans form-data body by converting null/undefined/empty strings to undefined
 * and handling the entity_id field properly.
 */
function cleanFormDataBody<T extends Record<string, unknown>>(body: T): T {
    const cleaned: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(body)) {
        // Skip undefined values
        if (value === undefined) continue;
        
        // Convert null or empty string to undefined for optional fields
        if (value === null || value === '') {
            cleaned[key] = undefined;
            continue;
        }
        
        // Handle entity_id specifically - ensure it's a string or undefined
        if (key === 'entity_id') {
            if (typeof value === 'string' && value.trim()) {
                cleaned[key] = value.trim();
            } else {
                cleaned[key] = undefined;
            }
            continue;
        }
        
        // Handle other string fields
        if (typeof value === 'string') {
            // For status field, keep 'draft' default
            if (key === 'status' && !value.trim()) {
                cleaned[key] = 'draft';
                continue;
            }
            // For other string fields, trim if provided
            cleaned[key] = value.trim() || undefined;
            continue;
        }
        
        // Keep other values as-is
        cleaned[key] = value;
    }
    
    return cleaned as T;
}

// ─── Controller ──────────────────────────────────────────────────────────────

export class HelpdeskDocumentsController {

    // ─── Upload Document ──────────────────────────────────────────────────────

    static async upload(req: Request, res: Response, next: NextFunction) {
        try {
            const file = req.file;
            if (!file) {
                return res.status(400).json({
                    success: false,
                    message: 'No file provided. Please upload a valid document file.'
                });
            }

            // Clean the body before using it
            const rawBody = req.body as UploadHelpdeskDocumentBody;
            const cleanedBody = cleanFormDataBody(rawBody);
            const body = cleanedBody as UploadHelpdeskDocumentBody;
            
            const userId = (req as any).user?.id as string;

            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: 'User not authenticated'
                });
            }

            const doc = await HelpdeskDocumentsService.upload(file, body, userId);

            return sendSuccess(res, doc, 'Document saved successfully.', 201);
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

            const rawBody = req.body as BatchUploadBody;
            const userId = (req as any).user?.id as string;

            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: 'User not authenticated'
                });
            }

            // Clean each document in the batch
            const cleanedDocuments = rawBody.documents.map(doc => cleanFormDataBody(doc));
            const body = { documents: cleanedDocuments } as BatchUploadBody;

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

    // ─── List Documents ───────────────────────────────────────────────────────

    static async list(req: Request, res: Response, next: NextFunction) {
        try {
            const entity_type = getQueryEnum(req, 'entity_type', [
                'circuit', 'bench', 'partHeard', 'serviceWeek', 
                'otherPayment', 'ticket', 'medicalClaim', 
                'generalRequest', 'securityRequest'
            ] as const);
            
            const entity_id = getQueryParam(req, 'entity_id');
            const format = getQueryEnum(req, 'format', ['pdf', 'docx', 'xlsx'] as const);
            const status = getQueryEnum(req, 'status', [
                'draft', 'pending_approval', 'approved', 'rejected', 'returned'
            ] as const);
            const search = getQueryParam(req, 'search');
            const limit = getQueryNumber(req, 'limit');
            const offset = getQueryNumber(req, 'offset');
            const uploaded_by = getQueryParam(req, 'uploaded_by');
            const pending_my_approval = getQueryBoolean(req, 'pending_my_approval');
            const unlinked = getQueryBoolean(req, 'unlinked');
            const request_type = getQueryEnum(req, 'request_type', [
                'Driver', 'Bodyguard', 'Firearm', 'Current Station',
                'Force Number', 'Residence Security', 'Sentry'
            ] as const);
            const judge_name = getQueryParam(req, 'judge_name');
            const date_from = getQueryParam(req, 'date_from');
            const date_to = getQueryParam(req, 'date_to');
            const rank = getQueryParam(req, 'rank');
            const reporting_date = getQueryParam(req, 'reporting_date');

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

    // ─── Submit for Approval ─────────────────────────────────────────────────

    static async submitForApproval(req: Request, res: Response, next: NextFunction) {
        try {
            const id = getParam(req, 'id');
            const userId = (req as any).user?.id as string;
            const { comments } = req.body as SubmitDocumentForApprovalBody || {};

            const doc = await HelpdeskDocumentsService.submitForApproval(id, userId, comments);

            return sendSuccess(res, doc, 'Document submitted for approval.');
        } catch (err) {
            next(err);
        }
    }

    // ─── Approve Document ────────────────────────────────────────────────────

    static async approve(req: Request, res: Response, next: NextFunction) {
        try {
            const id = getParam(req, 'id');
            const userId = (req as any).user?.id as string;
            const { comments, approved_by_name } = req.body as ApproveDocumentBody;

            const doc = await HelpdeskDocumentsService.approveDocument(
                id, 
                userId, 
                comments,
                approved_by_name
            );

            return sendSuccess(res, doc, 'Document approved and e-stamped.');
        } catch (err) {
            next(err);
        }
    }

    // ─── Reject Document ─────────────────────────────────────────────────────

    static async reject(req: Request, res: Response, next: NextFunction) {
        try {
            const id = getParam(req, 'id');
            const userId = (req as any).user?.id as string;
            const { reason, comments } = req.body as RejectDocumentBody;

            if (!reason) {
                throw new AppError(400, 'Rejection reason is required');
            }

            const doc = await HelpdeskDocumentsService.rejectDocument(id, userId, reason, comments);

            return sendSuccess(res, doc, 'Document rejected.');
        } catch (err) {
            next(err);
        }
    }

    // ─── Return Document ─────────────────────────────────────────────────────

    static async returnDocument(req: Request, res: Response, next: NextFunction) {
        try {
            const id = getParam(req, 'id');
            const userId = (req as any).user?.id as string;
            const { comments, instructions } = req.body as ReturnDocumentBody;

            const doc = await HelpdeskDocumentsService.returnDocument(id, userId, comments, instructions);

            return sendSuccess(res, doc, 'Document returned for action.');
        } catch (err) {
            next(err);
        }
    }

    // ─── Update E-Stamp ──────────────────────────────────────────────────────

    static async updateEStamp(req: Request, res: Response, next: NextFunction) {
        try {
            const id = getParam(req, 'id');
            const { e_stamp_url, e_stamp_public_id, e_stamp_status } = req.body as UpdateEStampBody;

            const doc = await HelpdeskDocumentsService.updateEStamp(
                id,
                e_stamp_url,
                e_stamp_public_id,
                e_stamp_status || 'stamped'
            );

            return sendSuccess(res, doc, 'E-stamp updated successfully.');
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
            const { 
                entity_type, 
                entity_id, 
                request_type, 
                judge_name,
                rank,
                reporting_date,
            } = req.body as LinkDocumentBody;

            if (!entity_type) {
                throw new AppError(400, 'Entity type is required');
            }
            if (!entity_id) {
                throw new AppError(400, 'Entity ID is required');
            }

            const doc = await HelpdeskDocumentsService.linkToEntity(
                id, 
                entity_type, 
                entity_id,
                request_type,
                judge_name,
                rank,
                reporting_date
            );

            return sendSuccess(res, doc, 'Document linked successfully.');
        } catch (err) {
            next(err);
        }
    }

    // ─── Bulk Link Documents ─────────────────────────────────────────────────

    static async bulkLink(req: Request, res: Response, next: NextFunction) {
        try {
            const { 
                document_ids, 
                entity_type, 
                entity_id, 
                request_type, 
                judge_name,
                rank,
                reporting_date,
            } = req.body as BulkLinkDocumentsBody;

            if (!document_ids || document_ids.length === 0) {
                throw new AppError(400, 'At least one document ID is required');
            }
            if (!entity_type) {
                throw new AppError(400, 'Entity type is required');
            }
            if (!entity_id) {
                throw new AppError(400, 'Entity ID is required');
            }

            const result = await HelpdeskDocumentsService.bulkLinkToEntity(
                document_ids,
                entity_type,
                entity_id,
                request_type,
                judge_name,
                rank,
                reporting_date
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

            // First check if document exists
            const doc = await HelpdeskDocumentsService.findById(id);
            if (!doc) {
                throw new AppError(404, 'Document not found');
            }

            // Check if document is already deleted
            if (!doc.is_active) {
                throw new AppError(400, 'Document is already deleted');
            }

            // Permission check - only uploader, dept_head, or super_admin can delete
            const isOwner = doc.uploaded_by === userId;
            const isDeptHead = userRole === 'dept_head';
            const isSuperAdmin = userRole === 'super_admin';

            if (!isOwner && !isDeptHead && !isSuperAdmin) {
                throw new AppError(403, 'You do not have permission to delete this document');
            }

            // Prevent deleting approved documents unless super_admin
            if (doc.status === 'approved' && !isSuperAdmin) {
                throw new AppError(403, 'Only super admins can delete approved documents');
            }

            // Prevent deleting pending approval documents unless super_admin or dept_head
            if (doc.status === 'pending_approval' && !isSuperAdmin && !isDeptHead) {
                throw new AppError(403, 'Only super admins or department heads can delete pending documents');
            }

            await HelpdeskDocumentsService.delete(id);

            return sendSuccess(res, null, 'Document deleted successfully.');
        } catch (err) {
            next(err);
        }
    }

    // ─── Hard Delete (Admin Only) ───────────────────────────────────────────

    static async hardRemove(req: Request, res: Response, next: NextFunction) {
        try {
            const id = getParam(req, 'id');
            const userRole = (req as any).user?.role;

            // Only super_admin can hard delete
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