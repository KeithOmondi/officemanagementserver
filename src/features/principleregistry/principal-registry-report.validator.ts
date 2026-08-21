// principal-registry-report.validator.ts
// Zod schemas for the Principal Registry Weekly Report, following the same
// { body, params, query }-wrapped convention as registry.validator.ts, so
// controllers call `schema.safeParse({ body: req.body })` etc. throughout.

import { z } from 'zod';

// ─── Date Normalization Helper ──────────────────────────────────────────────

/**
 * Normalizes a date value to YYYY-MM-DD format
 * Handles: ISO strings ("2026-08-17T00:00:00.000Z"), Date objects, and already-formatted strings
 */
const normalizeDate = (val: unknown): string | unknown => {
  if (typeof val === 'string') {
    // If it's ISO format with time, strip the time part
    if (val.includes('T')) {
      return val.split('T')[0];
    }
    // If it's already YYYY-MM-DD, return as is
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
      return val;
    }
    // Try to parse and format
    try {
      const parsed = new Date(val);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().split('T')[0];
      }
    } catch {
      // Return as is if parsing fails
      return val;
    }
  }
  if (val instanceof Date) {
    return val.toISOString().split('T')[0];
  }
  return val;
};

// ─── Date Schema with Normalization ──────────────────────────────────────────

const dateStringSchema = z.preprocess(
  normalizeDate,
  z.string().refine((v) => !isNaN(Date.parse(v)), {
    message: 'Invalid date string',
  })
);

// ─── Optional Date Schema ────────────────────────────────────────────────────

const optionalDateStringSchema = z.preprocess(
  normalizeDate,
  z.string().refine((v) => !isNaN(Date.parse(v)), {
    message: 'Invalid date string',
  }).optional()
);

// ── Helper schemas ──────────────────────────────────────────────────────────

// Handles empty strings ("") -> undefined for optional query params
const optionalStringQuerySchema = z.preprocess(
  (val) => (val === '' || val === null ? undefined : val),
  z.string().optional()
);

// Handles empty strings ("") -> undefined for UUID query params
const optionalUuidQuerySchema = z.preprocess(
  (val) => (val === '' || val === null ? undefined : val),
  z.string().uuid('ID must be a valid UUID').optional()
);

// ── Section building blocks ──────────────────────────────────────────────────

// ─── Administrative Overview ─────────────────────────────────────────────────

export const administrativeOverviewSchema = z.object({
  keyActivities: z.array(z.string().min(1)).default([]),
  notableIssues: z.array(z.string()).default([]),
  resolutionsStatus: z.array(z.string()).default([]),
});

// For updates - manually make all fields optional (no .partial() on schemas with refinements)
export const administrativeOverviewUpdateSchema = z.object({
  keyActivities: z.array(z.string().min(1)).default([]).optional(),
  notableIssues: z.array(z.string()).default([]).optional(),
  resolutionsStatus: z.array(z.string()).default([]).optional(),
});

// ─── Case Management ─────────────────────────────────────────────────────────

// Base schema for creation (with refinements)
export const caseManagementSchema = z
  .object({
    form30PendingCount: z.number().int().nonnegative(),
    forwardedToGp: z.boolean(),
    submissionDates: z.array(dateStringSchema).nullable().optional(),
    noticesSubmittedCount: z.number().int().nonnegative().nullable().optional(),
    nonSubmissionReason: z.string().nullable().optional(),
    expectedSubmissionDate: dateStringSchema.nullable().optional(),
  })
  .superRefine((data, ctx) => {
    // Only validate if forwardedToGp is present (for creation it always is)
    if (data.forwardedToGp !== undefined) {
      if (!data.forwardedToGp && !data.nonSubmissionReason) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'nonSubmissionReason is required when forwardedToGp is false',
          path: ['nonSubmissionReason'],
        });
      }
      if (data.forwardedToGp && (!data.submissionDates || data.submissionDates.length === 0)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'submissionDates is required when forwardedToGp is true',
          path: ['submissionDates'],
        });
      }
    }
  });

// For updates - manually make all fields optional and use a separate refinement
export const caseManagementUpdateSchema = z
  .object({
    form30PendingCount: z.number().int().nonnegative().optional(),
    forwardedToGp: z.boolean().optional(),
    submissionDates: z.array(dateStringSchema).nullable().optional(),
    noticesSubmittedCount: z.number().int().nonnegative().nullable().optional(),
    nonSubmissionReason: z.string().nullable().optional(),
    expectedSubmissionDate: dateStringSchema.nullable().optional(),
  })
  .superRefine((data, ctx) => {
    // Only validate if forwardedToGp is provided
    if (data.forwardedToGp !== undefined) {
      if (!data.forwardedToGp && !data.nonSubmissionReason) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'nonSubmissionReason is required when forwardedToGp is false',
          path: ['nonSubmissionReason'],
        });
      }
      if (data.forwardedToGp && (!data.submissionDates || data.submissionDates.length === 0)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'submissionDates is required when forwardedToGp is true',
          path: ['submissionDates'],
        });
      }
    }
  });

