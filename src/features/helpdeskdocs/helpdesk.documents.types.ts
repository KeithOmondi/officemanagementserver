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
    | 'utility_memo'     // Single judge utility memo
    | 'consolidated_utility_memo'  // Consolidated memo covering all utilities
    | 'consolidated_fuel_memo'     // Consolidated memo covering fuel only
    | 'aide'             // Aide request documents
    | 'sentry'           // Sentry request documents
    | 'conference';      // Conference request documents

// ─── Document Status ──────────────────────────────────────────────────────────
// These are the main statuses that determine where a document appears

export type DocumentStatus = 
    | 'draft'                 // Document is being created/edited (requester only)
    | 'pending_approval'      // Document is in the super admin's queue (waiting for action)
    | 'ready_to_send'         // Super admin has approved/rejected, waiting to send back to requester
    | 'approved'              // Document is fully approved and sent back to requester
    | 'rejected'              // Document is fully rejected and sent back to requester
    | 'returned';             // Document was returned for changes and sent back to requester

export type EStampStatus = 'pending' | 'stamped' | 'failed';

// ─── Conference Types ─────────────────────────────────────────────────────────

export type ConferenceStatus = 
    | 'draft' 
    | 'pending' 
    | 'approved' 
    | 'rejected' 
    | 'completed' 
    | 'cancelled';

export type ConferenceType = 
    | 'judicial' 
    | 'administrative' 
    | 'training' 
    | 'workshop' 
    | 'seminar' 
    | 'other';

// ─── Stamp Types ──────────────────────────────────────────────────────────────

export type StampType = 'approved' | 'received' | 'official';

// ─── Two-Step Approval Status Types ──────────────────────────────────────────

/**
 * Internal approval status - ONLY visible to super admin
 * This tracks the super admin's decision before the requester is notified
 * 
 * Workflow:
 * 1. Requester submits → internal_approval_status = 'pending'
 * 2. Super admin previews → internal_approval_status = 'previewed'
 * 3. Super admin makes decision → 'approved_internal' | 'rejected_internal' | 'changes_requested_internal'
 * 4. Requester resubmits after changes → internal_approval_status = 'changes_ready'
 * 5. Super admin cancels decision → internal_approval_status = 'pending'
 */
export type InternalApprovalStatus = 
    | 'pending'                    // Awaiting super admin review
    | 'previewed'                  // Super admin has previewed the document
    | 'approved_internal'          // Super admin approved (ready to send back to requester)
    | 'rejected_internal'          // Super admin rejected (ready to send back to requester)
    | 'changes_requested_internal' // Super admin wants changes (ready to send back to requester)
    | 'changes_ready';             // Requester has made changes, ready for re-review

/**
 * Requester visible status - what the requester sees
 * Only changes when super admin clicks "Send Back to Requester"
 * 
 * The requester's status is independent of the internal status until
 * the super admin explicitly sends it back.
 */
export type RequesterVisibleStatus = 
    | 'pending_approval'    // Requester sees: Waiting for approval
    | 'approved'            // Requester sees: Document approved ✓
    | 'rejected'            // Requester sees: Document rejected ✗
    | 'changes_requested'   // Requester sees: Changes requested
    | 'in_revision';        // Requester sees: Being revised

// ─── Utility Sync Status ─────────────────────────────────────────────────────

/**
 * Tracks the sync status between a document and its associated utility items
 */
export type UtilitySyncStatus = 
    | 'pending'          // Document is still pending, utility items are not synced
    | 'synced'           // Utility items have been synced with document status
    | 'failed'           // Sync attempt failed
    | 'not_applicable';  // Not a utility document

/**
 * Represents a utility item that has been synced with a document
 */
export interface SyncedUtilityItem {
    id: string;
    utility_type: string;
    amount: number;
    period: string;
    judge_name: string;
    pj_number: string | null;
    previous_status: string;
    new_status: string;
    synced_at: string;
}

// ─── Main Document Interface ──────────────────────────────────────────────────

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

    // ─── Two-Step Approval Workflow Fields ────────────────────────────────────
    // Internal tracking (super admin only)
    internal_approval_status: InternalApprovalStatus;
    internal_approved_by?: string;
    internal_approved_by_name?: string;
    internal_approved_at?: string;
    internal_comments?: string;
    internal_changes_requested?: string[];
    internal_rejection_reason?: string;
    internal_preview_count: number;
    internal_previewed_at?: string;
    internal_previewed_by?: string;
    internal_previewed_by_name?: string;
    
    // External/Requester visible status
    requester_status: RequesterVisibleStatus;
    requester_visible_at?: string;
    requester_visible_by?: string;
    requester_visible_by_name?: string;
    
    // Resubmit tracking
    resubmit_count: number;
    last_resubmitted_at?: string;
    last_resubmitted_by?: string;
    
    // ─── Flags that determine document state ──────────────────────────────────
    /**
     * Whether the super admin has made an internal decision
     * True when internal_approval_status is 'approved_internal', 'rejected_internal', or 'changes_requested_internal'
     */
    is_internal_approval_complete: boolean;
    
    /**
     * Whether the document has been sent back to the requester
     * True only after super admin clicks "Send Back to Requester"
     * When true, the document is removed from the super admin's queue
     */
    is_sent_back_to_requester: boolean;
    
    is_requester_notified: boolean;

    // ─── Utility Sync Fields ──────────────────────────────────────────────────
    utility_sync_status: UtilitySyncStatus;
    utility_synced_at?: string;
    utility_synced_by?: string;
    utility_sync_result?: {
        total_items: number;
        updated_items: SyncedUtilityItem[];
        failed_items: Array<{ id: string; reason: string }>;
    };

    // ─── Signature Fields ──────────────────────────────────────────────────────
    is_signed: boolean;
    signed_by?: string;
    signed_by_name?: string;
    signed_at?: string;
    signature_position_x?: number | null;
    signature_position_y?: number | null;
    signature_position_width?: number | null;
    signature_position_height?: number | null;

    // ─── Stamp Fields ──────────────────────────────────────────────────────
    is_stamped: boolean;
    stamped_by?: string;
    stamped_by_name?: string;
    stamped_at?: string;
    stamp_type?: StampType;
    stamp_position_x?: number | null;
    stamp_position_y?: number | null;
    stamp_position_width?: number | null;
    stamp_position_height?: number | null;

    // ─── Final Generated PDF Fields ───────────────────────────────────────────
    stamped_file_url?: string | null;
    stamped_file_public_id?: string | null;
    stamped_file_size?: number | null;

    // ─── Aide Request Fields ──────────────────────────────────────────────────
    officer_rank?: string | null;
    officer_name?: string | null;
    employment_number?: string | null;
    current_station?: string | null;
    current_unit?: string | null;
    proposed_assignment?: string | null;
    aide_status?: string | null;
    
    // ─── Sentry Request Fields ────────────────────────────────────────────────
    residence_location?: string | null;
    sentry_status?: string | null;
    
    // ─── Conference Request Fields ────────────────────────────────────────────
    conference_type?: ConferenceType | null;
    start_date?: string | null;
    end_date?: string | null;
    number_of_pax?: number | null;
    venue?: string | null;
    location?: string | null;
    budget_estimate?: number | null;
    conference_status?: ConferenceStatus | null;
    
    // ─── Legacy fields ──────────────────────────────────────────────────────
    rank?: string | null;
    reporting_date?: string | null;

    // ─── Memo Reference ────────────────────────────────────────────────────────
    memo_reference?: {
        memo_id: string;
        memo_type: 'all' | 'fuel';
        period: string;
        total_amount: number;
    };
}

