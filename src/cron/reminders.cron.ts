import cron from 'node-cron';
import { pool } from '../config/db';
import { TaskService } from '../features/tasks/tasks.service';

export function scheduleReminderDispatch() {
  // Runs every minute — checks for reminders whose date+time has passed and haven't been sent
  cron.schedule('* * * * *', async () => {
    try {
      const { rows } = await pool.query(
        `SELECT r.id, r.task_id, r.user_id, r.reminder_type, r.note, t.title
         FROM task_reminders r
         JOIN tasks t ON t.id = r.task_id
         WHERE r.is_active = true
           AND r.is_sent = false
           AND (r.reminder_date + r.reminder_time::time) <= NOW()`
      );

      for (const reminder of rows) {
        try {
          await TaskService.createNotification(
            reminder.user_id,
            reminder.task_id,
            'reminder_sent',
            reminder.note || `Reminder: ${reminder.title}`
          );

          await pool.query(
            `UPDATE task_reminders SET is_sent = true, sent_at = NOW() WHERE id = $1`,
            [reminder.id]
          );

          console.log(`[cron] Reminder sent: ${reminder.id} for task ${reminder.task_id}`);
        } catch (innerErr) {
          console.error(`[cron] Failed to send reminder ${reminder.id}:`, innerErr);
        }
      }
    } catch (err) {
      console.error('[cron] Reminder dispatch query failed:', err);
    }
  });
}