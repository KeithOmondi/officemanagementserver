// src/features/tasks/tasks.validator.ts

import { z } from 'zod';

// ─── Fixed-Domain Enums ───────────────────────────────────────────────────────
// These are genuinely closed sets shared across entities — validated strictly.

const priorityEnum = z.enum(['low', 'normal', 'high', 'urgent', 'critical']);
const projectStatusEnum = z.enum(['active', 'archived', 'completed', 'on_hold', 'planning']);
const reminderRepeatEnum = z.enum(['none', 'daily', 'weekly', 'monthly', 'custom']);
const dependencyTypeEnum = z.enum(['blocks', 'blocked_by', 'relates_to']);

// ─── Open-Domain "Enums" ──────────────────────────────────────────────────────
// Task status/type/visibility are NOT locked to a fixed set — different
// departments/workflows may need custom stages or categories without a
// schema migration. These lists are kept only as a reference for frontend
// dropdowns/autocomplete; they are NOT enforced by validation.
//
// If you need to *display* known values, import these arrays. If you need
// to *validate* against them, don't — that defeats the point of making
// them open. Validation below just checks "non-empty reasonable string".

export const KNOWN_TASK_STATUSES = [
  'todo', 'inprogress', 'done', 'overdue', 'pending_approval', 'blocked', 'review',
] as const;

export const KNOWN_TASK_TYPES = [
  'task', 'bug', 'feature', 'improvement', 'support', 'maintenance',
] as const;

export const KNOWN_TASK_VISIBILITIES = [
  'public', 'private', 'team',
] as const;

const openStringField = (label: string) =>
  z.string().trim().min(1, `${label} cannot be empty`).max(50, `${label} is too long`);

const taskStatusField = openStringField('Status');
const taskTypeField = openStringField('Type');
const taskVisibilityField = openStringField('Visibility');

// ─── Date Helpers ─────────────────────────────────────────────────────────────

/**
 * Zod schema for optional date strings.
 * Accepts ISO datetime strings, date-only strings (YYYY-MM-DD), or null.
 * Always resolves to an ISO datetime string (or null) — never a Date object.
 */
const optionalDateSchema = z
  .union([
    z.string().datetime({ message: 'Invalid date format' }),
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (expected YYYY-MM-DD)'),
    z.null(),
  ])
  .optional()
  .transform((val) => {
    if (val === undefined) return undefined; // preserve "not provided"
    if (!val) return null;                    // explicit null stays null
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
      return new Date(val + 'T00:00:00.000Z').toISOString();
    }
    return val;
  });

/**
 * Zod schema for required date strings.
 * Always resolves to an ISO datetime string — never a Date object.
 */
const requiredDateSchema = z
  .union([
    z.string().datetime({ message: 'Invalid date format' }),
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (expected YYYY-MM-DD)'),
  ])
  .transform((val) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
      return new Date(val + 'T00:00:00.000Z').toISOString();
    }
    return val;
  });

// ─── Boolean Transform Helper ──────────────────────────────────────────────

const booleanTransform = (val: unknown): boolean => {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') return val === 'true';
  return false;
};

/**
 * Reusable schema for boolean query params that may arrive as
 * actual booleans (JSON body) or the strings 'true'/'false' (query string).
 */
const booleanQuerySchema = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .transform(booleanTransform);

// ─── String to Number Transform Helper ──────────────────────────────────────

const numberTransform = (val: unknown): number => {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const parsed = parseInt(val, 10);
    return isNaN(parsed) ? 1 : parsed;
  }
  return 1;
};

/**
 * Reusable schema for a paginated `page` query param.
 */
const pageSchema = z
  .string()
  .regex(/^\d+$/)
  .transform(numberTransform)
  .pipe(z.number().int().min(1))
  .default(1);

/**
 * Reusable schema for a paginated `limit` query param (max 100 per page).
 */
const limitSchema = z
  .string()
  .regex(/^\d+$/)
  .transform(numberTransform)
  .pipe(z.number().int().min(1).max(100))
  .default(20);

// ─── Project Schemas ─────────────────────────────────────────────────────────

