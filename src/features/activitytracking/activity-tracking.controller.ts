// src/features/activity-tracking/activity-tracking.controller.ts
import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { AppError, sendSuccess } from '../../utils/response';
import { ActivityLogService, ActivityReminderService } from './activity-tracking.service';
import {
  createActivityLogSchema,
  updateActivityLogSchema,
  activityLogIdParamSchema,
  activityLogFiltersSchema,
  createReminderSchema,
  updateReminderSchema,
  snoozeReminderSchema,
  reminderIdParamSchema,
  reminderFiltersSchema,
  dueRemindersFiltersSchema,
} from './activity-tracking.validator';

// req.user is already typed globally on Express.Request (see your existing
// Express type augmentation) — no local interface needed here.

// Helpdesk staff only ever see their own activity/reminders; dept heads and
// super admins can see across the whole desk (or filter by staffId if they
// pass one explicitly).
const PRIVILEGED_ROLES: string[] = ['dept_head', 'super_admin'];

function scopeToOwnStaffUnlessPrivileged<T extends { staffId?: string }>(
  filters: T,
  req: Request
): T {
  const isPrivileged = PRIVILEGED_ROLES.includes(req.user?.role as string);
  if (!isPrivileged) {
    return { ...filters, staffId: req.user!.id };
  }
  return filters;
}

