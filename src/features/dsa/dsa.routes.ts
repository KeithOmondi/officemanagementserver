// src/features/dsa/dsa.routes.ts
import { Router } from 'express';
import { dsaController } from './dsa.controller';
import { protect, requireRole } from '../../middleware/auth.middleware';

const router = Router();

router.use(protect);

// ── Stats & equity (specific paths MUST come before /:id) ────────────────────
router.get('/stats',  dsaController.getStats);
router.get('/equity', dsaController.getEquitySuggestions);
router.get('/export', requireRole(['dept_head', 'super_admin']), dsaController.exportCsv);

// ── Activity CRUD ─────────────────────────────────────────────────────────────
router.get('/',    dsaController.getAllActivities);
router.get('/:id', dsaController.getActivityById);
router.post('/',   requireRole(['dept_head', 'super_admin']), dsaController.createActivity);
router.put('/:id', requireRole(['dept_head', 'super_admin']), dsaController.updateActivity);
router.delete('/:id', requireRole(['dept_head', 'super_admin']), dsaController.deleteActivity);

// ── Staff entries ─────────────────────────────────────────────────────────────
router.get('/:id/entries',          dsaController.getEntries);
router.post('/:id/entries',         requireRole(['dept_head', 'super_admin']), dsaController.addEntry);
router.put('/:id/entries/:entryId', requireRole(['dept_head', 'super_admin']), dsaController.updateEntry);
router.delete('/:id/entries/:entryId', requireRole(['dept_head', 'super_admin']), dsaController.removeEntry);

export default router;