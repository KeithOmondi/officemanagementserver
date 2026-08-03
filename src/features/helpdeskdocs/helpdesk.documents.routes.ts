// src/features/helpdesk/helpdesk.documents.routes.ts

import { Router } from 'express';
import {
    HelpdeskDocumentsController,
    sanitizeFormDataBody,
    sanitizeBatchFormDataBody,
} from './helpdesk.documents.controller';
import { upload } from '../../middleware/upload';
import {
    uploadHelpdeskDocumentSchema,
    listHelpdeskDocumentsSchema,
    getDocumentByIdSchema,
    updateDocumentFileSchema,
    submitDocumentForApprovalSchema,
    addCommentSchema,
    documentIdSchema,
    linkDocumentSchema,
    bulkLinkDocumentsSchema,
    bulkUpdateStatusSchema,
    batchUploadSchema,
    deleteCommentSchema,
    getDocumentsByEntitySchema,
    // ─── Two-step approval schemas ──────────────────────────────────────────
    internalPreviewDocumentSchema,
    internalApproveDocumentSchema,
    internalRejectDocumentSchema,
    internalRequestChangesSchema,
    internalCancelApprovalSchema,
    sendBackToRequesterSchema,
    resubmitDocumentSchema,
} from './helpdesk.documents.schema';
import { protect, requireRole } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';

const router = Router();

// All routes require authentication
router.use(protect);

// ── Upload Routes ─────────────────────────────────────────────────────────────

/**
 * ⚠️ IMPORTANT: For file uploads, multer must come BEFORE any body parsing.
 * 
 * We're NOT using Zod validation here because:
 * 1. File uploads with FormData are complex
 * 2. We're doing comprehensive manual validation in the controller
 * 3. It provides better error messages for file-related issues
 */
router.post(
    '/upload',
    upload.single('file'),
    sanitizeFormDataBody,
    HelpdeskDocumentsController.upload
);

router.post(
    '/upload/batch',
    upload.array('files', 20),
    sanitizeBatchFormDataBody,
    validate(batchUploadSchema),
    HelpdeskDocumentsController.batchUpload
);

// ── Update Document File ────────────────────────────────────────────────────

router.patch(
    '/:id/file',
    requireRole('super_admin'),
    upload.single('file'),
    sanitizeFormDataBody,
    validate(updateDocumentFileSchema),
    HelpdeskDocumentsController.updateDocumentFile
);

// ── Document List ─────────────────────────────────────────────────────────────

router.get(
    '/',
    validate(listHelpdeskDocumentsSchema),
    HelpdeskDocumentsController.list
);

// ─────────────────────────────────────────────────────────────────────────────
// ⚠️ ROUTE ORDER MATTERS BELOW THIS POINT
//
// Express matches GET routes top-to-bottom on first match, and `/:id` matches
// ANY single path segment. Every static-path GET route (e.g. /pending-internal,
// /stats, /summary, /requester-dashboard) MUST be registered before `/:id`,
// or it will be swallowed by the `/:id` handler and fail UUID validation on
// the literal path segment (e.g. "pending-internal") instead of ever reaching
// its intended controller. `/:id` is therefore registered last, after every
// other GET route in this file.
// ─────────────────────────────────────────────────────────────────────────────

// ── TWO-STEP APPROVAL DASHBOARD ROUTES (static paths — must precede /:id) ────

/**
 * Pending Internal Summary - Super admin dashboard stats
 * GET /api/helpdesk/documents/pending-internal/summary
 */
router.get(
    '/pending-internal/summary',
    requireRole('super_admin'),
    HelpdeskDocumentsController.getPendingInternalSummary
);

/**
 * Pending Internal Approvals - Super admin dashboard
 * GET /api/helpdesk/documents/pending-internal
 */
router.get(
    '/pending-internal',
    requireRole('super_admin'),
    HelpdeskDocumentsController.getPendingInternalApprovals
);

/**
 * Requester Dashboard - Requester documents view
 * GET /api/helpdesk/documents/requester-dashboard
 */
router.get(
    '/requester-dashboard',
    HelpdeskDocumentsController.getRequesterDashboard
);

// ── Stats & Summary (static paths — must precede /:id) ───────────────────────

router.get(
    '/stats',
    HelpdeskDocumentsController.getStats
);

router.get(
    '/summary',
    HelpdeskDocumentsController.getSummary
);

// ── Entity Routes (2-segment path — must precede /:id) ────────────────────────

router.get(
    '/entity/:entityType/:entityId',
    validate(getDocumentsByEntitySchema),
    HelpdeskDocumentsController.getByEntity
);

