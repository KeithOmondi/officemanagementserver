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
    approveDocumentSchema,
    rejectDocumentSchema,
    returnDocumentSchema,
    addCommentSchema,
    documentIdSchema,
    linkDocumentSchema,
    bulkLinkDocumentsSchema,
    bulkUpdateStatusSchema,
    batchUploadSchema,
    updateEStampSchema,
    deleteCommentSchema,
    getDocumentsByEntitySchema,
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
 * 4. The consolidated memo types aren't in the Zod enum yet
 */
router.post(
    '/upload',
    upload.single('file'),
    sanitizeFormDataBody,
    // ❌ NO Zod validation - manual validation in controller
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

// ── Document CRUD ─────────────────────────────────────────────────────────────

router.get(
    '/',
    validate(listHelpdeskDocumentsSchema),
    HelpdeskDocumentsController.list
);

router.get(
    '/:id',
    validate(getDocumentByIdSchema),
    HelpdeskDocumentsController.getById
);

// ── Document Workflow ─────────────────────────────────────────────────────────

router.post(
    '/:id/submit',
    requireRole('dept_head', "staff"),
    validate(submitDocumentForApprovalSchema),
    HelpdeskDocumentsController.submitForApproval
);

router.post(
    '/:id/approve',
    requireRole('super_admin'),
    validate(approveDocumentSchema),
    HelpdeskDocumentsController.approve
);

router.post(
    '/:id/reject',
    requireRole('super_admin'),
    validate(rejectDocumentSchema),
    HelpdeskDocumentsController.reject
);

router.post(
    '/:id/return',
    requireRole('super_admin'),
    validate(returnDocumentSchema),
    HelpdeskDocumentsController.returnDocument
);

// ── E-Stamp ──────────────────────────────────────────────────────────────────

router.post(
    '/:id/estampt',
    requireRole('super_admin'),
    validate(updateEStampSchema),
    HelpdeskDocumentsController.updateEStamp
);

// ── Comments ─────────────────────────────────────────────────────────────────

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

// ── Linking ──────────────────────────────────────────────────────────────────

router.patch(
    '/:id/link',
    requireRole('super_admin', 'dept_head', "staff"),
    validate(linkDocumentSchema),
    HelpdeskDocumentsController.link
);

router.post(
    '/bulk/link',
    requireRole('super_admin', 'dept_head', "staff"),
    validate(bulkLinkDocumentsSchema),
    HelpdeskDocumentsController.bulkLink
);

// ── Bulk Operations ──────────────────────────────────────────────────────────

router.post(
    '/bulk/status',
    requireRole('super_admin', 'dept_head', "staff"),
    validate(bulkUpdateStatusSchema),
    HelpdeskDocumentsController.bulkUpdateStatus
);

// ── Stats & Summary ──────────────────────────────────────────────────────────

router.get(
    '/stats',
    HelpdeskDocumentsController.getStats
);

router.get(
    '/summary',
    HelpdeskDocumentsController.getSummary
);

// ── Entity Routes ────────────────────────────────────────────────────────────

router.get(
    '/entity/:entityType/:entityId',
    validate(getDocumentsByEntitySchema),
    HelpdeskDocumentsController.getByEntity
);

// ── Delete Routes ────────────────────────────────────────────────────────────

router.delete(
    '/:id',
    validate(documentIdSchema),
    requireRole('super_admin', 'dept_head', 'staff'),
    HelpdeskDocumentsController.remove
);

router.delete(
    '/:id/permanent',
    validate(documentIdSchema),
    requireRole('super_admin'),
    HelpdeskDocumentsController.hardRemove
);

export default router;