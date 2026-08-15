// src/features/stations/stations.routes.ts
import { Router } from 'express';
import { stationController } from './stations.controller';
import { protect, requireRole } from '../../middleware/auth.middleware';

const router = Router();

router.use(protect);

// ── Read (all authenticated users) ───────────────────────────────────────────

// Specific routes before the generic /:id catch-all
router.get('/active',                       stationController.getActiveStations);
router.get('/courts',                       stationController.getCourtStations);
router.get('/types',                        stationController.getStationTypes); // NEW: Get all types (predefined + custom)
router.get('/type/:type',                   stationController.getByType);
router.get('/custom-type/:customType',      stationController.getByCustomType); // NEW: Get by custom type
router.get('/check-type/:type',             stationController.checkType); // NEW: Check if type is custom
router.get('/ref/:refNo',                   stationController.getByRefNo);
router.get('/',                             stationController.getAll);
router.get('/:id',                          stationController.getById);

// ── Write (admin only) ────────────────────────────────────────────────────────
router.post('/',         requireRole('super_admin', 'dept_head'), stationController.create);
router.put('/:id',       requireRole('super_admin', 'dept_head'), stationController.update);
router.patch('/:id',     requireRole('super_admin', 'dept_head'), stationController.update);
router.delete('/:id',    requireRole('super_admin'), stationController.delete);

export default router;