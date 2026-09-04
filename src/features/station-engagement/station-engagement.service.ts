// src/features/station-engagement/station-engagement.service.ts

import { pool } from '../../config/db';
import { AppError } from '../../utils/response';
import { SuccessionCourtCategory } from '../successioncourts/succession-courts.types';
import { uploadToCloudinary, deleteFromCloudinary } from '../../config/cloudinary';
import type {
  EngagementReportFilters,
  StationEngagementReport,
  CreateEngagementReportPayload,
  UpdateEngagementReportPayload,
  ReviewReportPayload,
  ReportSummary,
  EngagementStats,
  Urgency,
  SubmitReportToAdminPayload,
  //DownloadReportPayload,
  PDFGenerationOptions,
  PDFGenerationResult,
} from './station-engagement.types';
import { 
  isReportEditable, 
  isReportVisibleToSuperAdmin,
  canSendToAdmin,
  EDITABLE_REPORT_STATUSES,
  VISIBLE_TO_SUPER_ADMIN_STATUSES,
  SUBMITTABLE_STATUSES, // ✅ Add this import
} from './station-engagement.types';
import { StationEngagementExportService } from './station-engagement.export.service';

const ENGAGEMENT_REPORT_SELECT = `
  id, week_start, week_end, 
  categories, support_person_id, total_stations_assigned,
  executive_summary, engagements, unengaged_stations, escalations,
  additional_issues, recurring_patterns, priorities,
  pdf_public_id, pdf_secure_url, pdf_file_name, pdf_generated_at,
  pdf_preview_data, pdf_preview_url,
  submitted_by, submitted_at, reviewed_by, reviewed_at,
  approved_by, approved_at, status, feedback,
  sent_to_admin_at, sent_to_admin_by,
  download_count, last_downloaded_at,
  created_at, updated_at
`;

// Use full_name from the users table
const ENGAGEMENT_REPORT_SELECT_WITH_DISPLAY = `
  r.id, r.week_start, r.week_end, 
  r.categories, r.support_person_id, r.total_stations_assigned,
  r.executive_summary, r.engagements, r.unengaged_stations, r.escalations,
  r.additional_issues, r.recurring_patterns, r.priorities,
  r.pdf_public_id, r.pdf_secure_url, r.pdf_file_name, r.pdf_generated_at,
  r.pdf_preview_data, r.pdf_preview_url,
  r.submitted_by, r.submitted_at, r.reviewed_by, r.reviewed_at,
  r.approved_by, r.approved_at, r.status, r.feedback,
  r.sent_to_admin_at, r.sent_to_admin_by,
  r.download_count, r.last_downloaded_at,
  r.created_at, r.updated_at,
  submitter.full_name as submitted_by_display,
  reviewer.full_name as reviewed_by_display,
  approver.full_name as approved_by_display,
  sender.full_name as sent_to_admin_by_display
`;

export class StationEngagementService {
  // ─── Create Report ──────────────────────────────────────────────────────

  static async createReport(
    input: CreateEngagementReportPayload,
    userId: string
  ): Promise<StationEngagementReport> {
    this.validateWeekRange(input.week_start, input.week_end);
    this.validateEngagements(input.engagements);
    this.validateEscalations(input.escalations);

    // Determine status based on save_as_draft flag
    const status = input.saveAsDraft ? 'draft' : 'submitted';

    const { rows } = await pool.query(
      `INSERT INTO station_engagement_reports (
        week_start, week_end, categories, support_person_id, total_stations_assigned,
        executive_summary, engagements, unengaged_stations, escalations,
        additional_issues, recurring_patterns, priorities,
        pdf_preview_data,
        submitted_by, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING ${ENGAGEMENT_REPORT_SELECT}`,
      [
        input.week_start,
        input.week_end,
        JSON.stringify(input.categories),
        input.support_person_id,
        input.total_stations_assigned,
        input.executive_summary,
        JSON.stringify(input.engagements || []),
        JSON.stringify(input.unengaged_stations || []),
        JSON.stringify(input.escalations || []),
        input.additional_issues || '',
        input.recurring_patterns || '',
        input.priorities || '',
        input.pdfPreviewData || null,
        userId,
        status,
      ]
    );

    return await this.parseReportWithStationNames(rows[0]);
  }

  // ─── Find All Reports ──────────────────────────────────────────────────

