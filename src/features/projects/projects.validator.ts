// src/features/projects/projects.validator.ts
import { z } from 'zod';

// ─── Enums ──────────────────────────────────────────────────────────────────

const statusEnum = z.enum(['inprogress', 'done', 'overdue', 'pending_approval', 'blocked', 'review']);
const priorityEnum = z.enum(['low', 'normal', 'high', 'urgent', 'critical']);
const visibilityEnum = z.enum(['public', 'private', 'team']);

// ─── Date schema with normalization ─────────────────────────────────────────

const dateStringSchema = z.preprocess(
  (val) => {
    if (typeof val === 'string') {
      if (val.includes('T')) {
        return val.split('T')[0];
      }
      if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
        return val;
      }
    }
    return val;
  },
  z.string().date({ message: 'Invalid date format' }).optional()  // .date() not .datetime()
);

// In projects.validator.ts
const optionalDateSchema = z.preprocess(
  (val) => {
    if (val === null || val === undefined) return null;
    if (typeof val === 'string') {
      if (val.includes('T')) {
        return val.split('T')[0];
      }
      if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
        return val;
      }
    }
    return val;
  },
  z.string().date({ message: 'Invalid date format' }).nullable().optional()
);

// ─── Project Validators ──────────────────────────────────────────────────────

export const createProjectSchema = z.object({
    body: z.object({
        title: z.string().min(1, 'Title is required').max(255),
        description: z.string().optional(),
        priority: priorityEnum.default('normal'),
        deadline: dateStringSchema,
        start_date: optionalDateSchema,
        tags: z.array(z.string()).optional(),
        member_ids: z.array(z.string().uuid()).optional(),
    }).strict(),
});

export const updateProjectSchema = z.object({
    params: z.object({
        id: z.string().uuid('Invalid project ID'),
    }),
    body: z.object({
        title: z.string().min(1, 'Title must be at least 1 character').max(255).optional(),
        description: z.string().nullable().optional(),
        priority: priorityEnum.optional(),
        deadline: optionalDateSchema,
        start_date: optionalDateSchema,
        tags: z.array(z.string()).optional(),
        member_ids: z.array(z.string().uuid()).optional(),
        is_active: z.boolean().optional(),
    }).strict().refine((b) => Object.keys(b).length > 0, {
        message: 'At least one field must be provided for update',
    }),
});

// ─── Project Filters ─────────────────────────────────────────────────────────

export const projectFiltersSchema = z.object({
    query: z.object({
        search: z.string().max(100).optional(),
        page: z.coerce.number().int().positive().optional().default(1),
        limit: z.coerce.number().int().positive().max(100).optional().default(20),
        member_id: z.string().uuid().optional(),
        created_by: z.string().uuid().optional(),
        is_active: z.preprocess(
            (val) => {
                if (val === undefined || val === null || val === '') return true;
                return val === 'true';
            },
            z.boolean().default(true)
        ),
        priority: priorityEnum.optional(),
        deadline_from: optionalDateSchema,
        deadline_to: optionalDateSchema,
    }),
});

// ─── Task Validators ─────────────────────────────────────────────────────────

export const createTaskSchema = z.object({
    body: z.object({
        project_id: z.string().uuid().nullable().optional(),
        title: z.string().min(1, 'Title is required').max(255),
        description: z.string().nullable().optional(),
        status: statusEnum.default('inprogress'),
        priority: priorityEnum.default('normal'),
        type: z.string().max(255).nullable().optional(),
        assignee: z.string().uuid().nullable().optional(),
        deadline: optionalDateSchema,
        start_date: optionalDateSchema,
        tags: z.array(z.string()).optional(),
        estimated_hours: z.number().min(0).nullable().optional(),
        parent_task_id: z.string().uuid().nullable().optional(),
        visibility: visibilityEnum.default('team'),
    }).strict(),
});

export const updateTaskSchema = z.object({
    params: z.object({
        id: z.string().uuid('Invalid task ID'),
    }),
    body: z.object({
        project_id: z.string().uuid().nullable().optional(),
        title: z.string().min(1, 'Title must be at least 1 character').max(255).optional(),
        description: z.string().nullable().optional(),
        status: statusEnum.optional(),
        priority: priorityEnum.optional(),
        type: z.string().max(255).nullable().optional(),
        assignee: z.string().uuid().nullable().optional(),
        deadline: optionalDateSchema,
        start_date: optionalDateSchema,
        tags: z.array(z.string()).optional(),
        estimated_hours: z.number().min(0).nullable().optional(),
        actual_hours: z.number().min(0).nullable().optional(),
        parent_task_id: z.string().uuid().nullable().optional(),
        visibility: visibilityEnum.optional(),
        completed_at: optionalDateSchema,
    }).strict().refine((b) => Object.keys(b).length > 0, {
        message: 'At least one field must be provided for update',
    }),
});

