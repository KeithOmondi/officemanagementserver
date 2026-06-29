export type FinancialActivityType = 'Expenditure' | 'Commitment' | 'Pro Bono';
export type FinancialStatus = 'Pending' | 'Approved' | 'Rejected' | 'Paid';
export type ProBonoStatus = 'Pending' | 'Approved' | 'Rejected' | 'Completed';
export type ReportStatus = 'Draft' | 'Submitted' | 'Approved';

export interface VoteLine {
    id: string;
    name: string;
    allocated: number;
    spent: number;
    committed: number;
    available: number;
    has_allocation: boolean;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface FinancialActivity {
    id: string;
    activity: string;
    payee: string;
    vote_id: string | null;
    vote_name: string;
    amount: number;
    date: string;
    type: FinancialActivityType;
    status: FinancialStatus;
    created_by: string | null;
    created_at: string;
    updated_at: string;
    is_active: boolean;
}

export interface ProBonoRequest {
    id: string;
    organization: string;
    service_type: string;
    description: string | null;
    value: number;
    status: ProBonoStatus;
    submitted_by: string | null;
    submitted_by_name: string | null;
    submitted_date: string;
    approved_by: string | null;
    approved_date: string | null;
    created_at: string;
    updated_at: string;
    is_active: boolean;
}

export interface FinancialAuditEntry {
    id: string;
    actor: string | null;
    actor_name: string | null;
    action: string;
    detail: string | null;
    timestamp: string;
    entity_type: string | null;
    entity_id: string | null;
}

export interface MonthlyBudgetReport {
    id: string;
    report_month: string;
    total_allocated: number;
    total_spent: number;
    total_committed: number;
    total_available: number;
    submitted_by: string | null;
    submitted_date: string | null;
    approved_by: string | null;
    approved_date: string | null;
    status: ReportStatus;
    created_at: string;
    updated_at: string;
}

export interface FinancialStats {
    total_allocated: number;
    total_paid: number;
    committed_unpaid: number;
    pro_bono_approved: number;
}

export interface CreateVoteLineInput {
    name: string;
    allocated?: number;
}

export interface UpdateVoteLineInput {
    name?: string;
    allocated?: number;
    spent?: number;
    committed?: number;
    has_allocation?: boolean;
    is_active?: boolean;
}

export interface CreateFinancialActivityInput {
    activity: string;
    payee: string;
    vote_id?: string | null;  // FIXED: Allow null
    vote_name: string;
    amount: number;
    date: string;
    type: FinancialActivityType;
    status?: FinancialStatus;
}

export interface UpdateFinancialActivityInput {
    activity?: string;
    payee?: string;
    vote_id?: string | null;  // FIXED: Allow null
    vote_name?: string;
    amount?: number;
    date?: string;
    type?: FinancialActivityType;
    status?: FinancialStatus;
    is_active?: boolean;
}

export interface CreateProBonoInput {
    organization: string;
    service_type: string;
    description?: string;
    value: number;
    status?: ProBonoStatus;
    submitted_by_name?: string;
    submitted_date?: string;
}

export interface UpdateProBonoInput {
    organization?: string;
    service_type?: string;
    description?: string | null;
    value?: number;
    status?: ProBonoStatus;
    approved_by?: string | null;
    approved_date?: string | null;
    is_active?: boolean;
}

export interface CreateBudgetReportInput {
    report_month: string;
}

// ─── Filter Types ──────────────────────────────────────────────────────────────

export interface ActivityFilters {
    search?: string;
    vote?: string;
    type?: string;
    status?: string;
    limit?: number;
    offset?: number;
}

export interface ProBonoFilters {
    search?: string;
    status?: string;
    limit?: number;
    offset?: number;
}