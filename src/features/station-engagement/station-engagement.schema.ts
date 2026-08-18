// src/features/station-engagement/schemas/station-engagement.schema.ts

import { z } from 'zod';

// ─── Enums ──────────────────────────────────────────────────────────────────

export const engagementModeEnum = z.enum([
  'phone_call',
  'whatsapp',
  'email',
  'physical_visit',
  'webinar_followup',
  'video_call',
  'walk_in',
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
export const VISIBLE_TO_ADMIN_STATUSES = ['submitted', 'reviewed', 'approved', 'rejected'] as const;
export const SUBMITTABLE_STATUSES = ['draft', 'rejected'] as const;

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
  urgency: urgencyEnum.optional(),
  why_needs_escalation: z.string().optional(),
});

// ─── Unengaged Station Schema ─────────────────────────────────────────────

export const unengagedStationSchema = z.object({
  station_id: z.string().uuid('Station ID must be a valid UUID'),
  reason_not_reached: reasonNotReachedEnum.optional(),
  reason_not_reached_detail: z.string().optional(),
  planned_engagement_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
});

// ─── Escalation Item Schema ──────────────────────────────────────────────

export const escalationItemSchema = z.object({
  station_id: z.string().uuid('Station ID must be a valid UUID'),
  station_name: z.string().min(1).max(200),
  issue: z.string().min(1),
  why_needs_escalation: z.string().min(1),
  recommended_action: z.string().min(1),
  urgency: urgencyEnum,
  source_engagement_id: z.string().uuid('Engagement ID must be a valid UUID').optional().nullable(),
});

// ─── Create Report Schema ─────────────────────────────────────────────────

export const createEngagementReportSchema = z.object({
  body: z.object({
    week_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
    week_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
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
    saveAsDraft: z.boolean().optional().default(false),
    pdfPreviewData: z.string().optional().nullable(),
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
    pdf_preview_data: z.string().optional().nullable(),
    pdf_public_id: z.string().optional().nullable(),
    pdf_secure_url: z.string().url('Must be a valid URL').optional().nullable(),
    pdf_file_name: z.string().optional().nullable(),
    pdf_generated_at: z.string().datetime().optional().nullable(),
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
    visibleToAdmin: z.string().optional().transform(val => {
      if (val === 'true') return true;
      if (val === 'false') return false;
      return undefined;
    }),
    isDraft: z.string().optional().transform(val => {
      if (val === 'true') return true;
      if (val === 'false') return false;
      return undefined;
    }),
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

// ─── Submit/Send to Admin Schema ─────────────────────────────────────────

/**
 * Schema for submitting a report to super admin
 * This changes the status from draft/submitted/rejected to submitted
 * Requires that a PDF is attached
 */
export const submitReportSchema = z.object({
  params: z.object({
    id: z.string().uuid('Report ID must be a valid UUID'),
  }),
  body: z.object({
    send_notification: z.boolean().optional().default(true),
    notes: z.string().optional().nullable(),
  }).strict().optional(),
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
  body: z.object({
    preview_only: z.boolean().optional().default(false),
    options: z.object({
      title: z.string().optional(),
      show_watermark: z.boolean().optional(),
      watermark_text: z.string().optional(),
      include_footer: z.boolean().optional(),
      footer_text: z.string().optional(),
      page_size: z.enum(['A4', 'A3', 'Legal', 'Letter']).optional().default('A4'),
      orientation: z.enum(['portrait', 'landscape']).optional().default('portrait'),
      margin: z.object({
        top: z.number().optional(),
        bottom: z.number().optional(),
        left: z.number().optional(),
        right: z.number().optional(),
      }).optional(),
    }).optional(),
  }).strict().optional(),
});

// ─── Download Report Schema ──────────────────────────────────────────────

export const downloadReportSchema = z.object({
  params: z.object({
    id: z.string().uuid('Report ID must be a valid UUID'),
  }),
  query: z.object({
    format: z.enum(['pdf', 'excel']).default('pdf'),
    include_attachments: z.string().optional().transform(val => val !== 'false'),
  }).strict(),
});

// ─── Export Options Schema ──────────────────────────────────────────────

export const exportOptionsSchema = z.object({
  query: z.object({
    include_engagements: z.string().optional().transform(val => val !== 'false'),
    include_unengaged: z.string().optional().transform(val => val !== 'false'),
    include_escalations: z.string().optional().transform(val => val !== 'false'),
    include_patterns: z.string().optional().transform(val => val !== 'false'),
    include_drafts: z.string().optional().transform(val => val === 'true'),
    format: z.enum(['pdf', 'excel', 'both']).default('both'),
  }).optional(),
});

// ─── Bulk Export Schema ──────────────────────────────────────────────────

export const bulkExportSchema = z.object({
  body: z.object({
    report_ids: z.array(z.string().uuid('Report ID must be a valid UUID')).min(1, 'At least one report ID is required'),
    format: z.enum(['pdf', 'excel', 'both']).default('pdf'),
    include_metadata: z.boolean().default(true),
    include_drafts: z.boolean().optional().default(false),
  }).strict(),
});

// ─── Export Status Schema ────────────────────────────────────────────────

export const exportStatusSchema = z.object({
  params: z.object({
    job_id: z.string().uuid('Job ID must be a valid UUID'),
  }),
});

// ─── PDF Preview Schema ──────────────────────────────────────────────────

export const pdfPreviewSchema = z.object({
  params: z.object({
    id: z.string().uuid('Report ID must be a valid UUID'),
  }),
  body: z.object({
    page: z.number().int().min(1).optional().default(1),
    scale: z.number().min(0.1).max(2).optional().default(1),
  }).strict().optional(),
});

// ─── Types ─────────────────────────────────────────────────────────────────

export type EngagementInput = z.infer<typeof engagementSchema>;
export type UnengagedStationInput = z.infer<typeof unengagedStationSchema>;
export type EscalationItemInput = z.infer<typeof escalationItemSchema>;
export type CreateEngagementReportInput = z.infer<typeof createEngagementReportSchema>['body'];
export type UpdateEngagementReportInput = z.infer<typeof updateEngagementReportSchema>['body'];
export type EngagementReportFilters = z.infer<typeof engagementReportFiltersSchema>['query'];
export type ReviewReportInput = z.infer<typeof reviewReportSchema>['body'];
export type ExportOptionsInput = z.infer<typeof exportOptionsSchema>['query'];
export type BulkExportInput = z.infer<typeof bulkExportSchema>['body'];
export type ExportStatusParams = z.infer<typeof exportStatusSchema>['params'];
export type GeneratePDFInput = z.infer<typeof generatePDFSchema>['body'];
export type DownloadReportInput = z.infer<typeof downloadReportSchema>['query'];
export type PDFPreviewInput = z.infer<typeof pdfPreviewSchema>['body'];
export type SubmitReportInput = z.infer<typeof submitReportSchema>['body'];

// ─── Helper Types for Workflow ────────────────────────────────────────────

export type EditableReportStatus = typeof EDITABLE_REPORT_STATUSES[number];
export type VisibleToAdminStatus = typeof VISIBLE_TO_ADMIN_STATUSES[number];
export type SubmittableReportStatus = typeof SUBMITTABLE_STATUSES[number];

// ─── Zod Infer Types for Frontend ────────────────────────────────────────

export type EngagementFormSchema = z.infer<typeof engagementSchema>;
export type UnengagedStationFormSchema = z.infer<typeof unengagedStationSchema>;
export type EscalationItemFormSchema = z.infer<typeof escalationItemSchema>;
export type ReportFormSchema = z.infer<typeof createEngagementReportSchema>['body'];

// ─── PDF Generation Response Schema ──────────────────────────────────────

export const pdfGenerationResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    preview_url: z.string().url().optional().nullable(),
    preview_data: z.string().optional().nullable(),
    is_preview: z.boolean().default(false),
    pdf_public_id: z.string().optional().nullable(),
    pdf_secure_url: z.string().url().optional().nullable(),
    pdf_file_name: z.string().optional().nullable(),
    pdf_generated_at: z.string().datetime().optional().nullable(),
    file_size: z.number().optional(),
    download_url: z.string().url().optional(),
  }),
});

