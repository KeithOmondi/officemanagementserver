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

// ─── NEW: Consolidated Memo Types ─────────────────────────────────────────────
export type ConsolidatedMemoType = 'all' | 'fuel';

// ─── NEW: Document Entity Types (for helpdesk documents) ────────────────────
/**
 * All possible entity types that can have documents attached.
 * This is used in the helpdeskDocumentsSlice and the backend.
 */
export type DocumentEntityType =
  | 'circuit'
  | 'bench'
  | 'partHeard'
  | 'serviceWeek'
  | 'otherPayment'
  | 'ticket'
  | 'medicalClaim'
  | 'generalRequest'
  | 'securityRequest'      // Deprecated, kept for backward compatibility
  | 'visa'
  | 'protocol'
  | 'club'
  | 'utility_memo'         // Single judge utility memo
  | 'consolidated_utility_memo'   // Consolidated memo covering all utilities
  | 'consolidated_fuel_memo'      // Consolidated memo covering fuel only
  | 'aide'
  | 'sentry';

// ─── NEW: Consolidated Memo Helpers ──────────────────────────────────────────

/**
 * Generates a stable, human-readable entity ID for a consolidated memo.
 * Format: "cons-{type}-{YYYY-MM}" e.g., "cons-all-2026-07"
 *
 * @param type - 'all' for all utilities, 'fuel' for fuel-only
 * @param date - optional Date object (defaults to now)
 * @returns entity ID string
 */
export function getConsolidatedMemoEntityId(
  type: ConsolidatedMemoType,
  date: Date = new Date()
): string {
  const month = date.toISOString().slice(0, 7); // YYYY-MM
  return `cons-${type}-${month}`;
}

/**
 * Returns the appropriate DocumentEntityType for a consolidated memo.
 *
 * @param type - 'all' or 'fuel'
 * @returns DocumentEntityType
 */