  static async findAll(
    filters: EngagementReportFilters = {}
  ): Promise<{ data: StationEngagementReport[]; total: number; page: number; limit: number; totalPages: number }> {
    let query = `
      SELECT ${ENGAGEMENT_REPORT_SELECT_WITH_DISPLAY}
      FROM station_engagement_reports r
      LEFT JOIN users submitter ON submitter.id = r.submitted_by
      LEFT JOIN users reviewer ON reviewer.id = r.reviewed_by
      LEFT JOIN users approver ON approver.id = r.approved_by
      LEFT JOIN users sender ON sender.id = r.sent_to_admin_by
      WHERE 1=1
    `;
    const params: unknown[] = [];
    let paramCount = 1;

    // Filter by visibility to admin (super admin should not see drafts)
    if (filters.visibleToAdmin !== undefined) {
      if (filters.visibleToAdmin === true) {
        query += ` AND r.status = ANY($${paramCount}::text[])`;
        params.push(VISIBLE_TO_SUPER_ADMIN_STATUSES);
        paramCount++;
      } else if (filters.visibleToAdmin === false) {
        query += ` AND r.status = $${paramCount}`;
        params.push('draft');
        paramCount++;
      }
    }

    // Filter by draft only
    if (filters.isDraft !== undefined && filters.isDraft === true) {
      query += ` AND r.status = $${paramCount}`;
      params.push('draft');
      paramCount++;
    }

    if (filters.category) {
      query += ` AND r.categories @> $${paramCount}::jsonb`;
      params.push(JSON.stringify([filters.category]));
      paramCount++;
    }
    if (filters.urgency) {
      query += ` AND (
        EXISTS (
          SELECT 1 FROM jsonb_array_elements(r.engagements::jsonb) AS e
          WHERE e->>'urgency' = $${paramCount}
        )
        OR EXISTS (
          SELECT 1 FROM jsonb_array_elements(r.escalations::jsonb) AS esc
          WHERE esc->>'urgency' = $${paramCount}
        )
      )`;
      params.push(filters.urgency);
      paramCount++;
    }
    if (filters.status) {
      query += ` AND r.status = $${paramCount}`;
      params.push(filters.status);
      paramCount++;
    }
    if (filters.week_start) {
      query += ` AND r.week_start >= $${paramCount}`;
      params.push(filters.week_start);
      paramCount++;
    }
    if (filters.week_end) {
      query += ` AND r.week_end <= $${paramCount}`;
      params.push(filters.week_end);
      paramCount++;
    }
    if (filters.submitted_by) {
      query += ` AND r.submitted_by = $${paramCount}`;
      params.push(filters.submitted_by);
      paramCount++;
    }
    if (filters.support_person_id) {
      query += ` AND r.support_person_id = $${paramCount}`;
      params.push(filters.support_person_id);
      paramCount++;
    }

    // Get total count
    const countQuery = `
      SELECT COUNT(r.id) as total
      FROM station_engagement_reports r
      WHERE 1=1
    `;
    
    let countWhere = '';
    const countParams: unknown[] = [];
    let countParamCount = 1;

    // Add same filters to count query
    if (filters.visibleToAdmin !== undefined) {
      if (filters.visibleToAdmin === true) {
        countWhere += ` AND r.status = ANY($${countParamCount}::text[])`;
        countParams.push(VISIBLE_TO_SUPER_ADMIN_STATUSES);
        countParamCount++;
      } else if (filters.visibleToAdmin === false) {
        countWhere += ` AND r.status = $${countParamCount}`;
        countParams.push('draft');
        countParamCount++;
      }
    }

    if (filters.isDraft !== undefined && filters.isDraft === true) {
      countWhere += ` AND r.status = $${countParamCount}`;
      countParams.push('draft');
      countParamCount++;
    }

    if (filters.category) {
      countWhere += ` AND r.categories @> $${countParamCount}::jsonb`;
      countParams.push(JSON.stringify([filters.category]));
      countParamCount++;
    }
    if (filters.urgency) {
      countWhere += ` AND (
        EXISTS (
          SELECT 1 FROM jsonb_array_elements(r.engagements::jsonb) AS e
          WHERE e->>'urgency' = $${countParamCount}
        )
        OR EXISTS (
          SELECT 1 FROM jsonb_array_elements(r.escalations::jsonb) AS esc
          WHERE esc->>'urgency' = $${countParamCount}
        )
      )`;
      countParams.push(filters.urgency);
      countParamCount++;
    }
    if (filters.status) {
      countWhere += ` AND r.status = $${countParamCount}`;
      countParams.push(filters.status);
      countParamCount++;
    }
    if (filters.week_start) {
      countWhere += ` AND r.week_start >= $${countParamCount}`;
      countParams.push(filters.week_start);
      countParamCount++;
    }
    if (filters.week_end) {
      countWhere += ` AND r.week_end <= $${countParamCount}`;
      countParams.push(filters.week_end);
      countParamCount++;
    }
    if (filters.submitted_by) {
      countWhere += ` AND r.submitted_by = $${countParamCount}`;
      countParams.push(filters.submitted_by);
      countParamCount++;
    }
    if (filters.support_person_id) {
      countWhere += ` AND r.support_person_id = $${countParamCount}`;
      countParams.push(filters.support_person_id);
      countParamCount++;
    }

    const countResult = await pool.query(countQuery + countWhere, countParams);
    const total = parseInt(countResult.rows[0]?.total || '0', 10);

    const limit = filters.limit || 20;
    const page = Math.max(1, Math.floor((filters.offset || 0) / limit) + 1);
    const offset = (page - 1) * limit;

    query += ` ORDER BY r.week_start DESC, r.updated_at DESC`;
    query += ` LIMIT $${paramCount}`;
    params.push(limit);
    paramCount++;
    query += ` OFFSET $${paramCount}`;
    params.push(offset);

    const { rows } = await pool.query(query, params);
    const data = await Promise.all(rows.map(row => this.parseReportWithStationNames(row)));

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ─── Find By ID ────────────────────────────────────────────────────────

  static async findById(id: string): Promise<StationEngagementReport | null> {
    const { rows } = await pool.query(
      `SELECT ${ENGAGEMENT_REPORT_SELECT_WITH_DISPLAY}
       FROM station_engagement_reports r
       LEFT JOIN users submitter ON submitter.id = r.submitted_by
       LEFT JOIN users reviewer ON reviewer.id = r.reviewed_by
       LEFT JOIN users approver ON approver.id = r.approved_by
       LEFT JOIN users sender ON sender.id = r.sent_to_admin_by
       WHERE r.id = $1`,
      [id]
    );
    return rows[0] ? await this.parseReportWithStationNames(rows[0]) : null;
  }

  // ─── Update Report ─────────────────────────────────────────────────────

  static async updateReport(
    id: string,
    input: UpdateEngagementReportPayload,
    userId: string
  ): Promise<StationEngagementReport> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new AppError(404, 'Engagement report not found');
    }

