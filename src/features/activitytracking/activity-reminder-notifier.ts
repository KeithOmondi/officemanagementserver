// src/features/activity-tracking/activity-reminder-notifier.ts
import { ActivityReminderService } from './activity-tracking.service';
import { ActivityReminder } from './activity-tracking.types';

// Replace this with your real notification insert (e.g. from wherever
// notificationSlice.ts's backend counterpart lives).
async function insertNotificationStub(params: {
  userId: string;
  title: string;
  message: string;
  link?: string;
}): Promise<void> {
  console.log('[TODO: wire to real notification insert]', params);
}

function buildReminderMessage(reminder: ActivityReminder): { title: string; message: string } {
  const today = new Date().toISOString().split('T')[0];
  const isOverdue = reminder.dueDate < today;
  const isDueToday = reminder.dueDate === today;
  
  let title: string;
  let emoji: string;
  
  // Set title based on status and due date
  if (reminder.status === 'overdue' || isOverdue) {
    title = 'Overdue Follow-up';
    emoji = '🔴';
  } else if (reminder.status === 'pending' && isDueToday) {
    title = 'Follow-up Due Today';
    emoji = '📋';
  } else if (reminder.status === 'in_progress') {
    title = 'In Progress Reminder';
    emoji = '🔄';
  } else if (reminder.status === 'upcoming') {
    title = 'Upcoming Reminder';
    emoji = '📅';
  } else {
    title = 'Reminder';
    emoji = '🔔';
  }
  
  // Build a more informative message
  let message = `${emoji} ${reminder.message}`;
  
  // Include contact name if available
  if (reminder.contactName) {
    message += ` (${reminder.contactName})`;
  }
  
  // Include the due date for context
  const dueDate = new Date(reminder.dueDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
  message += ` — Due ${dueDate}`;
  
  // Include status
  const statusLabels: Record<string, string> = {
    pending: 'Pending',
    in_progress: 'In Progress',
    upcoming: 'Upcoming',
    overdue: 'Overdue',
    completed: 'Completed',
    cancelled: 'Cancelled'
  };
  message += ` [${statusLabels[reminder.status] || reminder.status}]`;
  
  return { title, message };
}

export async function notifyDueReminders(): Promise<{ notified: number }> {
  // Get all active reminders (pending, in_progress, upcoming, overdue)
  const activeReminders = await ActivityReminderService.findDue({});
  
  // Filter to only those due today or overdue
  const today = new Date().toISOString().split('T')[0];
  const dueOrOverdue = activeReminders.filter((r) => {
    // Only notify for pending, in_progress, and overdue statuses that are due
    if (!['pending', 'in_progress', 'overdue'].includes(r.status)) return false;
    // Must be due today or overdue
    return r.dueDate <= today;
  });

  // Only notify once per day — skip reminders already notified today.
  const toNotify = dueOrOverdue.filter((r) => {
    if (!r.notifiedAt) return true;
    return r.notifiedAt.split('T')[0] !== today;
  });

  console.log(`Found ${dueOrOverdue.length} due/overdue reminders, ${toNotify.length} to notify today`);

  for (const reminder of toNotify) {
    const { title, message } = buildReminderMessage(reminder);
    
    // Create notification with more context
    await insertNotificationStub({
      userId: reminder.staffId,
      title,
      message,
      link: `/activity-tracking/reminders/${reminder.id}`,
    });
    
    // Mark as notified so we don't notify again today
    await ActivityReminderService.markNotified(reminder.id);
  }

  // Also auto-update statuses for any reminders that have changed
  await ActivityReminderService.autoUpdateStatuses();

  return { notified: toNotify.length };
}

// Optionally, also notify for upcoming reminders (a day before)
export async function notifyUpcomingReminders(): Promise<{ notified: number }> {
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  
  // Get upcoming reminders for tomorrow
  const allReminders = await ActivityReminderService.findDue({});
  const upcoming = allReminders.filter((r) => {
    // Only for upcoming status
    if (r.status !== 'upcoming') return false;
    // Due tomorrow
    return r.dueDate === tomorrowStr;
  });

  console.log(`Found ${upcoming.length} upcoming reminders for tomorrow`);

  for (const reminder of upcoming) {
    const { title, message } = buildReminderMessage(reminder);
    
    await insertNotificationStub({
      userId: reminder.staffId,
      title: `📅 Reminder Tomorrow: ${title}`,
      message: `Reminder: ${reminder.message} (${reminder.contactName}) is due tomorrow!`,
      link: `/activity-tracking/reminders/${reminder.id}`,
    });
  }

  return { notified: upcoming.length };
}

// Allow running directly for a quick manual test:
// `ts-node src/features/activity-tracking/activity-reminder-notifier.ts`
if (require.main === module) {
  // Parse command line args
  const args = process.argv.slice(2);
  const type = args[0] || 'due';
  
  if (type === 'upcoming') {
    notifyUpcomingReminders()
      .then((result) => {
        console.log(`Notified ${result.notified} upcoming reminder(s).`);
        process.exit(0);
      })
      .catch((err) => {
        console.error('Upcoming reminder notification run failed:', err);
        process.exit(1);
      });
  } else {
    notifyDueReminders()
      .then((result) => {
        console.log(`Notified ${result.notified} due reminder(s).`);
        process.exit(0);
      })
      .catch((err) => {
        console.error('Reminder notification run failed:', err);
        process.exit(1);
      });
  }
}