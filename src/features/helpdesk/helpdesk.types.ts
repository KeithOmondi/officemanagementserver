export type UtilityType = 'Electricity' | 'Water' | 'Internet' | 'Fuel' | 'Other';
export type RequestMode = 'Letter' | 'Email' | 'Verbal' | 'Other';
export type VisaType = 'Official' | 'Conference' | 'Personal' | 'Other';
export type Status = 'Pending' | 'Signed' | 'Rejected' | 'In Progress' | 'Completed' | 'Active' | 'Resolved' | 'Cancelled';
export type DSAPaymentStatus = 'Pending' | 'In Process' | 'Paid' | 'Payment NA';
export type ReportModule = 'circuit' | 'special_bench' | 'part_heard' | 'service_week' | 'other_payment';

// ─── Judge Utilities ──────────────────────────────────────────────────────────

export type UtilityStatus =
    | 'Awaiting'
    | 'Awaiting Documentation'
    | 'Awaiting Funding'
    | 'In Process'
    | 'Approved'
    | 'Paid'
    | 'Payment NA';

export interface UtilityItem {
    id: string;
    request_id: string;
    utility_type: UtilityType;
    requisition_number: string | null;
    amount: number;
    period: string;
    description: string | null;
    date_received: string | null;
    date_forwarded_dass: string | null;
    date_paid: string | null;
    status: UtilityStatus;
    supporting_document_url: string | null;
    created_at: string;
    updated_at: string;
}

