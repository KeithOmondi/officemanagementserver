// src/features/service-week/controllers/service-week.controller.ts

import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { AppError, sendSuccess } from '../../utils/response';
import {
  createServiceWeekSchema,
  updateServiceWeekSchema,
  serviceWeekFiltersSchema,
  idSchema,
  submitServiceWeekSchema,
} from './service-week.schema';
import { ServiceWeekService } from './service-week.service';
import { ServiceWeekExportService } from './service-week.export.service';

export const serviceWeekController = {
  // ══════════════════════════════════════════════════════════════════════
  // PUBLIC (no-auth) — user side
  // ══════════════════════════════════════════════════════════════════════

  // ─── Create Report ──────────────────────────────────────────────────────

  createReport: asyncHandler(async (req: Request, res: Response) => {
    const result = createServiceWeekSchema.safeParse({ body: req.body });
    if (!result.success) {
      throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid data');
    }

    // No auth on this route — creator is always anonymous now.
    const report = await ServiceWeekService.createReport(result.data.body);

    const message = result.data.body.saveAsDraft
      ? 'Service week report saved as draft successfully'
      : 'Service week report submitted successfully';

    return sendSuccess(res, report, message, 201);
  }),

  // ─── Get Report By ID ─────────────────────────────────────────────────
  // Shared: public users fetch their own report (id is the only
  // "credential"); admins use this too when viewing from the browse list.

  getReportById: asyncHandler(async (req: Request, res: Response) => {
    const result = idSchema.safeParse({ params: req.params });
    if (!result.success) {
      throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
    }

    const report = await ServiceWeekService.findById(result.data.params.id);
    if (!report) {
      throw new AppError(404, 'Service week report not found');
    }

    return sendSuccess(res, report, 'Service week report retrieved');
  }),

  // ─── Update Report ─────────────────────────────────────────────────────

  updateReport: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = idSchema.safeParse({ params: req.params });
    if (!paramsResult.success) {
      throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
    }

    const bodyResult = updateServiceWeekSchema.safeParse({ body: req.body });
    if (!bodyResult.success) {
      throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid data');
    }

    const report = await ServiceWeekService.updateReport(
      paramsResult.data.params.id,
      bodyResult.data.body
    );

    return sendSuccess(res, report, 'Service week report updated successfully');
  }),

  // ─── Submit Report (Draft → Submitted) ──────────────────────────────

  submitReport: asyncHandler(async (req: Request, res: Response) => {
    const result = submitServiceWeekSchema.safeParse({ params: req.params });
    if (!result.success) {
      throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
    }

    const report = await ServiceWeekService.submitReport(result.data.params.id);

    return sendSuccess(res, report, 'Service week report submitted successfully');
  }),

  // ─── Generate PDF (single report) ───────────────────────────────────────
  // Shared: public user downloads their own report's PDF by id;
  // admin can also generate the PDF for any report from the browse list.

  generatePDF: asyncHandler(async (req: Request, res: Response) => {
    const result = idSchema.safeParse({ params: req.params });
    if (!result.success) {
      throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
    }

    const pdfBuffer = await ServiceWeekExportService.generatePDF(result.data.params.id);

    const filename = `service-week-report-${result.data.params.id}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  }),

  // ══════════════════════════════════════════════════════════════════════
  // ADMIN (auth required) — read + generate only, never creates/edits
  // ══════════════════════════════════════════════════════════════════════

  // ─── Get All Reports (browse/list) ──────────────────────────────────────

  getAllReports: asyncHandler(async (req: Request, res: Response) => {
    const result = serviceWeekFiltersSchema.safeParse({ query: req.query });
    if (!result.success) {
      throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid filters');
    }

    const resultData = await ServiceWeekService.findAll(result.data.query);
    return sendSuccess(res, resultData, 'Service week reports retrieved');
  }),

  // ─── Delete Report (moderation) ─────────────────────────────────────────

  deleteReport: asyncHandler(async (req: Request, res: Response) => {
    const result = idSchema.safeParse({ params: req.params });
    if (!result.success) {
      throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
    }

    await ServiceWeekService.deleteReport(result.data.params.id);
    return sendSuccess(res, null, 'Service week report deleted successfully');
  }),

  // ─── Generate Summary Report (aggregate PDF across submissions) ─────────

  generateSummaryReport: asyncHandler(async (req: Request, res: Response) => {
    const result = serviceWeekFiltersSchema.safeParse({ query: req.query });
    if (!result.success) {
      throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid filters');
    }

    const reports = await ServiceWeekService.findForSummary(result.data.query);
    if (reports.length === 0) {
      throw new AppError(404, 'No submitted reports found for the given filters');
    }

    const pdfBuffer = await ServiceWeekExportService.generateSummaryPDF(reports);

    const filename = `service-week-summary-${Date.now()}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  }),
};