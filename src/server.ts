import app from './app';
import { connectDB } from './config/db';
import { env } from './config/env';
import { setupWebSocket } from './socket';

const startServer = async () => {
  try {
    // Ensure the database is live before starting the Express listener
    await connectDB();

    const server = app.listen(env.PORT, () => {
      console.log(`🚀 [server]: Running in ${env.NODE_ENV} mode on http://localhost:${env.PORT}`);
    });

    // ── Setup WebSocket ──────────────────────────────────────────────────────
    const io = setupWebSocket(server);
    console.log('🔌 WebSocket server initialized');

    // Make io available to routes if needed
    app.set('io', io);

    // ── Graceful shutdown handlers ────────────────────────────────────────────

    // Handle unhandled promise rejections (e.g., live database connection drops)
    process.on('unhandledRejection', (reason: unknown) => {
      const errorMsg = reason instanceof Error ? reason.message : String(reason);
      console.error(`💥 Unhandled Rejection: ${errorMsg}`);
      console.log('Shutting down server gracefully...');
      
      server.close(() => {
        // Close WebSocket connections
        io.close(() => {
          console.log('🔌 WebSocket server closed');
          process.exit(1);
        });
      });
    });

    // Handle SIGTERM (e.g., from Docker, PM2, or Kubernetes)
    process.on('SIGTERM', () => {
      console.log('👋 SIGTERM received. Shutting down gracefully...');
      server.close(() => {
        io.close(() => {
          console.log('🔌 WebSocket server closed');
          console.log('💤 Process terminated');
          process.exit(0);
        });
      });
    });

    // Handle SIGINT (Ctrl+C)
    process.on('SIGINT', () => {
      console.log('👋 SIGINT received. Shutting down gracefully...');
      server.close(() => {
        io.close(() => {
          console.log('🔌 WebSocket server closed');
          console.log('💤 Process terminated');
          process.exit(0);
        });
      });
    });

  } catch (error) {
    console.error('❌ Failed to initialize application framework:', error);
    process.exit(1);
  }
};

// Handle synchronous uncaught exceptions
process.on('uncaughtException', (err: Error) => {
  console.error(`💥 Uncaught Exception: ${err.message}`);
  console.error(err.stack);
  console.log('Shutting down server immediately...');
  process.exit(1);
});

// Fire up the system
startServer();