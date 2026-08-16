// principal-registry-report.types.ts
// Types for the Office of the Registrar High Court (ORHC) - Principal Registry
// Weekly Reporting Template.

// ═══════════════════════════════════════════════════════════════════
// DYNAMIC QUESTION CATALOG TYPES (Maps 1:1 with prSeeder.ts)
// ═══════════════════════════════════════════════════════════════════

export type QuestionType =
  | 'text'        // free text
  | 'list'        // array of strings (bullet points)
  | 'number'      // integer
  | 'boolean'     // Yes/No
  | 'date'        // single ISO date
  | 'date_list'   // array of ISO dates
  | 'group';      // non-data section/group header

export interface ConditionalOn {
  questionKey: string;
  equals: boolean | string | number;
}

export interface ReportQuestion {
  id?: string;
  questionKey: string;
  sectionNumber: number;
  sectionTitle: string;
  questionLabel: string;
  questionType: QuestionType;
  parentQuestionKey?: string | null;
  displayOrder: number;
  isRequired: boolean;
  conditionalOn?: ConditionalOn | null;
  createdAt?: string;
  updatedAt?: string;
}

// ═══════════════════════════════════════════════════════════════════
// REPORT DATA STRUCTURES (Sections 1-6)
// ═══════════════════════════════════════════════════════════════════

// --- Section 1: Administrative Overview ---
export interface AdministrativeOverview {
  keyActivities: string[];
  notableIssues: string[];
  resolutionsStatus: string[];
}

// --- Section 2: Case Management ---
export interface CaseManagement {
  form30PendingCount: number;
  forwardedToGp: boolean;
  submissionDates?: string[] | null;
  noticesSubmittedCount?: number | null;
  nonSubmissionReason?: string | null;
  expectedSubmissionDate?: string | null;
}

// --- Section 3: Automating the Principal Registry ---
export interface AutomationStatus {
  excelUpdateStatus: string;
  systemBuildStatus: string;
}

// --- Section 4: Service Delivery Challenges ---
export interface ServiceDeliveryChallenges {
  hasChallenges: boolean;
  challengeDetails?: string[] | null;
  proposedSolutions: string[];
  needsRhcIntervention: boolean;
  interventionDetails?: string[] | null;
}

// --- Section 5: Highlights / Achievements ---
export interface Highlights {
  achievements: string[];
}

// --- Section 6: Any Other Information ---
export interface OtherInformation {
  ctsEfilingChanges: string[];
  gpChanges: string[];
  signOff: SignOff;
}

// --- Sign-off Block ---
export interface SignOff {
  preparedDate: string;
  preparedByName: string;
  preparedByDesignation: string;
}

// ═══════════════════════════════════════════════════════════════════
// ENTITY & DTO CONTRACTS
// ═══════════════════════════════════════════════════════════════════

export type ReportStatus = 'draft' | 'submitted' | 'reviewed' | 'archived';

// --- Full Entity ---
export interface PrincipalRegistryWeeklyReport {
  id: string;
  weekEndingDates: string[];
  reportPeriodStart: string;
  reportPeriodEnd: string;
  departmentId: string;
  status: ReportStatus;

  administrativeOverview: AdministrativeOverview;
  caseManagement: CaseManagement;
  automationStatus: AutomationStatus;
  serviceDeliveryChallenges: ServiceDeliveryChallenges;
  highlights: Highlights;
  otherInformation: OtherInformation;

  // PDF reference (attached PDF)
  pdfPublicId?: string | null;
  pdfSecureUrl?: string | null;
  pdfFileName?: string | null;
  pdfGeneratedAt?: string | null;

