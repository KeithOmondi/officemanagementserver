// src/jobs/bringUpReminders.job.ts
import cron from 'node-cron';
import { DocumentService } from '../features/documents/documents.service';

export function scheduleBringUpReminders(io?: any) {
  // Runs daily at 07:00 server time — one day before is only meaningful
  // if it fires before the recipient's workday starts.
  cron.schedule('0 7 * * *', async () => {
    try {
      const count = await DocumentService.sendBringUpDateReminders(io);
      console.log(`[BringUpReminder] Sent ${count} bring-up date reminder(s).`);
    } catch (error) {
      console.error('[BringUpReminder] Job failed:', error);
    }
  });
}