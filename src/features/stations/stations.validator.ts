// src/features/stations/stations.validator.ts
import { z } from 'zod';
import { PREDEFINED_STATION_TYPES, isPredefinedStationType } from './stations.types';

// ── Station Type Validation ──────────────────────────────────────────────────
// We allow any string for station type (custom types)

export const stationTypeSchema = z.string()
  .min(1, 'Station type is required')
  .max(100, 'Station type is too long');

// ── Optional: Validate against predefined types with a warning ──────────────
// This is optional - we can just accept any string

export const stationTypeWithPredefinedCheck = z.string()
  .min(1, 'Station type is required')
  .max(100, 'Station type is too long')
  .refine(
    (val) => {
      // This is just a warning, not a strict validation
      return true;
    },
    {
      message: 'Custom station type will be saved',
    }
  );

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
    type:      stationTypeSchema, // Changed from stationTypeEnum to allow any string
    location:  z.string().max(500).trim().optional(),
  }).strict(),
}).superRefine((data, ctx) => {
  // If type is not sub_registry and ref_no is not provided, warn but don't block
  // This allows custom types to not require ref_no
  const type = data.body.type;
  const isSubRegistry = type === 'sub_registry';
  
  if (!isSubRegistry && !data.body.ref_no) {
    // Add a warning but don't block - allow custom types without ref_no
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Reference number is recommended for courts',
      path: ['body', 'ref_no'],
      fatal: false, // This makes it a warning, not an error
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
    type:      stationTypeSchema.optional(), // Changed from stationTypeEnum to allow any string
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
    type:      stationTypeSchema.optional(), // Changed to allow any string for filtering
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