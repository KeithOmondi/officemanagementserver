// src/features/tasks/tasks.validator.ts
import { z } from 'zod';

// ─── Enums ────────────────────────────────────────────────────────────────────

const taskDayEnum = z.enum(['Today', 'Tomorrow', 'Upcoming', 'Someday']);
const taskStatusEnum = z.enum(['pending', 'completed', 'archived']);
const taskPriorityEnum = z.enum(['low', 'medium', 'high', 'urgent']);
const taskRecurrencePatternEnum = z.enum(['none', 'daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly', 'custom']);
const taskRecurrenceEndTypeEnum = z.enum(['never', 'after', 'on_date']);
const reminderTypeEnum = z.enum(['email', 'push', 'sms', 'in_app']);
const dependencyTypeEnum = z.enum(['blocks', 'blocks_completion', 'relates_to']);
const eventTypeEnum = z.enum([
  'created',
  'updated',
  'deleted',
  'completed',
  'uncompleted',
  'archived',
  'unarchived',
  'assigned',
  'unassigned',
  'due_date_changed',
  'priority_changed',
  'status_changed',
  'list_changed',
  'subtask_added',
  'subtask_completed',
  'subtask_deleted',
  'comment_added',
  'comment_edited',
  'comment_deleted',
  'attachment_added',
  'attachment_deleted',
  'tag_added',
  'tag_removed',
  'reminder_added',
  'reminder_sent',
  'reminder_deleted',      // ✅ ADDED
  'dependency_added',
  'dependency_removed',
  'recurrence_created',
  'recurrence_updated',
  'recurrence_deleted'     // ✅ ADDED
]);

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

/**
 * Transform date strings to Date objects
 */
const dateStringToDate = z.preprocess(
  (arg) => {
    if (typeof arg === 'string' || arg instanceof Date) {
      const date = new Date(arg);
      return isNaN(date.getTime()) ? arg : date;
    }
    return arg;
  },
  z.date().nullable()
);

/**
 * Transform time string (HH:MM) to validate format
 */
const timeStringSchema = z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)');

/**
 * Transform boolean string to boolean
 */
const booleanStringSchema = z.enum(['true', 'false']).transform(v => v === 'true');

// ─── Create Task ──────────────────────────────────────────────────────────────

export const createTaskSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'Title is required').max(255).trim(),
    description: z.string().max(5000).trim().optional(),
    list_id: z.string().uuid().optional().nullable(),
    day: taskDayEnum.default('Today'),
    in_my_day: z.boolean().default(false),
    notes: z.string().max(2000).trim().optional(),
    priority: taskPriorityEnum.default('medium'),
    due_date: dateStringToDate.optional().nullable(),
    assigned_to: z.string().uuid().optional().nullable(),
    assigned_to_name: z.string().max(100).optional(),
    tags: z.array(z.string().max(50)).optional(),
    parent_task_id: z.string().uuid().optional().nullable(),
    estimated_hours: z.number().positive().optional(),
    start_date: dateStringToDate.optional().nullable(),
    color: z.string().max(20).optional(),
    position: z.number().int().min(0).optional(),
    is_favorite: z.boolean().default(false),
    recurrence: z.object({
      pattern: taskRecurrencePatternEnum,
      interval: z.number().int().min(1).default(1),
      day_of_week: z.array(z.number().int().min(0).max(6)).optional(),
      day_of_month: z.number().int().min(1).max(31).optional(),
      month_of_year: z.number().int().min(1).max(12).optional(),
      end_type: taskRecurrenceEndTypeEnum.default('never'),
      end_after_count: z.number().int().min(1).optional(),
      end_date: dateStringToDate.optional(),
    }).optional(),
  }).strict().transform((data) => ({
    ...data,
    list_id: nullToUndefined(data.list_id),
    description: nullToUndefined(data.description),
    notes: nullToUndefined(data.notes),
    due_date: nullToUndefined(data.due_date),
    assigned_to: nullToUndefined(data.assigned_to),
    parent_task_id: nullToUndefined(data.parent_task_id),
    estimated_hours: nullToUndefined(data.estimated_hours),
    start_date: nullToUndefined(data.start_date),
    position: nullToUndefined(data.position),
    color: nullToUndefined(data.color),
  })),
});

