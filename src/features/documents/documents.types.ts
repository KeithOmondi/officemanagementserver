// src/features/documents/documents.types.ts

// ─── Type enums ────────────────────────────────────────────────────────────────

export type DocumentType =
  | 'memo'
  | 'letter'
  | 'certificate'
  | 'judgment'
  | 'ruling'
  | 'order'
  | 'correspondence'
  | 'upload'
  | 'ticket';

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
  | 'judgments'
  | 'rulings'
  | 'correspondence'
  | 'orders'
  | 'drafts'
  | 'general'
  | 'certificates';

export type RoutePriority = 'low' | 'normal' | 'urgent';

export type RefType =
  | 'for_signature'
  | 'for_attention'
  | 'for_information'
  | 'direction'
  | 'other';

// ─── Document Metadata Types ───────────────────────────────────────────────────

export interface DocumentMetadata {
  fromFirst?: boolean; // Controls whether FROM appears before TO in memos
  // Add other metadata fields here as needed
}

// ─── Document Attachment Types ───────────────────────────────────────────────

export interface DocumentAttachment {
  id?: string; // Unique identifier for the attachment
  name: string;
  url: string;
  public_id?: string; // Cloudinary public ID for deletion
  size?: number;
  mimeType?: string;
  uploaded_by?: string; // User ID who uploaded
  uploaded_by_name?: string; // Name of user who uploaded
  uploaded_at?: string; // Timestamp when uploaded
}

// ─── Bring Up Types ────────────────────────────────────────────────────────────

export type BringUpStatus = 'pending' | 'completed' | 'overdue' | 'filed_away' | 'all';

export interface BringUpHistoryEntry {
  id: string;
  document_id: string;
  bring_up_date: string;
  set_by: string;
  set_by_name: string;
  set_at: string;
  completed_at: string | null;
  completed_by: string | null;
  completed_by_name: string | null;
  notes: string | null;
  completion_notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  filed_away_at: string | null;
  filed_away_by: string | null;
  filed_away_by_name: string | null;
  filed_away_notes: string | null;
}

export interface BringUpSummary {
  total_pending: number;
  total_overdue: number;
  total_completed: number;
  total_filed_away: number;
  due_today: number;
  due_this_week: number;
  by_department: {
    department_id: string;
    department_name: string;
    pending: number;
    overdue: number;
  }[];
  my_pending: number;
  my_overdue: number;
}

// ─── Bring Up Input Types ────────────────────────────────────────────────────

export interface SetBringUpInput {
  bring_up_date: Date | string;
  notes?: string;
  assign_to?: string;
}

export interface UpdateBringUpInput {
  bring_up_date: Date | string;
  notes?: string;
}

export interface CompleteBringUpInput {
  notes?: string;
}

export interface FileAwayBringUpInput {
  notes?: string;
  completion_notes?: string;
  return_to_helpdesk?: boolean;
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

// ─── Follow-Up Types ────────────────────────────────────────────────────────────

export type FollowUpStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'filed_away';

export type FollowUpPriority = 'low' | 'normal' | 'urgent';

export type FollowUpReminderType = 'one_day_before' | 'due_date' | 'overdue';

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

export interface SendFollowUpInput {
  document_id: string;
  mark_id?: string;
  notes: string;
  assigned_to: string;
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
  | 'follow_up_filed_away'
  | 'pdf_regenerated'
  | 'bring_up_set'
  | 'bring_up_updated'
  | 'bring_up_completed'
  | 'bring_up_filed_away'
  | 'attachment_added'
  | 'attachment_removed';

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
  metadata: DocumentMetadata | null;
  attachments?: DocumentAttachment[]; // Document attachments (supporting files)
  follow_ups?: FollowUp[];

  // ─── Bring Up Fields ──────────────────────────────────────────────────────
  bring_up_date: string | null;
  bring_up_set_by: string | null;
  bring_up_set_by_name: string | null;
  bring_up_set_at: string | null;
  bring_up_completed_at: string | null;
  bring_up_completed_by: string | null;
  bring_up_completed_by_name: string | null;
  bring_up_notes: string | null;
  bring_up_history: BringUpHistoryEntry[] | null;
  bring_up_status: BringUpStatus | null;
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

  // ─── Bring Up Filters ─────────────────────────────────────────────────────
  has_bring_up_date?: boolean;
  bring_up_status?: BringUpStatus | 'all';
  bring_up_date_from?: string;
  bring_up_date_to?: string;
  bring_up_due_today?: boolean;
  bring_up_due_this_week?: boolean;
  assigned_for_bring_up?: string;
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
}

// ─── Document Operation Input Types ──────────────────────────────────────────

export interface MarkDocumentInput {
  department_id: string;
  assigned_to?: string;
  instructions?: string;
  priority?: RoutePriority;
}

export interface UpdateMarkInput {
  instructions?: string;
}

export interface CreateAnnotationInput {
  comment: string;
  is_urgent?: boolean;
  visible_in_summary?: boolean;
}

export interface FinalizeDraftInput {
  assigned_to?: string;
  send_to_super_admin?: boolean;
}

export interface ReturnDocumentInput {
  note: string;
  requires_more_docs?: boolean;
}

export interface RespondToDocumentInput {
  note: string;
}

export interface SendToUserInput {
  recipient_id: string;
  note?: string;
}

// ─── Compose Input Types ──────────────────────────────────────────────────────

export interface ComposeMemoInput {
  title: string;
  to: string;
  date?: string;
  body: string;
  from?: string;
  signatureName?: string;
  signatureTitle?: string;
  department_id?: string;
  reference_no?: string;
  cc?: string; // CC field for memos
  attachments?: DocumentAttachment[]; // Attachments for the memo
  fromFirst?: boolean;
}

export interface ComposeLetterInput {
  title: string;
  to: string;
  date?: string;
  body: string;
  from?: string;
  signatureName?: string;
  signatureTitle?: string;
  department_id?: string;
  reference_no?: string;
  cc?: string;
  enclosures?: string;
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
  from?: string;
  to?: string;
  signatureName?: string;
  signatureTitle?: string;
  department_id?: string;
  reference_no?: string;
}

// ─── Create Document Inputs ──────────────────────────────────────────────────

export interface CreateComposedDocumentInput {
  title: string;
  type: 'judgment' | 'ruling' | 'order';
  category?: DocumentCategory;
  reference_no?: string;
  body: string;
  assigned_to?: string;
  department_id?: string;
}

export interface CreateUploadDocumentInput {
  title: string;
  type: Exclude<DocumentType, 'memo' | 'letter'>;
  category?: DocumentCategory;
  reference_no?: string;
  ref_type: RefType;
  ref_other_description?: string;
  assigned_to?: string;
  department_id?: string;
  is_draft?: boolean;
  priority?: RoutePriority;
}

// ─── Update Document Input ───────────────────────────────────────────────────

export interface UpdateDocumentInput {
  title?: string;
  category?: DocumentCategory | null;
  reference_no?: string | null;
  body?: string;
  status?: DocumentStatus;
  assigned_to?: string | null;
  department_id?: string | null;
  priority?: RoutePriority;
  to_recipient?: string | null;
  from_sender?: string | null;
  document_date?: string | null;
  subject?: string | null;
  cc?: string | null;
  enclosures?: string | null;
  signature_name?: string | null;
  signature_title?: string | null;
  signature_position_x?: number | null;
  signature_position_y?: number | null;
  signature_position_width?: number | null;
  signature_position_height?: number | null;
  metadata?: DocumentMetadata | null;
  attachments?: DocumentAttachment[] | null; // Update document attachments
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