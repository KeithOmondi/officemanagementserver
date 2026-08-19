export type JoDocumentStatus = 'draft' | 'pending_review' | 'approved' | 'rejected';

export type JoDocumentFlowAction =
  | 'created'
  | 'draft_saved'
  | 'sent'
  | 'approved'
  | 'rejected'
  | 'resubmitted';

export interface JoDocument {
  id: string;
  title: string;
  file_url: string | null;
  file_public_id: string | null;
  file_size_bytes: number | null;
  mime_type: string | null;
  original_name: string | null;
  status: JoDocumentStatus;
  uploaded_by: string;
  uploaded_by_name: string;
  department_id: string | null;
  department_name: string | null;
  assigned_to: string | null;
  assigned_to_name: string | null;
  rejection_reason: string | null;
  reviewed_by: string | null;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  revision_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  response_count?: number;
}

export interface JoDocumentResponse {
  id: string;
  jo_document_id: string;
  response_number: number;
  responded_by: string;
  responded_by_name: string;
  note: string;
  file_url: string | null;
  file_public_id: string | null;
  file_size_bytes: number | null;
  mime_type: string | null;
  original_name: string | null;
  created_at: string;
}

export interface JoDocumentWithResponses extends JoDocument {
  responses: JoDocumentResponse[];
}

export interface JoDocumentFlowEntry {
  id: string;
  jo_document_id: string;
  action: JoDocumentFlowAction;
  actor_id: string | null;
  actor_name: string | null;
  note: string | null;
  created_at: string;
}

export interface JoDocumentPaginationResponse {
  data: JoDocument[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── Filters ─────────────────────────────────────────────────────────────

export interface JoDocumentFilters {
  status?: JoDocumentStatus;
  department_id?: string;
  mine?: boolean;
  assigned_to_me?: boolean;
  search?: string;
  page?: number;
  limit?: number;
  sort_by?: 'created_at' | 'updated_at' | 'title' | 'status';
  sort_order?: 'ASC' | 'DESC';
}

// ─── Inputs ──────────────────────────────────────────────────────────────

export interface CreateJoDocumentInput {
  title: string;
  department_id?: string;
  is_draft?: boolean;
}

export interface UpdateJoDocumentInput {
  title?: string;
}

export interface SendToSuperAdminInput {
  assigned_to?: string;
  note?: string;
}

export interface RespondToJoDocumentInput {
  note: string;
}

export interface ApproveJoDocumentInput {
  note?: string;
}

export interface RejectJoDocumentInput {
  reason: string;
}

export interface ResubmitJoDocumentInput {
  note?: string;
}