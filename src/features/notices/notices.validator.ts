// src/features/notices/notices.validator.ts
import { z } from 'zod';

const audienceEnum = z.enum(['All Staff', 'Registry Staff Only', 'Judicial Officers', 'Administrative Staff']);
const deliveryEnum = z.enum(['In-App + Email', 'In-App Only', 'Email + SMS', 'All Channels']);
const categoryEnum = z.enum(['General Notice', 'Court Vacation', 'Administrative Circular', 'Urgent Notice', 'Staff Information']);

// ─── Broadcasts ─────────────────────────────────────────────────────────────────

export const createBroadcastSchema = z.object({
    body: z.object({
        title: z.string().min(1).max(255).trim(),
        body: z.string().min(1),
        audience: audienceEnum,
        delivery_method: deliveryEnum.default('In-App + Email'),
        is_urgent: z.boolean().default(false),
    }).strict(),
});

export const updateBroadcastSchema = z.object({
    body: z.object({
        title: z.string().min(1).max(255).trim().optional(),
        body: z.string().min(1).optional(),
        audience: audienceEnum.optional(),
        delivery_method: deliveryEnum.optional(),
        is_urgent: z.boolean().optional(),
        is_sent: z.boolean().optional(),
    }).strict().refine(
        (data) => Object.keys(data).length > 0,
        { message: 'At least one field must be provided' }
    ),
});

// ─── Notices ──────────────────────────────────────────────────────────────────

export const createNoticeSchema = z.object({
    body: z.object({
        title: z.string().min(1).max(255).trim(),
        body: z.string().min(1),
        category: categoryEnum,
        visibility: audienceEnum.default('All Staff'),
        expires_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),  // Allow null
    }).strict(),
});

export const updateNoticeSchema = z.object({
    body: z.object({
        title: z.string().min(1).max(255).trim().optional(),
        body: z.string().min(1).optional(),
        category: categoryEnum.optional(),
        visibility: audienceEnum.optional(),
        is_published: z.boolean().optional(),
        expires_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),  // Allow null
    }).strict().refine(
        (data) => Object.keys(data).length > 0,
        { message: 'At least one field must be provided' }
    ),
});

// ─── Read Receipts ────────────────────────────────────────────────────────────

export const markReadSchema = z.object({
    params: z.object({
        id: z.string().uuid('ID must be a valid UUID'),
    }),
});

// ─── Filters ──────────────────────────────────────────────────────────────────

export const noticesFiltersSchema = z.object({
    query: z.object({
        search: z.string().optional(),
        audience: audienceEnum.optional(),
        category: categoryEnum.optional(),
        is_sent: z.string().transform((val) => val === 'true').optional(),
        is_published: z.string().transform((val) => val === 'true').optional(),
        limit: z.string().regex(/^\d+$/).optional().transform(Number),
        offset: z.string().regex(/^\d+$/).optional().transform(Number),
    }).strict(),
});

export const idSchema = z.object({
    params: z.object({
        id: z.string().uuid('ID must be a valid UUID'),
    }),
});

// ─── Type Exports ─────────────────────────────────────────────────────────────

export type CreateBroadcastInput = z.infer<typeof createBroadcastSchema>['body'];
export type UpdateBroadcastInput = z.infer<typeof updateBroadcastSchema>['body'];
export type CreateNoticeInput = z.infer<typeof createNoticeSchema>['body'];
export type UpdateNoticeInput = z.infer<typeof updateNoticeSchema>['body'];
export type NoticesFilters = z.infer<typeof noticesFiltersSchema>['query'];