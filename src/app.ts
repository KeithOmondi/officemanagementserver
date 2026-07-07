import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env';

// ── Memory tracking for imports ─────────────────────────────────────────────
const trackMemory = (label: string) => {
  const mem = process.memoryUsage();
  console.log(`🧠 [${label}] Heap: ${Math.round(mem.heapUsed / 1024 / 1024)}MB | RSS: ${Math.round(mem.rss / 1024 / 1024)}MB`);
};

trackMemory('App start');

// ── Import routes one by one with tracking ─────────────────────────────────
trackMemory('Before importing authRoutes');
import authRoutes from './features/auth/auth.routes';
trackMemory('After importing authRoutes');

trackMemory('Before importing userRoutes');
import userRoutes from './features/users/users.routes';
trackMemory('After importing userRoutes');

trackMemory('Before importing departmentRoutes');
import departmentRoutes from './features/departments/departments.routes';
trackMemory('After importing departmentRoutes');

trackMemory('Before importing documentRoutes');
import documentRoutes from './features/documents/documents.routes';
trackMemory('After importing documentRoutes');

trackMemory('Before importing streamRouter');
import streamRouter from './features/stream/stream.route';
trackMemory('After importing streamRouter');

trackMemory('Before importing stationRoutes');
import stationRoutes from './features/stations/stations.routes';
trackMemory('After importing stationRoutes');

trackMemory('Before importing registryRoutes');
import registryRoutes from './features/registry/registry.routes';
trackMemory('After importing registryRoutes');

trackMemory('Before importing calendarRoutes');
import calendarRoutes from './features/calendar/calendar.routes';
trackMemory('After importing calendarRoutes');

trackMemory('Before importing dsaRoutes');
import dsaRoutes from './features/dsa/dsa.routes';
trackMemory('After importing dsaRoutes');

trackMemory('Before importing taskRoutes');
import taskRoutes from './features/tasks/task.routes';
trackMemory('After importing taskRoutes');

trackMemory('Before importing inventoryRoutes');
import inventoryRoutes from './features/inventory/inventory.routes';
trackMemory('After importing inventoryRoutes');

trackMemory('Before importing financialRoutes');
import financialRoutes from './features/finanace/financial.routes';
trackMemory('After importing financialRoutes');

trackMemory('Before importing signatureRoutes');
import signatureRoutes from './features/signature/signature.routes';
trackMemory('After importing signatureRoutes');

trackMemory('Before importing messagesRoutes');
import messagesRoutes from './features/messages/messages.routes';
trackMemory('After importing messagesRoutes');

trackMemory('Before importing helpDeskRoutes');
import helpDeskRoutes from './features/helpdesk/helpdesk.routes';
trackMemory('After importing helpDeskRoutes');

trackMemory('Before importing noticesRoutes');
import noticesRoutes from "./features/notices/notices.routes";
trackMemory('After importing noticesRoutes');

trackMemory('Before importing notificationsRoutes');
import notificationsRoutes from './features/notifications/notifications.routes';
trackMemory('After importing notificationsRoutes');

trackMemory('Before importing externalLinksRoutes');
import externalLinksRoutes from './features/links/links.routes';
trackMemory('After importing externalLinksRoutes');

trackMemory('Before importing templatesRoutes');
import templatesRoutes from "./template/templates.routes";
trackMemory('After importing templatesRoutes');

trackMemory('Before importing helpdeskDocumentsRouter');
import helpdeskDocumentsRouter from './features/helpdeskdocs/helpdesk.documents.routes';
trackMemory('After importing helpdeskDocumentsRouter');

trackMemory('Before importing ticketsRoutes');
import ticketsRoutes from "./features/tickets/tickets.routes";
trackMemory('After importing ticketsRoutes');

// ── Import middleware ──────────────────────────────────────────────────────
trackMemory('Before importing errorMiddleware');
import { errorMiddleware } from './middleware/error.middleware';
trackMemory('After importing errorMiddleware');

const app: Express = express();
trackMemory('After express()');

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
trackMemory('After CORS middleware');

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());
trackMemory('After body parsers');

// ── Health check ──────────────────────────────────────────────────────────
app.get('/api/v1/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

app.get('/', (_req: Request, res: Response) => {
  res.json({ status: 'healthy', message: 'API is running smoothly.' });
});

// ── Feature Routes ────────────────────────────────────────────────────────────
trackMemory('Before route registration');

app.use('/api/v1/auth', authRoutes);
trackMemory('After auth routes');

app.use('/api/v1/users', userRoutes);
trackMemory('After user routes');

app.use('/api/v1/departments', departmentRoutes);
trackMemory('After department routes');

app.use('/api/v1/documents', documentRoutes);
trackMemory('After document routes');

app.use('/api/v1/stream', streamRouter);
trackMemory('After stream routes');

app.use('/api/v1/stations', stationRoutes);
trackMemory('After station routes');

app.use('/api/v1/registry', registryRoutes);
trackMemory('After registry routes');

app.use('/api/v1/calendar', calendarRoutes);
trackMemory('After calendar routes');

app.use('/api/v1/dsa', dsaRoutes);
trackMemory('After dsa routes');

app.use('/api/v1/tasks', taskRoutes);
trackMemory('After task routes');

app.use('/api/v1/inventory', inventoryRoutes);
trackMemory('After inventory routes');

app.use('/api/v1/financial', financialRoutes);
trackMemory('After financial routes');

app.use('/api/v1/signature', signatureRoutes);
trackMemory('After signature routes');

app.use('/api/v1/messages', messagesRoutes);
trackMemory('After messages routes');

app.use('/api/v1/helpdesk', helpDeskRoutes);
trackMemory('After helpdesk routes');

app.use('/api/v1/notices', noticesRoutes);
trackMemory('After notices routes');

app.use('/api/v1/notifications', notificationsRoutes);
trackMemory('After notifications routes');

app.use('/api/v1/links', externalLinksRoutes);
trackMemory('After links routes');

app.use('/api/v1/templates', templatesRoutes);
trackMemory('After templates routes');

app.use('/api/v1/uploads', helpdeskDocumentsRouter);
trackMemory('After uploads routes');

app.use('/api/v1/tickets', ticketsRoutes);
trackMemory('After tickets routes');

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response, _next: NextFunction) => {
  res.status(404).json({ error: 'Route Not Found' });
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use(errorMiddleware);
trackMemory('After error middleware');

// ── Keep-alive ping ──────────────────────────────────────────────────────────
if (env.NODE_ENV === 'production') {
  setInterval(async () => {
    try {
      await fetch(`${env.API_URL}/api/v1/health`);
      console.log('🏓 Keep-alive ping sent');
    } catch (err) {
      console.warn('⚠️ Keep-alive ping failed:', err);
    }
  }, 10 * 60 * 1000);
}

trackMemory('App configuration complete');
console.log('✅ App configuration complete!');

export default app;