// ─── Task Filters ────────────────────────────────────────────────────────────

export const taskFiltersSchema = z.object({
    query: z.object({
        project_id: z.string().uuid().optional(),
        status: statusEnum.optional(),
        priority: priorityEnum.optional(),
        type: z.string().max(255).optional(),
        assignee: z.string().uuid().optional(),
        assigned_to_me: z.preprocess(
            (val) => {
                if (val === undefined || val === null || val === '') return false;
                return val === 'true';
            },
            z.boolean().default(false)
        ),
        tags: z.string().optional(),
        search: z.string().max(100).optional(),
        deadline_from: optionalDateSchema,
        deadline_to: optionalDateSchema,
        page: z.coerce.number().int().positive().optional().default(1),
        limit: z.coerce.number().int().positive().max(100).optional().default(20),
        sort_by: z.enum(['created_at', 'deadline', 'priority', 'status', 'title', 'updated_at']).optional().default('created_at'),
        sort_order: z.enum(['ASC', 'DESC']).optional().default('DESC'),
    }),
});

// ─── ID Params ───────────────────────────────────────────────────────────────

export const idParamSchema = z.object({
    params: z.object({
        id: z.string().uuid('Invalid ID format'),
    }),
});

export const taskIdParamSchema = z.object({
    params: z.object({
        taskId: z.string().uuid('Invalid task ID'),
    }),
});

export const projectIdParamSchema = z.object({
    params: z.object({
        projectId: z.string().uuid('Invalid project ID'),
    }),
});

// ─── Subtask Validators ─────────────────────────────────────────────────────

export const createSubtaskSchema = z.object({
    params: z.object({
        taskId: z.string().uuid('Invalid task ID'),
    }),
    body: z.object({
        title: z.string().min(1, 'Title is required').max(255),
        description: z.string().max(2000).nullable().optional(),
        assigned_to: z.string().uuid().nullable().optional(),
    }).strict(),
});

export const updateSubtaskSchema = z.object({
    params: z.object({
        taskId: z.string().uuid('Invalid task ID'),
        subtaskId: z.string().uuid('Invalid subtask ID'),
    }),
    body: z.object({
        title: z.string().min(1, 'Title must be at least 1 character').max(255).optional(),
        description: z.string().nullable().optional(),
        completed: z.boolean().optional(),
        assigned_to: z.string().uuid().nullable().optional(),
    }).strict().refine((b) => Object.keys(b).length > 0, {
        message: 'At least one field must be provided for update',
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
        content: z.string().min(1, 'Comment cannot be empty').max(2000),
    }).strict(),
});

// ─── File/Attachment Validators ─────────────────────────────────────────────

export const uploadFileSchema = z.object({
    params: z.object({
        taskId: z.string().uuid('Invalid task ID'),
    }),
    body: z.object({
        task_id: z.string().uuid('Task ID is required'),
    }),
});

export const deleteFileSchema = z.object({
    params: z.object({
        fileId: z.string().uuid('Invalid file ID'),
    }),
});

// ─── Bulk Task Update Validator ─────────────────────────────────────────────

export const bulkUpdateTaskSchema = z.object({
    body: z.object({
        updates: z.array(
            z.object({
                task_id: z.string().uuid('Invalid task ID'),
                status: statusEnum.optional(),
                priority: priorityEnum.optional(),
                assignee: z.string().uuid().nullable().optional(),
                deadline: optionalDateSchema,
            })
        ).min(1, 'At least one task update is required'),
    }).strict(),
});

// ─── Inferred Types ─────────────────────────────────────────────────────────

export type CreateProjectInput = z.infer<typeof createProjectSchema>['body'];
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>['body'];
export type ProjectFilters = z.infer<typeof projectFiltersSchema>['query'];

export type CreateProjectTaskInput = z.infer<typeof createTaskSchema>['body'];
export type UpdateProjectTaskInput = z.infer<typeof updateTaskSchema>['body'];
export type ProjectTaskFilters = z.infer<typeof taskFiltersSchema>['query'];

export type CreateProjectSubtaskInput = z.infer<typeof createSubtaskSchema>['body'];
export type UpdateProjectSubtaskInput = z.infer<typeof updateSubtaskSchema>['body'];

export type CreateProjectCommentInput = z.infer<typeof createCommentSchema>['body'];
export type UpdateProjectCommentInput = z.infer<typeof updateCommentSchema>['body'];

export type UploadFileInput = z.infer<typeof uploadFileSchema>['body'];
export type DeleteFileParams = z.infer<typeof deleteFileSchema>['params'];

export type BulkUpdateTaskInput = z.infer<typeof bulkUpdateTaskSchema>['body'];