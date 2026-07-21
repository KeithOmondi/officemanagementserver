// src/features/helpdesk/helpdesk.documents.types.ts

export type DocumentFormat = 'pdf' | 'docx' | 'xlsx';

export type DocumentEntityType =
    | 'circuit'
    | 'bench'
    | 'partHeard'
    | 'serviceWeek'
    | 'otherPayment'
    | 'ticket'
    | 'medicalClaim'
    | 'generalRequest'   // Unified - includes all security/personnel requests
    | 'securityRequest'  // Deprecated - kept for backward compatibility
    | 'visa'             // Visa support documents
    | 'protocol'         // Protocol event documents
    | 'club'             // Club membership documents
    | 'utility_memo';    // Utility memo documents

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

    // Additional fields for better tracking
    request_type?: string;      // For general requests - Driver, Bodyguard, etc.
    judge_name?: string;        // Associated judge name

    // ─── NEW FIELDS ──────────────────────────────────────────────────────────
    rank?: string | null;       // Officer's rank (for Driver/Bodyguard)
    reporting_date?: string | null; // Expected reporting date
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
    entity_id?: string | null;
    format: DocumentFormat;
    status?: DocumentStatus;
    request_type?: string | null;      // For general requests
    judge_name?: string | null;        // For better tracking
    rank?: string | null;
    reporting_date?: string | null;
}

export interface UpdateDocumentStatusInput {
    status: DocumentStatus;
    comments?: string;
    rejection_reason?: string;
    e_stamp_url?: string;
    e_stamp_public_id?: string;
    approved_by?: string;
    approved_by_name?: string;
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
    unlinked?: boolean;  // Filter for documents not linked to any entity
    request_type?: string;  // Filter by request type (Driver, Bodyguard, etc.)
    judge_name?: string;    // Filter by judge name
    date_from?: string;     // Filter by date range
    date_to?: string;
    // ─── NEW FIELDS ──────────────────────────────────────────────────────────
    rank?: string;          // Filter by rank
    reporting_date?: string; // Filter by reporting date
}

export interface DocumentApprovalRequest {
    document_id: string;
    comments?: string;
    approved_by?: string;
    approved_by_name?: string;
}

export interface DocumentRejectionRequest {
    document_id: string;
    reason: string;
    rejected_by?: string;
    rejected_by_name?: string;
}

export interface DocumentReturnRequest {
    document_id: string;
    comments?: string;
    instructions?: string;
    returned_by?: string;
    returned_by_name?: string;
}

export interface LinkDocumentInput {
    entity_type: DocumentEntityType;
    entity_id: string;
    request_type?: string;      // For general requests
    judge_name?: string;        // For better tracking
    // ─── NEW FIELDS ──────────────────────────────────────────────────────────
    rank?: string;
    reporting_date?: string;
}

// ─── Document Summary Types ──────────────────────────────────────────────────

export interface DocumentSummary {
    total: number;
    by_status: Record<DocumentStatus, number>;
    by_entity_type: Record<DocumentEntityType, number>;
    by_format: Record<DocumentFormat, number>;
    pending_approval: number;
    draft: number;
    approved: number;
    rejected: number;
    returned: number;
}

export interface DocumentStats {
    total: number;
    pending_approval: number;
    approved: number;
    rejected: number;
    returned: number;
    draft: number;
    by_entity: {
        entity_type: DocumentEntityType;
        count: number;
        pending: number;
        approved: number;
    }[];
    recent_activity: {
        id: string;
        ref: string;
        subject: string;
        action: string;
        user_name: string;
        created_at: string;
    }[];
}

// ─── Constants ──────────────────────────────────────────────────────────────

export const DOCUMENT_ENTITY_LABELS: Record<DocumentEntityType, string> = {
    circuit: 'Circuit',
    bench: 'Bench',
    partHeard: 'Part-Heard',
    serviceWeek: 'Service Week',
    otherPayment: 'Other Payment',
    ticket: 'Travel Ticket',
    medicalClaim: 'Medical Claim',
    generalRequest: 'General Request',
    securityRequest: 'Security Request (Deprecated)',
    visa: 'Visa Support',
    protocol: 'Protocol Event',
    club: 'Club Membership',
    utility_memo: 'Utility Memo',
};