// ─── Automation Status ──────────────────────────────────────────────────────

export const automationStatusSchema = z.object({
  excelUpdateStatus: z.string().min(1, 'Excel update status is required'),
  systemBuildStatus: z.string().min(1, 'System build status is required'),
});

// For updates - manually make all fields optional
export const automationStatusUpdateSchema = z.object({
  excelUpdateStatus: z.string().min(1, 'Excel update status is required').optional(),
  systemBuildStatus: z.string().min(1, 'System build status is required').optional(),
});

// ─── Service Delivery Challenges ─────────────────────────────────────────────

// Base schema for creation (with refinements)
export const serviceDeliveryChallengesSchema = z
  .object({
    hasChallenges: z.boolean(),
    challengeDetails: z.array(z.string()).nullable().optional(),
    proposedSolutions: z.array(z.string()).default([]),
    needsRhcIntervention: z.boolean(),
    interventionDetails: z.array(z.string()).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    // Only validate if hasChallenges is present (for creation it always is)
    if (data.hasChallenges !== undefined) {
      if (data.hasChallenges && (!data.challengeDetails || data.challengeDetails.length === 0)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'challengeDetails is required when hasChallenges is true',
          path: ['challengeDetails'],
        });
      }
    }
    if (data.needsRhcIntervention !== undefined) {
      if (data.needsRhcIntervention && (!data.interventionDetails || data.interventionDetails.length === 0)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'interventionDetails is required when needsRhcIntervention is true',
          path: ['interventionDetails'],
        });
      }
    }
  });

// For updates - manually make all fields optional with refinements
export const serviceDeliveryChallengesUpdateSchema = z
  .object({
    hasChallenges: z.boolean().optional(),
    challengeDetails: z.array(z.string()).nullable().optional(),
    proposedSolutions: z.array(z.string()).default([]).optional(),
    needsRhcIntervention: z.boolean().optional(),
    interventionDetails: z.array(z.string()).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    // Only validate if hasChallenges is provided
    if (data.hasChallenges !== undefined) {
      if (data.hasChallenges && (!data.challengeDetails || data.challengeDetails.length === 0)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'challengeDetails is required when hasChallenges is true',
          path: ['challengeDetails'],
        });
      }
    }
    // Only validate if needsRhcIntervention is provided
    if (data.needsRhcIntervention !== undefined) {
      if (data.needsRhcIntervention && (!data.interventionDetails || data.interventionDetails.length === 0)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'interventionDetails is required when needsRhcIntervention is true',
          path: ['interventionDetails'],
        });
      }
    }
  });

// ─── Highlights ─────────────────────────────────────────────────────────────

export const highlightsSchema = z.object({
  achievements: z.array(z.string()).default([]),
});

// For updates - manually make all fields optional
export const highlightsUpdateSchema = z.object({
  achievements: z.array(z.string()).default([]).optional(),
});

// ─── Sign-off ──────────────────────────────────────────────────────────────

export const signOffSchema = z.object({
  preparedDate: dateStringSchema,
  preparedByName: z.string().min(1, 'Name is required'),
  preparedByDesignation: z.string().min(1, 'Designation is required'),
});

// For updates - manually make all fields optional
export const signOffUpdateSchema = z.object({
  preparedDate: dateStringSchema.optional(),
  preparedByName: z.string().min(1, 'Name is required').optional(),
  preparedByDesignation: z.string().min(1, 'Designation is required').optional(),
});

// ─── Other Information ──────────────────────────────────────────────────────

export const otherInformationSchema = z.object({
  ctsEfilingChanges: z.array(z.string()).default([]),
  gpChanges: z.array(z.string()).default([]),
  signOff: signOffSchema,
});

// For updates - manually make all fields optional
export const otherInformationUpdateSchema = z.object({
  ctsEfilingChanges: z.array(z.string()).default([]).optional(),
  gpChanges: z.array(z.string()).default([]).optional(),
  signOff: signOffUpdateSchema.optional(),
});

// ── Body & Query schemas ──────────────────────────────────────────────────────

const createReportBodySchema = z
  .object({
    weekEndingDates: z.array(dateStringSchema).min(1, 'At least one week-ending date is required'),
    reportPeriodStart: dateStringSchema,
    reportPeriodEnd: dateStringSchema,
    departmentId: z.string().uuid('Department ID must be a valid UUID'),
    administrativeOverview: administrativeOverviewSchema,
    caseManagement: caseManagementSchema,
    automationStatus: automationStatusSchema,
    serviceDeliveryChallenges: serviceDeliveryChallengesSchema,
    highlights: highlightsSchema,
    otherInformation: otherInformationSchema,
    status: z.enum(['draft', 'submitted', 'reviewed', 'archived']).optional(),
  })
  .refine((data) => new Date(data.reportPeriodEnd) >= new Date(data.reportPeriodStart), {
    message: 'reportPeriodEnd must be on or after reportPeriodStart',
    path: ['reportPeriodEnd'],
  });