// ─── Update Task ──────────────────────────────────────────────────────────────

export const updateTaskSchema = z.object({
  params: z.object({
    id: z.string().uuid('Task ID must be a valid UUID'),
  }),
  body: z.object({
    title: z.string().min(1).max(255).trim().optional(),
    description: z.string().max(5000).trim().optional().nullable(),
    list_id: z.string().uuid().optional().nullable(),
    status: taskStatusEnum.optional(),
    day: taskDayEnum.optional(),
    in_my_day: z.boolean().optional(),
    notes: z.string().max(2000).trim().optional().nullable(),
    priority: taskPriorityEnum.optional(),
    due_date: dateStringToDate.optional().nullable(),
    assigned_to: z.string().uuid().optional().nullable(),
    assigned_to_name: z.string().max(100).optional().nullable(),
    tags: z.array(z.string().max(50)).optional(),
    reminder_date: z.string().date().optional().nullable(),
    reminder_time: timeStringSchema.optional().nullable(),
    parent_task_id: z.string().uuid().optional().nullable(),
    estimated_hours: z.number().positive().optional().nullable(),
    actual_hours: z.number().positive().optional().nullable(),
    start_date: dateStringToDate.optional().nullable(),
    color: z.string().max(20).optional().nullable(),
    position: z.number().int().min(0).optional(),
    is_favorite: z.boolean().optional(),
  }).strict()
  .refine((b) => Object.keys(b).length > 0, {
    message: 'At least one field must be provided to update',
  })
  .transform((data) => {
    const result: any = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        result[key] = value === null ? undefined : value;
      }
    }
    return result;
  }),
});

// ─── Bulk Update Tasks ──────────────────────────────────────────────────────

export const bulkUpdateTasksSchema = z.object({
  body: z.object({
    task_ids: z.array(z.string().uuid()).min(1, 'At least one task ID is required'),
    data: z.object({
      status: taskStatusEnum.optional(),
      list_id: z.string().uuid().optional().nullable(),
      priority: taskPriorityEnum.optional(),
      assigned_to: z.string().uuid().optional().nullable(),
      in_my_day: z.boolean().optional(),
      day: taskDayEnum.optional(),
      tags: z.array(z.string().max(50)).optional(),
    }).strict(),
  }).strict(),
});

// ─── Bulk Task Action ──────────────────────────────────────────────────────

export const bulkTaskActionSchema = z.object({
  body: z.object({
    action: z.enum(['complete', 'uncomplete', 'archive', 'unarchive', 'delete', 'assign', 'change_list', 'change_priority', 'add_tags', 'remove_tags']),
    task_ids: z.array(z.string().uuid()).min(1, 'At least one task ID is required'),
    value: z.any().optional(),
  }).strict(),
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
    description: z.string().max(1000).trim().optional(),
    priority: taskPriorityEnum.default('medium'),
    due_date: dateStringToDate.optional().nullable(),
    assigned_to: z.string().uuid().optional().nullable(),
    assigned_to_name: z.string().max(100).optional(),
    position: z.number().int().min(0).optional(),
  }).strict().transform((data) => ({
    ...data,
    description: nullToUndefined(data.description),
    due_date: nullToUndefined(data.due_date),
    assigned_to: nullToUndefined(data.assigned_to),
  })),
});

// ─── Update Subtask ──────────────────────────────────────────────────────────

export const updateSubtaskSchema = z.object({
  params: z.object({
    taskId: z.string().uuid('Task ID must be a valid UUID'),
    subtaskId: z.string().uuid('Subtask ID must be a valid UUID'),
  }),
  body: z.object({
    title: z.string().min(1).max(255).trim().optional(),
    description: z.string().max(1000).trim().optional().nullable(),
    completed: z.boolean().optional(),
    priority: taskPriorityEnum.optional(),
    due_date: dateStringToDate.optional().nullable(),
    assigned_to: z.string().uuid().optional().nullable(),
    assigned_to_name: z.string().max(100).optional().nullable(),
    position: z.number().int().min(0).optional(),
  }).strict()
  .refine((b) => Object.keys(b).length > 0, {
    message: 'At least one field must be provided to update',
  })
  .transform((data) => {
    const result: any = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        result[key] = value === null ? undefined : value;
      }
    }
    return result;
  }),
});