export const DOCUMENT_ENTITY_ICONS: Record<DocumentEntityType, string> = {
    circuit: 'MapPin',
    bench: 'Gavel',
    partHeard: 'FileCheck',
    serviceWeek: 'Calendar',
    otherPayment: 'CreditCard',
    ticket: 'Plane',
    medicalClaim: 'Stethoscope',
    generalRequest: 'FileText',
    securityRequest: 'Shield',
    visa: 'Plane',
    protocol: 'Calendar',
    club: 'Users',
    utility_memo: 'FileText',
};

export const DOCUMENT_ENTITY_COLORS: Record<DocumentEntityType, string> = {
    circuit: 'text-purple-600 bg-purple-50',
    bench: 'text-blue-600 bg-blue-50',
    partHeard: 'text-indigo-600 bg-indigo-50',
    serviceWeek: 'text-teal-600 bg-teal-50',
    otherPayment: 'text-rose-600 bg-rose-50',
    ticket: 'text-cyan-600 bg-cyan-50',
    medicalClaim: 'text-emerald-600 bg-emerald-50',
    generalRequest: 'text-amber-600 bg-amber-50',
    securityRequest: 'text-gray-600 bg-gray-50',
    visa: 'text-indigo-600 bg-indigo-50',
    protocol: 'text-blue-600 bg-blue-50',
    club: 'text-purple-600 bg-purple-50',
    utility_memo: 'text-amber-600 bg-amber-50',
};

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
    draft: 'Draft',
    pending_approval: 'Pending Approval',
    approved: 'Approved',
    rejected: 'Rejected',
    returned: 'Returned',
};

export const DOCUMENT_STATUS_COLORS: Record<DocumentStatus, string> = {
    draft: 'bg-stone-100 text-stone-600',
    pending_approval: 'bg-amber-50 text-amber-700',
    approved: 'bg-emerald-50 text-emerald-700',
    rejected: 'bg-red-50 text-red-700',
    returned: 'bg-blue-50 text-blue-700',
};

export const DOCUMENT_STATUS_BADGE_STYLES: Record<DocumentStatus, string> = {
    draft: 'badge-stone',
    pending_approval: 'badge-amber',
    approved: 'badge-emerald',
    rejected: 'badge-red',
    returned: 'badge-blue',
};

export const E_STAMP_STATUS_LABELS: Record<EStampStatus, string> = {
    pending: 'Pending',
    stamped: 'Stamped ✓',
    failed: 'Failed',
};

export const E_STAMP_STATUS_COLORS: Record<EStampStatus, string> = {
    pending: 'text-amber-600 bg-amber-50',
    stamped: 'text-emerald-600 bg-emerald-50',
    failed: 'text-red-600 bg-red-50',
};

// ─── Request Type Helpers ────────────────────────────────────────────────────

export const REQUEST_TYPE_LABELS: Record<string, string> = {
    Driver: 'Driver Request',
    Bodyguard: 'Bodyguard Request',
    Firearm: 'Firearm Request',
    'Current Station': 'Current Station Request',
    'Force Number': 'Force Number Request',
    'Residence Security': 'Residence Security Request',
    Sentry: 'Sentry Request',
};

export const REQUEST_TYPE_COLORS: Record<string, string> = {
    Driver: 'text-blue-600 bg-blue-50',
    Bodyguard: 'text-purple-600 bg-purple-50',
    Firearm: 'text-red-600 bg-red-50',
    'Current Station': 'text-green-600 bg-green-50',
    'Force Number': 'text-orange-600 bg-orange-50',
    'Residence Security': 'text-indigo-600 bg-indigo-50',
    Sentry: 'text-gray-600 bg-gray-50',
};

// ─── Type Guards ─────────────────────────────────────────────────────────────

export function isDocumentEntityType(value: string): value is DocumentEntityType {
    return [
        'circuit',
        'bench',
        'partHeard',
        'serviceWeek',
        'otherPayment',
        'ticket',
        'medicalClaim',
        'generalRequest',
        'securityRequest',
        'visa',
        'protocol',
        'club',
        'utility_memo'
    ].includes(value);
}

export function isDocumentStatus(value: string): value is DocumentStatus {
    return ['draft', 'pending_approval', 'approved', 'rejected', 'returned'].includes(value);
}

export function isRequestType(value: string): boolean {
    return [
        'Driver',
        'Bodyguard',
        'Firearm',
        'Current Station',
        'Force Number',
        'Residence Security',
        'Sentry'
    ].includes(value);
}

