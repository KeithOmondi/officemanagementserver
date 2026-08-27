// src/features/helpdesk/utilities.validator.ts

import { z } from 'zod';

// ============================================================
// Core Enums - MUST MATCH utilities.types.ts
// ============================================================

export const utilityTypeEnum = z.enum(['Electricity', 'Water', 'Internet', 'Fuel', 'Other']);

export const utilityStatusEnum = z.enum([
  'Awaiting',
  'Awaiting Documentation',
  'Awaiting Funding',
  'In Process',
  'Approved',
  'Paid',
  'Payment NA',
]);

// ─── UPDATED: Added 'in_memo' ──────────────────────────────────────────────
export const utilityApprovalStatusEnum = z.enum([
  'pending',
  'in_memo',     // Currently in a draft memo
  'sent',
  'approved',
  'rejected',
]);

export const memoStatusEnum = z.enum([
  'draft',
  'sent',
  'approved',
  'rejected',
  'cancelled',
]);

export const consolidatedMemoTypeEnum = z.enum(['all', 'fuel']);

// ─── NEW: Document status enum for sync ────────────────────────────────────
export const documentStatusEnum = z.enum([
  'draft',
  'pending_approval',
  'approved',
  'rejected',
  'returned',
]);

// ─── NEW: Document sync status enum ────────────────────────────────────────
export const documentSyncStatusEnum = z.enum([
  'pending',
  'synced',
  'failed',
  'not_applicable',
]);

// ─── Date Schema ─────────────────────────────────────────────────────────

export const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');

// ============================================================
// Helper Functions - MUST MATCH utilities.types.ts
// ============================================================

export function getConsolidatedMemoEntityId(
  type: 'all' | 'fuel',
  date: Date = new Date()
): string {
  const month = date.toISOString().slice(0, 7);
  return `cons-${type}-${month}`;
}

export function getConsolidatedMemoEntityType(
  type: 'all' | 'fuel'
): string {
  return type === 'fuel' ? 'consolidated_fuel_memo' : 'consolidated_utility_memo';
}

// ============================================================
// Utility Item Schemas
// ============================================================

const utilityItemSchema = z.object({
  utility_type: utilityTypeEnum,
  requisition_number: z.string().optional(),
  amount: z.number().min(0),
  period: z.string().min(1).max(50),
  description: z.string().optional(),
  date_received: dateStringSchema.optional(),
  date_forwarded_dass: dateStringSchema.optional(),
  date_paid: dateStringSchema.optional(),
  status: utilityStatusEnum.optional(),
  approval_status: utilityApprovalStatusEnum.optional().default('pending'),
});

// ============================================================
// Create Utility Schemas
// ============================================================

export const createUtilitySchema = z.object({
  body: z.object({
    pj_number: z.string().min(1, 'PJ number is required to create a utility record'),
    judge_name: z.string().min(1).max(100),
    items: z.array(utilityItemSchema).min(1, 'At least one utility item is required'),
  }).strict(),
});

export const addUtilityItemSchema = z.object({
  body: z.object({
    pj_number: z.string().min(1, 'PJ number is required to add a utility item'),
    utility_type: utilityTypeEnum,
    requisition_number: z.string().optional(),
    amount: z.number().min(0),
    period: z.string().min(1).max(50),
    description: z.string().optional(),
    date_received: dateStringSchema.optional(),
    date_forwarded_dass: dateStringSchema.optional(),
    date_paid: dateStringSchema.optional(),
    status: utilityStatusEnum.optional(),
    approval_status: utilityApprovalStatusEnum.optional().default('pending'),
  }).strict(),
});

// ============================================================
// Update Utility Schemas
// ============================================================

export const updateUtilityItemSchema = z.object({
  body: z.object({
    status: utilityStatusEnum.optional(),
    date_received: dateStringSchema.optional(),
    date_forwarded_dass: dateStringSchema.optional(),
    date_paid: dateStringSchema.optional(),
    amount: z.number().min(0).optional(),
    period: z.string().min(1).max(50).optional(),
    description: z.string().optional(),
    utility_type: utilityTypeEnum.optional(),
    requisition_number: z.string().optional(),
    approval_status: utilityApprovalStatusEnum.optional(),
    memo_id: z.string().uuid('Memo ID must be a valid UUID').nullable().optional(),
    // ─── NEW: Document sync fields ──────────────────────────────────────────
    document_sync_status: documentSyncStatusEnum.optional(),
    last_document_id: z.string().uuid('Document ID must be a valid UUID').nullable().optional(),
    last_document_status: documentStatusEnum.nullable().optional(),
  }).strict(),
});