// ── Get Document by ID (catch-all — MUST be the last GET route) ──────────────

router.get(
    '/:id',
    validate(getDocumentByIdSchema),
    HelpdeskDocumentsController.getById
);

// ── TWO-STEP APPROVAL ACTION ROUTES ───────────────────────────────────────────
// (Safe from the /:id conflict: these are POST routes, and Express matches
// per-method, so they never compete with the GET /:id route above.)

/**
 * Internal Preview - Super admin previews document
 * POST /api/helpdesk/documents/:id/internal/preview
 */
router.post(
    '/:id/internal/preview',
    requireRole('super_admin'),
    validate(internalPreviewDocumentSchema),
    HelpdeskDocumentsController.internalPreview
);

/**
 * Internal Approve - Super admin approves internally with signature embedding
 * POST /api/helpdesk/documents/:id/internal/approve
 */
router.post(
    '/:id/internal/approve',
    requireRole('super_admin'),
    validate(internalApproveDocumentSchema),
    HelpdeskDocumentsController.internalApprove
);

/**
 * Internal Reject - Super admin rejects internally
 * POST /api/helpdesk/documents/:id/internal/reject
 */
router.post(
    '/:id/internal/reject',
    requireRole('super_admin'),
    validate(internalRejectDocumentSchema),
    HelpdeskDocumentsController.internalReject
);

/**
 * Internal Request Changes - Super admin requests changes internally
 * POST /api/helpdesk/documents/:id/internal/request-changes
 */
router.post(
    '/:id/internal/request-changes',
    requireRole('super_admin'),
    validate(internalRequestChangesSchema),
    HelpdeskDocumentsController.internalRequestChanges
);

/**
 * Cancel Internal Approval - Super admin cancels internal decision
 * POST /api/helpdesk/documents/:id/internal/cancel
 */
router.post(
    '/:id/internal/cancel',
    requireRole('super_admin'),
    validate(internalCancelApprovalSchema),
    HelpdeskDocumentsController.internalCancelApproval
);

/**
 * Send Back to Requester - Super admin sends document back
 * POST /api/helpdesk/documents/:id/send-back
 */
router.post(
    '/:id/send-back',
    requireRole('super_admin'),
    validate(sendBackToRequesterSchema),
    HelpdeskDocumentsController.sendBackToRequester
);

/**
 * Resubmit Document - Requester resubmits after changes
 * POST /api/helpdesk/documents/:id/resubmit
 */
router.post(
    '/:id/resubmit',
    validate(resubmitDocumentSchema),
    HelpdeskDocumentsController.resubmitDocument
);

// ─── Document Workflow ────────────────────────────────────────────────────────
// Note: The legacy approve/reject/return endpoints have been removed.
// Use the two-step approval workflow instead:
//   1. internalPreview (optional)
//   2. internalApprove / internalReject / internalRequestChanges
//   3. sendBackToRequester

router.post(
    '/:id/submit',
    requireRole('dept_head', 'staff'),
    validate(submitDocumentForApprovalSchema),
    HelpdeskDocumentsController.submitForApproval
);

// ─── Comments ─────────────────────────────────────────────────────────────────

router.post(
    '/:id/comments',
    validate(addCommentSchema),
    HelpdeskDocumentsController.addComment
);

router.delete(
    '/comments/:commentId',
    validate(deleteCommentSchema),
    HelpdeskDocumentsController.deleteComment
);

// ─── Linking ──────────────────────────────────────────────────────────────────

router.patch(
    '/:id/link',
    requireRole('super_admin', 'dept_head', 'staff'),
    validate(linkDocumentSchema),
    HelpdeskDocumentsController.link
);

router.post(
    '/bulk/link',
    requireRole('super_admin', 'dept_head', 'staff'),
    validate(bulkLinkDocumentsSchema),
    HelpdeskDocumentsController.bulkLink
);

// ─── Bulk Operations ──────────────────────────────────────────────────────────

router.post(
    '/bulk/status',
    requireRole('super_admin', 'dept_head', 'staff'),
    validate(bulkUpdateStatusSchema),
    HelpdeskDocumentsController.bulkUpdateStatus
);

// ─── Delete Routes ────────────────────────────────────────────────────────────

router.delete(
    '/:id',
    validate(documentIdSchema),
    requireRole('super_admin', 'dept_head', 'staff'),
    HelpdeskDocumentsController.remove
);

// 🔴 CLEANUP: Removed 'staff' from hard delete, only Super Admin allowed.
router.delete(
    '/:id/permanent',
    validate(documentIdSchema),
    requireRole('super_admin'),
    HelpdeskDocumentsController.hardRemove
);

export default router;