// ─── Approval History ──────────────────────────────────────────────────────

export interface ApprovalHistoryEntry {
    id: string;
    document_id: string;
    action: 'submitted' | 'approved' | 'rejected' | 'returned' | 'previewed' | 'sent_back' | 'resubmitted' | 'signed' | 'stamped' | 'utility_synced';
    from_user_id: string;
    from_user_name: string;
    to_user_id?: string;
    to_user_name?: string;
    comments?: string;
    created_at: string;
    internal_action?: boolean;      // Whether this was an internal action (super admin only)
    requester_visible?: boolean;    // Whether this action is visible to requester
    utility_sync_metadata?: {
        total_items: number;
        updated_count: number;
        failed_count: number;
    };
}

// ─── Comments ──────────────────────────────────────────────────────────────

export interface Comment {
    id: string;
    document_id: string;
    user_id: string;
    user_name: string;
    comment: string;
    is_internal: boolean;
    is_active: boolean;
    created_at: string;
}

// ─── Input Types ────────────────────────────────────────────────────────────

export interface CreateHelpdeskDocumentInput {
    ref: string;
    subject: string;
    entity_type: DocumentEntityType;
    entity_id?: string | null;
    format: DocumentFormat;
    status?: DocumentStatus;
    request_type?: string | null;
    judge_name?: string | null;
    stamp_type?: StampType | null;
    memo_reference?: {
        memo_id: string;
        memo_type: 'all' | 'fuel';
        period: string;
        total_amount: number;
    };

    // Aide Request Fields
    officer_rank?: string | null;
    officer_name?: string | null;
    employment_number?: string | null;
    current_station?: string | null;
    current_unit?: string | null;
    proposed_assignment?: string | null;
    aide_status?: string | null;
    
    // Sentry Request Fields
    residence_location?: string | null;
    sentry_status?: string | null;
    
    // Conference Request Fields
    conference_type?: ConferenceType | null;
    start_date?: string | null;
    end_date?: string | null;
    number_of_pax?: number | null;
    venue?: string | null;
    location?: string | null;
    budget_estimate?: number | null;
    conference_status?: ConferenceStatus | null;
    
    // Legacy fields
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
    sync_utilities?: boolean;
}

export interface UpdateDocumentFileInput {
    status?: DocumentStatus;
    e_stamp_url?: string;
    e_stamp_public_id?: string;
    e_stamp_status?: EStampStatus;
    approved_by?: string;
    approved_by_name?: string;
    comments?: string;
    rejection_reason?: string;
    returned_by?: string;
    returned_by_name?: string;
    
    // Utility sync fields
    sync_utilities?: boolean;
    utility_sync_status?: UtilitySyncStatus;
    
    // Signature fields
    is_signed?: boolean;
    signed_by?: string;
    signed_by_name?: string;
    signed_at?: string;
    
    // Stamp fields
    is_stamped?: boolean;
    stamped_by?: string;
    stamped_by_name?: string;
    stamped_at?: string;
    stamp_type?: StampType;
    stamp_position_x?: number;
    stamp_position_y?: number;
    stamp_position_width?: number;
    stamp_position_height?: number;
    
    // Final generated PDF fields
    stamped_file_url?: string;
    stamped_file_public_id?: string;
    stamped_file_size?: number;
}

// ─── Two-Step Approval Request Types ─────────────────────────────────────────

/**
 * Request to perform internal approval (super admin action)
 * This doesn't change what requester sees yet
 */
export interface InternalApprovalRequest {
    document_id: string;
    action: 'approve' | 'reject' | 'request_changes';
    comments?: string;
    changes_requested?: string[];
    rejection_reason?: string;
    approved_by: string;
    approved_by_name?: string;
    generate_e_stamp?: boolean;
    signature_position_x?: number;
    signature_position_y?: number;
    signature_position_width?: number;
    signature_position_height?: number;
    stamp_position_x?: number;
    stamp_position_y?: number;
    stamp_position_width?: number;
    stamp_position_height?: number;
    stamp_type?: StampType;
    sync_utilities?: boolean;
}

