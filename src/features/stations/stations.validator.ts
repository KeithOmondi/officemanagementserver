// src/features/stations/stations.validator.ts
import { z } from 'zod';

export const stationTypeEnum = z.enum([
  'high_court',
  'magistrate_court',
  'environment_court',
  'kadhis_court',
  'sub_registry',
]);

// ── Court Reference Number Validation ──────────────────────────────────────

/**
 * Validates a court reference number in the format: RHC/[CODE]/[NUMBER]
 * Examples: RHC/MSB/22, RHC/KAB/23, RHC/GRN/24
 * This is optional for sub-registries but required for courts
 */
export const courtReferenceSchema = z.string()
  .regex(/^RHC\/[A-Z]{2,4}\/\d{1,3}$/, 
    'Reference must be in format: RHC/[CODE]/[NUMBER] (e.g., RHC/MSB/22)')
  .min(8, 'Reference number is too short')
  .max(15, 'Reference number is too long');

// ── Create ──────────────────────────────────────────────────────────────────

export const createStationSchema = z.object({
  body: z.object({
    ref_no:    z.string().optional().nullable(),
    name:      z.string().min(1, 'Name is required').max(255).trim(),
    type:      stationTypeEnum,
    location:  z.string().max(500).trim().optional(),
  }).strict(),
}).superRefine((data, ctx) => {
  // If type is not sub_registry, ref_no is required
  if (data.body.type !== 'sub_registry' && !data.body.ref_no) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Reference number is required for courts',
      path: ['body', 'ref_no'],
    });
  }
  // If ref_no is provided, validate its format
  if (data.body.ref_no) {
    const isValid = /^RHC\/[A-Z]{2,4}\/\d{1,3}$/.test(data.body.ref_no);
    if (!isValid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Reference must be in format: RHC/[CODE]/[NUMBER] (e.g., RHC/MSB/22)',
        path: ['body', 'ref_no'],
      });
    }
  }
});

// ── Update ──────────────────────────────────────────────────────────────────

export const updateStationSchema = z.object({
  body: z.object({
    ref_no:    z.string().optional().nullable(),
    name:      z.string().min(1).max(255).trim().optional(),
    type:      stationTypeEnum.optional(),
    location:  z.string().max(500).trim().optional(),
    is_active: z.boolean().optional(),
  })
  .strict()
  .refine((b) => Object.keys(b).length > 0, {
    message: 'At least one field must be provided to update',
  }),
}).superRefine((data, ctx) => {
  // If ref_no is provided, validate its format
  if (data.body.ref_no) {
    const isValid = /^RHC\/[A-Z]{2,4}\/\d{1,3}$/.test(data.body.ref_no);
    if (!isValid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Reference must be in format: RHC/[CODE]/[NUMBER] (e.g., RHC/MSB/22)',
        path: ['body', 'ref_no'],
      });
    }
  }
});

// ── Filters ─────────────────────────────────────────────────────────────────

export const stationFiltersSchema = z.object({
  query: z.object({
    search:    z.string().trim().max(100).optional(),
    type:      stationTypeEnum.optional(),
    is_active: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
    has_ref:   z.enum(['true', 'false']).transform(v => v === 'true').optional(),
    page:      z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1)).optional(),
    limit:     z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
    sort_by:   z.enum(['name', 'type', 'created_at', 'ref_no']).optional(),
    sort_order: z.enum(['ASC', 'DESC']).optional(),
  }),
});

// ── ID param ────────────────────────────────────────────────────────────────

export const stationIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Station ID must be a valid UUID'),
  }),
});

// ── Inferred types ──────────────────────────────────────────────────────────

export type CreateStationInput = z.infer<typeof createStationSchema>['body'];
export type UpdateStationInput = z.infer<typeof updateStationSchema>['body'];
export type StationFilters     = z.infer<typeof stationFiltersSchema>['query'];