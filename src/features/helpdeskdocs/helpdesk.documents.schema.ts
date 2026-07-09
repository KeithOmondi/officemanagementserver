// src/features/helpdesk/helpdesk.documents.schema.ts

import { z } from 'zod';

const documentFormatEnum = z.enum(['pdf', 'docx', 'xlsx']);
const documentEntityEnum = z.enum([
    'circuit',
    'bench',
    'partHeard',
    'serviceWeek',
    'otherPayment',
    'ticket',
]);
const documentStatusEnum = z.enum(['draft', 'pending_approval', 'approved', 'rejected', 'returned']);

// ── POST /api/helpdesk/documents/upload ──────────────────────────────────────
export const uploadHelpdeskDocumentSchema = z.object({
    body: z.object({
        ref: z.string().min(1).max(100),
        subject: z.string().min(1).max(200),
        entity_type: documentEntityEnum,
        entity_id: z.string().uuid().optional(),
        format: documentFormatEnum,
        status: documentStatusEnum.default('draft'),
    }),
});

// ── GET /api/helpdesk/documents ──────────────────────────────────────────────
export const listHelpdeskDocumentsSchema = z.object({
    query: z.object({
        entity_type: documentEntityEnum.optional(),
        entity_id: z.string().uuid().optional(),
        format: documentFormatEnum.optional(),
        status: documentStatusEnum.optional(),
        search: z.string().optional(),
        limit: z.string().regex(/^\d+$/).optional().transform(Number),
        offset: z.string().regex(/^\d+$/).optional().transform(Number),
        uploaded_by: z.string().uuid().optional(),
        pending_my_approval: z.string().transform((val) => val === 'true').optional(),
        unlinked: z.string().transform((val) => val === 'true').optional(),
    }).strict(),
});

// ── GET /api/helpdesk/documents/:id ──────────────────────────────────────────
export const getDocumentByIdSchema = z.object({
    params: z.object({
        id: z.string().uuid('Document ID must be a valid UUID'),
    }),
});

// ── PUT /api/helpdesk/documents/:id/status ─────────────────────────────────
export const updateDocumentStatusSchema = z.object({
    params: z.object({
        id: z.string().uuid('Document ID must be a valid UUID'),
    }),
    body: z.object({
        status: documentStatusEnum,
        comments: z.string().max(500).optional(),
        rejection_reason: z.string().max(500).optional(),
    }),
});

// ── POST /api/helpdesk/documents/:id/submit ─────────────────────────────────
export const submitDocumentForApprovalSchema = z.object({
    params: z.object({
        id: z.string().uuid('Document ID must be a valid UUID'),
    }),
    body: z.object({
        comments: z.string().max(500).optional(),
    }).optional(),
});

// ── POST /api/helpdesk/documents/:id/approve ────────────────────────────────
export const approveDocumentSchema = z.object({
    params: z.object({
        id: z.string().uuid('Document ID must be a valid UUID'),
    }),
    body: z.object({
        comments: z.string().max(500).optional(),
    }),
});

// ── POST /api/helpdesk/documents/:id/reject ─────────────────────────────────
export const rejectDocumentSchema = z.object({
    params: z.object({
        id: z.string().uuid('Document ID must be a valid UUID'),
    }),
    body: z.object({
        reason: z.string().min(1).max(500),
        comments: z.string().max(500).optional(),
    }),
});

// ── POST /api/helpdesk/documents/:id/return ─────────────────────────────────
export const returnDocumentSchema = z.object({
    params: z.object({
        id: z.string().uuid('Document ID must be a valid UUID'),
    }),
    body: z.object({
        comments: z.string().max(500).optional(),
        instructions: z.string().max(500).optional(),
    }),
});

// ── POST /api/helpdesk/documents/:id/comments ───────────────────────────────
export const addCommentSchema = z.object({
    params: z.object({
        id: z.string().uuid('Document ID must be a valid UUID'),
    }),
    body: z.object({
        comment: z.string().min(1).max(500),
        is_internal: z.boolean().default(false),
    }),
});

// ── DELETE /api/helpdesk/documents/:id ───────────────────────────────────────
export const documentIdSchema = z.object({
    params: z.object({
        id: z.string().uuid('Document ID must be a valid UUID'),
    }),
});

// ── PATCH /api/helpdesk/documents/:id/link ───────────────────────────────────
export const linkDocumentSchema = z.object({
    params: z.object({
        id: z.string().uuid('Document ID must be a valid UUID'),
    }),
    body: z.object({
        entity_type: documentEntityEnum,
        entity_id: z.string().uuid('entity_id must be a valid UUID'),
    }),
});

// ── Type exports ─────────────────────────────────────────────────────────────
export type UploadHelpdeskDocumentBody = z.infer<typeof uploadHelpdeskDocumentSchema>['body'];
export type ListHelpdeskDocumentsQuery = z.infer<typeof listHelpdeskDocumentsSchema>['query'];
export type UpdateDocumentStatusBody = z.infer<typeof updateDocumentStatusSchema>['body'];
export type SubmitDocumentForApprovalBody = z.infer<typeof submitDocumentForApprovalSchema>['body'];
export type ApproveDocumentBody = z.infer<typeof approveDocumentSchema>['body'];
export type RejectDocumentBody = z.infer<typeof rejectDocumentSchema>['body'];
export type ReturnDocumentBody = z.infer<typeof returnDocumentSchema>['body'];
export type AddCommentBody = z.infer<typeof addCommentSchema>['body'];
export type LinkDocumentBody = z.infer<typeof linkDocumentSchema>['body'];