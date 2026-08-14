// ============================================================
// src/features/succession-courts/succession-courts.routes.ts
// ============================================================

import { Router } from 'express';
import { successionCourtController } from './succession-courts.controller';
import { protect, requireRole } from '../../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(protect);

// ─── Read-only routes (authenticated users) ──────────────────────────────
router.get('/', successionCourtController.getAll);
router.get('/categories', successionCourtController.getByCategory);
router.get('/categories/with-support', successionCourtController.getByCategoryWithSupport);
router.get('/with-support', successionCourtController.getWithSupportPersons);
router.get('/available-support-persons', successionCourtController.getAvailableSupportPersons);
router.get('/support-person-assignments', successionCourtController.getSupportPersonAssignments);
router.get('/:id', successionCourtController.getById);
router.get('/:id/with-user', successionCourtController.getByIdWithUser);

// ─── Write routes (super_admin only) ─────────────────────────────────────
router.post('/', requireRole('super_admin'), successionCourtController.create);
router.put('/:id', requireRole('super_admin'), successionCourtController.update);
router.delete('/:id', requireRole('super_admin'), successionCourtController.delete);

// ─── Support Person Assignment Routes (super_admin only) ────────────────
// Single court assignment
router.post('/:id/assign-support', requireRole('super_admin'), successionCourtController.assignSupportPerson);
router.post('/:id/remove-support', requireRole('super_admin'), successionCourtController.removeSupportPerson);

// Bulk assignment
router.post('/bulk-assign-support', requireRole('super_admin'), successionCourtController.bulkAssignSupportPerson);
router.post('/bulk-remove-support', requireRole('super_admin'), successionCourtController.bulkRemoveSupportPerson);

// ─── NEW: Bulk Assignment by Category (super_admin only) ─────────────────
router.post('/assign-by-category', requireRole('super_admin'), successionCourtController.assignSupportPersonByCategory);

// ─── NEW: Bulk Assignment by Station (super_admin only) ──────────────────
router.post('/assign-by-station', requireRole('super_admin'), successionCourtController.assignSupportPersonByStation);

// ─── NEW: Reassign Support Person (super_admin only) ─────────────────────
router.post('/reassign', requireRole('super_admin'), successionCourtController.reassignSupportPerson);

export default router;