  // Submission tracking
  submittedAt?: string | null;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  reviewNotes?: string | null;

  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// --- Request DTOs ---
export type CreateReportDto = Omit<
  PrincipalRegistryWeeklyReport,
  'id' | 'status' | 'createdBy' | 'createdAt' | 'updatedAt'
>;

export type UpdateReportDto = Partial<CreateReportDto>;

export interface ReviewReportDto {
  reviewNotes?: string;
  action: 'approve' | 'reject';
}

export interface ReportListFilters {
  departmentId?: string;
  status?: ReportStatus;
  page?: number;
  pageSize?: number;
}

// ═══════════════════════════════════════════════════════════════════
// PDF GENERATION & STORAGE TYPES
// ═══════════════════════════════════════════════════════════════════

export interface PDFGenerationOptions {
  title?: string;
  showWatermark?: boolean;
  watermarkText?: string;
  includeFooter?: boolean;
  footerText?: string;
  pageSize?: 'A4' | 'A3' | 'Legal' | 'Letter';
  orientation?: 'portrait' | 'landscape';
  margin?: {
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
  };
}

export interface PDFGenerationResult {
  success: boolean;
  pdfUrl?: string;
  pdfBlob?: Blob;
  error?: string;
  downloadUrl?: string;
  fileName?: string;
  fileSize?: number;
  publicId?: string;
  secureUrl?: string;
  base64?: string; // ✅ Add this
}

// ─── PDF Report Metadata ──────────────────────────────────────────
export interface PDFReportMetadata {
  id: string;
  reportId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  publicId: string;
  secureUrl: string;
  createdAt: string;
  createdBy: string;
  status: 'generating' | 'ready' | 'failed';
  downloadCount: number;
  lastDownloadedAt?: string;
}

// ─── PDF Formatter Types ──────────────────────────────────────────
export interface PDFSectionContent {
  title: string;
  items: PDFContentItem[];
}

export interface PDFContentItem {
  label: string;
  value: string | string[] | number | boolean | null;
  type: 'text' | 'list' | 'number' | 'boolean' | 'date' | 'date_list';
  isRequired?: boolean;
  formattedValue?: string;
}

export interface PDFSectionFormatter {
  sectionNumber: number;
  sectionTitle: string;
  formatData: (data: unknown) => PDFSectionContent;
}

// ═══════════════════════════════════════════════════════════════════
// REPORT SUBMISSION TYPES (Internal System Submission)
// ═══════════════════════════════════════════════════════════════════

export type SubmissionStatus = 'pending' | 'approved' | 'rejected';

export interface ReportSubmission {
  id: string;
  reportId: string;
  submittedBy: string;
  submittedAt: string;
  status: SubmissionStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  pdfPublicId?: string;
  pdfSecureUrl?: string;
}

export const SUBMISSION_STATUS_LABELS: Record<SubmissionStatus, string> = {
  pending: 'Pending Review',
  approved: 'Approved',
  rejected: 'Rejected',
};

export const SUBMISSION_STATUS_COLORS: Record<SubmissionStatus, string> = {
  pending: 'yellow',
  approved: 'green',
  rejected: 'red',
};

// ═══════════════════════════════════════════════════════════════════
// DEFAULT FORM DATA
// ═══════════════════════════════════════════════════════════════════

export interface ReportFormData {
  weekEndingDates: string[];
  reportPeriodStart: string;
  reportPeriodEnd: string;
  departmentId: string;
  administrativeOverview: AdministrativeOverview;
  caseManagement: CaseManagement;
  automationStatus: AutomationStatus;
  serviceDeliveryChallenges: ServiceDeliveryChallenges;
  highlights: Highlights;
  otherInformation: OtherInformation;
}

export const DEFAULT_REPORT_FORM: ReportFormData = {
  weekEndingDates: [],
  reportPeriodStart: '',
  reportPeriodEnd: '',
  departmentId: '',
  administrativeOverview: {
    keyActivities: [],
    notableIssues: [],
    resolutionsStatus: [],
  },
  caseManagement: {
    form30PendingCount: 0,
    forwardedToGp: false,
    submissionDates: null,
    noticesSubmittedCount: null,
    nonSubmissionReason: null,
    expectedSubmissionDate: null,
  },
  automationStatus: {
    excelUpdateStatus: '',
    systemBuildStatus: '',
  },
  serviceDeliveryChallenges: {
    hasChallenges: false,
    challengeDetails: null,
    proposedSolutions: [],
    needsRhcIntervention: false,
    interventionDetails: null,
  },
  highlights: {
    achievements: [],
  },
  otherInformation: {
    ctsEfilingChanges: [],
    gpChanges: [],
    signOff: {
      preparedDate: '',
      preparedByName: '',
      preparedByDesignation: '',
    },
  },
};

// ═══════════════════════════════════════════════════════════════════
// API REQUEST/RESPONSE TYPES
// ═══════════════════════════════════════════════════════════════════

export interface CreateReportRequest {
  weekEndingDates: string[];
  reportPeriodStart: string;
  reportPeriodEnd: string;
  departmentId: string;
  administrativeOverview: AdministrativeOverview;
  caseManagement: CaseManagement;
  automationStatus: AutomationStatus;
  serviceDeliveryChallenges: ServiceDeliveryChallenges;
  highlights: Highlights;
  otherInformation: OtherInformation;
  status?: ReportStatus;
}

export interface UpdateReportRequest {
  weekEndingDates?: string[];
  reportPeriodStart?: string;
  reportPeriodEnd?: string;
  departmentId?: string;
  administrativeOverview?: AdministrativeOverview;
  caseManagement?: CaseManagement;
  automationStatus?: AutomationStatus;
  serviceDeliveryChallenges?: ServiceDeliveryChallenges;
  highlights?: Highlights;
  otherInformation?: OtherInformation;
  status?: ReportStatus;
}

export interface ReviewReportRequest {
  action: 'approve' | 'reject';
  reviewNotes?: string;
}

export interface GeneratePdfRequest {
  reportId: string;
  options?: PDFGenerationOptions;
}

export interface ReportListResponse {
  reports: PrincipalRegistryWeeklyReport[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ReportFilters {
  departmentId?: string;
  status?: ReportStatus;
  page?: number;
  pageSize?: number;
}

// ═══════════════════════════════════════════════════════════════════
// FORMATTER HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

export const formatListForPDF = (items: string[] | undefined | null): string => {
  if (!items || items.length === 0) return 'None provided';
  return items.map((item, index) => `${index + 1}. ${item}`).join('\n');
};

export const formatDateForPDF = (dateStr: string | undefined | null): string => {
  if (!dateStr) return 'Not provided';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'Invalid date';
    return date.toLocaleDateString('en-KE', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  } catch {
    return 'Invalid date';
  }
};

export const formatBooleanForPDF = (value: boolean | undefined | null): string => {
  if (value === undefined || value === null) return 'Not provided';
  return value ? 'Yes' : 'No';
};

export const formatNumberForPDF = (value: number | undefined | null): string => {
  if (value === undefined || value === null) return 'Not provided';
  return value.toString();
};

export const formatDateListForPDF = (dates: string[] | undefined | null): string => {
  if (!dates || dates.length === 0) return 'None provided';
  return dates.map(d => formatDateForPDF(d)).join(', ');
};

export const formatTextForPDF = (value: string | undefined | null): string => {
  if (!value || value.trim() === '') return 'Not provided';
  return value;
};

// ═══════════════════════════════════════════════════════════════════
// STATUS HELPERS
// ═══════════════════════════════════════════════════════════════════

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  reviewed: 'Reviewed',
  archived: 'Archived',
};

export const REPORT_STATUS_COLORS: Record<ReportStatus, string> = {
  draft: 'gray',
  submitted: 'blue',
  reviewed: 'green',
  archived: 'purple',
};

export const REPORT_STATUS_ORDER: ReportStatus[] = ['draft', 'submitted', 'reviewed', 'archived'];

export const getStatusLabel = (status: ReportStatus): string => {
  return REPORT_STATUS_LABELS[status] || status;
};

export const getStatusColor = (status: ReportStatus): string => {
  return REPORT_STATUS_COLORS[status] || 'gray';
};

// ─── Workflow Helpers ──────────────────────────────────────────────

/**
 * Check if a report can be edited (draft status only)
 */
export const canEdit = (report: PrincipalRegistryWeeklyReport): boolean => {
  return report.status === 'draft';
};

/**
 * Check if a report can be submitted (draft status + PDF must be attached)
 */
export const canSubmit = (report: PrincipalRegistryWeeklyReport): boolean => {
  return report.status === 'draft' && !!report.pdfSecureUrl;
};

/**
 * Check if a report can be reviewed (submitted status only)
 */
export const canReview = (report: PrincipalRegistryWeeklyReport): boolean => {
  return report.status === 'submitted';
};

/**
 * Check if a report can be archived (reviewed status only)
 */
export const canArchive = (report: PrincipalRegistryWeeklyReport): boolean => {
  return report.status === 'reviewed';
};

/**
 * Check if PDF can be generated (draft or submitted status)
 */
export const canGeneratePDF = (report: PrincipalRegistryWeeklyReport): boolean => {
  return report.status === 'draft' || report.status === 'submitted';
};

/**
 * Check if PDF can be viewed (must have PDF attached)
 */
export const canViewPDF = (report: PrincipalRegistryWeeklyReport): boolean => {
  return !!report.pdfSecureUrl;
};

/**
 * Check if PDF is attached to the report
 */
export const hasPDFAttached = (report: PrincipalRegistryWeeklyReport): boolean => {
  return !!report.pdfSecureUrl && !!report.pdfPublicId;
};

/**
 * Get submission status label
 */
export const getSubmissionStatusLabel = (status: SubmissionStatus): string => {
  return SUBMISSION_STATUS_LABELS[status] || status;
};

/**
 * Get submission status color
 */
export const getSubmissionStatusColor = (status: SubmissionStatus): string => {
  return SUBMISSION_STATUS_COLORS[status] || 'gray';
};

// ═══════════════════════════════════════════════════════════════════
// GROUPED QUESTIONS TYPE
// ═══════════════════════════════════════════════════════════════════

export interface GroupedQuestions {
  sectionNumber: number;
  sectionTitle: string;
  questions: ReportQuestion[];
}

// ═══════════════════════════════════════════════════════════════════
// VALIDATION ERROR TYPES
// ═══════════════════════════════════════════════════════════════════

export interface ReportValidationError {
  path: string[];
  message: string;
}