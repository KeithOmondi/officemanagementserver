// src/features/documents/documents.validator.ts
import { z } from 'zod';

export const documentTypeEnum = z.enum([
  'memo', 'letter', 'judgment', 'ruling', 'order', 'correspondence', 'upload'
]);

export const documentStatusEnum = z.enum([
  'draft', 'uploaded', 'pending_review', 'marked', 'in_progress', 'completed', 'filed'
]);

export const documentCategoryEnum = z.enum([
  'judgments', 'rulings', 'correspondence', 'orders', 'drafts', 'general'
]);

export const refTypeEnum = z.enum([
  'for_signature', 'for_attention', 'for_information', 'direction', 'other'
]);

// ── Create composed document ────────────────────────────────────────────────

export const createComposedDocumentSchema = z.object({
  body: z.object({
    title:         z.string().min(1, 'Title is required').max(255).trim(),
    type:          z.enum(['memo', 'letter']),
    category:      documentCategoryEnum.optional(),
    reference_no:  z.string().max(100).trim().optional(),
    body:          z.string().min(1, 'Document body is required'),
    assigned_to:   z.string().uuid().optional(),
    department_id: z.string().uuid().optional(),
  }).strict(),
});

// ── Create Memo ──────────────────────────────────────────────────────────────

export const createMemoSchema = z.object({
  body: z.object({
    to: z.string().min(1, 'Recipient is required').max(255).trim(),
    from: z.string().min(1, 'Sender is required').max(255).trim(),
    cc: z.string().max(255).trim().optional(),
    ref: z.string().min(1, 'Reference is required').max(100).trim(),
    date: z.string().min(1, 'Date is required').trim(),
    subject: z.string().min(1, 'Subject is required').max(255).trim(),
    body: z.string().min(1, 'Body is required'),
    recipient_id: z.string().uuid().optional(),
    note: z.string().max(500).trim().optional(),
  }).strict(),
});

// ── Create Letter ────────────────────────────────────────────────────────────

export const createLetterSchema = z.object({
  body: z.object({
    to: z.string().min(1, 'Recipient is required').max(255).trim(),
    from: z.string().min(1, 'Sender is required').max(255).trim(),
    ref: z.string().min(1, 'Reference is required').max(100).trim(),
    date: z.string().min(1, 'Date is required').trim(),
    subject: z.string().min(1, 'Subject is required').max(255).trim(),
    body: z.string().min(1, 'Body is required'),
    recipient_id: z.string().uuid().optional(),
    note: z.string().max(500).trim().optional(),
  }).strict(),
});

// ── Create upload document ─────────────────────────────────────────────────

export const createUploadDocumentSchema = z.object({
  body: z.object({
    title:         z.string().min(1, 'Title is required').max(255).trim(),
    type:          z.enum(['judgment', 'ruling', 'order', 'correspondence', 'upload']),
    category:      documentCategoryEnum.optional(),
    reference_no:  z.string().max(100).trim().optional(),
    ref_type:           refTypeEnum,
    ref_other_description: z.string().max(500).trim().optional(),
    priority:      z.enum(['low', 'normal', 'urgent']).default('normal'),
    assigned_to:   z.string().uuid().optional(),
    department_id: z.string().uuid().optional(),
    is_draft:      z.coerce.boolean().default(false),
  })
  .strict()
  .refine(
    (b) => b.ref_type !== 'other' || !!b.ref_other_description,
    { message: 'ref_other_description is required when ref_type is "other"', path: ['ref_other_description'] }
  ),
});

// ── Update ──────────────────────────────────────────────────────────────────

export const updateDocumentSchema = z.object({
  body: z.object({
    title:         z.string().min(1).max(255).trim().optional(),
    category:      documentCategoryEnum.optional(),
    reference_no:  z.string().max(100).trim().optional(),
    body:          z.string().optional(),
    status:        documentStatusEnum.optional(),
    assigned_to:   z.string().uuid().nullable().optional(),
    department_id: z.string().uuid().nullable().optional(),
  })
  .strict()
  .refine((b) => Object.keys(b).length > 0, {
    message: 'At least one field must be provided to update',
  }),
});