// ─── Bulk Update Subtasks ──────────────────────────────────────────────────

export const bulkUpdateSubtasksSchema = z.object({
  body: z.object({
    subtask_ids: z.array(z.string().uuid()).min(1, 'At least one subtask ID is required'),
    data: z.object({
      completed: z.boolean().optional(),
      priority: taskPriorityEnum.optional(),
      assigned_to: z.string().uuid().optional().nullable(),
    }).strict(),
  }).strict(),
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
    description: z.string().max(500).trim().optional(),
    color: z.string().max(20).optional(),
    icon: z.string().max(50).optional(),
    is_shared: z.boolean().default(false),
    is_shared_with_public: z.boolean().default(false),
    member_ids: z.array(z.string().uuid()).optional(),
    position: z.number().int().min(0).optional(),
  }).strict().transform((data) => ({
    ...data,
    description: nullToUndefined(data.description),
    color: nullToUndefined(data.color),
    icon: nullToUndefined(data.icon),
    position: nullToUndefined(data.position),
  })),
});

// ─── Update Task List ────────────────────────────────────────────────────────

export const updateTaskListSchema = z.object({
  params: z.object({
    id: z.string().uuid('List ID must be a valid UUID'),
  }),
  body: z.object({
    name: z.string().min(1).max(100).trim().optional(),
    description: z.string().max(500).trim().optional().nullable(),
    color: z.string().max(20).optional().nullable(),
    icon: z.string().max(50).optional().nullable(),
    is_shared: z.boolean().optional(),
    is_shared_with_public: z.boolean().optional(),
    position: z.number().int().min(0).optional(),
  }).strict()
  .refine((b) => Object.keys(b).length > 0, {
    message: 'At least one field must be provided to update',
  })
  .transform((data) => {
    const result: any = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        result[key] = value === null ? undefined : value;
      }
    }
    return result;
  }),
});

// ─── Add List Members ──────────────────────────────────────────────────────

export const addListMembersSchema = z.object({
  params: z.object({
    id: z.string().uuid('List ID must be a valid UUID'),
  }),
  body: z.object({
    user_ids: z.array(z.string().uuid()).min(1, 'At least one user ID is required'),
    role: z.enum(['admin', 'editor', 'viewer']).default('viewer'),
  }).strict(),
});

// ─── Update List Member ──────────────────────────────────────────────────

export const updateListMemberSchema = z.object({
  params: z.object({
    id: z.string().uuid('List ID must be a valid UUID'),
    userId: z.string().uuid('User ID must be a valid UUID'),
  }),
  body: z.object({
    role: z.enum(['admin', 'editor', 'viewer']),
    permissions: z.array(z.string()).optional(),
  }).strict(),
});

// ─── Delete Task List ────────────────────────────────────────────────────────

export const deleteTaskListSchema = z.object({
  params: z.object({
    id: z.string().uuid('List ID must be a valid UUID'),
  }),
});

// ─── Create Reminder ──────────────────────────────────────────────────────

export const createReminderSchema = z.object({
  body: z.object({
    task_id: z.string().uuid('Task ID must be a valid UUID'),
    reminder_date: z.string().date(),
    reminder_time: timeStringSchema,
    reminder_type: reminderTypeEnum.default('in_app'),
    note: z.string().max(500).trim().optional(),
    user_id: z.string().uuid().optional(),
  }).strict().transform((data) => ({
    ...data,
    note: nullToUndefined(data.note),
    user_id: nullToUndefined(data.user_id),
  })),
});

// ─── Update Reminder ──────────────────────────────────────────────────────