    // ✅ Updated: Allow editing if status is draft OR rejected
    if (!isReportEditable(existing.status)) {
      throw new AppError(400, `Cannot update a report with status '${existing.status}'. Only draft or rejected reports can be edited.`);
    }

    if (input.engagements) {
      this.validateEngagements(input.engagements);
    }

    if (input.escalations) {
      this.validateEscalations(input.escalations);
    }

    const fields: string[] = [];
    const values: unknown[] = [];
    let paramCount = 1;

    const setField = (column: string, value: unknown, isJson: boolean = false) => {
      if (value !== undefined) {
        fields.push(`${column} = $${paramCount}`);
        values.push(isJson ? JSON.stringify(value) : value);
        paramCount++;
      }
    };

    setField('executive_summary', input.executive_summary);
    setField('engagements', input.engagements, true);
    setField('unengaged_stations', input.unengaged_stations, true);
    setField('escalations', input.escalations, true);
    setField('additional_issues', input.additional_issues);
    setField('recurring_patterns', input.recurring_patterns);
    setField('priorities', input.priorities);
    
    // PDF preview data
    setField('pdf_preview_data', input.pdfPreviewData);
    
    // ✅ PDF fields can be attached regardless of status
    setField('pdf_public_id', input.pdfPublicId);
    setField('pdf_secure_url', input.pdfSecureUrl);
    setField('pdf_file_name', input.pdfFileName);
    setField('pdf_generated_at', input.pdfGeneratedAt);

    // ✅ Status changes - only allow specific transitions
    if (input.status && input.status !== existing.status) {
      // Allow draft <-> rejected transitions (editable states)
      if (input.status === 'draft' && existing.status === 'rejected') {
        setField('status', 'draft');
        setField('feedback', null);
      } else if (input.status === 'rejected' && existing.status === 'draft') {
        // Rejected status can only be set by admin via review
        throw new AppError(400, 'Rejected status can only be set by a reviewer');
      } else if (existing.status === 'draft' || existing.status === 'rejected') {
        // Allow moving from draft/rejected to submitted (via send to admin)
        if (input.status === 'submitted') {
          // Validate PDF is attached before submitting
          if (!existing.pdfSecureUrl && !input.pdfSecureUrl) {
            throw new AppError(400, 'Cannot submit report without an attached PDF. Please generate and upload a PDF first.');
          }
          // Validate report has content
          const engagements = input.engagements || existing.engagements || [];
          const unengagedStations = input.unengaged_stations || existing.unengaged_stations || [];
          if (engagements.length === 0 && unengagedStations.length === 0) {
            throw new AppError(400, 'Cannot submit empty report. Add at least one engagement or unengaged station.');
          }
          setField('status', 'submitted');
          setField('submitted_at', new Date().toISOString());
          setField('submitted_by', userId);
          setField('sent_to_admin_at', new Date().toISOString());
          setField('sent_to_admin_by', userId);
        } else {
          setField('status', input.status);
        }
      } else {
        throw new AppError(400, `Cannot change status from '${existing.status}' to '${input.status}'`);
      }
    }

    if (fields.length === 0) {
      return existing;
    }

    fields.push(`updated_at = now()`);
    values.push(id);

    await pool.query(
      `UPDATE station_engagement_reports
       SET ${fields.join(', ')}
       WHERE id = $${paramCount}`,
      values
    );

