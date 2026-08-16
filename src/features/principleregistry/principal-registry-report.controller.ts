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

export const principalRegistryReportController = {

  // ═══════════════════════════════════════════════════════════════════════════
  //  PRINCIPAL REGISTRY WEEKLY REPORT CONTROLLERS
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Catalog / Questions ───────────────────────────────────────────────────

  getQuestions: asyncHandler(async (req: Request, res: Response) => {
    const result = getQuestionsSchema.safeParse({ query: req.query });
    if (!result.success) {
      throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid query parameters');
    }

    const { departmentId } = result.data.query;
    const questions = await PrincipalRegistryReportService.getQuestions(departmentId);
    return sendSuccess(res, questions, 'Report questions retrieved successfully');
  }),

  // ── Create ────────────────────────────────────────────────────────────────────

  create: asyncHandler(async (req: Request, res: Response) => {
    const result = createReportSchema.safeParse({ body: req.body });
    if (!result.success) {
      throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid report data');
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
      throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid filters');
    }
    const reports = await PrincipalRegistryReportService.findAll(result.data.query);
    return sendSuccess(res, reports, 'Weekly reports retrieved successfully');
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const result = reportIdParamSchema.safeParse({ params: req.params });
    if (!result.success) {
      throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
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
      throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid update data');
    }
    const report = await PrincipalRegistryReportService.update(
      result.data.params.id, 
      result.data.body
    );
    if (!report) {
      throw new AppError(404, 'Report not found');
    }
    return sendSuccess(res, report, 'Weekly report updated successfully');
  }),

  // ── Lifecycle ─────────────────────────────────────────────────────────────────

  submit: asyncHandler(async (req: Request, res: Response) => {
    const result = reportIdParamSchema.safeParse({ params: req.params });
    if (!result.success) {
      throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
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
      throw error;
    }
  }),

  review: asyncHandler(async (req: Request, res: Response) => {
    const result = reviewReportSchema.safeParse({ params: req.params, body: req.body });
    if (!result.success) {
      throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid review data');
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
      throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
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
      throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid PDF generation request');
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
      throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
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
      throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
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
      throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
    }
    
    const submission = await PrincipalRegistryReportService.getSubmission(result.data.params.id);
    return sendSuccess(res, submission, 'Submission retrieved successfully');
  }),

  reviewSubmission: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = reportIdParamSchema.safeParse({ params: req.params });
    if (!paramsResult.success) {
      throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid submission ID');
    }
    
    const bodyResult = reviewReportSchema.safeParse({ body: req.body });
    if (!bodyResult.success) {
      throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid review data');
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
      throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
    }
    const deleted = await PrincipalRegistryReportService.delete(result.data.params.id);
    if (!deleted) {
      throw new AppError(404, 'Report not found');
    }
    return sendSuccess(res, null, 'Weekly report deleted successfully');
  }),
};