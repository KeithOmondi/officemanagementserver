// src/features/registry/registry.routes.ts
import { Router } from 'express';
import { registryController } from './registry.controller';
import { protect, requireRole } from '../../middleware/auth.middleware';

const router = Router();

router.use(protect);

// ═══════════════════════════════════════════════════════════════════════════
//  REGISTRY ENTRY ROUTES
// ═══════════════════════════════════════════════════════════════════════════

// ── Dashboard / read ──────────────────────────────────────────────────────────
// Specific routes before the generic /:id catch-all.
router.get('/stations/counts',              registryController.getStationCounts);
router.get('/document/:documentId/history', registryController.getHistory);
router.get('/entries',                       registryController.getAll);
router.get('/entries/:id',                   registryController.getById);

// ── Route a document to a station ───────────────────────────────────────────
router.post('/entries', requireRole('dept_head'), registryController.routeFile);

// ── Lifecycle ─────────────────────────────────────────────────────────────────
router.post('/entries/:id/receive',  registryController.receiveFile);
// ── REMOVED: /entries/:id/file (markFiled) ──────────────────────────────────
router.post('/entries/:id/return',   requireRole('staff'), registryController.returnFile);

// ═══════════════════════════════════════════════════════════════════════════
//  FOLDER/COURT RECORD ROUTES
// ═══════════════════════════════════════════════════════════════════════════

// ── Read ──────────────────────────────────────────────────────────────────────
router.get('/folders',                      registryController.getAllFolders);
router.get('/folders/root',                 registryController.getRootFolders);
router.get('/folders/active',               registryController.getActiveFolders);
router.get('/folders/categories',           registryController.getFolderCategories);
router.get('/folders/search',               registryController.searchFolders);
router.get('/folders/statistics',           registryController.getFolderStatistics);
router.get('/folders/:id',                  registryController.getFolderById);
router.get('/folders/:id/children',         registryController.getFolderChildren);
router.get('/folders/:id/hierarchy',        registryController.getFolderHierarchy);
router.get('/folders/:id/documents',        registryController.getFolderDocuments);

// ── Create ────────────────────────────────────────────────────────────────────
router.post('/folders', requireRole('dept_head'), registryController.createFolder);

// ── Update ────────────────────────────────────────────────────────────────────
router.put('/folders/:id', requireRole('dept_head'), registryController.updateFolder);
router.patch('/folders/:id', requireRole('dept_head'), registryController.updateFolder);

// ── Delete ────────────────────────────────────────────────────────────────────
router.delete('/folders/:id', requireRole('super_admin'), registryController.deleteFolder);

// ── Folder Operations ────────────────────────────────────────────────────────
router.post('/folders/:id/move', requireRole('dept_head'), registryController.moveFolder);
router.post('/folders/:id/documents', requireRole('dept_head'), registryController.addDocumentToFolder);
router.delete('/folders/:id/documents/:documentId', requireRole('dept_head'), registryController.removeDocumentFromFolder);
router.post('/folders/:id/documents/bulk', requireRole('dept_head'), registryController.bulkAddDocumentsToFolder);

export default router;