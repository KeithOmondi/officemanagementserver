// src/features/stations/stations.validator.ts
import { z } from 'zod';

export const stationTypeEnum = z.enum([
  'high_court',
  'magistrate_court',
  'environment_court',
  'kadhis_court',
  'sub_registry',
]);

// ── Create ──────────────────────────────────────────────────────────────────

export const createStationSchema = z.object({
  body: z.object({
    name:     z.string().min(1, 'Name is required').max(255).trim(),
    type:     stationTypeEnum,
    location: z.string().max(500).trim().optional(),
  }).strict(),
});

// ── Update ──────────────────────────────────────────────────────────────────

export const updateStationSchema = z.object({
  body: z.object({
    name:      z.string().min(1).max(255).trim().optional(),
    type:      stationTypeEnum.optional(),
    location:  z.string().max(500).trim().optional(),
    is_active: z.boolean().optional(),
  })
  .strict()
  .refine((b) => Object.keys(b).length > 0, {
    message: 'At least one field must be provided to update',
  }),
});

// ── Filters ─────────────────────────────────────────────────────────────────

export const stationFiltersSchema = z.object({
  query: z.object({
    search:    z.string().trim().max(100).optional(),
    type:      stationTypeEnum.optional(),
    is_active: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
    page:       z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1)).optional(),
    limit:      z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
    sort_by:    z.enum(['name', 'type', 'created_at']).optional(),
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