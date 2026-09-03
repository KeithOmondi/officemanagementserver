// src/features/registry/registry.routes.ts
import { Router } from 'express';
import { registryController } from './registry.controller';
import { protect, requireRole } from '../../middleware/auth.middleware';
import { upload } from '../../middleware/upload';

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

// ── Direct Upload Routes ─────────────────────────────────────────────────────
// These must come before the generic /entries routes

// Single file upload to a station
router.post(
  '/upload/direct',
  requireRole('staff'),
  upload.single('file'),
  registryController.directUpload
);

// Bulk file upload to a station
router.post(
  '/upload/bulk',
  requireRole('staff'),
  upload.array('files', 10), // Max 10 files
  registryController.bulkDirectUpload
);

// Upload document to a specific folder
router.post(
  '/folders/:id/upload',
  requireRole('staff'),
  upload.single('file'),
  registryController.uploadDocumentToFolder
);

// ── Document Management Routes ──────────────────────────────────────────────
// These must come before the /entries/:id routes

// Get document details with history
router.get('/documents/:documentId', registryController.getDocumentDetails);

// Update document metadata
router.patch(
  '/documents/:documentId',
  requireRole('staff'),
  registryController.updateDocumentMetadata
);

// Delete document (soft delete or hard delete with Cloudinary)
router.delete(
  '/documents/:documentId',
  requireRole('dept_head'),
  registryController.deleteDocument
);

// Get documents by source (routed vs direct)
router.get('/documents/source/:source', registryController.getDocumentsBySource);

// ── Route a document to a station ───────────────────────────────────────────
router.post('/entries', requireRole('dept_head'), registryController.routeFile);

// ── Lifecycle ─────────────────────────────────────────────────────────────────
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

// Get folder documents by station
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
router.post('/folders/:id/move', requireRole('dept_head'), registryController.moveFolder);
router.post('/folders/:id/documents/bulk', requireRole('dept_head'), registryController.bulkAddDocumentsToFolder);
router.post('/folders/:id/documents', requireRole('dept_head'), registryController.addDocumentToFolder);
router.delete('/folders/:id/documents/:documentId', requireRole('dept_head'), registryController.removeDocumentFromFolder);

export default router;