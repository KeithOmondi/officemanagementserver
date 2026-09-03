// principal-registry-report.service.ts
// Adjust the `pool` import to wherever OFFICE_SYSTEM's pg Pool is configured
// (e.g. `import { pool } from '../../config/db';`).

import { uploadToCloudinary } from '../../config/cloudinary';
import { pool } from '../../config/db';
import PDFGeneratorService from './pdf-generator.service';
import {
  PrincipalRegistryWeeklyReport,
  ReportListFilters,
  ReportQuestion,
  ReportStatus,
  ReportSubmission,
  PDFReportMetadata,
  PDFGenerationResult,
  SensitizationInput,
  SensitizationResponse,
  SensitizationTeamMember,
} from './principal-registry-report.types';
import { CreateReportInput, GeneratePdfInput, ReviewReportInput, UpdateReportInput } from './principal-registry-report.validator';

const TABLE = 'principal_registry_weekly_reports';
const QUESTIONS_TABLE = 'principal_registry_report_questions';
const SUBMISSIONS_TABLE = 'principal_registry_report_submissions';
const PDF_METADATA_TABLE = 'principal_registry_report_pdfs';
const SENSITIZATION_TABLE = 'principal_registry_sensitizations';
const SENSITIZATION_TEAM_TABLE = 'principal_registry_sensitization_team';

// ─── Helper Functions ──────────────────────────────────────────────────────────

/**
 * Normalizes a date value to YYYY-MM-DD format for PostgreSQL date columns
 * Handles ISO strings, Date objects, and already-formatted strings
 */
function normalizeDate(value: any): string | null {
  if (!value) return null;
  
  // If it's already a Date object
  if (value instanceof Date) {
    return value.toISOString().split('T')[0];
  }
  
  // If it's a string
  if (typeof value === 'string') {
    // If it has time (ISO format), extract date part
    if (value.includes('T')) {
      return value.split('T')[0];
    }
    // If it's already YYYY-MM-DD, return as is
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value;
    }
    // Try to parse and format
    try {
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().split('T')[0];
      }
    } catch {
      // Return as is if parsing fails
      return value;
    }
  }
  
  return value;
}

/**
 * Normalizes an array of dates
 */
function normalizeDateArray(dates: any[] | null | undefined): string[] | null {
  if (!dates || !Array.isArray(dates)) return null;
  return dates.map(date => normalizeDate(date)).filter(Boolean) as string[];
}

/**
 * Checks if an object has any non-undefined values
 */
function hasValues(obj: any): boolean {
  if (!obj || typeof obj !== 'object') return false;
  return Object.values(obj).some(v => v !== undefined && v !== null);
}

/**
 * Deeply removes undefined values from an object
 */
function removeUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
  const result: Partial<T> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      // If it's an object, recursively clean it
      if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
        const cleaned = removeUndefined(value);
        if (Object.keys(cleaned).length > 0) {
          result[key as keyof T] = cleaned as any;
        }
      } else {
        result[key as keyof T] = value;
      }
    }
  }
  return result;
}

