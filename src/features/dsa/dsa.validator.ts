// src/features/dsa/dsa.validator.ts
import { z } from 'zod';

// Base date validation
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');

export const createActivitySchema = z.object({
    body: z.object({
        name: z.string().min(1, 'Activity name is required').max(255).trim(),
        date_from: dateSchema,
        date_to: dateSchema,
    }).strict().refine(
        (data) => new Date(data.date_to) >= new Date(data.date_from),
        { message: 'date_to must be on or after date_from' }
    ),
});

export const updateActivitySchema = z.object({
    body: z.object({
        name: z.string().min(1).max(255).trim().optional(),
        date_from: dateSchema.optional(),
        date_to: dateSchema.optional(),
        is_active: z.boolean().optional(),
    }).strict().refine(
        (data) => {
            // If both dates are provided, validate they're in correct order
            if (data.date_from && data.date_to) {
                return new Date(data.date_to) >= new Date(data.date_from);
            }
            return true;
        },
        { message: 'date_to must be on or after date_from' }
    ).refine(
        (data) => Object.keys(data).length > 0,
        { message: 'At least one field must be provided' }
    ),
});

export const addStaffEntrySchema = z.object({
    body: z.object({
        user_id: z.string().uuid('Must be a valid user ID'),
        rate_per_night: z.number().int().min(0, 'Rate must be >= 0').default(4000),
    }).strict(),
});

export const updateStaffEntrySchema = z.object({
    body: z.object({
        rate_per_night: z.number().int().min(0, 'Rate must be >= 0'),
    }).strict(),
});

export const activityIdSchema = z.object({
    params: z.object({
        id: z.string().uuid('Activity ID must be a valid UUID'),
    }),
});

export const entryIdSchema = z.object({
    params: z.object({
        id: z.string().uuid('Activity ID must be a valid UUID'),
        entryId: z.string().uuid('Entry ID must be a valid UUID'),
    }),
});

// Export types
export type CreateActivityInput = z.infer<typeof createActivitySchema>['body'];
export type UpdateActivityInput = z.infer<typeof updateActivitySchema>['body'];
export type AddStaffEntryInput = z.infer<typeof addStaffEntrySchema>['body'];
export type UpdateStaffEntryInput = z.infer<typeof updateStaffEntrySchema>['body'];