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

export type DocumentStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'returned';

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

/**
 * Internal approval status (only visible to super admin)
 * - 'pending': Awaiting super admin action
 * - 'previewed': Super admin has previewed the document
 * - 'approved_internal': Super admin approved internally (not yet sent to requester)
 * - 'rejected_internal': Super admin rejected internally (not yet sent to requester)
 * - 'changes_requested_internal': Super admin requested changes internally (not yet sent to requester)
 * - 'changes_ready': Requester has made changes, ready for re-review
 */
export type InternalApprovalStatus = 
    | 'pending'                    // Awaiting super admin review
    | 'previewed'                  // Super admin has previewed the document
    | 'approved_internal'          // Super admin approved (waiting to send back)
    | 'rejected_internal'          // Super admin rejected (waiting to send back)
    | 'changes_requested_internal' // Super admin wants changes (waiting to send back)
    | 'changes_ready';             // Changes have been made, ready for re-preview

/**
 * External/Requester visible status (what the requester sees)
 * Only changes when super admin clicks "Send Back to Requester"
 */
export type RequesterVisibleStatus = 
    | 'pending_approval'    // Requester sees: Waiting for approval
    | 'approved'            // Requester sees: Document approved ✓
    | 'rejected'            // Requester sees: Document rejected ✗
    | 'changes_requested'   // Requester sees: Changes requested
    | 'in_revision';        // Requester sees: Being revised

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
    requester_visible_at?: string; // When status became visible to requester
    requester_visible_by?: string; // Who sent it back to requester
    requester_visible_by_name?: string;
    
    // Resubmit tracking
    resubmit_count: number;
    last_resubmitted_at?: string;
    last_resubmitted_by?: string;
    
    // Flags
    is_internal_approval_complete: boolean; // Super admin has made a decision internally
    is_sent_back_to_requester: boolean; // Document has been sent back to requester
    is_requester_notified: boolean; // Requester has been notified

    // ─── Signature Fields ──────────────────────────────────────────────────────
    is_signed: boolean;                    // Whether the document has been signed
    signed_by?: string;                    // ID of the user who signed
    signed_by_name?: string;               // Name of the user who signed
    signed_at?: string;                    // When the document was signed
    signature_position_x?: number | null;  // X position of signature on PDF
    signature_position_y?: number | null;  // Y position of signature on PDF
    signature_position_width?: number | null;  // Width of signature on PDF
    signature_position_height?: number | null; // Height of signature on PDF

    // ─── NEW: Stamp Fields ──────────────────────────────────────────────────────
    is_stamped: boolean;                   // Whether the document has been officially stamped
    stamped_by?: string;                   // ID of the user who applied the stamp
    stamped_by_name?: string;              // Name of the user who applied the stamp
    stamped_at?: string;                   // When the stamp was applied
    stamp_type?: StampType;                // Type of stamp applied (approved, received, official)
    stamp_position_x?: number | null;      // X position of stamp on PDF
    stamp_position_y?: number | null;      // Y position of stamp on PDF
    stamp_position_width?: number | null;  // Width of stamp on PDF
    stamp_position_height?: number | null; // Height of stamp on PDF

    // ─── NEW: Final Generated PDF Fields ───────────────────────────────────────
    stamped_file_url?: string | null;      // The URL to the fully generated PDF containing both the signature and stamp
    stamped_file_public_id?: string | null;// Cloud public ID for the final generated PDF
    stamped_file_size?: number | null;     // Size of the final generated PDF

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
}

export interface ApprovalHistoryEntry {
    id: string;
    document_id: string;
    action: 'submitted' | 'approved' | 'rejected' | 'returned' | 'previewed' | 'sent_back' | 'resubmitted' | 'signed' | 'stamped';
    from_user_id: string;
    from_user_name: string;
    to_user_id?: string;
    to_user_name?: string;
    comments?: string;
    created_at: string;
    // For two-step workflow
    internal_action?: boolean; // Whether this was an internal action (super admin only)
    requester_visible?: boolean; // Whether this action is visible to requester
}

export interface Comment {
    id: string;
    document_id: string;
    user_id: string;
    user_name: string;
    comment: string;
    is_internal: boolean; // Internal comments (super admin only)
    is_active: boolean;
    created_at: string;
}

