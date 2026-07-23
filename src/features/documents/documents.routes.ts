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

/**
 * @route   POST /api/documents/follow-ups
 * @desc    Create a new follow-up (simplified - no title required)
 * @access  Super Admin or Dept Head
 * @body    { document_id, mark_id?, notes, assigned_to, due_date?, priority? }
 */
router.post(
  '/follow-ups',
  requireRole('super_admin', 'dept_head'),
  documentController.createFollowUp
);

/**
 * @route   POST /api/documents/follow-ups/file-away
 * @desc    File away a follow-up (no due date, immediately completed)
 * @access  Super Admin or Dept Head
 * @body    { document_id, mark_id?, notes, completion_notes? }
 */
router.post(
  '/follow-ups/file-away',
  requireRole('super_admin', 'dept_head'),
  documentController.fileAwayFollowUp
);

/**
 * @route   GET /api/documents/follow-ups
 * @desc    Get all follow-ups with filters
 * @access  Super Admin or Dept Head
 * @query   status, priority, assigned_to, document_id, active_only, filed_only, etc.
 */
router.get(
  '/follow-ups',
  requireRole('super_admin', 'dept_head'),
  documentController.getFollowUps
);

/**
 * @route   GET /api/documents/follow-ups/my
 * @desc    Get follow-ups assigned to the current user
 * @access  Super Admin or Dept Head
 * @query   status, priority, active_only, filed_only, etc.
 */
router.get(
  '/follow-ups/my',
  requireRole('super_admin', 'dept_head'),
  documentController.getMyFollowUps
);

/**
 * @route   GET /api/documents/follow-ups/summary
 * @desc    Get follow-up summary for the current user
 * @access  Super Admin or Dept Head
 * @returns { pending, overdue, completed, filed_away, total, active }
 */
router.get(
  '/follow-ups/summary',
  requireRole('super_admin', 'dept_head'),
  documentController.getFollowUpSummary
);

// ── Other static routes ──────────────────────────────────────────────────────

/**
 * @route   GET /api/documents
 * @desc    Get all documents with filters
 * @access  Authenticated users
 */
router.get('/', documentController.getAll);

/**
 * @route   GET /api/documents/my-marked
 * @desc    Get documents marked to the current user
 * @access  Authenticated users
 */
router.get('/my-marked', documentController.getMyMarked);

/**
 * @route   GET /api/documents/received
 * @desc    Get documents received by the current user
 * @access  Authenticated users
 */
router.get('/received', documentController.getReceivedDocuments);

// ── Create routes ────────────────────────────────────────────────────────────

/**
 * @route   POST /api/documents/compose
 * @desc    Create a composed document (judgment, ruling, order)
 * @access  Staff and above
 */
router.post('/compose', requireRole('staff'), documentController.createComposed);

/**
 * @route   POST /api/documents/upload
 * @desc    Upload a document with file
 * @access  Staff and Dept Head
 */
router.post('/upload', requireRole('staff', 'dept_head'), upload.single('file'), documentController.createUpload);

/**
 * @route   POST /api/documents/compose-memo
 * @desc    Generate a memo document from template
 * @access  Staff and above
 */
router.post('/compose-memo', requireRole('staff'), documentController.composeMemo);

/**
 * @route   POST /api/documents/compose-letter
 * @desc    Generate a letter document from template
 * @access  Staff and above
 */
router.post('/compose-letter', requireRole('staff'), documentController.composeLetter);

// ════════════════════════════════════════════════════════════════════════════
//  2. ROUTES WITH PARAMETERS (but specific patterns)
// ════════════════════════════════════════════════════════════════════════════

// ── Follow-up routes with parameters ────────────────────────────────────────

/**
 * @route   GET /api/documents/follow-ups/:followUpId
 * @desc    Get a specific follow-up by ID
 * @access  Super Admin or Dept Head
 */
router.get(
  '/follow-ups/:followUpId',
  requireRole('super_admin', 'dept_head'),
  documentController.getFollowUpById
);

/**
 * @route   GET /api/documents/follow-ups/:followUpId/thread
 * @desc    Get a follow-up with all its comments (thread)
 * @access  Super Admin or Dept Head
 */
router.get(
  '/follow-ups/:followUpId/thread',
  requireRole('super_admin', 'dept_head'),
  documentController.getFollowUpThread
);

/**
 * @route   PUT /api/documents/follow-ups/:followUpId
 * @desc    Update a follow-up
 * @access  Super Admin or Dept Head
 * @body    { notes?, assigned_to?, due_date?, priority?, status? }
 */
