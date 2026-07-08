export type UtilityType = 'Electricity' | 'Water' | 'Internet' | 'Fuel' | 'Other';
export type RequestMode = 'Letter' | 'Email' | 'Verbal' | 'Other';
export type VisaType = 'Official' | 'Conference' | 'Personal' | 'Other';
export type Status = 'Pending' | 'Signed' | 'Rejected' | 'In Progress' | 'Completed' | 'Active' | 'Resolved' | 'Cancelled';

// ─── Ticket Details (Shared across Tickets, Benches, Part-Heards) ──────────

export interface TicketDetails {
    date_of_travel: string | null;
    return_date: string | null;
    departure_from: string | null;
    destination: string | null;
    preferred_flight_time: string | null;
    remarks: string | null;
}

// ─── Tickets ──────────────────────────────────────────────────────────────────

export interface Ticket {
    id: string;
    ticket_number: string;
    ticket_type: 'Bench' | 'Part-Heard' | 'General';
    reference_id: string | null;
    date_of_travel: string | null;
    return_date: string | null;
    departure_from: string | null;
    destination: string | null;
    preferred_flight_time: string | null;
    passenger_name: string;
    passenger_pj_number: string | null;
    flight_details: string | null;
    amount: number | null;
    status: Status;
    remarks: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

export interface CreateTicketInput {
    ticket_type: 'Bench' | 'Part-Heard' | 'General';
    reference_id?: string;
    date_of_travel?: string;
    return_date?: string;
    departure_from?: string;
    destination?: string;
    preferred_flight_time?: string;
    passenger_name: string;
    passenger_pj_number?: string;
    flight_details?: string;
    amount?: number;
    remarks?: string;
}

export interface UpdateTicketInput {
    date_of_travel?: string;
    return_date?: string;
    departure_from?: string;
    destination?: string;
    preferred_flight_time?: string;
    passenger_name?: string;
    passenger_pj_number?: string;
    flight_details?: string;
    amount?: number;
    status?: Status;
    remarks?: string;
}

export interface TicketFilters {
    search?: string;
    status?: Status;
    ticket_type?: 'Bench' | 'Part-Heard' | 'General';
    reference_id?: string;
    limit?: number;
    offset?: number;
}

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
}

export type DSADetailInput = {
    judge_name: string;
    pj_number: string;
    dsa_per_day: number;
    days: number;
    notes?: string;
    designation?: string;
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
    tickets?: Ticket[];
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
    tickets?: Ticket[];
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
    tickets?: Ticket[];
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

export interface CreateMedicalClaimInput {
    s_no?: number;
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

export interface CreateGeneralRequestInput {
    s_no?: number;
    judge_name: string;
    request: string;
    date_received?: string;
    officer_assigned?: string;
    status?: Status;
    remarks?: string;
}

// ─── Visa Support ────────────────────────────────────────────────────────────

export interface VisaRequest {
    id: string;
    s_no: number | null;
    name: string;
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
    created_at: string;
}

export interface CreateVisaRequestInput {
    s_no?: number;
    name: string;
    destination_country: string;
    date_of_travel?: string;
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

export interface CreateProtocolEventInput {
    s_no?: number;
    activity: string;
    period_from?: string;
    period_to?: string;
    officers_assigned?: string;
    remarks?: string;
    notes?: string;
    dsa_required?: boolean;
    dsa_details?: DSADetailInput[];
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