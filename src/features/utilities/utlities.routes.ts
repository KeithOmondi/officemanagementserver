// ============================================================
// utilities.routes.ts - UPDATED with Memo Support
// ============================================================

import { Router } from 'express';
import { protect, requireRole } from '../../middleware/auth.middleware';
import { utilitiesController } from './utilities,controller';

const router = Router();

// All routes require authentication
router.use(protect);

// ============================================================
// JUDGE UTILITIES
// ============================================================

// ─── Get utilities ────────────────────────────────────────────────────────────
router.get('/', utilitiesController.getAllUtilities);
router.get('/:id', utilitiesController.getUtilityById);
router.get('/by-pj/:pjNumber', utilitiesController.getUtilityByPjNumber);

// ─── Create utilities ─────────────────────────────────────────────────────────
router.post('/', requireRole('dept_head', 'super_admin', 'staff'), utilitiesController.createUtility);
router.post('/items', requireRole('dept_head', 'super_admin', 'staff'), utilitiesController.addUtilityItem);

// ─── Update utilities ─────────────────────────────────────────────────────────
router.put('/:id', requireRole('dept_head', 'super_admin', 'staff'), utilitiesController.updateUtility);
router.put('/:id/items/:itemId', requireRole('dept_head', 'super_admin', 'staff'), utilitiesController.updateUtilityItem);

// ─── Delete utilities ─────────────────────────────────────────────────────────
router.delete('/:id/items/:itemId', requireRole('super_admin'), utilitiesController.deleteUtilityItem);
router.delete('/:id', requireRole('super_admin', 'dept_head', 'staff'), utilitiesController.deleteUtility);

// ============================================================
// CONSOLIDATED MEMOS
// ============================================================

// ─── Get memos ────────────────────────────────────────────────────────────────
router.get('/memos', utilitiesController.getAllMemos);
router.get('/memos/:id', utilitiesController.getMemoById);
router.get('/memos/entity/:entityId', utilitiesController.getMemoByEntityId);

// ─── Generate and manage memos ──────────────────────────────────────────────
router.post('/memos/generate', requireRole('dept_head', 'super_admin', 'staff'), utilitiesController.generateMemo);
router.post('/memos/:id/send', requireRole('dept_head', 'super_admin', 'staff'), utilitiesController.sendMemoForApproval);
router.post('/memos/:id/approve', requireRole('dept_head', 'super_admin'), utilitiesController.approveMemo);
router.post('/memos/:id/reject', requireRole('dept_head', 'super_admin'), utilitiesController.rejectMemo);
router.post('/memos/:id/cancel', requireRole('dept_head', 'super_admin', 'staff'), utilitiesController.cancelMemo);

// ============================================================
// UTILITY QUERY HELPERS
// ============================================================

// ─── Get utilities by status ─────────────────────────────────────────────────
router.get('/pending', utilitiesController.getPendingUtilities);
router.get('/by-approval-status/:status', utilitiesController.getUtilitiesByApprovalStatus);

// ─── Get available periods and summary ──────────────────────────────────────
router.get('/available-periods', utilitiesController.getAvailablePeriods);
router.get('/summary', utilitiesController.getUtilitySummary);
router.get('/stats', utilitiesController.getUtilityStats);

// ─── Bulk operations ─────────────────────────────────────────────────────────
router.post('/bulk-update', requireRole('dept_head', 'super_admin', 'staff'), utilitiesController.bulkUpdateUtilityItems);

// ─── Enums reference ─────────────────────────────────────────────────────────
router.get('/enums', utilitiesController.getUtilityEnums);

// ============================================================
// LEGACY ROUTES (for backward compatibility)
// ============================================================

// ─── Deprecated: These routes are kept for backward compatibility ──────────
// They will be removed in a future version

/**
 * @deprecated Use GET /utilities instead
 */
router.get('/all', utilitiesController.getAllUtilities);

/**
 * @deprecated Use GET /utilities/:id instead
 */
router.get('/find/:id', utilitiesController.getUtilityById);

/**
 * @deprecated Use GET /utilities/by-pj/:pjNumber instead
 */
router.get('/pj/:pjNumber', utilitiesController.getUtilityByPjNumber);

export default router;