export const createProjectSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'Title is required').max(255),
    description: z.string().max(2000).nullable().optional(),
    deadline: requiredDateSchema,
    priority: priorityEnum.default('normal'),
    members: z.array(z.string()).min(1, 'At least one member is required'),
    owner_id: z.string().uuid().optional(),
    department_id: z.string().uuid().optional(),
    tags: z.array(z.string()).default([]),
    start_date: optionalDateSchema,
    status: projectStatusEnum.default('active'),
  }),
});

export const updateProjectSchema = z.object({
  params: z.object({
    id: z.string().uuid('Project ID must be a valid UUID'),
  }),
  body: z.object({
    title: z.string().min(1).max(255).optional(),
    description: z.string().max(2000).nullable().optional(),
    deadline: requiredDateSchema.optional(),
    priority: priorityEnum.optional(),
    members: z.array(z.string()).min(1).optional(),
    owner_id: z.string().uuid().optional(),
    department_id: z.string().uuid().optional(),
    tags: z.array(z.string()).optional(),
    start_date: optionalDateSchema,
    status: projectStatusEnum.optional(),
  }).refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided to update',
  }),
});

export const projectIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Project ID must be a valid UUID'),
  }),
});

// ─── Task Schemas ────────────────────────────────────────────────────────────

export const createTaskSchema = z.object({
  body: z.object({
    project_id: z.string().uuid().nullable(),
    title: z.string().min(1, 'Title is required').max(255),
    description: z.string().max(2000).nullable().optional(),
    // FIX: was missing .optional() — a task-creation payload that simply
    // omits `assignee` (e.g. "create unassigned task") failed Zod
    // validation with a 400 before ever reaching the controller, since the
    // key was required to be present (even as explicit null). Now matches
    // updateTaskSchema's assignee, which already allowed omission.
    assignee: z.union([z.string(), z.literal('GROUP')]).nullable().optional(),
    priority: priorityEnum.default('normal'),
    deadline: requiredDateSchema,
    start_date: optionalDateSchema,
    // Open-domain — see KNOWN_TASK_TYPES / KNOWN_TASK_VISIBILITIES above.
    type: taskTypeField.default('task'),
    visibility: taskVisibilityField.default('team'),
    tags: z.array(z.string()).default([]),
    estimated_hours: z.number().min(0).nullable().optional(),
    parent_task_id: z.string().uuid().nullable().optional(),
  }),
});

export const updateTaskSchema = z.object({
  params: z.object({
    id: z.string().uuid('Task ID must be a valid UUID'),
  }),
  body: z.object({
    project_id: z.string().uuid().nullable().optional(),
    title: z.string().min(1).max(255).optional(),
    description: z.string().max(2000).nullable().optional(),
    assignee: z.union([z.string(), z.literal('GROUP')]).nullable().optional(),
    priority: priorityEnum.optional(),
    deadline: requiredDateSchema.optional(),
    start_date: optionalDateSchema,
    // Open-domain — see KNOWN_TASK_STATUSES above.
    status: taskStatusField.optional(),
    progress: z.number().min(0).max(100).optional(),
    type: taskTypeField.optional(),
    visibility: taskVisibilityField.optional(),
    tags: z.array(z.string()).optional(),
    estimated_hours: z.number().min(0).nullable().optional(),
    actual_hours: z.number().min(0).nullable().optional(),
    parent_task_id: z.string().uuid().nullable().optional(),
    // NOTE: no .default([]) here — a default would populate this key on
    // every parse (even when omitted by the client), which would silently
    // defeat the "at least one field" refine below.
    blocked_by: z.array(z.string().uuid()).optional(),
  }).refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided to update',
  }),
});

export const taskIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Task ID must be a valid UUID'),
  }),
});

// ─── Task Filters Schema ────────────────────────────────────────────────────

