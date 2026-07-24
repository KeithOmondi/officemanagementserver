// src/validators/aide.validator.ts

import { z } from 'zod';

// ─── Enums ─────────────────────────────────────────────────────────────────────

export const OfficerRankEnum = z.enum([
  'Police Constable (PC)',
  'Corporal (CPL)',
  'Sergeant (SGT)',
  'Inspector (IP)',
  'Chief Inspector (CIP)',
  'Assistant Superintendent (ASP)',
  'Superintendent (SP)',
  'Senior Superintendent (SSP)',
  'Assistant Commissioner (ACP)',
  'Senior Assistant Commissioner (SACP)',
  'Commissioner (CP)',
]);

export const UnitTypeEnum = z.enum(['KPS', 'APS', 'GSU', 'DCI', 'VIPPU', 'Other']);

export const AideStatusEnum = z.enum(['in_progress', 'rejected', 'attached']);

export const SentryStatusEnum = z.enum(['pending', 'active', 'resolved', 'rejected']);

// ─── Reusable Schemas ────────────────────────────────────────────────────────

/**
 * Date validator that accepts:
 * - YYYY-MM-DD strings
 * - ISO datetime strings
 * - Date objects
 * - null (optional fields)
 * Ensures the date is valid and properly formatted
 */
const dateSchema = z
  .union([
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
    z.string().datetime({ offset: true, message: 'Invalid date format' }),
    z.date(),
    z.null(), // Allow null for optional dates
  ])
  .refine(
    (val) => {
      if (val === null) return true;
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
  sort_by: z.enum(['created_at', 'updated_at', 'judge_name', 'status']).default('created_at'),
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
 * Base Aide Request fields - reusable for create/update
 */
const baseAideFields = {
  judge_name: z.string()
    .min(3, 'Judge name must be at least 3 characters')
    .max(200, 'Judge name must not exceed 200 characters')
    .trim(),
  
  officer_rank: OfficerRankEnum,
  
  officer_name: z.string()
    .min(3, 'Officer name must be at least 3 characters')
    .max(200, 'Officer name must not exceed 200 characters')
    .trim(),
  
  employment_number: z.string()
    .min(5, 'Employment/Service number must be at least 5 characters')
    .max(50, 'Employment/Service number must not exceed 50 characters')
    .trim(),
  
  current_station: z.string()
    .min(3, 'Current station must be at least 3 characters')
    .max(200, 'Current station must not exceed 200 characters')
    .trim(),
  
  current_unit: UnitTypeEnum,
  
  proposed_assignment: z.string()
    .min(5, 'Proposed assignment must be at least 5 characters')
    .max(500, 'Proposed assignment must not exceed 500 characters')
    .trim(),
  
  reporting_date: optionalDateSchema,
  
  remarks: z.string()
    .max(1000, 'Remarks must not exceed 1000 characters')
    .trim()
    .optional()
    .nullable(),
};

/**
 * Base Sentry Request fields - reusable for create/update
 */
const baseSentryFields = {
  judge_name: z.string()
    .min(3, 'Judge name must be at least 3 characters')
    .max(200, 'Judge name must not exceed 200 characters')
    .trim(),
  
  residence_location: z.string()
    .min(3, 'Residence location must be at least 3 characters')
    .max(200, 'Residence location must not exceed 200 characters')
    .trim(),
  
  remarks: z.string()
    .max(1000, 'Remarks must not exceed 1000 characters')
    .trim()
    .optional()
    .nullable(),
};

// ─── Aide Validators ─────────────────────────────────────────────────────────

/**
 * Create Aide Request
 */
export const createAideRequestSchema = z.object({
  body: z.object({
    ...baseAideFields,
    status: AideStatusEnum.default('in_progress'),
  }),
});

/**
 * Update Aide Request
 */
export const updateAideRequestSchema = z.object({
  params: idParamSchema,
  body: z.object({
    judge_name: baseAideFields.judge_name.optional(),
    officer_rank: baseAideFields.officer_rank.optional(),
    officer_name: baseAideFields.officer_name.optional(),
    employment_number: baseAideFields.employment_number.optional(),
    current_station: baseAideFields.current_station.optional(),
    current_unit: baseAideFields.current_unit.optional(),
    proposed_assignment: baseAideFields.proposed_assignment.optional(),
    reporting_date: baseAideFields.reporting_date.optional(),
    remarks: baseAideFields.remarks.optional(),
    status: AideStatusEnum.optional(),
  })
    .strict()
    .refine(
      (body) => Object.keys(body).length > 0,
      { message: 'At least one field must be provided for update' }
    ),
});

/**
 * Get Aide Request by ID
 */
export const getAideRequestSchema = z.object({
  params: idParamSchema,
});

/**
 * List Aide Requests
 */
export const listAideRequestsSchema = z.object({
  query: z.object({
    status: AideStatusEnum.optional(),
    judge_name: z.string().trim().optional(),
    officer_name: z.string().trim().optional(),
    current_station: z.string().trim().optional(),
    ...paginationSchema.shape,
  }),
});

/**
 * Delete Aide Request
 */
export const deleteAideRequestSchema = z.object({
  params: idParamSchema,
});

/**
 * Get Aide Request Stats
 */
export const getAideStatsSchema = z.object({
  query: z.object({
    start_date: optionalDateSchema.optional(),
    end_date: optionalDateSchema.optional(),
  })
    .refine(dateRangeRefinement, { message: 'Start date must be before or equal to end date' }),
});

// ─── Sentry Validators ──────────────────────────────────────────────────────

/**
 * Create Sentry Request
 */
export const createSentryRequestSchema = z.object({
  body: z.object({
    ...baseSentryFields,
  }),
});

/**
 * Update Sentry Request
 */
export const updateSentryRequestSchema = z.object({
  params: idParamSchema,
  body: z.object({
    judge_name: baseSentryFields.judge_name.optional(),
    residence_location: baseSentryFields.residence_location.optional(),
    remarks: baseSentryFields.remarks.optional(),
    status: SentryStatusEnum.optional(),
  })
    .strict()
    .refine(
      (body) => Object.keys(body).length > 0,
      { message: 'At least one field must be provided for update' }
    ),
});

/**
 * Get Sentry Request by ID
 */
export const getSentryRequestSchema = z.object({
  params: idParamSchema,
});

/**
 * List Sentry Requests
 */
export const listSentryRequestsSchema = z.object({
  query: z.object({
    status: SentryStatusEnum.optional(),
    judge_name: z.string().trim().optional(),
    residence_location: z.string().trim().optional(),
    ...paginationSchema.shape,
  }),
});

/**
 * Delete Sentry Request
 */
export const deleteSentryRequestSchema = z.object({
  params: idParamSchema,
});

/**
 * Get Sentry Request Stats
 */
export const getSentryStatsSchema = z.object({
  query: z.object({
    start_date: optionalDateSchema.optional(),
    end_date: optionalDateSchema.optional(),
  })
    .refine(dateRangeRefinement, { message: 'Start date must be before or equal to end date' }),
});

// ─── Type exports ────────────────────────────────────────────────────────────

// Aide types
export type CreateAideRequestSchema = z.infer<typeof createAideRequestSchema>;
export type UpdateAideRequestSchema = z.infer<typeof updateAideRequestSchema>;
export type GetAideRequestSchema = z.infer<typeof getAideRequestSchema>;
export type ListAideRequestsSchema = z.infer<typeof listAideRequestsSchema>;
export type DeleteAideRequestSchema = z.infer<typeof deleteAideRequestSchema>;
export type GetAideStatsSchema = z.infer<typeof getAideStatsSchema>;

// Sentry types
export type CreateSentryRequestSchema = z.infer<typeof createSentryRequestSchema>;
export type UpdateSentryRequestSchema = z.infer<typeof updateSentryRequestSchema>;
export type GetSentryRequestSchema = z.infer<typeof getSentryRequestSchema>;
export type ListSentryRequestsSchema = z.infer<typeof listSentryRequestsSchema>;
export type DeleteSentryRequestSchema = z.infer<typeof deleteSentryRequestSchema>;
export type GetSentryStatsSchema = z.infer<typeof getSentryStatsSchema>;

// ─── Utility exports ─────────────────────────────────────────────────────────

/**
 * Helper arrays for dropdowns in UI
 */
export const OFFICER_RANKS = OfficerRankEnum.options;
export const UNIT_TYPES = UnitTypeEnum.options;
export const AIDE_STATUSES = AideStatusEnum.options;
export const SENTRY_STATUSES = SentryStatusEnum.options;

/**
 * Get Zod schema for a specific aide field
 * Useful for client-side validation
 */
export const getAideFieldSchema = (field: keyof typeof baseAideFields) => {
  return baseAideFields[field];
};

/**
 * Get Zod schema for a specific sentry field
 * Useful for client-side validation
 */
export const getSentryFieldSchema = (field: keyof typeof baseSentryFields) => {
  return baseSentryFields[field];
};

/**
 * Type guard to check if a value is a valid AideStatus
 */
export const isValidAideStatus = (value: unknown): value is z.infer<typeof AideStatusEnum> => {
  return AideStatusEnum.safeParse(value).success;
};

/**
 * Type guard to check if a value is a valid SentryStatus
 */
export const isValidSentryStatus = (value: unknown): value is z.infer<typeof SentryStatusEnum> => {
  return SentryStatusEnum.safeParse(value).success;
};

/**
 * Type guard to check if a value is a valid OfficerRank
 */
export const isValidOfficerRank = (value: unknown): value is z.infer<typeof OfficerRankEnum> => {
  return OfficerRankEnum.safeParse(value).success;
};

/**
 * Type guard to check if a value is a valid UnitType
 */
export const isValidUnitType = (value: unknown): value is z.infer<typeof UnitTypeEnum> => {
  return UnitTypeEnum.safeParse(value).success;
};