    const updated = await this.findById(id);
    if (!updated) throw new AppError(500, 'Failed to update engagement report');
    return updated;
  }

  // ─── Save as Draft ────────────────────────────────────────────────────

  /**
   * Save report as draft (not visible to super admin)
   */
  static async saveAsDraft(
    id: string,
    userId: string
  ): Promise<StationEngagementReport> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new AppError(404, 'Engagement report not found');
    }

    if (existing.status !== 'draft' && existing.status !== 'rejected') {
      throw new AppError(400, `Cannot save report with status '${existing.status}' as draft`);
    }

    const { rows } = await pool.query(
      `UPDATE station_engagement_reports
       SET status = 'draft',
           updated_at = now()
       WHERE id = $1
       RETURNING ${ENGAGEMENT_REPORT_SELECT}`,
      [id]
    );

    return await this.parseReportWithStationNames(rows[0]);
  }

  // ─── Submit to Super Admin ─────────────────────────────────────────────

  /**
   * Send report to super admin for review
   * This changes the status from draft/rejected to submitted
   * Requires that a PDF is attached
   */
  static async sendToAdmin(
    id: string,
    userId: string,
    payload?: SubmitReportToAdminPayload
  ): Promise<StationEngagementReport> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new AppError(404, 'Engagement report not found');
    }

    // ✅ Check if report can be sent to admin
    if (!SUBMITTABLE_STATUSES.includes(existing.status as any)) {
      throw new AppError(400, `Cannot send report with status '${existing.status}' to admin. Only draft or rejected reports can be submitted.`);
    }

    // ✅ Validate that PDF is attached
    if (!existing.pdfSecureUrl) {
      throw new AppError(400, 'Cannot submit report without an attached PDF. Please generate and upload a PDF first.');
    }

    // ✅ Validate that report has content
    const engagements = existing.engagements || [];
    const unengagedStations = existing.unengaged_stations || [];
    if (engagements.length === 0 && unengagedStations.length === 0) {
      throw new AppError(400, 'Cannot submit empty report. Add at least one engagement or unengaged station.');
    }

    // ✅ Send to admin - status becomes 'submitted' (visible to admin)
    const { rows } = await pool.query(
      `UPDATE station_engagement_reports
       SET status = 'submitted',
           submitted_by = $1,
           submitted_at = now(),
           sent_to_admin_at = now(),
           sent_to_admin_by = $1,
           updated_at = now()
       WHERE id = $2
       RETURNING ${ENGAGEMENT_REPORT_SELECT}`,
      [userId, id]
    );

    const updated = await this.parseReportWithStationNames(rows[0]);

    // TODO: Send notification to super admin if requested
    if (payload?.sendNotification) {
      // await this.sendAdminNotification(updated, payload.notes);
    }

    return updated;
  }

  // ─── Submit Report (Legacy) ────────────────────────────────────────────

  static async submitReport(id: string, userId: string): Promise<StationEngagementReport> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new AppError(404, 'Engagement report not found');
    }

    if (existing.status === 'submitted' || existing.status === 'reviewed' || existing.status === 'approved') {
      throw new AppError(400, `Report with status '${existing.status}' cannot be submitted`);
    }

      if (!existing.pdfSecureUrl) {
    throw new AppError(400, 'Cannot submit report without an attached PDF. Please generate and upload a PDF first.');
  }

    const engagements = existing.engagements || [];
    const unengagedStations = existing.unengaged_stations || [];

    if (engagements.length === 0 && unengagedStations.length === 0) {
      throw new AppError(400, 'Cannot submit empty report. Add at least one engagement or unengaged station.');
    }

    this.validateWeekRange(existing.week_start, existing.week_end);

    const { rows } = await pool.query(
      `UPDATE station_engagement_reports
       SET status = 'submitted',
           submitted_by = $1,
           submitted_at = now(),
           sent_to_admin_at = now(),
           sent_to_admin_by = $1,
           updated_at = now()
       WHERE id = $2
       RETURNING ${ENGAGEMENT_REPORT_SELECT}`,
      [userId, id]
    );

    return await this.parseReportWithStationNames(rows[0]);
  }

  // ─── Review Report ─────────────────────────────────────────────────────

  static async reviewReport(
    id: string,
    input: ReviewReportPayload,
    reviewerId: string
  ): Promise<StationEngagementReport> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new AppError(404, 'Engagement report not found');
    }

    if (existing.status !== 'submitted') {
      throw new AppError(400, `Only submitted reports can be reviewed. Current status: ${existing.status}`);
    }

    const status = input.status;
    const feedback = input.feedback || '';

    let query = `
      UPDATE station_engagement_reports
      SET status = $1,
          feedback = $2,
          reviewed_by = $3,
          reviewed_at = now(),
          updated_at = now()
    `;

    const values: unknown[] = [status, feedback, reviewerId];

    if (status === 'approved') {
      query += `,
          approved_by = $4,
          approved_at = now()
      `;
      values.push(reviewerId);
      query += ` WHERE id = $5 RETURNING ${ENGAGEMENT_REPORT_SELECT}`;
    } else {
      query += ` WHERE id = $4 RETURNING ${ENGAGEMENT_REPORT_SELECT}`;
    }

    const { rows } = await pool.query(query, values);
    return await this.parseReportWithStationNames(rows[0]);
  }

  // ─── Delete Report ─────────────────────────────────────────────────────

  static async deleteReport(id: string): Promise<void> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new AppError(404, 'Engagement report not found');
    }

    if (!isReportEditable(existing.status)) {
      throw new AppError(400, `Cannot delete a report with status '${existing.status}'. Only draft or rejected reports can be deleted.`);
    }

    // Delete PDF from Cloudinary if exists
    if (existing.pdfPublicId) {
      try {
        await deleteFromCloudinary(existing.pdfPublicId, 'image');
      } catch (error) {
        console.error('Failed to delete PDF from Cloudinary:', error);
        // Continue with deletion even if Cloudinary fails
      }
    }

    await pool.query(
      `DELETE FROM station_engagement_reports WHERE id = $1`,
      [id]
    );
  }

  // ─── Download Report ───────────────────────────────────────────────────

  /**
   * Track report download and return download info
   */
  static async downloadReport(
    id: string,
    userId: string,
    format: 'pdf' | 'excel' = 'pdf'
  ): Promise<{ downloadUrl: string; fileName: string; publicId?: string }> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new AppError(404, 'Engagement report not found');
    }

    // Increment download counter
    await pool.query(
      `UPDATE station_engagement_reports
       SET download_count = COALESCE(download_count, 0) + 1,
           last_downloaded_at = now()
       WHERE id = $1`,
      [id]
    );

    // Log download activity
    await pool.query(
      `INSERT INTO report_downloads (
        report_id, user_id, format, downloaded_at, ip_address, user_agent
      ) VALUES ($1, $2, $3, now(), $4, $5)`,
      [
        id,
        userId,
        format,
        null, // ip_address (would come from request context)
        null, // user_agent (would come from request context)
      ]
    );

    const fileName = `engagement-report-${existing.week_start}-${existing.week_end}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;

    return {
      downloadUrl: existing.pdfSecureUrl || '',
      fileName,
      publicId: existing.pdfPublicId || undefined,
    };
  }

  // ─── Generate and Upload PDF ──────────────────────────────────────────

  /**
   * Generate PDF, upload to Cloudinary, and attach to report
   * ✅ This can be called regardless of report status
   */
  static async generateAndUploadPDF(
    id: string,
    userId: string,
    options?: PDFGenerationOptions & { previewOnly?: boolean }
  ): Promise<PDFGenerationResult> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new AppError(404, 'Engagement report not found');
    }

    // ✅ Allow PDF generation for any status except maybe approved
    // (But we'll allow it for approved too in case they want to regenerate)
    // Just prevent generating for non-existent reports

    // 1. Generate the PDF buffer
    const pdfResult = await StationEngagementExportService.generatePDF(
      id,
      userId,
      { ...options, previewOnly: options?.previewOnly || false }
    );

    // If preview only, return the preview data without uploading
    if (options?.previewOnly) {
      return pdfResult as PDFGenerationResult;
    }

    // 2. Upload to Cloudinary
    const buffer = pdfResult as Buffer;
    const fileName = `engagement-report-${existing.week_start}-${existing.week_end}.pdf`;
    const folder = `reports/engagement/${existing.week_start}`;

    // Create a file object for upload
    const file = {
      buffer: buffer,
      mimetype: 'application/pdf',
      originalname: fileName,
      size: buffer.length,
    } as Express.Multer.File;

    try {
      const uploadResult = await uploadToCloudinary(file, folder);

      // 3. Update report with Cloudinary URLs
      const report = await this.attachPDF(id, {
        publicId: uploadResult.public_id,
        secureUrl: uploadResult.secure_url,
        fileName: fileName,
        generatedAt: new Date().toISOString(),
      });

      return {
        success: true,
        pdfUrl: uploadResult.secure_url,
        downloadUrl: uploadResult.secure_url,
        fileName: fileName,
        fileSize: buffer.length,
        publicId: uploadResult.public_id,
        secureUrl: uploadResult.secure_url,
      };
    } catch (error) {
      console.error('Failed to upload PDF to Cloudinary:', error);
      throw new AppError(500, 'Failed to upload PDF. Please try again.');
    }
  }

  // ─── Generate PDF Preview ─────────────────────────────────────────────

/**
 * Generate a PDF preview (doesn't upload to Cloudinary, just returns preview data)
 */
static async generatePDFPreview(
  id: string,
  userId: string,
  options?: PDFGenerationOptions
): Promise<{ previewUrl: string; previewData: string }> {
  console.log('🔍 [SERVICE] generatePDFPreview called with id:', id);
  console.log('🔍 [SERVICE] Options:', options);
  
  const existing = await this.findById(id);
  if (!existing) {
    console.error('❌ [SERVICE] Report not found:', id);
    throw new AppError(404, 'Engagement report not found');
  }
  console.log('✅ [SERVICE] Report found:', existing.id, 'status:', existing.status);

  // Generate preview using the export service
  console.log('🔍 [SERVICE] Calling export service generatePreview...');
  const result = await StationEngagementExportService.generatePreview(
    id,
    userId,
    options
  );
  console.log('✅ [SERVICE] Export service result:', result);

  // Store preview data temporarily
  const previewUrl = `/api/station-engagement/reports/${id}/pdf/preview`;
  console.log('🔍 [SERVICE] Preview URL:', previewUrl);

  // Update report with preview data
  await pool.query(
    `UPDATE station_engagement_reports
     SET pdf_preview_data = $1,
         pdf_preview_url = $2
     WHERE id = $3`,
    [result.previewData, previewUrl, id]
  );
  console.log('✅ [SERVICE] Preview data saved to database');

  return {
    previewUrl,
    previewData: result.previewData || '',
  };
}

  // ─── Attach PDF to Report ─────────────────────────────────────────────

  /**
   * Attach a generated PDF to the report after preview confirmation
   * ✅ This can be called regardless of report status
   */
  static async attachPDF(
    id: string,
    pdfData: {
      publicId: string;
      secureUrl: string;
      fileName: string;
      generatedAt: string;
    }
  ): Promise<StationEngagementReport> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new AppError(404, 'Engagement report not found');
    }

    const { rows } = await pool.query(
      `UPDATE station_engagement_reports
       SET pdf_public_id = $1,
           pdf_secure_url = $2,
           pdf_file_name = $3,
           pdf_generated_at = $4,
           updated_at = now()
       WHERE id = $5
       RETURNING ${ENGAGEMENT_REPORT_SELECT}`,
      [
        pdfData.publicId,
        pdfData.secureUrl,
        pdfData.fileName,
        pdfData.generatedAt,
        id,
      ]
    );

    return await this.parseReportWithStationNames(rows[0]);
  }

  // ─── Get Report Summary ─────────────────────────────────────────────────

  static async getReportSummary(id: string): Promise<ReportSummary | null> {
    const { rows } = await pool.query(
      `SELECT
        r.id,
        r.week_start,
        r.week_end,
        r.categories,
        r.total_stations_assigned as total_stations,
        COALESCE(jsonb_array_length(r.engagements::jsonb), 0) as engaged_count,
        COALESCE(jsonb_array_length(r.unengaged_stations::jsonb), 0) as unengaged_count,
        COALESCE(jsonb_array_length(r.escalations::jsonb), 0) as escalated_count,
        r.status,
        r.submitted_by,
        r.submitted_at,
        r.pdf_secure_url as has_pdf,
        CASE 
          WHEN r.status = 'draft' THEN false 
          ELSE true 
        END as is_visible_to_admin
       FROM station_engagement_reports r
       WHERE r.id = $1`,
      [id]
    );

    if (!rows[0]) return null;

    const row = rows[0];
    return {
      id: row.id,
      week_start: row.week_start,
      week_end: row.week_end,
      categories: row.categories || [],
      total_stations: parseInt(row.total_stations, 10),
      engaged_count: parseInt(row.engaged_count, 10),
      unengaged_count: parseInt(row.unengaged_count, 10),
      escalated_count: parseInt(row.escalated_count, 10),
      status: row.status,
      submitted_by: row.submitted_by,
      submitted_at: row.submitted_at,
      isVisibleToAdmin: row.is_visible_to_admin,
      hasPdf: !!row.has_pdf,
    };
  }

  // ─── Get Engagement Stats ──────────────────────────────────────────────

  static async getEngagementStats(
    category?: SuccessionCourtCategory,
    dateFrom?: string,
    dateTo?: string
  ): Promise<EngagementStats> {
    let query = `
      SELECT
        COUNT(*) as total_reports,
        COUNT(DISTINCT CASE WHEN categories @> '["A"]'::jsonb THEN id END) as category_a,
        COUNT(DISTINCT CASE WHEN categories @> '["B"]'::jsonb THEN id END) as category_b,
        COUNT(DISTINCT CASE WHEN categories @> '["C"]'::jsonb THEN id END) as category_c,
        COUNT(DISTINCT CASE WHEN categories @> '["D"]'::jsonb THEN id END) as category_d,
        COUNT(CASE WHEN status = 'draft' THEN 1 END) as status_draft,
        COUNT(CASE WHEN status = 'submitted' THEN 1 END) as status_submitted,
        COUNT(CASE WHEN status = 'reviewed' THEN 1 END) as status_reviewed,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as status_approved,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as status_rejected,
        COUNT(CASE WHEN EXISTS (
          SELECT 1 FROM jsonb_array_elements(engagements::jsonb) AS e
          WHERE e->>'urgency' = 'high'
        ) OR EXISTS (
          SELECT 1 FROM jsonb_array_elements(escalations::jsonb) AS esc
          WHERE esc->>'urgency' = 'high'
        ) THEN 1 END) as urgency_high,
        COUNT(CASE WHEN EXISTS (
          SELECT 1 FROM jsonb_array_elements(engagements::jsonb) AS e
          WHERE e->>'urgency' = 'medium'
        ) OR EXISTS (
          SELECT 1 FROM jsonb_array_elements(escalations::jsonb) AS esc
          WHERE esc->>'urgency' = 'medium'
        ) THEN 1 END) as urgency_medium,
        COUNT(CASE WHEN EXISTS (
          SELECT 1 FROM jsonb_array_elements(engagements::jsonb) AS e
          WHERE e->>'urgency' = 'low'
        ) OR EXISTS (
          SELECT 1 FROM jsonb_array_elements(escalations::jsonb) AS esc
          WHERE esc->>'urgency' = 'low'
        ) THEN 1 END) as urgency_low,
        AVG(COALESCE(jsonb_array_length(engagements::jsonb), 0)) as avg_engagements,
        AVG(COALESCE(jsonb_array_length(escalations::jsonb), 0)) as avg_escalations,
        COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft_count,
        COUNT(CASE WHEN status != 'draft' THEN 1 END) as submitted_count,
        AVG(EXTRACT(EPOCH FROM (submitted_at - created_at)) / 86400) as avg_time_to_submit_days
      FROM station_engagement_reports
      WHERE 1=1
    `;

    const params: unknown[] = [];
    let paramCount = 1;

    if (category) {
      query += ` AND categories @> $${paramCount}::jsonb`;
      params.push(JSON.stringify([category]));
      paramCount++;
    }

    if (dateFrom) {
      query += ` AND week_start >= $${paramCount}`;
      params.push(dateFrom);
      paramCount++;
    }

    if (dateTo) {
      query += ` AND week_end <= $${paramCount}`;
      params.push(dateTo);
      paramCount++;
    }

    const { rows } = await pool.query(query, params);
    const stats = rows[0];

    return {
      total_reports: parseInt(stats.total_reports, 10) || 0,
      by_category: {
        A: parseInt(stats.category_a, 10) || 0,
        B: parseInt(stats.category_b, 10) || 0,
        C: parseInt(stats.category_c, 10) || 0,
        D: parseInt(stats.category_d, 10) || 0,
      },
      by_status: {
        draft: parseInt(stats.status_draft, 10) || 0,
        submitted: parseInt(stats.status_submitted, 10) || 0,
        reviewed: parseInt(stats.status_reviewed, 10) || 0,
        approved: parseInt(stats.status_approved, 10) || 0,
        rejected: parseInt(stats.status_rejected, 10) || 0,
      },
      by_urgency: {
        high: parseInt(stats.urgency_high, 10) || 0,
        medium: parseInt(stats.urgency_medium, 10) || 0,
        low: parseInt(stats.urgency_low, 10) || 0,
      },
      engagement_rate: parseFloat(stats.avg_engagements) || 0,
      escalation_rate: parseFloat(stats.avg_escalations) || 0,
      draft_count: parseInt(stats.draft_count, 10) || 0,
      submitted_count: parseInt(stats.submitted_count, 10) || 0,
      avg_time_to_submit_days: parseFloat(stats.avg_time_to_submit_days) || 0,
    };
  }

  // ─── Get Reports by User ────────────────────────────────────────────────

  static async getReportsByUser(
    userId: string,
    filters: EngagementReportFilters = {}
  ): Promise<{ data: StationEngagementReport[]; total: number }> {
    let query = `
      SELECT ${ENGAGEMENT_REPORT_SELECT_WITH_DISPLAY}
      FROM station_engagement_reports r
      LEFT JOIN users submitter ON submitter.id = r.submitted_by
      LEFT JOIN users reviewer ON reviewer.id = r.reviewed_by
      LEFT JOIN users approver ON approver.id = r.approved_by
      LEFT JOIN users sender ON sender.id = r.sent_to_admin_by
      WHERE r.submitted_by = $1
    `;
    const params: unknown[] = [userId];
    let paramCount = 2;

    if (filters.visibleToAdmin !== undefined) {
      if (filters.visibleToAdmin === true) {
        query += ` AND r.status = ANY($${paramCount}::text[])`;
        params.push(VISIBLE_TO_SUPER_ADMIN_STATUSES);
        paramCount++;
      } else if (filters.visibleToAdmin === false) {
        query += ` AND r.status = $${paramCount}`;
        params.push('draft');
        paramCount++;
      }
    }

    if (filters.category) {
      query += ` AND r.categories @> $${paramCount}::jsonb`;
      params.push(JSON.stringify([filters.category]));
      paramCount++;
    }
    if (filters.status) {
      query += ` AND r.status = $${paramCount}`;
      params.push(filters.status);
      paramCount++;
    }

    const countQuery = query.replace(
      `SELECT ${ENGAGEMENT_REPORT_SELECT_WITH_DISPLAY}`,
      'SELECT COUNT(r.id) as total'
    );
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0]?.total || '0', 10);

    query += ` ORDER BY r.week_start DESC, r.updated_at DESC`;

    const { rows } = await pool.query(query, params);
    const data = await Promise.all(rows.map(row => this.parseReportWithStationNames(row)));

    return { data, total };
  }

  // ─── Get Drafts by User ────────────────────────────────────────────────

  /**
   * Get all drafts for a specific user (not visible to admin)
   */
  static async getDraftsByUser(
    userId: string,
    filters: EngagementReportFilters = {}
  ): Promise<{ data: StationEngagementReport[]; total: number }> {
    return this.getReportsByUser(userId, {
      ...filters,
      status: 'draft',
      visibleToAdmin: false,
    });
  }

  // ─── Get Reports by Reviewer ────────────────────────────────────────────

  static async getReportsByReviewer(
    reviewerId: string,
    filters: EngagementReportFilters = {}
  ): Promise<StationEngagementReport[]> {
    let query = `
      SELECT ${ENGAGEMENT_REPORT_SELECT_WITH_DISPLAY}
      FROM station_engagement_reports r
      LEFT JOIN users submitter ON submitter.id = r.submitted_by
      LEFT JOIN users reviewer ON reviewer.id = r.reviewed_by
      LEFT JOIN users approver ON approver.id = r.approved_by
      LEFT JOIN users sender ON sender.id = r.sent_to_admin_by
      WHERE r.reviewed_by = $1
    `;
    const params: unknown[] = [reviewerId];
    let paramCount = 2;

    if (filters.category) {
      query += ` AND r.categories @> $${paramCount}::jsonb`;
      params.push(JSON.stringify([filters.category]));
      paramCount++;
    }
    if (filters.status) {
      query += ` AND r.status = $${paramCount}`;
      params.push(filters.status);
      paramCount++;
    }

    query += ` ORDER BY r.week_start DESC, r.updated_at DESC`;

    const { rows } = await pool.query(query, params);
    return await Promise.all(rows.map(row => this.parseReportWithStationNames(row)));
  }

  // ─── Get Reports by Week ────────────────────────────────────────────────

  static async getReportsByWeek(
    weekStart: string,
    weekEnd: string,
    filters: EngagementReportFilters = {}
  ): Promise<{ data: StationEngagementReport[]; total: number }> {
    let query = `
      SELECT ${ENGAGEMENT_REPORT_SELECT_WITH_DISPLAY}
      FROM station_engagement_reports r
      LEFT JOIN users submitter ON submitter.id = r.submitted_by
      LEFT JOIN users reviewer ON reviewer.id = r.reviewed_by
      LEFT JOIN users approver ON approver.id = r.approved_by
      LEFT JOIN users sender ON sender.id = r.sent_to_admin_by
      WHERE r.week_start = $1 AND r.week_end = $2
    `;
    const params: unknown[] = [weekStart, weekEnd];
    let paramCount = 3;

    if (filters.visibleToAdmin !== undefined) {
      if (filters.visibleToAdmin === true) {
        query += ` AND r.status = ANY($${paramCount}::text[])`;
        params.push(VISIBLE_TO_SUPER_ADMIN_STATUSES);
        paramCount++;
      } else if (filters.visibleToAdmin === false) {
        query += ` AND r.status = $${paramCount}`;
        params.push('draft');
        paramCount++;
      }
    }

    if (filters.category) {
      query += ` AND r.categories @> $${paramCount}::jsonb`;
      params.push(JSON.stringify([filters.category]));
      paramCount++;
    }
    if (filters.status) {
      query += ` AND r.status = $${paramCount}`;
      params.push(filters.status);
      paramCount++;
    }

    const countQuery = query.replace(
      `SELECT ${ENGAGEMENT_REPORT_SELECT_WITH_DISPLAY}`,
      'SELECT COUNT(r.id) as total'
    );
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0]?.total || '0', 10);

    query += ` ORDER BY r.categories ASC, r.updated_at DESC`;

    const { rows } = await pool.query(query, params);
    const data = await Promise.all(rows.map(row => this.parseReportWithStationNames(row)));

    return { data, total };
  }

  // ─── Helper Methods ─────────────────────────────────────────────────────

  private static validateWeekRange(weekStart: string, weekEnd: string): void {
    const start = new Date(weekStart);
    const end = new Date(weekEnd);
    const dayStart = start.getDay();
    const dayEnd = end.getDay();

    if (dayStart !== 1 || dayEnd !== 5) {
      throw new AppError(400, 'Week must start on Monday and end on Friday');
    }

    const diffTime = end.getTime() - start.getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    if (diffDays !== 4) {
      throw new AppError(400, 'Week must be exactly 5 days (Monday to Friday)');
    }
  }

  private static validateEngagements(engagements: any[]): void {
    if (!engagements || engagements.length === 0) return;

    for (const engagement of engagements) {
      if (engagement.status === 'escalated' && !engagement.urgency) {
        throw new AppError(400, `Engagement at station '${engagement.station_name}' has status 'escalated' but no urgency set`);
      }
      if (engagement.urgency && !engagement.why_needs_escalation) {
        throw new AppError(400, `Engagement at station '${engagement.station_name}' has urgency set but no escalation reason provided`);
      }
      if (!engagement.station_category) {
        throw new AppError(400, `Engagement at station '${engagement.station_name}' is missing station_category`);
      }
      // Validate walk_in mode is allowed
      if (engagement.mode && !['phone_call', 'whatsapp', 'email', 'physical_visit', 'webinar_followup', 'video_call', 'walk_in'].includes(engagement.mode)) {
        throw new AppError(400, `Invalid engagement mode '${engagement.mode}' for station '${engagement.station_name}'`);
      }
    }
  }

  private static validateEscalations(escalations: any[]): void {
    if (!escalations || escalations.length === 0) return;

    for (const escalation of escalations) {
      if (!escalation.urgency) {
        throw new AppError(400, `Escalation at station '${escalation.station_name}' is missing urgency`);
      }
    }
  }

  // ─── Parse Report with Station Names ───────────────────────────────────

  private static async parseReportWithStationNames(row: any): Promise<StationEngagementReport> {
    const report: StationEngagementReport = {
      id: row.id,
      week_start: row.week_start,
      week_end: row.week_end,
      categories: row.categories || [],
      support_person_id: row.support_person_id,
      total_stations_assigned: row.total_stations_assigned,
      executive_summary: row.executive_summary,
      engagements: row.engagements || [],
      unengaged_stations: row.unengaged_stations || [],
      escalations: row.escalations || [],
      additional_issues: row.additional_issues || '',
      recurring_patterns: row.recurring_patterns || '',
      priorities: row.priorities || '',
      pdfPublicId: row.pdf_public_id || null,
      pdfSecureUrl: row.pdf_secure_url || null,
      pdfFileName: row.pdf_file_name || null,
      pdfGeneratedAt: row.pdf_generated_at || null,
      pdfPreviewData: row.pdf_preview_data || null,
      pdfPreviewUrl: row.pdf_preview_url || null,
      sent_to_admin_at: row.sent_to_admin_at || null,
      sent_to_admin_by: row.sent_to_admin_by || null,
      download_count: parseInt(row.download_count, 10) || 0,
      last_downloaded_at: row.last_downloaded_at || null,
      submitted_by: row.submitted_by,
      submitted_at: row.submitted_at,
      reviewed_by: row.reviewed_by,
      reviewed_at: row.reviewed_at,
      approved_by: row.approved_by,
      approved_at: row.approved_at,
      status: row.status,
      feedback: row.feedback,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };

    // Collect all station IDs from engagements and unengaged stations
    const stationIds = new Set<string>();
    
    report.engagements?.forEach(e => {
      if (e.station_id) stationIds.add(e.station_id);
    });
    
    report.unengaged_stations?.forEach(s => {
      if (s.station_id) stationIds.add(s.station_id);
    });

    // Fetch station names from the database
    if (stationIds.size > 0) {
      const ids = Array.from(stationIds);
      const { rows: stationRows } = await pool.query(
        `SELECT id, station FROM succession_courts WHERE id = ANY($1)`,
        [ids]
      );
      
      const stationNameMap = new Map();
      stationRows.forEach(row => {
        stationNameMap.set(row.id, row.station);
      });

      // Update engagements with station names
      report.engagements = report.engagements.map(engagement => ({
        ...engagement,
        station_name: stationNameMap.get(engagement.station_id) || engagement.station_name || engagement.station_id,
      }));

      // Update unengaged stations with station names
      report.unengaged_stations = report.unengaged_stations.map(station => ({
        ...station,
        station_name: stationNameMap.get(station.station_id) || station.station_name || station.station_id,
      }));
    }

    // Attach display names as extra properties
    Object.assign(report, {
      submitted_by_display: row.submitted_by_display || row.submitted_by,
      reviewed_by_display: row.reviewed_by_display || row.reviewed_by,
      approved_by_display: row.approved_by_display || row.approved_by,
      sent_to_admin_by_display: row.sent_to_admin_by_display || row.sent_to_admin_by,
    });

    return report;
  }
}