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
    moveDocumentToFolderSchema,
    addDocumentToFolderSchema,
    removeDocumentFromFolderSchema,
    bulkAddDocumentsToFolderSchema,
    searchRegistryFoldersSchema,
    getRootFoldersSchema,
    getActiveFoldersSchema,
    getFolderHierarchySchema,
    getFolderStatisticsSchema,
    moveFolderSchema,
} from './registry.schema';
import { protect, requireRole } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';

const router = Router();

router.use(protect);

router.post('/folders', requireRole('super_admin', 'dept_head'), validate(createRegistryFolderSchema), RegistryController.createFolder);
router.get('/folders', validate(listRegistryFoldersSchema), RegistryController.listFolders);
router.get('/folders/categories', validate(getRegistryCategoriesSchema), RegistryController.getCategories);
router.get('/folders/search', validate(searchRegistryFoldersSchema), RegistryController.searchFolders);
router.get('/folders/root', validate(getRootFoldersSchema), RegistryController.getRootFolders);
router.get('/folders/active', validate(getActiveFoldersSchema), RegistryController.getActiveFolders);
router.get('/folders/statistics', validate(getFolderStatisticsSchema), RegistryController.getFolderStatistics);
router.get('/folders/:id', validate(getRegistryFolderSchema), RegistryController.getFolderById);
router.get('/folders/:id/children', validate(getRegistryFolderChildrenSchema), RegistryController.getFolderChildren);
router.get('/folders/:id/hierarchy', validate(getFolderHierarchySchema), RegistryController.getFolderHierarchy);
router.get('/folders/:id/documents', validate(getFolderDocumentsSchema), RegistryController.getFolderDocuments);
router.put('/folders/:id', requireRole('super_admin', 'dept_head'), validate(updateRegistryFolderSchema), RegistryController.updateFolder);
router.delete('/folders/:id', requireRole('super_admin', 'dept_head'), validate(deleteRegistryFolderSchema), RegistryController.deleteFolder);
router.post('/folders/:id/documents', requireRole('super_admin', 'dept_head'), validate(addDocumentToFolderSchema), RegistryController.addDocumentToFolder);
router.delete('/folders/:id/documents/:documentId', requireRole('super_admin', 'dept_head'), validate(removeDocumentFromFolderSchema), RegistryController.removeDocumentFromFolder);
router.post('/folders/:id/documents/bulk', requireRole('super_admin', 'dept_head'), validate(bulkAddDocumentsToFolderSchema), RegistryController.bulkAddDocumentsToFolder);
router.post('/folders/:id/move', requireRole('super_admin', 'dept_head'), validate(moveFolderSchema), RegistryController.moveFolder);
router.post('/folders/:id/documents/:documentId/move', requireRole('super_admin', 'dept_head'), validate(moveDocumentToFolderSchema), RegistryController.moveDocumentToFolder);

export default router;