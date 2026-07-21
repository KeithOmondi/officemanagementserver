// src/features/documents/documents.routes.ts

import { Router } from 'express';
import { documentController } from './documents.controller';
import { upload } from '../../middleware/upload';
import { protect, requireRole } from '../../middleware/auth.middleware';

const router = Router();

router.use(protect);

// ════════════════════════════════════════════════════════════════════════════
//  1. ALL STATIC ROUTES FIRST (no parameters)
// ════════════════════════════════════════════════════════════════════════════

// ── Follow-up routes (ALL static paths first) ──────────────────────────────
router.post(
  '/follow-ups',
  requireRole('super_admin', 'dept_head'),
  documentController.createFollowUp
);

router.get(
  '/follow-ups',
  requireRole('super_admin', 'dept_head'),
  documentController.getFollowUps
);

router.get(
  '/follow-ups/my',
  requireRole('super_admin', 'dept_head'),
  documentController.getMyFollowUps
);

// ── Other static routes ──────────────────────────────────────────────────────
router.get('/', documentController.getAll);
router.get('/my-marked', documentController.getMyMarked);
router.get('/received', documentController.getReceivedDocuments);

// ── Create routes ────────────────────────────────────────────────────────────
router.post('/compose', requireRole('staff'), documentController.createComposed);
router.post('/upload', requireRole('staff', 'dept_head'), upload.single('file'), documentController.createUpload);
router.post('/compose-memo', requireRole('staff'), documentController.composeMemo);
router.post('/compose-letter', requireRole('staff'), documentController.composeLetter);

// ════════════════════════════════════════════════════════════════════════════
//  2. ROUTES WITH PARAMETERS (but specific patterns)
// ════════════════════════════════════════════════════════════════════════════

// ── Follow-up routes with parameters ────────────────────────────────────────
router.get(
  '/follow-ups/:followUpId',
  requireRole('super_admin', 'dept_head'),
  documentController.getFollowUpById
);

router.get(
  '/follow-ups/:followUpId/thread',
  requireRole('super_admin', 'dept_head'),
  documentController.getFollowUpThread
);

router.put(
  '/follow-ups/:followUpId',
  requireRole('super_admin', 'dept_head'),
  documentController.updateFollowUp
);

router.patch(
  '/follow-ups/:followUpId/complete',
  requireRole('super_admin', 'dept_head'),
  documentController.completeFollowUp
);

router.patch(
  '/follow-ups/:followUpId/cancel',
  requireRole('super_admin', 'dept_head'),
  documentController.cancelFollowUp
);

router.post(
  '/follow-ups/:followUpId/comments',
  requireRole('super_admin', 'dept_head'),
  upload.single('file'),
  documentController.addFollowUpComment
);

router.get(
  '/follow-ups/:followUpId/comments',
  requireRole('super_admin', 'dept_head'),
  documentController.getFollowUpComments
);

// ── Other parameter routes (specific patterns) ─────────────────────────────
router.get(
  '/:id/follow-ups',
  documentController.getFollowUpsByDocument
);

router.post(
  '/:id/send-to-user',
  requireRole('staff', 'super_admin'),
  documentController.sendToUser
);

router.post(
  '/:id/regenerate-pdf',
  requireRole('super_admin'),
  documentController.regeneratePdf
);

// ════════════════════════════════════════════════════════════════════════════
//  3. GENERIC /:id ROUTES (MUST BE LAST)
// ════════════════════════════════════════════════════════════════════════════

// ── Read ──────────────────────────────────────────────────────────────────────
router.get('/:id', documentController.getById);
router.get('/:id/mark-history', documentController.getMarkHistory);
router.get('/:id/flow', documentController.getFlowHistory);
router.get('/:id/responses', documentController.getResponses);

// ── Edit / lifecycle ──────────────────────────────────────────────────────────
router.put('/:id', requireRole('staff'), documentController.update);
router.delete('/:id', requireRole('dept_head'), documentController.delete);

// ── E-Sign ────────────────────────────────────────────────────────────────────
router.post('/:id/request-sign-otp', requireRole('super_admin'), documentController.requestSignOtp);
router.post('/:id/sign', requireRole('dept_head'), documentController.sign);

// ── Release Document ──────────────────────────────────────────────────────────
router.post('/:id/release', requireRole('super_admin'), documentController.releaseDocument);

// ── Send ──────────────────────────────────────────────────────────────────────
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

// ── Update Mark ──────────────────────────────────────────────────────────────
router.patch(
  '/marks/:markId',
  requireRole('super_admin'),
  documentController.updateMark
);

// ════════════════════════════════════════════════════════════════════════════
//  Folder Operations
// ════════════════════════════════════════════════════════════════════════════

router.post(
  '/:id/redirect-to-folder',
  requireRole('super_admin', 'dept_head'),
  documentController.redirectToFolder
);

router.delete(
  '/:id/remove-from-folder',
  requireRole('super_admin', 'dept_head'),
  documentController.removeFromFolder
);

router.get(
  '/folder/:folderId',
  documentController.getDocumentsByFolder
);

export default router;