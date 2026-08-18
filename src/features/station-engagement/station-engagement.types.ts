// src/features/station-engagement/station-engagement.types.ts

// ─── Enums ──────────────────────────────────────────────────────────────────

import { SuccessionCourtCategory } from "../successioncourts/succession-courts.types";

export type EngagementMode = 
  | 'phone_call' 
  | 'whatsapp' 
  | 'email' 
  | 'physical_visit' 
  | 'webinar_followup' 
  | 'video_call'
  | 'walk_in';

export type EngagementStatus = 
  | 'resolved' 
  | 'ongoing' 
  | 'escalated';

export type ReasonNotReached = 
  | 'no_response' 
  | 'wrong_contact' 
  | 'station_closed' 
  | 'staff_unavailable' 
  | 'technical_issues' 
  | 'other';

export type ReportStatus = 
  | 'draft'        // Not visible to super admin, editable
  | 'submitted'    // Sent to super admin, visible, awaiting review
  | 'reviewed'     // Super admin has reviewed
  | 'approved'     // Super admin approved
  | 'rejected';    // Super admin rejected, can be resubmitted

export type Urgency = 'high' | 'medium' | 'low';

// ─── Constants ────────────────────────────────────────────────────────────

export const ENGAGEMENT_MODE_OPTIONS: { value: EngagementMode; label: string }[] = [
  { value: 'phone_call', label: 'Phone Call' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'Email' },
  { value: 'physical_visit', label: 'Physical Visit' },
  { value: 'webinar_followup', label: 'Webinar Follow-up' },
  { value: 'video_call', label: 'Video Call' },
  { value: 'walk_in', label: 'Walk-in' },
];

export const ENGAGEMENT_STATUS_OPTIONS: { value: EngagementStatus; label: string }[] = [
  { value: 'resolved', label: 'Resolved' },
  { value: 'ongoing', label: 'Ongoing' },
  { value: 'escalated', label: 'Escalated' },
];

export const REASON_NOT_REACHED_OPTIONS: { value: ReasonNotReached; label: string }[] = [
  { value: 'no_response', label: 'No Response' },
  { value: 'wrong_contact', label: 'Wrong Contact' },
  { value: 'station_closed', label: 'Station Closed' },
  { value: 'staff_unavailable', label: 'Staff Unavailable' },
  { value: 'technical_issues', label: 'Technical Issues' },
  { value: 'other', label: 'Other' },
];