export interface JudgeUtility {
    id: string;
    judge_name: string;
    items: UtilityItem[];
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

export type UtilityItemInput = {
    utility_type: UtilityType;
    requisition_number?: string;
    amount: number;
    period: string;
    description?: string;
    date_received?: string;
    date_forwarded_dass?: string;
    date_paid?: string;
    status?: UtilityStatus;
};

export interface CreateUtilityInput {
    judge_name: string;
    items: UtilityItemInput[];
}

export interface AddUtilityItemInput {
    utility_type: UtilityType;
    requisition_number?: string;
    amount: number;
    period: string;
    description?: string;
    date_received?: string;
    date_forwarded_dass?: string;
    date_paid?: string;
    status?: UtilityStatus;
}

export interface UpdateUtilityItemInput {
    status?: UtilityStatus;
    date_received?: string;
    date_forwarded_dass?: string;
    date_paid?: string;
    amount?: number;
    period?: string;
    description?: string;
    utility_type?: UtilityType;
    requisition_number?: string;
}

export interface UtilityFilters {
    search?: string;
    judge_name?: string;
    status?: UtilityStatus;
    limit?: number;
    offset?: number;
}

// ─── Club Membership ──────────────────────────────────────────────────────────

export interface ClubMembership {
    id: string;
    pj_no: string | null;
    judge_name: string;
    club_name: string;
    entry_fee: number | null;
    annual_fee: number | null;
    date_submitted_dass: string | null;
    court: string | null;
    payment_date: string | null;
    remarks: string | null;
    status: Status;
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

export interface CreateClubMembershipInput {
    pj_no?: string;
    judge_name: string;
    club_name: string;
    entry_fee?: number;
    annual_fee?: number;
    date_submitted_dass?: string;
    court?: string;
    payment_date?: string;
    remarks?: string;
}

// ─── DSA Details ─────────────────────────────────────────────────────────────

export interface DSADetail {
    id: string;
    judge_name: string;
    pj_number: string;
    dsa_per_day: number;
    days: number;
    total: number;
    notes: string | null;
    designation: string | null;
    date_of_request: string | null;
    date_of_ticket_facilitation: string | null;
    date_of_conference_facilitation: string | null;
    travel_date: string | null;
    travel_back: string | null;
    requisition_number: string | null;
    requisition_initiation_date: string | null;
    payment_status: DSAPaymentStatus;
}

export type DSADetailInput = {
    judge_name: string;
    pj_number: string;
    dsa_per_day: number;
    days: number;
    notes?: string;
    designation?: string;
    date_of_request?: string;
    date_of_ticket_facilitation?: string;
    date_of_conference_facilitation?: string;
    travel_date?: string;
    travel_back?: string;
    requisition_number?: string;
    requisition_initiation_date?: string;
    payment_status?: DSAPaymentStatus;
};

// ─── Circuits ────────────────────────────────────────────────────────────────

export interface Circuit {
    id: string;
    name: string;
    location: string | null;
    start_date: string;
    end_date: string;
    total_dsa: number;
    status: Status;
    dsa_details?: DSADetail[];
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

export interface CreateCircuitInput {
    name: string;
    location?: string;
    start_date: string;
    end_date: string;
    dsa_details?: DSADetailInput[];
}

// ─── Other Payments ──────────────────────────────────────────────────────────

export interface OtherPayment {
    id: string;
    name: string;
    description: string | null;
    start_date: string;
    end_date: string;
    total_dsa: number;
    status: Status;
    dsa_details?: DSADetail[];
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

export interface CreateOtherPaymentInput {
    name: string;
    description?: string;
    start_date: string;
    end_date: string;
    dsa_details?: DSADetailInput[];
}

// ─── Special Benches ─────────────────────────────────────────────────────────

export interface SpecialBench {
    id: string;
    name: string;
    case_reference: string | null;
    start_date: string;
    end_date: string;
    total_dsa: number;
    status: Status;
    dsa_details?: DSADetail[];
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

export interface CreateSpecialBenchInput {
    name: string;
    case_reference?: string;
    start_date: string;
    end_date: string;
    dsa_details?: DSADetailInput[];
}

export interface UpdateBenchInput {
    name?: string;
    case_reference?: string;
    start_date?: string;
    end_date?: string;
    status?: Status;
    dsa_details?: DSADetailInput[];
}

// ─── Part-Heards ─────────────────────────────────────────────────────────────

export interface PartHeard {
    id: string;
    case_reference: string;
    approved_by: string | null;
    start_date: string;
    end_date: string;
    total_dsa: number;
    status: Status;
    dsa_details?: DSADetail[];
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

export interface CreatePartHeardInput {
    case_reference: string;
    approved_by?: string;
    start_date: string;
    end_date: string;
    dsa_details?: DSADetailInput[];
}

export interface UpdatePartHeardInput {
    case_reference?: string;
    approved_by?: string;
    start_date?: string;
    end_date?: string;
    status?: Status;
    dsa_details?: DSADetailInput[];
}

// ─── Service Weeks ───────────────────────────────────────────────────────────

export interface ServiceWeek {
    id: string;
    name: string;
    week_number: string;
    year: string;
    start_date: string;
    end_date: string;
    total_dsa: number;
    status: Status;
    dsa_details?: DSADetail[];
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

export interface CreateServiceWeekInput {
    name: string;
    week_number: string;
    year: string;
    start_date: string;
    end_date: string;
    dsa_details?: DSADetailInput[];
}

// ─── Medical Expense Claims ──────────────────────────────────────────────────

export interface MedicalClaim {
    id: string;
    s_no: number | null;
    officer_name: string;
    claim_amount: number;
    date_forwarded_dhr: string | null;
    status: Status;
    remarks: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

// s_no removed from input - auto-generated
export interface CreateMedicalClaimInput {
    officer_name: string;
    claim_amount: number;
    date_forwarded_dhr?: string;
    status?: Status;
    remarks?: string;
}

// ─── General Requests ────────────────────────────────────────────────────────

export interface GeneralRequest {
    id: string;
    s_no: number | null;
    ticket_number: string | null;  // Added ticket number
    judge_name: string;
    request: string;
    date_received: string | null;
    officer_assigned: string | null;
    status: Status;
    remarks: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

// s_no removed from input - auto-generated
// send_email added for manual control
export interface CreateGeneralRequestInput {
    judge_name: string;
    request: string;
    date_received?: string;
    officer_assigned?: string;
    status?: Status;
    remarks?: string;
    email?: string;           // Recipient email for notification
    send_email?: boolean;     // Manual control: true = send email, false = don't send
}

// ─── Visa Support ────────────────────────────────────────────────────────────

export interface VisaRequest {
    id: string;
    s_no: number | null;
    judge_name: string;
    destination_country: string;
    date_of_travel: string | null;
    date_of_return: string | null;
    visa_type: VisaType;
    purpose_of_travel: string | null;
    remarks: string | null;
    status: Status;
    notes: string | null;
    documents?: VisaDocument[];
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

export interface VisaDocument {
    id: string;
    visa_request_id: string;
    document_name: string;
    document_url: string;
    viewed_at: string | null;  // When the document was first viewed
    view_count: number;        // Number of times viewed
    created_at: string;
}

// s_no removed from input - auto-generated
export interface CreateVisaRequestInput {
    judge_name: string;
    destination_country: string;
    date_of_travel?: string;
    request_date?: string;
    date_of_return?: string;
    visa_type: VisaType;
    purpose_of_travel?: string;
    remarks?: string;
    notes?: string;
}

// ─── Protocol Support ─────────────────────────────────────────────────────────

export interface ProtocolEvent {
    id: string;
    s_no: number | null;
    activity: string;
    period_from: string | null;
    period_to: string | null;
    officers_assigned: string | null;
    remarks: string | null;
    status: Status;
    notes: string | null;
    dsa_required: boolean;
    total_dsa: number;
    dsa_details?: DSADetail[];
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

// s_no removed from input - auto-generated
export interface CreateProtocolEventInput {
    activity: string;
    period_from?: string;
    period_to?: string;
    officers_assigned?: string;
    remarks?: string;
    notes?: string;
    dsa_required?: boolean;
    dsa_details?: DSADetailInput[];
}

// ─── Reports ──────────────────────────────────────────────────────────────────

export interface DSAReportRow {
    module: ReportModule;
    parent_id: string;
    dsa_detail_id: string;
    activity: string;
    parent_status: Status;
    judge_name: string;
    pj_number: string;
    designation: string | null;
    date_of_request: string | null;
    date_of_ticket_facilitation: string | null;
    date_of_conference_facilitation: string | null;
    travel_date: string | null;
    travel_back: string | null;
    dsa_per_day: number;
    days: number;
    total: number;
    requisition_number: string | null;
    requisition_initiation_date: string | null;
    payment_status: DSAPaymentStatus;
}

export interface DSAReportFilters {
    modules?: ReportModule[];
    judge_name?: string;
    payment_status?: DSAPaymentStatus;
    travel_start?: string;
    travel_end?: string;
    limit?: number;
    offset?: number;
}

// ─── Audit & Stats ──────────────────────────────────────────────────────────

export interface HelpDeskAuditEntry {
    id: string;
    actor: string | null;
    actor_name: string | null;
    action: string;
    detail: string | null;
    entity_type: string | null;
    entity_id: string | null;
    timestamp: string;
}

export interface HelpDeskStats {
    total_records: number;
    in_progress: number;
    visa_active: number;
    protocol_pending: number;
}

// ─── Filters ────────────────────────────────────────────────────────────────

export interface HelpDeskFilters {
    search?: string;
    status?: Status;
    judge_name?: string;
    start_date?: string;
    end_date?: string;
    limit?: number;
    offset?: number;
}

export interface UpdateStatusInput {
    status: Status;
    notes?: string;
    remarks?: string;
}

// ─── Document Tracking ──────────────────────────────────────────────────────

export interface DocumentView {
    id: string;
    document_id: string;
    document_type: string;  // e.g., 'visa_document', 'utility_document', etc.
    viewer_id: string;      // User ID who viewed
    viewer_name: string;    // User name who viewed
    viewed_at: string;
    ip_address: string | null;
    user_agent: string | null;
}

export interface DocumentWithViewStatus {
    id: string;
    document_name: string;
    document_url: string;
    created_at: string;
    viewed_at: string | null;
    view_count: number;
    last_viewed_by: string | null;
    last_viewed_at: string | null;
    viewers: DocumentView[];  // Full view history
}