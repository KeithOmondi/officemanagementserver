// src/validators/conference.validator.ts

import { z } from 'zod';

// ─── Enums ─────────────────────────────────────────────────────────────────────

export const ConferenceStatusEnum = z.enum([
  'draft',
  'pending',
  'approved',
  'rejected',
  'completed',
  'cancelled',
]);

// ─── Reusable Schemas ────────────────────────────────────────────────────────

/**
 * Date validator that accepts:
 * - YYYY-MM-DD strings
 * - ISO datetime strings
 * - Date objects
 * Ensures the date is valid and properly formatted
 */
const dateSchema = z
  .union([
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
    z.string().datetime({ offset: true, message: 'Invalid date format' }),
    z.date(),
  ])
  .refine(
    (val) => {
      const d = typeof val === 'string' ? new Date(val) : val;
      return !isNaN(d.getTime());
    },
    { message: 'Invalid date' }
  );

/**
 * Optional date schema - accepts null or undefined
 */
const optionalDateSchema = dateSchema.optional().nullable();

/**
 * ID parameter schema - reusable for any route with an ID param
 */
const idParamSchema = z.object({
  id: z.string().uuid('Invalid ID format'),
});

/**
 * Pagination schema - reusable for list endpoints
 */
const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sort_by: z.enum(['created_at', 'updated_at', 'start_date', 'end_date', 'serial_number']).default('serial_number'),
  sort_order: z.enum(['ASC', 'DESC']).default('DESC'),
});

/**
 * Date range refinement - reusable for stats endpoints
 */
const dateRangeRefinement = (data: { start_date?: Date | string | null; end_date?: Date | string | null }) => {
  if (!data.start_date || !data.end_date) return true;
  const start = typeof data.start_date === 'string' 
    ? new Date(data.start_date) 
    : data.start_date;
  const end = typeof data.end_date === 'string' 
    ? new Date(data.end_date) 
    : data.end_date;
  return start <= end;
};

/**
 * Base Conference fields - reusable for create/update
 */
const baseConferenceFields = {
  particulars: z.string()
    .min(10, 'Particulars must be at least 10 characters')
    .max(2000, 'Particulars must not exceed 2000 characters')
    .trim(),
  
  start_date: dateSchema,
  
  end_date: dateSchema,
  
  number_of_pax: z.number()
    .int('Number of participants must be a whole number')
    .positive('Number of participants must be greater than 0')
    .max(10000, 'Number of participants cannot exceed 10,000'),
};

// ─── Conference Validators ──────────────────────────────────────────────────

/**
 * Create Conference Request
 * POST /api/v1/conference
 */
export const createConferenceRequestSchema = z.object({
  body: z.object({
    ...baseConferenceFields,
  })
    .refine(
      (data) => {
        const start = typeof data.start_date === 'string' 
          ? new Date(data.start_date) 
          : data.start_date;
        const end = typeof data.end_date === 'string' 
          ? new Date(data.end_date) 
          : data.end_date;
        return start <= end;
      },
      { message: 'Start date must be before or equal to end date' }
    ),
});

/**
 * Update Conference Request
 * PUT /api/v1/conference/:id
 */
export const updateConferenceRequestSchema = z.object({
  params: idParamSchema,
  body: z.object({
    particulars: baseConferenceFields.particulars.optional(),
    start_date: baseConferenceFields.start_date.optional(),
    end_date: baseConferenceFields.end_date.optional(),
    number_of_pax: baseConferenceFields.number_of_pax.optional(),
    status: ConferenceStatusEnum.optional(),
  })
    .strict()
    .refine(
      (body) => Object.keys(body).length > 0,
      { message: 'At least one field must be provided for update' }
    )
    .refine(
      (data) => {
        if (!data.start_date && !data.end_date) return true;
        const start = data.start_date 
          ? (typeof data.start_date === 'string' ? new Date(data.start_date) : data.start_date)
          : undefined;
        const end = data.end_date 
          ? (typeof data.end_date === 'string' ? new Date(data.end_date) : data.end_date)
          : undefined;
        if (!start || !end) return true;
        return start <= end;
      },
      { message: 'Start date must be before or equal to end date' }
    ),
});

/**
 * Approve Conference Request (Super Admin only)
 * PUT /api/v1/conference/:id/approve
 */
export const approveConferenceRequestSchema = z.object({
  params: idParamSchema,
  body: z.object({
    comments: z.string()
      .max(1000, 'Comments must not exceed 1000 characters')
      .trim()
      .optional(),
  }),
});

