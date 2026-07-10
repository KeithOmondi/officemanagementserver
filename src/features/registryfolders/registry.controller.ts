// src/features/registry/registry.controller.ts

import { Request, Response, NextFunction } from 'express';
import { RegistryService } from './registry.service';
import { AppError, sendSuccess } from '../../utils/response';
import { 
    CreateRegistryFolderBody, 
    GetFolderChildrenQuery, 
    GetFolderDocumentsQuery, 
    ListRegistryFoldersQuery, 
    UpdateRegistryFolderBody 
} from './registry.schema';

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

export class RegistryController {

    // ── POST /api/rhc/folders ──────────────────────────────────────────────
    static async createFolder(req: Request, res: Response, next: NextFunction) {
        try {
            const body = req.body as CreateRegistryFolderBody;
            const userId = (req as any).user?.id as string;

            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: 'User not authenticated',
                });
            }

            // Convert null to undefined for parent_folder_id
            const createInput = {
                ...body,
                parent_folder_id: body.parent_folder_id === null ? undefined : body.parent_folder_id,
            };

            const folder = await RegistryService.createFolder(createInput, userId);

            console.log(`📁 RHC Folder created:`, {
                id: folder.id,
                ref_no: folder.ref_no,
                name: folder.name,
                category: folder.category,
                userId,
            });

            return sendSuccess(res, folder, 'Folder created successfully.', 201);
        } catch (err) {
            next(err);
        }
    }

    // ── GET /api/rhc/folders ───────────────────────────────────────────────
    static async listFolders(req: Request, res: Response, next: NextFunction) {
        try {
            const query = req.query as unknown as ListRegistryFoldersQuery;

            // Convert null to undefined for parent_folder_id
            const parentFolderId = query.parent_folder_id === null 
                ? undefined 
                : query.parent_folder_id;

            const folders = await RegistryService.findAll({
                search: query.search,
                category: query.category,
                status: query.status,
                parent_folder_id: parentFolderId,
                department_id: query.department_id,
                limit: query.limit,
                offset: query.offset,
                include_sub_folders: query.include_sub_folders,
            });

            return sendSuccess(res, folders, `Found ${folders.length} folders.`);
        } catch (err) {
            next(err);
        }
    }

    // ── GET /api/rhc/folders/:id ───────────────────────────────────────────
    static async getFolderById(req: Request, res: Response, next: NextFunction) {
        try {
            const id = getParam(req, 'id');

            const folder = await RegistryService.findById(id);
            if (!folder) {
                throw new AppError(404, 'Folder not found');
            }

            return sendSuccess(res, folder);
        } catch (err) {
            next(err);
        }
    }

    // ── GET /api/rhc/folders/:id/children ──────────────────────────────────
    static async getFolderChildren(req: Request, res: Response, next: NextFunction) {
        try {
            const id = getParam(req, 'id');
            const { limit, offset } = req.query as unknown as GetFolderChildrenQuery;

            const children = await RegistryService.getChildren(id, limit, offset);

            return sendSuccess(res, children, `Found ${children.length} sub-folders.`);
        } catch (err) {
            next(err);
        }
    }

    // ── GET /api/rhc/folders/:id/hierarchy ─────────────────────────────────
    static async getFolderHierarchy(req: Request, res: Response, next: NextFunction) {
        try {
            const id = getParam(req, 'id');

            const hierarchy = await RegistryService.getHierarchy(id);

            return sendSuccess(res, hierarchy);
        } catch (err) {
            next(err);
        }
    }

    // ── PUT /api/rhc/folders/:id ───────────────────────────────────────────
    static async updateFolder(req: Request, res: Response, next: NextFunction) {
        try {
            const id = getParam(req, 'id');
            const body = req.body as UpdateRegistryFolderBody;
            const userId = (req as any).user?.id as string;

            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: 'User not authenticated',
                });
            }

            const folder = await RegistryService.updateFolder(id, body, userId);

            console.log(`📁 RHC Folder updated:`, {
                id: folder.id,
                ref_no: folder.ref_no,
                name: folder.name,
                userId,
            });

            return sendSuccess(res, folder, 'Folder updated successfully.');
        } catch (err) {
            next(err);
        }
    }

    // ── DELETE /api/rhc/folders/:id ────────────────────────────────────────
    static async deleteFolder(req: Request, res: Response, next: NextFunction) {
        try {
            const id = getParam(req, 'id');
            const userId = (req as any).user?.id as string;

            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: 'User not authenticated',
                });
            }

            await RegistryService.deleteFolder(id, userId);

            console.log(`📁 RHC Folder deleted:`, { id, userId });

            return sendSuccess(res, null, 'Folder deleted successfully.');
        } catch (err) {
            next(err);
        }
    }

    // ── GET /api/rhc/folders/categories ────────────────────────────────────
    static async getCategories(req: Request, res: Response, next: NextFunction) {
        try {
            const categories = await RegistryService.getCategoriesWithCounts();

            return sendSuccess(res, categories);
        } catch (err) {
            next(err);
        }
    }

    // ── GET /api/rhc/folders/:id/documents ─────────────────────────────────
    static async getFolderDocuments(req: Request, res: Response, next: NextFunction) {
        try {
            const id = getParam(req, 'id');
            const { limit, offset } = req.query as unknown as GetFolderDocumentsQuery;

            const documents = await RegistryService.getFolderDocuments(id, limit, offset);

            return sendSuccess(res, documents, `Found ${documents.length} documents.`);
        } catch (err) {
            next(err);
        }
    }

    // ── GET /api/rhc/folders/search ────────────────────────────────────────
    static async searchFolders(req: Request, res: Response, next: NextFunction) {
        try {
            const { q } = req.query;

            if (!q || typeof q !== 'string' || q.length < 2) {
                throw new AppError(400, 'Search query must be at least 2 characters');
            }

            const folders = await RegistryService.searchFolders(q);

            return sendSuccess(res, folders, `Found ${folders.length} folders.`);
        } catch (err) {
            next(err);
        }
    }
}