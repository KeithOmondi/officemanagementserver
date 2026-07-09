// src/features/helpdesk/helpdesk.documents.types.ts

export type DocumentFormat = 'pdf' | 'docx' | 'xlsx';

export type DocumentEntityType =
    | 'circuit'
    | 'bench'
    | 'partHeard'
    | 'serviceWeek'
    | 'otherPayment'
    | 'ticket';

export type DocumentStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'returned';

export type EStampStatus = 'pending' | 'stamped' | 'failed';

export interface HelpdeskDocument {
    id: string;
    ref: string;
    subject: string;
    entity_type: DocumentEntityType;
    entity_id: string | null;
    format: DocumentFormat;
    file_url: string;
    public_id: string;
    file_size: number | null;
    uploaded_by: string | null;
    uploaded_by_name?: string;
    status: DocumentStatus;
    e_stamp_status: EStampStatus;
    e_stamp_url?: string | null;
    e_stamp_public_id?: string | null;
    approval_history: ApprovalHistoryEntry[];
    comments: Comment[];
    is_active: boolean;
    created_at: string;
    updated_at: string;
    approved_at?: string;
    approved_by?: string;
    approved_by_name?: string;
    returned_at?: string;
    returned_by?: string;
    rejection_reason?: string;
}

export interface ApprovalHistoryEntry {
    id: string;
    document_id: string;
    action: 'submitted' | 'approved' | 'rejected' | 'returned';
    from_user_id: string;
    from_user_name: string;
    to_user_id?: string;
    to_user_name?: string;
    comments?: string;
    created_at: string;
}

export interface Comment {
    id: string;
    document_id: string;
    user_id: string;
    user_name: string;
    comment: string;
    is_internal: boolean;
    created_at: string;
}

export interface CreateHelpdeskDocumentInput {
    ref: string;
    subject: string;
    entity_type: DocumentEntityType;
    entity_id?: string;
    format: DocumentFormat;
    status?: DocumentStatus;
}

export interface UpdateDocumentStatusInput {
    status: DocumentStatus;
    comments?: string;
    rejection_reason?: string;
    e_stamp_url?: string;
    e_stamp_public_id?: string;
}

export interface HelpdeskDocumentFilters {
    entity_type?: DocumentEntityType;
    entity_id?: string;
    format?: DocumentFormat;
    status?: DocumentStatus;
    search?: string;
    limit?: number;
    offset?: number;
    uploaded_by?: string;
    pending_my_approval?: boolean;
}

export interface DocumentApprovalRequest {
    document_id: string;
    comments?: string;
}

export interface DocumentRejectionRequest {
    document_id: string;
    reason: string;
}

export interface DocumentReturnRequest {
    document_id: string;
    comments?: string;
    instructions?: string;
}

export interface LinkDocumentInput {
    entity_type: DocumentEntityType;
    entity_id: string;
}