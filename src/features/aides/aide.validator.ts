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

// ─── Reusable Schemas ────────────────────────────────────────────────────────

/**
 * Date validator that accepts both string and Date objects
 * Ensures the date is valid and properly formatted
 */
const dateSchema = z
  .union([
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
  
  reporting_date: dateSchema,
  
  remarks: z.string()
    .max(1000, 'Remarks must not exceed 1000 characters')
    .trim()
    .optional(),
};

// ─── Create Aide Request ─────────────────────────────────────────────────────

export const createAideRequestSchema = z.object({
  body: z.object({
    ...baseAideFields,
    status: AideStatusEnum.default('in_progress'),
  }),
});

// ─── Update Aide Request ─────────────────────────────────────────────────────

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

// ─── Get Aide Request by ID ──────────────────────────────────────────────────

export const getAideRequestSchema = z.object({
  params: idParamSchema,
});

// ─── List Aide Requests ─────────────────────────────────────────────────────

export const listAideRequestsSchema = z.object({
  query: z.object({
    status: AideStatusEnum.optional(),
    judge_name: z.string().trim().optional(),
    officer_name: z.string().trim().optional(),
    current_station: z.string().trim().optional(),
    ...paginationSchema.shape,
  }),
});

// ─── Delete Aide Request ─────────────────────────────────────────────────────

export const deleteAideRequestSchema = z.object({
  params: idParamSchema,
});

// ─── Get Aide Request Stats ──────────────────────────────────────────────────

export const getAideStatsSchema = z.object({
  query: z.object({
    start_date: dateSchema.optional(),
    end_date: dateSchema.optional(),
  })
    .refine(
      (data) => {
        if (!data.start_date || !data.end_date) return true;
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

// ─── Type exports ────────────────────────────────────────────────────────────

export type CreateAideRequestSchema = z.infer<typeof createAideRequestSchema>;
export type UpdateAideRequestSchema = z.infer<typeof updateAideRequestSchema>;
export type GetAideRequestSchema = z.infer<typeof getAideRequestSchema>;
export type ListAideRequestsSchema = z.infer<typeof listAideRequestsSchema>;
export type DeleteAideRequestSchema = z.infer<typeof deleteAideRequestSchema>;
export type GetAideStatsSchema = z.infer<typeof getAideStatsSchema>;

// ─── Utility exports ─────────────────────────────────────────────────────────

/**
 * Helper arrays for dropdowns in UI
 */
export const OFFICER_RANKS = OfficerRankEnum.options;
export const UNIT_TYPES = UnitTypeEnum.options;
export const AIDE_STATUSES = AideStatusEnum.options;

/**
 * Get Zod schema for a specific field
 * Useful for client-side validation
 */
export const getAideFieldSchema = (field: keyof typeof baseAideFields) => {
  return baseAideFields[field];
};