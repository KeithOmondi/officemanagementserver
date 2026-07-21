// src/features/helpdesk/helpdesk.documents.schema.ts

import { z } from 'zod';

// ─── Base Enums ──────────────────────────────────────────────────────────────

const documentFormatEnum = z.enum(['pdf', 'docx', 'xlsx']);

const documentEntityEnum = z.enum([
    'circuit',
    'bench',
    'partHeard',
    'serviceWeek',
    'otherPayment',
    'ticket',
    'medicalClaim',
    'generalRequest',   // Unified - includes all security/personnel requests
    'securityRequest',  // Deprecated - kept for backward compatibility
    'visa',             // Visa support documents
    'protocol',         // Protocol event documents
    'club',             // Club membership documents
    'utility_memo',     // Utility memo documents
]);

const documentStatusEnum = z.enum(['draft', 'pending_approval', 'approved', 'rejected', 'returned']);

const requestTypeEnum = z.enum([
    'Driver',
    'Bodyguard',
    'Firearm',
    'Current Station',
    'Force Number',
    'Residence Security',
    'Sentry'
]);

const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional();

// ─── POST /api/helpdesk/documents/upload ──────────────────────────────────────

/**
 * This schema handles multipart/form-data uploads where all fields come as strings.
 * Since multer parses form-data fields as strings, we need to handle the conversion.
 */
export const uploadHelpdeskDocumentSchema = z.object({
    body: z.object({
        ref: z.string().min(1, 'Reference is required').max(100),
        subject: z.string().min(1, 'Subject is required').max(200),
        entity_type: z.string().pipe(documentEntityEnum),
        entity_id: z.string().uuid().optional().nullable(),
        format: z.string().pipe(documentFormatEnum),
        status: z.string().default('draft').pipe(documentStatusEnum).optional(),
        request_type: z.string().pipe(requestTypeEnum).optional().nullable(),
        judge_name: z.string().max(100).optional().nullable(),
        rank: z.string().max(50).optional().nullable(),
        reporting_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional().nullable(),
    }),
});

// ─── GET /api/helpdesk/documents ──────────────────────────────────────────────
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
        request_type: requestTypeEnum.optional(),
        judge_name: z.string().optional(),
        date_from: dateStringSchema.optional(),
        date_to: dateStringSchema.optional(),
        rank: z.string().optional(),
        reporting_date: dateStringSchema.optional(),
    }).strict(),
});

// ─── GET /api/helpdesk/documents/:id ──────────────────────────────────────────
export const getDocumentByIdSchema = z.object({
    params: z.object({
        id: z.string().uuid('Document ID must be a valid UUID'),
    }),
});

// ─── PUT /api/helpdesk/documents/:id/status ─────────────────────────────────
export const updateDocumentStatusSchema = z.object({
    params: z.object({
        id: z.string().uuid('Document ID must be a valid UUID'),
    }),
    body: z.object({
        status: documentStatusEnum,
        comments: z.string().max(500).optional(),
        rejection_reason: z.string().max(500).optional(),
        approved_by: z.string().uuid().optional(),
        approved_by_name: z.string().max(100).optional(),
    }),
});

// ─── POST /api/helpdesk/documents/:id/submit ─────────────────────────────────
export const submitDocumentForApprovalSchema = z.object({
    params: z.object({
        id: z.string().uuid('Document ID must be a valid UUID'),
    }),
    body: z.object({
        comments: z.string().max(500).optional(),
        submitted_by: z.string().uuid().optional(),
        submitted_by_name: z.string().max(100).optional(),
    }).optional(),
});

// ─── POST /api/helpdesk/documents/:id/approve ────────────────────────────────
export const approveDocumentSchema = z.object({
    params: z.object({
        id: z.string().uuid('Document ID must be a valid UUID'),
    }),
    body: z.object({
        comments: z.string().max(500).optional(),
        approved_by: z.string().uuid().optional(),
        approved_by_name: z.string().max(100).optional(),
        e_stamp_url: z.string().url().optional(),
        e_stamp_public_id: z.string().optional(),
    }),
});

