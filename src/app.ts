import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './features/auth/auth.routes'; // ◄ Imported your new routes
import userRoutes from './features/users/users.routes';
import { errorMiddleware } from './middleware/error.middleware';
import { env } from './config/env';
import departmentRoutes from './features/departments/departments.routes';
import documentRoutes from "./features/documents/documents.routes"
import streamRouter from './features/stream/stream.route';
import stationRoutes from './features/stations/stations.routes';
import registryRoutes from './features/registry/registry.routes';
import calendarRoutes from "./features/calendar/calendar.routes"

const app: Express = express();

// Global Middlewares
app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "idempotency-key",  
    ],
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Core API Routes
app.get('/', (req: Request, res: Response) => {
  res.json({ status: 'healthy', message: 'API is running smoothly.' });
});

// Mount Feature Routers
app.use('/api/v1/auth', authRoutes); // ◄ Mounted auth endpoints here
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/departments', departmentRoutes);
app.use('/api/v1/documents', documentRoutes);
app.use('/api/v1/stream', streamRouter);
app.use('/api/v1/stations', stationRoutes);
app.use('/api/v1/registry', registryRoutes);
app.use('/api/v1/calendar', calendarRoutes);

// Fallback for 404/Not Found routes (Must stay below valid routes)
app.use((req: Request, res: Response, next: NextFunction) => {
  res.status(404).json({ error: 'Route Not Found' });
});

// Global error capture tool (Handles AppError, validation errors, etc.)
app.use(errorMiddleware);

export default app;