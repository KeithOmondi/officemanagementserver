// src/types/aide.types.ts

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
  reporting_date: Date;
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
  reporting_date: Date | string;
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
  reporting_date?: Date | string;
  status?: AideStatus;
  remarks?: string;
}

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

// ─── Constants ─────────────────────────────────────────────────────────────────

/**
 * Helper arrays for dropdowns and validation
 */
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

// ─── Helper Functions ─────────────────────────────────────────────────────────

/**
 * Get display label for officer rank
 */
export const getOfficerRankLabel = (rank: OfficerRank): string => rank;

/**
 * Get display label for unit type
 */
export const getUnitTypeLabel = (unit: UnitType): string => unit;

/**
 * Get display label for aide status
 */
export const getAideStatusLabel = (status: AideStatus): string => {
  const labels: Record<AideStatus, string> = {
    in_progress: 'In Progress',
    rejected: 'Rejected',
    attached: 'Attached',
  };
  return labels[status];
};

/**
 * Get status color for UI badges
 */
export const getAideStatusColor = (status: AideStatus): string => {
  const colors: Record<AideStatus, string> = {
    in_progress: 'bg-blue-100 text-blue-700 border-blue-200',
    rejected: 'bg-red-100 text-red-700 border-red-200',
    attached: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  };
  return colors[status];
};

/**
 * Get priority/order for sorting ranks
 */
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

/**
 * Sort officer ranks by seniority (lowest to highest)
 */
export const sortOfficerRanks = (ranks: OfficerRank[]): OfficerRank[] => {
  return [...ranks].sort((a, b) => getOfficerRankOrder(a) - getOfficerRankOrder(b));
};