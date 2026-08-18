// src/features/station-engagement/routes/station-engagement.routes.ts

import { Router } from 'express';
import { stationEngagementController } from './station-engagement.controller';
import { protect, requireRole } from '../../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(protect);

// ─── Report Management Routes ─────────────────────────────────────────────

/**
 * POST /api/station-engagement/reports
 * Create a new engagement report (can be saved as draft or submitted)
 * Access: Authenticated users (staff, dept_head, super_admin)
 */
router.post('/reports', stationEngagementController.createReport);

/**
 * GET /api/station-engagement/reports
 * Get all engagement reports with optional filters (paginated)
 * Supports: category, urgency, status, week_start, week_end, submitted_by, support_person_id, 
 *           visibleToAdmin, isDraft, limit, offset
 * Access: Authenticated users (staff can see their own, super_admin can see all)
 */
router.get('/reports', stationEngagementController.getAllReports);

/**
 * GET /api/station-engagement/reports/drafts
 * Get all drafts for the current user
 * Access: Authenticated users (staff, dept_head)
 */
router.get('/reports/drafts', stationEngagementController.getDraftsByUser);

/**
 * GET /api/station-engagement/reports/week
 * Get reports for a specific week with optional filters
 * Query: week_start, week_end, category, status, urgency, support_person_id, visibleToAdmin
 * Access: Authenticated users
 */
router.get('/reports/week', stationEngagementController.getReportsByWeek);

/**
 * GET /api/station-engagement/reports/user/:userId
 * Get reports submitted by a specific user (super_admin only)
 * Query: category, status, limit, offset, visibleToAdmin
 * Access: super_admin only
 */
router.get(
  '/reports/user/:userId',
  requireRole('super_admin'),
  stationEngagementController.getReportsByUser
);

/**
 * GET /api/station-engagement/reports/support-person/:supportPersonId
 * Get reports assigned to a specific support person
 * Query: category, status, urgency, week_start, week_end, limit, offset, visibleToAdmin
 * Access: Authenticated users
 */
router.get(
  '/reports/support-person/:supportPersonId',
  stationEngagementController.getReportsBySupportPerson
);

/**
 * GET /api/station-engagement/reports/:id
 * Get a specific engagement report by ID
 * Access: Authenticated users
 */
router.get('/reports/:id', stationEngagementController.getReportById);

/**
 * GET /api/station-engagement/reports/:id/summary
 * Get a summary of a specific engagement report
 * Access: Authenticated users
 */
router.get('/reports/:id/summary', stationEngagementController.getReportSummary);

/**
 * PUT /api/station-engagement/reports/:id
 * Update an engagement report (draft or rejected only)
 * Cannot update if status is 'submitted', 'reviewed', or 'approved'
 * Access: Authenticated users with appropriate permissions
 */
router.put(
  '/reports/:id', 
  requireRole('super_admin', 'staff', 'dept_head'), 
  stationEngagementController.updateReport
);

/**
 * DELETE /api/station-engagement/reports/:id
 * Delete an engagement report (draft or rejected only)
 * Access: Authenticated users with appropriate permissions
 */
router.delete(
  '/reports/:id',
  requireRole('super_admin', 'staff', 'dept_head'),
  stationEngagementController.deleteReport
);

/**
 * POST /api/station-engagement/reports/:id/draft
 * Save a report as draft (not visible to super admin)
 * Access: Authenticated users (staff, dept_head)
 */
router.post(
  '/reports/:id/draft',
  requireRole('staff', 'dept_head'),
  stationEngagementController.saveAsDraft
);

/**
 * ✅ POST /api/station-engagement/reports/:id/send-to-admin
 * Send a report to super admin for review (makes it visible to admin)
 * This changes status from draft/rejected to submitted
 * Requires: PDF must be attached and report must have content
 * Access: Staff and dept_head (they submit reports to super_admin)
 */
router.post(
  '/reports/:id/send-to-admin',
  requireRole('staff', 'dept_head'),
  stationEngagementController.sendToAdmin
);

/**
 * POST /api/station-engagement/reports/:id/submit
 * Submit an engagement report for review (legacy - use send-to-admin instead)
 * Validates that the report has at least one engagement or unengaged station
 * Access: Staff and dept_head
 */
router.post(
  '/reports/:id/submit',
  requireRole('staff', 'dept_head'),
  stationEngagementController.submitReport
);

/**
 * POST /api/station-engagement/reports/:id/review
 * Review an engagement report (approve or reject)
 * Access: super_admin only (they are the reviewers)
 */
router.post(
  '/reports/:id/review',
  requireRole('super_admin'),
  stationEngagementController.reviewReport
);

