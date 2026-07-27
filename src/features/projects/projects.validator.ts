// src/features/projects/projects.validator.ts
import { z } from 'zod';

const statusEnum = z.enum(['todo', 'inprogress', 'done', 'overdue', 'pending_approval', 'blocked', 'review']);
const priorityEnum = z.enum(['low', 'normal', 'high', 'urgent', 'critical']);
const typeEnum = z.enum(['task', 'bug', 'feature', 'improvement', 'support', 'maintenance']);
const visibilityEnum = z.enum(['public', 'private', 'team']);

// ─── Project Validators ──────────────────────────────────────────────────────

export const createProjectSchema = z.object({
    body: z.object({
        title: z.string().min(1, 'Title is required').max(255),
        description: z.string().optional(),
        priority: priorityEnum.default('normal'),
        deadline: z.string().datetime().optional().nullable(),
        tags: z.array(z.string()).optional(),
        member_ids: z.array(z.string().uuid()).optional(),
    }).strict(),
});

export const updateProjectSchema = z.object({
    params: z.object({
        id: z.string().uuid('Invalid project ID'),
    }),
    body: z.object({
        title: z.string().min(1).max(255).optional(),
        description: z.string().optional().nullable(),
        priority: priorityEnum.optional(),
        deadline: z.string().datetime().optional().nullable(),
        tags: z.array(z.string()).optional(),
    }).strict().refine((b) => Object.keys(b).length > 0, {
        message: 'At least one field must be provided',
    }),
});

// ─── Task Validators ─────────────────────────────────────────────────────────

export const createTaskSchema = z.object({
    body: z.object({
        project_id: z.string().uuid().optional().nullable(),
        title: z.string().min(1, 'Title is required').max(255),
        description: z.string().optional().nullable(),
        status: statusEnum.default('todo'),
        priority: priorityEnum.default('normal'),
        type: typeEnum.default('task'),
        assignee: z.string().uuid().optional().nullable(),
        deadline: z.string().datetime().optional().nullable(),
        start_date: z.string().datetime().optional().nullable(),
        tags: z.array(z.string()).optional(),
        estimated_hours: z.number().min(0).optional().nullable(),
        parent_task_id: z.string().uuid().optional().nullable(),
        visibility: visibilityEnum.default('team'),
    }).strict(),
});

export const updateTaskSchema = z.object({
    params: z.object({
        id: z.string().uuid('Invalid task ID'),
    }),
    body: z.object({
        project_id: z.string().uuid().optional().nullable(),
        title: z.string().min(1).max(255).optional(),
        description: z.string().optional().nullable(),
        status: statusEnum.optional(),
        priority: priorityEnum.optional(),
        type: typeEnum.optional(),
        assignee: z.string().uuid().optional().nullable(),
        deadline: z.string().datetime().optional().nullable(),
        start_date: z.string().datetime().optional().nullable(),
        tags: z.array(z.string()).optional(),
        estimated_hours: z.number().min(0).optional().nullable(),
        actual_hours: z.number().min(0).optional().nullable(),
        parent_task_id: z.string().uuid().optional().nullable(),
        visibility: visibilityEnum.optional(),
    }).strict().refine((b) => Object.keys(b).length > 0, {
        message: 'At least one field must be provided',
    }),
});

// ─── Task Filters ────────────────────────────────────────────────────────────

export const taskFiltersSchema = z.object({
    query: z.object({
        project_id: z.string().uuid().optional(),
        status: statusEnum.optional(),
        priority: priorityEnum.optional(),
        type: typeEnum.optional(),
        assignee: z.string().uuid().optional(),
        tags: z.string().optional(),
        search: z.string().max(100).optional(),
        deadline_from: z.string().datetime().optional(),
        deadline_to: z.string().datetime().optional(),
        page: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1)).optional(),
        limit: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
        sort_by: z.enum(['created_at', 'deadline', 'priority', 'status', 'title']).optional(),
        sort_order: z.enum(['ASC', 'DESC']).optional(),
    }),
});

// ─── ID Params ───────────────────────────────────────────────────────────────

export const idParamSchema = z.object({
    params: z.object({
        id: z.string().uuid('Invalid ID'),
    }),
});

// ─── Subtask Validators ─────────────────────────────────────────────────────

// src/features/projects/projects.validator.ts

// Update the createSubtaskSchema to handle null properly
export const createSubtaskSchema = z.object({
    params: z.object({
        taskId: z.string().uuid('Invalid task ID'),
    }),
    body: z.object({
        title: z.string().min(1).max(255),
        description: z.string().max(2000).optional().nullable(),
        assigned_to: z.string().uuid().optional().nullable(),
    }).strict(),
});

export const updateSubtaskSchema = z.object({
    params: z.object({
        taskId: z.string().uuid('Invalid task ID'),
        subtaskId: z.string().uuid('Invalid subtask ID'),
    }),
    body: z.object({
        title: z.string().min(1).max(255).optional(),
        description: z.string().optional().nullable(),
        completed: z.boolean().optional(),
        assigned_to: z.string().uuid().optional().nullable(),
    }).strict().refine((b) => Object.keys(b).length > 0, {
        message: 'At least one field must be provided',
    }),
});

// ─── Comment Validators ─────────────────────────────────────────────────────

export const createCommentSchema = z.object({
    params: z.object({
        taskId: z.string().uuid('Invalid task ID'),
    }),
    body: z.object({
        content: z.string().min(1, 'Comment cannot be empty').max(2000),
    }).strict(),
});

export const updateCommentSchema = z.object({
    params: z.object({
        taskId: z.string().uuid('Invalid task ID'),
        commentId: z.string().uuid('Invalid comment ID'),
    }),
    body: z.object({
        content: z.string().min(1).max(2000),
    }).strict(),
});

// ─── Inferred Types ─────────────────────────────────────────────────────────

export type CreateProjectInput = z.infer<typeof createProjectSchema>['body'];
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>['body'];
export type CreateProjectTaskInput = z.infer<typeof createTaskSchema>['body'];
export type UpdateProjectTaskInput = z.infer<typeof updateTaskSchema>['body'];
export type ProjectTaskFilters = z.infer<typeof taskFiltersSchema>['query'];
export type CreateProjectSubtaskInput = z.infer<typeof createSubtaskSchema>['body'];
export type UpdateProjectSubtaskInput = z.infer<typeof updateSubtaskSchema>['body'];
export type CreateProjectCommentInput = z.infer<typeof createCommentSchema>['body'];
export type UpdateProjectCommentInput = z.infer<typeof updateCommentSchema>['body'];