function mapRowToReport(row: any): PrincipalRegistryWeeklyReport {
  return {
    id: row.id,
    weekEndingDates: row.week_ending_dates,
    reportPeriodStart: row.report_period_start,
    reportPeriodEnd: row.report_period_end,
    departmentId: row.department_id,
    status: row.status,
    administrativeOverview: typeof row.administrative_overview === 'string'
      ? JSON.parse(row.administrative_overview)
      : row.administrative_overview,
    caseManagement: typeof row.case_management === 'string'
      ? JSON.parse(row.case_management)
      : row.case_management,
    automationStatus: typeof row.automation_status === 'string'
      ? JSON.parse(row.automation_status)
      : row.automation_status,
    serviceDeliveryChallenges: typeof row.service_delivery_challenges === 'string'
      ? JSON.parse(row.service_delivery_challenges)
      : row.service_delivery_challenges,
    highlights: typeof row.highlights === 'string'
      ? JSON.parse(row.highlights)
      : row.highlights,
    otherInformation: typeof row.other_information === 'string'
      ? JSON.parse(row.other_information)
      : row.other_information,
    pdfPublicId: row.pdf_public_id,
    pdfSecureUrl: row.pdf_secure_url,
    pdfFileName: row.pdf_file_name,
    pdfGeneratedAt: row.pdf_generated_at,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    reviewedBy: row.reviewed_by,
    reviewNotes: row.review_notes,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRowToQuestion(row: any): ReportQuestion {
  return {
    id: row.id,
    questionKey: row.question_key,
    sectionNumber: Number(row.section_number),
    sectionTitle: row.section_title,
    questionLabel: row.question_label,
    questionType: row.question_type,
    parentQuestionKey: row.parent_question_key,
    displayOrder: Number(row.display_order),
    isRequired: row.is_required,
    conditionalOn: typeof row.conditional_on === 'string' 
      ? JSON.parse(row.conditional_on) 
      : row.conditional_on,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRowToSubmission(row: any): ReportSubmission {
  return {
    id: row.id,
    reportId: row.report_id,
    submittedBy: row.submitted_by,
    submittedAt: row.submitted_at,
    status: row.status,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    reviewNotes: row.review_notes,
    pdfPublicId: row.pdf_public_id,
    pdfSecureUrl: row.pdf_secure_url,
  };
}

function mapRowToPdfMetadata(row: any): PDFReportMetadata {
  return {
    id: row.id,
    reportId: row.report_id,
    fileName: row.file_name,
    fileSize: row.file_size,
    mimeType: row.mime_type,
    publicId: row.public_id,
    secureUrl: row.secure_url,
    createdAt: row.created_at,
    createdBy: row.created_by,
    status: row.status,
    downloadCount: row.download_count,
    lastDownloadedAt: row.last_downloaded_at,
  };
}

function mapRowToSensitization(row: any): SensitizationResponse {
  return {
    id: row.id,
    memoNumber: row.memo_number,
    data: {
      date: row.date,
      from: row.from_person,
      to: row.to_person,
      subject: row.subject,
      location: row.location,
      travelStartDate: row.travel_start_date,
      travelEndDate: row.travel_end_date,
      sensitizationPeriod: row.sensitization_period,
      teamMembers: row.team_members || [],
      preparedBy: row.prepared_by,
      title: row.title,
    },
    status: row.status,
    pdfUrl: row.pdf_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ─── Field Mappings ────────────────────────────────────────────────────────────

const FIELD_TO_COLUMN: Record<string, string> = {
  weekEndingDates: 'week_ending_dates',
  reportPeriodStart: 'report_period_start',
  reportPeriodEnd: 'report_period_end',
  departmentId: 'department_id',
  status: 'status',
  administrativeOverview: 'administrative_overview',
  caseManagement: 'case_management',
  automationStatus: 'automation_status',
  serviceDeliveryChallenges: 'service_delivery_challenges',
  highlights: 'highlights',
  otherInformation: 'other_information',
  pdfPublicId: 'pdf_public_id',
  pdfSecureUrl: 'pdf_secure_url',
  pdfFileName: 'pdf_file_name',
  pdfGeneratedAt: 'pdf_generated_at',
  submittedAt: 'submitted_at',
  reviewedAt: 'reviewed_at',
  reviewedBy: 'reviewed_by',
  reviewNotes: 'review_notes',
};

// ─── Date fields that need normalization ──────────────────────────────────────

const DATE_FIELDS = [
  'reportPeriodStart',
  'reportPeriodEnd',
  'submittedAt',
  'reviewedAt',
  'pdfGeneratedAt',
];

const JSON_FIELDS = [
  'administrativeOverview',
  'caseManagement',
  'automationStatus',
  'serviceDeliveryChallenges',
  'highlights',
  'otherInformation',
];

class PrincipalRegistryReportServiceImpl {
  // ─── Questions ──────────────────────────────────────────────────
  
  async getQuestions(departmentId?: string): Promise<ReportQuestion[]> {
    const query = `
      SELECT * FROM ${QUESTIONS_TABLE}
      ORDER BY section_number ASC, display_order ASC;
    `;

    const { rows } = await pool.query(query);
    return rows.map(mapRowToQuestion);
  }

  // ─── CRUD Operations ──────────────────────────────────────────

  async create(
    input: CreateReportInput,
    createdBy: string
  ): Promise<PrincipalRegistryWeeklyReport> {
    const query = `
      INSERT INTO ${TABLE} (
        week_ending_dates, report_period_start, report_period_end, department_id,
        status, administrative_overview, case_management, automation_status,
        service_delivery_challenges, highlights, other_information,
        created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING *;
    `;
    const values = [
      normalizeDateArray(input.weekEndingDates),
      normalizeDate(input.reportPeriodStart),
      normalizeDate(input.reportPeriodEnd),
      input.departmentId,
      input.status ?? 'draft',
      JSON.stringify(input.administrativeOverview),
      JSON.stringify(input.caseManagement),
      JSON.stringify(input.automationStatus),
      JSON.stringify(input.serviceDeliveryChallenges),
      JSON.stringify(input.highlights),
      JSON.stringify(input.otherInformation),
      createdBy,
    ];
    const { rows } = await pool.query(query, values);
    return mapRowToReport(rows[0]);
  }

  async findById(id: string): Promise<PrincipalRegistryWeeklyReport | null> {
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
    return rows[0] ? mapRowToReport(rows[0]) : null;
  }

  async findAll(
    filters: ReportListFilters
  ): Promise<{ reports: PrincipalRegistryWeeklyReport[]; total: number; page: number; pageSize: number }> {
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (filters.departmentId) {
      conditions.push(`department_id = $${idx++}`);
      values.push(filters.departmentId);
    }
    if (filters.status) {
      conditions.push(`status = $${idx++}`);
      values.push(filters.status);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const pageSize = filters.pageSize && filters.pageSize > 0 ? filters.pageSize : 20;
    const offset = (page - 1) * pageSize;

    const dataQuery = `
      SELECT * FROM ${TABLE} ${whereClause}
      ORDER BY report_period_end DESC
      LIMIT $${idx++} OFFSET $${idx++};
    `;
    const countQuery = `SELECT COUNT(*)::int AS total FROM ${TABLE} ${whereClause};`;

    const { rows } = await pool.query(dataQuery, [...values, pageSize, offset]);
    const { rows: countRows } = await pool.query(countQuery, values);

    return {
      reports: rows.map(mapRowToReport),
      total: countRows[0].total,
      page,
      pageSize,
    };
  }

  /**
   * Updates a report with automatic date normalization for all date fields.
   * Handles ISO strings (e.g., "2026-08-17T00:00:00.000Z") and converts them
   * to YYYY-MM-DD format for PostgreSQL date columns.
   * 
   * Supports partial updates - only fields present in the input will be updated.
   */
  async update(
    id: string,
    input: UpdateReportInput
  ): Promise<PrincipalRegistryWeeklyReport | null> {
    // First check if the report exists
    const existing = await this.findById(id);
    if (!existing) {
      return null;
    }

    // Clean the input - remove undefined values and empty objects
    const cleanedInput = removeUndefined(input);
    
    // If no fields to update, return the existing report
    if (Object.keys(cleanedInput).length === 0) {
      return existing;
    }

    const setClauses: string[] = [];
    const values: any[] = [];
    let idx = 1;

    // Process each field in the cleaned input
    for (const [key, column] of Object.entries(FIELD_TO_COLUMN)) {
      if (!(key in cleanedInput)) continue;
      
      let val = (cleanedInput as any)[key];
      
      // Skip undefined values (already handled by removeUndefined)
      if (val === undefined) continue;
      
      // ─── Normalize date fields ──────────────────────────────
      if (DATE_FIELDS.includes(key)) {
        val = normalizeDate(val);
      }
      
      // ─── Normalize weekEndingDates array ────────────────────
      if (key === 'weekEndingDates' && val !== null) {
        val = normalizeDateArray(val);
      }
      
      // ─── Stringify JSON fields ──────────────────────────────
      if (JSON_FIELDS.includes(key) && val !== null) {
        // For partial updates, merge with existing data
        if (typeof val === 'object' && !Array.isArray(val)) {
          // Merge with existing data for JSON fields
          const existingData = (existing as any)[key] || {};
          val = JSON.stringify({ ...existingData, ...val });
        } else {
          val = JSON.stringify(val);
        }
      }
      
      setClauses.push(`${column} = $${idx++}`);
      values.push(val);
    }

    // If nothing to update after processing, return the existing report
    if (setClauses.length === 0) {
      return existing;
    }

    // Add updated_at timestamp
    setClauses.push(`updated_at = NOW()`);

    // Add id as the last parameter
    values.push(id);

    const query = `
      UPDATE ${TABLE}
      SET ${setClauses.join(', ')}
      WHERE id = $${idx}
      RETURNING *;
    `;

    try {
      const { rows } = await pool.query(query, values);
      return rows[0] ? mapRowToReport(rows[0]) : null;
    } catch (error) {
      console.error('Error updating report:', error);
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    const { rowCount } = await pool.query(`DELETE FROM ${TABLE} WHERE id = $1`, [id]);
    return (rowCount ?? 0) > 0;
  }

  // ─── Status Management ────────────────────────────────────────

  async review(
    id: string,
    input: ReviewReportInput
  ): Promise<PrincipalRegistryWeeklyReport | null> {
    const targetStatus: ReportStatus = input.action === 'approve' ? 'reviewed' : 'draft';
    
    // Update the report with review notes
    const report = await this.update(id, { 
      status: targetStatus,
      reviewNotes: input.reviewNotes,
      reviewedAt: new Date().toISOString(),
    });
    
    return report;
  }

  async setStatus(id: string, status: ReportStatus): Promise<PrincipalRegistryWeeklyReport | null> {
    const current = await this.findById(id);
    if (!current) return null;

    const allowedTransitions: Record<ReportStatus, ReportStatus[]> = {
      draft: ['submitted'],
      submitted: ['reviewed', 'draft'],
      reviewed: ['archived'],
      archived: [],
    };

    if (!allowedTransitions[current.status].includes(status)) {
      throw new Error(`Invalid status transition from ${current.status} to ${status}`);
    }

    return this.update(id, { status });
  }

  // ─── PDF Generation ────────────────────────────────────────────

  async generatePDF(
    input: GeneratePdfInput,
    userId: string
  ): Promise<PDFGenerationResult> {
    try {
      const report = await this.findById(input.reportId);
      if (!report) {
        return {
          success: false,
          error: 'Report not found',
        };
      }

      // Check if report is in a valid state for PDF generation
      if (report.status === 'archived') {
        return {
          success: false,
          error: 'Cannot generate PDF for archived report',
        };
      }

      // Generate the PDF using the PDF generator service
      const pdfResult = await PDFGeneratorService.generateReportPDF(report, input.options);
      
      if (!pdfResult.success) {
        return {
          success: false,
          error: pdfResult.error || 'Failed to generate PDF',
        };
      }

      // ✅ Upload PDF to Cloudinary
      let publicId: string;
      let secureUrl: string;

      try {
        // Convert Blob to Buffer for Cloudinary upload
        const arrayBuffer = await pdfResult.pdfBlob!.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        const file: Express.Multer.File = {
          buffer: buffer,
          mimetype: 'application/pdf',
          originalname: pdfResult.fileName || `report_${input.reportId}.pdf`,
          size: buffer.length,
          fieldname: 'file',
          encoding: '7bit',
          destination: '',
          filename: '',
          path: '',
          stream: null as any,
        };

        const uploadResult = await uploadToCloudinary(file, 'principal-registry-reports');
        publicId = uploadResult.public_id;
        secureUrl = uploadResult.secure_url;
      } catch (uploadError) {
        console.error('Cloudinary upload error:', uploadError);
        // Fallback: use data URL if Cloudinary fails
        secureUrl = pdfResult.pdfUrl || '';
        publicId = `fallback_${input.reportId}_${Date.now()}`;
      }

      // Save PDF metadata to database
      const metadataQuery = `
        INSERT INTO ${PDF_METADATA_TABLE} (
          report_id, file_name, file_size, mime_type, created_by, status,
          public_id, secure_url
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *;
      `;

      const metadataValues = [
        input.reportId,
        pdfResult.fileName || `report_${input.reportId}.pdf`,
        pdfResult.fileSize || 0,
        'application/pdf',
        userId,
        'ready',
        publicId,
        secureUrl,
      ];

      const { rows } = await pool.query(metadataQuery, metadataValues);
      const metadata = mapRowToPdfMetadata(rows[0]);

      // ✅ Attach PDF to the report
      await this.update(input.reportId, {
        pdfPublicId: publicId,
        pdfSecureUrl: secureUrl,
        pdfFileName: pdfResult.fileName || `report_${input.reportId}.pdf`,
        pdfGeneratedAt: new Date().toISOString(),
      });

      return {
        success: true,
        pdfUrl: secureUrl,
        pdfBlob: pdfResult.pdfBlob,
        downloadUrl: secureUrl,
        fileName: pdfResult.fileName,
        fileSize: pdfResult.fileSize,
        publicId: publicId,
        secureUrl: secureUrl,
      };
    } catch (error) {
      console.error('PDF generation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate PDF',
      };
    }
  }

  async getPDFMetadata(reportId: string): Promise<PDFReportMetadata | null> {
    const { rows } = await pool.query(
      `SELECT * FROM ${PDF_METADATA_TABLE} WHERE report_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [reportId]
    );
    return rows[0] ? mapRowToPdfMetadata(rows[0]) : null;
  }

  async incrementDownloadCount(pdfId: string): Promise<void> {
    await pool.query(
      `UPDATE ${PDF_METADATA_TABLE} 
       SET download_count = download_count + 1, last_downloaded_at = NOW() 
       WHERE id = $1`,
      [pdfId]
    );
  }

  // ─── Submission Management ────────────────────────────────────

  async submitReport(
    reportId: string,
    userId: string
  ): Promise<{ report: PrincipalRegistryWeeklyReport; submission: ReportSubmission }> {
    // First, check if report exists and is in draft status
    const report = await this.findById(reportId);
    if (!report) {
      throw new Error('Report not found');
    }

    if (report.status !== 'draft') {
      throw new Error('Report must be in draft status to submit');
    }

    // ✅ Check if PDF is already attached
    if (!report.pdfSecureUrl || !report.pdfPublicId) {
      throw new Error('Please generate a PDF for this report before submitting');
    }

    // Update report status to submitted
    const updatedReport = await this.setStatus(reportId, 'submitted');
    if (!updatedReport) {
      throw new Error('Failed to update report status');
    }

    // Create submission record
    const submissionQuery = `
      INSERT INTO ${SUBMISSIONS_TABLE} (
        report_id, submitted_by, submitted_at, status, pdf_public_id, pdf_secure_url
      ) VALUES ($1, $2, NOW(), $3, $4, $5)
      RETURNING *;
    `;

    const submissionValues = [
      reportId,
      userId,
      'pending',
      report.pdfPublicId,
      report.pdfSecureUrl,
    ];

    const { rows } = await pool.query(submissionQuery, submissionValues);
    const submission = mapRowToSubmission(rows[0]);

    // Update report with submittedAt timestamp
    await this.update(reportId, {
      submittedAt: new Date().toISOString(),
    });

    return { report: updatedReport, submission };
  }

  async getSubmission(reportId: string): Promise<ReportSubmission | null> {
    const { rows } = await pool.query(
      `SELECT * FROM ${SUBMISSIONS_TABLE} WHERE report_id = $1 ORDER BY submitted_at DESC LIMIT 1`,
      [reportId]
    );
    return rows[0] ? mapRowToSubmission(rows[0]) : null;
  }

  async reviewSubmission(
    submissionId: string,
    action: 'approve' | 'reject',
    reviewNotes?: string,
    reviewerId?: string
  ): Promise<ReportSubmission | null> {
    const status = action === 'approve' ? 'approved' : 'rejected';
    
    // Update submission status
    const query = `
      UPDATE ${SUBMISSIONS_TABLE}
      SET status = $1, reviewed_by = $2, reviewed_at = NOW(), review_notes = $3
      WHERE id = $4
      RETURNING *;
    `;

    const { rows } = await pool.query(query, [status, reviewerId, reviewNotes, submissionId]);
    const submission = rows[0] ? mapRowToSubmission(rows[0]) : null;

    if (submission) {
      // Update the corresponding report status
      const targetStatus: ReportStatus = action === 'approve' ? 'reviewed' : 'draft';
      await this.update(submission.reportId, {
        status: targetStatus,
        reviewedBy: reviewerId,
        reviewedAt: new Date().toISOString(),
        reviewNotes: reviewNotes,
      });
    }

    return submission;
  }

  // ─── Check if PDF is attached ─────────────────────────────────

  async hasPDFAttached(reportId: string): Promise<boolean> {
    const report = await this.findById(reportId);
    if (!report) return false;
    return !!(report.pdfSecureUrl && report.pdfPublicId);
  }

  // ═══════════════════════════════════════════════════════════════════
  // SENSITIZATION CRUD OPERATIONS
  // ═══════════════════════════════════════════════════════════════════

/**
 * Create a new sensitization memo
 */
async createSensitization(
  input: SensitizationInput,
  createdBy: string
): Promise<SensitizationResponse> {
  // Generate memo number: SENS-YYYY-MM-XXX
  const memoNumber = await this.generateSensitizationMemoNumber();

  // Generate serial numbers for team members
  const teamMembers = input.teamMembers.map((member, index) => ({
    ...member,
    s_no: index + 1,
  }));

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Insert the sensitization record
    const query = `
      INSERT INTO ${SENSITIZATION_TABLE} (
        memo_number, date, from_person, to_person, subject,
        location, travel_start_date, travel_end_date, sensitization_period,
        prepared_by, title, status, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *;
    `;

    const values = [
      memoNumber,
      normalizeDate(input.date),
      input.from,
      input.to,
      input.subject,
      input.location,
      normalizeDate(input.travelStartDate),
      normalizeDate(input.travelEndDate),
      input.sensitizationPeriod,
      input.preparedBy,
      input.title,
      'draft',
      createdBy,
    ];

    const { rows } = await client.query(query, values);
    const sensitization = rows[0];

    // Insert team members
    for (const member of teamMembers) {
      const teamQuery = `
        INSERT INTO ${SENSITIZATION_TEAM_TABLE} (
          sensitization_id, s_no, name, pj_number, rank, days, dsa_rate, total, is_driver
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);
      `;

      await client.query(teamQuery, [
        sensitization.id,
        member.s_no,
        member.name,
        member.pjNumber,
        member.rank,
        member.days,
        member.dsaRate,
        member.total,
        member.isDriver || false,
      ]);
    }

    await client.query('COMMIT');

    // Fetch the complete record with team members
    const result = await this.findSensitizationById(sensitization.id);
    // Assert non-null since we just created it
    return result as SensitizationResponse;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

  /**
   * Generate a unique memo number for sensitization
   * Format: SENS-YYYY-MM-XXX
   */
  private async generateSensitizationMemoNumber(): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int as count FROM ${SENSITIZATION_TABLE} 
       WHERE EXTRACT(YEAR FROM created_at) = $1 AND EXTRACT(MONTH FROM created_at) = $2`,
      [year, now.getMonth() + 1]
    );
    
    const count = rows[0].count + 1;
    const seq = String(count).padStart(3, '0');
    
    return `SENS-${year}-${month}-${seq}`;
  }

  /**
   * Find a sensitization by ID with team members
   */
  async findSensitizationById(id: string): Promise<SensitizationResponse | null> {
    const { rows } = await pool.query(
      `SELECT * FROM ${SENSITIZATION_TABLE} WHERE id = $1`,
      [id]
    );
    
    if (!rows[0]) return null;
    
    // Fetch team members
    const teamRows = await pool.query(
      `SELECT * FROM ${SENSITIZATION_TEAM_TABLE} 
       WHERE sensitization_id = $1 
       ORDER BY s_no ASC`,
      [id]
    );
    
    const teamMembers: SensitizationTeamMember[] = teamRows.rows.map(row => ({
      s_no: row.s_no,
      name: row.name,
      pjNumber: row.pj_number,
      rank: row.rank,
      days: row.days,
      dsaRate: row.dsa_rate,
      total: row.total,
      isDriver: row.is_driver,
    }));
    
    return {
      id: rows[0].id,
      memoNumber: rows[0].memo_number,
      data: {
        date: rows[0].date,
        from: rows[0].from_person,
        to: rows[0].to_person,
        subject: rows[0].subject,
        location: rows[0].location,
        travelStartDate: rows[0].travel_start_date,
        travelEndDate: rows[0].travel_end_date,
        sensitizationPeriod: rows[0].sensitization_period,
        teamMembers,
        preparedBy: rows[0].prepared_by,
        title: rows[0].title,
      },
      status: rows[0].status,
      pdfUrl: rows[0].pdf_url,
      createdAt: rows[0].created_at,
      updatedAt: rows[0].updated_at,
    };
  }

  /**
   * Get all sensitizations with filtering
   */
  async findAllSensitizations(filters: {
    status?: string;
    location?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ items: SensitizationResponse[]; total: number; page: number; pageSize: number }> {
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (filters.status) {
      conditions.push(`status = $${idx++}`);
      values.push(filters.status);
    }
    if (filters.location) {
      conditions.push(`location ILIKE $${idx++}`);
      values.push(`%${filters.location}%`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const pageSize = filters.pageSize && filters.pageSize > 0 ? filters.pageSize : 20;
    const offset = (page - 1) * pageSize;

    const dataQuery = `
      SELECT * FROM ${SENSITIZATION_TABLE} ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${idx++} OFFSET $${idx++};
    `;
    const countQuery = `SELECT COUNT(*)::int AS total FROM ${SENSITIZATION_TABLE} ${whereClause};`;

    const { rows } = await pool.query(dataQuery, [...values, pageSize, offset]);
    const { rows: countRows } = await pool.query(countQuery, values);

    // Fetch team members for each sensitization
    const items: SensitizationResponse[] = [];
    for (const row of rows) {
      const teamRows = await pool.query(
        `SELECT * FROM ${SENSITIZATION_TEAM_TABLE} 
         WHERE sensitization_id = $1 
         ORDER BY s_no ASC`,
        [row.id]
      );
      
      const teamMembers: SensitizationTeamMember[] = teamRows.rows.map(r => ({
        s_no: r.s_no,
        name: r.name,
        pjNumber: r.pj_number,
        rank: r.rank,
        days: r.days,
        dsaRate: r.dsa_rate,
        total: r.total,
        isDriver: r.is_driver,
      }));
      
      items.push({
        id: row.id,
        memoNumber: row.memo_number,
        data: {
          date: row.date,
          from: row.from_person,
          to: row.to_person,
          subject: row.subject,
          location: row.location,
          travelStartDate: row.travel_start_date,
          travelEndDate: row.travel_end_date,
          sensitizationPeriod: row.sensitization_period,
          teamMembers,
          preparedBy: row.prepared_by,
          title: row.title,
        },
        status: row.status,
        pdfUrl: row.pdf_url,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      });
    }

    return {
      items,
      total: countRows[0].total,
      page,
      pageSize,
    };
  }

  /**
   * Update a sensitization
   */
  async updateSensitization(
    id: string,
    input: Partial<SensitizationInput>
  ): Promise<SensitizationResponse | null> {
    const existing = await this.findSensitizationById(id);
    if (!existing) return null;

    // Can't update if submitted or approved
    if (existing.status === 'submitted' || existing.status === 'approved') {
      throw new Error('Cannot update a submitted or approved sensitization');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const setClauses: string[] = [];
      const values: any[] = [];
      let idx = 1;

      // Build update query for main table
      const fieldMap: Record<string, string> = {
        date: 'date',
        from: 'from_person',
        to: 'to_person',
        subject: 'subject',
        location: 'location',
        travelStartDate: 'travel_start_date',
        travelEndDate: 'travel_end_date',
        sensitizationPeriod: 'sensitization_period',
        preparedBy: 'prepared_by',
        title: 'title',
      };

      for (const [key, column] of Object.entries(fieldMap)) {
        if (key in input) {
          let val = (input as any)[key];
          if (key === 'date' || key === 'travelStartDate' || key === 'travelEndDate') {
            val = normalizeDate(val);
          }
          setClauses.push(`${column} = $${idx++}`);
          values.push(val);
        }
      }

      if (setClauses.length > 0) {
        setClauses.push(`updated_at = NOW()`);
        values.push(id);

        const query = `
          UPDATE ${SENSITIZATION_TABLE}
          SET ${setClauses.join(', ')}
          WHERE id = $${idx}
        `;
        await client.query(query, values);
      }

      // Update team members if provided
      if (input.teamMembers) {
        // Delete existing team members
        await client.query(
          `DELETE FROM ${SENSITIZATION_TEAM_TABLE} WHERE sensitization_id = $1`,
          [id]
        );

        // Insert new team members
        for (const member of input.teamMembers) {
          const teamQuery = `
            INSERT INTO ${SENSITIZATION_TEAM_TABLE} (
              sensitization_id, s_no, name, pj_number, rank, days, dsa_rate, total, is_driver
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);
          `;

          await client.query(teamQuery, [
            id,
            member.s_no,
            member.name,
            member.pjNumber,
            member.rank,
            member.days,
            member.dsaRate,
            member.total,
            member.isDriver || false,
          ]);
        }
      }

      await client.query('COMMIT');

      return await this.findSensitizationById(id);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Delete a sensitization
   */
  async deleteSensitization(id: string): Promise<boolean> {
    const existing = await this.findSensitizationById(id);
    if (!existing) return false;

    // Can't delete if submitted or approved
    if (existing.status === 'submitted' || existing.status === 'approved') {
      throw new Error('Cannot delete a submitted or approved sensitization');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Delete team members first
      await client.query(
        `DELETE FROM ${SENSITIZATION_TEAM_TABLE} WHERE sensitization_id = $1`,
        [id]
      );

      // Delete sensitization
      const result = await client.query(
        `DELETE FROM ${SENSITIZATION_TABLE} WHERE id = $1`,
        [id]
      );

      await client.query('COMMIT');
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Submit a sensitization for approval
   */
  async submitSensitization(id: string): Promise<SensitizationResponse | null> {
    const existing = await this.findSensitizationById(id);
    if (!existing) return null;

    if (existing.status === 'submitted' || existing.status === 'approved') {
      throw new Error('Sensitization is already submitted or approved');
    }

    const query = `
      UPDATE ${SENSITIZATION_TABLE}
      SET status = 'submitted', updated_at = NOW()
      WHERE id = $1
      RETURNING *;
    `;

    await pool.query(query, [id]);
    return await this.findSensitizationById(id);
  }

  /**
   * Approve a sensitization
   */
  async approveSensitization(id: string): Promise<SensitizationResponse | null> {
    const existing = await this.findSensitizationById(id);
    if (!existing) return null;

    if (existing.status !== 'submitted') {
      throw new Error('Only submitted sensitizations can be approved');
    }

    const query = `
      UPDATE ${SENSITIZATION_TABLE}
      SET status = 'approved', updated_at = NOW()
      WHERE id = $1
      RETURNING *;
    `;

    await pool.query(query, [id]);
    return await this.findSensitizationById(id);
  }

  /**
   * Reject a sensitization
   */
  async rejectSensitization(id: string): Promise<SensitizationResponse | null> {
    const existing = await this.findSensitizationById(id);
    if (!existing) return null;

    if (existing.status !== 'submitted') {
      throw new Error('Only submitted sensitizations can be rejected');
    }

    const query = `
      UPDATE ${SENSITIZATION_TABLE}
      SET status = 'draft', updated_at = NOW()
      WHERE id = $1
      RETURNING *;
    `;

    await pool.query(query, [id]);
    return await this.findSensitizationById(id);
  }


}

// Exported capitalized, matching the RegistryService.methodName() calling convention.
export const PrincipalRegistryReportService = new PrincipalRegistryReportServiceImpl();