export const taskFiltersSchema = z.object({
  query: z.object({
    assignee: z.string().optional(),
    // Open-domain fields: accept single value or array of strings, unvalidated
    // against a fixed set (see KNOWN_TASK_STATUSES / KNOWN_TASK_TYPES).
    status: z.union([taskStatusField, z.array(taskStatusField)]).optional(),
    project_id: z.union([z.string().uuid(), z.array(z.string().uuid())]).optional(),
    priority: z.union([priorityEnum, z.array(priorityEnum)]).optional(),
    type: z.union([taskTypeField, z.array(taskTypeField)]).optional(),
    search: z.string().max(100).optional(),
    tags: z.array(z.string()).optional(),
    due_from: optionalDateSchema,
    due_to: optionalDateSchema,
    created_from: optionalDateSchema,
    created_to: optionalDateSchema,
    updated_from: optionalDateSchema,
    updated_to: optionalDateSchema,
    assigned_by: z.string().uuid().optional(),
    created_by: z.string().uuid().optional(),
    has_attachments: booleanQuerySchema.optional(),
    has_notes: booleanQuerySchema.optional(),
    is_blocked: booleanQuerySchema.optional(),
    is_blocking: booleanQuerySchema.optional(),
    parent_task_id: z.string().uuid().nullable().optional(),
    include_archived: booleanQuerySchema.default(false),
    sort_by: z.enum(['created_at', 'updated_at', 'deadline', 'priority', 'status', 'title', 'progress']).default('created_at'),
    sort_order: z.enum(['ASC', 'DESC']).default('DESC'),
    page: pageSchema,
    limit: limitSchema,
  }),
});

// ─── Subtask Schemas ─────────────────────────────────────────────────────────

export const createSubtaskSchema = z.object({
  body: z.object({
    task_id: z.string().uuid('Task ID must be a valid UUID'),
    title: z.string().min(1, 'Title is required').max(255),
    description: z.string().max(1000).nullable().optional(),
    assigned_to: z.string().uuid().nullable().optional(),
    due_date: optionalDateSchema,
    priority: priorityEnum.default('normal'),
  }),
});

export const updateSubtaskSchema = z.object({
  params: z.object({
    id: z.string().uuid('Subtask ID must be a valid UUID'),
  }),
  body: z.object({
    title: z.string().min(1).max(255).optional(),
    description: z.string().max(1000).nullable().optional(),
    completed: z.boolean().optional(),
    assigned_to: z.string().uuid().nullable().optional(),
    due_date: optionalDateSchema,
    priority: priorityEnum.optional(),
  }).refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided to update',
  }),
});

export const subtaskIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Subtask ID must be a valid UUID'),
  }),
});

// ─── Task Note Schemas ──────────────────────────────────────────────────────

export const createTaskNoteSchema = z.object({
  body: z.object({
    task_id: z.string().uuid('Task ID must be a valid UUID'),
    content: z.string().min(1, 'Note content is required').max(5000),
    is_internal: z.boolean().default(false),
    parent_note_id: z.string().uuid().nullable().optional(),
  }),
});

export const updateTaskNoteSchema = z.object({
  params: z.object({
    id: z.string().uuid('Note ID must be a valid UUID'),
  }),
  body: z.object({
    content: z.string().min(1).max(5000).optional(),
    is_internal: z.boolean().optional(),
  }).refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided to update',
  }),
});

export const taskNoteIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Note ID must be a valid UUID'),
  }),
});

// ─── Reminder Schemas ───────────────────────────────────────────────────────

export const createReminderSchema = z.object({
  body: z.object({
    task_id: z.string().uuid('Task ID must be a valid UUID'),
    remind_at: requiredDateSchema,
    repeat: reminderRepeatEnum.default('none'),
    message: z.string().max(1000).nullable().optional(),
  }),
});

export const updateReminderSchema = z.object({
  params: z.object({
    id: z.string().uuid('Reminder ID must be a valid UUID'),
  }),
  body: z.object({
    remind_at: requiredDateSchema.optional(),
    repeat: reminderRepeatEnum.optional(),
    message: z.string().max(1000).nullable().optional(),
  }).refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided to update',
  }),
});

export const reminderIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Reminder ID must be a valid UUID'),
  }),
});

// ─── Task Attachment Schemas ────────────────────────────────────────────────

export const taskAttachmentSchema = z.object({
  params: z.object({
    taskId: z.string().uuid('Task ID must be a valid UUID'),
  }),
  body: z.object({
    file: z.any(), // Handled by multer
  }),
});

export const taskAttachmentIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Attachment ID must be a valid UUID'),
  }),
});

// ─── Task Activity Schemas ──────────────────────────────────────────────────

export const taskActivitySchema = z.object({
  params: z.object({
    taskId: z.string().uuid('Task ID must be a valid UUID'),
  }),
  query: z.object({
    page: pageSchema,
    limit: limitSchema,
  }),
});

