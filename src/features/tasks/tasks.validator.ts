// src/features/tasks/tasks.validator.ts
import { z } from 'zod';

const taskDayEnum = z.enum(['Today', 'Tomorrow', 'Upcoming', 'Someday']);
const taskStatusEnum = z.enum(['pending', 'completed', 'archived']);
const taskPriorityEnum = z.enum(['low', 'medium', 'high', 'urgent']);

// ─── Helper: Transform null to undefined ─────────────────────────────────────

/**
 * Transforms null values to undefined for cleaner service layer handling
 */
const nullToUndefined = <T>(val: T | null): T | undefined => val === null ? undefined : val;

/**
 * Schema transformer that converts null to undefined for all fields
 */
const stripNull = <T extends z.ZodTypeAny>(schema: T) => 
  schema.transform((val) => {
    if (val === null) return undefined;
    if (typeof val === 'object' && val !== null) {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(val)) {
        result[key] = value === null ? undefined : value;
      }
      return result;
    }
    return val;
  });

// ─── Create Task ──────────────────────────────────────────────────────────────

export const createTaskSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'Title is required').max(255).trim(),
    list_id: z.string().uuid().optional().nullable(),
    day: taskDayEnum.default('Today'),
    in_my_day: z.boolean().default(false),
    notes: z.string().max(2000).trim().optional(),
    priority: taskPriorityEnum.default('medium'),
    due_date: z.string().datetime().optional().nullable(),
    assigned_to: z.string().uuid().optional().nullable(),
    tags: z.array(z.string()).optional(),
  }).strict().transform((data) => ({
    ...data,
    list_id: nullToUndefined(data.list_id),
    notes: nullToUndefined(data.notes),
    due_date: nullToUndefined(data.due_date),
    assigned_to: nullToUndefined(data.assigned_to),
  })),
});

// ─── Update Task ──────────────────────────────────────────────────────────────

export const updateTaskSchema = z.object({
  params: z.object({
    id: z.string().uuid('Task ID must be a valid UUID'),
  }),
  body: z.object({
    title: z.string().min(1).max(255).trim().optional(),
    list_id: z.string().uuid().optional().nullable(),
    status: taskStatusEnum.optional(),
    day: taskDayEnum.optional(),
    in_my_day: z.boolean().optional(),
    notes: z.string().max(2000).trim().optional(),
    priority: taskPriorityEnum.optional(),
    due_date: z.string().datetime().optional().nullable(),
    assigned_to: z.string().uuid().optional().nullable(),
    tags: z.array(z.string()).optional(),
    reminder_date: z.string().optional().nullable(),
    reminder_time: z.string().optional().nullable(),
  }).strict()
  .refine((b) => Object.keys(b).length > 0, {
    message: 'At least one field must be provided to update',
  })
  .transform((data) => ({
    ...data,
    list_id: data.list_id !== undefined ? nullToUndefined(data.list_id) : undefined,
    notes: data.notes !== undefined ? nullToUndefined(data.notes) : undefined,
    due_date: data.due_date !== undefined ? nullToUndefined(data.due_date) : undefined,
    assigned_to: data.assigned_to !== undefined ? nullToUndefined(data.assigned_to) : undefined,
    reminder_date: data.reminder_date !== undefined ? nullToUndefined(data.reminder_date) : undefined,
    reminder_time: data.reminder_time !== undefined ? nullToUndefined(data.reminder_time) : undefined,
  })),
});

// ─── Toggle Task Status ──────────────────────────────────────────────────────

export const toggleTaskStatusSchema = z.object({
  params: z.object({
    id: z.string().uuid('Task ID must be a valid UUID'),
  }),
  body: z.object({
    status: taskStatusEnum,
  }).strict(),
});

// ─── Create Subtask ──────────────────────────────────────────────────────────

export const createSubtaskSchema = z.object({
  params: z.object({
    taskId: z.string().uuid('Task ID must be a valid UUID'),
  }),
  body: z.object({
    title: z.string().min(1, 'Subtask title is required').max(255).trim(),
  }).strict(),
});

// ─── Update Subtask ──────────────────────────────────────────────────────────

export const updateSubtaskSchema = z.object({
  params: z.object({
    taskId: z.string().uuid('Task ID must be a valid UUID'),
    subtaskId: z.string().uuid('Subtask ID must be a valid UUID'),
  }),
  body: z.object({
    title: z.string().min(1).max(255).trim().optional(),
    completed: z.boolean().optional(),
  }).strict()
  .refine((b) => Object.keys(b).length > 0, {
    message: 'At least one field must be provided to update',
  }),
});

