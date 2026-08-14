// ============================================================
// src/features/station-engagement/schemas/station-engagement.schema.ts
// ============================================================

import { z } from 'zod';

// ─── Enums ──────────────────────────────────────────────────────────────────

export const engagementModeEnum = z.enum([
  'phone_call',
  'whatsapp',
  'email',
  'physical_visit',
  'webinar_followup',
  'video_call',
]);

export const engagementStatusEnum = z.enum([
  'resolved',
  'ongoing',
  'escalated',
]);

export const reasonNotReachedEnum = z.enum([
  'no_response',
  'wrong_contact',
  'station_closed',
  'staff_unavailable',
  'technical_issues',
  'other',
]);

export const reportStatusEnum = z.enum([
  'draft',
  'submitted',
  'reviewed',
  'approved',
  'rejected',
]);

export const urgencyEnum = z.enum(['high', 'medium', 'low']);

export const successionCourtCategoryEnum = z.enum(['A', 'B', 'C', 'D']);

// ─── Constants ──────────────────────────────────────────────────────────────

export const EDITABLE_REPORT_STATUSES = ['draft', 'rejected'] as const;

// ─── Engagement Schema ────────────────────────────────────────────────────

export const engagementSchema = z.object({
  station_id: z.string().uuid('Station ID must be a valid UUID'),
  station_name: z.string().min(1).max(200),
  station_category: successionCourtCategoryEnum,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  contact_person: z.string().min(1).max(200),
  contact_role: z.string().max(100).optional(),
  mode: engagementModeEnum,
  status: engagementStatusEnum,
  follow_up_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
  issues_raised: z.array(z.string()).min(1, 'At least one issue must be raised'),
  action_taken: z.string().min(1),
  resolution: z.string().optional(),
  urgency: urgencyEnum.optional(), // Only required when status === 'escalated'
  why_needs_escalation: z.string().optional(), // Required when urgency is set
});

// ─── Unengaged Station Schema ─────────────────────────────────────────────

export const unengagedStationSchema = z.object({
  station_id: z.string().uuid('Station ID must be a valid UUID'),
  reason_not_reached: reasonNotReachedEnum.optional(),
  reason_not_reached_detail: z.string().optional(), // Required when reason === 'other'
  planned_engagement_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
});

// ─── Escalation Item Schema ──────────────────────────────────────────────

export const escalationItemSchema = z.object({
  station_id: z.string().uuid('Station ID must be a valid UUID'),
  station_name: z.string().min(1).max(200),
  issue: z.string().min(1),
  why_needs_escalation: z.string().min(1),
  recommended_action: z.string().min(1),
  urgency: urgencyEnum, // Required for triage
  source_engagement_id: z.string().uuid('Engagement ID must be a valid UUID').optional().nullable(),
});

// ─── Create Report Schema ─────────────────────────────────────────────────

export const createEngagementReportSchema = z.object({
  body: z.object({
    week_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Week start must be in YYYY-MM-DD format'),
    week_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Week end must be in YYYY-MM-DD format'),
    categories: z.array(successionCourtCategoryEnum).min(1, 'At least one category must be selected'),
    support_person_id: z.string().uuid('Support person ID must be a valid UUID'),
    total_stations_assigned: z.number().int().min(0, 'Total stations assigned must be a positive number'),
    executive_summary: z.string().min(1, 'Executive summary is required'),
    engagements: z.array(engagementSchema).default([]),
    unengaged_stations: z.array(unengagedStationSchema).default([]),
    escalations: z.array(escalationItemSchema).default([]),
    additional_issues: z.string().optional().default(''),
    recurring_patterns: z.string().optional().default(''),
    priorities: z.string().optional().default(''),
  }).strict(),
});

// ─── Update Report Schema ─────────────────────────────────────────────────

export const updateEngagementReportSchema = z.object({
  body: z.object({
    executive_summary: z.string().optional(),
    engagements: z.array(engagementSchema).optional(),
    unengaged_stations: z.array(unengagedStationSchema).optional(),
    escalations: z.array(escalationItemSchema).optional(),
    additional_issues: z.string().optional(),
    recurring_patterns: z.string().optional(),
    priorities: z.string().optional(),
    status: reportStatusEnum.optional(),
    feedback: z.string().optional(),
  }).strict(),
});

// ─── Filters Schema ───────────────────────────────────────────────────────

export const engagementReportFiltersSchema = z.object({
  query: z.object({
    category: successionCourtCategoryEnum.optional(),
    urgency: urgencyEnum.optional(),
    status: reportStatusEnum.optional(),
    week_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Week start must be in YYYY-MM-DD format').optional(),
    week_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Week end must be in YYYY-MM-DD format').optional(),
    submitted_by: z.string().uuid('User ID must be a valid UUID').optional(),
    support_person_id: z.string().uuid('Support person ID must be a valid UUID').optional(),
    limit: z.string().regex(/^\d+$/).optional().transform(Number),
    offset: z.string().regex(/^\d+$/).optional().transform(Number),
  }).strict(),
});

// ─── ID Schema ────────────────────────────────────────────────────────────

export const idSchema = z.object({
  params: z.object({
    id: z.string().uuid('ID must be a valid UUID'),
  }),
});

// ─── Submit Report Schema ────────────────────────────────────────────────

export const submitReportSchema = z.object({
  params: z.object({
    id: z.string().uuid('Report ID must be a valid UUID'),
  }),
});

// ─── Review Report Schema ────────────────────────────────────────────────

export const reviewReportSchema = z.object({
  params: z.object({
    id: z.string().uuid('Report ID must be a valid UUID'),
  }),
  body: z.object({
    status: z.enum(['approved', 'rejected']),
    feedback: z.string().optional(),
  }).strict(),
});

// ─── Generate PDF Schema ─────────────────────────────────────────────────

export const generatePDFSchema = z.object({
  params: z.object({
    id: z.string().uuid('Report ID must be a valid UUID'),
  }),
});

// ─── Types ─────────────────────────────────────────────────────────────────

export type EngagementInput = z.infer<typeof engagementSchema>;
export type UnengagedStationInput = z.infer<typeof unengagedStationSchema>;
export type EscalationItemInput = z.infer<typeof escalationItemSchema>;
export type CreateEngagementReportInput = z.infer<typeof createEngagementReportSchema>['body'];
export type UpdateEngagementReportInput = z.infer<typeof updateEngagementReportSchema>['body'];
export type EngagementReportFilters = z.infer<typeof engagementReportFiltersSchema>['query'];
export type ReviewReportInput = z.infer<typeof reviewReportSchema>['body'];