// ─── Helper Functions ────────────────────────────────────────────────────────

export function getEntityDisplayName(entityType: DocumentEntityType): string {
    return DOCUMENT_ENTITY_LABELS[entityType] || entityType;
}

export function getStatusDisplayName(status: DocumentStatus): string {
    return DOCUMENT_STATUS_LABELS[status] || status;
}

export function getStatusColor(status: DocumentStatus): string {
    return DOCUMENT_STATUS_COLORS[status] || '';
}

export function getStatusBadgeStyle(status: DocumentStatus): string {
    return DOCUMENT_STATUS_BADGE_STYLES[status] || '';
}

export function getEStampStatusLabel(status: EStampStatus): string {
    return E_STAMP_STATUS_LABELS[status] || status;
}

export function getEStampStatusColor(status: EStampStatus): string {
    return E_STAMP_STATUS_COLORS[status] || '';
}

export function getEntityIcon(entityType: DocumentEntityType): string {
    return DOCUMENT_ENTITY_ICONS[entityType] || 'File';
}

export function getEntityColor(entityType: DocumentEntityType): string {
    return DOCUMENT_ENTITY_COLORS[entityType] || 'text-gray-600 bg-gray-50';
}

export function getRequestTypeLabel(requestType: string): string {
    return REQUEST_TYPE_LABELS[requestType] || requestType;
}

export function getRequestTypeColor(requestType: string): string {
    return REQUEST_TYPE_COLORS[requestType] || 'text-gray-600 bg-gray-50';
}

// ─── Document Filter Helpers ────────────────────────────────────────────────

export function buildDocumentFilters(filters: HelpdeskDocumentFilters): Record<string, any> {
    const result: Record<string, any> = {};

    if (filters.entity_type) {
        result.entity_type = filters.entity_type;
    }
    if (filters.entity_id) {
        result.entity_id = filters.entity_id;
    }
    if (filters.format) {
        result.format = filters.format;
    }
    if (filters.status) {
        result.status = filters.status;
    }
    if (filters.search) {
        result.search = filters.search;
    }
    if (filters.uploaded_by) {
        result.uploaded_by = filters.uploaded_by;
    }
    if (filters.request_type) {
        result.request_type = filters.request_type;
    }
    if (filters.judge_name) {
        result.judge_name = filters.judge_name;
    }
    if (filters.date_from) {
        result.date_from = filters.date_from;
    }
    if (filters.date_to) {
        result.date_to = filters.date_to;
    }
    if (filters.unlinked !== undefined) {
        result.unlinked = filters.unlinked;
    }
    if (filters.pending_my_approval !== undefined) {
        result.pending_my_approval = filters.pending_my_approval;
    }
    // ─── NEW FILTERS ──────────────────────────────────────────────────────────
    if (filters.rank) {
        result.rank = filters.rank;
    }
    if (filters.reporting_date) {
        result.reporting_date = filters.reporting_date;
    }

    return result;
}

// ─── Document URL Helpers ────────────────────────────────────────────────────

export function getDocumentDownloadUrl(documentId: string): string {
    return `/api/helpdesk/documents/${documentId}/download`;
}

export function getDocumentViewUrl(documentId: string): string {
    return `/api/helpdesk/documents/${documentId}/view`;
}

export function getEStampDownloadUrl(documentId: string): string {
    return `/api/helpdesk/documents/${documentId}/estampt/download`;
}

// ─── Document Validation ────────────────────────────────────────────────────

export function validateDocumentStatusTransition(
    currentStatus: DocumentStatus,
    newStatus: DocumentStatus
): boolean {
    const validTransitions: Record<DocumentStatus, DocumentStatus[]> = {
        draft: ['pending_approval', 'returned', 'approved'],
        pending_approval: ['approved', 'rejected', 'returned', 'draft'],
        approved: ['returned'],
        rejected: ['draft', 'pending_approval'],
        returned: ['draft', 'pending_approval'],
    };

    return validTransitions[currentStatus]?.includes(newStatus) || false;
}

export function getAvailableStatusTransitions(currentStatus: DocumentStatus): DocumentStatus[] {
    const transitions: Record<DocumentStatus, DocumentStatus[]> = {
        draft: ['pending_approval'],
        pending_approval: ['approved', 'rejected', 'returned'],
        approved: ['returned'],
        rejected: ['draft'],
        returned: ['draft'],
    };

    return transitions[currentStatus] || [];
}