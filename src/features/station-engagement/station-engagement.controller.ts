// ============================================================
// src/features/station-engagement/controllers/station-engagement.controller.ts
// ============================================================

import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { AppError, sendSuccess } from '../../utils/response';
import {
  createEngagementReportSchema,
  updateEngagementReportSchema,
  engagementReportFiltersSchema,
  idSchema,
  submitReportSchema,
  reviewReportSchema,
  generatePDFSchema,
} from './station-engagement.schema';
import { StationEngagementService } from './station-engagement.service';
import { StationEngagementExportService } from './station-engagement.export.service';
import { SuccessionCourtCategory } from '../successioncourts/succession-courts.types';

export const stationEngagementController = {

  // ─── Create Report ──────────────────────────────────────────────────────

  /**
   * POST /api/station-engagement/reports
   * Create a new engagement report
   */
  createReport: asyncHandler(async (req: Request, res: Response) => {
    const result = createEngagementReportSchema.safeParse({ body: req.body });
    if (!result.success) {
      throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid data');
    }

    const report = await StationEngagementService.createReport(
      result.data.body,
      req.user!.id
    );

    return sendSuccess(res, report, 'Engagement report created successfully', 201);
  }),

  // ─── Get All Reports ────────────────────────────────────────────────────

  /**
   * GET /api/station-engagement/reports
   * Get all engagement reports with optional filters (paginated)
   */
  getAllReports: asyncHandler(async (req: Request, res: Response) => {
    const result = engagementReportFiltersSchema.safeParse({ query: req.query });
    if (!result.success) {
      throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid filters');
    }

    const resultData = await StationEngagementService.findAll(result.data.query);
    return sendSuccess(res, resultData, 'Engagement reports retrieved');
  }),

  // ─── Get Report By ID ──────────────────────────────────────────────────

  /**
   * GET /api/station-engagement/reports/:id
   * Get a specific engagement report by ID
   */
  getReportById: asyncHandler(async (req: Request, res: Response) => {
    const result = idSchema.safeParse({ params: req.params });
    if (!result.success) {
      throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
    }

    const report = await StationEngagementService.findById(result.data.params.id);
    if (!report) {
      throw new AppError(404, 'Engagement report not found');
    }

    return sendSuccess(res, report, 'Engagement report retrieved');
  }),

  // ─── Get Report Summary ────────────────────────────────────────────────

  /**
   * GET /api/station-engagement/reports/:id/summary
   * Get a summary of a specific engagement report
   */
  getReportSummary: asyncHandler(async (req: Request, res: Response) => {
    const result = idSchema.safeParse({ params: req.params });
    if (!result.success) {
      throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
    }

    const summary = await StationEngagementService.getReportSummary(result.data.params.id);
    if (!summary) {
      throw new AppError(404, 'Engagement report not found');
    }

    return sendSuccess(res, summary, 'Report summary retrieved');
  }),

  // ─── Update Report ──────────────────────────────────────────────────────

  /**
   * PUT /api/station-engagement/reports/:id
   * Update an engagement report (draft or rejected only)
   */
  updateReport: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = idSchema.safeParse({ params: req.params });
    if (!paramsResult.success) {
      throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
    }

    const bodyResult = updateEngagementReportSchema.safeParse({ body: req.body });
    if (!bodyResult.success) {
      throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid data');
    }

    const report = await StationEngagementService.updateReport(
      paramsResult.data.params.id,
      bodyResult.data.body,
      req.user!.id
    );

    return sendSuccess(res, report, 'Engagement report updated successfully');
  }),

  // ─── Submit Report ──────────────────────────────────────────────────────

  /**
   * POST /api/station-engagement/reports/:id/submit
   * Submit an engagement report for review
   */
  submitReport: asyncHandler(async (req: Request, res: Response) => {
    const result = submitReportSchema.safeParse({ params: req.params });
    if (!result.success) {
      throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
    }

    const report = await StationEngagementService.submitReport(
      result.data.params.id,
      req.user!.id
    );

    return sendSuccess(res, report, 'Engagement report submitted successfully');
  }),

  // ─── Review Report ──────────────────────────────────────────────────────

  /**
   * POST /api/station-engagement/reports/:id/review
   * Review an engagement report (approve or reject)
   * This endpoint should be protected with admin/super_admin privileges
   */
  reviewReport: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = idSchema.safeParse({ params: req.params });
    if (!paramsResult.success) {
      throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
    }

    const bodyResult = reviewReportSchema.safeParse({ body: req.body });
    if (!bodyResult.success) {
      throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid data');
    }

    const report = await StationEngagementService.reviewReport(
      paramsResult.data.params.id,
      bodyResult.data.body,
      req.user!.id
    );

    const message = bodyResult.data.body.status === 'approved'
      ? 'Engagement report approved successfully'
      : 'Engagement report rejected successfully';

    return sendSuccess(res, report, message);
  }),

  // ─── Delete Report ──────────────────────────────────────────────────────

  /**
   * DELETE /api/station-engagement/reports/:id
   * Delete an engagement report (draft or rejected only)
   */
  deleteReport: asyncHandler(async (req: Request, res: Response) => {
    const result = idSchema.safeParse({ params: req.params });
    if (!result.success) {
      throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
    }

    await StationEngagementService.deleteReport(result.data.params.id);
    return sendSuccess(res, null, 'Engagement report deleted successfully');
  }),

  // ─── Get Engagement Stats ──────────────────────────────────────────────

  /**
   * GET /api/station-engagement/stats
   * Get engagement statistics with optional filters
   */
  getEngagementStats: asyncHandler(async (req: Request, res: Response) => {
    const { category, date_from, date_to } = req.query;

    // Validate category if provided
    let categoryValue: SuccessionCourtCategory | undefined;
    if (category) {
      if (Array.isArray(category)) {
        throw new AppError(400, 'category must be a single value');
      }
      const cat = category as string;
      if (!['A', 'B', 'C', 'D'].includes(cat)) {
        throw new AppError(400, 'category must be one of A, B, C, D');
      }
      categoryValue = cat as SuccessionCourtCategory;
    }

    const stats = await StationEngagementService.getEngagementStats(
      categoryValue,
      date_from as string | undefined,
      date_to as string | undefined
    );

    return sendSuccess(res, stats, 'Engagement stats retrieved');
  }),

  // ─── Get Reports By User ────────────────────────────────────────────────

  /**
   * GET /api/station-engagement/reports/user/:userId
   * Get reports submitted by a specific user (paginated)
   */
  getReportsByUser: asyncHandler(async (req: Request, res: Response) => {
    const userId = req.params.userId;
    
    // Ensure userId is a string (not string[])
    if (!userId || Array.isArray(userId)) {
      throw new AppError(400, 'Valid user ID is required');
    }

    const result = engagementReportFiltersSchema.safeParse({ query: req.query });
    if (!result.success) {
      throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid filters');
    }

    const resultData = await StationEngagementService.getReportsByUser(
      userId,
      result.data.query
    );

    return sendSuccess(res, resultData, 'User reports retrieved');
  }),

  // ─── Get Reports By Week ────────────────────────────────────────────────

  /**
   * GET /api/station-engagement/reports/week
   * Get reports for a specific week with optional filters
   */
  getReportsByWeek: asyncHandler(async (req: Request, res: Response) => {
    const { week_start, week_end } = req.query;

    if (!week_start || !week_end) {
      throw new AppError(400, 'week_start and week_end are required');
    }

    // Ensure they are strings
    if (Array.isArray(week_start) || Array.isArray(week_end)) {
      throw new AppError(400, 'week_start and week_end must be single values');
    }

    const result = engagementReportFiltersSchema.safeParse({ query: req.query });
    if (!result.success) {
      throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid filters');
    }

    const resultData = await StationEngagementService.getReportsByWeek(
      week_start as string,
      week_end as string,
      result.data.query
    );

    return sendSuccess(res, resultData, 'Week reports retrieved');
  }),

  // ─── Get Reports By Support Person ──────────────────────────────────────

  /**
   * GET /api/station-engagement/reports/support-person/:supportPersonId
   * Get reports assigned to a specific support person
   */
  getReportsBySupportPerson: asyncHandler(async (req: Request, res: Response) => {
    const supportPersonId = req.params.supportPersonId;
    
    if (!supportPersonId || Array.isArray(supportPersonId)) {
      throw new AppError(400, 'Valid support person ID is required');
    }

    // Reuse the filters schema but add support_person_id filter
    const result = engagementReportFiltersSchema.safeParse({ 
      query: { 
        ...req.query,
        support_person_id: supportPersonId 
      } 
    });
    if (!result.success) {
      throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid filters');
    }

    const resultData = await StationEngagementService.findAll(result.data.query);
    return sendSuccess(res, resultData, 'Support person reports retrieved');
  }),

  // ─── Generate PDF ───────────────────────────────────────────────────────

  /**
   * GET /api/station-engagement/reports/:id/pdf
   * Generate a PDF of the engagement report
   * Requires super_admin role
   */
  generatePDF: asyncHandler(async (req: Request, res: Response) => {
    const result = generatePDFSchema.safeParse({ params: req.params });
    if (!result.success) {
      throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
    }

    const pdfBuffer = await StationEngagementExportService.generatePDF(
      result.data.params.id,
      req.user!.id
    );

    const filename = `engagement-report-${result.data.params.id}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  }),

  // ─── Generate Excel ────────────────────────────────────────────────────

  /**
   * GET /api/station-engagement/reports/:id/excel
   * Generate an Excel spreadsheet of the engagement report
   * Requires super_admin role
   */
  generateExcel: asyncHandler(async (req: Request, res: Response) => {
    const result = generatePDFSchema.safeParse({ params: req.params });
    if (!result.success) {
      throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
    }

    const excelBuffer = await StationEngagementExportService.generateExcel(
      result.data.params.id,
      req.user!.id
    );

    const filename = `engagement-report-${result.data.params.id}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(excelBuffer);
  }),

  // ─── Generate Both PDF and Excel ──────────────────────────────────────

  /**
   * GET /api/station-engagement/reports/:id/export-all
   * Generate both PDF and Excel in a zip file
   * Requires super_admin role
   */
  generateBoth: asyncHandler(async (req: Request, res: Response) => {
    const result = generatePDFSchema.safeParse({ params: req.params });
    if (!result.success) {
      throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
    }

    const { pdf, excel } = await StationEngagementExportService.generateBoth(
      result.data.params.id,
      req.user!.id
    );

    // Create a zip file
    const AdmZip = require('adm-zip');
    const zip = new AdmZip();
    zip.addFile(`engagement-report-${result.data.params.id}.pdf`, pdf);
    zip.addFile(`engagement-report-${result.data.params.id}.xlsx`, excel);

    const zipBuffer = zip.toBuffer();
    const filename = `engagement-report-${result.data.params.id}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(zipBuffer);
  }),
};