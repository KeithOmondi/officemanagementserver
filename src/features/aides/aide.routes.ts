// src/features/aide/aide.routes.ts

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
} from './aide.validator';
import { validate } from '../../middleware/validate.middleware';

const router = Router();

// All routes require authentication
router.use(protect);

// ════════════════════════════════════════════════════════════════════════════
//  AIDE REQUEST ROUTES
// ════════════════════════════════════════════════════════════════════════════

// ── Read ──────────────────────────────────────────────────────────────────────

/**
 * @route   GET /api/v1/aide
 * @desc    Get all aide requests with pagination and filters
 * @access  Authenticated users (super_admin, registrar)
 */
router.get(
  '/',
  validate(listAideRequestsSchema),
  aideController.getAideRequests
);

/**
 * @route   GET /api/v1/aide/stats
 * @desc    Get aide request statistics
 * @access  Authenticated users (super_admin, registrar)
 */
router.get(
  '/stats',
  validate(getAideStatsSchema),
  aideController.getAideStats
);

/**
 * @route   GET /api/v1/aide/:id
 * @desc    Get a single aide request by ID
 * @access  Authenticated users (super_admin, registrar)
 * ⚠️ IMPORTANT: This must come AFTER /stats to avoid conflict
 */
router.get(
  '/:id',
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
  '/',
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
  '/:id',
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
  '/:id',
  requireRole('super_admin', 'dept_head'),
  validate(deleteAideRequestSchema),
  aideController.deleteAideRequest
);

export default router;