export const updateUtilitySchema = z.object({
  body: z.object({
    pj_number: z.string().optional(),
    judge_name: z.string().min(1).max(100).optional(),
  }).strict()
  .refine(
    (data) => data.pj_number !== undefined || data.judge_name !== undefined,
    {
      message: 'At least one field (pj_number or judge_name) must be provided for update',
      path: ['body'],
    }
  ),
});

// ============================================================
// Delete Utility Schemas
// ============================================================

export const deleteUtilityItemSchema = z.object({
  params: z.object({
    itemId: z.string().uuid('Item ID must be a valid UUID'),
  }),
});

export const deleteUtilitySchema = z.object({
  params: z.object({
    id: z.string().uuid('Utility ID must be a valid UUID'),
  }),
});

// ============================================================
// Filter Schemas
// ============================================================

export const utilityFiltersSchema = z.object({
  query: z.object({
    search: z.string().optional(),
    pj_number: z.string().optional(),
    judge_name: z.string().optional(),
    status: utilityStatusEnum.optional(),
    approval_status: utilityApprovalStatusEnum.optional(),
    period: z.string().optional(),
    // ─── NEW: Document sync filters ──────────────────────────────────────────
    document_sync_status: documentSyncStatusEnum.optional(),
    has_document: z.string().regex(/^(true|false)$/).optional().transform(val => val === 'true'),
    limit: z.string().regex(/^\d+$/).optional().transform(Number),
    offset: z.string().regex(/^\d+$/).optional().transform(Number),
  }).strict(),
});

// ============================================================
// Consolidated Memo Schemas
// ============================================================

export const generateMemoSchema = z.object({
  body: z.object({
    type: consolidatedMemoTypeEnum,
    period: z.string().min(1).max(50),
    utility_item_ids: z.array(z.string().uuid('Each item ID must be a valid UUID'))
      .min(1, 'At least one utility item must be selected'),
    title: z.string().max(255).optional(),
    // ─── NEW: Exclude items that already have documents ──────────────────────
    exclude_items_with_documents: z.boolean().optional().default(true),
  }).strict(),
});

export const sendMemoForApprovalSchema = z.object({
  params: z.object({
    id: z.string().uuid('Memo ID must be a valid UUID'),
  }),
});

export const updateMemoStatusSchema = z.object({
  params: z.object({
    id: z.string().uuid('Memo ID must be a valid UUID'),
  }),
  body: z.object({
    status: memoStatusEnum,
    notes: z.string().optional(),
    approved_by: z.string().optional(),
    rejected_by: z.string().optional(),
  }).strict(),
});

export const memoFiltersSchema = z.object({
  query: z.object({
    period: z.string().optional(),
    type: consolidatedMemoTypeEnum.optional(),
    status: memoStatusEnum.optional(),
    // ─── NEW: Document filters for memos ──────────────────────────────────────
    has_document: z.string().regex(/^(true|false)$/).optional().transform(val => val === 'true'),
    document_status: documentStatusEnum.optional(),
    limit: z.string().regex(/^\d+$/).optional().transform(Number),
    offset: z.string().regex(/^\d+$/).optional().transform(Number),
  }).strict(),
});

// ============================================================
// Utility Status Query Schemas
// ============================================================

export const getPendingUtilitiesSchema = z.object({
  query: z.object({
    period: z.string().optional(),
    utility_type: utilityTypeEnum.optional(),
    judge_name: z.string().optional(),
    pj_number: z.string().optional(),
    limit: z.string().regex(/^\d+$/).optional().transform(Number),
    offset: z.string().regex(/^\d+$/).optional().transform(Number),
  }).strict(),
});

export const getUtilitiesByApprovalStatusSchema = z.object({
  query: z.object({
    approval_status: utilityApprovalStatusEnum,
    period: z.string().optional(),
    utility_type: utilityTypeEnum.optional(),
    judge_name: z.string().optional(),
    limit: z.string().regex(/^\d+$/).optional().transform(Number),
    offset: z.string().regex(/^\d+$/).optional().transform(Number),
  }).strict(),
});

// ============================================================
// ─── NEW: Document Sync Schemas ──────────────────────────────────────────────
// ============================================================

