// src/features/helpdesk/helpdesk.documents.routes.ts

import { Router } from 'express';
import { HelpdeskDocumentsController } from './helpdesk.documents.controller';
import { upload } from '../../middleware/upload';
import {
    uploadHelpdeskDocumentSchema,
    listHelpdeskDocumentsSchema,
    getDocumentByIdSchema,
    updateDocumentStatusSchema,
    submitDocumentForApprovalSchema,
    approveDocumentSchema,
    rejectDocumentSchema,
    returnDocumentSchema,
    addCommentSchema,
    documentIdSchema,
    linkDocumentSchema,
} from './helpdesk.documents.schema';
import { protect, requireRole } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';

const router = Router();

// All routes require authentication
router.use(protect);

// ── POST /api/helpdesk/documents/upload ──────────────────────────────────────
router.post(
    '/upload',
    upload.single('file'),
    validate(uploadHelpdeskDocumentSchema),
    HelpdeskDocumentsController.upload
);

router.patch(
    '/:id/link',
    validate(linkDocumentSchema),
    HelpdeskDocumentsController.link
);

// ── GET /api/helpdesk/documents ──────────────────────────────────────────────
router.get(
    '/',
    validate(listHelpdeskDocumentsSchema),
    HelpdeskDocumentsController.list
);

// ── GET /api/helpdesk/documents/:id ──────────────────────────────────────────
router.get(
    '/:id',
    validate(getDocumentByIdSchema),
    HelpdeskDocumentsController.getById
);

// ── POST /api/helpdesk/documents/:id/submit ─────────────────────────────────
router.post(
    '/:id/submit',
    requireRole('dept_head'),
    validate(submitDocumentForApprovalSchema),
    HelpdeskDocumentsController.submitForApproval
);

// ── POST /api/helpdesk/documents/:id/approve ─────────────────────────────────
// Only Super Admins can approve
router.post(
    '/:id/approve',
    requireRole('super_admin'),
    validate(approveDocumentSchema),
    HelpdeskDocumentsController.approve
);

// ── POST /api/helpdesk/documents/:id/reject ──────────────────────────────────
// Only Super Admins can reject
router.post(
    '/:id/reject',
    requireRole('super_admin'),
    validate(rejectDocumentSchema),
    HelpdeskDocumentsController.reject
);

// ── POST /api/helpdesk/documents/:id/return ──────────────────────────────────
// Only Super Admins can return
router.post(
    '/:id/return',
    requireRole('super_admin'),
    validate(returnDocumentSchema),
    HelpdeskDocumentsController.returnDocument
);

// ── POST /api/helpdesk/documents/:id/comments ────────────────────────────────
router.post(
    '/:id/comments',
    validate(addCommentSchema),
    HelpdeskDocumentsController.addComment
);

// ── DELETE /api/helpdesk/documents/:id ───────────────────────────────────────
router.delete(
    '/:id',
    requireRole('super_admin', 'dept_head'),
    validate(documentIdSchema),
    HelpdeskDocumentsController.remove
);

export default router;