export const REPORT_STATUS_OPTIONS: { value: ReportStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

export const ISSUES_RAISED_OPTIONS: string[] = [
  'Technical Issues',
  'Staffing Issues',
  'Resource Constraints',
  'Procedure Delays',
  'Communication Gaps',
  'System Downtime',
  'Access Issues',
  'Training Needs',
  'Compliance Concerns',
  'Other',
];

export const URGENCY_OPTIONS: { value: Urgency; label: string }[] = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

// ✅ Status constants for workflow
export const EDITABLE_REPORT_STATUSES: ReportStatus[] = ['draft', 'rejected'];
export const VISIBLE_TO_SUPER_ADMIN_STATUSES: ReportStatus[] = ['submitted', 'reviewed', 'approved', 'rejected'];
export const SUBMITTABLE_STATUSES: ReportStatus[] = ['draft', 'rejected'];

// ✅ Helper functions
export const isReportEditable = (status: ReportStatus): boolean =>
  EDITABLE_REPORT_STATUSES.includes(status);

export const isReportVisibleToSuperAdmin = (status: ReportStatus): boolean =>
  VISIBLE_TO_SUPER_ADMIN_STATUSES.includes(status);

export const isReportSubmittable = (status: ReportStatus): boolean =>
  SUBMITTABLE_STATUSES.includes(status);

// ✅ Check if report can be sent to admin
export const canSendToAdmin = (report: StationEngagementReport): boolean => {
  return (report.status === 'draft' || report.status === 'rejected') && !!report.pdfSecureUrl;
};

// ─── Core Types ────────────────────────────────────────────────────────────

export interface Engagement {
  id: string;
  station_id: string;
  station_name: string;
  station_category: SuccessionCourtCategory;
  date: string;
  contact_person: string;
  contact_role?: string;
  mode: EngagementMode;
  status: EngagementStatus;
  follow_up_date?: string;
  issues_raised: string[];
  action_taken: string;
  resolution?: string;
  urgency?: Urgency;
  why_needs_escalation?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface EngagementInput {
  station_id: string;
  station_name: string;
  station_category: SuccessionCourtCategory;
  date: string;
  contact_person: string;
  contact_role?: string;
  mode: EngagementMode;
  status: EngagementStatus;
  follow_up_date?: string;
  issues_raised: string[];
  action_taken: string;
  resolution?: string;
  urgency?: Urgency;
  why_needs_escalation?: string;
}

export interface UnengagedStation {
  station_id: string;
  station_name: string;
  category: SuccessionCourtCategory;
  reason_not_reached?: ReasonNotReached;
  reason_not_reached_detail?: string;
  planned_engagement_date?: string;
  is_active: boolean;
}

export interface EscalationItem {
  id: string;
  station_id: string;
  station_name: string;
  issue: string;
  why_needs_escalation: string;
  recommended_action: string;
  urgency: Urgency;
  source_engagement_id?: string | null;
  status: 'pending' | 'resolved';
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface EscalationItemInput {
  station_id: string;
  station_name: string;
  issue: string;
  why_needs_escalation: string;
  recommended_action: string;
  urgency: Urgency;
  source_engagement_id?: string | null;
}

export interface RecurringPattern {
  id: string;
  pattern: string;
  stations_affected: string[];
  severity: 'low' | 'medium' | 'high';
  suggested_action: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface PriorityItem {
  id: string;
  priority: string;
  station_id?: string;
  station_name?: string;
  due_date?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// ─── Report Types ──────────────────────────────────────────────────────────

export interface StationEngagementReport {
  id: string;
  week_start: string;
  week_end: string;
  categories: SuccessionCourtCategory[];
  support_person_id: string;
  total_stations_assigned: number;

  executive_summary: string;
  engagements: Engagement[];
  unengaged_stations: UnengagedStation[];
  escalations: EscalationItem[];
  additional_issues: string;
  recurring_patterns: string;
  priorities: string;

  // PDF fields - can be attached regardless of status
  pdfPublicId?: string | null;
  pdfSecureUrl?: string | null;
  pdfFileName?: string | null;
  pdfGeneratedAt?: string | null;
  
  // PDF preview (temporary, for previewing before attaching)
  pdfPreviewData?: string | null;
  pdfPreviewUrl?: string | null;

  // Submission tracking
  submitted_by: string;
  submitted_at?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  approved_by?: string;
  approved_at?: string;
  status: ReportStatus;
  feedback?: string;

  // Sent to admin tracking
  sent_to_admin_at?: string;
  sent_to_admin_by?: string;

  // Download tracking
  download_count?: number;
  last_downloaded_at?: string;

  created_at: string;
  updated_at: string;
}

// ─── Request/Response Types ──────────────────────────────────────────────

export interface CreateEngagementReportPayload {
  week_start: string;
  week_end: string;
  categories: SuccessionCourtCategory[];
  support_person_id: string;
  total_stations_assigned: number;
  executive_summary: string;
  engagements: EngagementInput[];
  unengaged_stations: {
    station_id: string;
    reason_not_reached?: ReasonNotReached;
    reason_not_reached_detail?: string;
    planned_engagement_date?: string;
  }[];
  escalations: EscalationItemInput[];
  additional_issues: string;
  recurring_patterns: string;
  priorities: string;
  saveAsDraft?: boolean;
  pdfPreviewData?: string | null;
}

export interface UpdateEngagementReportPayload {
  executive_summary?: string;
  engagements?: EngagementInput[];
  unengaged_stations?: {
    station_id: string;
    reason_not_reached?: ReasonNotReached;
    reason_not_reached_detail?: string;
    planned_engagement_date?: string;
  }[];
  escalations?: EscalationItemInput[];
  additional_issues?: string;
  recurring_patterns?: string;
  priorities?: string;
  status?: ReportStatus;
  feedback?: string;
  pdfPublicId?: string | null;
  pdfSecureUrl?: string | null;
  pdfFileName?: string | null;
  pdfGeneratedAt?: string | null;
  pdfPreviewData?: string | null;
}

export interface ReviewReportPayload {
  status: 'approved' | 'rejected';
  feedback?: string;
}

// ✅ Submit to super admin payload - this changes status from draft to submitted
export interface SubmitReportToAdminPayload {
  reportId: string;
  sendNotification?: boolean;
  notes?: string;
}

export interface DownloadReportPayload {
  reportId: string;
  format: 'pdf' | 'excel';
  includeAttachments?: boolean;
}

export interface EngagementReportFilters {
  category?: SuccessionCourtCategory;
  urgency?: Urgency;
  status?: ReportStatus;
  week_start?: string;
  week_end?: string;
  submitted_by?: string;
  support_person_id?: string;
  visibleToAdmin?: boolean;
  isDraft?: boolean;
  limit?: number;
  offset?: number;
}

// ─── Response Types ──────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data: T;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── Report Summary Types ────────────────────────────────────────────────

export interface ReportSummary {
  id: string;
  week_start: string;
  week_end: string;
  categories: SuccessionCourtCategory[];
  total_stations: number;
  engaged_count: number;
  unengaged_count: number;
  escalated_count: number;
  status: ReportStatus;
  submitted_by: string;
  submitted_at?: string;
  isVisibleToAdmin: boolean;
  hasPdf: boolean;
}

// ─── PDF Report Types ─────────────────────────────────────────────────────

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
  previewMode?: boolean;
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
  base64?: string;
  previewUrl?: string;
  previewData?: string;
  isPreview?: boolean;
}

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
  isPreview?: boolean;
  previewExpiresAt?: string;
}

export interface PDFReportData {
  report: StationEngagementReport;
  generated_at: string;
  generated_by: string;
  isPreview?: boolean;
}

export interface GeneratePdfRequest {
  reportId: string;
  options?: PDFGenerationOptions;
  previewOnly?: boolean;
}

// ─── Stats Types ─────────────────────────────────────────────────────────

export interface EngagementStats {
  total_reports: number;
  by_category: Record<SuccessionCourtCategory, number>;
  by_status: {
    draft: number;
    submitted: number;
    reviewed: number;
    approved: number;
    rejected: number;
  };
  by_urgency: Record<Urgency, number>;
  engagement_rate: number;
  escalation_rate: number;
  draft_count: number;
  submitted_count: number;
  avg_time_to_submit_days?: number;
}

// ─── Slice State ─────────────────────────────────────────────────────────

export interface StationEngagementState {
  reports: StationEngagementReport[];
  currentReport: StationEngagementReport | null;
  reportSummary: ReportSummary | null;
  stats: EngagementStats | null;

  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;

  total: number;
  page: number;
  limit: number;
  totalPages: number;

  filters: EngagementReportFilters;

  pdfData: PDFReportData | null;
  isGeneratingPDF: boolean;
  pdfPreview: {
    url: string | null;
    data: string | null;
    isGenerating: boolean;
    error: string | null;
  };

  excelData: Blob | null;
  isGeneratingExcel: boolean;

  downloadHistory: {
    reportId: string;
    downloadedAt: string;
    format: 'pdf' | 'excel';
    userId: string;
  }[];

  draftReports: StationEngagementReport[];
  isSavingDraft: boolean;
  draftSavedAt: string | null;
}

// ─── Form Types ──────────────────────────────────────────────────────────

export interface EngagementFormValues {
  station_id: string;
  station_name: string;
  station_category: SuccessionCourtCategory | '';
  date: string;
  contact_person: string;
  contact_role: string;
  mode: EngagementMode | '';
  status: EngagementStatus | '';
  follow_up_date: string;
  issues_raised: string[];
  action_taken: string;
  resolution: string;
  urgency: Urgency | '';
  why_needs_escalation: string;
}

export interface UnengagedStationFormValues {
  station_id: string;
  reason_not_reached: ReasonNotReached | '';
  reason_not_reached_detail: string;
  planned_engagement_date: string;
}

export interface EscalationFormValues {
  station_id: string;
  station_name: string;
  issue: string;
  why_needs_escalation: string;
  recommended_action: string;
  urgency: Urgency | '';
}

export interface ReportFormValues {
  week_start: string;
  week_end: string;
  categories: SuccessionCourtCategory[];
  executive_summary: string;
  engagements: EngagementFormValues[];
  unengaged_stations: UnengagedStationFormValues[];
  escalations: EscalationFormValues[];
  additional_issues: string;
  recurring_patterns: string;
  priorities: string;
  isDraft: boolean;
  saveAsDraft: boolean;
  pdfPreviewUrl?: string;
}

// ─── Review Form Types ──────────────────────────────────────────────────

export interface ReviewFormValues {
  status: 'approved' | 'rejected' | '';
  feedback: string;
}

// ─── Component Props ─────────────────────────────────────────────────────

export interface ReportCardProps {
  report: StationEngagementReport;
  onView: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onSubmit: (id: string) => void;
  onReview: (id: string) => void;
  onGeneratePDF: (id: string, previewOnly?: boolean) => void;
  onGenerateExcel?: (id: string) => void;
  onGenerateBoth?: (id: string) => void;
  onDownload: (id: string, format: 'pdf' | 'excel') => void;
  onSendToAdmin: (id: string) => void;  // This submits the report
  onSaveDraft: (id: string) => void;
  isSubmitting?: boolean;
  isDraft?: boolean;
}

export interface EngagementTableProps {
  engagements: Engagement[];
  onEdit?: (engagement: Engagement) => void;
  onDelete?: (id: string) => void;
}

export interface ReportStatsProps {
  stats: EngagementStats;
}

export interface EngagementFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: EngagementFormValues) => void;
  initialData?: EngagementFormValues;
  stations: { id: string; name: string; category: SuccessionCourtCategory }[];
  isSubmitting?: boolean;
}

export interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ReviewFormValues) => void;
  reportId: string;
  reportName: string;
  isSubmitting?: boolean;
}

