// src/features/helpdesk/helpdesk.documents.schema.ts

import { z } from 'zod';

const documentFormatEnum   = z.enum(['pdf', 'docx', 'xlsx']);
const documentEntityEnum   = z.enum(['circuit', 'bench', 'partHeard', 'serviceWeek', 'otherPayment']);

// ── POST /api/helpdesk/documents/upload ──────────────────────────────────────
// Body fields come in as multipart/form-data alongside the file.
export const uploadHelpdeskDocumentSchema = z.object({
    body: z.object({
        ref:         z.string().min(1).max(100),
        subject:     z.string().min(1).max(200),
        entity_type: documentEntityEnum,
        entity_id:   z.string().uuid().optional(),
        format:      documentFormatEnum,
    }),
});

// ── GET /api/helpdesk/documents ──────────────────────────────────────────────
export const listHelpdeskDocumentsSchema = z.object({
    query: z.object({
        entity_type: documentEntityEnum.optional(),
        entity_id:   z.string().uuid().optional(),
        format:      documentFormatEnum.optional(),
        search:      z.string().optional(),
        limit:       z.string().regex(/^\d+$/).optional().transform(Number),
        offset:      z.string().regex(/^\d+$/).optional().transform(Number),
    }).strict(),
});

// ── DELETE /api/helpdesk/documents/:id ───────────────────────────────────────
export const documentIdSchema = z.object({
    params: z.object({
        id: z.string().uuid('Document ID must be a valid UUID'),
    }),
});

// ── Type exports ─────────────────────────────────────────────────────────────
export type UploadHelpdeskDocumentBody = z.infer<typeof uploadHelpdeskDocumentSchema>['body'];
export type ListHelpdeskDocumentsQuery = z.infer<typeof listHelpdeskDocumentsSchema>['query'];