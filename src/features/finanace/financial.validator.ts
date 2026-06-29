import { z } from 'zod';

// ─── Vote Lines ────────────────────────────────────────────────────────────────
export const createVoteLineSchema = z.object({
    body: z.object({
        name: z.string().min(1).max(100).trim(),
        allocated: z.number().min(0).default(0),
    }).strict(),
});

export const updateVoteLineSchema = z.object({
    body: z.object({
        name: z.string().min(1).max(100).trim().optional(),
        allocated: z.number().min(0).optional(),
        spent: z.number().min(0).optional(),
        committed: z.number().min(0).optional(),
        has_allocation: z.boolean().optional(),
        is_active: z.boolean().optional(),
    }).strict().refine(
        (data) => Object.keys(data).length > 0,
        { message: 'At least one field must be provided' }
    ),
});

// ─── Financial Activities ──────────────────────────────────────────────────────
export const createFinancialActivitySchema = z.object({
    body: z.object({
        activity: z.string().min(1).max(255).trim(),
        payee: z.string().min(1).max(255).trim(),
        vote_id: z.string().uuid().optional().nullable(),
        vote_name: z.string().min(1).max(100).trim(),
        amount: z.number().min(0),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
        type: z.enum(['Expenditure', 'Commitment', 'Pro Bono']),
        status: z.enum(['Pending', 'Approved', 'Rejected', 'Paid']).default('Pending'),
    }).strict(),
});

export const updateFinancialActivitySchema = z.object({
    body: z.object({
        activity: z.string().min(1).max(255).trim().optional(),
        payee: z.string().min(1).max(255).trim().optional(),
        vote_id: z.string().uuid().nullable().optional(),
        vote_name: z.string().min(1).max(100).trim().optional(),
        amount: z.number().min(0).optional(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)').optional(),
        type: z.enum(['Expenditure', 'Commitment', 'Pro Bono']).optional(),
        status: z.enum(['Pending', 'Approved', 'Rejected', 'Paid']).optional(),
        is_active: z.boolean().optional(),
    }).strict().refine(
        (data) => Object.keys(data).length > 0,
        { message: 'At least one field must be provided' }
    ),
});

// ─── Pro Bono Requests ─────────────────────────────────────────────────────────
export const createProBonoSchema = z.object({
    body: z.object({
        organization: z.string().min(1).max(255).trim(),
        service_type: z.string().min(1).max(100).trim(),
        description: z.string().optional(),
        value: z.number().min(0),
        status: z.enum(['Pending', 'Approved', 'Rejected', 'Completed']).default('Pending'),
        submitted_by_name: z.string().min(1).max(100).optional(),
        submitted_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)').optional(),
    }).strict(),
});

export const updateProBonoSchema = z.object({
    body: z.object({
        organization: z.string().min(1).max(255).trim().optional(),
        service_type: z.string().min(1).max(100).trim().optional(),
        description: z.string().nullable().optional(),
        value: z.number().min(0).optional(),
        status: z.enum(['Pending', 'Approved', 'Rejected', 'Completed']).optional(),
        approved_by: z.string().uuid().nullable().optional(),
        approved_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)').nullable().optional(),
        is_active: z.boolean().optional(),
    }).strict().refine(
        (data) => Object.keys(data).length > 0,
        { message: 'At least one field must be provided' }
    ),
});

// ─── Budget Reports ────────────────────────────────────────────────────────────
export const createBudgetReportSchema = z.object({
    body: z.object({
        report_month: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
    }).strict(),
});

// ─── Filters ──────────────────────────────────────────────────────────────────
export const activityFiltersSchema = z.object({
    query: z.object({
        search: z.string().optional(),
        vote: z.string().optional(),
        type: z.enum(['Expenditure', 'Commitment', 'Pro Bono']).optional(),
        status: z.enum(['Pending', 'Approved', 'Rejected', 'Paid']).optional(),
        limit: z.string().regex(/^\d+$/).optional().transform(Number),
        offset: z.string().regex(/^\d+$/).optional().transform(Number),
    }).strict(),
});

export const proBonoFiltersSchema = z.object({
    query: z.object({
        search: z.string().optional(),
        status: z.enum(['Pending', 'Approved', 'Rejected', 'Completed']).optional(),
        limit: z.string().regex(/^\d+$/).optional().transform(Number),
        offset: z.string().regex(/^\d+$/).optional().transform(Number),
    }).strict(),
});

// ─── ID Schemas ────────────────────────────────────────────────────────────────
export const voteLineIdSchema = z.object({
    params: z.object({
        id: z.string().uuid('Vote line ID must be a valid UUID'),
    }),
});

export const activityIdSchema = z.object({
    params: z.object({
        id: z.string().uuid('Activity ID must be a valid UUID'),
    }),
});

export const proBonoIdSchema = z.object({
    params: z.object({
        id: z.string().uuid('Pro bono request ID must be a valid UUID'),
    }),
});

export const reportIdSchema = z.object({
    params: z.object({
        id: z.string().uuid('Report ID must be a valid UUID'),
    }),
});

// ─── Type Exports ──────────────────────────────────────────────────────────────
export type CreateVoteLineInput = z.infer<typeof createVoteLineSchema>['body'];
export type UpdateVoteLineInput = z.infer<typeof updateVoteLineSchema>['body'];
export type CreateFinancialActivityInput = z.infer<typeof createFinancialActivitySchema>['body'];
export type UpdateFinancialActivityInput = z.infer<typeof updateFinancialActivitySchema>['body'];
export type CreateProBonoInput = z.infer<typeof createProBonoSchema>['body'];
export type UpdateProBonoInput = z.infer<typeof updateProBonoSchema>['body'];
export type CreateBudgetReportInput = z.infer<typeof createBudgetReportSchema>['body'];
export type ActivityFilters = z.infer<typeof activityFiltersSchema>['query'];
export type ProBonoFilters = z.infer<typeof proBonoFiltersSchema>['query'];