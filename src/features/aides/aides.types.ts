// src/types/aide.types.ts

// ─── Aide Types ──────────────────────────────────────────────────────────────

/**
 * Aide Request Status
 * - `in_progress`: Request is being processed
 * - `rejected`: Request was rejected
 * - `attached`: Officer has been attached
 */
export type AideStatus = 'in_progress' | 'rejected' | 'attached';

/**
 * Police Officer Ranks
 * From lowest to highest rank
 */
export type OfficerRank =
  | 'Police Constable (PC)'
  | 'Corporal (CPL)'
  | 'Sergeant (SGT)'
  | 'Inspector (IP)'
  | 'Chief Inspector (CIP)'
  | 'Assistant Superintendent (ASP)'
  | 'Superintendent (SP)'
  | 'Senior Superintendent (SSP)'
  | 'Assistant Commissioner (ACP)'
  | 'Senior Assistant Commissioner (SACP)'
  | 'Commissioner (CP)';

/**
 * Police Units
 */
export type UnitType = 'KPS' | 'APS' | 'GSU' | 'DCI' | 'VIPPU' | 'Other';

/**
 * Aide Request - Complete entity returned from API
 */
export interface AideRequest {
  id: string;
  judge_name: string;
  officer_rank: OfficerRank;
  officer_name: string;
  employment_number: string;
  current_station: string;
  current_unit: UnitType;
  proposed_assignment: string;
  reporting_date: Date | null;
  status: AideStatus;
  remarks: string | null;
  created_by: string;
  created_by_name: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * Create Aide Request - Input for creating a new request
 */
export interface CreateAideRequestInput {
  judge_name: string;
  officer_rank: OfficerRank;
  officer_name: string;
  employment_number: string;
  current_station: string;
  current_unit: UnitType;
  proposed_assignment: string;
  reporting_date?: Date | string | null;
  status?: AideStatus; // Optional, defaults to 'in_progress'
  remarks?: string;
}

/**
 * Update Aide Request - Input for updating an existing request
 */
export interface UpdateAideRequestInput {
  judge_name?: string;
  officer_rank?: OfficerRank;
  officer_name?: string;
  employment_number?: string;
  current_station?: string;
  current_unit?: UnitType;
  proposed_assignment?: string;
  reporting_date?: Date | string | null;
  status?: AideStatus;
  remarks?: string;
}

// ─── Sentry Types ─────────────────────────────────────────────────────────────

/**
 * Sentry Request Status
 * - `pending`: Request is pending review
 * - `active`: Sentry service is active
 * - `resolved`: Sentry service has been resolved
 * - `rejected`: Request was rejected
 */
export type SentryStatus = 'pending' | 'active' | 'resolved' | 'rejected';

/**
 * Sentry Request - Complete entity returned from API
 * Represents a sentry request for a judge's residence
 */
export interface SentryRequest {
  id: string;
  judge_name: string;
  residence_location: string;
  status: SentryStatus;
  remarks: string | null;
  created_by: string;
  created_by_name: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * Create Sentry Request - Input for creating a new request
 */
export interface CreateSentryRequestInput {
  judge_name: string;
  residence_location: string;
  remarks?: string;
}

/**
 * Update Sentry Request - Input for updating an existing request
 */
export interface UpdateSentryRequestInput {
  judge_name?: string;
  residence_location?: string;
  status?: SentryStatus;
  remarks?: string;
}

// ─── Filters and Responses ──────────────────────────────────────────────────

/**
 * Aide Request Filters - For list/query endpoints
 */
export interface AideRequestFilters {
  status?: AideStatus;
  judge_name?: string;
  officer_name?: string;
  current_station?: string;
  page?: number;
  limit?: number;
  sort_by?: 'created_at' | 'updated_at' | 'judge_name' | 'status';
  sort_order?: 'ASC' | 'DESC';
}

/**
 * Sentry Request Filters - For list/query endpoints
 */
export interface SentryRequestFilters {
  status?: SentryStatus;
  judge_name?: string;
  residence_location?: string;
  page?: number;
  limit?: number;
  sort_by?: 'created_at' | 'updated_at' | 'judge_name' | 'status';
  sort_order?: 'ASC' | 'DESC';
}

/**
 * Paginated Response for Aide Requests
 */
export interface AideRequestPaginationResponse {
  data: AideRequest[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Paginated Response for Sentry Requests
 */
export interface SentryRequestPaginationResponse {
  data: SentryRequest[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Statistics for Aide Requests Dashboard
 */
export interface AideRequestStats {
  total: number;
  in_progress: number;
  rejected: number;
  attached: number;
  by_station: Record<string, number>;
  by_unit: Record<string, number>;
}

/**
 * Statistics for Sentry Requests Dashboard
 */
export interface SentryRequestStats {
  total: number;
  pending: number;
  active: number;
  resolved: number;
  rejected: number;
  by_location: Record<string, number>;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

export const OFFICER_RANKS: OfficerRank[] = [
  'Police Constable (PC)',
  'Corporal (CPL)',
  'Sergeant (SGT)',
  'Inspector (IP)',
  'Chief Inspector (CIP)',
  'Assistant Superintendent (ASP)',
  'Superintendent (SP)',
  'Senior Superintendent (SSP)',
  'Assistant Commissioner (ACP)',
  'Senior Assistant Commissioner (SACP)',
  'Commissioner (CP)',
];

export const UNIT_TYPES: UnitType[] = ['KPS', 'APS', 'GSU', 'DCI', 'VIPPU', 'Other'];

export const AIDE_STATUSES: AideStatus[] = ['in_progress', 'rejected', 'attached'];

export const SENTRY_STATUSES: SentryStatus[] = ['pending', 'active', 'resolved', 'rejected'];

// ─── Helper Functions ─────────────────────────────────────────────────────────

export const getOfficerRankLabel = (rank: OfficerRank): string => rank;
export const getUnitTypeLabel = (unit: UnitType): string => unit;

export const getAideStatusLabel = (status: AideStatus): string => {
  const labels: Record<AideStatus, string> = {
    in_progress: 'In Progress',
    rejected: 'Rejected',
    attached: 'Attached',
  };
  return labels[status];
};

export const getSentryStatusLabel = (status: SentryStatus): string => {
  const labels: Record<SentryStatus, string> = {
    pending: 'Pending',
    active: 'Active',
    resolved: 'Resolved',
    rejected: 'Rejected',
  };
  return labels[status];
};

export const getAideStatusColor = (status: AideStatus): string => {
  const colors: Record<AideStatus, string> = {
    in_progress: 'bg-blue-100 text-blue-700 border-blue-200',
    rejected: 'bg-red-100 text-red-700 border-red-200',
    attached: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  };
  return colors[status];
};

export const getSentryStatusColor = (status: SentryStatus): string => {
  const colors: Record<SentryStatus, string> = {
    pending: 'bg-amber-100 text-amber-700 border-amber-200',
    active: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    resolved: 'bg-blue-100 text-blue-700 border-blue-200',
    rejected: 'bg-red-100 text-red-700 border-red-200',
  };
  return colors[status];
};

export const getSentryStatusDotColor = (status: SentryStatus): string => {
  const colors: Record<SentryStatus, string> = {
    pending: 'bg-amber-500',
    active: 'bg-emerald-500',
    resolved: 'bg-blue-500',
    rejected: 'bg-red-500',
  };
  return colors[status];
};

export const getOfficerRankOrder = (rank: OfficerRank): number => {
  const order: Record<OfficerRank, number> = {
    'Police Constable (PC)': 1,
    'Corporal (CPL)': 2,
    'Sergeant (SGT)': 3,
    'Inspector (IP)': 4,
    'Chief Inspector (CIP)': 5,
    'Assistant Superintendent (ASP)': 6,
    'Superintendent (SP)': 7,
    'Senior Superintendent (SSP)': 8,
    'Assistant Commissioner (ACP)': 9,
    'Senior Assistant Commissioner (SACP)': 10,
    'Commissioner (CP)': 11,
  };
  return order[rank] || 0;
};

export const sortOfficerRanks = (ranks: OfficerRank[]): OfficerRank[] => {
  return [...ranks].sort((a, b) => getOfficerRankOrder(a) - getOfficerRankOrder(b));
};

export const formatDate = (date: Date | string | null | undefined): string => {
  if (!date) return '—';
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
};

export const formatDateTime = (date: Date | string | null | undefined): string => {
  if (!date) return '—';
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-KE', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
};

export const formatDateForAPI = (date: Date | string | null | undefined): string | null => {
  if (!date) return null;
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().split('T')[0];
  } catch {
    return null;
  }
};