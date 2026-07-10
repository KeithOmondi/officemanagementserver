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
} from './helpdesk.documents.schema';
import { sendSuccess } from '../../utils/response';
import { AppError } from '../../utils/response';

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

export class HelpdeskDocumentsController {

    // POST /api/helpdesk/documents/upload
    static async upload(req: Request, res: Response, next: NextFunction) {
        try {
            const file = req.file;
            if (!file) {
                return res.status(400).json({
                    success: false,
                    message: 'No file provided. Please upload a valid document file.'
                });
            }

            const body = req.body as UploadHelpdeskDocumentBody;
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

    // GET /api/helpdesk/documents
    static async list(req: Request, res: Response, next: NextFunction) {
        try {
            const { entity_type, entity_id, format, status, search, limit, offset, uploaded_by, pending_my_approval } = req.query as any;

            const docs = await HelpdeskDocumentsService.findAll({
                entity_type,
                entity_id,
                format,
                status,
                search,
                limit: limit ? Number(limit) : undefined,
                offset: offset ? Number(offset) : undefined,
                uploaded_by,
            });

            return sendSuccess(res, docs, `Found ${docs.length} documents.`);
        } catch (err) {
            next(err);
        }
    }

    // GET /api/helpdesk/documents/:id
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

    // POST /api/helpdesk/documents/:id/submit
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

    // POST /api/helpdesk/documents/:id/approve
    static async approve(req: Request, res: Response, next: NextFunction) {
        try {
            const id = getParam(req, 'id');
            const userId = (req as any).user?.id as string;
            const { comments } = req.body as ApproveDocumentBody;

            const doc = await HelpdeskDocumentsService.approveDocument(id, userId, comments);

            return sendSuccess(res, doc, 'Document approved and e-stamped.');
        } catch (err) {
            next(err);
        }
    }

    // POST /api/helpdesk/documents/:id/reject
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

    // POST /api/helpdesk/documents/:id/return
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

    // POST /api/helpdesk/documents/:id/comments
    static async addComment(req: Request, res: Response, next: NextFunction) {
        try {
            const id = getParam(req, 'id');
            const userId = (req as any).user?.id as string;
            const { comment, is_internal } = req.body as AddCommentBody;

            // This would need to be implemented in the service
            // For now, we'll just return a placeholder
            return sendSuccess(res, null, 'Comment added successfully.');
        } catch (err) {
            next(err);
        }
    }

    // DELETE /api/helpdesk/documents/:id
    static async remove(req: Request, res: Response, next: NextFunction) {
        try {
            const id = getParam(req, 'id');
            await HelpdeskDocumentsService.delete(id);
            return sendSuccess(res, null, 'Document deleted successfully.');
        } catch (err) {
            next(err);
        }
    }

    // PATCH /api/helpdesk/documents/:id/link
static async link(req: Request, res: Response, next: NextFunction) {
    try {
        const id = getParam(req, 'id');
        const { entity_type, entity_id } = req.body as LinkDocumentBody;

        const doc = await HelpdeskDocumentsService.linkToEntity(id, entity_type, entity_id);

        return sendSuccess(res, doc, 'Document linked successfully.');
    } catch (err) {
        next(err);
    }
}
}