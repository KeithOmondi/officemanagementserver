// src/types/conference.types.ts

// ─── Conference Types ─────────────────────────────────────────────────────────

/**
 * Conference Status
 * - `draft`: Initial state, not yet submitted
 * - `pending`: Submitted, awaiting approval
 * - `approved`: Approved by super admin
 * - `rejected`: Rejected by super admin
 * - `completed`: Conference has ended
 * - `cancelled`: Conference was cancelled
 */
export type ConferenceStatus = 
  | 'draft' 
  | 'pending' 
  | 'approved' 
  | 'rejected' 
  | 'completed' 
  | 'cancelled';

/**
 * Conference Request - Complete entity returned from API
 */
export interface ConferenceRequest {
  id: string;                    // Unique identifier
  serial_number: number;         // Auto-incrementing serial number: 1, 2, 3, ...
  particulars: string;           // Description/details of the conference
  start_date: Date;              // Conference start date
  end_date: Date;                // Conference end date
  number_of_pax: number;         // Number of participants
  status: ConferenceStatus;
  created_by: string;
  created_by_name: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * Create Conference Request - Input for creating a new request
 */
export interface CreateConferenceRequestInput {
  particulars: string;
  start_date: Date | string;
  end_date: Date | string;
  number_of_pax: number;
}

/**
 * Update Conference Request - Input for updating an existing request
 */
export interface UpdateConferenceRequestInput {
  particulars?: string;
  start_date?: Date | string;
  end_date?: Date | string;
  number_of_pax?: number;
  status?: ConferenceStatus;
}

/**
 * Approve Conference Request - Input for approving a request
 */
export interface ApproveConferenceRequestInput {
  comments?: string;
}

/**
 * Return Conference Request - Input for returning a request
 */
export interface ReturnConferenceRequestInput {
  reason: string;
}

// ─── Filters and Responses ──────────────────────────────────────────────────

/**
 * Conference Request Filters - For list/query endpoints
 */
export interface ConferenceRequestFilters {
  status?: ConferenceStatus;
  start_date_from?: Date | string;
  start_date_to?: Date | string;
  page?: number;
  limit?: number;
  sort_by?: 'created_at' | 'updated_at' | 'start_date' | 'end_date' | 'serial_number';
  sort_order?: 'ASC' | 'DESC';
}

/**
 * Paginated Response for Conference Requests
 */
export interface ConferencePaginationResponse {
  data: ConferenceRequest[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Statistics for Conference Dashboard
 */
export interface ConferenceStats {
  total: number;
  draft: number;
  pending: number;
  approved: number;
  rejected: number;
  completed: number;
  cancelled: number;
  total_pax: number;
  upcoming: number; // Conferences starting in next 7 days
  ongoing: number; // Conferences currently in progress
}

// ─── Constants ─────────────────────────────────────────────────────────────────

export const CONFERENCE_STATUSES: ConferenceStatus[] = [
  'draft', 
  'pending', 
  'approved', 
  'rejected', 
  'completed', 
  'cancelled'
];

export const CONFERENCE_SORT_FIELDS = [
  'created_at', 
  'updated_at', 
  'start_date', 
  'end_date', 
  'serial_number'
] as const;

// ─── Helper Functions ─────────────────────────────────────────────────────────

/**
 * Get display label for conference status
 */
export const getConferenceStatusLabel = (status: ConferenceStatus): string => {
  const labels: Record<ConferenceStatus, string> = {
    draft: 'Draft',
    pending: 'Pending Approval',
    approved: 'Approved',
    rejected: 'Rejected',
    completed: 'Completed',
    cancelled: 'Cancelled',
  };
  return labels[status];
};

/**
 * Get status color for UI badges (Conference)
 */
export const getConferenceStatusColor = (status: ConferenceStatus): string => {
  const colors: Record<ConferenceStatus, string> = {
    draft: 'bg-gray-50 text-gray-700 ring-gray-200',
    pending: 'bg-amber-50 text-amber-700 ring-amber-200',
    approved: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    rejected: 'bg-red-50 text-red-700 ring-red-200',
    completed: 'bg-blue-50 text-blue-700 ring-blue-200',
    cancelled: 'bg-stone-50 text-stone-700 ring-stone-200',
  };
  return colors[status];
};

/**
 * Get status dot color for UI (Conference)
 */
export const getConferenceStatusDotColor = (status: ConferenceStatus): string => {
  const colors: Record<ConferenceStatus, string> = {
    draft: 'bg-gray-500',
    pending: 'bg-amber-500',
    approved: 'bg-emerald-500',
    rejected: 'bg-red-500',
    completed: 'bg-blue-500',
    cancelled: 'bg-stone-500',
  };
  return colors[status];
};

/**
 * Format date for display (Conference)
 */
export const formatConferenceDate = (date: Date | string | null | undefined): string => {
  if (!date) return '—';
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
};

/**
 * Format date for API (YYYY-MM-DD)
 */
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

/**
 * Check if a conference request is editable
 */
export const isConferenceEditable = (status: ConferenceStatus): boolean => {
  return status === 'draft' || status === 'pending';
};

/**
 * Check if a conference request is deletable
 */
export const isConferenceDeletable = (status: ConferenceStatus): boolean => {
  return status === 'draft' || status === 'pending' || status === 'rejected';
};

/**
 * Check if a conference request is in progress (ongoing)
 */
export const isConferenceOngoing = (
  startDate: Date | string, 
  endDate: Date | string
): boolean => {
  const now = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);
  return now >= start && now <= end;
};

/**
 * Check if a conference is upcoming (within 7 days)
 */
export const isConferenceUpcoming = (startDate: Date | string): boolean => {
  const now = new Date();
  const start = new Date(startDate);
  const sevenDaysFromNow = new Date(now);
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
  return start > now && start <= sevenDaysFromNow;
};

/**
 * Get status options for Conference status filter
 */
export const getConferenceStatusFilterOptions = (): Array<{ value: ConferenceStatus; label: string }> => {
  return CONFERENCE_STATUSES.map(status => ({
    value: status,
    label: getConferenceStatusLabel(status),
  }));
};

/**
 * Calculate duration in days
 */
export const getConferenceDuration = (startDate: Date | string, endDate: Date | string): number => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
};

/**
 * Generate the next serial number (for UI display)
 */
export const getNextSerialNumber = (conferences: ConferenceRequest[]): number => {
  if (conferences.length === 0) return 1;
  const maxSerial = Math.max(...conferences.map(c => c.serial_number));
  return maxSerial + 1;
};