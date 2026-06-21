// src/features/registry/registry.routes.ts
import { Router } from 'express';
import { registryController } from './registry.controller';
import { protect, requireRole } from '../../middleware/auth.middleware';

const router = Router();

router.use(protect);

// ── Dashboard / read ──────────────────────────────────────────────────────────
// Specific routes before the generic /:id catch-all.
router.get('/stations/counts',              registryController.getStationCounts);
router.get('/document/:documentId/history', registryController.getHistory);
router.get('/',                              registryController.getAll);
router.get('/:id',                           registryController.getById);

// ── Route a document to a station ───────────────────────────────────────────
router.post('/', requireRole('dept_head'), registryController.routeFile);

// ── Lifecycle ─────────────────────────────────────────────────────────────────
router.post('/:id/receive',  registryController.receiveFile);
router.post('/:id/file',    registryController.markFiled);
router.post('/:id/return',  requireRole('staff'), registryController.returnFile);

export default router;