/**
 * Request to preview document (super admin action)
 */
export interface InternalPreviewRequest {
    document_id: string;
    previewed_by: string;
    previewed_by_name?: string;
    comments?: string;
    ip_address?: string;
    user_agent?: string;
}

/**
 * Request to send document back to requester (super admin action)
 * This is when the requester finally sees the status change
 */
export interface SendBackToRequesterRequest {
    document_id: string;
    sent_by: string;
    sent_by_name?: string;
    comments?: string;
    notify_requester?: boolean;
    final_status: 'approved' | 'rejected' | 'changes_requested';
    requester_message?: string;
    sync_utilities?: boolean;
}

/**
 * Request to resubmit after changes (requester action)
 */
export interface ResubmitAfterChangesRequest {
    document_id: string;
    submitted_by: string;
    submitted_by_name?: string;
    comments?: string;
    file_update?: boolean;
    file?: Express.Multer.File;
    reset_utility_sync?: boolean;
}

/**
 * Request to cancel internal approval (super admin action)
 * Resets the document back to pending for re-review
 */
export interface CancelInternalApprovalRequest {
    document_id: string;
    cancelled_by: string;
    cancelled_by_name?: string;
    reason?: string;
}

// ─── Filters ──────────────────────────────────────────────────────────────────

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
    unlinked?: boolean;
    request_type?: string;
    judge_name?: string;
    date_from?: string;
    date_to?: string;
    
    // ─── Two-Step Approval Filters ──────────────────────────────────────────
    internal_approval_status?: InternalApprovalStatus;
    requester_status?: RequesterVisibleStatus;
    is_sent_back_to_requester?: boolean;
    
    /**
     * For super admin dashboard - returns documents needing review:
     * - internal_approval_status IN ('pending', 'previewed')
     */
    pending_internal_approval?: boolean;
    
    /**
     * For super admin dashboard - returns documents ready to send back:
     * - is_internal_approval_complete = true
     * - is_sent_back_to_requester = false
     * - status = 'pending_approval'
     */
    ready_to_send_back?: boolean;
    
    /**
     * For requester dashboard - returns documents visible to requester:
     * - is_sent_back_to_requester = true
     * - OR uploaded_by = current_user
     */
    my_requester_documents?: boolean;
    
    // ─── Utility Sync Filters ────────────────────────────────────────────
    utility_sync_status?: UtilitySyncStatus;
    needs_utility_sync?: boolean;
    
    // ─── Aide Request Filters ──────────────────────────────────────────────
    officer_rank?: string;
    officer_name?: string;
    employment_number?: string;
    current_station?: string;
    current_unit?: string;
    aide_status?: string;
    
    // ─── Sentry Request Filters ──────────────────────────────────────────────
    residence_location?: string;
    sentry_status?: string;
    
    // ─── Conference Request Filters ──────────────────────────────────────────
    conference_type?: ConferenceType;
    conference_status?: ConferenceStatus;
    start_date_from?: string;
    start_date_to?: string;
    location?: string;
    venue?: string;
    
    // ─── Legacy fields ──────────────────────────────────────────────────────
    rank?: string;
    reporting_date?: string;

    // ─── Stamp Filters ──────────────────────────────────────────────────
    is_stamped?: boolean;
    stamp_type?: StampType;
}

// ─── Preview History ──────────────────────────────────────────────────────

export interface DocumentPreviewHistory {
    id: string;
    document_id: string;
    previewed_by: string;
    previewed_by_name?: string;
    previewed_at: string;
    comments?: string;
    ip_address?: string;
    user_agent?: string;
    preview_duration_seconds?: number;
    is_active: boolean;
    created_at: string;
}

// ─── Dashboard Summary Types ──────────────────────────────────────────────────

/**
 * Pending internal approvals summary (super admin dashboard)
 * This helps the super admin quickly see what needs attention
 */
export interface PendingInternalApprovalsSummary {
    // ─── Total ───────────────────────────────────────────────────────────────
    total_pending_internal: number;
    
    // ─── Documents that need super admin action ──────────────────────────
    pending_review: number;           // Awaiting super admin review (internal_approval_status: 'pending')
    previewed: number;               // Super admin previewed but not decided (internal_approval_status: 'previewed')
    changes_ready: number;           // Requester made changes, ready for re-review (internal_approval_status: 'changes_ready')
    
    // ─── Documents where super admin has decided but not sent back ──────
    approved_internal: number;       // Approved internally, waiting to send back (status: 'pending_approval', internal_approval_status: 'approved_internal')
    rejected_internal: number;       // Rejected internally, waiting to send back (status: 'pending_approval', internal_approval_status: 'rejected_internal')
    changes_requested_internal: number; // Changes requested, waiting to send back (status: 'pending_approval', internal_approval_status: 'changes_requested_internal')
    
    // ─── Computed field ────────────────────────────────────────────────────
    ready_to_send_back: number;      // All documents where is_internal_approval_complete = true AND is_sent_back_to_requester = false
    
    // ─── Breakdown ──────────────────────────────────────────────────────────
    by_entity_type: Record<DocumentEntityType, number>;
    urgent_pending: number;          // Documents pending > 2 days
    oldest_pending_days: number;     // Age of oldest pending document
    average_review_time_hours?: number;
    pending_utility_sync: number;    // Documents waiting for utility sync
}

/**
 * Requester's view of their document status
 */
export interface RequesterDocumentView {
    document_id: string;
    ref: string;
    subject: string;
    status: RequesterVisibleStatus;
    submitted_at: string;
    last_updated_at: string;
    comments?: string;
    entity_type: DocumentEntityType;
    entity_id?: string;
    
    // Only show these if status is 'approved' or 'rejected'
    approved_rejected_at?: string;
    approved_rejected_by?: string;
    approved_rejected_by_name?: string;
    
    // Only show if status is 'changes_requested'
    changes_requested?: string[];
    
