// src/features/documents/documents.types.ts

// ─── Type enums ────────────────────────────────────────────────────────────────

export type DocumentType =
  | 'memo' | 'letter' | 'certificate' | 'judgment' | 'ruling'
  | 'order' | 'correspondence' | 'upload' | 'ticket';

export type DocumentStatus =
  | 'draft'
  | 'uploaded'
  | 'pending_review'
  | 'dept_assigned'
  | 'user_assigned'
  | 'marked'
  | 'in_progress'
  | 'completed'
  | 'filed'
  | 'ready_to_release'
  | 'released';

export type DocumentCategory =
  | 'judgments' | 'rulings' | 'correspondence'
  | 'orders' | 'drafts' | 'general' | 'certificates';

export type RoutePriority = 'low' | 'normal' | 'urgent';

export type RefType =
  | 'for_signature' | 'for_attention' | 'for_information' | 'direction' | 'other';

// ─── Request Types ─────────────────────────────────────────────────────────────

export type RequestType =
  | 'driver'
  | 'bodyguard'
  | 'firearm'
  | 'current_station'
  | 'force_number'
  | 'residence_security'
  | 'sentry';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

// ─── Document Request Details ────────────────────────────────────────────────

export interface DocumentRequestDetails {
  request_type: RequestType | null;

  // Driver specific fields
  driver_name?: string | null;
  driver_license?: string | null;
  driver_vehicle?: string | null;
  driver_contact?: string | null;

  // Bodyguard specific fields
  bodyguard_name?: string | null;
  bodyguard_badge?: string | null;
  bodyguard_unit?: string | null;
  bodyguard_contact?: string | null;

  // Firearm specific fields
  firearm_type?: string | null;
  firearm_serial?: string | null;
  firearm_caliber?: string | null;
  firearm_owner?: string | null;
  firearm_license?: string | null;

  // Current station specific fields
  current_station_name?: string | null;
  current_station_location?: string | null;
  current_station_contact?: string | null;
  current_station_head?: string | null;

  // Force number specific fields
  force_number_value?: string | null;
  force_number_rank?: string | null;
  force_number_unit?: string | null;
  force_number_issue_date?: string | null;

  // Residence Security / Sentry specific fields
  residence_address?: string | null;
  residence_city?: string | null;
  residence_state?: string | null;
  security_personnel_count?: number | null;
  security_shift_hours?: string | null;
  security_equipment?: string | null;
  sentry_post_location?: string | null;
  sentry_instructions?: string | null;

  // Common request fields
  request_date?: string | null;
  request_reason?: string | null;
  request_duration?: string | null;
  request_start_date?: string | null;
  request_end_date?: string | null;
  requesting_officer?: string | null;
  requesting_officer_rank?: string | null;
  approving_officer?: string | null;
  approving_officer_rank?: string | null;
  approval_status?: ApprovalStatus | null;
  approval_date?: string | null;
  remarks?: string | null;
}

// ─── Basic Interfaces ─────────────────────────────────────────────────────────

export interface DocumentMark {
  id: string;
  document_id: string;
  marked_by: string;
  marked_by_name: string;
  marked_to_dept: string;
  marked_to_dept_name: string;
  assigned_to: string | null;
  assigned_to_name: string | null;
  instructions: string | null;
  priority: RoutePriority;
  marked_at: Date;
  acknowledged_at: Date | null;
  completed_at: Date | null;
  is_active: boolean;
}

export interface DocumentAnnotation {
  id: string;
  document_id: string;
  annotated_by: string;
  annotated_by_name: string;
  comment: string;
  is_urgent: boolean;
  visible_in_summary: boolean;
  created_at: Date;
}

export interface DocumentResponse {
  id: string;
  document_id: string;
  response_number: number;
  responded_by: string;
  responded_by_name: string;
  note: string;
  file_url: string | null;
  file_public_id: string | null;
  file_size_bytes: number | null;
  mime_type: string | null;
  original_name: string | null;
  created_at: Date;
}

export interface DocumentFlowEntry {
  id: string;
  document_id: string;
  action: DocumentFlowAction;
  from_user: string | null;
  from_user_name: string | null;
  to_user: string | null;
  to_user_name: string | null;
  note: string | null;
  created_at: Date;
}