export interface CreateHelpdeskDocumentInput {
    ref: string;
    subject: string;
    entity_type: DocumentEntityType;
    entity_id?: string | null;
    format: DocumentFormat;
    status?: DocumentStatus;
    request_type?: string | null;
    judge_name?: string | null;
    
    // ─── NEW: Stamp field for initial creation ────────────────────────────────
    stamp_type?: StampType | null; // Pre-select a specific stamp type if needed at creation

    // ─── Aide Request Fields ──────────────────────────────────────────────
    officer_rank?: string | null;
    officer_name?: string | null;
    employment_number?: string | null;
    current_station?: string | null;
    current_unit?: string | null;
    proposed_assignment?: string | null;
    aide_status?: string | null;
    
    // ─── Sentry Request Fields ──────────────────────────────────────────────
    residence_location?: string | null;
    sentry_status?: string | null;
    
    // ─── Conference Request Fields ──────────────────────────────────────────
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
    // ─── Signature fields ──────────────────────────────────────────────────────
    is_signed?: boolean;
    signed_by?: string;
    signed_by_name?: string;
    signed_at?: string;
    // ─── NEW: Stamp fields ────────────────────────────────────────────────────
    is_stamped?: boolean;
    stamped_by?: string;
    stamped_by_name?: string;
    stamped_at?: string;
    stamp_type?: StampType;
    stamp_position_x?: number;
    stamp_position_y?: number;
    stamp_position_width?: number;
    stamp_position_height?: number;
    // ─── NEW: Final generated PDF fields ──────────────────────────────────────
    stamped_file_url?: string;
    stamped_file_public_id?: string;
    stamped_file_size?: number;
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
    unlinked?: boolean;
    request_type?: string;
    judge_name?: string;
    date_from?: string;
    date_to?: string;
    
    // ─── Two-Step Approval Filters ──────────────────────────────────────────
    internal_approval_status?: InternalApprovalStatus;
    requester_status?: RequesterVisibleStatus;
    is_sent_back_to_requester?: boolean;
    pending_internal_approval?: boolean; // For super admin dashboard
    ready_to_send_back?: boolean; // Super admin has decided, ready to send back
    my_requester_documents?: boolean; // For requester dashboard
    
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

    // ─── NEW: Stamp Filters ──────────────────────────────────────────────────
    is_stamped?: boolean;
    stamp_type?: StampType;
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
    changes_requested?: string[]; // For 'request_changes' action
    rejection_reason?: string; // For 'reject' action
    approved_by: string;
    approved_by_name?: string;
    // Optional: generate e-stamp immediately on internal approval
    generate_e_stamp?: boolean;
    // ─── Signature position ─────────────────────────────────────────────────
    signature_position_x?: number;
    signature_position_y?: number;
    signature_position_width?: number;
    signature_position_height?: number;
    // ─── NEW: Stamp position ──────────────────────────────────────────────────
    stamp_position_x?: number;
    stamp_position_y?: number;
    stamp_position_width?: number;
    stamp_position_height?: number;
    stamp_type?: StampType; // Allow admin to choose/override the stamp type during approval
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
    notify_requester?: boolean; // Send email notification to requester
    // The status that requester will see (must match internal decision)
    final_status: 'approved' | 'rejected' | 'changes_requested';
    // Optional: additional message for requester
    requester_message?: string;
}

/**
 * Request to resubmit after changes (requester action)
 */
