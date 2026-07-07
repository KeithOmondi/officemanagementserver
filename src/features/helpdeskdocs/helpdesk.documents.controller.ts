// src/features/helpdesk/helpdesk.documents.controller.ts

import { Request, Response, NextFunction } from 'express';
import { HelpdeskDocumentsService }         from './helpdesk.documents.service';
import type { UploadHelpdeskDocumentBody }  from './helpdesk.documents.schema';
import { sendSuccess } from '../../utils/response';



function getParam(req: Request, key: string): string {
    const value = req.params[key];
    if (Array.isArray(value)) {
        throw new Error(`Parameter ${key} must be a string`);
    }
    return value;
}

export class HelpdeskDocumentsController {

    // POST /api/helpdesk/documents/upload
    static async upload(req: Request, res: Response, next: NextFunction) {
        try {
            const file = req.file;
            if (!file) {
                return res.status(400).json({ message: 'No file provided.' });
            }

            const body  = req.body as UploadHelpdeskDocumentBody;
            const userId = (req as any).user?.id as string;

            const doc = await HelpdeskDocumentsService.upload(file, body, userId);
            return sendSuccess(res, doc, 'Document saved successfully.', 201);
        } catch (err) {
            next(err);
        }
    }

    // GET /api/helpdesk/documents
    static async list(req: Request, res: Response, next: NextFunction) {
        try {
            const { entity_type, entity_id, format, search, limit, offset } = req.query as any;
            const docs = await HelpdeskDocumentsService.findAll({
                entity_type,
                entity_id,
                format,
                search,
                limit:  limit  ? Number(limit)  : undefined,
                offset: offset ? Number(offset) : undefined,
            });
            return sendSuccess(res, docs);
        } catch (err) {
            next(err);
        }
    }

    // DELETE /api/helpdesk/documents/:id
    static async remove(req: Request, res: Response, next: NextFunction) {
    try {
        const id = getParam(req, 'id');
        await HelpdeskDocumentsService.delete(id);
        return sendSuccess(res, null, 'Document deleted.');
    } catch (err) {
        next(err);
    }
}
}