// ============================================================
// Utility-Specific Types
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

// ─── Approval Status for Utility Items ────────────────────
export type UtilityApprovalStatus = 
  | 'pending'      // Not yet included in any memo
  | 'sent'         // Included in a memo that has been sent for approval
  | 'approved'     // The memo was approved
  | 'rejected';    // The memo was rejected (item can be resent)

// ─── Memo Status ─────────────────────────────────────────
export type MemoStatus = 
  | 'draft'        // Being prepared, not sent yet
  | 'sent'         // Sent for approval
  | 'approved'     // Approved
  | 'rejected'     // Rejected
  | 'cancelled';   // Cancelled/withdrawn

// ─── Consolidated Memo Types ─────────────────────────────────────────────
export type ConsolidatedMemoType = 'all' | 'fuel';

// ─── Document Entity Types ──────────────────────────────────────────────
export type DocumentEntityType =
  | 'circuit'
  | 'bench'
  | 'partHeard'
  | 'serviceWeek'
  | 'otherPayment'
  | 'ticket'
  | 'medicalClaim'
  | 'generalRequest'
  | 'securityRequest'
  | 'visa'
  | 'protocol'
  | 'club'
  | 'utility_memo'
  | 'consolidated_utility_memo'
  | 'consolidated_fuel_memo'
  | 'aide'
  | 'sentry';

// ─── Core Models ──────────────────────────────────────────────────────────

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
  
  // ─── NEW FIELDS ─────────────────────────────────────────────
  approval_status: UtilityApprovalStatus;
  memo_id: string | null;
  memo_sent_at: string | null;
  
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

export interface ConsolidatedMemo {
  id: string;
  type: ConsolidatedMemoType;
  entity_id: string;
  title: string;
  period: string;
  generated_at: string;
  sent_at: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  status: MemoStatus;
  utility_item_ids: string[];
  total_amount: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Input Types ──────────────────────────────────────────────────────────

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
  approval_status?: UtilityApprovalStatus;
};

export interface CreateUtilityInput {
  pj_number: string;
  judge_name: string;
  items: UtilityItemInput[];
}

export interface AddUtilityItemInput {
  pj_number: string;
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
  approval_status?: UtilityApprovalStatus;
  memo_id?: string | null;
}

export interface UpdateUtilityInput {
  pj_number?: string;
  judge_name?: string;
}

export interface DeleteUtilityItemInput {
  item_id: string;
}

export interface DeleteUtilityInput {
  utility_id: string;
}

export interface UtilityFilters {
  search?: string;
  pj_number?: string;
  judge_name?: string;
  status?: UtilityStatus;
  approval_status?: UtilityApprovalStatus;
  period?: string;
  limit?: number;
  offset?: number;
}

export interface GenerateMemoInput {
  type: ConsolidatedMemoType;
  period: string;
  utility_item_ids: string[];
  title?: string;
}

export interface MemoFilters {
  period?: string;
  type?: ConsolidatedMemoType;
  status?: MemoStatus;
  limit?: number;
  offset?: number;
}

// ─── Helper Functions ─────────────────────────────────────────────────

export function getConsolidatedMemoEntityId(
  type: ConsolidatedMemoType,
  date: Date = new Date()
): string {
  const month = date.toISOString().slice(0, 7);
  return `cons-${type}-${month}`;
}

export function getConsolidatedMemoEntityType(
  type: ConsolidatedMemoType
): DocumentEntityType {
  return type === 'fuel' ? 'consolidated_fuel_memo' : 'consolidated_utility_memo';
}

export function canIncludeInMemo(item: UtilityItem): boolean {
  return item.approval_status === 'pending';
}

export function isSentForApproval(item: UtilityItem): boolean {
  return ['sent', 'approved', 'rejected'].includes(item.approval_status);
}

export function getPendingItems(items: UtilityItem[]): UtilityItem[] {
  return items.filter(item => item.approval_status === 'pending');
}

export function getSentItems(items: UtilityItem[]): UtilityItem[] {
  return items.filter(item => item.approval_status === 'sent' || item.approval_status === 'approved');
}

export function getRejectedItems(items: UtilityItem[]): UtilityItem[] {
  return items.filter(item => item.approval_status === 'rejected');
}

export function groupItemsByPeriod(items: UtilityItem[]): Record<string, UtilityItem[]> {
  return items.reduce((groups, item) => {
    const period = item.period || 'Unknown';
    if (!groups[period]) {
      groups[period] = [];
    }
    groups[period].push(item);
    return groups;
  }, {} as Record<string, UtilityItem[]>);
}

export function getAvailablePeriods(items: UtilityItem[]): string[] {
  const pendingItems = getPendingItems(items);
  const periods = new Set(pendingItems.map(item => item.period).filter(Boolean));
  return Array.from(periods).sort();
}

export function getItemsByApprovalStatus(items: UtilityItem[]): Record<UtilityApprovalStatus, UtilityItem[]> {
  return {
    pending: items.filter(item => item.approval_status === 'pending'),
    sent: items.filter(item => item.approval_status === 'sent'),
    approved: items.filter(item => item.approval_status === 'approved'),
    rejected: items.filter(item => item.approval_status === 'rejected'),
  };
}

export function getPendingTotalByPeriod(items: UtilityItem[], period: string): number {
  return items
    .filter(item => item.approval_status === 'pending' && item.period === period)
    .reduce((sum, item) => sum + item.amount, 0);
}

export function getMemoTotal(items: UtilityItem[], memoId: string): number {
  return items
    .filter(item => item.memo_id === memoId)
    .reduce((sum, item) => sum + item.amount, 0);
}

// ─── Validation Helpers ─────────────────────────────────────────────────

export function validatePjNumber(pj_number: string | null | undefined, operation: string): void {
  if (!pj_number || pj_number.trim() === '') {
    throw new Error(`PJ number is required for ${operation}`);
  }
}

export function validateCreateUtilityInput(input: CreateUtilityInput): void {
  validatePjNumber(input.pj_number, 'creating a utility record');
  if (!input.judge_name || input.judge_name.trim() === '') {
    throw new Error('Judge name is required');
  }
  if (!input.items || input.items.length === 0) {
    throw new Error('At least one utility item is required');
  }
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

export function validateGenerateMemoInput(input: GenerateMemoInput): void {
  if (!input.type) {
    throw new Error('Memo type is required');
  }
  if (!input.period || input.period.trim() === '') {
    throw new Error('Period is required');
  }
  if (!input.utility_item_ids || input.utility_item_ids.length === 0) {
    throw new Error('At least one utility item must be selected');
  }
}

// ─── Type Guards ─────────────────────────────────────────────────────────

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

export function isUtilityApprovalStatus(value: string): value is UtilityApprovalStatus {
  return ['pending', 'sent', 'approved', 'rejected'].includes(value);
}

export function isMemoStatus(value: string): value is MemoStatus {
  return ['draft', 'sent', 'approved', 'rejected', 'cancelled'].includes(value);
}

export function isConsolidatedMemoType(value: string): value is ConsolidatedMemoType {
  return ['all', 'fuel'].includes(value);
}