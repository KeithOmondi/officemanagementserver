// src/features/station-engagement/controllers/station-engagement.controller.ts

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
  downloadReportSchema,
  bulkExportSchema,
  exportStatusSchema,
  draftManagementSchema,
  pdfPreviewSchema,
} from './station-engagement.schema';
import { StationEngagementService } from './station-engagement.service';
import { StationEngagementExportService } from './station-engagement.export.service';
import { SuccessionCourtCategory } from '../successioncourts/succession-courts.types';
import type { SubmitReportToAdminPayload, PDFGenerationOptions } from './station-engagement.types';

export const stationEngagementController = {

  // ─── Create Report ──────────────────────────────────────────────────────

  /**
   * POST /api/station-engagement/reports
   * Create a new engagement report (can be saved as draft or submitted)
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

    const message = result.data.body.saveAsDraft
      ? 'Engagement report saved as draft successfully' 
      : 'Engagement report created successfully';

    return sendSuccess(res, report, message, 201);
  }),

  // ─── Get All Reports ────────────────────────────────────────────────────

  /**
   * GET /api/station-engagement/reports
   * Get all engagement reports with optional filters (paginated)
   * For super admin: use ?visibleToAdmin=true to exclude drafts
   * For support staff: use ?visibleToAdmin=false to see only drafts
   */
  getAllReports: asyncHandler(async (req: Request, res: Response) => {
    const result = engagementReportFiltersSchema.safeParse({ query: req.query });
    if (!result.success) {
      throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid data');
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
   * PDF can be attached regardless of status
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

  // ─── Save as Draft ──────────────────────────────────────────────────────

  /**
   * POST /api/station-engagement/reports/:id/draft
   * Save a report as draft (not visible to super admin)
   */
  saveAsDraft: asyncHandler(async (req: Request, res: Response) => {
    const result = idSchema.safeParse({ params: req.params });
    if (!result.success) {
      throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
    }

    const report = await StationEngagementService.saveAsDraft(
      result.data.params.id,
      req.user!.id
    );

    return sendSuccess(res, report, 'Report saved as draft successfully');
  }),

  // ─── Send to Super Admin ───────────────────────────────────────────────

  /**
   * POST /api/station-engagement/reports/:id/send-to-admin
   * Send a report to super admin for review (changes status from draft/rejected to submitted)
   * Requires that a PDF is attached to the report
   */
sendToAdmin: asyncHandler(async (req: Request, res: Response) => {
  console.log('🔍 [sendToAdmin] req.params:', req.params);
  console.log('🔍 [sendToAdmin] req.body:', req.body);

  const paramsResult = idSchema.safeParse({ params: req.params });
  if (!paramsResult.success) {
    console.error('❌ [sendToAdmin] Invalid params:', paramsResult.error.issues);
    throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
  }
  console.log('✅ [sendToAdmin] params validated:', paramsResult.data.params);

  // Parse optional body — use just the body sub-schema, not the whole submitReportSchema
  const bodyResult = submitReportSchema.shape.body.safeParse(req.body);
  if (!bodyResult.success) {
    console.error('❌ [sendToAdmin] Invalid body:', bodyResult.error.issues);
    throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid data');
  }
  console.log('✅ [sendToAdmin] body validated:', bodyResult.data);

  const payload: SubmitReportToAdminPayload = {
    reportId: paramsResult.data.params.id,
    sendNotification: bodyResult.data?.send_notification ?? true,
    notes: bodyResult.data?.notes ?? undefined,
  };
  console.log('🔍 [sendToAdmin] payload built:', payload);

  const report = await StationEngagementService.sendToAdmin(
    paramsResult.data.params.id,
    req.user!.id,
    payload
  );
  console.log('✅ [sendToAdmin] report sent successfully:', report?.id);

  return sendSuccess(res, report, 'Report sent to super admin successfully');
}),

  // ─── Submit Report (Legacy - keep for compatibility) ──────────────────

  /**
   * POST /api/station-engagement/reports/:id/submit
   * Submit an engagement report for review (legacy - use sendToAdmin instead)
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

  // ─── Download Report ────────────────────────────────────────────────────

  /**
   * GET /api/station-engagement/reports/:id/download
   * Download a report (PDF or Excel) with tracking
   */
  downloadReport: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = idSchema.safeParse({ params: req.params });
    if (!paramsResult.success) {
      throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
    }

    const queryResult = downloadReportSchema.safeParse({ query: req.query });
    if (!queryResult.success) {
      throw new AppError(400, queryResult.error.issues[0]?.message ?? 'Invalid query params');
    }

    const { format } = queryResult.data.query;

    // Track download and get file info
    const downloadInfo = await StationEngagementService.downloadReport(
      paramsResult.data.params.id,
      req.user!.id,
      format
    );

    // Generate the actual file based on format
    let fileBuffer: Buffer;
    let contentType: string;
    let fileName: string;

    if (format === 'pdf') {
      const pdfResult = await StationEngagementExportService.generatePDF(
        paramsResult.data.params.id,
        req.user!.id
      );
      // If it's a PDFGenerationResult (preview), convert to Buffer
      if (Buffer.isBuffer(pdfResult)) {
        fileBuffer = pdfResult;
      } else {
        // This shouldn't happen for download, but handle gracefully
        fileBuffer = Buffer.from(pdfResult.previewData || '', 'base64');
      }
      contentType = 'application/pdf';
      fileName = downloadInfo.fileName;
    } else {
      fileBuffer = await StationEngagementExportService.generateExcel(
        paramsResult.data.params.id,
        req.user!.id
      );
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      fileName = downloadInfo.fileName;
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', fileBuffer.length);
    res.send(fileBuffer);
  }),

  // ─── Generate PDF Preview ──────────────────────────────────────────────

// src/features/station-engagement/controllers/station-engagement.controller.ts

// ─── Generate PDF Preview ──────────────────────────────────────────────

// src/features/station-engagement/controllers/station-engagement.controller.ts

// ─── Generate PDF Preview ──────────────────────────────────────────────

/**
 * POST /api/station-engagement/reports/:id/pdf/preview
 * Generate a PDF preview (not persisted, not downloaded)
 * ✅ This can be called regardless of report status
 * Returns preview URL and data for in-browser preview
 */

generatePDFPreview: asyncHandler(async (req: Request, res: Response) => {
  console.log('🔍 [CONTROLLER] generatePDFPreview called');
  console.log('🔍 [CONTROLLER] Request params:', req.params);
  console.log('🔍 [CONTROLLER] Request body:', req.body);

  // ✅ Parse params separately
  const paramsResult = idSchema.safeParse({ params: req.params });
  if (!paramsResult.success) {
    console.error('❌ [CONTROLLER] Invalid params:', paramsResult.error);
    throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
  }
  console.log('✅ [CONTROLLER] Params validated:', paramsResult.data.params);

  // ✅ Parse body separately using pdfPreviewSchema's body schema
  const bodyData = req.body || {};
  console.log('🔍 [CONTROLLER] Body data:', bodyData);
  
  // ✅ Extract the body schema from pdfPreviewSchema
  const bodySchema = pdfPreviewSchema.shape.body;
  const bodyResult = bodySchema.safeParse(bodyData);
  
  if (!bodyResult.success) {
    console.error('❌ [CONTROLLER] Invalid body:', bodyResult.error);
    throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid data');
  }
  console.log('✅ [CONTROLLER] Body validated:', bodyResult.data);

  // ✅ Build preview options from body or use defaults
  const page = bodyResult.data?.page ?? 1;
  const scale = bodyResult.data?.scale ?? 1;
  
  const previewOptions: PDFGenerationOptions = {
    title: `Engagement Report Preview - Page ${page}`,
    showWatermark: true,
    watermarkText: 'PREVIEW',
    includeFooter: true,
    footerText: `Preview - Page ${page} of ?`,
  };

  const preview = await StationEngagementService.generatePDFPreview(
    paramsResult.data.params.id,
    req.user!.id,
    previewOptions
  );

  return sendSuccess(res, preview, 'PDF preview generated successfully');
}),

  // ─── Attach PDF to Report ──────────────────────────────────────────────

  /**
   * POST /api/station-engagement/reports/:id/pdf/attach
   * Attach a generated PDF to the report after preview confirmation
   * ✅ This can be called regardless of report status
   */
  attachPDF: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = idSchema.safeParse({ params: req.params });
    if (!paramsResult.success) {
      throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
    }

    const { publicId, secureUrl, fileName, generatedAt } = req.body;

    if (!publicId || !secureUrl) {
      throw new AppError(400, 'publicId and secureUrl are required');
    }

    const report = await StationEngagementService.attachPDF(
      paramsResult.data.params.id,
      {
        publicId,
        secureUrl,
        fileName: fileName || `engagement-report-${paramsResult.data.params.id}.pdf`,
        generatedAt: generatedAt || new Date().toISOString(),
      }
    );

    return sendSuccess(res, report, 'PDF attached to report successfully');
  }),

  // ─── Generate and Attach PDF ──────────────────────────────────────────

  /**
   * POST /api/station-engagement/reports/:id/pdf/generate-and-attach
   * Generate a PDF, upload to Cloudinary, and attach to report
   * ✅ This can be called regardless of report status
   */
  generateAndAttachPDF: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = idSchema.safeParse({ params: req.params });
    if (!paramsResult.success) {
      throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
    }

    const result = await StationEngagementService.generateAndUploadPDF(
      paramsResult.data.params.id,
      req.user!.id,
      { previewOnly: false }
    );

    return sendSuccess(res, result, 'PDF generated and attached successfully');
  }),

  // ─── Get Drafts by User ────────────────────────────────────────────────

  /**
   * GET /api/station-engagement/reports/drafts
   * Get all drafts for the current user
   */
  getDraftsByUser: asyncHandler(async (req: Request, res: Response) => {
    const result = engagementReportFiltersSchema.safeParse({ query: req.query });
    if (!result.success) {
      throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid filters');
    }

    const resultData = await StationEngagementService.getDraftsByUser(
      req.user!.id,
      result.data.query
    );

    return sendSuccess(res, resultData, 'Drafts retrieved successfully');
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

  // ─── Generate PDF (Legacy / Full) ──────────────────────────────────────

  /**
   * GET /api/station-engagement/reports/:id/pdf
   * Generate and download a PDF of the engagement report
   * ✅ This can be called regardless of report status
   * Deprecated: Use downloadReport with format=pdf instead
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

  // ─── Generate Excel (Legacy) ───────────────────────────────────────────

  /**
   * GET /api/station-engagement/reports/:id/excel
   * Generate and download an Excel spreadsheet of the engagement report
   * Deprecated: Use downloadReport with format=excel instead
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

  // ─── Bulk Export ────────────────────────────────────────────────────────

  /**
   * POST /api/station-engagement/reports/bulk-export
   * Export multiple reports in a zip file
   * Requires super_admin role
   */
  bulkExport: asyncHandler(async (req: Request, res: Response) => {
    const result = bulkExportSchema.safeParse({ body: req.body });
    if (!result.success) {
      throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid data');
    }

    const { report_ids, format, include_metadata } = result.data.body;

    // Generate exports for each report
    const exports = await Promise.all(
      report_ids.map(async (id) => {
        try {
          if (format === 'pdf' || format === 'both') {
            const pdf = await StationEngagementExportService.generatePDF(id, req.user!.id);
            return { id, pdf };
          }
          return null;
        } catch (error) {
          console.error(`Failed to export report ${id}:`, error);
          return null;
        }
      })
    );

    // Filter out failed exports
    const successfulExports = exports.filter((e) => e !== null);

    if (successfulExports.length === 0) {
      throw new AppError(400, 'No reports could be exported');
    }

    // Create zip with all exports
    const AdmZip = require('adm-zip');
    const zip = new AdmZip();

    for (const exp of successfulExports) {
      if (exp.pdf) {
        zip.addFile(`report-${exp.id}.pdf`, exp.pdf);
      }
    }

    // Add metadata file if requested
    if (include_metadata) {
      const metadata = {
        exported_at: new Date().toISOString(),
        exported_by: req.user!.id,
        total_reports: report_ids.length,
        successful_exports: successfulExports.length,
        report_ids: report_ids,
      };
      zip.addFile('metadata.json', Buffer.from(JSON.stringify(metadata, null, 2)));
    }

    const zipBuffer = zip.toBuffer();
    const filename = `engagement-reports-bulk-export-${Date.now()}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(zipBuffer);
  }),

  // ─── Draft Management ──────────────────────────────────────────────────

  /**
   * POST /api/station-engagement/reports/:id/draft/manage
   * Manage a draft (save, continue, discard, submit)
   */
  manageDraft: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = idSchema.safeParse({ params: req.params });
    if (!paramsResult.success) {
      throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
    }

    const bodyResult = draftManagementSchema.safeParse({ body: req.body });
    if (!bodyResult.success) {
      throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid data');
    }

    const { action, reason } = bodyResult.data.body;

    let report;
    let message = '';

    switch (action) {
      case 'save':
        report = await StationEngagementService.saveAsDraft(
          paramsResult.data.params.id,
          req.user!.id
        );
        message = 'Draft saved successfully';
        break;

      case 'continue':
        // Just get the current state - no status change
        report = await StationEngagementService.findById(paramsResult.data.params.id);
        if (!report) {
          throw new AppError(404, 'Draft not found');
        }
        message = 'Draft loaded successfully';
        break;

      case 'discard':
        await StationEngagementService.deleteReport(paramsResult.data.params.id);
        return sendSuccess(res, null, 'Draft discarded successfully');

      case 'submit':
        // Submit the draft to admin
        report = await StationEngagementService.sendToAdmin(
          paramsResult.data.params.id,
          req.user!.id,
          { 
            reportId: paramsResult.data.params.id,
            sendNotification: true, 
            notes: reason || undefined 
          }
        );
        message = 'Draft submitted to admin successfully';
        break;

      default:
        throw new AppError(400, 'Invalid action');
    }

    return sendSuccess(res, report, message);
  }),
};