// ── Mark to Department ─────────────────────────────────────────────────────

export const markDocumentSchema = z.object({
  body: z.object({
    department_id: z.string().uuid('Must be a valid department ID'),
    assigned_to: z.string().uuid('Must be a valid user ID').optional(),
    instructions: z.string().max(1000).trim().optional(),
    priority: z.enum(['low', 'normal', 'urgent']).default('normal'),
  }).strict(),
});

export const acknowledgeMarkSchema = z.object({
  body: z.object({}).strict(),
});

// ── Filters ─────────────────────────────────────────────────────────────────

export const documentFiltersSchema = z.object({
  query: z.object({
    search:               z.string().trim().max(100).optional(),
    type:                 documentTypeEnum.optional(),
    category:             documentCategoryEnum.optional(),
    status:               documentStatusEnum.optional(),
    assigned_to:          z.string().uuid().optional(),
    department_id:        z.string().uuid().optional(),
    for_my_action:        z.enum(['true', 'false']).transform(v => v === 'true').optional(),
    visible_in_summary:   z.enum(['true', 'false']).transform(v => v === 'true').optional(),
    page:       z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1)).optional(),
    limit:      z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
    sort_by:    z.enum(['created_at', 'updated_at', 'title', 'status']).optional(),
    sort_order: z.enum(['ASC', 'DESC']).optional(),
  }),
});

// ── ID params ──────────────────────────────────────────────────────────────

export const documentIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Document ID must be a valid UUID'),
  }),
});

export const annotationIdSchema = z.object({
  params: z.object({
    id:           z.string().uuid('Document ID must be a valid UUID'),
    annotationId: z.string().uuid('Annotation ID must be a valid UUID'),
  }),
});

// ── Annotation ─────────────────────────────────────────────────────────────

export const createAnnotationSchema = z.object({
  body: z.object({
    comment:            z.string().min(1, 'Comment cannot be empty').max(2000).trim(),
    is_urgent:          z.boolean().default(false),
    visible_in_summary: z.boolean().default(false),
  }).strict(),
});

// ── Response (threaded reply to a return/action request) ───────────────────

export const respondToDocumentSchema = z.object({
  body: z.object({
    note: z.string().min(1, 'A response note is required').max(2000).trim(),
  }).strict(),
});

// New schema for returning a document for action
export const returnDocumentSchema = z.object({
  body: z.object({
    note: z.string().min(1, 'A reason for returning is required').max(1000).trim(),
    requires_more_docs: z.boolean().default(false),
  }).strict(),
});

// Saving/promoting a draft
export const finalizeDraftSchema = z.object({
  body: z.object({
    assigned_to: z.string().uuid().optional(),
    send_to_super_admin: z.boolean().default(false),
  }).strict()
  .refine(b => !!b.assigned_to !== !!b.send_to_super_admin, {
    message: 'Provide either assigned_to or send_to_super_admin, not both',
  }),
});

// ── Send to User ────────────────────────────────────────────────────────────

export const sendToUserSchema = z.object({
  body: z.object({
    recipient_id: z.string().uuid('Must be a valid user ID'),
    note: z.string().max(500).trim().optional(),
  }).strict(),
});

// ── Inferred types ──────────────────────────────────────────────────────────

export type CreateComposedDocumentInput = z.infer<typeof createComposedDocumentSchema>['body'];
export type CreateUploadDocumentInput = z.infer<typeof createUploadDocumentSchema>['body'];
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>['body'];
export type DocumentFilters = z.infer<typeof documentFiltersSchema>['query'];
export type CreateAnnotationInput = z.infer<typeof createAnnotationSchema>['body'];
export type MarkDocumentInput = z.infer<typeof markDocumentSchema>['body'];
export type RespondToDocumentInput = z.infer<typeof respondToDocumentSchema>['body'];
export type CreateMemoInput = z.infer<typeof createMemoSchema>['body'];
export type CreateLetterInput = z.infer<typeof createLetterSchema>['body'];
export type SendToUserInput = z.infer<typeof sendToUserSchema>['body'];