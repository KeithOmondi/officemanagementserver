import { z } from 'zod';

// Reusable enums
const priorityEnum = z.enum(['low', 'normal', 'high', 'urgent']);
const statusEnum = z.enum(['todo', 'inprogress', 'done', 'overdue', 'pending_approval']);

// Project schemas
export const createProjectSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().nullable().optional(),
  deadline: z.string().datetime({ message: 'Invalid date format' }),
  priority: priorityEnum.default('normal'),
  members: z.array(z.string()).min(1, 'At least one member is required'),
});

export const updateProjectSchema = createProjectSchema.partial().extend({
  id: z.string().uuid(),
});

// Task schemas
export const createTaskSchema = z.object({
  project_id: z.string().uuid().nullable(),
  title: z.string().min(1, 'Title is required'),
  description: z.string().nullable().optional(),
  // ✅ Removed .default('GROUP') – must be provided
  assignee: z.union([z.string(), z.literal('GROUP')]),
  priority: priorityEnum.default('normal'),
  deadline: z.string().datetime({ message: 'Invalid date format' }),
  start_date: z.string().datetime().nullable().optional(),
});

export const updateTaskSchema = createTaskSchema.partial().extend({
  id: z.string().uuid(),
  status: statusEnum.optional(),
  progress: z.number().min(0).max(100).optional(),
});

// Subtask schemas
export const createSubtaskSchema = z.object({
  task_id: z.string().uuid(),
  title: z.string().min(1),
});

export const updateSubtaskSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).optional(),
  completed: z.boolean().optional(),
});

// Task note schema
export const createTaskNoteSchema = z.object({
  task_id: z.string().uuid(),
  content: z.string().min(1),
});

// Reminder schema
export const createReminderSchema = z.object({
  task_id: z.string().uuid(),
  remind_at: z.string().datetime({ message: 'Invalid date format' }),
});

// Filters (query params)
export const taskFiltersSchema = z.object({
  assignee: z.string().optional(),
  status: statusEnum.optional(),
  project_id: z.string().uuid().optional(),
});