export type PDFGenerationResponse = z.infer<typeof pdfGenerationResponseSchema>;

// ─── Download Tracking Schema ────────────────────────────────────────────

export const downloadTrackingSchema = z.object({
  body: z.object({
    report_id: z.string().uuid('Report ID must be a valid UUID'),
    format: z.enum(['pdf', 'excel']),
    user_id: z.string().uuid('User ID must be a valid UUID'),
    ip_address: z.string().optional(),
    user_agent: z.string().optional(),
  }).strict(),
});

export type DownloadTrackingInput = z.infer<typeof downloadTrackingSchema>['body'];

// ─── Draft Management Schema ─────────────────────────────────────────────

export const draftManagementSchema = z.object({
  params: z.object({
    id: z.string().uuid('Draft ID must be a valid UUID'),
  }),
  body: z.object({
    action: z.enum(['save', 'continue', 'discard', 'submit']),
    reason: z.string().optional(),
  }).strict(),
});

export type DraftManagementInput = z.infer<typeof draftManagementSchema>['body'];

// ─── Validation Helpers ──────────────────────────────────────────────────

export const validateEscalationRequirements = (
  engagement: EngagementInput
): { valid: boolean; error?: string } => {
  if (engagement.status === 'escalated') {
    if (!engagement.urgency) {
      return { valid: false, error: 'Urgency is required when status is escalated' };
    }
    if (!engagement.why_needs_escalation) {
      return { valid: false, error: 'Reason for escalation is required when status is escalated' };
    }
  }
  return { valid: true };
};

export const validateUnengagedStation = (
  station: UnengagedStationInput
): { valid: boolean; error?: string } => {
  if (station.reason_not_reached === 'other') {
    if (!station.reason_not_reached_detail || station.reason_not_reached_detail.trim() === '') {
      return { valid: false, error: 'Please provide details for "Other" reason' };
    }
  }
  return { valid: true };
};

export const isReportEditable = (status: string): boolean => {
  return EDITABLE_REPORT_STATUSES.includes(status as any);
};

export const isReportVisibleToAdmin = (status: string): boolean => {
  return VISIBLE_TO_ADMIN_STATUSES.includes(status as any);
};

// ✅ New: Check if report can be submitted to admin
export const canSubmitToAdmin = (status: string, hasPdf: boolean): boolean => {
  return SUBMITTABLE_STATUSES.includes(status as any) && hasPdf;
};