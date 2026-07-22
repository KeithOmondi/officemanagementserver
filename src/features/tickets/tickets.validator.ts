// src/features/tickets/tickets.validator.ts

import { z } from 'zod';

export const ticketStatusEnum = z.enum([
  'draft', 'pending_approval', 'approved', 'rejected', 'booked', 'cancelled', 'completed'
]);

export const ticketPriorityEnum = z.enum(['low', 'normal', 'high', 'urgent']);

export const travelClassEnum = z.enum(['economy', 'premium_economy', 'business', 'first']);

export const flightTimePreferenceEnum = z.enum(['morning', 'afternoon', 'evening', 'night', 'any']);

export const ticketTripTypeEnum = z.enum(['one_way', 'round_trip']);

// ── Shared date-only validator ──────────────────────────────────────────────
const dateOnlyString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
  .refine((value) => !Number.isNaN(new Date(value).getTime()), {
    message: 'Invalid date',
  });

// ── Shared time validator ────────────────────────────────────────────────────
const timeString = z
  .string()
  .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Time must be in HH:MM format')
  .optional()
  .nullable();

// ── Create Ticket ──────────────────────────────────────────────────────────────

export const createTicketSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'Title is required').max(255).trim(),
    description: z.string().max(1000).trim().optional(),
    department_id: z.string().uuid().optional(),

    // ─── Trip Type ──────────────────────────────────────────────────────────
    trip_type: ticketTripTypeEnum.default('one_way'),

    // ─── Travel Details ──────────────────────────────────────────────────────
    date_of_travel: dateOnlyString,
    time_of_travel: timeString,
    return_date: dateOnlyString.optional(),
    return_time: timeString,

    // ─── Flight Time Preferences ─────────────────────────────────────────────
    preferred_departure_time: flightTimePreferenceEnum.default('any'),
    preferred_return_time: flightTimePreferenceEnum.optional().nullable(),

    // ─── Route Details ──────────────────────────────────────────────────────
    departure_from: z.string().min(1, 'Departure location is required').max(255).trim(),
    destination: z.string().min(1, 'Destination is required').max(255).trim(),
    remarks: z.string().max(1000).trim().optional(),

    // ─── Judge & Case Details ──────────────────────────────────────────────
    judge_name: z.string().max(255).trim().optional().nullable(),
    pj_number: z.string().max(100).trim().optional().nullable(),

    // ─── Additional Travel Info ──────────────────────────────────────────────
    travel_class: travelClassEnum.default('economy'),
    number_of_passengers: z.number().int().min(1).max(50).default(1),
    special_requests: z.string().max(1000).trim().optional(),

    priority: ticketPriorityEnum.default('normal'),
    assigned_to: z.string().uuid().optional(),

    is_draft: z.boolean().default(false),
  })
  .strict()
  .refine((data) => {
    // If trip is round trip, return date is required
    if (data.trip_type === 'round_trip' && !data.return_date) {
      return false;
    }
    return true;
  }, {
    message: 'Return date is required for round trip',
    path: ['return_date'],
  })
  .refine((data) => {
    // If trip is round trip, return time is required
    if (data.trip_type === 'round_trip' && !data.return_time) {
      return false;
    }
    return true;
  }, {
    message: 'Return time is required for round trip',
    path: ['return_time'],
  })
  .refine((data) => {
    // Return date must be after travel date if provided
    if (data.return_date) {
      const travelDate = new Date(data.date_of_travel);
      const returnDate = new Date(data.return_date);
      return returnDate > travelDate;
    }
    return true;
  }, {
    message: 'Return date must be after the date of travel',
    path: ['return_date'],
  })
  .refine((data) => {
    // If round trip, preferred_return_time is required
    if (data.trip_type === 'round_trip' && !data.preferred_return_time) {
      return false;
    }
    return true;
  }, {
    message: 'Return flight time preference is required for round trip',
    path: ['preferred_return_time'],
  }),
});

// ── Update Ticket ──────────────────────────────────────────────────────────────

