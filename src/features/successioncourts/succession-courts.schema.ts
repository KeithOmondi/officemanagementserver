// ============================================================
// src/features/succession-courts/succession-courts.schema.ts
// ============================================================

import { z } from 'zod';

const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');

export const successionCourtCategoryEnum = z.enum(['A', 'B', 'C', 'D']);

// ─── Create Schema ──────────────────────────────────────────────────────────

export const createSuccessionCourtSchema = z.object({
    body: z.object({
        name: z.string().min(1).max(200),
        station: z.string().min(1).max(200),
        category: successionCourtCategoryEnum,
        support_person_id: z.string().uuid('Support person ID must be a valid UUID').optional(),
        contact: z.string().max(200).optional(),
    }).strict(),
});

// ─── Update Schema ──────────────────────────────────────────────────────────

export const updateSuccessionCourtSchema = z.object({
    body: z.object({
        name: z.string().min(1).max(200).optional(),
        station: z.string().min(1).max(200).optional(),
        category: successionCourtCategoryEnum.optional(),
        support_person_id: z.string().uuid('Support person ID must be a valid UUID').optional().nullable(),
        contact: z.string().max(200).optional(),
        is_active: z.boolean().optional(),
    }).strict(),
});

// ─── Filters Schema ─────────────────────────────────────────────────────────

export const successionCourtFiltersSchema = z.object({
    query: z.object({
        search: z.string().optional(),
        category: successionCourtCategoryEnum.optional(),
        station: z.string().optional(),
        is_active: z.preprocess(
            (val) => (val === undefined ? undefined : val),
            z.enum(['true', 'false']).optional()
        ).transform(val => val === undefined ? undefined : val === 'true'),
        support_person_id: z.string().uuid('Support person ID must be a valid UUID').optional(),
        limit: z.string().regex(/^\d+$/).optional().transform(Number),
        offset: z.string().regex(/^\d+$/).optional().transform(Number),
    }).strict(),
});

// ─── ID Schema ──────────────────────────────────────────────────────────────

export const idSchema = z.object({
    params: z.object({
        id: z.string().uuid('ID must be a valid UUID'),
    }),
});

// ─── Assign Support Person Schema ──────────────────────────────────────────

export const assignSupportPersonSchema = z.object({
    params: z.object({
        id: z.string().uuid('Court ID must be a valid UUID'),
    }),
    body: z.object({
        userId: z.string().uuid('User ID must be a valid UUID'),
        contact: z.string().max(200).optional(),
    }).strict(),
});

// ─── Bulk Assign Support Person Schema ─────────────────────────────────────

export const bulkAssignSupportPersonSchema = z.object({
    body: z.object({
        courtIds: z.array(z.string().uuid('Court ID must be a valid UUID')).min(1, 'At least one court ID is required'),
        userId: z.string().uuid('User ID must be a valid UUID'),
        contact: z.string().max(200).optional(),
    }).strict(),
});

// ─── NEW: Assign Support Person by Category Schema ─────────────────────────

export const assignSupportPersonByCategorySchema = z.object({
    body: z.object({
        category: successionCourtCategoryEnum,
        userId: z.string().uuid('User ID must be a valid UUID'),
        contact: z.string().max(200).optional(),
    }).strict(),
});

// ─── NEW: Assign Support Person by Station Schema ──────────────────────────

export const assignSupportPersonByStationSchema = z.object({
    body: z.object({
        station: z.string().min(1).max(200),
        userId: z.string().uuid('User ID must be a valid UUID'),
        contact: z.string().max(200).optional(),
    }).strict(),
});

// ─── NEW: Reassign Support Person Schema ───────────────────────────────────

export const reassignSupportPersonSchema = z.object({
    body: z.object({
        currentUserId: z.string().uuid('Current user ID must be a valid UUID'),
        newUserId: z.string().uuid('New user ID must be a valid UUID'),
        category: successionCourtCategoryEnum.optional(),
        station: z.string().max(200).optional(),
    }).strict(),
});

