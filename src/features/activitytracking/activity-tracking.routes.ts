// src/features/activity-tracking/activity-tracking.routes.ts
// Mount in your main router, e.g.:
//   app.use('/api/activity-logs', activityLogRoutes);
//   app.use('/api/activity-reminders', reminderRoutes);
// or combine under one router and mount at '/api/activity-tracking'.

import { Router } from 'express';
import { activityTrackingController } from './activity-tracking.controller';
import { protect, requireRole } from '../../middleware/auth.middleware';

const router = Router();

router.use(protect);

// ── Activity Logs ────────────────────────────────────────────────────────────

router.post(
  '/logs',
  requireRole('staff', 'dept_head', 'super_admin'),
  activityTrackingController.createActivityLog
);

router.get(
  '/logs',
  requireRole('staff', 'dept_head', 'super_admin'),
  activityTrackingController.getAllActivityLogs
);

router.get(
  '/logs/:id',
  requireRole('staff', 'dept_head', 'super_admin'),
  activityTrackingController.getActivityLogById
);

router.patch(
  '/logs/:id',
  requireRole('staff', 'dept_head', 'super_admin'),
  activityTrackingController.updateActivityLog
);

router.delete(
  '/logs/:id',
  requireRole('dept_head', 'super_admin'),
  activityTrackingController.deleteActivityLog
);

// ── Reminders ─────────────────────────────────────────────────────────────────

router.post(
  '/reminders',
  requireRole('staff', 'dept_head', 'super_admin'),
  activityTrackingController.createReminder
);

router.get(
  '/reminders',
  requireRole('staff', 'dept_head', 'super_admin'),
  activityTrackingController.getAllReminders
);

// ── Special reminder endpoints (must come before '/reminders/:id') ─────────

// Get all active reminders (pending, in_progress, upcoming, overdue)
router.get(
  '/reminders/active',
  requireRole('staff', 'dept_head', 'super_admin'),
  activityTrackingController.getPendingReminders
);

// Get due reminders (due today or overdue)
router.get(
  '/reminders/due',
  requireRole('staff', 'dept_head', 'super_admin'),
  activityTrackingController.getDueReminders
);

// Get only overdue reminders
router.get(
  '/reminders/overdue',
  requireRole('staff', 'dept_head', 'super_admin'),
  activityTrackingController.getOverdueReminders
);

// Auto-update reminder statuses (admin only)
router.post(
  '/reminders/auto-update',
  requireRole('dept_head', 'super_admin'),
  activityTrackingController.autoUpdateReminderStatuses
);

// ── Reminder by ID ──────────────────────────────────────────────────────────

router.get(
  '/reminders/:id',
  requireRole('staff', 'dept_head', 'super_admin'),
  activityTrackingController.getReminderById
);

router.patch(
  '/reminders/:id',
  requireRole('staff', 'dept_head', 'super_admin'),
  activityTrackingController.updateReminder
);

// Update only the status of a reminder
router.patch(
  '/reminders/:id/status',
  requireRole('staff', 'dept_head', 'super_admin'),
  activityTrackingController.updateReminderStatus
);

router.post(
  '/reminders/:id/complete',
  requireRole('staff', 'dept_head', 'super_admin'),
  activityTrackingController.completeReminder
);

router.post(
  '/reminders/:id/snooze',
  requireRole('staff', 'dept_head', 'super_admin'),
  activityTrackingController.snoozeReminder
);

router.delete(
  '/reminders/:id',
  requireRole('dept_head', 'super_admin'),
  activityTrackingController.deleteReminder
);

export default router;