export interface ResubmitAfterChangesRequest {
    document_id: string;
    submitted_by: string;
    submitted_by_name?: string;
    comments?: string;
    file_update?: boolean; // Whether the file was updated
    // Optional: new file to upload
    file?: Express.Multer.File;
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

// ─── Preview History Types ───────────────────────────────────────────────────

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

// ─── Dashboard Summary Types ─────────────────────────────────────────────────

/**
 * Pending internal approvals summary (super admin dashboard)
 */
export interface PendingInternalApprovalsSummary {
    total_pending_internal: number;
    pending_review: number;           // Awaiting super admin review
    previewed: number;               // Super admin previewed but not decided
    approved_internal: number;       // Approved internally, waiting to send back
    rejected_internal: number;       // Rejected internally, waiting to send back
    changes_requested_internal: number; // Changes requested, waiting to send back
    ready_to_send_back: number;      // Super admin has decided, ready to send back to requester
    by_entity_type: Record<DocumentEntityType, number>;
    urgent_pending: number;
    oldest_pending_days: number;
    average_review_time_hours?: number;
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
    // ─── Signature info ──────────────────────────────────────────────────────
    is_signed: boolean;
    signed_by_name?: string;
    signed_at?: string;
    // ─── NEW: Stamp info ──────────────────────────────────────────────────────
    is_stamped: boolean;
    stamped_by_name?: string;
    stamped_at?: string;
    stamp_type?: StampType;
    // ─── NEW: Final file info ──────────────────────────────────────────────────
    stamped_file_url?: string | null; // Requester will download/view this if approved
}

// ─── Notification Types ──────────────────────────────────────────────────────

export interface SuperAdminNotification {
    type: 'new_document_submitted' | 'document_previewed' | 'document_internally_approved' | 'document_sent_back';
    document_id: string;
    document_ref: string;
    document_subject: string;
    submitted_by?: string;
    submitted_by_name?: string;
    action_by?: string;
    action_by_name?: string;
    internal_status: InternalApprovalStatus;
    requester_status?: RequesterVisibleStatus;
    action_url: string;
    dashboard_url: string;
    comments?: string;
    changes_requested?: string[];
    rejection_reason?: string;
    priority: 'low' | 'normal' | 'high' | 'urgent';
    timestamp: string;
}

export interface RequesterNotification {
    type: 'document_approved' | 'document_rejected' | 'document_changes_requested' | 'document_status_updated';
    document_id: string;
    document_ref: string;
    document_subject: string;
    status: RequesterVisibleStatus;
    comments?: string;
    changes_requested?: string[];
    rejection_reason?: string;
    action_by?: string;
    action_by_name?: string;
    action_url: string;
    dashboard_url: string;
    timestamp: string;
}

// ─── Configuration ──────────────────────────────────────────────────────────

export interface TwoStepApprovalConfig {
    enabled: boolean;
    require_preview_before_approval: boolean;
    allow_multiple_previews: boolean;
    max_preview_count?: number;
    auto_reminder_hours: number; // Hours before sending reminder to super admin
    send_back_confirmation_required: boolean; // Require confirmation before sending back
    notify_requester_on_send_back: boolean;
    allow_requester_resubmit: boolean;
    max_resubmit_count?: number;
    super_admin_emails: string[];
    from_email: string;
    from_name: string;
    daily_digest_enabled: boolean;
    daily_digest_time: string; // e.g., "09:00"
    urgent_threshold_hours: number; // Hours after which pending becomes urgent
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
    // ─── NEW: Stamp summary ────────────────────────────────────────────────────
    stamped_count: number;
    signed_and_stamped_count: number;
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
    // Two-step workflow stats
    pending_internal: number;
    ready_to_send_back: number;
    // ─── NEW: Stamp stats ──────────────────────────────────────────────────────
    stamped_count: number;
    signed_count: number;
    signed_and_stamped_count: number;
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
    return ['draft', 'pending_approval', 'approved', 'rejected', 'returned'].includes(value);
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

// ─── Stamp Helper Functions ──────────────────────────────────────────────────

export function getStampTypeLabel(stampType: StampType): string {
    return STAMP_TYPE_LABELS[stampType] || stampType;
}

export function getStampTypeColor(stampType: StampType): string {
    return STAMP_TYPE_COLORS[stampType] || '';
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
        pending_approval: ['approved', 'rejected', 'returned', 'draft'],
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

    // ─── NEW: Stamp filters ──────────────────────────────────────────────────
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

    -- ─── NEW: Stamp fields ──────────────────────────────────────────────────────
    is_stamped BOOLEAN DEFAULT FALSE,
    stamped_by UUID,
    stamped_by_name VARCHAR(255),
    stamped_at TIMESTAMP,
    stamp_type VARCHAR(50),
    stamp_position_x FLOAT,
    stamp_position_y FLOAT,
    stamp_position_width FLOAT,
    stamp_position_height FLOAT,

    -- ─── NEW: Final Generated PDF fields ───────────────────────────────────────
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