// ─── POST /api/helpdesk/documents/:id/reject ─────────────────────────────────
export const rejectDocumentSchema = z.object({
    params: z.object({
        id: z.string().uuid('Document ID must be a valid UUID'),
    }),
    body: z.object({
        reason: z.string().min(1).max(500),
        comments: z.string().max(500).optional(),
        rejected_by: z.string().uuid().optional(),
        rejected_by_name: z.string().max(100).optional(),
    }),
});

// ─── POST /api/helpdesk/documents/:id/return ─────────────────────────────────
export const returnDocumentSchema = z.object({
    params: z.object({
        id: z.string().uuid('Document ID must be a valid UUID'),
    }),
    body: z.object({
        comments: z.string().max(500).optional(),
        instructions: z.string().max(500).optional(),
        returned_by: z.string().uuid().optional(),
        returned_by_name: z.string().max(100).optional(),
    }),
});

// ─── POST /api/helpdesk/documents/:id/comments ───────────────────────────────
export const addCommentSchema = z.object({
    params: z.object({
        id: z.string().uuid('Document ID must be a valid UUID'),
    }),
    body: z.object({
        comment: z.string().min(1).max(500),
        is_internal: z.boolean().default(false),
    }),
});

// ─── DELETE /api/helpdesk/documents/:id ───────────────────────────────────────
export const documentIdSchema = z.object({
    params: z.object({
        id: z.string().uuid('Document ID must be a valid UUID'),
    }),
});

// ─── DELETE /api/helpdesk/documents/comments/:commentId ──────────────────────
export const deleteCommentSchema = z.object({
    params: z.object({
        commentId: z.string().uuid('Comment ID must be a valid UUID'),
    }),
});

// ─── PATCH /api/helpdesk/documents/:id/link ───────────────────────────────────
export const linkDocumentSchema = z.object({
    params: z.object({
        id: z.string().uuid('Document ID must be a valid UUID'),
    }),
    body: z.object({
        entity_type: documentEntityEnum,
        entity_id: z.string().uuid('entity_id must be a valid UUID'),
        request_type: requestTypeEnum.optional(),
        judge_name: z.string().max(100).optional(),
        rank: z.string().max(50).optional(),
        reporting_date: dateStringSchema.optional(),
    }),
});

// ─── GET /api/helpdesk/documents/stats ────────────────────────────────────────
export const documentStatsSchema = z.object({
    query: z.object({
        entity_type: documentEntityEnum.optional(),
        date_from: dateStringSchema.optional(),
        date_to: dateStringSchema.optional(),
    }).optional(),
});

// ─── GET /api/helpdesk/documents/entity/:entityType/:entityId ────────────────
export const getDocumentsByEntitySchema = z.object({
    params: z.object({
        entity_type: documentEntityEnum,
        entity_id: z.string().uuid('Entity ID must be a valid UUID'),
    }),
    query: z.object({
        status: documentStatusEnum.optional(),
        limit: z.string().regex(/^\d+$/).optional().transform(Number),
        offset: z.string().regex(/^\d+$/).optional().transform(Number),
    }).optional(),
});

// ─── GET /api/helpdesk/documents/download/:id ─────────────────────────────────
export const downloadDocumentSchema = z.object({
    params: z.object({
        id: z.string().uuid('Document ID must be a valid UUID'),
    }),
});

// ─── GET /api/helpdesk/documents/estampt/:id ──────────────────────────────────
export const downloadEStampSchema = z.object({
    params: z.object({
        id: z.string().uuid('Document ID must be a valid UUID'),
    }),
});

