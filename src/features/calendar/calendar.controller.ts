// src/features/calendar/calendar.controller.ts
import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { AppError, sendSuccess } from '../../utils/response';
import { CalendarService } from './calendar.service';
import googleCalendarService from '../../services/googleCalendar.service';
import {
  createEventSchema,
  updateEventSchema,
  calendarFiltersSchema,
  eventIdSchema,
} from './calendar.validator';

export const calendarController = {

  // ── Create ────────────────────────────────────────────────────────────────────

  createEvent: asyncHandler(async (req: Request, res: Response) => {
    const result = createEventSchema.safeParse({ body: req.body });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid event data');
    const event = await CalendarService.createEvent(result.data.body, req.user!.id);
    return sendSuccess(res, event, 'Event created successfully', 201);
  }),

  // ── Get all (own events only) ─────────────────────────────────────────────────

  getAll: asyncHandler(async (req: Request, res: Response) => {
    const result = calendarFiltersSchema.safeParse({ query: req.query });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid filters');
    // userId scoping happens inside the service — each user only sees their own events
    const events = await CalendarService.findAll(result.data.query, req.user!.id);
    return sendSuccess(res, events, 'Events retrieved successfully');
  }),

  // ── Upcoming (own events only) ────────────────────────────────────────────────

  getUpcoming: asyncHandler(async (req: Request, res: Response) => {
    const limit  = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const events = await CalendarService.getUpcomingEvents(req.user!.id, limit);
    return sendSuccess(res, events, 'Upcoming events retrieved successfully');
  }),

  // ── Get by ID (owner-gated) ───────────────────────────────────────────────────

  getById: asyncHandler(async (req: Request, res: Response) => {
    const result = eventIdSchema.safeParse({ params: req.params });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
    const event = await CalendarService.findById(result.data.params.id, req.user!.id);
    if (!event) throw new AppError(404, 'Event not found');
    return sendSuccess(res, event, 'Event retrieved successfully');
  }),

  // ── Update (owner-gated) ──────────────────────────────────────────────────────

  updateEvent: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = eventIdSchema.safeParse({ params: req.params });
    if (!paramsResult.success) throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
    const bodyResult = updateEventSchema.safeParse({ body: req.body });
    if (!bodyResult.success) throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid update data');
    const event = await CalendarService.updateEvent(
      paramsResult.data.params.id,
      bodyResult.data.body,
      req.user!.id
    );
    return sendSuccess(res, event, 'Event updated successfully');
  }),

  // ── Delete (owner-gated) ──────────────────────────────────────────────────────

  deleteEvent: asyncHandler(async (req: Request, res: Response) => {
    const result = eventIdSchema.safeParse({ params: req.params });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
    await CalendarService.deleteEvent(result.data.params.id, req.user!.id);
    return sendSuccess(res, null, 'Event deleted successfully');
  }),

  // ── Google: get auth URL ──────────────────────────────────────────────────────

  getGoogleAuthUrl: asyncHandler(async (req: Request, res: Response) => {
    const authUrl = googleCalendarService.getAuthUrl(req.user!.id);
    return sendSuccess(res, { authUrl }, 'Google OAuth URL generated');
  }),

  // ── Google: OAuth callback (no auth middleware — browser redirect) ────────────

  googleCallback: asyncHandler(async (req: Request, res: Response) => {
    const { code, state } = req.query;

    if (!code  || typeof code  !== 'string') throw new AppError(400, 'Authorization code is required');
    if (!state || typeof state !== 'string') throw new AppError(400, 'Missing state parameter');

    const userId = googleCalendarService.decodeState(state);
    const tokens = await googleCalendarService.getTokens(code);
    await googleCalendarService.saveUserSettings(userId, tokens);

    const frontendUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/calendar?connected=true`);
  }),

  // ── Google: disconnect ────────────────────────────────────────────────────────

  disconnectGoogle: asyncHandler(async (req: Request, res: Response) => {
    await googleCalendarService.disconnect(req.user!.id);
    return sendSuccess(res, null, 'Google Calendar disconnected successfully');
  }),

  // ── Google: connection status ─────────────────────────────────────────────────

  getGoogleStatus: asyncHandler(async (req: Request, res: Response) => {
    const settings = await googleCalendarService.getUserSettings(req.user!.id);
    return sendSuccess(res, {
      isConnected: settings?.is_connected        || false,
      syncEnabled: settings?.sync_enabled        || false,
      lastSyncAt:  settings?.last_sync_at        || null,
      calendarId:  settings?.google_calendar_id  || 'primary',
    }, 'Google Calendar status retrieved');
  }),

  // ── Google: manual sync ───────────────────────────────────────────────────────

  syncWithGoogle: asyncHandler(async (req: Request, res: Response) => {
    const result = await CalendarService.syncWithGoogle(req.user!.id);
    return sendSuccess(res, result, 'Calendar synced with Google successfully');
  }),
};