    // Only show if status is 'rejected'
    rejection_reason?: string;
    
    // Show if resubmit is allowed
    can_resubmit: boolean;
    
    // Signature info
    is_signed: boolean;
    signed_by_name?: string;
    signed_at?: string;
    
    // Stamp info
    is_stamped: boolean;
    stamped_by_name?: string;
    stamped_at?: string;
    stamp_type?: StampType;
    
    // Final file info
    stamped_file_url?: string | null;
    
    // Utility sync status
    utility_sync_status: UtilitySyncStatus;
}

// ─── Document Stats ──────────────────────────────────────────────────────

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
    // Two-step workflow stats
    pending_internal: number;
    ready_to_send_back: number;
    // Stamp stats
    stamped_count: number;
    signed_count: number;
    signed_and_stamped_count: number;
    // Utility sync stats
    utility_sync_stats: {
        total_utility_documents: number;
        synced: number;
        pending: number;
        failed: number;
    };
}

// ─── Find the DocumentSummary interface and update it ──────────────────────

export interface DocumentSummary {
    total: number;
    by_status: Record<DocumentStatus, number>;
    by_entity_type: Record<DocumentEntityType, number>;
    by_format: Record<DocumentFormat, number>;
    pending_approval: number;
    draft: number;
    ready_to_send: number;    // ← ADD THIS - missing property
    approved: number;
    rejected: number;
    returned: number;
    // Two-step workflow summary
    internal_approval_summary: {
        pending: number;
        previewed: number;
        approved_internal: number;
        rejected_internal: number;
        changes_requested_internal: number;
        changes_ready: number;
    };
    requester_status_summary: Record<RequesterVisibleStatus, number>;
    signed_count: number;
    // Stamp summary
    stamped_count: number;
    signed_and_stamped_count: number;
    // Utility sync summary
    utility_sync_summary: {
        synced: number;
        pending: number;
        failed: number;
        not_applicable: number;
    };
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
    utility_memo: 'Utility Memo (Single Judge)',
    consolidated_utility_memo: 'Consolidated Utility Memo',
    consolidated_fuel_memo: 'Consolidated Fuel Memo',
    aide: 'Aide Request',
    sentry: 'Sentry Request',
    conference: 'Conference Request',
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
    consolidated_utility_memo: 'FileSpreadsheet',
    consolidated_fuel_memo: 'Fuel',
    aide: 'Shield',
    sentry: 'Home',
    conference: 'Calendar',
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
    consolidated_utility_memo: 'text-indigo-600 bg-indigo-50',
    consolidated_fuel_memo: 'text-orange-600 bg-orange-50',
    aide: 'text-blue-600 bg-blue-50',
    sentry: 'text-emerald-600 bg-emerald-50',
    conference: 'text-purple-600 bg-purple-50',
};

// ─── Conference Status Constants ─────────────────────────────────────────────

export const CONFERENCE_STATUS_LABELS: Record<ConferenceStatus, string> = {
    draft: 'Draft',
    pending: 'Pending Approval',
    approved: 'Approved',
    rejected: 'Rejected',
    completed: 'Completed',
    cancelled: 'Cancelled',
};

export const CONFERENCE_STATUS_COLORS: Record<ConferenceStatus, string> = {
    draft: 'text-gray-600 bg-gray-50',
    pending: 'text-amber-600 bg-amber-50',
    approved: 'text-emerald-600 bg-emerald-50',
    rejected: 'text-red-600 bg-red-50',
    completed: 'text-blue-600 bg-blue-50',
    cancelled: 'text-stone-600 bg-stone-50',
};

export const CONFERENCE_TYPE_LABELS: Record<ConferenceType, string> = {
    judicial: 'Judicial',
    administrative: 'Administrative',
    training: 'Training',
    workshop: 'Workshop',
    seminar: 'Seminar',
    other: 'Other',
};

export const CONFERENCE_TYPE_COLORS: Record<ConferenceType, string> = {
    judicial: 'text-purple-600 bg-purple-50',
    administrative: 'text-blue-600 bg-blue-50',
    training: 'text-green-600 bg-green-50',
    workshop: 'text-amber-600 bg-amber-50',
    seminar: 'text-rose-600 bg-rose-50',
    other: 'text-stone-600 bg-stone-50',
};

// ─── Document Status Constants ───────────────────────────────────────────────

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
    draft: 'Draft',
    pending_approval: 'Pending Approval',
    ready_to_send: 'Ready to Send',
    approved: 'Approved',
    rejected: 'Rejected',
    returned: 'Returned',
};

export const DOCUMENT_STATUS_COLORS: Record<DocumentStatus, string> = {
    draft: 'bg-stone-100 text-stone-600',
    pending_approval: 'bg-amber-50 text-amber-700',
    ready_to_send: 'bg-blue-50 text-blue-700',
    approved: 'bg-emerald-50 text-emerald-700',
    rejected: 'bg-red-50 text-red-700',
    returned: 'bg-orange-50 text-orange-700',
};

export const DOCUMENT_STATUS_BADGE_STYLES: Record<DocumentStatus, string> = {
    draft: 'badge-stone',
    pending_approval: 'badge-amber',
    ready_to_send: 'badge-blue',
    approved: 'badge-emerald',
    rejected: 'badge-red',
    returned: 'badge-orange',
};

// ─── E-Stamp Constants ──────────────────────────────────────────────────────

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

// ─── Two-Step Approval Constants ────────────────────────────────────────────

export const INTERNAL_APPROVAL_STATUS_LABELS: Record<InternalApprovalStatus, string> = {
    pending: 'Pending Review',
    previewed: 'Previewed',
    approved_internal: 'Approved (Pending Send Back)',
    rejected_internal: 'Rejected (Pending Send Back)',
    changes_requested_internal: 'Changes Requested (Pending Send Back)',
    changes_ready: 'Changes Ready for Re-review',
};