router.put(
  '/follow-ups/:followUpId',
  requireRole('super_admin', 'dept_head'),
  documentController.updateFollowUp
);

/**
 * @route   PATCH /api/documents/follow-ups/:followUpId/complete
 * @desc    Mark a follow-up as completed
 * @access  Super Admin or Dept Head
 * @body    { completion_notes? }
 */
router.patch(
  '/follow-ups/:followUpId/complete',
  requireRole('super_admin', 'dept_head'),
  documentController.completeFollowUp
);

/**
 * @route   PATCH /api/documents/follow-ups/:followUpId/cancel
 * @desc    Cancel a follow-up
 * @access  Super Admin or Dept Head
 * @body    { cancellation_reason }
 */
router.patch(
  '/follow-ups/:followUpId/cancel',
  requireRole('super_admin', 'dept_head'),
  documentController.cancelFollowUp
);

/**
 * @route   POST /api/documents/follow-ups/:followUpId/comments
 * @desc    Add a comment to a follow-up
 * @access  Super Admin or Dept Head
 * @body    { comment }
 * @file    Optional file attachment
 */
router.post(
  '/follow-ups/:followUpId/comments',
  requireRole('super_admin', 'dept_head'),
  upload.single('file'),
  documentController.addFollowUpComment
);

/**
 * @route   GET /api/documents/follow-ups/:followUpId/comments
 * @desc    Get all comments for a follow-up
 * @access  Super Admin or Dept Head
 */
router.get(
  '/follow-ups/:followUpId/comments',
  requireRole('super_admin', 'dept_head'),
  documentController.getFollowUpComments
);

// ── Other parameter routes (specific patterns) ─────────────────────────────

/**
 * @route   GET /api/documents/:id/follow-ups
 * @desc    Get all follow-ups for a specific document
 * @access  Authenticated users
 */
router.get(
  '/:id/follow-ups',
  documentController.getFollowUpsByDocument
);

/**
 * @route   POST /api/documents/:id/send-to-user
 * @desc    Send a document to a specific user
 * @access  Staff and Super Admin
 */
router.post(
  '/:id/send-to-user',
  requireRole('staff', 'super_admin'),
  documentController.sendToUser
);

/**
 * @route   POST /api/documents/:id/regenerate-pdf
 * @desc    Regenerate PDF for memo/letter documents
 * @access  Super Admin only
 */
router.post(
  '/:id/regenerate-pdf',
  requireRole('super_admin'),
  documentController.regeneratePdf
);

// ════════════════════════════════════════════════════════════════════════════
//  3. GENERIC /:id ROUTES (MUST BE LAST)
// ════════════════════════════════════════════════════════════════════════════

// ── Read ──────────────────────────────────────────────────────────────────────

/**
 * @route   GET /api/documents/:id
 * @desc    Get a document by ID with annotations, mark history, responses, and follow-ups
 * @access  Authenticated users
 */
router.get('/:id', documentController.getById);

/**
 * @route   GET /api/documents/:id/mark-history
 * @desc    Get mark history for a document
 * @access  Authenticated users
 */
router.get('/:id/mark-history', documentController.getMarkHistory);

/**
 * @route   GET /api/documents/:id/flow
 * @desc    Get flow history for a document
 * @access  Authenticated users
 */
router.get('/:id/flow', documentController.getFlowHistory);

/**
 * @route   GET /api/documents/:id/responses
 * @desc    Get responses for a document
 * @access  Authenticated users
 */
router.get('/:id/responses', documentController.getResponses);

// ── Edit / lifecycle ──────────────────────────────────────────────────────────

/**
 * @route   PUT /api/documents/:id
 * @desc    Update a document
 * @access  Staff and above
 */
router.put('/:id', requireRole('staff'), documentController.update);

/**
 * @route   DELETE /api/documents/:id
 * @desc    Soft delete a document
 * @access  Dept Head and above
 */
router.delete('/:id', requireRole('dept_head'), documentController.delete);

// ── E-Sign ────────────────────────────────────────────────────────────────────

/**
 * @route   POST /api/documents/:id/request-sign-otp
 * @desc    Request an OTP for document signing
 * @access  Super Admin only
 */
router.post('/:id/request-sign-otp', requireRole('super_admin'), documentController.requestSignOtp);

/**
 * @route   POST /api/documents/:id/sign
 * @desc    Sign a document with OTP verification
 * @access  Dept Head and above
 * @body    { otp, position_x?, position_y?, position_width?, position_height? }
 */
router.post('/:id/sign', requireRole('dept_head'), documentController.sign);

