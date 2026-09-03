// principal-registry-report.routes.ts
import { Router } from 'express';
import { principalRegistryReportController } from './principal-registry-report.controller';
import { protect, requireRole } from '../../middleware/auth.middleware';

const router = Router();

router.use(protect);

// ── Question Catalog ─────────────────────────────────────────────────────────

// Placed before /:id so Express routes 'questions' correctly instead of treating it as an ID
router.get(
  '/questions',
  requireRole('staff', 'dept_head', 'super_admin'),
  principalRegistryReportController.getQuestions
);

// ═══════════════════════════════════════════════════════════════════════════
//  ⚠️ SENSITIZATION ROUTES - MUST COME BEFORE /:id ROUTES
// ═══════════════════════════════════════════════════════════════════════════

// ── Sensitization CRUD Operations ──────────────────────────────────────────

// Create a new sensitization
router.post(
  '/sensitizations',
  requireRole('staff', 'dept_head', 'super_admin'),
  principalRegistryReportController.createSensitization
);

// Get all sensitizations (with filters)
router.get(
  '/sensitizations',
  requireRole('staff', 'dept_head', 'super_admin', 'viewer'),
  principalRegistryReportController.getAllSensitizations
);

// Get a specific sensitization by ID
router.get(
  '/sensitizations/:id',
  requireRole('staff', 'dept_head', 'super_admin', 'viewer'),
  principalRegistryReportController.getSensitizationById
);

// Update a sensitization (draft only)
router.patch(
  '/sensitizations/:id',
  requireRole('staff', 'dept_head', 'super_admin'),
  principalRegistryReportController.updateSensitization
);

// Delete a sensitization (draft only)
router.delete(
  '/sensitizations/:id',
  requireRole('staff', 'dept_head', 'super_admin'),
  principalRegistryReportController.deleteSensitization
);

// ── Sensitization Lifecycle Transitions ─────────────────────────────────────

// Submit a sensitization for approval (draft → submitted)
router.post(
  '/sensitizations/:id/submit',
  requireRole('staff', 'dept_head', 'super_admin'),
  principalRegistryReportController.submitSensitization
);

// Approve a sensitization (submitted → approved)
router.post(
  '/sensitizations/:id/approve',
  requireRole('dept_head', 'super_admin'),
  principalRegistryReportController.approveSensitization
);

// Reject a sensitization (submitted → draft)
router.post(
  '/sensitizations/:id/reject',
  requireRole('dept_head', 'super_admin'),
  principalRegistryReportController.rejectSensitization
);

// ── CRUD Operations ──────────────────────────────────────────────────────────

// Create
router.post(
  '/',
  requireRole('staff', 'dept_head', 'super_admin'),
  principalRegistryReportController.create
);

// Read
router.get(
  '/',
  requireRole('staff', 'dept_head', 'super_admin'),
  principalRegistryReportController.getAll
);

// ⚠️ These :id routes must come AFTER the sensitization routes
router.get(
  '/:id',
  requireRole('staff', 'dept_head', 'super_admin'),
  principalRegistryReportController.getById
);

// Update
router.patch(
  '/:id',
  requireRole('staff', 'dept_head', 'super_admin'),
  principalRegistryReportController.update
);

// ── Lifecycle Transitions ────────────────────────────────────────────────────

// Submit a report (draft → submitted) - generates PDF and creates submission record
router.post(
  '/:id/submit',
  requireRole('staff', 'dept_head', 'super_admin'),
  principalRegistryReportController.submit
);

// Review a report (submitted → reviewed)
router.post(
  '/:id/review',
  requireRole('dept_head', 'super_admin'),
  principalRegistryReportController.review
);

// Archive a report (reviewed → archived)
router.post(
  '/:id/archive',
  requireRole('dept_head', 'super_admin'),
  principalRegistryReportController.archive
);

// ── PDF Generation ───────────────────────────────────────────────────────────

// Generate PDF for a report
router.post(
  '/generate-pdf',
  requireRole('staff', 'dept_head', 'super_admin'),
  principalRegistryReportController.generatePDF
);

// Get PDF metadata for a report
router.get(
  '/:id/pdf-metadata',
  requireRole('staff', 'dept_head', 'super_admin', 'viewer'),
  principalRegistryReportController.getPDFMetadata
);

// Download PDF (redirects to Cloudinary secure URL)
router.get(
  '/:id/download-pdf',
  requireRole('staff', 'dept_head', 'super_admin', 'viewer'),
  principalRegistryReportController.downloadPDF
);

// ── Submission Management ────────────────────────────────────────────────────

// Get submission status for a report
router.get(
  '/:id/submission',
  requireRole('staff', 'dept_head', 'super_admin', 'viewer'),
  principalRegistryReportController.getSubmission
);

// ─── FIX: Use consistent route pattern ──────────────────────────────────────
// Review a submission (approve/reject) - uses :id (report ID) instead of :submissionId
// The controller will need to be updated to accept report ID and find the latest submission
router.patch(
  '/:id/submission/review',
  requireRole('dept_head', 'super_admin'),
  principalRegistryReportController.reviewSubmission
);

// ── Delete ───────────────────────────────────────────────────────────────────

router.delete(
  '/:id',
  requireRole('dept_head', 'super_admin'),
  principalRegistryReportController.remove
);

export default router;