// src/features/aide/aide.routes.ts
//
// ⚠️ MOUNT POINT: This router must be mounted at the API root, e.g.:
//     app.use('/api/v1', aideRoutes);
// NOT at '/api/v1/aide' — every path below already carries its own
// '/aide' or '/sentry' prefix. Mounting this at '/api/v1/aide' will
// double-prefix aide routes (-> /api/v1/aide/aide) and misroute sentry
// routes entirely (-> /api/v1/aide/sentry instead of /api/v1/sentry).

import { Router } from 'express';
import { aideController } from './aide.controller';
import { protect, requireRole } from '../../middleware/auth.middleware';
import {
  createAideRequestSchema,
  updateAideRequestSchema,
  getAideRequestSchema,
  listAideRequestsSchema,
  deleteAideRequestSchema,
  getAideStatsSchema,
  createSentryRequestSchema,
  updateSentryRequestSchema,
  getSentryRequestSchema,
  listSentryRequestsSchema,
  deleteSentryRequestSchema,
  getSentryStatsSchema,
} from './aide.validator';
import { validate } from '../../middleware/validate.middleware';

const router = Router();

// All routes require authentication
router.use(protect);

// ════════════════════════════════════════════════════════════════════════════
//  AIDE REQUEST ROUTES - /api/v1/aide/*
// ════════════════════════════════════════════════════════════════════════════

// ── Read ──────────────────────────────────────────────────────────────────────

/**
 * @route   GET /api/v1/aide
 * @desc    Get all aide requests with pagination and filters
 * @access  Authenticated users (super_admin, registrar)
 */
router.get(
  '/aide',
  validate(listAideRequestsSchema),
  aideController.getAideRequests
);

/**
 * @route   GET /api/v1/aide/stats
 * @desc    Get aide request statistics
 * @access  Authenticated users (super_admin, registrar)
 */
router.get(
  '/aide/stats',
  validate(getAideStatsSchema),
  aideController.getAideStats
);

/**
 * @route   GET /api/v1/aide/:id
 * @desc    Get a single aide request by ID
 * @access  Authenticated users (super_admin, registrar)
 * ⚠️ IMPORTANT: This must come AFTER /aide/stats to avoid conflict
 */
router.get(
  '/aide/:id',
  validate(getAideRequestSchema),
  aideController.getAideRequestById
);

// ── Create ────────────────────────────────────────────────────────────────────

/**
 * @route   POST /api/v1/aide
 * @desc    Create a new aide request
 * @access  Super Admin or Registrar only
 */
router.post(
  '/aide',
  requireRole('super_admin', 'dept_head'),
  validate(createAideRequestSchema),
  aideController.createAideRequest
);

// ── Update ────────────────────────────────────────────────────────────────────

/**
 * @route   PUT /api/v1/aide/:id
 * @desc    Update an existing aide request
 * @access  Super Admin or Registrar only
 */
router.put(
  '/aide/:id',
  requireRole('super_admin', 'dept_head'),
  validate(updateAideRequestSchema),
  aideController.updateAideRequest
);

// ── Delete ────────────────────────────────────────────────────────────────────

/**
 * @route   DELETE /api/v1/aide/:id
 * @desc    Soft delete an aide request
 * @access  Super Admin or Registrar only
 */
router.delete(
  '/aide/:id',
  requireRole('super_admin', 'dept_head'),
  validate(deleteAideRequestSchema),
  aideController.deleteAideRequest
);

// ════════════════════════════════════════════════════════════════════════════
//  SENTRY REQUEST ROUTES - /api/v1/sentry/*
// ════════════════════════════════════════════════════════════════════════════

// ── Read ──────────────────────────────────────────────────────────────────────

/**
 * @route   GET /api/v1/sentry
 * @desc    Get all sentry requests with pagination and filters
 * @access  Authenticated users (super_admin, registrar)
 */
router.get(
  '/sentry',
  validate(listSentryRequestsSchema),
  aideController.getSentryRequests
);

/**
 * @route   GET /api/v1/sentry/stats
 * @desc    Get sentry request statistics
 * @access  Authenticated users (super_admin, registrar)
 */
router.get(
  '/sentry/stats',
  validate(getSentryStatsSchema),
  aideController.getSentryStats
);

/**
 * @route   GET /api/v1/sentry/:id
 * @desc    Get a single sentry request by ID
 * @access  Authenticated users (super_admin, registrar)
 * ⚠️ IMPORTANT: This must come AFTER /sentry/stats to avoid conflict
 */
router.get(
  '/sentry/:id',
  validate(getSentryRequestSchema),
  aideController.getSentryRequestById
);

// ── Create ────────────────────────────────────────────────────────────────────

/**
 * @route   POST /api/v1/sentry
 * @desc    Create a new sentry request
 * @access  Super Admin or Registrar only
 */
router.post(
  '/sentry',
  requireRole('super_admin', 'dept_head'),
  validate(createSentryRequestSchema),
  aideController.createSentryRequest
);

// ── Update ────────────────────────────────────────────────────────────────────

/**
 * @route   PUT /api/v1/sentry/:id
 * @desc    Update an existing sentry request
 * @access  Super Admin or Registrar only
 */
router.put(
  '/sentry/:id',
  requireRole('super_admin', 'dept_head'),
  validate(updateSentryRequestSchema),
  aideController.updateSentryRequest
);

// ── Delete ────────────────────────────────────────────────────────────────────

/**
 * @route   DELETE /api/v1/sentry/:id
 * @desc    Soft delete a sentry request
 * @access  Super Admin or Registrar only
 */
router.delete(
  '/sentry/:id',
  requireRole('super_admin', 'dept_head'),
  validate(deleteSentryRequestSchema),
  aideController.deleteSentryRequest
);

export default router;