// src/features/standalone/standalone.validator.ts
import { z } from 'zod';

const statusEnum = z.enum(['pending', 'in_progress', 'complete']);
const priorityEnum = z.enum(['low', 'normal', 'high', 'urgent', 'critical']);
const recurrenceTypeEnum = z.enum(['none', 'daily', 'weekly', 'monthly']);

// ─── Task Validators ──────────────────────────────────────────────────────────

export const createStandaloneTaskSchema = z.object({
    body: z.object({
        title: z.string().min(1, 'Title is required').max(255),
        description: z.string().max(2000).optional().nullable(),
        status: statusEnum.default('pending'),
        priority: priorityEnum.default('normal'),
        assigned_to: z.string().uuid().optional().nullable(),
        assigned_to_team: z.string().uuid().optional().nullable(),
        start_date: z.string().datetime().optional().nullable(),
        end_date: z.string().datetime({ message: 'End date must be a valid ISO datetime' }),
        estimated_hours: z.number().min(0).optional().nullable(),
        is_recurring: z.boolean().default(false),
        recurrence_type: recurrenceTypeEnum.default('none'),
        recurrence_end_date: z.string().datetime().optional().nullable(),
    }).strict().refine((data) => {
        // If recurring, recurrence_type must not be 'none'
        if (data.is_recurring && data.recurrence_type === 'none') {
            return false;
        }
        return true;
    }, {
        message: 'Recurrence type is required when task is recurring',
        path: ['recurrence_type'],
    }).refine((data) => {
        // If recurring, recurrence_end_date is required
        if (data.is_recurring && !data.recurrence_end_date) {
            return false;
        }
        return true;
    }, {
        message: 'Recurrence end date is required when task is recurring',
        path: ['recurrence_end_date'],
    }),
});

export const updateStandaloneTaskSchema = z.object({
    params: z.object({
        id: z.string().uuid('Invalid task ID'),
    }),
    body: z.object({
        title: z.string().min(1).max(255).optional(),
        description: z.string().max(2000).optional().nullable(),
        status: statusEnum.optional(),
        priority: priorityEnum.optional(),
        assigned_to: z.string().uuid().optional().nullable(),
        assigned_to_team: z.string().uuid().optional().nullable(),
        start_date: z.string().datetime().optional().nullable(),
        end_date: z.string().datetime().optional().nullable(),
        estimated_hours: z.number().min(0).optional().nullable(),
        actual_hours: z.number().min(0).optional().nullable(),
        is_recurring: z.boolean().optional(),
        recurrence_type: recurrenceTypeEnum.optional(),
        recurrence_end_date: z.string().datetime().optional().nullable(),
        is_archived: z.boolean().optional(),
    }).strict().refine((b) => Object.keys(b).length > 0, {
        message: 'At least one field must be provided',
    }),
});

// ─── Subtask Validators ─────────────────────────────────────────────────────

export const createStandaloneSubtaskSchema = z.object({
    params: z.object({
        taskId: z.string().uuid('Invalid task ID'),
    }),
    body: z.object({
        title: z.string().min(1, 'Title is required').max(255),
        description: z.string().max(2000).optional().nullable(),
    }).strict(),
});

export const updateStandaloneSubtaskSchema = z.object({
    params: z.object({
        taskId: z.string().uuid('Invalid task ID'),
        subtaskId: z.string().uuid('Invalid subtask ID'),
    }),
    body: z.object({
        title: z.string().min(1).max(255).optional(),
        description: z.string().max(2000).optional().nullable(),
        completed: z.boolean().optional(),
    }).strict().refine((b) => Object.keys(b).length > 0, {
        message: 'At least one field must be provided',
    }),
});

// ─── Comment Validators ─────────────────────────────────────────────────────

export const createStandaloneCommentSchema = z.object({
    params: z.object({
        taskId: z.string().uuid('Invalid task ID'),
    }),
    body: z.object({
        content: z.string().min(1, 'Comment cannot be empty').max(2000),
    }).strict(),
});

export const updateStandaloneCommentSchema = z.object({
    params: z.object({
        taskId: z.string().uuid('Invalid task ID'),
        commentId: z.string().uuid('Invalid comment ID'),
    }),
    body: z.object({
        content: z.string().min(1).max(2000),
    }).strict(),
});

// ─── Attachment Validators ──────────────────────────────────────────────────

export const createStandaloneAttachmentSchema = z.object({
    params: z.object({
        taskId: z.string().uuid('Invalid task ID'),
    }),
});

export const deleteStandaloneAttachmentSchema = z.object({
    params: z.object({
        taskId: z.string().uuid('Invalid task ID'),
        attachmentId: z.string().uuid('Invalid attachment ID'),
    }),
});

// ─── Task Filters ────────────────────────────────────────────────────────────

export const standaloneTaskFiltersSchema = z.object({
    query: z.object({
        status: statusEnum.optional(),
        priority: priorityEnum.optional(),
        assigned_to: z.string().uuid().optional(),
        assigned_to_team: z.string().uuid().optional(),
        search: z.string().max(100).optional(),
        start_date_from: z.string().datetime().optional(),
        start_date_to: z.string().datetime().optional(),
        end_date_from: z.string().datetime().optional(),
        end_date_to: z.string().datetime().optional(),
        is_archived: z.string().transform((val) => val === 'true').optional(),
        page: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1)).optional(),
        limit: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
        sort_by: z.enum(['created_at', 'end_date', 'priority', 'status', 'title']).optional(),
        sort_order: z.enum(['ASC', 'DESC']).optional(),
    }),
});

// ─── ID Params ───────────────────────────────────────────────────────────────

export const idParamSchema = z.object({
    params: z.object({
        id: z.string().uuid('Invalid ID'),
    }),
});

// ─── Task Status Update (for marking complete) ──────────────────────────────

export const updateTaskStatusSchema = z.object({
    params: z.object({
        id: z.string().uuid('Invalid task ID'),
    }),
    body: z.object({
        status: statusEnum,
    }).strict(),
});

// ─── Recurring Task Actions ─────────────────────────────────────────────────

export const generateRecurringTasksSchema = z.object({
    params: z.object({
        id: z.string().uuid('Invalid task ID'),
    }),
    body: z.object({
        count: z.number().int().min(1).max(365).default(12),
    }).strict(),
});

// ─── Inferred Types ─────────────────────────────────────────────────────────

export type CreateStandaloneTaskInput = z.infer<typeof createStandaloneTaskSchema>['body'];
export type UpdateStandaloneTaskInput = z.infer<typeof updateStandaloneTaskSchema>['body'];
export type StandaloneTaskFilters = z.infer<typeof standaloneTaskFiltersSchema>['query'];
export type CreateStandaloneSubtaskInput = z.infer<typeof createStandaloneSubtaskSchema>['body'];
export type UpdateStandaloneSubtaskInput = z.infer<typeof updateStandaloneSubtaskSchema>['body'];
export type CreateStandaloneCommentInput = z.infer<typeof createStandaloneCommentSchema>['body'];
export type UpdateStandaloneCommentInput = z.infer<typeof updateStandaloneCommentSchema>['body'];
export type UpdateTaskStatusInput = z.infer<typeof updateTaskStatusSchema>['body'];
export type GenerateRecurringTasksInput = z.infer<typeof generateRecurringTasksSchema>['body'];