export const activityTrackingController = {

  // ═══════════════════════════════════════════════════════════════════════════
  //  ACTIVITY LOG CONTROLLERS
  // ═══════════════════════════════════════════════════════════════════════════

  createActivityLog: asyncHandler(async (req: Request, res: Response) => {
    const result = createActivityLogSchema.safeParse({ body: req.body });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid activity data');
    const log = await ActivityLogService.create(result.data.body, req.user!.id);
    return sendSuccess(res, log, 'Activity logged successfully', 201);
  }),

  getAllActivityLogs: asyncHandler(async (req: Request, res: Response) => {
    const result = activityLogFiltersSchema.safeParse({ query: req.query });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid filters');
    const filters = scopeToOwnStaffUnlessPrivileged(result.data.query, req);
    const logs = await ActivityLogService.findAll(filters);
    return sendSuccess(res, logs, 'Activity logs retrieved successfully');
  }),

  getActivityLogById: asyncHandler(async (req: Request, res: Response) => {
    const result = activityLogIdParamSchema.safeParse({ params: req.params });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
    const log = await ActivityLogService.findById(result.data.params.id);
    if (!log) throw new AppError(404, 'Activity log not found');
    
    // Check permissions: staff can only see their own logs unless privileged
    const isPrivileged = PRIVILEGED_ROLES.includes(req.user?.role as string);
    if (!isPrivileged && log.staffId !== req.user!.id) {
      throw new AppError(403, 'You do not have permission to view this activity log');
    }
    
    return sendSuccess(res, log, 'Activity log retrieved successfully');
  }),

  updateActivityLog: asyncHandler(async (req: Request, res: Response) => {
    const result = updateActivityLogSchema.safeParse({ params: req.params, body: req.body });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid update data');
    
    // Check if the log exists and belongs to the user
    const existingLog = await ActivityLogService.findById(result.data.params.id);
    if (!existingLog) throw new AppError(404, 'Activity log not found');
    
    const isPrivileged = PRIVILEGED_ROLES.includes(req.user?.role as string);
    if (!isPrivileged && existingLog.staffId !== req.user!.id) {
      throw new AppError(403, 'You do not have permission to update this activity log');
    }
    
    const log = await ActivityLogService.update(result.data.params.id, result.data.body);
    return sendSuccess(res, log, 'Activity log updated successfully');
  }),

  deleteActivityLog: asyncHandler(async (req: Request, res: Response) => {
    const result = activityLogIdParamSchema.safeParse({ params: req.params });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
    
    // Check if the log exists and belongs to the user
    const existingLog = await ActivityLogService.findById(result.data.params.id);
    if (!existingLog) throw new AppError(404, 'Activity log not found');
    
    const isPrivileged = PRIVILEGED_ROLES.includes(req.user?.role as string);
    if (!isPrivileged && existingLog.staffId !== req.user!.id) {
      throw new AppError(403, 'You do not have permission to delete this activity log');
    }
    
    const deleted = await ActivityLogService.delete(result.data.params.id);
    if (!deleted) throw new AppError(404, 'Activity log not found');
    return sendSuccess(res, null, 'Activity log deleted successfully');
  }),

  // ═══════════════════════════════════════════════════════════════════════════
  //  REMINDER CONTROLLERS
  // ═══════════════════════════════════════════════════════════════════════════

  createReminder: asyncHandler(async (req: Request, res: Response) => {
    const result = createReminderSchema.safeParse({ body: req.body });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid reminder data');
    const reminder = await ActivityReminderService.create(result.data.body, req.user!.id);
    return sendSuccess(res, reminder, 'Reminder created successfully', 201);
  }),

  getAllReminders: asyncHandler(async (req: Request, res: Response) => {
    const result = reminderFiltersSchema.safeParse({ query: req.query });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid filters');
    const filters = scopeToOwnStaffUnlessPrivileged(result.data.query, req);
    const reminders = await ActivityReminderService.findAll(filters);
    return sendSuccess(res, reminders, 'Reminders retrieved successfully');
  }),

  // Powers the tracking page's "due today / overdue" section.
  getDueReminders: asyncHandler(async (req: Request, res: Response) => {
    const result = dueRemindersFiltersSchema.safeParse({ query: req.query });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid filters');
    const filters = scopeToOwnStaffUnlessPrivileged(result.data.query, req);
    const reminders = await ActivityReminderService.findDue(filters);
    return sendSuccess(res, reminders, 'Due reminders retrieved successfully');
  }),

  getReminderById: asyncHandler(async (req: Request, res: Response) => {
    const result = reminderIdParamSchema.safeParse({ params: req.params });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
    const reminder = await ActivityReminderService.findById(result.data.params.id);
    if (!reminder) throw new AppError(404, 'Reminder not found');
    
    // Check permissions: staff can only see their own reminders unless privileged
    const isPrivileged = PRIVILEGED_ROLES.includes(req.user?.role as string);
    if (!isPrivileged && reminder.staffId !== req.user!.id) {
      throw new AppError(403, 'You do not have permission to view this reminder');
    }
    
    return sendSuccess(res, reminder, 'Reminder retrieved successfully');
  }),

  updateReminder: asyncHandler(async (req: Request, res: Response) => {
    const result = updateReminderSchema.safeParse({ params: req.params, body: req.body });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid update data');
    
    // Check if the reminder exists and belongs to the user
    const existingReminder = await ActivityReminderService.findById(result.data.params.id);
    if (!existingReminder) throw new AppError(404, 'Reminder not found');
    
    const isPrivileged = PRIVILEGED_ROLES.includes(req.user?.role as string);
    if (!isPrivileged && existingReminder.staffId !== req.user!.id) {
      throw new AppError(403, 'You do not have permission to update this reminder');
    }
    
    const reminder = await ActivityReminderService.update(result.data.params.id, result.data.body);
    return sendSuccess(res, reminder, 'Reminder updated successfully');
  }),

  completeReminder: asyncHandler(async (req: Request, res: Response) => {
    const result = reminderIdParamSchema.safeParse({ params: req.params });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
    
    // Check if the reminder exists and belongs to the user
    const existingReminder = await ActivityReminderService.findById(result.data.params.id);
    if (!existingReminder) throw new AppError(404, 'Reminder not found');
    
    const isPrivileged = PRIVILEGED_ROLES.includes(req.user?.role as string);
    if (!isPrivileged && existingReminder.staffId !== req.user!.id) {
      throw new AppError(403, 'You do not have permission to complete this reminder');
    }
    
    const reminder = await ActivityReminderService.complete(result.data.params.id);
    return sendSuccess(res, reminder, 'Reminder marked complete');
  }),

  snoozeReminder: asyncHandler(async (req: Request, res: Response) => {
    const result = snoozeReminderSchema.safeParse({ params: req.params, body: req.body });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid snooze data');
    
    // Check if the reminder exists and belongs to the user
    const existingReminder = await ActivityReminderService.findById(result.data.params.id);
    if (!existingReminder) throw new AppError(404, 'Reminder not found');
    
    const isPrivileged = PRIVILEGED_ROLES.includes(req.user?.role as string);
    if (!isPrivileged && existingReminder.staffId !== req.user!.id) {
      throw new AppError(403, 'You do not have permission to snooze this reminder');
    }
    
    const reminder = await ActivityReminderService.snooze(result.data.params.id, result.data.body.dueDate);
    return sendSuccess(res, reminder, 'Reminder snoozed successfully');
  }),

  deleteReminder: asyncHandler(async (req: Request, res: Response) => {
    const result = reminderIdParamSchema.safeParse({ params: req.params });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
    
    // Check if the reminder exists and belongs to the user
    const existingReminder = await ActivityReminderService.findById(result.data.params.id);
    if (!existingReminder) throw new AppError(404, 'Reminder not found');
    
    const isPrivileged = PRIVILEGED_ROLES.includes(req.user?.role as string);
    if (!isPrivileged && existingReminder.staffId !== req.user!.id) {
      throw new AppError(403, 'You do not have permission to delete this reminder');
    }
    
    const deleted = await ActivityReminderService.delete(result.data.params.id);
    if (!deleted) throw new AppError(404, 'Reminder not found');
    return sendSuccess(res, null, 'Reminder deleted successfully');
  }),
};