export interface PDFPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onDownload: () => void;
  pdfUrl: string;
  reportName: string;
  isGenerating?: boolean;
  isUploading?: boolean;
}

export interface DraftManagerProps {
  drafts: StationEngagementReport[];
  onLoadDraft: (id: string) => void;
  onDeleteDraft: (id: string) => void;
  onContinueDraft: (id: string) => void;
  onSendToAdmin: (id: string) => void;
}

// ─── Export Related Types ────────────────────────────────────────────────

export interface ExportOptions {
  includeEngagements?: boolean;
  includeUnengagedStations?: boolean;
  includeEscalations?: boolean;
  includePatterns?: boolean;
  includeDrafts?: boolean;
}

export interface ExportResult {
  success: boolean;
  message: string;
  data?: Blob;
  filename?: string;
  downloadId?: string;
  fileSize?: number;
}

export type FileType = 'pdf' | 'excel' | 'zip';

// ─── Workflow Helpers ─────────────────────────────────────────────────────

export const canEdit = (report: StationEngagementReport): boolean => {
  return report.status === 'draft' || report.status === 'rejected';
};

// ✅ A report can be submitted to admin if:
// 1. It's a draft OR rejected (editable)
// 2. It has a PDF attached
export const canSubmitToAdmin = (report: StationEngagementReport): boolean => {
  return (report.status === 'draft' || report.status === 'rejected') && !!report.pdfSecureUrl;
};

