// ============================================================
// Core Enums
// ============================================================

export type RequestType = 
  | 'Driver' 
  | 'Bodyguard' 
  | 'Firearm' 
  | 'Current Station' 
  | 'Force Number' 
  | 'Residence Security' 
  | 'Sentry';

export type RequestMode = 'Letter' | 'Email' | 'Verbal' | 'Other';
export type VisaType = 'Official' | 'Conference' | 'Personal' | 'Other';
export type Status = 'Pending' | 'Signed' | 'Rejected' | 'In Progress' | 'Completed' | 'Active' | 'Resolved' | 'Cancelled';
export type DSAPaymentStatus = 'Pending' | 'In Process' | 'Paid' | 'Payment NA';
export type ReportModule = 'circuit' | 'special_bench' | 'part_heard' | 'service_week' | 'other_payment';
export type RemarkType = 'Onboarding' | 'Release';
export type GeneralRequestCategory = 'Security' | 'Personnel' | 'Administrative';

// ============================================================
// Base Types
// ============================================================

export interface BaseEntity {
  id: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BaseRequest {
  s_no: number | null;
  judge_name: string;
  status: Status;
  remarks: string | null;
}

export interface BaseDSAAware {
  dsa_details?: DSADetail[];
  total_dsa: number;
}

// ============================================================
// Utility Types
// ============================================================

export type UtilityType = 'Electricity' | 'Water' | 'Internet' | 'Fuel' | 'Other';

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
  requisition_number: string | null;
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

// --- Utility Inputs ---

export type UtilityItemInput = {
  utility_type: UtilityType;
  requisition_number?: string;
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
  requisition_number?: string;
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
  utility_type?: UtilityType;
  requisition_number?: string;
}

export interface UtilityFilters {
  search?: string;
  judge_name?: string;
  status?: UtilityStatus;
  limit?: number;
  offset?: number;
}

// ============================================================
// General Requests - Unified approach
// ============================================================

/**
 * General Request - Unified model for all request types including:
 * - Driver, Bodyguard, Firearm, Current Station, Force Number, Residence Security, Sentry
 * - Also includes administrative and other general requests
 */
export interface GeneralRequest extends BaseEntity {
  s_no: number | null;
  ticket_number: string | null;
  judge_name: string;
  request: string;                    // Description of the request
  request_type: RequestType;          // Specific type of request
  category: GeneralRequestCategory;   // High-level categorization
  date_received: string | null;
  officer_assigned: string | null;
  status: Status;
  remarks: string | null;
  remark_type: RemarkType | null;     // Onboarding or Release (for security/personnel)
  
