// src/features/principal-registry-report/principal-registry-report.controller.ts
import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { AppError, sendSuccess } from '../../utils/response';
import { PrincipalRegistryReportService } from './principal-registry-report.service';
import {
  createReportSchema,
  updateReportSchema,
  reviewReportSchema,
  reportIdParamSchema,
  reportFiltersSchema,
  getQuestionsSchema,
  generatePdfSchema,
} from './principal-registry-report.validator';
import { ZodError } from 'zod';

// ─── Helper to format Zod errors ──────────────────────────────────────────────

function formatZodError(error: ZodError): string {
  return error.issues.map(issue => {
    const path = issue.path.join('.');
    return `${path}: ${issue.message}`;
  }).join('; ');
}

export const principalRegistryReportController = {

  // ═══════════════════════════════════════════════════════════════════════════
  //  PRINCIPAL REGISTRY WEEKLY REPORT CONTROLLERS
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Catalog / Questions ───────────────────────────────────────────────────

  getQuestions: asyncHandler(async (req: Request, res: Response) => {
    const result = getQuestionsSchema.safeParse({ query: req.query });
    if (!result.success) {
      throw new AppError(400, formatZodError(result.error));
    }

    const { departmentId } = result.data.query;
    const questions = await PrincipalRegistryReportService.getQuestions(departmentId);
    return sendSuccess(res, questions, 'Report questions retrieved successfully');
  }),

  // ── Create ────────────────────────────────────────────────────────────────────

  create: asyncHandler(async (req: Request, res: Response) => {
    const result = createReportSchema.safeParse({ body: req.body });
    if (!result.success) {
      throw new AppError(400, formatZodError(result.error));
    }
    
    const report = await PrincipalRegistryReportService.create(
      result.data.body, 
      req.user!.id
    );
    
    return sendSuccess(res, report, 'Weekly report created successfully', 201);
  }),

  // ── Read ──────────────────────────────────────────────────────────────────────

  getAll: asyncHandler(async (req: Request, res: Response) => {
    const result = reportFiltersSchema.safeParse({ query: req.query });
    if (!result.success) {
      throw new AppError(400, formatZodError(result.error));
    }
    
    const reports = await PrincipalRegistryReportService.findAll(result.data.query);
    return sendSuccess(res, reports, 'Weekly reports retrieved successfully');
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const result = reportIdParamSchema.safeParse({ params: req.params });
    if (!result.success) {
      throw new AppError(400, formatZodError(result.error));
    }
    
    const report = await PrincipalRegistryReportService.findById(result.data.params.id);
    if (!report) {
      throw new AppError(404, 'Report not found');
    }
    
    return sendSuccess(res, report, 'Weekly report retrieved successfully');
  }),

  // ── Update ────────────────────────────────────────────────────────────────────

  update: asyncHandler(async (req: Request, res: Response) => {
    const result = updateReportSchema.safeParse({ params: req.params, body: req.body });
    if (!result.success) {
      throw new AppError(400, formatZodError(result.error));
    }
    
    try {
      const report = await PrincipalRegistryReportService.update(
        result.data.params.id, 
        result.data.body
      );
      
      if (!report) {
        throw new AppError(404, 'Report not found');
      }
      
      return sendSuccess(res, report, 'Weekly report updated successfully');
    } catch (error: any) {
      // Handle specific database errors
      if (error.code === '23505') { // Unique violation
        throw new AppError(409, 'A report with this data already exists');
      }
      if (error.code === '23503') { // Foreign key violation
        throw new AppError(400, 'Invalid department or user reference');
      }
      throw error;
    }
  }),

  // ── Lifecycle ─────────────────────────────────────────────────────────────────

  submit: asyncHandler(async (req: Request, res: Response) => {
    const result = reportIdParamSchema.safeParse({ params: req.params });
    if (!result.success) {
      throw new AppError(400, formatZodError(result.error));
    }
    
    try {
      const { report, submission } = await PrincipalRegistryReportService.submitReport(
        result.data.params.id,
        req.user!.id
      );
      return sendSuccess(res, { report, submission }, 'Weekly report submitted successfully');
    } catch (error: any) {
      if (error.message?.includes('Invalid status transition')) {
        throw new AppError(400, error.message);
      }
      if (error.message?.includes('PDF')) {
        throw new AppError(400, error.message);
      }
      throw error;
    }
  }),

  review: asyncHandler(async (req: Request, res: Response) => {
    const result = reviewReportSchema.safeParse({ params: req.params, body: req.body });
    if (!result.success) {
      throw new AppError(400, formatZodError(result.error));
    }
    
    try {
      const report = await PrincipalRegistryReportService.review(
        result.data.params.id,
        result.data.body
      );
      
      if (!report) {
        throw new AppError(404, 'Report not found');
      }
      
      const actionText = result.data.body.action === 'approve' ? 'approved' : 'rejected back to draft';
      return sendSuccess(res, report, `Weekly report ${actionText} successfully`);
    } catch (error: any) {
      if (error.message?.includes('Invalid status transition')) {
        throw new AppError(400, error.message);
      }
      throw error;
    }
  }),

  archive: asyncHandler(async (req: Request, res: Response) => {
    const result = reportIdParamSchema.safeParse({ params: req.params });
    if (!result.success) {
      throw new AppError(400, formatZodError(result.error));
    }
    
    try {
      const report = await PrincipalRegistryReportService.setStatus(
        result.data.params.id, 
        'archived'
      );
      
      if (!report) {
        throw new AppError(404, 'Report not found');
      }
      
      return sendSuccess(res, report, 'Weekly report archived successfully');
    } catch (error: any) {
      if (error.message?.includes('Invalid status transition')) {
        throw new AppError(400, error.message);
      }
      throw error;
    }
  }),

  // ── PDF Generation ──────────────────────────────────────────────────────────

  generatePDF: asyncHandler(async (req: Request, res: Response) => {
    const result = generatePdfSchema.safeParse({ body: req.body });
    if (!result.success) {
      throw new AppError(400, formatZodError(result.error));
    }
    
    const pdfResult = await PrincipalRegistryReportService.generatePDF(
      result.data.body,
      req.user!.id
    );
    
    if (!pdfResult.success) {
      throw new AppError(500, pdfResult.error || 'Failed to generate PDF');
    }
    
    return sendSuccess(res, pdfResult, 'PDF generated successfully');
  }),

  getPDFMetadata: asyncHandler(async (req: Request, res: Response) => {
    const result = reportIdParamSchema.safeParse({ params: req.params });
    if (!result.success) {
      throw new AppError(400, formatZodError(result.error));
    }
    
    const metadata = await PrincipalRegistryReportService.getPDFMetadata(result.data.params.id);
    if (!metadata) {
      throw new AppError(404, 'PDF metadata not found for this report');
    }
    
    return sendSuccess(res, metadata, 'PDF metadata retrieved successfully');
  }),

  downloadPDF: asyncHandler(async (req: Request, res: Response) => {
    const result = reportIdParamSchema.safeParse({ params: req.params });
    if (!result.success) {
      throw new AppError(400, formatZodError(result.error));
    }
    
    const metadata = await PrincipalRegistryReportService.getPDFMetadata(result.data.params.id);
    if (!metadata) {
      throw new AppError(404, 'PDF not found for this report');
    }
    
    // Increment download count
    await PrincipalRegistryReportService.incrementDownloadCount(metadata.id);
    
    // Redirect to the secure URL from Cloudinary
    if (metadata.secureUrl) {
      return res.redirect(metadata.secureUrl);
    }
    
    throw new AppError(404, 'PDF file not found');
  }),

  // ── Submission Management ────────────────────────────────────────────────────

  getSubmission: asyncHandler(async (req: Request, res: Response) => {
    const result = reportIdParamSchema.safeParse({ params: req.params });
    if (!result.success) {
      throw new AppError(400, formatZodError(result.error));
    }
    
    const submission = await PrincipalRegistryReportService.getSubmission(result.data.params.id);
    return sendSuccess(res, submission, 'Submission retrieved successfully');
  }),

  reviewSubmission: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = reportIdParamSchema.safeParse({ params: req.params });
    if (!paramsResult.success) {
      throw new AppError(400, formatZodError(paramsResult.error));
    }
    
    const bodyResult = reviewReportSchema.safeParse({ body: req.body });
    if (!bodyResult.success) {
      throw new AppError(400, formatZodError(bodyResult.error));
    }
    
    const submission = await PrincipalRegistryReportService.reviewSubmission(
      paramsResult.data.params.id,
      bodyResult.data.body.action,
      bodyResult.data.body.reviewNotes,
      req.user!.id
    );
    
    if (!submission) {
      throw new AppError(404, 'Submission not found');
    }
    
    return sendSuccess(res, submission, 'Submission reviewed successfully');
  }),

  // ── Delete ────────────────────────────────────────────────────────────────────

  remove: asyncHandler(async (req: Request, res: Response) => {
    const result = reportIdParamSchema.safeParse({ params: req.params });
    if (!result.success) {
      throw new AppError(400, formatZodError(result.error));
    }
    
    const deleted = await PrincipalRegistryReportService.delete(result.data.params.id);
    if (!deleted) {
      throw new AppError(404, 'Report not found');
    }
    
    return sendSuccess(res, null, 'Weekly report deleted successfully');
  }),
};