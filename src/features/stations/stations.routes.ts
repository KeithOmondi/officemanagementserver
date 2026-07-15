// src/features/stations/stations.routes.ts
import { Router } from 'express';
import { stationController } from './stations.controller';
import { protect, requireRole } from '../../middleware/auth.middleware';

const router = Router();

router.use(protect);

// ── Read (all authenticated users) ───────────────────────────────────────────
router.get('/',    stationController.getAll);
router.get('/:id', stationController.getById);

// ── Write (admin only) ────────────────────────────────────────────────────────
router.post('/',    requireRole('super_admin', 'dept_head'), stationController.create);
router.put('/:id',  requireRole('super_admin', 'dept_head'), stationController.update);
router.delete('/:id', requireRole('super_admin'), stationController.delete);

export default router;