// ─── Task Dependency Schemas ────────────────────────────────────────────────

export const taskDependencySchema = z.object({
  params: z.object({
    taskId: z.string().uuid('Task ID must be a valid UUID'),
  }),
  body: z.object({
    depends_on: z.string().uuid('Task ID must be a valid UUID'),
    dependency_type: dependencyTypeEnum.default('blocked_by'),
  }),
});

export const taskDependencyIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Dependency ID must be a valid UUID'),
  }),
});

// ─── Task Template Schemas ──────────────────────────────────────────────────

export const createTaskTemplateSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'Title is required').max(255),
    description: z.string().max(2000).nullable().optional(),
    type: taskTypeField.default('task'),
    priority: priorityEnum.default('normal'),
    estimated_hours: z.number().min(0).nullable().optional(),
    tags: z.array(z.string()).default([]),
    subtasks: z.array(
      z.object({
        title: z.string().min(1).max(255),
        description: z.string().max(1000).nullable().optional(),
        priority: priorityEnum.default('normal'),
        estimated_hours: z.number().min(0).nullable().optional(),
      })
    ).default([]),
  }),
});

export const updateTaskTemplateSchema = z.object({
  params: z.object({
    id: z.string().uuid('Template ID must be a valid UUID'),
  }),
  body: createTaskTemplateSchema.shape.body.partial().refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided to update',
  }),
});

export const taskTemplateIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Template ID must be a valid UUID'),
  }),
});

// ─── Task Time Tracking Schemas ─────────────────────────────────────────────

export const createTimeEntrySchema = z.object({
  body: z.object({
    task_id: z.string().uuid('Task ID must be a valid UUID'),
    start_time: requiredDateSchema,
    end_time: requiredDateSchema.optional(),
    description: z.string().max(500).nullable().optional(),
    billable: z.boolean().default(false),
  }).refine((data) => {
    if (data.end_time && data.start_time) {
      return new Date(data.end_time) > new Date(data.start_time);
    }
    return true;
  }, {
    message: 'End time must be after start time',
    path: ['end_time'],
  }),
});

export const updateTimeEntrySchema = z.object({
  params: z.object({
    id: z.string().uuid('Time entry ID must be a valid UUID'),
  }),
  body: z.object({
    start_time: requiredDateSchema.optional(),
    end_time: requiredDateSchema.optional(),
    description: z.string().max(500).nullable().optional(),
    billable: z.boolean().optional(),
  }).refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided to update',
  }),
});

export const timeEntryIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Time entry ID must be a valid UUID'),
  }),
});

// ─── Task Watcher Schemas ───────────────────────────────────────────────────

export const addWatcherSchema = z.object({
  params: z.object({
    taskId: z.string().uuid('Task ID must be a valid UUID'),
  }),
  body: z.object({
    user_id: z.string().uuid('User ID must be a valid UUID'),
  }),
});

export const removeWatcherSchema = z.object({
  params: z.object({
    taskId: z.string().uuid('Task ID must be a valid UUID'),
    userId: z.string().uuid('User ID must be a valid UUID'),
  }),
});

// ─── Task Export Schema ─────────────────────────────────────────────────────
// NOTE: flat date_from/date_to (not a nested date_range object) — this must
// match TaskExportOptions in tasks.types.ts exactly, since the service builds
// TaskExportOptions straight from this parsed query with no reshaping step.

export const taskExportSchema = z.object({
  query: z.object({
    format: z.enum(['csv', 'json', 'pdf', 'excel']).default('json'),
    fields: z.array(z.string()).default([]),
    include_subtasks: booleanQuerySchema.default(true),
    include_notes: booleanQuerySchema.default(true),
    include_attachments: booleanQuerySchema.default(false),
    date_from: optionalDateSchema,
    date_to: optionalDateSchema,
  }),
});

// ─── Task Dashboard / Stats Schemas ────────────────────────────────────────

export const taskStatsSchema = z.object({
  query: z.object({
    user_id: z.string().uuid().optional(),
    project_id: z.string().uuid().optional(),
    date_from: optionalDateSchema,
    date_to: optionalDateSchema,
  }),
});