export const updateTicketSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(255).trim().optional(),
    description: z.string().max(1000).trim().optional(),
    department_id: z.string().uuid().optional().nullable(),

    // ─── Trip Type ──────────────────────────────────────────────────────────
    trip_type: ticketTripTypeEnum.optional(),

    // ─── Travel Details ──────────────────────────────────────────────────────
    date_of_travel: dateOnlyString.optional(),
    time_of_travel: timeString,
    return_date: dateOnlyString.optional().nullable(),
    return_time: timeString,

    // ─── Flight Time Preferences ─────────────────────────────────────────────
    preferred_departure_time: flightTimePreferenceEnum.optional(),
    preferred_return_time: flightTimePreferenceEnum.optional().nullable(),

    // ─── Route Details ──────────────────────────────────────────────────────
    departure_from: z.string().min(1).max(255).trim().optional(),
    destination: z.string().min(1).max(255).trim().optional(),
    remarks: z.string().max(1000).trim().optional().nullable(),

    // ─── Judge & Case Details ──────────────────────────────────────────────
    judge_name: z.string().max(255).trim().optional().nullable(),
    pj_number: z.string().max(100).trim().optional().nullable(),

    travel_class: travelClassEnum.optional(),
    number_of_passengers: z.number().int().min(1).max(50).optional(),
    special_requests: z.string().max(1000).trim().optional().nullable(),

    priority: ticketPriorityEnum.optional(),
    assigned_to: z.string().uuid().optional().nullable(),
    status: ticketStatusEnum.optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided to update',
  })
  .refine((data) => {
    // If trip type is round trip and return date is being set, it's required
    if (data.trip_type === 'round_trip' && data.return_date === undefined) {
      return true;
    }
    if (data.trip_type === 'round_trip' && data.return_date === null) {
      return false;
    }
    if (data.trip_type === 'round_trip' && data.return_time === null) {
      return false;
    }
    return true;
  }, {
    message: 'Return date and time are required for round trip',
    path: ['return_date'],
  })
  .refine((data) => {
    if (data.date_of_travel && data.return_date) {
      const travelDate = new Date(data.date_of_travel);
      const returnDate = new Date(data.return_date);
      return returnDate > travelDate;
    }
    return true;
  }, {
    message: 'Return date must be after the date of travel',
    path: ['return_date'],
  })
  .refine((data) => {
    // If round trip and preferred_return_time is being set to null/undefined
    if (data.trip_type === 'round_trip' && data.preferred_return_time === null) {
      return false;
    }
    return true;
  }, {
    message: 'Return flight time preference is required for round trip',
    path: ['preferred_return_time'],
  }),
});

// ── Approve Ticket ─────────────────────────────────────────────────────────────

export const approveTicketSchema = z.object({
  body: z.object({
    comments: z.string().max(500).trim().optional(),
  }).strict(),
});

// ── Reject Ticket ──────────────────────────────────────────────────────────────

export const rejectTicketSchema = z.object({
  body: z.object({
    reason: z.string().min(1, 'Rejection reason is required').max(500).trim(),
  }).strict(),
});

// ── Return Ticket ──────────────────────────────────────────────────────────────

export const returnTicketSchema = z.object({
  body: z.object({
    reason: z.string().min(1, 'Return reason is required').max(500).trim(),
    instructions: z.string().max(1000).trim().optional(),
  }).strict(),
});

// ── Book Ticket ────────────────────────────────────────────────────────────────

export const bookTicketSchema = z.object({
  body: z.object({
    booking_reference: z.string().min(1, 'Booking reference is required').max(100).trim(),
    comments: z.string().max(500).trim().optional(),
  }).strict(),
});

// ── Add Comment ────────────────────────────────────────────────────────────────

export const addCommentSchema = z.object({
  body: z.object({
    comment: z.string().min(1, 'Comment is required').max(1000).trim(),
    is_internal: z.boolean().default(false),
  }).strict(),
});

// ── Filters ────────────────────────────────────────────────────────────────────

export const ticketFiltersSchema = z.object({
  query: z.object({
    search: z.string().trim().max(100).optional(),
    status: ticketStatusEnum.optional(),
    priority: ticketPriorityEnum.optional(),
    trip_type: ticketTripTypeEnum.optional(),
    department_id: z.string().uuid().optional(),
    assigned_to: z.string().uuid().optional(),
    created_by: z.string().uuid().optional(),
    date_from: dateOnlyString.optional(),
    date_to: dateOnlyString.optional(),
    departure_from: z.string().trim().max(100).optional(),
    destination: z.string().trim().max(100).optional(),
    judge_name: z.string().trim().max(100).optional(),
    pj_number: z.string().trim().max(100).optional(),
    for_my_action: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
    page: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1)).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
    sort_by: z.enum(['created_at', 'updated_at', 'date_of_travel', 'priority', 'status']).optional(),
    sort_order: z.enum(['ASC', 'DESC']).optional(),
  }),
});

// ── ID params ──────────────────────────────────────────────────────────────────

export const ticketIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Ticket ID must be a valid UUID'),
  }),
});

export const ticketCommentIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Ticket ID must be a valid UUID'),
    commentId: z.string().uuid('Comment ID must be a valid UUID'),
  }),
});

// ── Inferred types ─────────────────────────────────────────────────────────────

export type CreateTicketInput = z.infer<typeof createTicketSchema>['body'];
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>['body'];
export type ApproveTicketInput = z.infer<typeof approveTicketSchema>['body'];
export type RejectTicketInput = z.infer<typeof rejectTicketSchema>['body'];
export type ReturnTicketInput = z.infer<typeof returnTicketSchema>['body'];
export type BookTicketInput = z.infer<typeof bookTicketSchema>['body'];
export type AddCommentInput = z.infer<typeof addCommentSchema>['body'];
export type TicketFilters = z.infer<typeof ticketFiltersSchema>['query'];