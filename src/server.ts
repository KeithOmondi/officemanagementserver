// ── MUST BE THE FIRST IMPORT ──────────────────────────────────────────────────
import { profileImport } from './profile-imports';

// ── Now import everything else ──────────────────────────────────────────────
import app from './app';
import { connectDB } from './config/db';
import { env } from './config/env';
import { setupWebSocket } from './socket';
import { scheduleBringUpReminders } from './jobs/bringUpReminders.job';
import { scheduleMonthlyReportGeneration } from './cron/monthly-report.cron';

profileImport('After imports');

// ── Start Server ─────────────────────────────────────────────────────────────
const startServer = async () => {
  try {
    // ── Database Connection ──────────────────────────────────────────────────
    await connectDB();

    // ── Start HTTP Server ────────────────────────────────────────────────────
    const server = app.listen(env.PORT, () => {
      console.log(`🚀 [server]: Running in ${env.NODE_ENV} mode on http://localhost:${env.PORT}`);
      console.log(`🔗 API URL: ${env.API_URL}`);
      console.log(`🌐 Client URL: ${env.CLIENT_URL}`);
    });

    // ── Setup WebSocket ──────────────────────────────────────────────────────
    const io = setupWebSocket(server);

    // Make io available to routes
    app.set('io', io);

    // ── Schedule Background Jobs ─────────────────────────────────────────────
    scheduleBringUpReminders(io);
    scheduleMonthlyReportGeneration();

    return { server, io };

  } catch (error) {
    console.error('❌ Failed to initialize application framework:', error);
    if (error instanceof Error) {
      console.error('   Error name:', error.name);
      console.error('   Error message:', error.message);
      console.error('   Error stack:', error.stack);
    }
    process.exit(1);
  }
};

// ── Set up graceful shutdown ──────────────────────────────────────────────────
process.on('unhandledRejection', (reason: unknown) => {
  console.error('💥 Unhandled Rejection:', reason);
  if (reason instanceof Error) {
    console.error('   Stack:', reason.stack);
  }
});

process.on('uncaughtException', (err: Error) => {
  console.error('💥 Uncaught Exception:', err.message);
  console.error('   Stack:', err.stack);
  if (err.message.includes('heap out of memory')) {
    console.error('🚨 Heap out of memory - exiting immediately');
    process.exit(1);
  }
});

// ── Run Server ──────────────────────────────────────────────────────────────
const serverPromise = startServer();

serverPromise.catch((error) => {
  console.error('❌ Failed to start application:', error);
  process.exit(1);
});

export default serverPromise;