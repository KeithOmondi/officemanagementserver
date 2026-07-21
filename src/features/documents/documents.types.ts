// src/features/documents/documents.types.ts

export type DocumentType =
  | 'judgment'
  | 'ruling'
  | 'order'
  | 'correspondence'
  | 'upload'
  | 'memo'
  | 'letter';

/**
 * Document status lifecycle:
 * 
 * ┌────────────┐      ┌───────────────┐      ┌──────────────┐      ┌──────────────┐
 * │   draft    │ ──▶ │  uploaded /   │ ──▶ │ dept_assigned│ ──▶ │ user_assigned│
 * │            │     │ pending_review│      │ (SuperAdmin) │     │ (DeptHead)   │
 * └────────────┘     └───────────────┘      └──────────────┘     └──────────────┘
 *                                                                        │
 *                                                                        ▼
 *                                                              ┌──────────────┐
 *                                                              │ in_progress  │
 *                                                              │ (user works) │
 *                                                              └──────────────┘
 *                                                                        │
 *                                                                        ▼
 *                                                              ┌──────────────┐
 *                                                              │  completed   │
 *                                                              └──────────────┘
 *                                                                        │
 *                                                          ┌─────────────┴─────────────┐
 *                                                          ▼                           ▼
 *                                                   ┌─────────────┐           ┌──────────────┐
 *                                                   │ ready_to_release │         │    filed    │
 *                                                   └─────────────┘           └──────────────┘
 *                                                          │
 *                                                          ▼
 *                                                   ┌─────────────┐
 *                                                   │  released   │
 *                                                   └─────────────┘
 */
export type DocumentStatus =
  | 'draft'
  | 'uploaded'
  | 'pending_review'
  | 'dept_assigned'   // Assigned to a department (by Super Admin)
  | 'user_assigned'   // Assigned to a specific user (by Department Head)
  | 'in_progress'
  | 'completed'
  | 'filed'
  | 'ready_to_release'
  | 'released';

// Legacy alias for backward compatibility – 'marked' is now 'dept_assigned'
// but we keep it so old clients still work.
export type LegacyDocumentStatus = 'marked';
// You can keep 'marked' in the union temporarily:
// export type DocumentStatus = ... | 'marked';

export type DocumentCategory =
  | 'judgments' | 'rulings' | 'correspondence' | 'orders' | 'drafts' | 'general';

export type RoutePriority = 'low' | 'normal' | 'urgent';

export type RefType = 'for_signature' | 'for_attention' | 'for_information' | 'direction' | 'other';

// ── Signature Placement ──────────────────────────────────────────────────
// NOTE: Signature placement is now auto‑detected by scanning the document
// for the signatory block (name + title). Custom absolute positioning can
// still be applied via signature_position_x/y/width/height fields.

// ── Document Mark ──────────────────────────────────────────────────────────

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
  bring_up_date: string | null;
  priority: RoutePriority;
  marked_at: Date;
  acknowledged_at: Date | null;
  completed_at: Date | null;
  is_active: boolean;
}

// ── Document Annotation ────────────────────────────────────────────────────

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

// ── Document Response ─────────────────────────────────────────────────────

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

// ════════════════════════════════════════════════════════════════════════════
//  FOLLOW-UP TYPES
// ════════════════════════════════════════════════════════════════════════════

export type FollowUpStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export type FollowUpPriority = 'low' | 'normal' | 'urgent';

export interface FollowUp {
  id: string;
  document_id: string;
  mark_id: string; // Links to the bring-up mark
  title: string;
  description: string | null;
  assigned_to: string;
  assigned_to_name: string | null;
  created_by: string;
  created_by_name: string | null;
  due_date: Date;
  priority: FollowUpPriority;
  status: FollowUpStatus;
  completed_at: Date | null;
  cancelled_at: Date | null;
  cancellation_reason: string | null;
  completion_notes: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
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
  created_at: Date;
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
  reminder_date: Date;
  reminder_type: FollowUpReminderType;
  sent_at: Date | null;
  created_at: Date;
}

// ── Follow-up Input Types ──────────────────────────────────────────────────

export interface CreateFollowUpInput {
  document_id: string;
  mark_id: string;
  title: string;
  description?: string;
  assigned_to: string;
  due_date: Date | string;
  priority: FollowUpPriority;
}

export interface UpdateFollowUpInput {
  title?: string;
  description?: string;
  assigned_to?: string;
  due_date?: Date | string;
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
  sort_by?: 'created_at' | 'due_date' | 'priority' | 'status' | 'title';
  sort_order?: 'ASC' | 'DESC';
}

// ── Document ──────────────────────────────────────────────────────────────

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

  // Memo/Letter specific fields
  to_recipient: string | null;
  from_sender: string | null;
  document_date: string | null;
  subject: string | null;
  cc: string | null;
  enclosures: string | null;
  signature_name: string | null;
  signature_title: string | null;

  // ── Custom signature position (draggable) ──────────────────────────────
  signature_position_x: number | null;
  signature_position_y: number | null;
  signature_position_width: number | null;
  signature_position_height: number | null;
}

export interface DocumentWithAnnotations extends Document {
  annotations: DocumentAnnotation[];
  mark_history: DocumentMark[];
  responses: DocumentResponse[];
  follow_ups: FollowUp[]; // Add follow-ups to document details
}

export interface DocumentPaginationResponse {
  data: Document[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ── Document Flow Entry ────────────────────────────────────────────────────
// Expanded action types for better audit trail

export type DocumentFlowAction =
  | 'created'
  | 'uploaded'
  | 'updated'
  | 'assigned_to_dept'      // Super Admin assigns to department
  | 'assigned_to_user'      // Dept Head assigns to a specific user
  | 'acknowledged'          // User acknowledges assignment
  | 'started'               // User starts working (optional)
  | 'completed'             // User finishes
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
  // ── Follow-up actions ──────────────────────────────────────────────────
  | 'follow_up_created'
  | 'follow_up_updated'
  | 'follow_up_completed'
  | 'follow_up_cancelled'
  | 'follow_up_comment_added';

export interface DocumentFlowEntry {
  id: string;
  document_id: string;
  action: DocumentFlowAction;  // now strongly typed
  from_user: string | null;
  from_user_name: string | null;
  to_user: string | null;
  to_user_name: string | null;
  note: string | null;
  created_at: Date;
}

// ── Document Folder Operations ─────────────────────────────────────────────

export interface RedirectToFolderInput {
  folder_id: string;
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