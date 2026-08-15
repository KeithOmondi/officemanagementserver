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
// Specific routes before the generic /:id catch-all
router.get('/stations/counts',              registryController.getStationCounts);
router.get('/document/:documentId/history', registryController.getHistory);
router.get('/entries',                      registryController.getAll);
router.get('/entries/:id',                  registryController.getById);

// ── Route a document to a station ───────────────────────────────────────────
router.post('/entries', requireRole('dept_head'), registryController.routeFile);

// ── Lifecycle ─────────────────────────────────────────────────────────────────
// Note: Order matters here - /entries/:id/receive and /entries/:id/return
// should come before any generic /entries/:id routes (if any existed)
router.post('/entries/:id/receive',  registryController.receiveFile);
router.post('/entries/:id/return',   requireRole('staff'), registryController.returnFile);

// ═══════════════════════════════════════════════════════════════════════════
//  FOLDER/COURT RECORD ROUTES
// ═══════════════════════════════════════════════════════════════════════════

// ── Read ──────────────────────────────────────────────────────────────────────
// Specific routes before the generic /:id catch-all
router.get('/folders/search',               registryController.searchFolders);
router.get('/folders/root',                 registryController.getRootFolders);
router.get('/folders/active',               registryController.getActiveFolders);
router.get('/folders/categories',           registryController.getFolderCategories);
router.get('/folders/statistics',           registryController.getFolderStatistics);

// ── NEW: Get folder documents by station ─────────────────────────────────────
router.get('/folders/station/:stationId',   registryController.getStationFolderDocuments);

router.get('/folders',                      registryController.getAllFolders);
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
// Note: These should come after the specific folder routes but before
// any generic /folders/:id routes (if they existed)
router.post('/folders/:id/move', requireRole('dept_head'), registryController.moveFolder);
router.post('/folders/:id/documents/bulk', requireRole('dept_head'), registryController.bulkAddDocumentsToFolder);
router.post('/folders/:id/documents', requireRole('dept_head'), registryController.addDocumentToFolder);
router.delete('/folders/:id/documents/:documentId', requireRole('dept_head'), registryController.removeDocumentFromFolder);

export default router;