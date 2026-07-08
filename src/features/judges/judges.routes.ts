// src/features/judges/judges.routes.ts

import { Router } from 'express';
import { judgesController } from './judges.controller';
import { protect, requireRole } from '../../middleware/auth.middleware';

const router = Router();

// ── All routes require authentication ──────────────────────────────────────
router.use(protect);

// ── Public read routes (any authenticated user) ────────────────────────────
router.get('/', judgesController.getAll);
router.get('/stats', judgesController.getStats);
router.get('/search', judgesController.search);
router.get('/pj/:pj_number', judgesController.getByPJNumber);
router.get('/:id', judgesController.getById);

// ── Protected write routes (Super Admin and Registrar only) ──────────────
router.post('/', requireRole('super_admin', 'dept_head'), judgesController.create);
router.put('/:id', requireRole('super_admin', 'dept_head'), judgesController.update);
router.delete('/:id', requireRole('super_admin', 'dept_head'), judgesController.delete);

export default router;