// ─── Delete Subtask ──────────────────────────────────────────────────────────

export const deleteSubtaskSchema = z.object({
  params: z.object({
    taskId: z.string().uuid('Task ID must be a valid UUID'),
    subtaskId: z.string().uuid('Subtask ID must be a valid UUID'),
  }),
});

// ─── Create Task List ────────────────────────────────────────────────────────

export const createTaskListSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'List name is required').max(100).trim(),
    color: z.string().max(20).optional(),
    icon: z.string().max(50).optional(),
    is_shared: z.boolean().default(false),
    member_ids: z.array(z.string().uuid()).optional(),
  }).strict(),
});

// ─── Update Task List ────────────────────────────────────────────────────────

export const updateTaskListSchema = z.object({
  params: z.object({
    id: z.string().uuid('List ID must be a valid UUID'),
  }),
  body: z.object({
    name: z.string().min(1).max(100).trim().optional(),
    color: z.string().max(20).optional().nullable(),
    icon: z.string().max(50).optional().nullable(),
    is_shared: z.boolean().optional(),
  }).strict()
  .refine((b) => Object.keys(b).length > 0, {
    message: 'At least one field must be provided to update',
  })
  .transform((data) => ({
    ...data,
    color: data.color !== undefined ? nullToUndefined(data.color) : undefined,
    icon: data.icon !== undefined ? nullToUndefined(data.icon) : undefined,
  })),
});

// ─── Delete Task List ────────────────────────────────────────────────────────

export const deleteTaskListSchema = z.object({
  params: z.object({
    id: z.string().uuid('List ID must be a valid UUID'),
  }),
});

// ─── Task Filters ────────────────────────────────────────────────────────────

export const taskFiltersSchema = z.object({
  query: z.object({
    list_id: z.string().uuid().optional(),
    status: taskStatusEnum.optional(),
    day: taskDayEnum.optional(),
    in_my_day: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
    assigned_to: z.string().uuid().optional(),
    tags: z.string().optional(), // comma-separated
    search: z.string().trim().max(100).optional(),
    due_from: z.string().datetime().optional(),
    due_to: z.string().datetime().optional(),
    page: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1)).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
    sort_by: z.enum(['created_at', 'updated_at', 'due_date', 'priority', 'title']).optional(),
    sort_order: z.enum(['ASC', 'DESC']).optional(),
  }).transform((data) => ({
    ...data,
    tags: data.tags ? data.tags.split(',').map(t => t.trim()).filter(Boolean) : undefined,
  })),
});

// ─── Task Summary ────────────────────────────────────────────────────────────

export const taskSummarySchema = z.object({
  query: z.object({
    list_id: z.string().uuid().optional(),
    assigned_to: z.string().uuid().optional(),
  }).optional(),
});

// ─── ID params ──────────────────────────────────────────────────────────────

export const taskIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Task ID must be a valid UUID'),
  }),
});

export const listIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('List ID must be a valid UUID'),
  }),
});

// ─── Task Attachments ────────────────────────────────────────────────────────

/**
 * Schema for validating the upload of one or more files to a task.
 * Actual files are handled by multer middleware; this validates the taskId in params.
 */
export const uploadTaskAttachmentSchema = z.object({
  params: z.object({
    taskId: z.string().uuid('Task ID must be a valid UUID'),
  }),
});

/**
 * Schema for deleting an attachment from a task.
 */
export const deleteTaskAttachmentSchema = z.object({
  params: z.object({
    taskId: z.string().uuid('Task ID must be a valid UUID'),
    attachmentId: z.string().uuid('Attachment ID must be a valid UUID'),
  }),
});

// ─── Inferred types ──────────────────────────────────────────────────────────

export type CreateTaskInput = z.infer<typeof createTaskSchema>['body'];
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>['body'];
export type CreateSubtaskInput = z.infer<typeof createSubtaskSchema>['body'];
export type UpdateSubtaskInput = z.infer<typeof updateSubtaskSchema>['body'];
export type CreateTaskListInput = z.infer<typeof createTaskListSchema>['body'];
export type UpdateTaskListInput = z.infer<typeof updateTaskListSchema>['body'];
export type TaskFilters = z.infer<typeof taskFiltersSchema>['query'];
export type UploadTaskAttachmentParams = z.infer<typeof uploadTaskAttachmentSchema>['params'];
export type DeleteTaskAttachmentParams = z.infer<typeof deleteTaskAttachmentSchema>['params'];