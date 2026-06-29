export type UtilityType = 'Electricity' | 'Water' | 'Internet' | 'Fuel' | 'Other';
export type RequestMode = 'Letter' | 'Email' | 'Verbal' | 'Other';
export type VisaType = 'Official' | 'Conference' | 'Personal' | 'Other';
export type Status = 'Pending' | 'Signed' | 'Rejected' | 'In Progress' | 'Completed' | 'Active' | 'Resolved';

export interface JudgeUtility {
    id: string;
    judge_name: string;
    utility_type: UtilityType;
    amount: number;
    period: string;
    description: string | null;
    supporting_document_url: string | null;
    status: Status;
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

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
}

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
export interface CreateUtilityInput {
    judge_name: string;
    utility_type: UtilityType;
    amount: number;
    period: string;
    description?: string;
}

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
    dsa_details?: Omit<DSADetail, 'id' | 'total'>[];
}

export interface CreateSpecialBenchInput {
    name: string;
    case_reference?: string;
    start_date: string;
    end_date: string;
    dsa_details?: Omit<DSADetail, 'id' | 'total'>[];
}

export interface CreatePartHeardInput {
    case_reference: string;
    approved_by?: string;
    start_date: string;
    end_date: string;
    dsa_details?: Omit<DSADetail, 'id' | 'total'>[];
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
    dsa_details?: Omit<DSADetail, 'id' | 'total'>[];
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