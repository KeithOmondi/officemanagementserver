// src/features/registry/registry.routes.ts

import { Router } from 'express';
import { RegistryController } from './registry.controller';
import {
    createRegistryFolderSchema,
    updateRegistryFolderSchema,
    listRegistryFoldersSchema,
    getRegistryFolderSchema,
    getRegistryFolderChildrenSchema,
    getRegistryCategoriesSchema,
    getFolderDocumentsSchema,
    deleteRegistryFolderSchema,
} from './registry.schema';
import { protect, requireRole } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';

const router = Router();

// All routes require authentication
router.use(protect);

// ── POST /api/registry/folders ──────────────────────────────────────────────
router.post(
    '/folders',
    requireRole('super_admin', 'dept_head'),
    validate(createRegistryFolderSchema),
    RegistryController.createFolder
);

// ── GET /api/registry/folders ───────────────────────────────────────────────
router.get(
    '/folders',
    validate(listRegistryFoldersSchema),
    RegistryController.listFolders
);

// ── GET /api/registry/folders/categories ────────────────────────────────────
router.get(
    '/folders/categories',
    validate(getRegistryCategoriesSchema),
    RegistryController.getCategories
);

// ── GET /api/registry/folders/search ────────────────────────────────────────
router.get(
    '/folders/search',
    RegistryController.searchFolders
);

// ── GET /api/registry/folders/:id ───────────────────────────────────────────
router.get(
    '/folders/:id',
    validate(getRegistryFolderSchema),
    RegistryController.getFolderById
);

// ── GET /api/registry/folders/:id/children ──────────────────────────────────
router.get(
    '/folders/:id/children',
    validate(getRegistryFolderChildrenSchema),
    RegistryController.getFolderChildren
);

// ── GET /api/registry/folders/:id/hierarchy ─────────────────────────────────
router.get(
    '/folders/:id/hierarchy',
    validate(getRegistryFolderSchema),
    RegistryController.getFolderHierarchy
);

// ── GET /api/registry/folders/:id/documents ─────────────────────────────────
router.get(
    '/folders/:id/documents',
    validate(getFolderDocumentsSchema),
    RegistryController.getFolderDocuments
);

// ── PUT /api/registry/folders/:id ───────────────────────────────────────────
router.put(
    '/folders/:id',
    requireRole('super_admin', 'dept_head'),
    validate(updateRegistryFolderSchema),
    RegistryController.updateFolder
);

// ── DELETE /api/registry/folders/:id ────────────────────────────────────────
router.delete(
    '/folders/:id',
    requireRole('super_admin'),
    validate(deleteRegistryFolderSchema),
    RegistryController.deleteFolder
);

export default router;