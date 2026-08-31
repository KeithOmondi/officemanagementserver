// src/features/service-week/schemas/service-week.schema.ts

import { z } from 'zod';

// ─── Case Return Schema ──────────────────────────────────────────────────

export const caseReturnSchema = z.object({
  serial_number: z.number().int().min(1, 'Serial number is required'),
  case_number: z.string().min(1, 'Case number is required'),
  cause_listed_activity: z.string().min(1, 'Activity is required'),
  outcome: z.string().min(1, 'Outcome is required'),
  remarks: z.string().optional(),
});

// ─── Status Enums ──────────────────────────────────────────────────────────

export const ServiceWeekStatusEnum = z.enum(['draft', 'submitted']);
export type ServiceWeekStatus = z.infer<typeof ServiceWeekStatusEnum>;

// ─── Create Service Week Schema ─────────────────────────────────────────

export const createServiceWeekSchema = z.object({
  body: z.object({
    station: z.string().min(1, 'Station is required'),
    division: z.string().optional(),
    week_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
    week_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
    judge_name: z.string().min(1, 'Judge name is required'),
    cases: z.array(caseReturnSchema).min(1, 'At least one case is required'),
    prepared_by: z.string().min(1, 'Prepared by name is required'),
    prepared_designation: z.string().min(1, 'Designation is required'),
    prepared_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format').optional(),
    saveAsDraft: z.boolean().optional().default(false),
  }).strict(),
});

// ─── Update Service Week Schema ─────────────────────────────────────────

export const updateServiceWeekSchema = z.object({
  body: z.object({
    station: z.string().optional(),
    division: z.string().optional(),
    week_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format').optional(),
    week_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format').optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format').optional(),
    judge_name: z.string().optional(),
    cases: z.array(caseReturnSchema).optional(),
    prepared_by: z.string().optional(),
    prepared_designation: z.string().optional(),
    prepared_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format').optional(),
    status: ServiceWeekStatusEnum.optional(),
    edit_reason: z.string().min(1, 'Edit reason is required for super admin edits').optional(),
  }).strict(),
});

// ─── Filters Schema ──────────────────────────────────────────────────────

export const serviceWeekFiltersSchema = z.object({
  query: z.object({
    station: z.string().optional(),
    judge_name: z.string().optional(),
    week_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    week_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    status: ServiceWeekStatusEnum.optional(),
    limit: z.string().regex(/^\d+$/).optional().transform(Number),
    offset: z.string().regex(/^\d+$/).optional().transform(Number),
  }).strict(),
});

// ─── Submit Schema ──────────────────────────────────────────────────────

export const submitServiceWeekSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid ID'),
  }),
});

// ─── ID Schema ────────────────────────────────────────────────────────────

export const idSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid ID'),
  }),
});

// ─── Types ─────────────────────────────────────────────────────────────────

export type CaseReturnInput = z.infer<typeof caseReturnSchema>;
export type CreateServiceWeekInput = z.infer<typeof createServiceWeekSchema>['body'];
export type UpdateServiceWeekInput = z.infer<typeof updateServiceWeekSchema>['body'];
export type ServiceWeekFiltersInput = z.infer<typeof serviceWeekFiltersSchema>['query'];