export const INTERNAL_APPROVAL_STATUS_COLORS: Record<InternalApprovalStatus, string> = {
    pending: 'bg-amber-50 text-amber-700',
    previewed: 'bg-blue-50 text-blue-700',
    approved_internal: 'bg-emerald-50 text-emerald-700',
    rejected_internal: 'bg-red-50 text-red-700',
    changes_requested_internal: 'bg-orange-50 text-orange-700',
    changes_ready: 'bg-purple-50 text-purple-700',
};

export const INTERNAL_APPROVAL_STATUS_ICONS: Record<InternalApprovalStatus, string> = {
    pending: 'Clock',
    previewed: 'Eye',
    approved_internal: 'CheckCircle',
    rejected_internal: 'XCircle',
    changes_requested_internal: 'Pencil',
    changes_ready: 'RefreshCw',
};

export const REQUESTER_VISIBLE_STATUS_LABELS: Record<RequesterVisibleStatus, string> = {
    pending_approval: 'Pending Approval',
    approved: 'Approved ✓',
    rejected: 'Rejected ✗',
    changes_requested: 'Changes Requested',
    in_revision: 'In Revision',
};

export const REQUESTER_VISIBLE_STATUS_COLORS: Record<RequesterVisibleStatus, string> = {
    pending_approval: 'bg-amber-50 text-amber-700',
    approved: 'bg-emerald-50 text-emerald-700',
    rejected: 'bg-red-50 text-red-700',
    changes_requested: 'bg-orange-50 text-orange-700',
    in_revision: 'bg-blue-50 text-blue-700',
};

export const REQUESTER_VISIBLE_STATUS_ICONS: Record<RequesterVisibleStatus, string> = {
    pending_approval: 'Clock',
    approved: 'CircleCheckBig',
    rejected: 'CircleX',
    changes_requested: 'Pencil',
    in_revision: 'RefreshCw',
};

// ─── Stamp Constants ──────────────────────────────────────────────────────────

export const STAMP_TYPE_LABELS: Record<StampType, string> = {
    approved: 'Approved',
    received: 'Received',
    official: 'Official',
};

export const STAMP_TYPE_COLORS: Record<StampType, string> = {
    approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    received: 'bg-blue-50 text-blue-700 border-blue-200',
    official: 'bg-purple-50 text-purple-700 border-purple-200',
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
        'utility_memo',
        'consolidated_utility_memo',
        'consolidated_fuel_memo',
        'aide',
        'sentry',
        'conference'
    ].includes(value);
}

export function isDocumentStatus(value: string): value is DocumentStatus {
    return ['draft', 'pending_approval', 'ready_to_send', 'approved', 'rejected', 'returned'].includes(value);
}

export function isInternalApprovalStatus(value: string): value is InternalApprovalStatus {
    return [
        'pending',
        'previewed',
        'approved_internal',
        'rejected_internal',
        'changes_requested_internal',
        'changes_ready'
    ].includes(value);
}

