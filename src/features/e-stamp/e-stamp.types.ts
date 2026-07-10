// src/features/e-stamp/e-stamp.types.ts

export type EStampType = 'approved' | 'received';
export type EStampStatus = 'pending' | 'stamped' | 'failed' | 'revoked';

export interface EStamp {
    id: string;
    document_id: string;
    stamp_type: EStampType;
    stamped_by: string;
    stamped_by_name?: string;
    stamp_image_url: string;
    stamp_public_id: string;
    stamp_data: {
        reference_no: string;
        document_title: string;
        stamped_at: string;
        stamped_by: string;
        stamp_type: EStampType;
        signature_url?: string;
        signature_hash?: string;
        qr_code_data?: string;
        verification_code: string;
        department_name?: string;
        station_name?: string;
    };
    metadata: {
        ip_address?: string;
        user_agent?: string;
        timestamp: string;
        department_id?: string;
        station_name?: string;
        department_name?: string;
    };
    verification_code: string;
    verification_hash: string;
    is_active: boolean;
    revoked_at?: Date;
    revoked_by?: string;
    revocation_reason?: string;
    created_at: Date;
    updated_at: Date;
}

export interface GenerateEStampInput {
    document_id: string;
    stamp_type: EStampType;
    signature_url: string;
    metadata?: {
        ip_address?: string;
        user_agent?: string;
        department_id?: string;
        station_name?: string;
        department_name?: string;
    };
}

export interface VerifyEStampInput {
    verification_code: string;
}

export interface RevokeEStampInput {
    reason: string;
}

export interface EStampVerificationResult {
    valid: boolean;
    data?: EStamp;
    message?: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

export const E_STAMP_TYPE_LABELS: Record<EStampType, string> = {
    approved: 'Approved',
    received: 'Received',
};

export const E_STAMP_TYPE_COLORS: Record<EStampType, string> = {
    approved: 'emerald',
    received: 'blue',
};

export const E_STAMP_STATUS_LABELS: Record<EStampStatus, string> = {
    pending: 'Pending',
    stamped: 'Stamped ✓',
    failed: 'Failed',
    revoked: 'Revoked ✕',
};