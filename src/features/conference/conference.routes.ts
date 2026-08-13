// src/features/conference/conference.routes.ts

import { Router } from 'express';
import { conferenceController } from './conference.controller';
import { protect, requireRole } from '../../middleware/auth.middleware';
import {
  createConferenceRequestSchema,
  updateConferenceRequestSchema,
  getConferenceRequestSchema,
  listConferenceRequestsSchema,
  deleteConferenceRequestSchema,
  getConferenceStatsSchema,
  approveConferenceRequestSchema,
  returnConferenceRequestSchema,
  completeConferenceSchema,
  cancelConferenceSchema,
  submitConferenceRequestSchema, // ← ADD THIS
} from './conference.validator';
import { validate } from '../../middleware/validate.middleware';

const router = Router();

// All routes require authentication
router.use(protect);

// ════════════════════════════════════════════════════════════════════════════
//  CONFERENCE REQUEST ROUTES - /api/v1/conference
// ════════════════════════════════════════════════════════════════════════════

// ── Read ──────────────────────────────────────────────────────────────────────

/**
 * @route   GET /api/v1/conference
 * @desc    Get all conference requests with pagination and filters
 * @access  Authenticated users
 */
router.get(
  '/',
  validate(listConferenceRequestsSchema),
  conferenceController.getConferenceRequests
);

/**
 * @route   GET /api/v1/conference/stats
 * @desc    Get conference request statistics
 * @access  Authenticated users
 */
router.get(
  '/stats',
  validate(getConferenceStatsSchema),
  conferenceController.getConferenceStats
);

/**
 * @route   GET /api/v1/conference/:id
 * @desc    Get a single conference request by ID
 * @access  Authenticated users
 * ⚠️ IMPORTANT: This must come AFTER /conference/stats to avoid route conflict
 */
router.get(
  '/:id',
  validate(getConferenceRequestSchema),
  conferenceController.getConferenceRequestById
);

// ── Create ────────────────────────────────────────────────────────────────────

/**
 * @route   POST /api/v1/conference
 * @desc    Create a new conference request
 * @access  Super Admin, Dept Head, or Staff
 */
router.post(
  '/',
  requireRole('super_admin', 'dept_head', 'staff'),
  validate(createConferenceRequestSchema),
  conferenceController.createConferenceRequest
);

// ── Update ────────────────────────────────────────────────────────────────────

/**
 * @route   PUT /api/v1/conference/:id
 * @desc    Update an existing conference request
 * @access  Super Admin, Dept Head, or Staff
 */
router.put(
  '/:id',
  requireRole('super_admin', 'dept_head', 'staff'),
  validate(updateConferenceRequestSchema),
  conferenceController.updateConferenceRequest
);

// ── Submit for Approval ──────────────────────────────────────────────────────

/**
 * @route   PUT /api/v1/conference/:id/submit
 * @desc    Submit a conference request for approval (draft → pending)
 * @access  Super Admin, Dept Head, or Staff
 */
router.put(
  '/:id/submit',
  requireRole('super_admin', 'dept_head', 'staff'),
  validate(submitConferenceRequestSchema), // ← USE THE IMPORTED SCHEMA
  conferenceController.submitConferenceRequest
);

// ── Approve & Return (Super Admin only) ──────────────────────────────────────

/**
 * @route   PUT /api/v1/conference/:id/approve
 * @desc    Approve a conference request (pending → approved)
 * @access  Super Admin only
 */
router.put(
  '/:id/approve',
  requireRole('super_admin'),
  validate(approveConferenceRequestSchema),
  conferenceController.approveConferenceRequest
);

/**
 * @route   PUT /api/v1/conference/:id/return
 * @desc    Return a conference request to requester with reason (pending → rejected)
 * @access  Super Admin only
 */
router.put(
  '/:id/return',
  requireRole('super_admin'),
  validate(returnConferenceRequestSchema),
  conferenceController.returnConferenceRequest
);

// ── Complete & Cancel ────────────────────────────────────────────────────────

/**
 * @route   PUT /api/v1/conference/:id/complete
 * @desc    Mark a conference as completed (approved → completed)
 * @access  Super Admin, Dept Head, or Staff
 */
router.put(
  '/:id/complete',
  requireRole('super_admin', 'dept_head', 'staff'),
  validate(completeConferenceSchema),
  conferenceController.completeConferenceRequest
);

/**
 * @route   PUT /api/v1/conference/:id/cancel
 * @desc    Cancel a conference request (draft/pending/approved → cancelled)
 * @access  Super Admin, Dept Head, or Staff
 */
router.put(
  '/:id/cancel',
  requireRole('super_admin', 'dept_head', 'staff'),
  validate(cancelConferenceSchema),
  conferenceController.cancelConferenceRequest
);

// ── Delete ────────────────────────────────────────────────────────────────────

/**
 * @route   DELETE /api/v1/conference/:id
 * @desc    Soft delete a conference request (draft/pending/rejected only)
 * @access  Super Admin, Dept Head, or Staff
 */
router.delete(
  '/:id',
  requireRole('super_admin', 'dept_head', 'staff'),
  validate(deleteConferenceRequestSchema),
  conferenceController.deleteConferenceRequest
);

export default router;