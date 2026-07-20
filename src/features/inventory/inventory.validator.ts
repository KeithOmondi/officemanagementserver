import { z } from 'zod';

// ─── Common Schemas ──────────────────────────────────────────────────────────

// Procurement request status – now includes 'Submitted'
const procurementStatusSchema = z.enum(['Pending', 'Submitted', 'Approved', 'Rejected']);

// Store request status – full lifecycle
const storeStatusSchema = z.enum(['Pending', 'Approved', 'Issued', 'Received', 'Rejected']);

const urgencySchema = z.enum(['Normal', 'Urgent', 'Critical']);

// We'll use UUID for category references (categories table will be separate)
const categoryIdSchema = z.string().uuid('Invalid category ID');

// ─── Inventory Item Schemas ─────────────────────────────────────────────────

export const createInventoryItemSchema = z.object({
    body: z.object({
        name: z.string().min(1).max(255).trim(),
        subtitle: z.string().optional(),
        category_id: categoryIdSchema,
        qty_available: z.number().int().min(0).default(0),
        unit: z.string().min(1).max(50),
        location: z.string().optional(),
        min_stock_threshold: z.number().int().min(0).default(5),
    }).strict(),
});

export const updateInventoryItemSchema = z.object({
    body: z.object({
        name: z.string().min(1).max(255).trim().optional(),
        subtitle: z.string().nullable().optional(),
        category_id: categoryIdSchema.optional(),
        qty_available: z.number().int().min(0).optional(),
        unit: z.string().min(1).max(50).optional(),
        location: z.string().nullable().optional(),
        min_stock_threshold: z.number().int().min(0).optional(),
        is_active: z.boolean().optional(),
    }).strict().refine(
        (data) => Object.keys(data).length > 0,
        { message: 'At least one field must be provided' }
    ),
});

// ─── Store Request Schemas ───────────────────────────────────────────────────

export const createStoreRequestSchema = z.object({
    body: z.object({
        item_name: z.string().min(1).max(255).trim(),
        quantity: z.number().int().min(1),
        unit: z.string().min(1).max(50).optional(),
        reason: z.string().min(1, 'A reason for the request is required').max(500, 'Reason must be less than 500 characters'),
    }).strict(),
});

export const updateStoreRequestSchema = z.object({
    body: z.object({
        status: z.enum(['Approved', 'Rejected']).optional(),
        rejection_reason: z.string().optional(),
    }).strict().refine(
        (data) => Object.keys(data).length > 0,
        { message: 'At least one field must be provided' }
    ),
});

export const issueStoreRequestSchema = z.object({
    body: z.object({}).strict().optional(),
});

export const receiveStoreRequestSchema = z.object({
    body: z.object({}).strict().optional(),
});

// ─── Procurement Request Schemas ─────────────────────────────────────────────

export const createProcurementRequestSchema = z.object({
    body: z.object({
        item_name: z.string().min(1).max(255).trim(),
        category_id: categoryIdSchema,
        quantity: z.number().int().min(1),
        unit: z.string().min(1).max(50),
        estimated_unit_cost: z.number().min(0).optional(),
        justification: z.string().min(1),
        urgency: urgencySchema.default('Normal'),
        is_restock: z.boolean().default(false),
        inventory_item_id: z.string().uuid().optional(),
    }).strict(),
});

export const updateProcurementRequestSchema = z.object({
    body: z.object({
        status: procurementStatusSchema.optional(),
        rejection_reason: z.string().optional(),
        estimated_unit_cost: z.number().min(0).optional(),
    }).strict().refine(
        (data) => Object.keys(data).length > 0,
        { message: 'At least one field must be provided' }
    ),
});

// ─── Procurement Memo Submission Schema ──────────────────────────────────────

export const submitProcurementMemoSchema = z.object({
    body: z.object({
        to: z.string().min(1).max(255),
        from: z.string().min(1).max(255),
        ref: z.string().min(1).max(100),
        date: z.string().min(1),
        subject: z.string().min(1).max(255),
        body: z.string().min(1),
        signatoryName: z.string().min(1).max(255),
        signatorySignature: z.string().url().optional(),
    }).strict(),
});

// ─── Approved Procurement Schemas ────────────────────────────────────────────

export const createApprovedProcurementSchema = z.object({
    body: z.object({
        procurement_request_id: z.string().uuid(),
        unit_cost_kes: z.number().min(0),
        purchase_reference: z.string().optional(),
    }).strict(),
});

// ─── ID Schemas ──────────────────────────────────────────────────────────────

export const itemIdSchema = z.object({
    params: z.object({
        id: z.string().uuid('Item ID must be a valid UUID'),
    }),
});

export const storeRequestIdSchema = z.object({
    params: z.object({
        id: z.string().uuid('Store request ID must be a valid UUID'),
    }),
});

export const procurementRequestIdSchema = z.object({
    params: z.object({
        id: z.string().uuid('Procurement request ID must be a valid UUID'),
    }),
});

export const approvedProcurementIdSchema = z.object({
    params: z.object({
        id: z.string().uuid('Approved procurement ID must be a valid UUID'),
    }),
});

export const categoryIdParamSchema = z.object({
    params: z.object({
        id: z.string().uuid('Category ID must be a valid UUID'),
    }),
});

// ─── Type Exports ────────────────────────────────────────────────────────────

export type CreateInventoryItemInput = z.infer<typeof createInventoryItemSchema>['body'];
export type UpdateInventoryItemInput = z.infer<typeof updateInventoryItemSchema>['body'];
export type CreateStoreRequestInput = z.infer<typeof createStoreRequestSchema>['body'];
export type UpdateStoreRequestInput = z.infer<typeof updateStoreRequestSchema>['body'];
export type IssueStoreRequestInput = z.infer<typeof issueStoreRequestSchema>['body'];
export type ReceiveStoreRequestInput = z.infer<typeof receiveStoreRequestSchema>['body'];
export type CreateProcurementRequestInput = z.infer<typeof createProcurementRequestSchema>['body'];
export type UpdateProcurementRequestInput = z.infer<typeof updateProcurementRequestSchema>['body'];
export type SubmitProcurementMemoInput = z.infer<typeof submitProcurementMemoSchema>['body'];
export type CreateApprovedProcurementInput = z.infer<typeof createApprovedProcurementSchema>['body'];

export type StoreRequestStatus = z.infer<typeof storeStatusSchema>;
export type ProcurementRequestStatus = z.infer<typeof procurementStatusSchema>;
export type Urgency = z.infer<typeof urgencySchema>;