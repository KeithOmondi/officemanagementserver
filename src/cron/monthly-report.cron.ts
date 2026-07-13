// src/cron/monthly-report.cron.ts
import cron from 'node-cron';
import { generateAndSaveMonthlyReport } from '../features/reports/ai-reports.service';

export function scheduleMonthlyReportGeneration() {
    // Runs 1st of each month at 2am — generates a report for the month that just ended
    cron.schedule('0 2 1 * *', async () => {
        const now = new Date();
        const lastMonth = now.getMonth() === 0 ? 12 : now.getMonth();
        const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

        try {
            const report = await generateAndSaveMonthlyReport(lastMonth, year);
            console.log(`[cron] Monthly report generated: ${report.id} (${lastMonth}/${year})`);
        } catch (err) {
            console.error(`[cron] Failed to generate monthly report for ${lastMonth}/${year}:`, err);
        }
    });
}