export const updateReminderSchema = z.object({
  params: z.object({
    id: z.string().uuid('Reminder ID must be a valid UUID'),
  }),
  body: z.object({
    reminder_date: z.string().date().optional(),
    reminder_time: timeStringSchema.optional(),
    reminder_type: reminderTypeEnum.optional(),
    note: z.string().max(500).trim().optional().nullable(),
    is_active: z.boolean().optional(),
  }).strict()
  .refine((b) => Object.keys(b).length > 0, {
    message: 'At least one field must be provided to update',
  })
  .transform((data) => {
    const result: any = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        result[key] = value === null ? undefined : value;
      }
    }
    return result;
  }),
});

// ─── Delete Reminder ──────────────────────────────────────────────────────

export const deleteReminderSchema = z.object({
  params: z.object({
    id: z.string().uuid('Reminder ID must be a valid UUID'),
  }),
});

// ─── Create Comment ──────────────────────────────────────────────────────

export const createCommentSchema = z.object({
  params: z.object({
    taskId: z.string().uuid('Task ID must be a valid UUID'),
  }),
  body: z.object({
    content: z.string().min(1, 'Comment content is required').max(2000).trim(),
    mentions: z.array(z.string().uuid()).optional(),
    attachment_ids: z.array(z.string().uuid()).optional(),
    parent_comment_id: z.string().uuid().optional().nullable(),
  }).strict().transform((data) => ({
    ...data,
    parent_comment_id: nullToUndefined(data.parent_comment_id),
  })),
});

// ─── Update Comment ──────────────────────────────────────────────────────

export const updateCommentSchema = z.object({
  params: z.object({
    id: z.string().uuid('Comment ID must be a valid UUID'),
  }),
  body: z.object({
    content: z.string().min(1).max(2000).trim(),
    mentions: z.array(z.string().uuid()).optional(),
  }).strict(),
});

// ─── Delete Comment ──────────────────────────────────────────────────────

export const deleteCommentSchema = z.object({
  params: z.object({
    id: z.string().uuid('Comment ID must be a valid UUID'),
  }),
});

// ─── Create Tag ──────────────────────────────────────────────────────────────

export const createTagSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Tag name is required').max(50).trim(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format (must be hex)'),
    description: z.string().max(200).trim().optional(),
  }).strict(),
});

// ─── Update Tag ──────────────────────────────────────────────────────────────

export const updateTagSchema = z.object({
  params: z.object({
    id: z.string().uuid('Tag ID must be a valid UUID'),
  }),
  body: z.object({
    name: z.string().min(1).max(50).trim().optional(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format (must be hex)').optional(),
    description: z.string().max(200).trim().optional().nullable(),
    is_active: z.boolean().optional(),
  }).strict()
  .refine((b) => Object.keys(b).length > 0, {
    message: 'At least one field must be provided to update',
  })
  .transform((data) => {
    const result: any = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        result[key] = value === null ? undefined : value;
      }
    }
    return result;
  }),
});

// ─── Create Task Dependency ──────────────────────────────────────────────

export const createDependencySchema = z.object({
  body: z.object({
    parent_task_id: z.string().uuid('Parent task ID must be a valid UUID'),
    dependent_task_id: z.string().uuid('Dependent task ID must be a valid UUID'),
    dependency_type: dependencyTypeEnum.default('blocks_completion'),
  }).strict(),
});

// ─── Delete Task Dependency ──────────────────────────────────────────────

export const deleteDependencySchema = z.object({
  params: z.object({
    id: z.string().uuid('Dependency ID must be a valid UUID'),
  }),
});

// ─── Update Recurrence ──────────────────────────────────────────────────

export const updateRecurrenceSchema = z.object({
  params: z.object({
    taskId: z.string().uuid('Task ID must be a valid UUID'),
  }),
  body: z.object({
    pattern: taskRecurrencePatternEnum.optional(),
    interval: z.number().int().min(1).optional(),
    day_of_week: z.array(z.number().int().min(0).max(6)).optional(),
    day_of_month: z.number().int().min(1).max(31).optional(),
    month_of_year: z.number().int().min(1).max(12).optional(),
    end_type: taskRecurrenceEndTypeEnum.optional(),
    end_after_count: z.number().int().min(1).optional().nullable(),
    end_date: dateStringToDate.optional().nullable(),
    is_active: z.boolean().optional(),
  }).strict()
  .refine((b) => Object.keys(b).length > 0, {
    message: 'At least one field must be provided to update',
  })
  .transform((data) => {
    const result: any = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        result[key] = value === null ? undefined : value;
      }
    }
    return result;
  }),
});

