// src/features/service-week/routes/service-week.routes.ts

import { Router } from 'express';
import { serviceWeekController } from './service-week.controller';
import { protect, requireRole } from '../../middleware/auth.middleware';

const router = Router();

// ─── Public Routes (no auth) ───────────────────────────────────────────────

/**
 * POST /api/service-week/reports
 * Create a new service week report (can be saved as draft or submitted)
 * Public — no login required. Anonymous submissions from the ServiceWeek
 * public frontend. created_by will be null for these.
 */
router.post('/reports', serviceWeekController.createReport);
router.get('/reports', serviceWeekController.getAllReports);
router.put('/reports/:id', serviceWeekController.updateReport);

/**
 * POST /api/service-week/reports/:id/submit
 * Submit a draft report (changes status from draft to submitted)
 */
router.post('/reports/:id/submit', serviceWeekController.submitReport);
router.get('/reports/:id/pdf', serviceWeekController.generatePDF);

// ─── Authenticated Routes ───────────────────────────────────────────────────
// Everything below still requires login until the anonymous-lookup
// mechanism (access token / reference code) is built.

router.use(protect);

/**
 * GET /api/service-week/reports
 * Get all service week reports with optional filters (paginated)
 * Query: station, judge_name, week_start, week_end, status, limit, offset
 */


/**
 * GET /api/service-week/reports/:id
 * Get a specific service week report by ID
 */
router.get('/reports/:id', serviceWeekController.getReportById);


/**
 * DELETE /api/service-week/reports/:id
 * Delete a service week report (draft only)
 */
router.delete('/reports/:id', serviceWeekController.deleteReport);

/**
 * GET /api/service-week/reports/:id/pdf
 * Generate and download PDF of the service week report
 */


export default router;