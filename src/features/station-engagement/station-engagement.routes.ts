// ============================================================
// src/features/station-engagement/routes/station-engagement.routes.ts
// ============================================================

import { Router } from 'express';
import { stationEngagementController } from './station-engagement.controller';
import { protect, requireRole } from '../../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(protect);

// ─── Report Management Routes ─────────────────────────────────────────────

/**
 * POST /api/station-engagement/reports
 * Create a new engagement report
 */
router.post('/reports', stationEngagementController.createReport);

/**
 * GET /api/station-engagement/reports
 * Get all engagement reports with optional filters (paginated)
 * Supports: category, urgency, status, week_start, week_end, submitted_by, support_person_id, limit, offset
 */
router.get('/reports', stationEngagementController.getAllReports);

/**
 * GET /api/station-engagement/reports/week
 * Get reports for a specific week with optional filters
 * Query: week_start, week_end, category, status, urgency, support_person_id
 */
router.get('/reports/week', stationEngagementController.getReportsByWeek);

/**
 * GET /api/station-engagement/reports/user/:userId
 * Get reports submitted by a specific user (super_admin only)
 * Query: category, status, limit, offset
 */
router.get(
  '/reports/user/:userId',
  requireRole('super_admin'),
  stationEngagementController.getReportsByUser
);

/**
 * GET /api/station-engagement/reports/support-person/:supportPersonId
 * Get reports assigned to a specific support person
 * Query: category, status, urgency, week_start, week_end, limit, offset
 */
router.get(
  '/reports/support-person/:supportPersonId',
  stationEngagementController.getReportsBySupportPerson
);

/**
 * GET /api/station-engagement/reports/:id
 * Get a specific engagement report by ID
 */
router.get('/reports/:id', stationEngagementController.getReportById);

/**
 * GET /api/station-engagement/reports/:id/summary
 * Get a summary of a specific engagement report
 */
router.get('/reports/:id/summary', stationEngagementController.getReportSummary);

/**
 * PUT /api/station-engagement/reports/:id
 * Update an engagement report (draft or rejected only)
 * Cannot update if status is 'submitted', 'reviewed', or 'approved'
 */
router.put('/reports/:id', stationEngagementController.updateReport);

/**
 * DELETE /api/station-engagement/reports/:id
 * Delete an engagement report (draft or rejected only)
 */
router.delete('/reports/:id', stationEngagementController.deleteReport);

/**
 * POST /api/station-engagement/reports/:id/submit
 * Submit an engagement report for review
 * Validates that the report has at least one engagement or unengaged station
 */
router.post('/reports/:id/submit', stationEngagementController.submitReport);

/**
 * POST /api/station-engagement/reports/:id/review
 * Review an engagement report (approve or reject)
 * Requires super_admin role
 */
router.post(
  '/reports/:id/review',
  requireRole('super_admin'),
  stationEngagementController.reviewReport
);

/**
 * GET /api/station-engagement/reports/:id/pdf
 * Generate a PDF of the engagement report
 * Requires super_admin role
 */
router.get(
  '/reports/:id/pdf',
  requireRole('super_admin'),
  stationEngagementController.generatePDF
);

// ─── Statistics Routes ────────────────────────────────────────────────────

/**
 * GET /api/station-engagement/stats
 * Get engagement statistics with optional filters
 * Query: category, date_from, date_to
 * Returns: total_reports, by_category, by_status, by_urgency, engagement_rate, escalation_rate
 */
router.get('/stats', stationEngagementController.getEngagementStats);

// ─── Health Check / Debug Routes ─────────────────────────────────────────

// ============================================================
// src/features/station-engagement/routes/station-engagement.routes.ts
// ============================================================

// Add these new routes after the existing routes

/**
 * GET /api/station-engagement/reports/:id/pdf
 * Generate a PDF of the engagement report
 * Requires super_admin role
 */
router.get(
  '/reports/:id/pdf',
  requireRole('super_admin'),
  stationEngagementController.generatePDF
);

/**
 * GET /api/station-engagement/reports/:id/excel
 * Generate an Excel spreadsheet of the engagement report
 * Requires super_admin role
 */
router.get(
  '/reports/:id/excel',
  requireRole('super_admin'),
  stationEngagementController.generateExcel
);

/**
 * GET /api/station-engagement/reports/:id/export-all
 * Generate both PDF and Excel in a zip file
 * Requires super_admin role
 */
router.get(
  '/reports/:id/export-all',
  requireRole('super_admin'),
  stationEngagementController.generateBoth
);

export default router;