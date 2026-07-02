// src/features/documents/documents.routes.ts
import { Router } from 'express';
import { documentController } from './documents.controller';
import { upload } from '../../middleware/upload';
import { protect, requireRole } from '../../middleware/auth.middleware';

const router = Router();

router.use(protect);

// ── Read ──────────────────────────────────────────────────────────────────────
router.get('/', documentController.getAll);
router.get('/my-marked', documentController.getMyMarked);
router.get('/:id', documentController.getById);
router.get('/:id/mark-history', documentController.getMarkHistory);

// ── Create ────────────────────────────────────────────────────────────────────
router.post('/compose', requireRole('staff'), documentController.createComposed);
router.post('/upload', requireRole('staff', 'dept_head'), upload.single('file'), documentController.createUpload);

// ── Edit / lifecycle ──────────────────────────────────────────────────────────
router.put('/:id', requireRole('staff'), documentController.update);
router.delete('/:id', requireRole('dept_head'), documentController.delete);
router.post('/:id/request-sign-otp', requireRole('super_admin'), documentController.requestSignOtp);
router.post('/:id/sign', requireRole('dept_head'), documentController.sign);
router.post('/:id/send', requireRole('dept_head'), documentController.send);

// ── Marking to Departments ───────────────────────────────────────────────────
router.post('/:id/mark', requireRole('dept_head'), documentController.markDocument);

// ── Mark Actions ─────────────────────────────────────────────────────────────
router.post('/:id/acknowledge', documentController.acknowledgeMark);
router.post('/:id/complete', documentController.completeMark);

// ── Annotations ───────────────────────────────────────────────────────────────
router.post('/:id/annotations', requireRole('staff'), documentController.addAnnotation);
router.delete('/:id/annotations/:annotationId', requireRole('staff'), documentController.deleteAnnotation);

// ── Draft lifecycle / document flow ──────────────────────────────────────────
router.post('/:id/finalize-draft', requireRole('dept_head'), documentController.finalizeDraft);
router.post('/:id/return', requireRole('super_admin'), documentController.returnDocument);
router.get('/:id/flow', documentController.getFlowHistory);

// ── Response thread ───────────────────────────────────────────────────────────
// `file` is optional — multer parses the multipart body either way, so a
// text-only response (just `note`) works the same request shape as one with
// an attachment. Authorization (must be the current assignee) is enforced
// inside DocumentService.addResponse, since it depends on document state.
router.post('/:id/respond', upload.single('file'), documentController.respond);
router.get('/:id/responses', documentController.getResponses);

export default router;