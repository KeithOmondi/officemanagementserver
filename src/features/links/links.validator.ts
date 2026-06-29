// src/features/external-links/external-links.validator.ts

import { z } from 'zod';

const colorEnum = z.enum([
    'blue', 'green', 'purple', 'indigo', 'teal', 'orange', 
    'rose', 'amber', 'red', 'cyan', 'violet', 'yellow'
]);

// ─── Create Category ──────────────────────────────────────────────────────────

export const createCategorySchema = z.object({
    body: z.object({
        name: z.string().min(1).max(100),
        emoji: z.string().max(10).optional(),
        description: z.string().optional(),
        sort_order: z.number().int().min(0).default(0),
        is_active: z.boolean().default(true),
    }).strict(),
});

// ─── Update Category ──────────────────────────────────────────────────────────

export const updateCategorySchema = z.object({
    body: z.object({
        name: z.string().min(1).max(100).optional(),
        emoji: z.string().max(10).optional(),
        description: z.string().optional(),
        sort_order: z.number().int().min(0).optional(),
        is_active: z.boolean().optional(),
    }).strict().refine(
        (data) => Object.keys(data).length > 0,
        { message: 'At least one field must be provided' }
    ),
});

// ─── Create Link ──────────────────────────────────────────────────────────────

export const createLinkSchema = z.object({
    body: z.object({
        category_id: z.string().uuid('Category ID must be a valid UUID'),
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        url: z.string().url('Must be a valid URL'),
        icon_name: z.string().max(50).optional(),
        color: colorEnum.default('blue'),
        tags: z.array(z.string()).default([]),
        is_featured: z.boolean().default(false),
        sort_order: z.number().int().min(0).default(0),
        is_active: z.boolean().default(true),
    }).strict(),
});

// ─── Update Link ──────────────────────────────────────────────────────────────

export const updateLinkSchema = z.object({
    body: z.object({
        category_id: z.string().uuid('Category ID must be a valid UUID').optional(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        url: z.string().url('Must be a valid URL').optional(),
        icon_name: z.string().max(50).optional(),
        color: colorEnum.optional(),
        tags: z.array(z.string()).optional(),
        is_featured: z.boolean().optional(),
        sort_order: z.number().int().min(0).optional(),
        is_active: z.boolean().optional(),
    }).strict().refine(
        (data) => Object.keys(data).length > 0,
        { message: 'At least one field must be provided' }
    ),
});

// ─── Filters ──────────────────────────────────────────────────────────────────

export const linkFiltersSchema = z.object({
    query: z.object({
        category_id: z.string().uuid().optional(),
        search: z.string().optional(),
        is_active: z.string().transform((val) => val === 'true').optional(),
        is_featured: z.string().transform((val) => val === 'true').optional(),
        tags: z.string().transform((val) => val.split(',')).optional(),
        limit: z.string().regex(/^\d+$/).optional().transform(Number),
        offset: z.string().regex(/^\d+$/).optional().transform(Number),
    }).strict(),
});

// ─── ID Schemas ──────────────────────────────────────────────────────────────

export const idSchema = z.object({
    params: z.object({
        id: z.string().uuid('ID must be a valid UUID'),
    }),
});

export const categoryIdSchema = z.object({
    params: z.object({
        categoryId: z.string().uuid('Category ID must be a valid UUID'),
    }),
});

// ─── Type Exports ─────────────────────────────────────────────────────────────

export type CreateCategoryInput = z.infer<typeof createCategorySchema>['body'];
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>['body'];
export type CreateLinkInput = z.infer<typeof createLinkSchema>['body'];
export type UpdateLinkInput = z.infer<typeof updateLinkSchema>['body'];
export type LinkFilters = z.infer<typeof linkFiltersSchema>['query'];