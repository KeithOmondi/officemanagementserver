// src/features/documents/documents.types.ts

// ... (keep all existing types above)

// ════════════════════════════════════════════════════════════════════════════
//  FOLLOW-UP TYPES (UPDATED)
// ════════════════════════════════════════════════════════════════════════════

export type FollowUpStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'filed_away';

export type FollowUpPriority = 'low' | 'normal' | 'urgent';

export interface FollowUp {
  id: string;
  document_id: string;
  mark_id: string | null;        // Optional - link to bring-up mark
  notes: string;                 // Required - what was done or needs to be done
  assigned_to: string;
  assigned_to_name: string | null;
  created_by: string;
  created_by_name: string | null;
  due_date: string | null;       // ✅ Optional - can be null (for filed away items)
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

// ── Follow-up Input Types ──────────────────────────────────────────────────

/**
 * Create Follow-Up Input
 * 
 * Simplified for user needs:
 * - notes: Required - what was done or needs to be done
 * - due_date: Optional - only set if future follow-up needed
 * - status: Optional - defaults to 'pending' if due_date set, 'filed_away' if not
 * - title: Removed - auto-generated from document title
 */
export interface CreateFollowUpInput {
  document_id: string;
  mark_id?: string;              // Optional - may not always be linked to a mark
  notes: string;                 // Required - the main content
  assigned_to: string;           // Who this follow-up is for
  due_date?: Date | string | null; // Optional - if not provided, it's "filed away"
  priority?: FollowUpPriority;   // Optional - defaults to 'normal'
}

/**
 * Update Follow-Up Input
 */
export interface UpdateFollowUpInput {
  notes?: string;
  assigned_to?: string;
  due_date?: Date | string | null;
  priority?: FollowUpPriority;
  status?: FollowUpStatus;
  completion_notes?: string;
  cancellation_reason?: string;
}

/**
 * Complete Follow-Up Input
 */
export interface CompleteFollowUpInput {
  completion_notes?: string;
}

/**
 * Cancel Follow-Up Input
 */
export interface CancelFollowUpInput {
  cancellation_reason: string;
}

/**
 * Add Follow-Up Comment Input
 */
export interface AddFollowUpCommentInput {
  comment: string;
}

/**
 * Follow-Up Filters
 */
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
  // ✅ New filter: Show only "active" follow-ups (not filed away)
  active_only?: boolean;
  // ✅ New filter: Show only "filed away" items
  filed_only?: boolean;
}

// ── Document ──────────────────────────────────────────────────────────────

// ... (keep Document interface as is)

export interface DocumentWithAnnotations extends Document {
  annotations: DocumentAnnotation[];
  mark_history: DocumentMark[];
  responses: DocumentResponse[];
  follow_ups: FollowUp[]; // Add follow-ups to document details
}

// ── Document Flow Entry ────────────────────────────────────────────────────

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
  // ── Follow-up actions ──────────────────────────────────────────────────
  | 'follow_up_created'
  | 'follow_up_updated'
  | 'follow_up_completed'
  | 'follow_up_cancelled'
  | 'follow_up_comment_added'
  | 'follow_up_filed_away';      // ✅ New action for filing away

export interface DocumentFlowEntry {
  id: string;
  document_id: string;
  action: DocumentFlowAction;
  from_user: string | null;
  from_user_name: string | null;
  to_user: string | null;
  to_user_name: string | null;
  note: string | null;
  created_at: string;
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

// ── Follow-up View Models ────────────────────────────────────────────────────

/**
 * For displaying follow-ups in a list/table
 */
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
  is_filed_away: boolean;        // ✅ Derived from due_date being null OR status = 'filed_away'
}

/**
 * For the "My Follow-Ups" dashboard view
 */
export interface MyFollowUpSummary {
  pending: number;               // Follow-ups with due_date in future
  overdue: number;               // Follow-ups with due_date past
  completed: number;             // Completed follow-ups (including filed away)
  filed_away: number;            // Follow-ups marked as filed away
  total: number;
}

/**
 * For the "File Away" action
 */
export interface FileAwayInput {
  document_id: string;
  mark_id?: string;
  notes: string;                 // What was done
  completion_notes?: string;
}