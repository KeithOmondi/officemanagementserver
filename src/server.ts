import app from './app';
import { connectDB } from './config/db';
import { env } from './config/env';

const startServer = async () => {
  try {
    // Ensure the database is live before starting the Express listener
    await connectDB();

    const server = app.listen(env.PORT, () => {
      console.log(`🚀 [server]: Running in ${env.NODE_ENV} mode on http://localhost:${env.PORT}`);
    });

    // Handle unhandled promise rejections (e.g., live database connection drops)
    process.on('unhandledRejection', (reason: unknown) => {
      const errorMsg = reason instanceof Error ? reason.message : String(reason);
      console.error(`💥 Unhandled Rejection: ${errorMsg}`);
      console.log('Shutting down server gracefully...');
      
      server.close(() => {
        process.exit(1);
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
  console.log('Shutting down server immediately...');
  process.exit(1);
});

// Fire up the system
startServer();