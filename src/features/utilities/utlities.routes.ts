// ============================================================
// utilities.routes.ts - UPDATED with Document Sync Support
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
router.get('/memos/:id/with-document', utilitiesController.getMemoWithDocument);

// ─── Generate and manage memos ──────────────────────────────────────────────
router.post('/memos/generate', requireRole('dept_head', 'super_admin', 'staff'), utilitiesController.generateMemo);
router.post('/memos/:id/send', requireRole('dept_head', 'super_admin', 'staff'), utilitiesController.sendMemoForApproval);
router.post('/memos/:id/approve', requireRole('dept_head', 'super_admin'), utilitiesController.approveMemo);
router.post('/memos/:id/reject', requireRole('dept_head', 'super_admin'), utilitiesController.rejectMemo);
router.post('/memos/:id/cancel', requireRole('dept_head', 'super_admin', 'staff'), utilitiesController.cancelMemo);

// ============================================================
// ─── NEW: DOCUMENT SYNC ROUTES ──────────────────────────────────────────────
// ============================================================

/**
 * POST /api/utilities/sync-with-document
 * Sync utility items with document status (called by document service)
 * This is an internal webhook-like endpoint
 */
router.post(
    '/sync-with-document',
    requireRole('super_admin', 'dept_head'),
    utilitiesController.syncUtilitiesWithDocument
);

/**
 * GET /api/utilities/available-items
 * Get items available for memo generation
 * Filters by period, utility type, and excludes items with approved documents
 */
router.get('/available-items', utilitiesController.getAvailableItemsForMemo);

/**
 * GET /api/utilities/items-with-document-status
 * Get utility items filtered by document status
 * Useful for seeing which items are linked to approved/rejected documents
 */
router.get('/items-with-document-status', utilitiesController.getItemsWithDocumentStatus);

/**
 * POST /api/utilities/check-items-availability
 * Check if specific items are available for memo generation
 * Returns which items are available and why others are not
 */
router.post(
    '/check-items-availability',
    requireRole('dept_head', 'super_admin', 'staff'),
    utilitiesController.checkItemsAvailability
);

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