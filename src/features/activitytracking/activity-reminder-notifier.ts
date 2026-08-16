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
  const isOverdue = reminder.dueDate < new Date().toISOString().split('T')[0];
  const title = isOverdue ? '🔴 Overdue Follow-up' : '📋 Follow-up Due Today';
  
  // Build a more informative message
  let message = `${reminder.message}`;
  
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
  
  return { title, message };
}

export async function notifyDueReminders(): Promise<{ notified: number }> {
  const dueReminders = await ActivityReminderService.findDue({});

  // Only notify once per day — skip reminders already notified today.
  const today = new Date().toISOString().split('T')[0];
  const toNotify = dueReminders.filter((r) => {
    if (!r.notifiedAt) return true;
    return r.notifiedAt.split('T')[0] !== today;
  });

  console.log(`Found ${dueReminders.length} due reminders, ${toNotify.length} to notify today`);

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

  return { notified: toNotify.length };
}

// Allow running directly for a quick manual test:
// `ts-node src/features/activity-tracking/activity-reminder-notifier.ts`
if (require.main === module) {
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