// src/features/tickets/tickets.validator.ts
import { z } from 'zod';

export const ticketStatusEnum = z.enum([
  'draft', 'pending_approval', 'approved', 'rejected', 'booked', 'cancelled', 'completed'
]);

export const ticketPriorityEnum = z.enum(['low', 'normal', 'high', 'urgent']);

export const travelClassEnum = z.enum(['economy', 'premium_economy', 'business', 'first']);

export const flightTimePreferenceEnum = z.enum(['morning', 'afternoon', 'evening', 'night', 'any']);

// ── Create Ticket ──────────────────────────────────────────────────────────────

export const createTicketSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'Title is required').max(255).trim(),
    description: z.string().max(1000).trim().optional(),
    department_id: z.string().uuid().optional(),
    
    // Travel Details
    date_of_travel: z.string().datetime({ message: 'Invalid date format' }),
    return_date: z.string().datetime({ message: 'Invalid date format' }).optional(),
    departure_from: z.string().min(1, 'Departure location is required').max(255).trim(),
    destination: z.string().min(1, 'Destination is required').max(255).trim(),
    preferred_flight_time: flightTimePreferenceEnum.default('any'),
    remarks: z.string().max(1000).trim().optional(),
    
    // Additional Travel Info
    travel_class: travelClassEnum.default('economy'),
    number_of_passengers: z.number().int().min(1).max(50).default(1),
    special_requests: z.string().max(1000).trim().optional(),
    
    priority: ticketPriorityEnum.default('normal'),
    assigned_to: z.string().uuid().optional(),
    
    is_draft: z.boolean().default(false),
  }).strict().refine((data) => {
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
  }),
});

// ── Update Ticket ──────────────────────────────────────────────────────────────

export const updateTicketSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(255).trim().optional(),
    description: z.string().max(1000).trim().optional(),
    department_id: z.string().uuid().optional().nullable(),
    
    date_of_travel: z.string().datetime().optional(),
    return_date: z.string().datetime().optional().nullable(),
    departure_from: z.string().min(1).max(255).trim().optional(),
    destination: z.string().min(1).max(255).trim().optional(),
    preferred_flight_time: flightTimePreferenceEnum.optional(),
    remarks: z.string().max(1000).trim().optional().nullable(),
    
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
    if (data.date_of_travel && data.return_date) {
      const travelDate = new Date(data.date_of_travel);
      const returnDate = new Date(data.return_date);
      return returnDate > travelDate;
    }
    return true;
  }, {
    message: 'Return date must be after the date of travel',
    path: ['return_date'],
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
    department_id: z.string().uuid().optional(),
    assigned_to: z.string().uuid().optional(),
    created_by: z.string().uuid().optional(),
    date_from: z.string().datetime().optional(),
    date_to: z.string().datetime().optional(),
    departure_from: z.string().trim().max(100).optional(),
    destination: z.string().trim().max(100).optional(),
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