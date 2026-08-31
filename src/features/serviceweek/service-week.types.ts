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
  created_by: string;
  created_at: string;
  updated_at: string;
  submitted_at?: string;
  // Super admin edit tracking
  last_edited_by?: string;
  last_edited_at?: string;
  edit_history?: EditHistoryEntry[];
}

// Super admin edit history tracking
export interface EditHistoryEntry {
  id: string;
  report_id: string;
  edited_by: string;
  edited_by_designation: string;
  edited_at: string;
  changes: {
    field: string;
    old_value: any;
    new_value: any;
  }[];
  reason?: string;
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
  status?: ServiceWeekStatus;
  // Super admin edit fields
  edit_reason?: string;
}

export interface ServiceWeekFilters {
  station?: string;
  judge_name?: string;
  week_start?: string;
  week_end?: string;
  status?: ServiceWeekStatus;
  limit?: number;
  offset?: number;
  // Super admin filters
  edited_by?: string;
  edited_after?: string;
  edited_before?: string;
}

// ─── Super Admin Specific Types ──────────────────────────────────────────

export interface SuperAdminEditPayload {
  reportId: string;
  updates: UpdateServiceWeekPayload;
  edit_reason: string;
  edited_by: string;
  edited_by_designation: string;
}

export interface EditHistoryFilters {
  report_id?: string;
  edited_by?: string;
  start_date?: string;
  end_date?: string;
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
  // Super admin state
  editMode: boolean;
  editingReportId: string | null;
  editHistory: EditHistoryEntry[];
  isLoadingHistory: boolean;
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

// Super admin edit constants
export const EDIT_ACTIONS = {
  START_EDIT: 'START_EDIT',
  CANCEL_EDIT: 'CANCEL_EDIT',
  SAVE_EDIT: 'SAVE_EDIT',
  VIEW_HISTORY: 'VIEW_HISTORY',
} as const;

export type EditAction = typeof EDIT_ACTIONS[keyof typeof EDIT_ACTIONS];

// ─── Form Types ────────────────────────────────────────────────────────────

export interface ServiceWeekFormValues {
  station: string;
  division: string;
  week_start: string;
  week_end: string;
  date: string;
  judge_name: string;
  cases: CaseReturnFormValues[];
  prepared_by: string;
  prepared_designation: string;
  prepared_date: string;
}

export interface CaseReturnFormValues {
  serial_number: number | '';
  case_number: string;
  cause_listed_activity: string;
  outcome: string;
  remarks: string;
}

// Super admin edit form types
export interface ServiceWeekEditFormValues extends ServiceWeekFormValues {
  edit_reason: string;
}

// ─── Additional Super Admin Types ──────────────────────────────────────

export interface EditPermissions {
  canEdit: boolean;
  canEditAll: boolean;
  canEditOwnOnly: boolean;
  canViewHistory: boolean;
}

export interface EditOperationResult {
  success: boolean;
  message: string;
  updatedReport?: ServiceWeekReport;
  error?: string;
}

export interface EditValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}