export function getConsolidatedMemoEntityType(
  type: ConsolidatedMemoType
): DocumentEntityType {
  return type === 'fuel' ? 'consolidated_fuel_memo' : 'consolidated_utility_memo';
}

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
  pj_number: string | null;
  judge_name: string;
  items: UtilityItem[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Utility Inputs ───────────────────────────────────────────────────────────

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

/**
 * Create a new utility record - PJ number is REQUIRED
 * Used when adding a new judge's utility record to the system
 */
export interface CreateUtilityInput {
  pj_number: string;          // REQUIRED - Cannot create utility without PJ number
  judge_name: string;
  items: UtilityItemInput[];
}

/**
 * Add a utility item to an existing utility record - PJ number is REQUIRED
 * Used when adding a new utility item (Electricity, Water, etc.) for an existing judge
 */
export interface AddUtilityItemInput {
  pj_number: string;          // REQUIRED - Identifies which judge's utility record to update
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

/**
 * Update an existing utility item - uses item ID to identify the specific item
 * PJ number is NOT required here as we use the item ID directly
 */
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

/**
 * Update the main utility record (judge name or PJ number)
 * Both fields are optional since you might only update one
 */
export interface UpdateUtilityInput {
  pj_number?: string;         // Optional - only provide if changing PJ number
  judge_name?: string;        // Optional - only provide if changing judge name
}

/**
 * Delete a utility item - uses item ID directly
 * No PJ number needed as we use the item ID
 */
export interface DeleteUtilityItemInput {
  item_id: string;            // Direct reference to the utility item to delete
}

/**
 * Delete an entire utility record - uses the utility record ID
 * No PJ number needed as we use the record ID
 */
export interface DeleteUtilityInput {
  utility_id: string;         // Direct reference to the utility record to delete
}

export interface UtilityFilters {
  search?: string;
  pj_number?: string;
  judge_name?: string;
  status?: UtilityStatus;
  limit?: number;
  offset?: number;
}

// ─── Utility Validation Helpers ──────────────────────────────────────────────

/**
 * Validates that a utility operation has the required PJ number
 * @throws Error if PJ number is missing
 */
export function validatePjNumber(pj_number: string | null | undefined, operation: string): void {
  if (!pj_number || pj_number.trim() === '') {
    throw new Error(`PJ number is required for ${operation}`);
  }
}

/**
 * Validates CreateUtilityInput
 */
export function validateCreateUtilityInput(input: CreateUtilityInput): void {
  validatePjNumber(input.pj_number, 'creating a utility record');
  if (!input.judge_name || input.judge_name.trim() === '') {
    throw new Error('Judge name is required');
  }
  if (!input.items || input.items.length === 0) {
    throw new Error('At least one utility item is required');
  }
  // Validate each item
  input.items.forEach((item, index) => {
    if (!item.utility_type) {
      throw new Error(`Item ${index + 1}: Utility type is required`);
    }
    if (item.amount <= 0) {
      throw new Error(`Item ${index + 1}: Amount must be greater than 0`);
    }
    if (!item.period || item.period.trim() === '') {
      throw new Error(`Item ${index + 1}: Period is required`);
    }
  });
}

/**
 * Validates AddUtilityItemInput
 */
export function validateAddUtilityItemInput(input: AddUtilityItemInput): void {
  validatePjNumber(input.pj_number, 'adding a utility item');
  if (!input.utility_type) {
    throw new Error('Utility type is required');
  }
  if (input.amount <= 0) {
    throw new Error('Amount must be greater than 0');
  }
  if (!input.period || input.period.trim() === '') {
    throw new Error('Period is required');
  }
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
  judge_name: string;                    // Requester name
  request: string;                       // Details of request
  request_type: string;                  // Type of request - FREE TEXT
  category: GeneralRequestCategory;      // High-level categorization
  status: Status;
  remarks: string | null;                // Marks/remarks
  request_date: string | null;           // Request date
  date_received: string | null;
  officer_assigned: string | null;
  remark_type: RemarkType | null;
}

export interface CreateGeneralRequestInput {
  judge_name: string;                    // Requester name
  request: string;                       // Details of request
  request_type: string;                  // Type of request - FREE TEXT
  category?: GeneralRequestCategory;
  status?: Status;
  remarks?: string;                      // Marks/remarks
  request_date?: string;                 // Request date
  date_received?: string;
  officer_assigned?: string;
  remark_type?: RemarkType;
  email?: string;
  send_email?: boolean;
}

export interface UpdateGeneralRequestInput {
  judge_name?: string;                   // Requester name
  request?: string;                      // Details of request
  request_type?: string;                 // Type of request - FREE TEXT
  category?: GeneralRequestCategory;
  status?: Status;
  remarks?: string;                      // Marks/remarks
  request_date?: string;                 // Request date
  date_received?: string;
  officer_assigned?: string;
  remark_type?: RemarkType;
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
// Protocol Support - UPDATED with venue/location
// ============================================================

export interface ProtocolEvent extends BaseEntity, BaseDSAAware {
  s_no: number | null;
  activity: string;                    // Main activity/event name
  venue: string | null;               // NEW: Venue/Location of the protocol event
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
  venue?: string;                     // NEW: Venue/Location
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
  request_type?: string;        // FREE TEXT - changed from RequestType
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
// Email Notification Types for Helpdesk
// ============================================================

/**
 * Options for sending General Request emails (Acknowledgement & Status Update)
 */
export interface GeneralRequestEmailOptions {
  to: string;
  ticketNumber: string;
  judgeName: string;
  request: string;
  requestType?: string;
  status: string;
  remarks?: string;
  requestDate?: string;
}

/**
 * Options for sending Helpdesk Document Approved email
 */
export interface HelpdeskDocumentEmailOptions {
  to: string;
  requesterName: string;
  ref: string;
  subject: string;
  entityType: string;
  approvedBy: string;
  approvedAt: Date;
  comments?: string;
  documentUrl?: string;
}

/**
 * Options for sending Utility Memo notification
 */
export interface UtilityMemoEmailOptions {
  to: string;
  judgeName: string;
  ref: string;
  utilityType: string;
  amount: number;
  period: string;
  status: string;
  submittedBy: string;
  submittedAt: Date;
}

/**
 * Options for sending DSA Memo notification
 */
export interface DSAMemoEmailOptions {
  to: string;
  judgeName: string;
  ref: string;
  moduleType: 'Circuit' | 'Bench' | 'Part-Heard' | 'Service Week' | 'Other Payment';
  activityName: string;
  startDate: string;
  endDate: string;
  totalDSA: number;
  memberCount: number;
  status: string;
  submittedBy: string;
  submittedAt: Date;
  memoUrl?: string;
}

/**
 * Options for sending Medical Claim notification
 */
export interface MedicalClaimEmailOptions {
  to: string;
  officerName: string;
  ref: string;
  claimAmount: number;
  dateForwarded: string;
  status: string;
  remarks?: string;
  submittedBy: string;
  submittedAt: Date;
}

/**
 * Options for sending Visa Request notification
 */
export interface VisaRequestEmailOptions {
  to: string;
  judgeName: string;
  ref: string;
  destinationCountry: string;
  dateOfTravel: string;
  dateOfReturn: string;
  visaType: string;
  purposeOfTravel?: string;
  status: string;
  remarks?: string;
  submittedBy: string;
  submittedAt: Date;
}

/**
 * Options for sending Protocol Event notification
 */
export interface ProtocolEventEmailOptions {
  to: string;
  activity: string;
  ref: string;
  venue?: string;
  periodFrom: string;
  periodTo: string;
  officersAssigned?: string;
  dsaRequired: boolean;
  totalDSA: number;
  memberCount: number;
  status: string;
  remarks?: string;
  submittedBy: string;
  submittedAt: Date;
}

/**
 * Options for sending Club Membership notification
 */
export interface ClubMembershipEmailOptions {
  to: string;
  judgeName: string;
  ref: string;
  clubName: string;
  entryFee: number;
  annualFee: number;
  court?: string;
  status: string;
  remarks?: string;
  submittedBy: string;
  submittedAt: Date;
}

// ============================================================
// Document Notification Types (for emailTemplates)
// ============================================================

export interface DocumentNotificationData {
  documentTitle: string;
  documentId: string;
  referenceNo?: string | null;
  markedBy: string;
  markedByDepartment: string;
  assignedTo: string;
  instructions?: string | null;
  priority?: 'low' | 'normal' | 'urgent';
  actionType: 'marked_to_department' | 'assigned_to_user' | 'sent_to_super_admin';
  createdAt: Date;
  documentType: string;
  departmentName: string;
  superAdminName?: string;
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

export function isProtocolEvent(obj: unknown): obj is ProtocolEvent {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'activity' in obj &&
    'venue' in obj &&
    'dsa_required' in obj
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

// ============================================================
// Utility Type Guards
// ============================================================

export function isUtilityType(value: string): value is UtilityType {
  return ['Electricity', 'Water', 'Internet', 'Fuel', 'Other'].includes(value);
}

export function isUtilityStatus(value: string): value is UtilityStatus {
  return [
    'Awaiting',
    'Awaiting Documentation',
    'Awaiting Funding',
    'In Process',
    'Approved',
    'Paid',
    'Payment NA'
  ].includes(value);
}