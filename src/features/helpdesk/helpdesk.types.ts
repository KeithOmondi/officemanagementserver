export type UtilityType = 'Electricity' | 'Water' | 'Internet' | 'Fuel' | 'Other';
export type RequestMode = 'Letter' | 'Email' | 'Verbal' | 'Other';
export type VisaType = 'Official' | 'Conference' | 'Personal' | 'Other';
export type Status = 'Pending' | 'Signed' | 'Rejected' | 'In Progress' | 'Completed' | 'Active' | 'Resolved';

// ─── Judge Utilities (restructured: one judge → many utility items) ──────────

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
    utility_type?: UtilityType; // ADDED — was silently dropped on updates before
}

export interface UtilityFilters {
    search?: string;
    judge_name?: string;
    status?: UtilityStatus;
    limit?: number;
    offset?: number;
}

// ─── Everything below is unchanged ────────────────────────────────────────────

export interface ClubMembership {
    id: string;
    judge_name: string;
    club_name: string;
    annual_fee: number;
    period: string;
    supporting_document_url: string | null;
    status: Status;
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

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

export interface JudgeRequest {
    id: string;
    judge_name: string;
    nature: string;
    mode: RequestMode;
    received_date: string;
    status: Status;
    resolution_notes: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

export interface VisaRequest {
    id: string;
    judge_name: string;
    request_date: string;
    destination_country: string;
    visa_type: VisaType;
    travel_date: string | null;
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

export interface ProtocolEvent {
    id: string;
    event_name: string;
    start_date: string;
    end_date: string;
    dsa_required: boolean;
    total_dsa: number;
    status: Status;
    notes: string | null;
    dsa_details?: DSADetail[];
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

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

// Input types

export interface CreateClubMembershipInput {
    judge_name: string;
    club_name: string;
    annual_fee: number;
    period: string;
}

export interface CreateCircuitInput {
    name: string;
    location?: string;
    start_date: string;
    end_date: string;
    dsa_details?: DSADetailInput[];
}

export interface CreateSpecialBenchInput {
    name: string;
    case_reference?: string;
    start_date: string;
    end_date: string;
    dsa_details?: DSADetailInput[];
}

export interface CreatePartHeardInput {
    case_reference: string;
    approved_by?: string;
    start_date: string;
    end_date: string;
    dsa_details?: DSADetailInput[];
}

export interface CreateJudgeRequestInput {
    judge_name: string;
    nature: string;
    mode: RequestMode;
    received_date: string;
}

export interface CreateVisaRequestInput {
    judge_name: string;
    request_date: string;
    destination_country: string;
    visa_type: VisaType;
    travel_date?: string;
    notes?: string;
}

export interface CreateProtocolEventInput {
    event_name: string;
    start_date: string;
    end_date: string;
    dsa_required?: boolean;
    dsa_details?: DSADetailInput[];
    notes?: string;
}

export interface UpdateStatusInput {
    status: Status;
    notes?: string;
}

export interface HelpDeskFilters {
    search?: string;
    status?: Status;
    judge_name?: string;
    start_date?: string;
    end_date?: string;
    limit?: number;
    offset?: number;
}

// Add to existing types
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