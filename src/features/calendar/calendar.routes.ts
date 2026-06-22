// src/features/calendar/calendar.routes.ts
import { Router } from 'express';
import { calendarController } from './calendar.controller';
import { protect } from '../../middleware/auth.middleware';

const router = Router();

// ── Google OAuth callback — NO auth (browser redirect from Google has no JWT) ──
router.get('/google/callback', calendarController.googleCallback);

// ── Everything below requires a valid JWT ─────────────────────────────────────
router.use(protect);

// ── Google Calendar integration ───────────────────────────────────────────────
router.get('/google/auth',        calendarController.getGoogleAuthUrl);
router.post('/google/disconnect', calendarController.disconnectGoogle);
router.get('/google/status',      calendarController.getGoogleStatus);
router.post('/google/sync',       calendarController.syncWithGoogle);

// ── Calendar Event CRUD ───────────────────────────────────────────────────────
router.post('/',         calendarController.createEvent);
router.get('/',          calendarController.getAll);
router.get('/upcoming',  calendarController.getUpcoming);
router.get('/:id',       calendarController.getById);
router.put('/:id',       calendarController.updateEvent);
router.delete('/:id',    calendarController.deleteEvent);

export default router;