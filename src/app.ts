import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './features/auth/auth.routes';
import userRoutes from './features/users/users.routes';
import { errorMiddleware } from './middleware/error.middleware';
import { env } from './config/env';
import departmentRoutes from './features/departments/departments.routes';
import documentRoutes from './features/documents/documents.routes';
import streamRouter from './features/stream/stream.route';
import stationRoutes from './features/stations/stations.routes';
import registryRoutes from './features/registry/registry.routes';
import calendarRoutes from './features/calendar/calendar.routes';
import dsaRoutes from './features/dsa/dsa.routes';
import taskRoutes from './features/tasks/task.routes';
import inventoryRoutes from './features/inventory/inventory.routes';
import financialRoutes from './features/finanace/financial.routes';
import signatureRoutes from './features/signature/signature.routes'
import messagesRoutes from './features/messages/messages.routes';
import helpDeskRoutes from './features/helpdesk/helpdesk.routes';
import noticesRoutes from "./features/notices/notices.routes"
import notificationsRoutes from './features/notifications/notifications.routes';
import externalLinksRoutes from './features/links/links.routes';
import { protect } from './middleware/auth.middleware';
import templateRoutes from './features/templates/templates.routes';

const app: Express = express();

// ── Global Middlewares ────────────────────────────────────────────────────────

app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'idempotency-key',
    ],
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ── Health check (used by keep-alive ping + uptime monitors) ─────────────────

app.get('/api/v1/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// ── Root ──────────────────────────────────────────────────────────────────────

app.get('/', (_req: Request, res: Response) => {
  res.json({ status: 'healthy', message: 'API is running smoothly.' });
});

// ── Feature Routes ────────────────────────────────────────────────────────────

app.use('/api/v1/auth',        authRoutes);
app.use('/api/v1/users',       userRoutes);
app.use('/api/v1/departments', departmentRoutes);
app.use('/api/v1/documents',   documentRoutes);
app.use('/api/v1/stream',      streamRouter);
app.use('/api/v1/stations',    stationRoutes);
app.use('/api/v1/registry',    registryRoutes);
app.use('/api/v1/calendar',    calendarRoutes);
app.use('/api/v1/dsa',         dsaRoutes);
app.use('/api/v1/tasks',       taskRoutes);
app.use('/api/v1/inventory', inventoryRoutes);
app.use('/api/v1/financial', financialRoutes);
app.use('/api/v1/signature', signatureRoutes);
app.use('/api/v1/messages', messagesRoutes);
app.use('/api/v1/helpdesk', helpDeskRoutes);
app.use('/api/v1/notices', noticesRoutes);
app.use('/api/v1/notifications', notificationsRoutes);
app.use('/api/v1/links', externalLinksRoutes);
app.use('/api/v1/templates', protect, templateRoutes);



// ── 404 ───────────────────────────────────────────────────────────────────────

app.use((_req: Request, res: Response, _next: NextFunction) => {
  res.status(404).json({ error: 'Route Not Found' });
});

// ── Global error handler ──────────────────────────────────────────────────────

app.use(errorMiddleware);

// ── Keep-alive ping (prevents Render free tier from sleeping) ─────────────────

if (env.NODE_ENV === 'production') {
  setInterval(async () => {
    try {
      await fetch(`${env.API_URL}/api/v1/health`);
      console.log('🏓 Keep-alive ping sent');
    } catch (err) {
      console.warn('⚠️ Keep-alive ping failed:', err);
    }
  }, 10 * 60 * 1000); // every 10 minutes
}

export default app;