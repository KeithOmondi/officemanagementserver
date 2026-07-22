// src/features/helpdesk/helpdesk.documents.routes.ts

import { Router } from 'express';
import { HelpdeskDocumentsController } from './helpdesk.documents.controller';
import { upload } from '../../middleware/upload';
import {
    uploadHelpdeskDocumentSchema,
    listHelpdeskDocumentsSchema,
    getDocumentByIdSchema,
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

// ⚠️ IMPORTANT: For file uploads, multer must come BEFORE validation
// because validation needs the parsed body from multer
router.post(
    '/upload',
    upload.single('file'),
    validate(uploadHelpdeskDocumentSchema),
    HelpdeskDocumentsController.upload
);

router.post(
    '/upload/batch',
    upload.array('files', 20),
    validate(batchUploadSchema),
    HelpdeskDocumentsController.batchUpload
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

// ─── E-Stamp ──────────────────────────────────────────────────────────────────

router.post(
    '/:id/estampt',
    requireRole('super_admin'),
    validate(updateEStampSchema),
    HelpdeskDocumentsController.updateEStamp
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

// ─── Bulk Operations ──────────────────────────────────────────────────────────

router.post(
    '/bulk/status',
    requireRole('super_admin', 'dept_head', "staff"),
    validate(bulkUpdateStatusSchema),
    HelpdeskDocumentsController.bulkUpdateStatus
);

// ─── Stats & Summary ──────────────────────────────────────────────────────────

router.get(
    '/stats',
    HelpdeskDocumentsController.getStats
);

router.get(
    '/summary',
    HelpdeskDocumentsController.getSummary
);

// ─── Entity Routes ────────────────────────────────────────────────────────────

router.get(
    '/entity/:entityType/:entityId',
    validate(getDocumentsByEntitySchema),
    HelpdeskDocumentsController.getByEntity
);

// ─── Delete Routes ────────────────────────────────────────────────────────────

router.delete(
    '/:id',
    validate(documentIdSchema),
    requireRole('super_admin', 'dept_head'),
    HelpdeskDocumentsController.remove
);

router.delete(
    '/:id/permanent',
    validate(documentIdSchema),
    requireRole('super_admin'),
    HelpdeskDocumentsController.hardRemove
);

export default router;