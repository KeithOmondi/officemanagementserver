// src/features/dsa/dsa.types.ts

export interface DsaActivity {
    id: string;
    name: string;
    date_from: string;
    date_to: string;
    night_outs: number;
    created_by: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    // Aggregated fields
    staff_count: number;
    total_kes: number;
}

export interface DsaStaffEntry {
    id: string;
    activity_id: string;
    activity_name: string;
    user_id: string;
    full_name: string;
    rate_per_night: number;
    night_outs: number;
    total_kes: number;
    created_at: string;
    updated_at: string;
}

export interface DsaStats {
    total_activities: number;
    total_night_outs: number;
    staff_involved: number;
    total_kes_payable: number;
}

export interface StaffEquitySuggestion {
    user_id: string;
    full_name: string;
    total_nights: number;
    total_activities: number;
    last_sent: string | null;
}

export interface DsaEntryWithActivity extends DsaStaffEntry {
    date_from: string;
    date_to: string;
}