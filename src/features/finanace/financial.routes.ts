import { Router } from 'express';
import { financialController } from './financial.controller';
import { protect, requireRole } from '../../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(protect);

// ─── Statistics ──────────────────────────────────────────────────────────────
router.get('/stats', financialController.getStats);

// ─── Audit Log ──────────────────────────────────────────────────────────────
router.get('/audit-log', financialController.getAuditLog);

// ─── Vote Lines ──────────────────────────────────────────────────────────────
router.get('/vote-lines', financialController.getAllVoteLines);
router.get('/vote-lines/:id', financialController.getVoteLineById);
router.post('/vote-lines', requireRole(['super_admin']), financialController.createVoteLine);
router.put('/vote-lines/:id', requireRole(['super_admin']), financialController.updateVoteLine);
router.delete('/vote-lines/:id', requireRole(['super_admin']), financialController.deleteVoteLine);

// ─── Financial Activities ────────────────────────────────────────────────────
router.get('/activities', financialController.getAllActivities);
router.get('/activities/:id', financialController.getActivityById);
router.post('/activities', requireRole(['dept_head', 'super_admin']), financialController.createActivity);
router.put('/activities/:id', requireRole(['dept_head', 'super_admin']), financialController.updateActivity);
router.delete('/activities/:id', requireRole(['dept_head', 'super_admin']), financialController.deleteActivity);

// ─── Pro Bono Requests ──────────────────────────────────────────────────────
router.get('/probono', financialController.getAllProBono);
router.get('/probono/:id', financialController.getProBonoById);
router.post('/probono', requireRole(['dept_head', 'super_admin']), financialController.createProBono);
router.put('/probono/:id', requireRole(['dept_head', 'super_admin']), financialController.updateProBono);
router.delete('/probono/:id', requireRole(['dept_head', 'super_admin']), financialController.deleteProBono);

// ─── Budget Reports ──────────────────────────────────────────────────────────
router.get('/reports', financialController.getAllBudgetReports);
router.post('/reports', requireRole(['dept_head', 'super_admin']), financialController.createBudgetReport);
router.put('/reports/:id/submit', requireRole(['dept_head', 'super_admin']), financialController.submitBudgetReport);
router.put('/reports/:id/approve', requireRole(['super_admin']), financialController.approveBudgetReport);

export default router;