export const userTaskStatsSchema = z.object({
  query: z.object({
    user_id: z.string().uuid().optional(),
    date_from: optionalDateSchema,
    date_to: optionalDateSchema,
  }),
});

// ─── Inferred Types ─────────────────────────────────────────────────────────
// This is the single source of truth for every input/filter shape that
// crosses the wire. tasks.types.ts imports these rather than redefining
// them — do not hand-duplicate these shapes anywhere else.

export type CreateProjectInput = z.infer<typeof createProjectSchema>['body'];
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>['body'] & { id: string };
export type ProjectIdParams = z.infer<typeof projectIdSchema>['params'];

export type CreateTaskInput = z.infer<typeof createTaskSchema>['body'];
// FIX: dropped the phantom `& { id: string }`. Neither the controller nor
// TaskService.updateTask ever set/read `data.id` — `id` is always passed as
// a separate positional argument (`updateTask(id, data, userId)`). The
// controller previously worked around this by typing its local `data` as
// `any` (see tasks.controller.ts updateTask), which silently defeated type
// checking against this type entirely. Now the type matches reality, so
// the controller can drop the `any` and get real checking back.
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>['body'];
export type TaskIdParams = z.infer<typeof taskIdSchema>['params'];
export type TaskFilters = z.infer<typeof taskFiltersSchema>['query'];

export type CreateSubtaskInput = z.infer<typeof createSubtaskSchema>['body'];
// FIX: same phantom-id issue as UpdateTaskInput above — TaskService.updateSubtask
// takes `id` positionally and never reads `data.id`.
export type UpdateSubtaskInput = z.infer<typeof updateSubtaskSchema>['body'];
export type SubtaskIdParams = z.infer<typeof subtaskIdSchema>['params'];

export type CreateTaskNoteInput = z.infer<typeof createTaskNoteSchema>['body'];
// NOTE: UpdateTaskNoteInput intentionally NOT exported here. TaskService
// .updateTaskNote's real parameter type is `Partial<Pick<TaskNote, 'content'
// | 'is_internal'>>` (derived from the DB row type in tasks.types.ts), which
// is what's actually enforced — a separately-inferred type from this schema
// was dead code nothing consumed, and having two divergent "update task
// note" types on the books invites exactly the kind of drift this cleanup
// is fixing. If you need a validator-inferred type again later, wire it
// into TaskService.updateTaskNote's signature at the same time so there's
// only one source of truth.

export type CreateReminderInput = z.infer<typeof createReminderSchema>['body'];
// NOTE: UpdateReminderInput intentionally NOT exported — same reasoning as
// UpdateTaskNoteInput above. TaskService.updateReminder's real parameter
// type is `Partial<Pick<Reminder, 'remind_at' | 'repeat' | 'message'>>`.

export type CreateTaskTemplateInput = z.infer<typeof createTaskTemplateSchema>['body'];
export type UpdateTaskTemplateInput = z.infer<typeof updateTaskTemplateSchema>['body'] & { id: string };
export type TaskTemplateIdParams = z.infer<typeof taskTemplateIdSchema>['params'];

export type CreateTimeEntryInput = z.infer<typeof createTimeEntrySchema>['body'];
export type UpdateTimeEntryInput = z.infer<typeof updateTimeEntrySchema>['body'] & { id: string };
export type TimeEntryIdParams = z.infer<typeof timeEntryIdSchema>['params'];

export type AddWatcherInput = z.infer<typeof addWatcherSchema>['body'];
export type RemoveWatcherParams = z.infer<typeof removeWatcherSchema>['params'];
export type TaskExportQuery = z.infer<typeof taskExportSchema>['query'];
export type TaskStatsQuery = z.infer<typeof taskStatsSchema>['query'];
export type UserTaskStatsQuery = z.infer<typeof userTaskStatsSchema>['query'];

// Shared fixed-domain types, re-exported for convenience where a DB-row type
// (in tasks.types.ts) needs the same closed vocabulary as the input schemas.
export type Priority = z.infer<typeof priorityEnum>;
export type ProjectStatus = z.infer<typeof projectStatusEnum>;
export type ReminderRepeat = z.infer<typeof reminderRepeatEnum>;
export type DependencyType = z.infer<typeof dependencyTypeEnum>;