// ─── Remove Support Person Schema ─────────────────────────────────────────

export const removeSupportPersonSchema = z.object({
    params: z.object({
        id: z.string().uuid('Court ID must be a valid UUID'),
    }),
});

// ─── Bulk Remove Support Person Schema ────────────────────────────────────

export const bulkRemoveSupportPersonSchema = z.object({
    body: z.object({
        courtIds: z.array(z.string().uuid('Court ID must be a valid UUID')).min(1, 'At least one court ID is required'),
    }).strict(),
});

// ─── Get Support Person Assignments Schema ────────────────────────────────

export const supportPersonAssignmentsSchema = z.object({
    query: z.object({
        userId: z.string().uuid('User ID must be a valid UUID').optional(),
        category: successionCourtCategoryEnum.optional(),
    }).strict(),
});

// ─── Seed Schema ────────────────────────────────────────────────────────────

export const seedSuccessionCourtsSchema = z.object({
    body: z.object({
        dryRun: z.boolean().optional().default(false),
        force: z.boolean().optional().default(false),
    }).strict(),
});

// ─── Get Seed Count Schema ──────────────────────────────────────────────────

export const getSeedCountSchema = z.object({
    query: z.object({}).strict(),
});

// ─── Clear Seed Data Schema ─────────────────────────────────────────────────

export const clearSeedDataSchema = z.object({
    body: z.object({}).strict(),
});

// ─── Validate Seed Data Schema ──────────────────────────────────────────────

export const validateSeedDataSchema = z.object({
    query: z.object({}).strict(),
});

// ─── Get Court With User Schema ────────────────────────────────────────────

export const getCourtWithUserSchema = z.object({
    params: z.object({
        id: z.string().uuid('Court ID must be a valid UUID'),
    }),
});

// ─── Available Support Persons Schema ──────────────────────────────────────

export const availableSupportPersonsSchema = z.object({
    query: z.object({
        excludeAssigned: z.string().optional().transform(val => val === 'true'),
    }).strict(),
});

// ─── Bulk Update Schema ─────────────────────────────────────────────────────

export const bulkUpdateSuccessionCourtSchema = z.object({
    body: z.object({
        courtIds: z.array(z.string().uuid('Court ID must be a valid UUID')).min(1, 'At least one court ID is required'),
        data: z.object({
            is_active: z.boolean().optional(),
            category: successionCourtCategoryEnum.optional(),
            contact: z.string().max(200).optional(),
        }).strict(),
    }).strict(),
});

// ─── Types ─────────────────────────────────────────────────────────────────

export type CreateSuccessionCourtInput = z.infer<typeof createSuccessionCourtSchema>['body'];
export type UpdateSuccessionCourtInput = z.infer<typeof updateSuccessionCourtSchema>['body'];
export type SuccessionCourtFilters = z.infer<typeof successionCourtFiltersSchema>['query'];
export type AssignSupportPersonInput = z.infer<typeof assignSupportPersonSchema>['body'];
export type BulkAssignSupportPersonInput = z.infer<typeof bulkAssignSupportPersonSchema>['body'];
export type AssignSupportPersonByCategoryInput = z.infer<typeof assignSupportPersonByCategorySchema>['body'];
export type AssignSupportPersonByStationInput = z.infer<typeof assignSupportPersonByStationSchema>['body'];
export type ReassignSupportPersonInput = z.infer<typeof reassignSupportPersonSchema>['body'];
export type SupportPersonAssignmentsFilters = z.infer<typeof supportPersonAssignmentsSchema>['query'];
export type SeedSuccessionCourtsInput = z.infer<typeof seedSuccessionCourtsSchema>['body'];
export type BulkUpdateSuccessionCourtInput = z.infer<typeof bulkUpdateSuccessionCourtSchema>['body'];
export type AvailableSupportPersonsFilters = z.infer<typeof availableSupportPersonsSchema>['query'];