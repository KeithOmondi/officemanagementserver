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

// ── Create upload document ─────────────────────────────────────────────────

export const createUploadDocumentSchema = z.object({
  body: z.object({
    title:         z.string().min(1, 'Title is required').max(255).trim(),
    type:          z.enum(['judgment', 'ruling', 'order', 'correspondence', 'upload']),
    category:      documentCategoryEnum.optional(),
    reference_no:  z.string().max(100).trim().optional(),
    assigned_to:   z.string().uuid().optional(),
    department_id: z.string().uuid().optional(),
  }).strict(),
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

// ── Inferred types ──────────────────────────────────────────────────────────

export type CreateComposedDocumentInput = z.infer<typeof createComposedDocumentSchema>['body'];
export type CreateUploadDocumentInput = z.infer<typeof createUploadDocumentSchema>['body'];
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>['body'];
export type DocumentFilters = z.infer<typeof documentFiltersSchema>['query'];
export type CreateAnnotationInput = z.infer<typeof createAnnotationSchema>['body'];
export type MarkDocumentInput = z.infer<typeof markDocumentSchema>['body'];