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

// Review a submission (approve/reject)
router.patch(
  '/submissions/:submissionId/review',
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