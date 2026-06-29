// src/features/calendar/calendar.routes.ts
import { Router } from 'express';
import { calendarController } from './calendar.controller';
import { protect } from '../../middleware/auth.middleware';

const router = Router();

// ── Google OAuth callback — no JWT (browser redirect from Google) ─────────────
router.get('/google/callback', calendarController.googleCallback);

// ── All routes below require a valid JWT ──────────────────────────────────────
router.use(protect);

// ── Google Calendar integration ───────────────────────────────────────────────
router.get ('/google/auth',       calendarController.getGoogleAuthUrl);
router.get ('/google/status',     calendarController.getGoogleStatus);
router.post('/google/sync',       calendarController.syncWithGoogle);
router.post('/google/disconnect', calendarController.disconnectGoogle);

// ── Calendar CRUD (all scoped to req.user.id inside the service) ──────────────
router.post  ('/',          calendarController.createEvent);
router.get   ('/',          calendarController.getAll);
router.get   ('/upcoming',  calendarController.getUpcoming);
router.get   ('/:id',       calendarController.getById);
router.put   ('/:id',       calendarController.updateEvent);
router.delete('/:id',       calendarController.deleteEvent);

export default router;