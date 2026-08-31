// src/features/service-week/routes/service-week.routes.ts

import { Router } from 'express';
import { serviceWeekController } from './service-week.controller';
import { protect } from '../../middleware/auth.middleware';

const router = Router();

// ═══════════════════════════════════════════════════════════════════════
// PUBLIC ROUTES (no authentication required)
// These are used by the public-facing form for creating, viewing, 
// and editing drafts
// ═══════════════════════════════════════════════════════════════════════

/**
 * POST /api/service-week/reports
 * Create a new service week report (draft or submitted)
 * Public — no login required
 */
router.post('/reports', serviceWeekController.createReport);

/**
 * GET /api/service-week/reports
 * Get all reports (with filters) - public view
 */
router.get('/reports', serviceWeekController.getAllReports);

/**
 * GET /api/service-week/reports/:id
 * Get a specific report by ID
 * Public - allows viewing both drafts and submitted reports
 * MOVED TO PUBLIC SECTION TO FIX 401 ERROR ON EDIT
 */
router.get('/reports/:id', serviceWeekController.getReportById);

/**
 * PUT /api/service-week/reports/:id
 * Update a report (drafts only)
 * Public - uses report ID as the identifier
 * Submitted reports cannot be edited
 */
router.put('/reports/:id', serviceWeekController.updateReport);

/**
 * POST /api/service-week/reports/:id/submit
 * Submit a draft (draft → submitted)
 * Public - anyone with the draft ID can submit it
 */
router.post('/reports/:id/submit', serviceWeekController.submitReport);

/**
 * GET /api/service-week/reports/:id/pdf
 * Generate PDF for a report
 * Public - anyone with the report ID can download
 */
router.get('/reports/:id/pdf', serviceWeekController.generatePDF);

// ═══════════════════════════════════════════════════════════════════════
// PROTECTED ROUTES (authentication required)
// Admin-only operations for managing reports
// ═══════════════════════════════════════════════════════════════════════

// All routes below this line require authentication
router.use(protect);

/**
 * DELETE /api/service-week/reports/:id
 * Delete a report (drafts only)
 * Admin only - requires authentication
 */
router.delete('/reports/:id', serviceWeekController.deleteReport);

export default router;