  // Security/Personnel specific fields
  request_date: string | null;        // Date of request
  location: string | null;            // For station/security requests
  firearm_type: string | null;        // For firearm requests
  force_number: string | null;        // For force number requests
  officer_name: string | null;        // Name of the officer (for bodyguard/driver)
  assigned_to: string | null;         // Who it's assigned to
  priority: string | null;            // Priority level if needed
  notes: string | null;              // Additional notes
}

export interface CreateGeneralRequestInput {
  judge_name: string;
  request: string;
  request_type: RequestType;
  category?: GeneralRequestCategory;
  date_received?: string;
  officer_assigned?: string;
  status?: Status;
  remarks?: string;
  remark_type?: RemarkType;
  request_date?: string;
  location?: string;
  firearm_type?: string;
  force_number?: string;
  officer_name?: string;
  assigned_to?: string;
  priority?: string;
  notes?: string;
  email?: string;                    // Recipient email for notification
  send_email?: boolean;              // Manual control: true = send email, false = don't send
}

export interface UpdateGeneralRequestInput {
  request?: string;
  request_type?: RequestType;
  category?: GeneralRequestCategory;
  date_received?: string;
  officer_assigned?: string;
  status?: Status;
  remarks?: string;
  remark_type?: RemarkType;
  request_date?: string;
  location?: string;
  firearm_type?: string;
  force_number?: string;
  officer_name?: string;
  assigned_to?: string;
  priority?: string;
  notes?: string;
}

// ============================================================
// Legacy Security Request (for backward compatibility)
// ============================================================

/**
 * @deprecated Use GeneralRequest instead - this is kept for backward compatibility
 */
export interface SecurityRequest extends BaseEntity, BaseRequest {
  request_type: RequestType;
  request_date: string | null;
  officer_assigned: string | null;
  remark_type: RemarkType | null;
  location?: string | null;
  firearm_type?: string | null;
  force_number?: string | null;
}

/**
 * @deprecated Use CreateGeneralRequestInput instead
 */
export interface CreateSecurityRequestInput {
  judge_name: string;
  request_type: RequestType;
  request_date?: string;
  officer_assigned?: string;
  status?: Status;
  remarks?: string;
  remark_type?: RemarkType;
  location?: string;
  firearm_type?: string;
  force_number?: string;
  email?: string;
  send_email?: boolean;
}

/**
 * @deprecated Use UpdateGeneralRequestInput instead
 */
export interface UpdateSecurityRequestInput {
  request_type?: RequestType;
  request_date?: string;
  officer_assigned?: string;
  status?: Status;
  remarks?: string;
  remark_type?: RemarkType;
  location?: string;
  firearm_type?: string;
  force_number?: string;
}

// ============================================================
// Club Membership
// ============================================================

export interface ClubMembership extends BaseEntity {
  pj_no: string | null;
  judge_name: string;
  club_name: string;
  entry_fee: number | null;
  annual_fee: number | null;
  date_submitted_dass: string | null;
  court: string | null;
  payment_date: string | null;
  remarks: string | null;
  status: Status;
}

export interface CreateClubMembershipInput {
  pj_no?: string;
  judge_name: string;
  club_name: string;
  entry_fee?: number;
  annual_fee?: number;
  date_submitted_dass?: string;
  court?: string;
  payment_date?: string;
  remarks?: string;
}

// ============================================================
// DSA Details
// ============================================================

export interface DSADetail extends BaseEntity {
  judge_name: string;
  pj_number: string;
  dsa_per_day: number;
  days: number;
  total: number;
  notes: string | null;
  designation: string | null;
  date_of_request: string | null;
  date_of_ticket_facilitation: string | null;
  date_of_conference_facilitation: string | null;
  travel_date: string | null;
  travel_back: string | null;
  requisition_number: string | null;
  requisition_initiation_date: string | null;
  payment_status: DSAPaymentStatus;
}

export type DSADetailInput = {
  judge_name: string;
  pj_number: string;
  dsa_per_day: number;
  days: number;
  notes?: string;
  designation?: string;
  date_of_request?: string;
  date_of_ticket_facilitation?: string;
  date_of_conference_facilitation?: string;
  travel_date?: string;
  travel_back?: string;
  requisition_number?: string;
  requisition_initiation_date?: string;
  payment_status?: DSAPaymentStatus;
};

// ============================================================
// Circuits
// ============================================================

export interface Circuit extends BaseEntity, BaseDSAAware {
  name: string;
  location: string | null;
  start_date: string;
  end_date: string;
  status: Status;
}

export interface CreateCircuitInput {
  name: string;
  location?: string;
  start_date: string;
  end_date: string;
  dsa_details?: DSADetailInput[];
}

// ============================================================
// Other Payments
// ============================================================

export interface OtherPayment extends BaseEntity, BaseDSAAware {
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  status: Status;
}

export interface CreateOtherPaymentInput {
  name: string;
  description?: string;
  start_date: string;
  end_date: string;
  dsa_details?: DSADetailInput[];
}

// ============================================================
// Special Benches
// ============================================================

export interface SpecialBench extends BaseEntity, BaseDSAAware {
  name: string;
  case_reference: string | null;
  start_date: string;
  end_date: string;
  status: Status;
}

export interface CreateSpecialBenchInput {
  name: string;
  case_reference?: string;
  start_date: string;
  end_date: string;
  dsa_details?: DSADetailInput[];
}

export interface UpdateBenchInput {
  name?: string;
  case_reference?: string;
  start_date?: string;
  end_date?: string;
  status?: Status;
  dsa_details?: DSADetailInput[];
}

// ============================================================
// Part-Heards
// ============================================================

export interface PartHeard extends BaseEntity, BaseDSAAware {
  case_reference: string;
  approved_by: string | null;
  start_date: string;
  end_date: string;
  status: Status;
}

export interface CreatePartHeardInput {
  case_reference: string;
  approved_by?: string;
  start_date: string;
  end_date: string;
  dsa_details?: DSADetailInput[];
}

export interface UpdatePartHeardInput {
  case_reference?: string;
  approved_by?: string;
  start_date?: string;
  end_date?: string;
  status?: Status;
  dsa_details?: DSADetailInput[];
}

// ============================================================
// Service Weeks
// ============================================================

export interface ServiceWeek extends BaseEntity, BaseDSAAware {
  name: string;
  week_number: string;
  year: string;
  start_date: string;
  end_date: string;
  status: Status;
}

export interface CreateServiceWeekInput {
  name: string;
  week_number: string;
  year: string;
  start_date: string;
  end_date: string;
  dsa_details?: DSADetailInput[];
}

// ============================================================
// Medical Expense Claims
// ============================================================

export interface MedicalClaim extends BaseEntity {
  s_no: number | null;
  officer_name: string;
  claim_amount: number;
  date_forwarded_dhr: string | null;
  status: Status;
  remarks: string | null;
}

export interface CreateMedicalClaimInput {
  officer_name: string;
  claim_amount: number;
  date_forwarded_dhr?: string;
  status?: Status;
  remarks?: string;
}

// ============================================================
// Legacy General Request (backward compatibility)
// ============================================================

/**
 * @deprecated Use the new GeneralRequest with request_type instead
 */
export interface LegacyGeneralRequest extends BaseEntity {
  s_no: number | null;
  ticket_number: string | null;
  judge_name: string;
  request: string;
  date_received: string | null;
  officer_assigned: string | null;
  status: Status;
  remarks: string | null;
}

/**
 * @deprecated Use CreateGeneralRequestInput with request_type instead
 */
export interface CreateLegacyGeneralRequestInput {
  judge_name: string;
  request: string;
  date_received?: string;
  officer_assigned?: string;
  status?: Status;
  remarks?: string;
  email?: string;
  send_email?: boolean;
}

// ============================================================
// Visa Support
// ============================================================

export interface VisaRequest extends BaseEntity {
  s_no: number | null;
  judge_name: string;
  destination_country: string;
  date_of_travel: string | null;
  date_of_return: string | null;
  visa_type: VisaType;
  purpose_of_travel: string | null;
  remarks: string | null;
  status: Status;
  notes: string | null;
  documents?: VisaDocument[];
}

export interface VisaDocument extends BaseEntity {
  visa_request_id: string;
  document_name: string;
  document_url: string;
  viewed_at: string | null;
  view_count: number;
}

export interface CreateVisaRequestInput {
  judge_name: string;
  destination_country: string;
  date_of_travel?: string;
  request_date?: string;
  date_of_return?: string;
  visa_type: VisaType;
  purpose_of_travel?: string;
  remarks?: string;
  notes?: string;
}

// ============================================================
// Protocol Support
// ============================================================

export interface ProtocolEvent extends BaseEntity, BaseDSAAware {
  s_no: number | null;
  activity: string;
  period_from: string | null;
  period_to: string | null;
  officers_assigned: string | null;
  remarks: string | null;
  status: Status;
  notes: string | null;
  dsa_required: boolean;
}

export interface CreateProtocolEventInput {
  activity: string;
  period_from?: string;
  period_to?: string;
  officers_assigned?: string;
  remarks?: string;
  notes?: string;
  dsa_required?: boolean;
  dsa_details?: DSADetailInput[];
}

// ============================================================
// Reports
// ============================================================

export interface DSAReportRow {
  module: ReportModule;
  parent_id: string;
  dsa_detail_id: string;
  activity: string;
  parent_status: Status;
  judge_name: string;
  pj_number: string;
  designation: string | null;
  date_of_request: string | null;
  date_of_ticket_facilitation: string | null;
  date_of_conference_facilitation: string | null;
  travel_date: string | null;
  travel_back: string | null;
  dsa_per_day: number;
  days: number;
  total: number;
  requisition_number: string | null;
  requisition_initiation_date: string | null;
  payment_status: DSAPaymentStatus;
}

export interface DSAReportFilters {
  modules?: ReportModule[];
  judge_name?: string;
  payment_status?: DSAPaymentStatus;
  travel_start?: string;
  travel_end?: string;
  limit?: number;
  offset?: number;
}

// ============================================================
// Audit & Stats
// ============================================================

export interface HelpDeskAuditEntry extends BaseEntity {
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

// ============================================================
// Filters
// ============================================================

export interface HelpDeskFilters {
  search?: string;
  status?: Status;
  judge_name?: string;
  request_type?: RequestType;
  remark_type?: RemarkType;
  start_date?: string;
  end_date?: string;
  limit?: number;
  offset?: number;
  category?: GeneralRequestCategory;
}

export interface UpdateStatusInput {
  status: Status;
  notes?: string;
  remarks?: string;
  email?: string;           // Add email for notifications
  resolvedBy?: string;      // Who resolved the request
  rejectedBy?: string;      // Who rejected the request
}

// ============================================================
// Document Tracking
// ============================================================

export interface DocumentView {
  id: string;
  document_id: string;
  document_type: string;
  viewer_id: string;
  viewer_name: string;
  viewed_at: string;
  ip_address: string | null;
  user_agent: string | null;
}

export interface DocumentWithViewStatus {
  id: string;
  document_name: string;
  document_url: string;
  created_at: string;
  viewed_at: string | null;
  view_count: number;
  last_viewed_by: string | null;
  last_viewed_at: string | null;
  viewers: DocumentView[];
}

// ============================================================
// Type Guards
// ============================================================

export function isGeneralRequest(obj: unknown): obj is GeneralRequest {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'request_type' in obj &&
    'judge_name' in obj &&
    'request' in obj
  );
}

export function isSecurityRequest(obj: unknown): obj is SecurityRequest {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'request_type' in obj &&
    'judge_name' in obj
  );
}

export function isRequestType(value: string): value is RequestType {
  return [
    'Driver',
    'Bodyguard',
    'Firearm',
    'Current Station',
    'Force Number',
    'Residence Security',
    'Sentry'
  ].includes(value);
}

export function isRemarkType(value: string): value is RemarkType {
  return ['Onboarding', 'Release'].includes(value);
}

export function isGeneralRequestCategory(value: string): value is GeneralRequestCategory {
  return ['Security', 'Personnel', 'Administrative'].includes(value);
}