export function isRequesterVisibleStatus(value: string): value is RequesterVisibleStatus {
    return [
        'pending_approval',
        'approved',
        'rejected',
        'changes_requested',
        'in_revision'
    ].includes(value);
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

export function isStampType(value: string): value is StampType {
    return ['approved', 'received', 'official'].includes(value);
}

export function isUtilityDocument(entityType: DocumentEntityType): boolean {
    return ['consolidated_utility_memo', 'consolidated_fuel_memo', 'utility_memo'].includes(entityType);
}

export function isConsolidatedUtilityDocument(entityType: DocumentEntityType): boolean {
    return ['consolidated_utility_memo', 'consolidated_fuel_memo'].includes(entityType);
}

// ─── Conference Helper Functions ─────────────────────────────────────────────

export function getConferenceStatusLabel(status: ConferenceStatus): string {
    return CONFERENCE_STATUS_LABELS[status] || status;
}

export function getConferenceStatusColor(status: ConferenceStatus): string {
    return CONFERENCE_STATUS_COLORS[status] || '';
}

export function getConferenceTypeLabel(type: ConferenceType): string {
    return CONFERENCE_TYPE_LABELS[type] || type;
}

export function getConferenceTypeColor(type: ConferenceType): string {
    return CONFERENCE_TYPE_COLORS[type] || '';
}

export function isConferenceStatus(value: string): value is ConferenceStatus {
    return ['draft', 'pending', 'approved', 'rejected', 'completed', 'cancelled'].includes(value);
}

export function isConferenceType(value: string): value is ConferenceType {
    return ['judicial', 'administrative', 'training', 'workshop', 'seminar', 'other'].includes(value);
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

// ─── Two-Step Approval Helper Functions ────────────────────────────────────

export function getInternalApprovalStatusDisplayName(status: InternalApprovalStatus): string {
    return INTERNAL_APPROVAL_STATUS_LABELS[status] || status;
}

export function getInternalApprovalStatusColor(status: InternalApprovalStatus): string {
    return INTERNAL_APPROVAL_STATUS_COLORS[status] || '';
}

export function getInternalApprovalStatusIcon(status: InternalApprovalStatus): string {
    return INTERNAL_APPROVAL_STATUS_ICONS[status] || 'File';
}

export function getRequesterVisibleStatusDisplayName(status: RequesterVisibleStatus): string {
    return REQUESTER_VISIBLE_STATUS_LABELS[status] || status;
}

export function getRequesterVisibleStatusColor(status: RequesterVisibleStatus): string {
    return REQUESTER_VISIBLE_STATUS_COLORS[status] || '';
}

export function getRequesterVisibleStatusIcon(status: RequesterVisibleStatus): string {
    return REQUESTER_VISIBLE_STATUS_ICONS[status] || 'File';
}

// ─── State Check Helpers ──────────────────────────────────────────────────────

/**
 * Check if a document is in the "pending review" state (needs super admin action)
 * These documents appear as "PENDING" in the super admin list
 */
export function isPendingReview(doc: HelpdeskDocument): boolean {
    return doc.internal_approval_status === 'pending' 
        || doc.internal_approval_status === 'previewed'
        || doc.internal_approval_status === 'changes_ready';
}

/**
 * Check if a document is in the "ready to send back" state
 * These documents appear as "READY" in the super admin list
 */
export function isReadyToSendBack(doc: HelpdeskDocument): boolean {
    return doc.is_internal_approval_complete 
        && !doc.is_sent_back_to_requester
        && doc.status === 'pending_approval';
}

/**
 * Check if a document is in the super admin's active queue
 * Documents in the queue are NOT sent back to requester yet
 */
export function isInSuperAdminQueue(doc: HelpdeskDocument): boolean {
    return doc.status === 'pending_approval' 
        && !doc.is_sent_back_to_requester;
}

/**
 * Get the display status for a document in the super admin list
 * Returns "PENDING" if needs review, "READY" if approved and ready to send back
 */
export function getSuperAdminDisplayStatus(doc: HelpdeskDocument): 'PENDING' | 'READY' {
    if (isReadyToSendBack(doc)) {
        return 'READY';
    }
    return 'PENDING';
}

/**
 * Check if the super admin can approve this document
 */
export function canSuperAdminApprove(doc: HelpdeskDocument): boolean {
    return doc.status === 'pending_approval' 
        && !doc.is_sent_back_to_requester
        && !doc.is_internal_approval_complete
        && (doc.internal_approval_status === 'pending' 
            || doc.internal_approval_status === 'previewed'
            || doc.internal_approval_status === 'changes_ready');
}

/**
 * Check if the super admin can send this document back to requester
 */
export function canSuperAdminSendBack(doc: HelpdeskDocument): boolean {
    return doc.is_internal_approval_complete 
        && !doc.is_sent_back_to_requester
        && doc.status === 'pending_approval';
}

export function isInternalApprovalPending(status: InternalApprovalStatus): boolean {
    return ['pending', 'previewed'].includes(status);
}

export function isInternalApprovalComplete(status: InternalApprovalStatus): boolean {
    return ['approved_internal', 'rejected_internal', 'changes_requested_internal'].includes(status);
}

export function canSendBackToRequester(status: InternalApprovalStatus): boolean {
    return ['approved_internal', 'rejected_internal', 'changes_requested_internal'].includes(status);
}

export function canResubmitAfterChanges(status: RequesterVisibleStatus): boolean {
    return ['changes_requested', 'rejected'].includes(status);
}

export function isDocumentVisibleToRequester(requesterStatus: RequesterVisibleStatus): boolean {
    return ['approved', 'rejected', 'changes_requested', 'in_revision'].includes(requesterStatus);
}

export function isPreviewRequired(internalStatus: InternalApprovalStatus): boolean {
    return ['pending', 'changes_ready'].includes(internalStatus);
}

// ─── Stamp Helper Functions ──────────────────────────────────────────────────

export function getStampTypeLabel(stampType: StampType): string {
    return STAMP_TYPE_LABELS[stampType] || stampType;
}

export function getStampTypeColor(stampType: StampType): string {
    return STAMP_TYPE_COLORS[stampType] || '';
}

// ─── Utility Sync Helper Functions ───────────────────────────────────────────

export function getUtilitySyncStatusLabel(status: UtilitySyncStatus): string {
    const labels: Record<UtilitySyncStatus, string> = {
        pending: 'Pending Sync',
        synced: 'Synced ✓',
        failed: 'Sync Failed',
        not_applicable: 'N/A',
    };
    return labels[status] || status;
}

// ─── Status Transition Functions ────────────────────────────────────────────

/**
 * Gets the next internal approval status based on super admin action
 */
export function getNextInternalStatus(
    currentStatus: InternalApprovalStatus,
    action: 'preview' | 'approve' | 'reject' | 'request_changes' | 'resubmit_changes' | 'cancel'
): InternalApprovalStatus {
    const transitions: Record<InternalApprovalStatus, Record<string, InternalApprovalStatus>> = {
        pending: {
            preview: 'previewed',
            approve: 'approved_internal',
            reject: 'rejected_internal',
            request_changes: 'changes_requested_internal',
            resubmit_changes: 'pending',
            cancel: 'pending',
        },
        previewed: {
            preview: 'previewed',
            approve: 'approved_internal',
            reject: 'rejected_internal',
            request_changes: 'changes_requested_internal',
            resubmit_changes: 'pending',
            cancel: 'pending',
        },
        approved_internal: {
            preview: 'approved_internal',
            approve: 'approved_internal',
            reject: 'rejected_internal',
            request_changes: 'changes_requested_internal',
            resubmit_changes: 'approved_internal',
            cancel: 'pending',
        },
        rejected_internal: {
            preview: 'rejected_internal',
            approve: 'approved_internal',
            reject: 'rejected_internal',
            request_changes: 'changes_requested_internal',
            resubmit_changes: 'pending',
            cancel: 'pending',
        },
        changes_requested_internal: {
            preview: 'changes_requested_internal',
            approve: 'approved_internal',
            reject: 'rejected_internal',
            request_changes: 'changes_requested_internal',
            resubmit_changes: 'changes_ready',
            cancel: 'pending',
        },
        changes_ready: {
            preview: 'previewed',
            approve: 'approved_internal',
            reject: 'rejected_internal',
            request_changes: 'changes_requested_internal',
            resubmit_changes: 'changes_ready',
            cancel: 'pending',
        },
    };

    return transitions[currentStatus]?.[action] || currentStatus;
}

/**
 * Gets the requester visible status based on internal approval status and send-back action
 */
export function getRequesterVisibleStatus(
    internalStatus: InternalApprovalStatus,
    sendBackAction: 'approved' | 'rejected' | 'changes_requested'
): RequesterVisibleStatus {
    const mapping: Record<InternalApprovalStatus, Record<string, RequesterVisibleStatus>> = {
        approved_internal: {
            approved: 'approved',
            rejected: 'rejected',
            changes_requested: 'changes_requested',
        },
        rejected_internal: {
            approved: 'approved',
            rejected: 'rejected',
            changes_requested: 'changes_requested',
        },
        changes_requested_internal: {
            approved: 'approved',
            rejected: 'rejected',
            changes_requested: 'changes_requested',
        },
        changes_ready: {
            approved: 'approved',
            rejected: 'rejected',
            changes_requested: 'changes_requested',
        },
        pending: {
            approved: 'pending_approval',
            rejected: 'pending_approval',
            changes_requested: 'pending_approval',
        },
        previewed: {
            approved: 'pending_approval',
            rejected: 'pending_approval',
            changes_requested: 'pending_approval',
        },
    };

    return mapping[internalStatus]?.[sendBackAction] || 'pending_approval';
}

/**
 * Validates document status transition with two-step workflow
 */
export function validateDocumentStatusWithTwoStepWorkflow(
    currentStatus: DocumentStatus,
    currentInternalStatus: InternalApprovalStatus,
    currentRequesterStatus: RequesterVisibleStatus,
    newStatus: DocumentStatus,
    newInternalStatus?: InternalApprovalStatus,
    newRequesterStatus?: RequesterVisibleStatus
): boolean {
    // Basic document status transition validation
    const validTransitions: Record<DocumentStatus, DocumentStatus[]> = {
        draft: ['pending_approval', 'returned'],
        pending_approval: ['ready_to_send', 'approved', 'rejected', 'returned', 'draft'],
        ready_to_send: ['approved', 'rejected', 'returned'],
        approved: ['returned'],
        rejected: ['draft', 'pending_approval'],
        returned: ['draft', 'pending_approval'],
    };

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
        return false;
    }

    // If no internal status change, it's valid
    if (!newInternalStatus) {
        return true;
    }

    // Validate internal status transitions
    const validInternalTransitions: Record<InternalApprovalStatus, InternalApprovalStatus[]> = {
        pending: ['previewed', 'approved_internal', 'rejected_internal', 'changes_requested_internal'],
        previewed: ['previewed', 'approved_internal', 'rejected_internal', 'changes_requested_internal'],
        approved_internal: ['approved_internal', 'rejected_internal', 'changes_requested_internal', 'pending'],
        rejected_internal: ['approved_internal', 'rejected_internal', 'changes_requested_internal', 'pending'],
        changes_requested_internal: ['approved_internal', 'rejected_internal', 'changes_requested_internal', 'changes_ready', 'pending'],
        changes_ready: ['previewed', 'approved_internal', 'rejected_internal', 'changes_requested_internal'],
    };

    if (!validInternalTransitions[currentInternalStatus]?.includes(newInternalStatus)) {
        return false;
    }

    // Validate requester status transitions
    if (newRequesterStatus) {
        const validRequesterTransitions: Record<RequesterVisibleStatus, RequesterVisibleStatus[]> = {
            pending_approval: ['approved', 'rejected', 'changes_requested'],
            approved: ['pending_approval'],
            rejected: ['in_revision', 'pending_approval'],
            changes_requested: ['in_revision', 'pending_approval'],
            in_revision: ['pending_approval'],
        };

        if (!validRequesterTransitions[currentRequesterStatus]?.includes(newRequesterStatus)) {
            return false;
        }
    }

    return true;
}

// ─── Consolidated Memo Helpers ──────────────────────────────────────────────

export type ConsolidatedMemoType = 'all' | 'fuel';

/**
 * Generates a stable, human-readable entity ID for a consolidated memo.
 * Format: "cons-{type}-{YYYY-MM}" e.g., "cons-all-2026-07"
 */
export function getConsolidatedMemoEntityId(
    type: ConsolidatedMemoType,
    date: Date = new Date()
): string {
    const month = date.toISOString().slice(0, 7);
    return `cons-${type}-${month}`;
}

/**
 * Returns the appropriate DocumentEntityType for a consolidated memo.
 */
export function getConsolidatedMemoEntityType(
    type: ConsolidatedMemoType
): DocumentEntityType {
    return type === 'fuel' ? 'consolidated_fuel_memo' : 'consolidated_utility_memo';
}

// ─── Document Filter Helpers ────────────────────────────────────────────────

export function buildDocumentFilters(filters: HelpdeskDocumentFilters): Record<string, any> {
    const result: Record<string, any> = {};

    if (filters.entity_type) result.entity_type = filters.entity_type;
    if (filters.entity_id) result.entity_id = filters.entity_id;
    if (filters.format) result.format = filters.format;
    if (filters.status) result.status = filters.status;
    if (filters.search) result.search = filters.search;
    if (filters.uploaded_by) result.uploaded_by = filters.uploaded_by;
    if (filters.request_type) result.request_type = filters.request_type;
    if (filters.judge_name) result.judge_name = filters.judge_name;
    if (filters.date_from) result.date_from = filters.date_from;
    if (filters.date_to) result.date_to = filters.date_to;
    if (filters.unlinked !== undefined) result.unlinked = filters.unlinked;
    if (filters.pending_my_approval !== undefined) result.pending_my_approval = filters.pending_my_approval;
    
    // Two-step approval filters
    if (filters.internal_approval_status) result.internal_approval_status = filters.internal_approval_status;
    if (filters.requester_status) result.requester_status = filters.requester_status;
    if (filters.is_sent_back_to_requester !== undefined) result.is_sent_back_to_requester = filters.is_sent_back_to_requester;
    if (filters.pending_internal_approval !== undefined) result.pending_internal_approval = filters.pending_internal_approval;
    if (filters.ready_to_send_back !== undefined) result.ready_to_send_back = filters.ready_to_send_back;
    if (filters.my_requester_documents !== undefined) result.my_requester_documents = filters.my_requester_documents;
    
    // Utility sync filters
    if (filters.utility_sync_status) result.utility_sync_status = filters.utility_sync_status;
    if (filters.needs_utility_sync !== undefined) {
        result.needs_utility_sync = filters.needs_utility_sync;
    }
    
    // Aide Request Filters
    if (filters.officer_rank) result.officer_rank = filters.officer_rank;
    if (filters.officer_name) result.officer_name = filters.officer_name;
    if (filters.employment_number) result.employment_number = filters.employment_number;
    if (filters.current_station) result.current_station = filters.current_station;
    if (filters.current_unit) result.current_unit = filters.current_unit;
    if (filters.aide_status) result.aide_status = filters.aide_status;
    
    // Sentry Request Filters
    if (filters.residence_location) result.residence_location = filters.residence_location;
    if (filters.sentry_status) result.sentry_status = filters.sentry_status;
    
    // Conference Request Filters
    if (filters.conference_type) result.conference_type = filters.conference_type;
    if (filters.conference_status) result.conference_status = filters.conference_status;
    if (filters.start_date_from) result.start_date_from = filters.start_date_from;
    if (filters.start_date_to) result.start_date_to = filters.start_date_to;
    if (filters.location) result.location = filters.location;
    if (filters.venue) result.venue = filters.venue;
    
    // Legacy fields
    if (filters.rank) result.rank = filters.rank;
    if (filters.reporting_date) result.reporting_date = filters.reporting_date;

    // Stamp filters
    if (filters.is_stamped !== undefined) result.is_stamped = filters.is_stamped;
    if (filters.stamp_type) result.stamp_type = filters.stamp_type;

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
        pending_approval: ['ready_to_send', 'approved', 'rejected', 'returned', 'draft'],  // ← ADD ready_to_send
        ready_to_send: ['approved', 'rejected', 'returned'],  // ← ADD THIS
        approved: ['returned'],
        rejected: ['draft', 'pending_approval'],
        returned: ['draft', 'pending_approval'],
    };

    return validTransitions[currentStatus]?.includes(newStatus) || false;
}

