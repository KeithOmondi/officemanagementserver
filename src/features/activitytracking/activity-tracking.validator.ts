// activity-tracking.validator.ts
// Follows the same { body, params, query }-wrapped convention as
// registry.validator.ts / principal-registry-report.validator.ts.

import { z } from 'zod';

const isoDate = (v: string) => !isNaN(Date.parse(v));

// ── Shared contact fields ────────────────────────────────────────────────────

const contactFields = {
  contactSource: z.enum(['judge', 'manual']),
  judgeId: z.string().uuid().nullable().optional(),
  contactName: z.string().min(1, 'Contact name is required'),
  contactPhone: z.string().nullable().optional(),
  contactEmail: z.string().email().nullable().optional(),
};

function checkContactConsistency(
  data: { contactSource: 'judge' | 'manual'; judgeId?: string | null },
  ctx: z.RefinementCtx
) {
  if (data.contactSource === 'judge' && !data.judgeId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'judgeId is required when contactSource is judge',
      path: ['judgeId'],
    });
  }
  if (data.contactSource === 'manual' && data.judgeId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'judgeId must be omitted when contactSource is manual',
      path: ['judgeId'],
    });
  }
}

// ── Activity log body schemas ────────────────────────────────────────────────

const createActivityLogBodySchema = z
  .object({
    ...contactFields,
    departmentId: z.string().uuid(),
    channel: z.enum(['call', 'email', 'whatsapp', 'in_person', 'letter', 'other']).default('other'),
    summary: z.string().min(1, 'Summary is required'),
    occurredAt: z.string().refine(isoDate, 'Invalid date'),
  })
  .superRefine(checkContactConsistency);

const updateActivityLogBodySchema = z.object({
  contactSource: z.enum(['judge', 'manual']).optional(),
  judgeId: z.string().uuid().nullable().optional(),
  contactName: z.string().min(1).optional(),
  contactPhone: z.string().nullable().optional(),
  contactEmail: z.string().email().nullable().optional(),
  departmentId: z.string().uuid().optional(),
  channel: z.enum(['call', 'email', 'whatsapp', 'in_person', 'letter', 'other']).optional(),
  summary: z.string().min(1).optional(),
  occurredAt: z.string().refine(isoDate, 'Invalid date').optional(),
});

const activityLogIdSchema = z.object({ id: z.string().uuid('Invalid activity log id') });

const activityLogListQuerySchema = z.object({
  staffId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  judgeId: z.string().uuid().optional(),
  channel: z.enum(['call', 'email', 'whatsapp', 'in_person', 'letter', 'other']).optional(),
  dateFrom: z.string().refine(isoDate, 'Invalid date').optional(),
  dateTo: z.string().refine(isoDate, 'Invalid date').optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().optional(),
});

export const createActivityLogSchema = z.object({ body: createActivityLogBodySchema });
export const updateActivityLogSchema = z.object({
  params: activityLogIdSchema,
  body: updateActivityLogBodySchema,
});
export const activityLogIdParamSchema = z.object({ params: activityLogIdSchema });
export const activityLogFiltersSchema = z.object({ query: activityLogListQuerySchema });

export type CreateActivityLogInput = z.infer<typeof createActivityLogBodySchema>;
export type UpdateActivityLogInput = z.infer<typeof updateActivityLogBodySchema>;
export type ActivityLogListQuery = z.infer<typeof activityLogListQuerySchema>;

// ── Reminder body schemas ────────────────────────────────────────────────────

const createReminderBodySchema = z
  .object({
    ...contactFields,
    departmentId: z.string().uuid(),
    relatedActivityId: z.string().uuid().nullable().optional(),
    message: z.string().min(1, 'Reminder message is required'),
    dueDate: z.string().refine(isoDate, 'Invalid date'),
  })
  .superRefine(checkContactConsistency);

const updateReminderBodySchema = z.object({
  contactSource: z.enum(['judge', 'manual']).optional(),
  judgeId: z.string().uuid().nullable().optional(),
  contactName: z.string().min(1).optional(),
  contactPhone: z.string().nullable().optional(),
  contactEmail: z.string().email().nullable().optional(),
  departmentId: z.string().uuid().optional(),
  relatedActivityId: z.string().uuid().nullable().optional(),
  message: z.string().min(1).optional(),
  dueDate: z.string().refine(isoDate, 'Invalid date').optional(),
  // Updated status enum with all new statuses
  status: z.enum(['pending', 'in_progress', 'upcoming', 'overdue', 'completed', 'cancelled']).optional(),
});

const snoozeReminderBodySchema = z.object({
  dueDate: z.string().refine(isoDate, 'Invalid date'),
});

const reminderIdSchema = z.object({ id: z.string().uuid('Invalid reminder id') });

const reminderListQuerySchema = z.object({
  staffId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  // Updated status enum with all new statuses
  status: z.enum(['pending', 'in_progress', 'upcoming', 'overdue', 'completed', 'cancelled']).optional(),
  dueBefore: z.string().refine(isoDate, 'Invalid date').optional(),
  dueOn: z.string().refine(isoDate, 'Invalid date').optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

const dueRemindersQuerySchema = z.object({
  staffId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
});

export const createReminderSchema = z.object({ body: createReminderBodySchema });
export const updateReminderSchema = z.object({
  params: reminderIdSchema,
  body: updateReminderBodySchema,
});
export const snoozeReminderSchema = z.object({
  params: reminderIdSchema,
  body: snoozeReminderBodySchema,
});
export const reminderIdParamSchema = z.object({ params: reminderIdSchema });
export const reminderFiltersSchema = z.object({ query: reminderListQuerySchema });
export const dueRemindersFiltersSchema = z.object({ query: dueRemindersQuerySchema });

export type CreateReminderInput = z.infer<typeof createReminderBodySchema>;
export type UpdateReminderInput = z.infer<typeof updateReminderBodySchema>;
export type SnoozeReminderInput = z.infer<typeof snoozeReminderBodySchema>;
export type ReminderListQuery = z.infer<typeof reminderListQuerySchema>;
export type DueRemindersQuery = z.infer<typeof dueRemindersQuerySchema>;