export type DocumentFlowAction =
  | 'created'
  | 'uploaded'
  | 'updated'
  | 'assigned_to_dept'
  | 'assigned_to_user'
  | 'acknowledged'
  | 'started'
  | 'completed'
  | 'filed'
  | 'released'
  | 'signed'
  | 'sent'
  | 'returned'
  | 'responded'
  | 'deleted'
  | 'annotated'
  | 'redirected_to_folder'
  | 'removed_from_folder'
  | 'follow_up_created'
  | 'follow_up_updated'
  | 'follow_up_completed'
  | 'follow_up_cancelled'
  | 'follow_up_comment_added'
  | 'follow_up_filed_away';

// ─── Bring Up Types ────────────────────────────────────────────────────────────

export interface BringUpHistoryEntry {
  id: string;
  document_id: string;
  bring_up_date: string;              // The date that was set
  set_by: string;                     // Super Admin who set it
  set_by_name: string;
  set_at: string;                     // When it was set
  completed_at: string | null;        // When it was completed (if ever)
  completed_by: string | null;        // Who completed it
  completed_by_name: string | null;
  notes: string | null;               // Notes at time of setting
  completion_notes: string | null;    // Notes when completed
  is_active: boolean;                 // True if this is the current bring up
  created_at: string;
  updated_at: string;
}

export interface BringUpSummary {
  total_pending: number;              // All active bring ups not yet completed
  total_overdue: number;              // Bring ups past their date
  total_completed: number;            // Completed bring ups
  due_today: number;                  // Due today
  due_this_week: number;              // Due this week
  by_department: {                    // Breakdown by department
    department_id: string;
    department_name: string;
    pending: number;
    overdue: number;
  }[];
  my_pending: number;                 // For current user
  my_overdue: number;                 // For current user
}

export type BringUpStatus = 'pending' | 'completed' | 'overdue' | 'all';

// ─── Document Interface ──────────────────────────────────────────────────────

export interface Document {
  id: string;
  title: string;
  type: DocumentType;
  category: DocumentCategory | null;
  status: DocumentStatus;
  reference_no: string | null;
  ref_type: RefType | null;
  ref_other_description: string | null;
  body: string | null;
  file_url: string | null;
  file_public_id: string | null;
  file_size_bytes: number | null;
  mime_type: string | null;
  original_name: string | null;
  priority: RoutePriority;
  assigned_to: string | null;
  assigned_to_name: string | null;
  created_by: string;
  created_by_name: string;
  department_id: string | null;
  department_name: string | null;
  folder_id: string | null;
  folder_name: string | null;
  is_signed: boolean;
  signed_by: string | null;
  signed_by_name: string | null;
  signed_at: Date | null;
  released_at: Date | null;
  released_by: string | null;
  released_by_name: string | null;
  is_sent: boolean;
  sent_at: Date | null;
  is_draft: boolean;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  active_mark: DocumentMark | null;
  response_count?: number;
  to_recipient: string | null;
  from_sender: string | null;
  document_date: string | null;
  subject: string | null;
  cc: string | null;
  enclosures: string | null;
  signature_name: string | null;
  signature_title: string | null;
  signature_position_x: number | null;
  signature_position_y: number | null;
  signature_position_width: number | null;
  signature_position_height: number | null;
  request_details: DocumentRequestDetails | null;
  follow_ups?: FollowUp[];
  
  // ─── Bring Up Fields ──────────────────────────────────────────────────────
  bring_up_date: string | null;              // When document must be dealt with
  bring_up_set_by: string | null;            // Super Admin who set it
  bring_up_set_by_name: string | null;
  bring_up_set_at: string | null;            // When it was set
  bring_up_completed_at: string | null;      // When it was actually brought up
  bring_up_completed_by: string | null;      // Who completed it
  bring_up_completed_by_name: string | null;
  bring_up_notes: string | null;             // Super Admin's notes
  bring_up_history: BringUpHistoryEntry[] | null; // History of all bring up dates
  bring_up_status: BringUpStatus | null;     // Computed field
}

export interface DocumentWithAnnotations extends Document {
  annotations: DocumentAnnotation[];
  mark_history: DocumentMark[];
  responses: DocumentResponse[];
  follow_ups?: FollowUp[];
}