export const canReview = (report: StationEngagementReport): boolean => {
  return report.status === 'submitted';
};

export const canApprove = (report: StationEngagementReport): boolean => {
  return report.status === 'reviewed';
};

export const canGeneratePDF = (report: StationEngagementReport): boolean => {
  // PDF can be generated for any status except maybe approved
  return report.status !== 'approved';
};

export const canViewPDF = (report: StationEngagementReport): boolean => {
  return !!report.pdfSecureUrl || !!report.pdfPreviewUrl;
};

export const hasPDFAttached = (report: StationEngagementReport): boolean => {
  return !!report.pdfSecureUrl && !!report.pdfPublicId;
};

export const hasPDFPreview = (report: StationEngagementReport): boolean => {
  return !!report.pdfPreviewUrl || !!report.pdfPreviewData;
};

export const isDraftReport = (report: StationEngagementReport): boolean => {
  return report.status === 'draft';
};

export const isVisibleToAdmin = (report: StationEngagementReport): boolean => {
  return report.status !== 'draft';
};

export const getVisibilityLabel = (report: StationEngagementReport): string => {
  return isDraftReport(report) ? 'Draft (Not Visible)' : 'Published';
};

export const getDownloadCountLabel = (report: StationEngagementReport): string => {
  const count = report.download_count || 0;
  return `${count} download${count !== 1 ? 's' : ''}`;
};