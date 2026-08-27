// src/features/registry/registry.controller.ts

import { Request, Response, NextFunction } from 'express';
import { RegistryService } from './registry.service';
import { AppError, sendSuccess } from '../../utils/response';
import {
    CreateRegistryFolderBody,
    GetFolderChildrenQuery,
    GetFolderDocumentsQuery,
    ListRegistryFoldersQuery,
    UpdateRegistryFolderBody,
    MoveDocumentToFolderBody,
    AddDocumentToFolderBody,
    BulkAddDocumentsToFolderBody,
    MoveFolderBody,
} from './registry.schema';

function getParam(req: Request, key: string): string {
    const value = req.params[key];
    if (Array.isArray(value)) throw new AppError(400, `Parameter ${key} must be a string`);
    if (!value) throw new AppError(400, `Parameter ${key} is required`);
    return value;
}

export class RegistryController {

// src/features/registry/registry.controller.ts

static async createFolder(req: Request, res: Response, next: NextFunction) {
    try {
        const body = req.body as CreateRegistryFolderBody;
        const userId = (req as any).user?.id as string;
        if (!userId) return res.status(401).json({ success: false, message: 'User not authenticated' });
        
        // Convert null to undefined for parent_folder_id
        const createInput = {
            ...body,
            parent_folder_id: body.parent_folder_id === null ? undefined : body.parent_folder_id,
        };
        
        const folder = await RegistryService.createFolder(createInput, userId);
        return sendSuccess(res, folder, 'Folder created successfully.', 201);
    } catch (err) { next(err); }
}

    static async listFolders(req: Request, res: Response, next: NextFunction) {
        try {
            const query = req.query as unknown as ListRegistryFoldersQuery;
            const folders = await RegistryService.findAll({
                search: query.search,
                category: query.category,
                status: query.status,
                parent_folder_id: query.parent_folder_id === null ? undefined : query.parent_folder_id,
                department_id: query.department_id,
                limit: query.limit,
                offset: query.offset,
                include_sub_folders: query.include_sub_folders,
            });
            return sendSuccess(res, folders, `Found ${folders.length} folders.`);
        } catch (err) { next(err); }
    }

    static async getFolderById(req: Request, res: Response, next: NextFunction) {
        try {
            const id = getParam(req, 'id');
            const folder = await RegistryService.findById(id);
            if (!folder) throw new AppError(404, 'Folder not found');
            return sendSuccess(res, folder);
        } catch (err) { next(err); }
    }

    static async getFolderChildren(req: Request, res: Response, next: NextFunction) {
        try {
            const id = getParam(req, 'id');
            const { limit, offset } = req.query as unknown as GetFolderChildrenQuery;
            const children = await RegistryService.getChildren(id, limit, offset);
            return sendSuccess(res, children, `Found ${children.length} sub-folders.`);
        } catch (err) { next(err); }
    }

    static async getFolderHierarchy(req: Request, res: Response, next: NextFunction) {
        try {
            const id = getParam(req, 'id');
            const hierarchy = await RegistryService.getHierarchy(id);
            return sendSuccess(res, hierarchy);
        } catch (err) { next(err); }
    }

    static async updateFolder(req: Request, res: Response, next: NextFunction) {
        try {
            const id = getParam(req, 'id');
            const body = req.body as UpdateRegistryFolderBody;
            const userId = (req as any).user?.id as string;
            if (!userId) return res.status(401).json({ success: false, message: 'User not authenticated' });
            const folder = await RegistryService.updateFolder(id, body, userId);
            return sendSuccess(res, folder, 'Folder updated successfully.');
        } catch (err) { next(err); }
    }

    static async deleteFolder(req: Request, res: Response, next: NextFunction) {
        try {
            const id = getParam(req, 'id');
            const userId = (req as any).user?.id as string;
            if (!userId) return res.status(401).json({ success: false, message: 'User not authenticated' });
            await RegistryService.deleteFolder(id, userId);
            return sendSuccess(res, null, 'Folder deleted successfully.');
        } catch (err) { next(err); }
    }

    static async getCategories(req: Request, res: Response, next: NextFunction) {
        try {
            const categories = await RegistryService.getCategoriesWithCounts();
            return sendSuccess(res, categories);
        } catch (err) { next(err); }
    }

    static async getFolderDocuments(req: Request, res: Response, next: NextFunction) {
        try {
            const id = getParam(req, 'id');
            const { limit, offset } = req.query as unknown as GetFolderDocumentsQuery;
            const documents = await RegistryService.getFolderDocuments(id, limit, offset);
            return sendSuccess(res, documents, `Found ${documents.length} documents.`);
        } catch (err) { next(err); }
    }

