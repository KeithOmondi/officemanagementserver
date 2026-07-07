// src/features/helpdesk/helpdesk.documents.routes.ts

import { Router }                         from 'express';
import { HelpdeskDocumentsController }    from './helpdesk.documents.controller';
import { upload }                         from '../../middleware/upload';     // your existing multer instance
import {
    uploadHelpdeskDocumentSchema,
    listHelpdeskDocumentsSchema,
    documentIdSchema,
} from './helpdesk.documents.schema';
import { protect } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';

const router = Router();

// All routes require a valid session
router.use(protect);

// ── POST /api/helpdesk/documents/upload ──────────────────────────────────────
// Accepts a single file field named "file" plus the body fields defined in the schema.
router.post(
    '/upload',
    upload.single('file'),          // multer parses the multipart body
    validate(uploadHelpdeskDocumentSchema),
    HelpdeskDocumentsController.upload
);

// ── GET /api/helpdesk/documents ──────────────────────────────────────────────
router.get(
    '/',
    validate(listHelpdeskDocumentsSchema),
    HelpdeskDocumentsController.list
);

// ── DELETE /api/helpdesk/documents/:id ───────────────────────────────────────
router.delete(
    '/:id',
    validate(documentIdSchema),
    HelpdeskDocumentsController.remove
);

export default router;