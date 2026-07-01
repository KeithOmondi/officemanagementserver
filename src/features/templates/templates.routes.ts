// src/features/templates/templates.routes.ts
import { Router } from 'express';
import { templateController } from './templates.controller';
import { uploadTemplate } from '../../middleware/upload';
import { protect, requireRole } from '../../middleware/auth.middleware';

const router = Router();
router.use(protect);

// ── Global / default templates — must come before the :departmentId routes ─
router.get('/global/:type', templateController.getGlobalActive);
router.get('/global/:type/history', requireRole('super_admin'), templateController.getGlobalHistory);
router.post(
  '/global/:type',
  requireRole('super_admin'),
  uploadTemplate,
  templateController.uploadGlobal
);

// ── Read — any authenticated user can fetch a template to compose with ─────
router.get('/', templateController.listAllGrouped);
router.get('/:departmentId', templateController.listForDepartment);
router.get('/:departmentId/:type', templateController.getActive);
router.get('/:departmentId/:type/history', requireRole('super_admin'), templateController.getHistory);

// ── Write — restrict who can set the "official" letterhead per dept ────────
router.post(
  '/:departmentId/:type',
  requireRole('super_admin', 'dept_head'),
  uploadTemplate,
  templateController.upload
);
router.delete('/:id', requireRole('super_admin'), templateController.deactivate);

export default router;