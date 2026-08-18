// src/types/service-week.types.ts

// ─── Core Types ────────────────────────────────────────────────────────────

export type ServiceWeekStatus = 'draft' | 'submitted';

export interface CaseReturn {
  serial_number: number;
  case_number: string;
  cause_listed_activity: string;
  outcome: string;
  remarks?: string;
}

export interface ServiceWeekReport {
  id: string;
  station: string;
  division?: string;
  week_start: string;
  week_end: string;
  date: string;
  judge_name: string;
  cases: CaseReturn[];
  status: ServiceWeekStatus;
  prepared_by: string;
  prepared_designation: string;
  prepared_signature?: string;
  prepared_date?: string;
  confirmed_by?: string;
  confirmed_designation?: string;
  confirmed_signature?: string;
  confirmed_date?: string;
  approved_by?: string;
  approved_designation?: string;
  approved_signature?: string;
  approved_date?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  submitted_at?: string;
}

export interface CreateServiceWeekPayload {
  station: string;
  division?: string;
  week_start: string;
  week_end: string;
  date: string;
  judge_name: string;
  cases: CaseReturn[];
  prepared_by: string;
  prepared_designation: string;
  prepared_date?: string;
  confirmed_by?: string;
  confirmed_designation?: string;
  confirmed_date?: string;
  approved_by?: string;
  approved_designation?: string;
  approved_date?: string;
  saveAsDraft?: boolean;
}

export interface UpdateServiceWeekPayload {
  station?: string;
  division?: string;
  week_start?: string;
  week_end?: string;
  date?: string;
  judge_name?: string;
  cases?: CaseReturn[];
  prepared_by?: string;
  prepared_designation?: string;
  prepared_date?: string;
  confirmed_by?: string;
  confirmed_designation?: string;
  confirmed_date?: string;
  approved_by?: string;
  approved_designation?: string;
  approved_date?: string;
  status?: ServiceWeekStatus;
}

export interface ServiceWeekFilters {
  station?: string;
  judge_name?: string;
  week_start?: string;
  week_end?: string;
  status?: ServiceWeekStatus;
  limit?: number;
  offset?: number;
}

// ─── Response Types ──────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data: T;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── Slice State ─────────────────────────────────────────────────────────

export interface ServiceWeekState {
  reports: ServiceWeekReport[];
  currentReport: ServiceWeekReport | null;
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  filters: ServiceWeekFilters;
}

// ─── Constants ────────────────────────────────────────────────────────────

export const SERVICE_WEEK_STATUS_LABELS: Record<ServiceWeekStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
};

export const SERVICE_WEEK_STATUS_COLORS: Record<ServiceWeekStatus, string> = {
  draft: 'bg-gray-100 text-gray-800',
  submitted: 'bg-yellow-100 text-yellow-800',
};