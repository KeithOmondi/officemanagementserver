import { z } from 'zod';

// ── Base ────────────────────────────────────────────────────────────
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');
const prioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);
const statusSchema = z.enum(['active', 'completed', 'archived']);
const taskStatusSchema = z.enum(['pending', 'completed']);   // changed

// ── Project Schemas ────────────────────────────────────────────────
export const createProjectSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(255).trim(),
    description: z.string().optional(),
    priority: prioritySchema.default('medium'),
    deadline: dateSchema,
    member_ids: z.array(z.string().uuid()).optional(),
  }).strict(),
});

export const updateProjectSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(255).trim().optional(),
    description: z.string().optional(),
    status: statusSchema.optional(),
    priority: prioritySchema.optional(),
    deadline: dateSchema.optional(),
    is_active: z.boolean().optional(),
  }).strict().refine(data => Object.keys(data).length > 0, { message: 'At least one field' }),
});

// ── Task Schemas ──────────────────────────────────────────────────
export const createTaskSchema = z.object({
  body: z.object({
    project_id: z.string().uuid().optional(),
    title: z.string().min(1).max(255).trim(),
    description: z.string().optional(),
    priority: prioritySchema.default('medium'),
    assignee_id: z.string().uuid().optional(),
    due_date: dateSchema,
    start_date: dateSchema.optional(),
    remind_at: z.string().datetime().optional(),    // ISO datetime
  }).strict().refine(data => {
    if (data.start_date && data.due_date)
      return new Date(data.due_date) >= new Date(data.start_date);
    return true;
  }, { message: 'due_date must be on or after start_date' }),
});

export const updateTaskSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(255).trim().optional(),
    description: z.string().optional(),
    status: taskStatusSchema.optional(),
    priority: prioritySchema.optional(),
    assignee_id: z.string().uuid().nullable().optional(),
    due_date: dateSchema.optional(),
    start_date: dateSchema.nullable().optional(),
    remind_at: z.string().datetime().nullable().optional(),
    is_active: z.boolean().optional(),
  }).strict().refine(data => {
    if (data.start_date && data.due_date)
      return new Date(data.due_date) >= new Date(data.start_date);
    return true;
  }, { message: 'due_date must be on or after start_date' })
  .refine(data => Object.keys(data).length > 0, { message: 'At least one field' }),
});

// ── Attachment Schemas ────────────────────────────────────────────
export const addAttachmentSchema = z.object({
  body: z.object({
    file_name: z.string().min(1).max(255),
    file_url: z.string().url(),
  }).strict(),
});

export const attachmentIdSchema = z.object({
  params: z.object({
    attachmentId: z.string().uuid(),
  }),
});

// ── Member & ID Schemas ──────────────────────────────────────────
export const addProjectMemberSchema = z.object({
  body: z.object({
    user_id: z.string().uuid(),
    role: z.string().optional(),
  }).strict(),
});

export const projectIdSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});
export const taskIdSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});
export const memberIdSchema = z.object({
  params: z.object({
    projectId: z.string().uuid(),
    memberId: z.string().uuid(),
  }),
});

// Types
export type CreateProjectInput = z.infer<typeof createProjectSchema>['body'];
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>['body'];
export type CreateTaskInput = z.infer<typeof createTaskSchema>['body'];
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>['body'];
export type AddProjectMemberInput = z.infer<typeof addProjectMemberSchema>['body'];
export type AddAttachmentInput = z.infer<typeof addAttachmentSchema>['body'];