// ─── Move Task ──────────────────────────────────────────────────────────────

export const moveTaskSchema = z.object({
  params: z.object({
    id: z.string().uuid('Task ID must be a valid UUID'),
  }),
  body: z.object({
    new_day: taskDayEnum.optional(),
    new_list_id: z.string().uuid().optional().nullable(),
    new_position: z.number().int().min(0).optional(),
    new_parent_task_id: z.string().uuid().optional().nullable(),
  }).strict()
  .refine((b) => Object.keys(b).length > 0, {
    message: 'At least one move action must be specified',
  })
  .transform((data) => ({
    ...data,
    new_list_id: nullToUndefined(data.new_list_id),
    new_parent_task_id: nullToUndefined(data.new_parent_task_id),
  })),
});

// ─── Copy Task ──────────────────────────────────────────────────────────────

export const copyTaskSchema = z.object({
  params: z.object({
    id: z.string().uuid('Task ID must be a valid UUID'),
  }),
  body: z.object({
    new_list_id: z.string().uuid().optional(),
    new_day: taskDayEnum.optional(),
    include_subtasks: z.boolean().default(true),
    include_attachments: z.boolean().default(true),
  }).strict(),
});

// ─── Task Filters ────────────────────────────────────────────────────────────

export const taskFiltersSchema = z.object({
  query: z.object({
    list_id: z.string().uuid().optional(),
    status: z.union([taskStatusEnum, z.array(taskStatusEnum)]).optional(),
    day: z.union([taskDayEnum, z.array(taskDayEnum)]).optional(),
    in_my_day: booleanStringSchema.optional(),
    assigned_to: z.union([z.string().uuid(), z.array(z.string().uuid())]).optional(),
    created_by: z.string().uuid().optional(),
    tags: z.string().optional(),
    search: z.string().trim().max(100).optional(),
    due_from: z.string().datetime().optional(),
    due_to: z.string().datetime().optional(),
    due_date_range: z.enum(['overdue', 'today', 'tomorrow', 'this_week', 'next_week', 'this_month', 'no_due_date']).optional(),
    priority: z.union([taskPriorityEnum, z.array(taskPriorityEnum)]).optional(),
    parent_task_id: z.string().uuid().optional().nullable(),
    has_subtasks: booleanStringSchema.optional(),
    has_attachments: booleanStringSchema.optional(),
    has_comments: booleanStringSchema.optional(),
    is_favorite: booleanStringSchema.optional(),
    is_recurring: booleanStringSchema.optional(),
    completed_from: z.string().datetime().optional(),
    completed_to: z.string().datetime().optional(),
    reminder_date_from: z.string().datetime().optional(),
    reminder_date_to: z.string().datetime().optional(),
    page: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1)).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
    sort_by: z.enum(['created_at', 'updated_at', 'due_date', 'priority', 'title', 'position', 'completed_at', 'start_date']).optional(),
    sort_order: z.enum(['ASC', 'DESC']).optional(),
    include_deleted: booleanStringSchema.optional(),
    include_subtasks: booleanStringSchema.optional(),
    include_attachments: booleanStringSchema.optional(),
    include_comments: booleanStringSchema.optional(),
    include_dependencies: booleanStringSchema.optional(),
    include_recurrence: booleanStringSchema.optional(),
  }).transform((data) => {
    const result: any = { ...data };
    
    // Parse tags
    if (data.tags) {
      result.tags = data.tags.split(',').map(t => t.trim()).filter(Boolean);
    }
    
    // Handle null parent_task_id
    if (data.parent_task_id === 'null') {
      result.parent_task_id = null;
    }
    
    return result;
  }),
});

// ─── Task Summary ────────────────────────────────────────────────────────────

export const taskSummarySchema = z.object({
  query: z.object({
    list_id: z.string().uuid().optional(),
    assigned_to: z.string().uuid().optional(),
    include_details: booleanStringSchema.optional(),
  }).optional(),
});

