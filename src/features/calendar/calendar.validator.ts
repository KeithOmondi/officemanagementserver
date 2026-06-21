// src/features/calendar/calendar.validator.ts
import { z } from 'zod';

export const eventTypeEnum = z.enum(['hearing', 'meeting', 'deadline', 'other']);

export const createEventSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'Title is required').max(255, 'Title too long'),
    description: z.string().max(1000).trim().optional(),
    event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
    start_time: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/, 'Invalid time format (HH:MM:SS)').optional(),
    end_time: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/, 'Invalid time format (HH:MM:SS)').optional(),
    location: z.string().max(255).optional(),
    event_type: eventTypeEnum,
    court_room: z.string().max(100).optional(),
    case_reference: z.string().max(100).optional(),
    judge_name: z.string().max(255).optional(),
    notify_team: z.boolean().default(false),
  }),
});

export const updateEventSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(255).optional(),
    description: z.string().max(1000).trim().optional(),
    event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)').optional(),
    start_time: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/, 'Invalid time format (HH:MM:SS)').optional(),
    end_time: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/, 'Invalid time format (HH:MM:SS)').optional(),
    location: z.string().max(255).optional(),
    event_type: eventTypeEnum.optional(),
    court_room: z.string().max(100).optional(),
    case_reference: z.string().max(100).optional(),
    judge_name: z.string().max(255).optional(),
    notify_team: z.boolean().optional(),
    is_active: z.boolean().optional(),
  }),
});

export const calendarFiltersSchema = z.object({
  query: z.object({
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)').optional(),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)').optional(),
    event_type: eventTypeEnum.optional(),
    court_room: z.string().optional(),
    judge_name: z.string().optional(),
    page: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1)).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(200)).optional(),
    sort_by: z.enum(['event_date', 'created_at']).optional(),
    sort_order: z.enum(['ASC', 'DESC']).optional(),
  }),
});

export const eventIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Event ID must be a valid UUID'),
  }),
});