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
router.get('/received', documentController.getReceivedDocuments);
router.get('/:id', documentController.getById);
router.get('/:id/mark-history', documentController.getMarkHistory);
router.get('/:id/flow', documentController.getFlowHistory);
router.get('/:id/responses', documentController.getResponses);

// ── Create ────────────────────────────────────────────────────────────────────
router.post('/compose', requireRole('staff'), documentController.createComposed);
router.post('/upload', requireRole('staff', 'dept_head'), upload.single('file'), documentController.createUpload);

// ── Compose Memo / Letter ──────────────────────────────────────────────────────
router.post('/compose-memo', requireRole('staff'), documentController.composeMemo);
router.post('/compose-letter', requireRole('staff'), documentController.composeLetter);
router.post('/:id/regenerate-pdf', requireRole('super_admin'), documentController.regeneratePdf);

// ── Send to User ─────────────────────────────────────────────────────────────
router.post('/:id/send-to-user', requireRole('staff', 'super_admin'), documentController.sendToUser);

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

// ── Response thread ───────────────────────────────────────────────────────────
router.post('/:id/respond', upload.single('file'), documentController.respond);

// ── Update Mark (instructions & bring_up_date) ──────────────────────────────
router.patch(
  '/marks/:markId',
  requireRole('super_admin'),
  documentController.updateMark
);

// ════════════════════════════════════════════════════════════════════════════
//  NEW: Folder Operations
// ════════════════════════════════════════════════════════════════════════════

// ── Redirect Document to Folder ────────────────────────────────────────────
router.post(
  '/:id/redirect-to-folder',
  requireRole('super_admin', 'dept_head'),
  documentController.redirectToFolder
);

// ── Remove Document from Folder ────────────────────────────────────────────
router.delete(
  '/:id/remove-from-folder',
  requireRole('super_admin', 'dept_head'),
  documentController.removeFromFolder
);

// ── Get Documents by Folder ────────────────────────────────────────────────
router.get(
  '/folder/:folderId',
  documentController.getDocumentsByFolder
);

export default router;