// ─── POST /api/helpdesk/documents/:id/estampt ────────────────────────────────
export const updateEStampSchema = z.object({
    params: z.object({
        id: z.string().uuid('Document ID must be a valid UUID'),
    }),
    body: z.object({
        e_stamp_url: z.string().url().optional(),
        e_stamp_public_id: z.string().optional(),
        e_stamp_status: z.enum(['pending', 'stamped', 'failed']).default('stamped'),
    }),
});

// ─── POST /api/helpdesk/documents/bulk/link ──────────────────────────────────
export const bulkLinkDocumentsSchema = z.object({
    body: z.object({
        document_ids: z.array(z.string().uuid()).min(1, 'At least one document ID is required'),
        entity_type: documentEntityEnum,
        entity_id: z.string().uuid('Entity ID must be a valid UUID'),
        request_type: requestTypeEnum.optional(),
        judge_name: z.string().max(100).optional(),
        rank: z.string().max(50).optional(),
        reporting_date: dateStringSchema.optional(),
    }),
});

// ─── POST /api/helpdesk/documents/bulk/status ─────────────────────────────────
export const bulkUpdateStatusSchema = z.object({
    body: z.object({
        document_ids: z.array(z.string().uuid()).min(1, 'At least one document ID is required'),
        status: documentStatusEnum,
        comments: z.string().max(500).optional(),
    }),
});

// ─── POST /api/helpdesk/documents/upload/batch ───────────────────────────────
export const batchUploadSchema = z.object({
    body: z.object({
        documents: z.array(
            z.object({
                ref: z.string().min(1).max(100),
                subject: z.string().min(1).max(200),
                entity_type: documentEntityEnum,
                entity_id: z.string().uuid().optional(),
                format: documentFormatEnum,
                status: documentStatusEnum.default('draft'),
                request_type: requestTypeEnum.optional(),
                judge_name: z.string().max(100).optional(),
                rank: z.string().max(50).optional(),
                reporting_date: dateStringSchema.optional(),
            })
        ).min(1, 'At least one document is required').max(20, 'Maximum 20 documents per batch'),
    }),
});

// ─── Type exports ─────────────────────────────────────────────────────────────

// Core Types
export type UploadHelpdeskDocumentBody = z.infer<typeof uploadHelpdeskDocumentSchema>['body'];
export type ListHelpdeskDocumentsQuery = z.infer<typeof listHelpdeskDocumentsSchema>['query'];
export type UpdateDocumentStatusBody = z.infer<typeof updateDocumentStatusSchema>['body'];
export type SubmitDocumentForApprovalBody = z.infer<typeof submitDocumentForApprovalSchema>['body'];
export type ApproveDocumentBody = z.infer<typeof approveDocumentSchema>['body'];
export type RejectDocumentBody = z.infer<typeof rejectDocumentSchema>['body'];
export type ReturnDocumentBody = z.infer<typeof returnDocumentSchema>['body'];
export type AddCommentBody = z.infer<typeof addCommentSchema>['body'];
export type LinkDocumentBody = z.infer<typeof linkDocumentSchema>['body'];

// Additional Types
export type DocumentStatsQuery = z.infer<typeof documentStatsSchema>['query'];
export type GetDocumentsByEntityParams = z.infer<typeof getDocumentsByEntitySchema>['params'];
export type GetDocumentsByEntityQuery = z.infer<typeof getDocumentsByEntitySchema>['query'];
export type UpdateEStampBody = z.infer<typeof updateEStampSchema>['body'];
export type BulkLinkDocumentsBody = z.infer<typeof bulkLinkDocumentsSchema>['body'];
export type BulkUpdateStatusBody = z.infer<typeof bulkUpdateStatusSchema>['body'];
export type BatchUploadBody = z.infer<typeof batchUploadSchema>['body'];
export type DeleteCommentParams = z.infer<typeof deleteCommentSchema>['params'];

// Export enums for use in routes
export {
    documentFormatEnum,
    documentEntityEnum,
    documentStatusEnum,
    requestTypeEnum,
    dateStringSchema,
};