export function getAvailableStatusTransitions(currentStatus: DocumentStatus): DocumentStatus[] {
    const transitions: Record<DocumentStatus, DocumentStatus[]> = {
        draft: ['pending_approval'],
        pending_approval: ['ready_to_send', 'approved', 'rejected', 'returned'],  // ← ADD ready_to_send
        ready_to_send: ['approved', 'rejected', 'returned'],  // ← ADD THIS
        approved: ['returned'],
        rejected: ['draft'],
        returned: ['draft'],
    };

    return transitions[currentStatus] || [];
}

// ─── Database Migration Helpers ─────────────────────────────────────────────

export const TWO_STEP_APPROVAL_TABLE_COLUMNS = `
    -- Internal approval tracking (super admin only)
    internal_approval_status VARCHAR(50) DEFAULT 'pending',
    internal_approved_by UUID,
    internal_approved_by_name VARCHAR(255),
    internal_approved_at TIMESTAMP,
    internal_comments TEXT,
    internal_changes_requested TEXT[],
    internal_rejection_reason TEXT,
    internal_preview_count INTEGER DEFAULT 0,
    internal_previewed_at TIMESTAMP,
    internal_previewed_by UUID,
    internal_previewed_by_name VARCHAR(255),
    
    -- Requester visible status
    requester_status VARCHAR(50) DEFAULT 'pending_approval',
    requester_visible_at TIMESTAMP,
    requester_visible_by UUID,
    requester_visible_by_name VARCHAR(255),
    
    -- Resubmit tracking
    resubmit_count INTEGER DEFAULT 0,
    last_resubmitted_at TIMESTAMP,
    last_resubmitted_by UUID,
    
    -- Flags
    is_internal_approval_complete BOOLEAN DEFAULT FALSE,
    is_sent_back_to_requester BOOLEAN DEFAULT FALSE,
    is_requester_notified BOOLEAN DEFAULT FALSE,
    
    -- Signature fields
    is_signed BOOLEAN DEFAULT FALSE,
    signed_by UUID,
    signed_by_name VARCHAR(255),
    signed_at TIMESTAMP,
    signature_position_x FLOAT,
    signature_position_y FLOAT,
    signature_position_width FLOAT,
    signature_position_height FLOAT,

    -- Utility Sync fields
    utility_sync_status VARCHAR(50) DEFAULT 'not_applicable',
    utility_synced_at TIMESTAMP,
    utility_synced_by UUID,
    utility_sync_result JSONB,

    -- Stamp fields
    is_stamped BOOLEAN DEFAULT FALSE,
    stamped_by UUID,
    stamped_by_name VARCHAR(255),
    stamped_at TIMESTAMP,
    stamp_type VARCHAR(50),
    stamp_position_x FLOAT,
    stamp_position_y FLOAT,
    stamp_position_width FLOAT,
    stamp_position_height FLOAT,

    -- Final Generated PDF fields
    stamped_file_url VARCHAR(255),
    stamped_file_public_id VARCHAR(255),
    stamped_file_size INTEGER
`;

export const PREVIEW_HISTORY_TABLE_SCHEMA = `
    CREATE TABLE IF NOT EXISTS document_preview_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        document_id UUID NOT NULL REFERENCES helpdesk_documents(id),
        previewed_by UUID NOT NULL REFERENCES users(id),
        previewed_by_name VARCHAR(255),
        previewed_at TIMESTAMP DEFAULT NOW(),
        comments TEXT,
        ip_address VARCHAR(45),
        user_agent TEXT,
        preview_duration_seconds INTEGER,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW()
    );
`;