// ─── Task Timeline ──────────────────────────────────────────────────────────

export const taskTimelineSchema = z.object({
  query: z.object({
    start_date: z.string().datetime({ offset: true }),
    end_date: z.string().datetime({ offset: true }),
    group_by: z.enum(['day', 'week', 'month', 'quarter', 'year']).default('day'),
    list_id: z.string().uuid().optional(),
    assigned_to: z.string().uuid().optional(),
    status: z.union([taskStatusEnum, z.array(taskStatusEnum)]).optional(),
    include_completed: booleanStringSchema.default(true),
  }).strict(),
});

// ─── Task Analytics ─────────────────────────────────────────────────────────

export const taskAnalyticsSchema = z.object({
  query: z.object({
    list_id: z.string().uuid().optional(),
    assigned_to: z.string().uuid().optional(),
    from_date: z.string().datetime().optional(),
    to_date: z.string().datetime().optional(),
  }).optional(),
});

// ─── Search Tasks ──────────────────────────────────────────────────────────

export const taskSearchSchema = z.object({
  body: z.object({
    query: z.string().min(1, 'Search query is required').trim(),
    filters: z.object({
      list_id: z.string().uuid().optional(),
      status: z.union([taskStatusEnum, z.array(taskStatusEnum)]).optional(),
      day: z.union([taskDayEnum, z.array(taskDayEnum)]).optional(),
      priority: z.union([taskPriorityEnum, z.array(taskPriorityEnum)]).optional(),
      assigned_to: z.union([z.string().uuid(), z.array(z.string().uuid())]).optional(),
      due_date_range: z.enum(['overdue', 'today', 'tomorrow', 'this_week', 'next_week', 'this_month', 'no_due_date']).optional(),
    }).partial().optional(),
    highlight_matches: z.boolean().default(true),
    fuzzy_match: z.boolean().default(false),
    search_fields: z.array(z.enum(['title', 'description', 'notes', 'subtasks', 'comments'])).default(['title', 'description']),
  }).strict(),
});

// ─── Export Tasks ──────────────────────────────────────────────────────────

export const taskExportSchema = z.object({
  body: z.object({
    format: z.enum(['json', 'csv', 'pdf', 'html']),
    filters: z.object({
      list_id: z.string().uuid().optional(),
      status: z.union([taskStatusEnum, z.array(taskStatusEnum)]).optional(),
      day: z.union([taskDayEnum, z.array(taskDayEnum)]).optional(),
      priority: z.union([taskPriorityEnum, z.array(taskPriorityEnum)]).optional(),
      assigned_to: z.union([z.string().uuid(), z.array(z.string().uuid())]).optional(),
    }).partial().optional(),
    include_fields: z.array(z.string()).optional(),
    include_subtasks: z.boolean().default(true),
    include_comments: z.boolean().default(false),
    include_attachments: z.boolean().default(false),
    include_activity_log: z.boolean().default(false),
    date_range: z.object({
      from: z.string().datetime(),
      to: z.string().datetime(),
    }).optional(),
  }).strict(),
});

// ─── Import Tasks ──────────────────────────────────────────────────────────

export const taskImportSchema = z.object({
  body: z.object({
    format: z.enum(['json', 'csv', 'todoist', 'trello', 'asana']),
    data: z.any(),
    merge_strategy: z.enum(['replace', 'merge', 'skip_existing']).default('merge'),
    import_to_list_id: z.string().uuid().optional(),
    mapping: z.record(z.string(), z.string()).optional(),
    dry_run: z.boolean().default(false),
  }).strict(),
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

export const commentIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Comment ID must be a valid UUID'),
  }),
});

export const tagIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Tag ID must be a valid UUID'),
  }),
});

// ─── Task Attachments ────────────────────────────────────────────────────────

export const uploadTaskAttachmentSchema = z.object({
  params: z.object({
    taskId: z.string().uuid('Task ID must be a valid UUID'),
  }),
});