// ── Release Document ──────────────────────────────────────────────────────────

/**
 * @route   POST /api/documents/:id/release
 * @desc    Release a signed document to admin side
 * @access  Super Admin only
 * @body    { note?, recipient_id? }
 */
router.post('/:id/release', requireRole('super_admin'), documentController.releaseDocument);

// ── Send ──────────────────────────────────────────────────────────────────────

/**
 * @route   POST /api/documents/:id/send
 * @desc    Send/filed a released document
 * @access  Dept Head and above
 */
router.post('/:id/send', requireRole('dept_head'), documentController.send);

// ── Marking to Departments ───────────────────────────────────────────────────

/**
 * @route   POST /api/documents/:id/mark
 * @desc    Mark a document to a department or user
 * @access  Dept Head and above
 * @body    { department_id, assigned_to?, instructions?, priority? }
 */
router.post('/:id/mark', requireRole('dept_head'), documentController.markDocument);

// ── Mark Actions ─────────────────────────────────────────────────────────────

/**
 * @route   POST /api/documents/:id/acknowledge
 * @desc    Acknowledge a document mark (user acknowledges assignment)
 * @access  Authenticated users (assigned user)
 */
router.post('/:id/acknowledge', documentController.acknowledgeMark);

/**
 * @route   POST /api/documents/:id/complete
 * @desc    Complete a document mark (user finishes work)
 * @access  Authenticated users (assigned user)
 */
router.post('/:id/complete', documentController.completeMark);

// ── Annotations ───────────────────────────────────────────────────────────────

/**
 * @route   POST /api/documents/:id/annotations
 * @desc    Add an annotation to a document
 * @access  Staff and above
 * @body    { comment, is_urgent?, visible_in_summary? }
 */
router.post('/:id/annotations', requireRole('staff'), documentController.addAnnotation);

/**
 * @route   DELETE /api/documents/:id/annotations/:annotationId
 * @desc    Delete an annotation
 * @access  Staff and above (only own annotations)
 */
router.delete('/:id/annotations/:annotationId', requireRole('staff'), documentController.deleteAnnotation);

// ── Draft lifecycle / document flow ──────────────────────────────────────────

/**
 * @route   POST /api/documents/:id/finalize-draft
 * @desc    Finalize a draft document
 * @access  Dept Head and above
 * @body    { assigned_to?, send_to_super_admin? }
 */
router.post('/:id/finalize-draft', requireRole('dept_head'), documentController.finalizeDraft);

/**
 * @route   POST /api/documents/:id/return
 * @desc    Return a document for action
 * @access  Super Admin only
 * @body    { note, requires_more_docs? }
 */
router.post('/:id/return', requireRole('super_admin'), documentController.returnDocument);

// ── Response thread ───────────────────────────────────────────────────────────

/**
 * @route   POST /api/documents/:id/respond
 * @desc    Add a response to a document
 * @access  Authenticated users (assigned user)
 * @body    { note }
 * @file    Optional file attachment
 */
router.post('/:id/respond', upload.single('file'), documentController.respond);

// ── Update Mark ──────────────────────────────────────────────────────────────

/**
 * @route   PATCH /api/documents/marks/:markId
 * @desc    Update a document mark (instructions & bring_up_date)
 * @access  Super Admin only
 * @body    { instructions?, bring_up_date? }
 */
router.patch(
  '/marks/:markId',
  requireRole('super_admin'),
  documentController.updateMark
);

// ════════════════════════════════════════════════════════════════════════════
//  Folder Operations
// ════════════════════════════════════════════════════════════════════════════

/**
 * @route   POST /api/documents/:id/redirect-to-folder
 * @desc    Move a document to a folder
 * @access  Super Admin or Dept Head
 * @body    { folder_id, note? }
 */
router.post(
  '/:id/redirect-to-folder',
  requireRole('super_admin', 'dept_head'),
  documentController.redirectToFolder
);

/**
 * @route   DELETE /api/documents/:id/remove-from-folder
 * @desc    Remove a document from its current folder
 * @access  Super Admin or Dept Head
 * @body    { note? }
 */
router.delete(
  '/:id/remove-from-folder',
  requireRole('super_admin', 'dept_head'),
  documentController.removeFromFolder
);

/**
 * @route   GET /api/documents/folder/:folderId
 * @desc    Get all documents in a folder
 * @access  Authenticated users
 * @query   page, limit, search, type, status
 */
router.get(
  '/folder/:folderId',
  documentController.getDocumentsByFolder
);

export default router;