export const syncUtilitiesWithDocumentSchema = z.object({
  body: z.object({
    memo_id: z.string().uuid('Memo ID must be a valid UUID'),
    document_status: documentStatusEnum,
    document_id: z.string().uuid('Document ID must be a valid UUID'),
    document_ref: z.string().min(1, 'Document reference is required'),
    document_entity_type: z.enum(['consolidated_utility_memo', 'consolidated_fuel_memo']),
    document_entity_id: z.string().min(1, 'Document entity ID is required'),
  }).strict(),
});

// ─── NEW: Check items availability for memo ──────────────────────────────────

export const checkMemoAvailabilitySchema = z.object({
  query: z.object({
    period: z.string().min(1).max(50),
    utility_type: utilityTypeEnum.optional(),
    exclude_with_documents: z.string().regex(/^(true|false)$/).optional().transform(val => val === 'true'),
  }).strict(),
});

// ─── NEW: Get items with document status ────────────────────────────────────

export const getItemsWithDocumentStatusSchema = z.object({
  query: z.object({
    document_status: documentStatusEnum.optional(),
    period: z.string().optional(),
    utility_type: utilityTypeEnum.optional(),
    limit: z.string().regex(/^\d+$/).optional().transform(Number),
    offset: z.string().regex(/^\d+$/).optional().transform(Number),
  }).strict(),
});

// ============================================================
// Bulk Operations Schemas
// ============================================================

export const bulkUpdateUtilityItemsSchema = z.object({
  body: z.object({
    item_ids: z.array(z.string().uuid('Each item ID must be a valid UUID'))
      .min(1, 'At least one item must be selected'),
    approval_status: utilityApprovalStatusEnum,
    memo_id: z.string().uuid('Memo ID must be a valid UUID').nullable().optional(),
  }).strict(),
});

export const memoSummarySchema = z.object({
  query: z.object({
    period: z.string().optional(),
  }).strict(),
});

// ============================================================
// Path Parameter Schemas
// ============================================================

export const utilityItemIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Request ID must be a valid UUID'),
    itemId: z.string().uuid('Item ID must be a valid UUID'),
  }),
});

export const memoIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Memo ID must be a valid UUID'),
  }),
});

// ============================================================
// Type Exports - INFER from Zod schemas
// ============================================================

// Utility Types
export type CreateUtilityInput = z.infer<typeof createUtilitySchema>['body'];
export type AddUtilityItemInput = z.infer<typeof addUtilityItemSchema>['body'];
export type UpdateUtilityItemInput = z.infer<typeof updateUtilityItemSchema>['body'];
export type UpdateUtilityInput = z.infer<typeof updateUtilitySchema>['body'];
export type DeleteUtilityItemInput = z.infer<typeof deleteUtilityItemSchema>['params'];
export type DeleteUtilityInput = z.infer<typeof deleteUtilitySchema>['params'];
export type UtilityFilters = z.infer<typeof utilityFiltersSchema>['query'];

// Memo Types
export type GenerateMemoInput = z.infer<typeof generateMemoSchema>['body'];
export type SendMemoForApprovalInput = z.infer<typeof sendMemoForApprovalSchema>['params'];
export type UpdateMemoStatusInput = z.infer<typeof updateMemoStatusSchema>['body'];
export type MemoFilters = z.infer<typeof memoFiltersSchema>['query'];
export type MemoSummaryInput = z.infer<typeof memoSummarySchema>['query'];

// Utility Status Query Types
export type GetPendingUtilitiesInput = z.infer<typeof getPendingUtilitiesSchema>['query'];
export type GetUtilitiesByApprovalStatusInput = z.infer<typeof getUtilitiesByApprovalStatusSchema>['query'];
export type BulkUpdateUtilityItemsInput = z.infer<typeof bulkUpdateUtilityItemsSchema>['body'];

// ─── NEW: Document Sync Types ────────────────────────────────────────────────
export type SyncUtilitiesWithDocumentInput = z.infer<typeof syncUtilitiesWithDocumentSchema>['body'];
export type CheckMemoAvailabilityInput = z.infer<typeof checkMemoAvailabilitySchema>['query'];
export type GetItemsWithDocumentStatusInput = z.infer<typeof getItemsWithDocumentStatusSchema>['query'];

// Path Parameter Types
export type UtilityItemIdInput = z.infer<typeof utilityItemIdSchema>['params'];
export type MemoIdInput = z.infer<typeof memoIdSchema>['params'];

// ─── NEW: Export enums ──────────────────────────────────────────────────────