export const deleteTaskAttachmentSchema = z.object({
  params: z.object({
    taskId: z.string().uuid('Task ID must be a valid UUID'),
    attachmentId: z.string().uuid('Attachment ID must be a valid UUID'),
  }),
});

// ─── Notifications ──────────────────────────────────────────────────────────

export const notificationFiltersSchema = z.object({
  query: z.object({
    is_read: booleanStringSchema.optional(),
    event_type: z.union([eventTypeEnum, z.array(eventTypeEnum)]).optional(),
    from_date: z.string().datetime().optional(),
    to_date: z.string().datetime().optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(100)).default(20),
    offset: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(0)).default(0),
  }).optional(),
});

export const markNotificationReadSchema = z.object({
  params: z.object({
    id: z.string().uuid('Notification ID must be a valid UUID'),
  }),
});

export const markAllNotificationsReadSchema = z.object({
  body: z.object({
    event_type: z.union([eventTypeEnum, z.array(eventTypeEnum)]).optional(),
  }).optional(),
});

// ─── Activity Events ──────────────────────────────────────────────────────

export const taskEventsSchema = z.object({
  query: z.object({
    task_id: z.string().uuid().optional(),
    user_id: z.string().uuid().optional(),
    event_type: z.union([eventTypeEnum, z.array(eventTypeEnum)]).optional(),
    from_date: z.string().datetime().optional(),
    to_date: z.string().datetime().optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(200)).default(50),
    offset: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(0)).default(0),
  }).optional(),
});

// ─── Inferred types ──────────────────────────────────────────────────────────

export type CreateTaskInput = z.infer<typeof createTaskSchema>['body'];
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>['body'];
export type BulkUpdateTasksInput = z.infer<typeof bulkUpdateTasksSchema>['body'];
export type BulkTaskActionInput = z.infer<typeof bulkTaskActionSchema>['body'];
export type CreateSubtaskInput = z.infer<typeof createSubtaskSchema>['body'];
export type UpdateSubtaskInput = z.infer<typeof updateSubtaskSchema>['body'];
export type BulkUpdateSubtasksInput = z.infer<typeof bulkUpdateSubtasksSchema>['body'];
export type CreateTaskListInput = z.infer<typeof createTaskListSchema>['body'];
export type UpdateTaskListInput = z.infer<typeof updateTaskListSchema>['body'];
export type AddListMembersInput = z.infer<typeof addListMembersSchema>['body'];
export type UpdateListMemberInput = z.infer<typeof updateListMemberSchema>['body'];
export type CreateReminderInput = z.infer<typeof createReminderSchema>['body'];
export type UpdateReminderInput = z.infer<typeof updateReminderSchema>['body'];
export type CreateCommentInput = z.infer<typeof createCommentSchema>['body'];
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>['body'];
export type CreateTagInput = z.infer<typeof createTagSchema>['body'];
export type UpdateTagInput = z.infer<typeof updateTagSchema>['body'];
export type CreateDependencyInput = z.infer<typeof createDependencySchema>['body'];
export type UpdateRecurrenceInput = z.infer<typeof updateRecurrenceSchema>['body'];
export type MoveTaskInput = z.infer<typeof moveTaskSchema>['body'];
export type CopyTaskInput = z.infer<typeof copyTaskSchema>['body'];
export type TaskFilters = z.infer<typeof taskFiltersSchema>['query'];
export type TaskTimelineFilters = z.infer<typeof taskTimelineSchema>['query'];
export type TaskAnalyticsFilters = z.infer<typeof taskAnalyticsSchema>['query'];
export type TaskSearchInput = z.infer<typeof taskSearchSchema>['body'];
export type TaskExportInput = z.infer<typeof taskExportSchema>['body'];
export type TaskImportInput = z.infer<typeof taskImportSchema>['body'];
export type UploadTaskAttachmentParams = z.infer<typeof uploadTaskAttachmentSchema>['params'];
export type DeleteTaskAttachmentParams = z.infer<typeof deleteTaskAttachmentSchema>['params'];
export type NotificationFilters = z.infer<typeof notificationFiltersSchema>['query'];
export type TaskEventsFilters = z.infer<typeof taskEventsSchema>['query'];