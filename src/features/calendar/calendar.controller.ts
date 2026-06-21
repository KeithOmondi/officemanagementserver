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
  // ── Create Event ──
  createEvent: asyncHandler(async (req: Request, res: Response) => {
    const result = createEventSchema.safeParse({ body: req.body });
    if (!result.success) {
      throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid event data');
    }

    const event = await CalendarService.createEvent(
      result.data.body,
      req.user!.id
    );

    return sendSuccess(res, event, 'Event created successfully', 201);
  }),

  // ── Get All Events ──
  getAll: asyncHandler(async (req: Request, res: Response) => {
    const result = calendarFiltersSchema.safeParse({ query: req.query });
    if (!result.success) {
      throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid filters');
    }

    const events = await CalendarService.findAll(result.data.query);
    return sendSuccess(res, events, 'Events retrieved successfully');
  }),

  // ── Get Upcoming Events ──
  getUpcoming: asyncHandler(async (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 10;
    const events = await CalendarService.getUpcomingEvents(limit);
    return sendSuccess(res, events, 'Upcoming events retrieved successfully');
  }),

  // ── Get Event By ID ──
  getById: asyncHandler(async (req: Request, res: Response) => {
    const result = eventIdSchema.safeParse({ params: req.params });
    if (!result.success) {
      throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
    }

    const event = await CalendarService.findById(result.data.params.id);
    if (!event) {
      throw new AppError(404, 'Event not found');
    }

    return sendSuccess(res, event, 'Event retrieved successfully');
  }),

  // ── Update Event ──
  updateEvent: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = eventIdSchema.safeParse({ params: req.params });
    if (!paramsResult.success) {
      throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
    }

    const bodyResult = updateEventSchema.safeParse({ body: req.body });
    if (!bodyResult.success) {
      throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid update data');
    }

    const event = await CalendarService.updateEvent(
      paramsResult.data.params.id,
      bodyResult.data.body,
      req.user!.id
    );

    return sendSuccess(res, event, 'Event updated successfully');
  }),

  // ── Delete Event ──
  deleteEvent: asyncHandler(async (req: Request, res: Response) => {
    const result = eventIdSchema.safeParse({ params: req.params });
    if (!result.success) {
      throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
    }

    await CalendarService.deleteEvent(result.data.params.id, req.user!.id);
    return sendSuccess(res, null, 'Event deleted successfully');
  }),

  // ── Sync with Google Calendar ──
  syncWithGoogle: asyncHandler(async (req: Request, res: Response) => {
    const result = await CalendarService.syncWithGoogle(req.user!.id);
    return sendSuccess(res, result, 'Calendar synced with Google successfully');
  }),

  // ── Google OAuth ──
  getGoogleAuthUrl: asyncHandler(async (req: Request, res: Response) => {
    const authUrl = googleCalendarService.getAuthUrl();
    return sendSuccess(res, { authUrl }, 'Google OAuth URL generated');
  }),

  // ── Google OAuth Callback ──
  googleCallback: asyncHandler(async (req: Request, res: Response) => {
    const { code } = req.query;
    if (!code || typeof code !== 'string') {
      throw new AppError(400, 'Authorization code is required');
    }

    const tokens = await googleCalendarService.getTokens(code);
    await googleCalendarService.saveUserSettings(req.user!.id, tokens);

    // Redirect back to the frontend
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/settings/calendar?connected=true`);
  }),

  // ── Disconnect Google Calendar ──
  disconnectGoogle: asyncHandler(async (req: Request, res: Response) => {
    await googleCalendarService.disconnect(req.user!.id);
    return sendSuccess(res, null, 'Google Calendar disconnected successfully');
  }),

  // ── Get Google Calendar Status ──
  getGoogleStatus: asyncHandler(async (req: Request, res: Response) => {
    const settings = await googleCalendarService.getUserSettings(req.user!.id);
    const status = {
      isConnected: settings?.is_connected || false,
      syncEnabled: settings?.sync_enabled || false,
      lastSyncAt: settings?.last_sync_at || null,
      calendarId: settings?.google_calendar_id || 'primary',
    };
    return sendSuccess(res, status, 'Google Calendar status retrieved');
  }),
};