    static async searchFolders(req: Request, res: Response, next: NextFunction) {
        try {
            const { q } = req.query;
            if (!q || typeof q !== 'string' || q.length < 2) throw new AppError(400, 'Search query must be at least 2 characters');
            const folders = await RegistryService.searchFolders(q);
            return sendSuccess(res, folders, `Found ${folders.length} folders.`);
        } catch (err) { next(err); }
    }

    static async getRootFolders(req: Request, res: Response, next: NextFunction) {
        try {
            const folders = await RegistryService.getRootFolders();
            return sendSuccess(res, folders, `Found ${folders.length} root folders.`);
        } catch (err) { next(err); }
    }

    static async getActiveFolders(req: Request, res: Response, next: NextFunction) {
        try {
            const { limit, offset } = req.query;
            const folders = await RegistryService.getActiveFolders(
                limit ? parseInt(limit as string) : undefined,
                offset ? parseInt(offset as string) : undefined
            );
            return sendSuccess(res, folders, `Found ${folders.length} active folders.`);
        } catch (err) { next(err); }
    }

    static async getFolderStatistics(req: Request, res: Response, next: NextFunction) {
        try {
            const { include_document_stats } = req.query;
            const stats = await RegistryService.getFolderStatistics({
                include_document_stats: include_document_stats === 'true',
            });
            return sendSuccess(res, stats);
        } catch (err) { next(err); }
    }

    static async addDocumentToFolder(req: Request, res: Response, next: NextFunction) {
        try {
            const folderId = getParam(req, 'id');
            const { document_id } = req.body as AddDocumentToFolderBody;
            const userId = (req as any).user?.id as string;
            if (!userId) return res.status(401).json({ success: false, message: 'User not authenticated' });
            if (!document_id) throw new AppError(400, 'document_id is required');
            const document = await RegistryService.addDocumentToFolder(folderId, document_id, userId);
            return sendSuccess(res, document, 'Document added to folder successfully.');
        } catch (err) { next(err); }
    }

    static async removeDocumentFromFolder(req: Request, res: Response, next: NextFunction) {
        try {
            const folderId = getParam(req, 'id');
            const documentId = getParam(req, 'documentId');
            const userId = (req as any).user?.id as string;
            if (!userId) return res.status(401).json({ success: false, message: 'User not authenticated' });
            await RegistryService.removeDocumentFromFolder(folderId, documentId, userId);
            return sendSuccess(res, null, 'Document removed from folder successfully.');
        } catch (err) { next(err); }
    }

    static async bulkAddDocumentsToFolder(req: Request, res: Response, next: NextFunction) {
        try {
            const folderId = getParam(req, 'id');
            const { document_ids } = req.body as BulkAddDocumentsToFolderBody;
            const userId = (req as any).user?.id as string;
            if (!userId) return res.status(401).json({ success: false, message: 'User not authenticated' });
            if (!document_ids || !Array.isArray(document_ids) || document_ids.length === 0) {
                throw new AppError(400, 'document_ids array is required and must not be empty');
            }
            const result = await RegistryService.bulkAddDocumentsToFolder(folderId, document_ids, userId);
            return sendSuccess(res, result, `${result.added} documents added to folder successfully.`);
        } catch (err) { next(err); }
    }

    static async moveFolder(req: Request, res: Response, next: NextFunction) {
        try {
            const id = getParam(req, 'id');
            const { parent_folder_id } = req.body as MoveFolderBody;
            const userId = (req as any).user?.id as string;
            if (!userId) return res.status(401).json({ success: false, message: 'User not authenticated' });
            const folder = await RegistryService.moveFolder(id, parent_folder_id, userId);
            return sendSuccess(res, folder, 'Folder moved successfully.');
        } catch (err) { next(err); }
    }

    static async moveDocumentToFolder(req: Request, res: Response, next: NextFunction) {
        try {
            const sourceFolderId = getParam(req, 'id');
            const documentId = getParam(req, 'documentId');
            const { target_folder_id } = req.body as MoveDocumentToFolderBody;
            const userId = (req as any).user?.id as string;
            if (!userId) return res.status(401).json({ success: false, message: 'User not authenticated' });
            if (!target_folder_id) throw new AppError(400, 'target_folder_id is required');
            const result = await RegistryService.moveDocumentToFolder(sourceFolderId, documentId, target_folder_id, userId);
            return sendSuccess(res, result, 'Document moved successfully.');
        } catch (err) { next(err); }
    }
}