export interface DocumentPaginationResponse {
  data: Document[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── Document Filters ─────────────────────────────────────────────────────────

export interface DocumentFilters {
  search?: string;
  type?: DocumentType;
  category?: DocumentCategory;
  status?: DocumentStatus;
  assigned_to?: string;
  department_id?: string;
  folder_id?: string;
  for_my_action?: boolean;
  visible_in_summary?: boolean;
  page?: number;
  limit?: number;
  sort_by?: 'created_at' | 'updated_at' | 'title' | 'status' | 'bring_up_date';
  sort_order?: 'ASC' | 'DESC';
  request_type?: RequestType;
  
  // ─── Bring Up Filters ─────────────────────────────────────────────────────
  has_bring_up_date?: boolean;           // Documents with a bring up date set
  bring_up_status?: BringUpStatus | 'all';
  bring_up_date_from?: string;           // Filter by bring up date range
  bring_up_date_to?: string;
  bring_up_due_today?: boolean;          // Quick filter for today's bring ups
  bring_up_due_this_week?: boolean;      // Quick filter for this week
  assigned_for_bring_up?: string;        // User ID who needs to bring up
}

// ─── Bring Up Input Types ────────────────────────────────────────────────────

export interface SetBringUpInput {
  bring_up_date: Date | string;          // When document must be dealt with
  notes?: string;                        // Optional notes from Super Admin
  assign_to?: string;                    // Optional: specific user to handle bring up
}

export interface UpdateBringUpInput {
  bring_up_date: Date | string;          // New date (auto saves previous as history)
  notes?: string;                        // Notes about why date changed
}

export interface CompleteBringUpInput {
  notes?: string;                        // Notes about what happened
}

export interface BringUpFilters {
  status?: BringUpStatus | 'all';
  date_from?: Date | string;
  date_to?: Date | string;
  due_today?: boolean;
  due_this_week?: boolean;
  assigned_to?: string;
  page?: number;
  limit?: number;
  sort_by?: 'bring_up_date' | 'created_at' | 'title';
  sort_order?: 'ASC' | 'DESC';
}

// ════════════════════════════════════════════════════════════════════════════
//  FOLLOW-UP TYPES
// ════════════════════════════════════════════════════════════════════════════

export type FollowUpStatus = 
  | 'pending'        // Has a due date in the future
  | 'in_progress'    // Being worked on
  | 'completed'      // Completed with or without due date
  | 'cancelled'      // Cancelled
  | 'filed_away';    // No due date, marked as done/filed

export type FollowUpPriority = 'low' | 'normal' | 'urgent';

export interface FollowUp {
  id: string;
  document_id: string;
  mark_id: string | null;
  notes: string;
  assigned_to: string;
  assigned_to_name: string | null;
  created_by: string;
  created_by_name: string | null;
  due_date: string | null;
  priority: FollowUpPriority;
  status: FollowUpStatus;
  completed_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  completion_notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  comment_count?: number;
}

export interface FollowUpComment {
  id: string;
  follow_up_id: string;
  user_id: string;
  user_name: string | null;
  comment: string;
  file_url: string | null;
  file_public_id: string | null;
  created_at: string;
}

export interface FollowUpWithComments extends FollowUp {
  comments: FollowUpComment[];
}

export interface FollowUpPaginationResponse {
  data: FollowUp[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export type FollowUpReminderType = 'one_day_before' | 'due_date' | 'overdue';

export interface FollowUpReminder {
  id: string;
  follow_up_id: string;
  reminder_date: string;
  reminder_type: FollowUpReminderType;
  sent_at: string | null;
  created_at: string;
}

// ─── Follow-up Input Types ──────────────────────────────────────────────────

export interface CreateFollowUpInput {
  document_id: string;
  mark_id?: string;
  notes: string;
  assigned_to: string;
  due_date?: Date | string | null;
  priority?: FollowUpPriority;
}

export interface FileAwayFollowUpInput {
  document_id: string;
  mark_id?: string;
  notes: string;
  completion_notes?: string;
}

export interface UpdateFollowUpInput {
  notes?: string;
  assigned_to?: string;
  due_date?: Date | string | null;
  priority?: FollowUpPriority;
  status?: FollowUpStatus;
  completion_notes?: string;
  cancellation_reason?: string;
}

export interface CompleteFollowUpInput {
  completion_notes?: string;
}

export interface CancelFollowUpInput {
  cancellation_reason: string;
}

export interface AddFollowUpCommentInput {
  comment: string;
}

export interface FollowUpFilters {
  document_id?: string;
  assigned_to?: string;
  status?: FollowUpStatus;
  priority?: FollowUpPriority;
  due_from?: Date | string;
  due_to?: Date | string;
  search?: string;
  page?: number;
  limit?: number;
  sort_by?: 'created_at' | 'due_date' | 'priority' | 'status' | 'notes';
  sort_order?: 'ASC' | 'DESC';
  active_only?: boolean;
  filed_only?: boolean;
}

export interface FollowUpSummary {
  pending: number;
  overdue: number;
  completed: number;
  filed_away: number;
  total: number;
  active: number;
}

// ─── Document Operation Input Types ──────────────────────────────────────────

export interface RedirectToFolderInput {
  folder_id: string;
  note?: string;
}

export interface RemoveFromFolderInput {
  note?: string;
}

export interface FolderDocumentFilters {
  folder_id: string;
  page?: number;
  limit?: number;
  search?: string;
  type?: DocumentType;
  status?: DocumentStatus;
  request_type?: RequestType;
}

// ─── Import/Export Types ─────────────────────────────────────────────────────

export interface ImportDocumentInput {
  title: string;
  type: DocumentType;
  category?: DocumentCategory;
  reference_no?: string;
  body?: string;
  assigned_to?: string;
  department_id?: string;
}

// ─── View Models ─────────────────────────────────────────────────────────────

export interface DocumentListItem {
  id: string;
  title: string;
  type: DocumentType;
  status: DocumentStatus;
  priority: RoutePriority;
  created_at: Date;
  created_by_name: string;
  assigned_to_name: string | null;
  department_name: string | null;
  response_count: number;
  active_mark: DocumentMark | null;
  // NEW: Bring up fields for list view
  bring_up_date: string | null;
  bring_up_status: BringUpStatus | null;
  bring_up_set_by_name: string | null;
}

export interface FollowUpListItem {
  id: string;
  document_title: string;
  document_id: string;
  notes: string;
  assigned_to_name: string | null;
  created_by_name: string | null;
  due_date: string | null;
  status: FollowUpStatus;
  priority: FollowUpPriority;
  created_at: string;
  is_filed_away: boolean;
}

export interface MyFollowUpSummary {
  pending: number;
  overdue: number;
  completed: number;
  filed_away: number;
  total: number;
}

// ─── Certificate Template Types ────────────────────────────────────────────────

export interface CertificateTemplateData {
  title: string;
  ruleReference?: string;
  ref?: string;
  date?: string;
  body: string;
  datedLine: string;
  signatoryLines: string[];
  draftedByInitials?: string;
  logoUrl?: string;
  footerEmblemUrl?: string;
  footerAddress?: string;
  footerContact?: string;
  footerTagline?: string;
}

// ─── Certificate Request Types ─────────────────────────────────────────────────

export interface CreateCertificateInput {
  title: string;
  ruleReference?: string;
  ref?: string;
  date?: string;
  body: string;
  datedLine: string;
  signatoryLines: string[];
  draftedByInitials?: string;
  logoUrl?: string;
  footerEmblemUrl?: string;
  footerAddress?: string;
  footerContact?: string;
  footerTagline?: string;
  // Document base fields
  title_display: string;
  type: 'certificate';
  category?: DocumentCategory;
  reference_no?: string;
  assigned_to?: string;
  department_id?: string;
}

export interface UpdateCertificateInput extends Partial<CreateCertificateInput> {
  id: string;
}

// ─── Compose Certificate Input (for the composition endpoint) ─────────────────

export interface ComposeCertificateInput {
  title: string;
  ruleReference?: string;
  ref?: string;
  date?: string;
  body: string;
  datedLine: string;
  signatoryLines: string[];
  draftedByInitials?: string;
  logoUrl?: string;
  footerEmblemUrl?: string;
  footerAddress?: string;
  footerContact?: string;
  footerTagline?: string;
  // Document storage fields
  from?: string;              // Maps to from_sender
  to?: string;                // Maps to to_recipient
  signatureName?: string;     // Maps to signature_name
  signatureTitle?: string;    // Maps to signature_title
  department_id?: string;
  reference_no?: string;
}