/**
 * Return Conference Request to Requester (Super Admin only)
 * PUT /api/v1/conference/:id/return
 */
export const returnConferenceRequestSchema = z.object({
  params: idParamSchema,
  body: z.object({
    reason: z.string()
      .min(5, 'Reason must be at least 5 characters')
      .max(1000, 'Reason must not exceed 1000 characters')
      .trim(),
  }),
});

/**
 * Get Conference Request by ID
 * GET /api/v1/conference/:id
 */
export const getConferenceRequestSchema = z.object({
  params: idParamSchema,
});

/**
 * List Conference Requests
 * GET /api/v1/conference
 */
export const listConferenceRequestsSchema = z.object({
  query: z.object({
    status: ConferenceStatusEnum.optional(),
    start_date_from: optionalDateSchema.optional(),
    start_date_to: optionalDateSchema.optional(),
    ...paginationSchema.shape,
  })
    .refine(
      (data) => {
        if (!data.start_date_from || !data.start_date_to) return true;
        const from = typeof data.start_date_from === 'string' 
          ? new Date(data.start_date_from) 
          : data.start_date_from;
        const to = typeof data.start_date_to === 'string' 
          ? new Date(data.start_date_to) 
          : data.start_date_to;
        return from <= to;
      },
      { message: 'Start date from must be before or equal to start date to' }
    ),
});

/**
 * Delete Conference Request
 * DELETE /api/v1/conference/:id
 */
export const deleteConferenceRequestSchema = z.object({
  params: idParamSchema,
});

/**
 * Get Conference Request Stats
 * GET /api/v1/conference/stats
 */
export const getConferenceStatsSchema = z.object({
  query: z.object({
    start_date: optionalDateSchema.optional(),
    end_date: optionalDateSchema.optional(),
  })
    .refine(dateRangeRefinement, { message: 'Start date must be before or equal to end date' }),
});

/**
 * Submit Conference Request for Approval
 * PUT /api/v1/conference/:id/submit
 */
export const submitConferenceRequestSchema = z.object({
  params: idParamSchema,
});

/**
 * Mark Conference as Completed
 * PUT /api/v1/conference/:id/complete
 */
export const completeConferenceSchema = z.object({
  params: idParamSchema,
  body: z.object({
    feedback: z.string()
      .max(2000, 'Feedback must not exceed 2000 characters')
      .trim()
      .optional(),
  }),
});

/**
 * Cancel Conference
 * PUT /api/v1/conference/:id/cancel
 */
export const cancelConferenceSchema = z.object({
  params: idParamSchema,
  body: z.object({
    reason: z.string()
      .min(5, 'Cancellation reason must be at least 5 characters')
      .max(1000, 'Cancellation reason must not exceed 1000 characters')
      .trim(),
  }),
});

// ─── Type exports ────────────────────────────────────────────────────────────

export type CreateConferenceRequestSchema = z.infer<typeof createConferenceRequestSchema>;
export type UpdateConferenceRequestSchema = z.infer<typeof updateConferenceRequestSchema>;
export type ApproveConferenceRequestSchema = z.infer<typeof approveConferenceRequestSchema>;
export type ReturnConferenceRequestSchema = z.infer<typeof returnConferenceRequestSchema>;
export type GetConferenceRequestSchema = z.infer<typeof getConferenceRequestSchema>;
export type ListConferenceRequestsSchema = z.infer<typeof listConferenceRequestsSchema>;
export type DeleteConferenceRequestSchema = z.infer<typeof deleteConferenceRequestSchema>;
export type GetConferenceStatsSchema = z.infer<typeof getConferenceStatsSchema>;
export type SubmitConferenceRequestSchema = z.infer<typeof submitConferenceRequestSchema>;
export type CompleteConferenceSchema = z.infer<typeof completeConferenceSchema>;
export type CancelConferenceSchema = z.infer<typeof cancelConferenceSchema>;

// ─── Utility exports ─────────────────────────────────────────────────────────

/**
 * Helper arrays for dropdowns in UI
 */
export const CONFERENCE_STATUSES = ConferenceStatusEnum.options;

/**
 * Get Zod schema for a specific conference field
 * Useful for client-side validation
 */
export const getConferenceFieldSchema = (field: keyof typeof baseConferenceFields) => {
  return baseConferenceFields[field];
};

/**
 * Type guard to check if a value is a valid ConferenceStatus
 */
export const isValidConferenceStatus = (value: unknown): value is z.infer<typeof ConferenceStatusEnum> => {
  return ConferenceStatusEnum.safeParse(value).success;
};