// ─── Update schema with more flexible validation ───────────────────────────

const updateReportBodySchema = z
  .object({
    weekEndingDates: z.array(dateStringSchema).optional(),
    reportPeriodStart: optionalDateStringSchema,
    reportPeriodEnd: optionalDateStringSchema,
    departmentId: optionalUuidQuerySchema,
    administrativeOverview: administrativeOverviewUpdateSchema.optional(),
    caseManagement: caseManagementUpdateSchema.optional(),
    automationStatus: automationStatusUpdateSchema.optional(),
    serviceDeliveryChallenges: serviceDeliveryChallengesUpdateSchema.optional(),
    highlights: highlightsUpdateSchema.optional(),
    otherInformation: otherInformationUpdateSchema.optional(),
    status: z.enum(['draft', 'submitted', 'reviewed', 'archived']).optional(),
    // PDF attachment fields
    pdfPublicId: z.string().optional(),
    pdfSecureUrl: z.string().optional(),
    pdfFileName: z.string().optional(),
    pdfGeneratedAt: optionalDateStringSchema,
    // Submission tracking fields
    submittedAt: optionalDateStringSchema,
    reviewedAt: optionalDateStringSchema,
    reviewedBy: z.string().uuid('User ID must be a valid UUID').optional(),
    reviewNotes: z.string().optional(),
  })
  // Only validate date range if both dates are provided
  .superRefine((data, ctx) => {
    if (data.reportPeriodStart && data.reportPeriodEnd) {
      const start = new Date(data.reportPeriodStart);
      const end = new Date(data.reportPeriodEnd);
      if (end < start) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'reportPeriodEnd must be on or after reportPeriodStart',
          path: ['reportPeriodEnd'],
        });
      }
    }
  });

const reviewReportBodySchema = z.object({
  reviewNotes: z.string().optional(),
  action: z.enum(['approve', 'reject']),
});

// ─── PDF Generation Schemas ──────────────────────────────────────────────────

const pdfGenerationOptionsSchema = z.object({
  title: z.string().optional(),
  showWatermark: z.boolean().optional(),
  watermarkText: z.string().optional(),
  includeFooter: z.boolean().optional(),
  footerText: z.string().optional(),
  pageSize: z.enum(['A4', 'A3', 'Legal', 'Letter']).optional(),
  orientation: z.enum(['portrait', 'landscape']).optional(),
  margin: z.object({
    top: z.number().optional(),
    bottom: z.number().optional(),
    left: z.number().optional(),
    right: z.number().optional(),
  }).optional(),
});

const generatePdfBodySchema = z.object({
  reportId: z.string().uuid('Report ID must be a valid UUID'),
  options: pdfGenerationOptionsSchema.optional(),
});

// ─── ID Schemas ──────────────────────────────────────────────────────────────

const reportIdSchema = z.object({
  id: z.string().uuid('Invalid report ID. Must be a valid UUID.'),
});

// ─── Query Schemas ───────────────────────────────────────────────────────────

const reportListQuerySchema = z.object({
  departmentId: optionalUuidQuerySchema,
  status: z.preprocess(
    (val) => (val === '' ? undefined : val),
    z.enum(['draft', 'submitted', 'reviewed', 'archived']).optional()
  ),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

const getQuestionsQuerySchema = z.object({
  departmentId: optionalUuidQuerySchema,
});

// ─── Wrapped request schemas (used directly in controllers) ──────────────────

export const createReportSchema = z.object({
  body: createReportBodySchema,
});

export const updateReportSchema = z.object({
  params: reportIdSchema,
  body: updateReportBodySchema,
});

export const reviewReportSchema = z.object({
  params: reportIdSchema,
  body: reviewReportBodySchema,
});

export const reportIdParamSchema = z.object({
  params: reportIdSchema,
});

export const reportFiltersSchema = z.object({
  query: reportListQuerySchema,
});

export const getQuestionsSchema = z.object({
  query: getQuestionsQuerySchema,
});

// ─── PDF Generation Schemas ──────────────────────────────────────────────────

export const generatePdfSchema = z.object({
  body: generatePdfBodySchema,
});

// ─── Inferred types ────────────────────────────────────────────────────────────

export type CreateReportInput = z.infer<typeof createReportBodySchema>;
export type UpdateReportInput = z.infer<typeof updateReportBodySchema>;
export type ReviewReportInput = z.infer<typeof reviewReportBodySchema>;
export type ReportListQuery = z.infer<typeof reportListQuerySchema>;
export type GetQuestionsQuery = z.infer<typeof getQuestionsQuerySchema>;
export type GeneratePdfInput = z.infer<typeof generatePdfBodySchema>;
export type PdfGenerationOptions = z.infer<typeof pdfGenerationOptionsSchema>;