/**
 * POST /api/station-engagement/reports/:id/draft/manage
 * Manage a draft (save, continue, discard, submit)
 * Body: { action: 'save' | 'continue' | 'discard' | 'submit', reason?: string }
 * Access: Staff and dept_head (they manage their own drafts)
 */
router.post(
  '/reports/:id/draft/manage',
  requireRole('staff', 'dept_head'),
  stationEngagementController.manageDraft
);

// ─── PDF Management Routes ──────────────────────────────────────────────

/**
 * ✅ POST /api/station-engagement/reports/:id/pdf/preview
 * Generate a PDF preview (not persisted, not downloaded)
 * Returns preview URL and data for in-browser preview
 * ✅ Works regardless of report status
 * Access: Staff, dept_head, and super_admin (anyone who can view reports)
 */
router.post(
  '/reports/:id/pdf/preview',
  requireRole('super_admin', 'staff', 'dept_head'),
  stationEngagementController.generatePDFPreview
);

/**
 * ✅ POST /api/station-engagement/reports/:id/pdf/attach
 * Attach a generated PDF to the report after preview confirmation
 * Body: { publicId, secureUrl, fileName?, generatedAt? }
 * ✅ Works regardless of report status
 * Access: Staff, dept_head, and super_admin
 */
router.post(
  '/reports/:id/pdf/attach',
  requireRole('super_admin', 'staff', 'dept_head'),
  stationEngagementController.attachPDF
);

/**
 * ✅ POST /api/station-engagement/reports/:id/pdf/generate-and-attach
 * Generate PDF, upload to Cloudinary, and attach to report in one step
 * ✅ Works regardless of report status
 * Access: Staff, dept_head, and super_admin
 */
router.post(
  '/reports/:id/pdf/generate-and-attach',
  requireRole('super_admin', 'staff', 'dept_head'),
  stationEngagementController.generateAndAttachPDF
);

/**
 * GET /api/station-engagement/reports/:id/download
 * Download a report (PDF or Excel) with tracking
 * Query: format=pdf|excel (default: pdf)
 * Access: Staff, dept_head, and super_admin
 */
router.get(
  '/reports/:id/download',
  requireRole('super_admin', 'staff', 'dept_head'),
  stationEngagementController.downloadReport
);

/**
 * GET /api/station-engagement/reports/:id/pdf
 * Generate and download a PDF of the engagement report (legacy)
 * Deprecated: Use /reports/:id/download?format=pdf instead
 * Access: Staff, dept_head, and super_admin
 */
router.get(
  '/reports/:id/pdf',
  requireRole('super_admin', 'staff', 'dept_head'),
  stationEngagementController.generatePDF
);

/**
 * GET /api/station-engagement/reports/:id/excel
 * Generate and download an Excel spreadsheet of the engagement report (legacy)
 * Deprecated: Use /reports/:id/download?format=excel instead
 * Access: Staff, dept_head, and super_admin
 */
router.get(
  '/reports/:id/excel',
  requireRole('super_admin', 'staff', 'dept_head'),
  stationEngagementController.generateExcel
);

/**
 * GET /api/station-engagement/reports/:id/export-all
 * Generate both PDF and Excel in a zip file
 * Access: Staff, dept_head, and super_admin
 */
router.get(
  '/reports/:id/export-all',
  requireRole('super_admin', 'staff', 'dept_head'),
  stationEngagementController.generateBoth
);

// ─── Bulk Export Routes ──────────────────────────────────────────────────

/**
 * POST /api/station-engagement/reports/bulk-export
 * Export multiple reports in a zip file
 * Body: { report_ids: string[], format: 'pdf'|'excel'|'both', include_metadata: boolean }
 * Access: Staff, dept_head, and super_admin
 */
router.post(
  '/reports/bulk-export',
  requireRole('super_admin', 'staff', 'dept_head'),
  stationEngagementController.bulkExport
);

// ─── Statistics Routes ────────────────────────────────────────────────────

/**
 * GET /api/station-engagement/stats
 * Get engagement statistics with optional filters
 * Query: category, date_from, date_to
 * Returns: total_reports, by_category, by_status, by_urgency, engagement_rate, 
 *          escalation_rate, draft_count, submitted_count, avg_time_to_submit_days
 * Access: Authenticated users
 */
router.get('/stats', stationEngagementController.getEngagementStats);

// ─── Health Check / Debug Routes ─────────────────────────────────────────

/**
 * GET /api/station-engagement/health
 * Health check endpoint
 * Access: Public
 */
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'station-engagement',
    timestamp: new Date().toISOString()
  });
});

export default router;