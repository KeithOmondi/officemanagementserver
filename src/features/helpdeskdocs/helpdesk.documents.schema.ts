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
    'generalRequest',
    'securityRequest',
    'visa',
    'protocol',
    'club',
    'utility_memo',
    'consolidated_utility_memo',
    'consolidated_fuel_memo',
    'aide',
    'sentry',
]);

// ─── DIAGNOSTIC: confirm which copy of this module the running server loaded ──
console.log('[SCHEMA-LOAD] helpdesk.documents.schema.ts', {
    file: __filename,
    pid: process.pid,
    loadedAt: new Date().toISOString(),
    documentEntityEnumValues: documentEntityEnum.options,
    hasConsolidatedUtility: documentEntityEnum.options.includes('consolidated_utility_memo'),
    hasConsolidatedFuel: documentEntityEnum.options.includes('consolidated_fuel_memo'),
});
// ──────────────────────────────────────────────────────────────────────────────

const documentStatusEnum = z.enum(['draft', 'pending_approval', 'approved', 'rejected', 'returned']);

// ─── Stamp Type Enum ─────────────────────────────────────────────────────────

const stampTypeEnum = z.enum(['approved', 'received', 'official']);

// ─── Two-Step Approval Enums ─────────────────────────────────────────────────

const internalApprovalStatusEnum = z.enum([
    'pending',
    'previewed',
    'approved_internal',
    'rejected_internal',
    'changes_requested_internal',
    'changes_ready'
]);

const requesterVisibleStatusEnum = z.enum([
    'pending_approval',
    'approved',
    'rejected',
    'changes_requested',
    'in_revision'
]);

const requestTypeEnum = z.enum([
    'Driver',
    'Bodyguard',
    'Firearm',
    'Current Station',
    'Force Number',
    'Residence Security',
    'Sentry'
]);

const aideStatusEnum = z.enum(['pending', 'in_progress', 'rejected', 'attached']);

const sentryStatusEnum = z.enum(['pending', 'active', 'resolved', 'rejected']);

const officerRankEnum = z.enum([
    'Police Constable (PC)',
    'Corporal (CPL)',
    'Sergeant (SGT)',
    'Inspector (IP)',
    'Chief Inspector (CIP)',
    'Assistant Superintendent (ASP)',
    'Superintendent (SP)',
    'Senior Superintendent (SSP)',
    'Assistant Commissioner (ACP)',
    'Senior Assistant Commissioner (SACP)',
    'Commissioner (CP)',
]);

const unitTypeEnum = z.enum(['KPS', 'APS', 'GSU', 'DCI', 'VIPPU', 'Other']);

const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional();

// ✅ Custom validator for entity_id that accepts both UUIDs and custom IDs
const entityIdSchema = z.string().optional().nullable().refine(
    (val) => {
        if (!val) return true; // null/undefined is allowed
        
        // Check if it's a valid UUID
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(val)) return true;
        
        // Check if it's a consolidated memo ID
        const consRegex = /^cons-(all|fuel)-[0-9]{4}-[0-9]{2}$/;
        if (consRegex.test(val)) return true;
        
        // Check if it's a temp ID (for new records)
        const tempRegex = /^temp-/;
        if (tempRegex.test(val)) return true;
        
        return false;
    },
    { message: 'entity_id must be a valid UUID, consolidated ID (e.g., cons-all-2026-07), or temp ID' }
);

// ─── POST /api/helpdesk/documents/upload ──────────────────────────────────────

/**
 * UPDATED: This schema handles multipart/form-data uploads.
 * 
 * IMPORTANT: The file itself is handled by multer and is available as req.file,
 * NOT in req.body. This schema only validates the form fields in req.body.
 * 
 * The actual validation for the file (size, type, etc.) should be handled
 * by multer configuration.
 */
export const uploadHelpdeskDocumentSchema = z.object({
    body: z.object({
        ref: z.string().min(1, 'Reference is required').max(100),
        subject: z.string().min(1, 'Subject is required').max(200),
        entity_type: z.string().pipe(documentEntityEnum),
        entity_id: entityIdSchema, // ✅ Uses the custom validator
        format: z.string().pipe(documentFormatEnum),
        status: z.string().default('draft').pipe(documentStatusEnum).optional(),
        request_type: z.string().pipe(requestTypeEnum).optional().nullable(),
        judge_name: z.string().max(100).optional().nullable(),
        
        // ─── NEW: Stamp type on initial creation ──────────────────────────────────
        stamp_type: stampTypeEnum.optional().nullable(),
        
        // ─── Aide Request Fields ──────────────────────────────────────────────
        officer_rank: z.string().pipe(officerRankEnum).optional().nullable(),
        officer_name: z.string().max(100).optional().nullable(),
        employment_number: z.string().max(50).optional().nullable(),
        current_station: z.string().max(100).optional().nullable(),
        current_unit: z.string().pipe(unitTypeEnum).optional().nullable(),
        proposed_assignment: z.string().max(500).optional().nullable(),
        aide_status: z.string().pipe(aideStatusEnum).optional().nullable(),
        
        // ─── Sentry Request Fields ──────────────────────────────────────────────
        residence_location: z.string().max(200).optional().nullable(),
        sentry_status: z.string().pipe(sentryStatusEnum).optional().nullable(),
        
        // ─── Legacy fields ──────────────────────────────────────────────────────
        rank: z.string().max(50).optional().nullable(),
        reporting_date: dateStringSchema.optional().nullable(),
    }),
});

/**
 * File validation schema for use with multer
 * This can be used to validate the file after multer processes it
 */
export const fileValidationSchema = z.object({
    file: z.object({
        fieldname: z.string(),
        originalname: z.string(),
        encoding: z.string(),
        mimetype: z.string().refine(
            (mime) => ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'].includes(mime),
            { message: 'File must be PDF, DOCX, or XLSX' }
        ),
        size: z.number().max(10 * 1024 * 1024, 'File size must be less than 10MB'), // 10MB limit
        buffer: z.instanceof(Buffer).optional(),
        path: z.string().optional(),
    }),
});

// ─── GET /api/helpdesk/documents ──────────────────────────────────────────────
export const listHelpdeskDocumentsSchema = z.object({
    query: z.object({
        entity_type: documentEntityEnum.optional(),
        entity_id: z.string().optional(), // ✅ Allow any string for filtering
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
        
        // ─── Two-Step Approval Filters ──────────────────────────────────────────
        internal_approval_status: internalApprovalStatusEnum.optional(),
        requester_status: requesterVisibleStatusEnum.optional(),
        is_sent_back_to_requester: z.string().transform((val) => val === 'true').optional(),
        pending_internal_approval: z.string().transform((val) => val === 'true').optional(),
        ready_to_send_back: z.string().transform((val) => val === 'true').optional(),
        my_requester_documents: z.string().transform((val) => val === 'true').optional(),
        
        // ─── Aide Request Filters ──────────────────────────────────────────────
        officer_rank: z.string().pipe(officerRankEnum).optional(),
        officer_name: z.string().optional(),
        employment_number: z.string().optional(),
        current_station: z.string().optional(),
        current_unit: z.string().pipe(unitTypeEnum).optional(),
        aide_status: z.string().pipe(aideStatusEnum).optional(),
        
        // ─── Sentry Request Filters ──────────────────────────────────────────────
        residence_location: z.string().optional(),
        sentry_status: z.string().pipe(sentryStatusEnum).optional(),
        
        // ─── Legacy fields ──────────────────────────────────────────────────────
        rank: z.string().optional(),
        reporting_date: dateStringSchema.optional(),

        // ─── NEW: Stamp Filters ──────────────────────────────────────────────────
        is_stamped: z.string().transform((val) => val === 'true').optional(),
        stamp_type: stampTypeEnum.optional(),
    }).strict(),
});

// ─── GET /api/helpdesk/documents/:id ──────────────────────────────────────────
export const getDocumentByIdSchema = z.object({
    params: z.object({
        id: z.string().uuid('Document ID must be a valid UUID'),
    }),
});

// ─── PATCH /api/helpdesk/documents/:id/file ──────────────────────────────────
export const updateDocumentFileSchema = z.object({
    params: z.object({
        id: z.string().uuid('Document ID must be a valid UUID'),
    }),
    body: z.object({
        status: documentStatusEnum.optional(),
        e_stamp_url: z.string().url().optional(),
        e_stamp_public_id: z.string().optional(),
        e_stamp_status: z.enum(['pending', 'stamped', 'failed']).optional(),
        approved_by: z.string().uuid().optional(),
        approved_by_name: z.string().max(100).optional(),
        comments: z.string().max(500).optional(),
        rejection_reason: z.string().max(500).optional(),
        returned_by: z.string().uuid().optional(),
        returned_by_name: z.string().max(100).optional(),
        // ─── Signature fields ──────────────────────────────────────────────────
        is_signed: z.preprocess(
            (val) => {
                if (val === 'true') return true;
                if (val === 'false') return false;
                return val;
            },
            z.boolean().optional()
        ),
        signed_by: z.string().uuid().optional(),
        signed_by_name: z.string().max(100).optional(),
        signed_at: z.string().datetime().optional(),
        // ─── Stamp fields ──────────────────────────────────────────────────────
        is_stamped: z.preprocess(
            (val) => {
                if (val === 'true') return true;
                if (val === 'false') return false;
                return val;
            },
            z.boolean().optional()
        ),
        stamped_by: z.string().uuid().optional(),
        stamped_by_name: z.string().max(100).optional(),
        stamped_at: z.string().datetime().optional(),
        stamp_type: stampTypeEnum.optional(),
        stamp_position_x: z.preprocess(
            (val) => {
                if (typeof val === 'string') {
                    const num = parseFloat(val);
                    return isNaN(num) ? val : num;
                }
                return val;
            },
            z.number().optional()
        ),
        stamp_position_y: z.preprocess(
            (val) => {
                if (typeof val === 'string') {
                    const num = parseFloat(val);
                    return isNaN(num) ? val : num;
                }
                return val;
            },
            z.number().optional()
        ),
        stamp_position_width: z.preprocess(
            (val) => {
                if (typeof val === 'string') {
                    const num = parseFloat(val);
                    return isNaN(num) ? val : num;
                }
                return val;
            },
            z.number().optional()
        ),
        stamp_position_height: z.preprocess(
            (val) => {
                if (typeof val === 'string') {
                    const num = parseFloat(val);
                    return isNaN(num) ? val : num;
                }
                return val;
            },
            z.number().optional()
        ),
        
        // ─── NEW: Final Generated PDF fields ────────────────────────────────────
        stamped_file_url: z.string().url().optional(),
        stamped_file_public_id: z.string().optional(),
        stamped_file_size: z.preprocess(
            (val) => {
                if (typeof val === 'string') {
                    const num = parseInt(val, 10);
                    return isNaN(num) ? val : num;
                }
                return val;
            },
            z.number().optional()
        ),
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
// ⚠️ DEPRECATED: This is the old single-step approval.
// Use /api/helpdesk/documents/:id/internal/approve for two-step workflow
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
// ⚠️ DEPRECATED: This is the old single-step rejection.
// Use /api/helpdesk/documents/:id/internal/reject for two-step workflow
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
// ⚠️ DEPRECATED: This is the old single-step return.
// Use /api/helpdesk/documents/:id/internal/return for two-step workflow
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
        entity_id: z.string().optional(), // ✅ Allow any string
        request_type: requestTypeEnum.optional(),
        judge_name: z.string().max(100).optional(),
        
        // ─── Aide Request Fields ──────────────────────────────────────────────
        officer_rank: z.string().pipe(officerRankEnum).optional().nullable(),
        officer_name: z.string().max(100).optional().nullable(),
        employment_number: z.string().max(50).optional().nullable(),
        current_station: z.string().max(100).optional().nullable(),
        current_unit: z.string().pipe(unitTypeEnum).optional().nullable(),
        proposed_assignment: z.string().max(500).optional().nullable(),
        aide_status: z.string().pipe(aideStatusEnum).optional().nullable(),
        
        // ─── Sentry Request Fields ──────────────────────────────────────────────
        residence_location: z.string().max(200).optional().nullable(),
        sentry_status: z.string().pipe(sentryStatusEnum).optional().nullable(),
        
        // ─── Legacy fields ──────────────────────────────────────────────────────
        rank: z.string().max(50).optional().nullable(),
        reporting_date: dateStringSchema.optional().nullable(),
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
        entity_id: z.string().optional(), // ✅ Allow any string
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
        entity_id: z.string().optional(), // ✅ Allow any string
        request_type: requestTypeEnum.optional(),
        judge_name: z.string().max(100).optional(),
        
        // ─── Aide Request Fields ──────────────────────────────────────────────
        officer_rank: z.string().pipe(officerRankEnum).optional().nullable(),
        officer_name: z.string().max(100).optional().nullable(),
        employment_number: z.string().max(50).optional().nullable(),
        current_station: z.string().max(100).optional().nullable(),
        current_unit: z.string().pipe(unitTypeEnum).optional().nullable(),
        proposed_assignment: z.string().max(500).optional().nullable(),
        aide_status: z.string().pipe(aideStatusEnum).optional().nullable(),
        
        // ─── Sentry Request Fields ──────────────────────────────────────────────
        residence_location: z.string().max(200).optional().nullable(),
        sentry_status: z.string().pipe(sentryStatusEnum).optional().nullable(),
        
        // ─── Legacy fields ──────────────────────────────────────────────────────
        rank: z.string().max(50).optional().nullable(),
        reporting_date: dateStringSchema.optional().nullable(),
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
                entity_id: z.string().optional(), // ✅ Allow any string
                format: documentFormatEnum,
                status: documentStatusEnum.default('draft'),
                request_type: requestTypeEnum.optional(),
                judge_name: z.string().max(100).optional(),
                stamp_type: stampTypeEnum.optional().nullable(), // Added to batch upload as well
                
                // ─── Aide Request Fields ──────────────────────────────────────────────
                officer_rank: z.string().pipe(officerRankEnum).optional().nullable(),
                officer_name: z.string().max(100).optional().nullable(),
                employment_number: z.string().max(50).optional().nullable(),
                current_station: z.string().max(100).optional().nullable(),
                current_unit: z.string().pipe(unitTypeEnum).optional().nullable(),
                proposed_assignment: z.string().max(500).optional().nullable(),
                aide_status: z.string().pipe(aideStatusEnum).optional().nullable(),
                
                // ─── Sentry Request Fields ──────────────────────────────────────────────
                residence_location: z.string().max(200).optional().nullable(),
                sentry_status: z.string().pipe(sentryStatusEnum).optional().nullable(),
                
                // ─── Legacy fields ──────────────────────────────────────────────────────
                rank: z.string().max(50).optional().nullable(),
                reporting_date: dateStringSchema.optional().nullable(),
            })
        ).min(1, 'At least one document is required').max(20, 'Maximum 20 documents per batch'),
    }),
});

// ─── TWO-STEP APPROVAL SCHEMAS ─────────────────────────────────────────────────

/**
 * POST /api/helpdesk/documents/:id/internal/preview
 * Super admin previews a document (internal action)
 */
export const internalPreviewDocumentSchema = z.object({
    params: z.object({
        id: z.string().uuid('Document ID must be a valid UUID'),
    }),
    body: z.object({
        previewed_by: z.string().uuid().optional(),
        previewed_by_name: z.string().max(100).optional(),
        comments: z.string().max(500).optional(),
        ip_address: z.string().ipv4().optional(), // ✅ Use .ipv4() or .ipv6()
        user_agent: z.string().optional(),
    }),
});

/**
 * POST /api/helpdesk/documents/:id/internal/approve
 * Super admin approves internally with signature AND stamp embedding (requester doesn't see this yet)
 */
export const internalApproveDocumentSchema = z.object({
    params: z.object({
        id: z.string().uuid('Document ID must be a valid UUID'),
    }),
    body: z.object({
        approved_by: z.string().uuid('Approved by must be a valid UUID').optional(),
        approved_by_name: z.string().max(100).optional(),
        comments: z.string().max(500).optional(),
        generate_e_stamp: z.boolean().default(true),
        
        // ─── Signature position ──────────────────────────────────────────────────
        signature_position_x: z.number().optional(),
        signature_position_y: z.number().optional(),
        signature_position_width: z.number().optional(),
        signature_position_height: z.number().optional(),
        
        // ─── NEW: Stamp position (Applies the stamp during internal approval) ───
        stamp_position_x: z.number().optional(),
        stamp_position_y: z.number().optional(),
        stamp_position_width: z.number().optional(),
        stamp_position_height: z.number().optional(),
        stamp_type: stampTypeEnum.optional(), // Override stamp type during approval
    }),
});

/**
 * POST /api/helpdesk/documents/:id/internal/reject
 * Super admin rejects internally (requester doesn't see this yet)
 */
export const internalRejectDocumentSchema = z.object({
    params: z.object({
        id: z.string().uuid('Document ID must be a valid UUID'),
    }),
    body: z.object({
        rejection_reason: z.string().min(1, 'Rejection reason is required').max(500),
        rejected_by: z.string().uuid().optional(),
        rejected_by_name: z.string().max(100).optional(),
        comments: z.string().max(500).optional(),
    }),
});

/**
 * POST /api/helpdesk/documents/:id/internal/request-changes
 * Super admin requests changes internally (requester doesn't see this yet)
 */
export const internalRequestChangesSchema = z.object({
    params: z.object({
        id: z.string().uuid('Document ID must be a valid UUID'),
    }),
    body: z.object({
        changes_requested: z.array(z.string()).min(1, 'At least one change request is required'),
        requested_by: z.string().uuid().optional(),
        requested_by_name: z.string().max(100).optional(),
        comments: z.string().max(500).optional(),
    }),
});

/**
 * POST /api/helpdesk/documents/:id/internal/cancel
 * Super admin cancels internal approval decision (resets to pending)
 */
export const internalCancelApprovalSchema = z.object({
    params: z.object({
        id: z.string().uuid('Document ID must be a valid UUID'),
    }),
    body: z.object({
        cancelled_by: z.string().uuid().optional(),
        cancelled_by_name: z.string().max(100).optional(),
        reason: z.string().max(500).optional(),
    }),
});

/**
 * POST /api/helpdesk/documents/:id/send-back
 * Super admin sends document back to requester (this is when requester sees the status)
 */
export const sendBackToRequesterSchema = z.object({
    params: z.object({
        id: z.string().uuid('Document ID must be a valid UUID'),
    }),
    body: z.object({
        final_status: requesterVisibleStatusEnum, // 'approved' | 'rejected' | 'changes_requested'
        sent_by: z.string().uuid().optional(),
        sent_by_name: z.string().max(100).optional(),
        comments: z.string().max(500).optional(),
        requester_message: z.string().max(500).optional(),
        notify_requester: z.boolean().default(true),
    }),
});

/**
 * POST /api/helpdesk/documents/:id/resubmit
 * Requester resubmits document after changes
 */
export const resubmitDocumentSchema = z.object({
    params: z.object({
        id: z.string().uuid('Document ID must be a valid UUID'),
    }),
    body: z.object({
        submitted_by: z.string().uuid().optional(),
        submitted_by_name: z.string().max(100).optional(),
        comments: z.string().max(500).optional(),
        file_update: z.boolean().default(false),
    }),
});

/**
 * GET /api/helpdesk/documents/pending-internal
 * Super admin dashboard - get pending internal approvals
 */
export const pendingInternalApprovalsSchema = z.object({
    query: z.object({
        entity_type: documentEntityEnum.optional(),
        internal_approval_status: internalApprovalStatusEnum.optional(),
        priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
        date_from: dateStringSchema.optional(),
        date_to: dateStringSchema.optional(),
        search: z.string().optional(),
        limit: z.string().regex(/^\d+$/).optional().transform(Number),
        offset: z.string().regex(/^\d+$/).optional().transform(Number),
    }),
});

/**
 * GET /api/helpdesk/documents/requester-dashboard
 * Requester dashboard - get documents visible to requester
 */
export const requesterDashboardSchema = z.object({
    query: z.object({
        requester_status: requesterVisibleStatusEnum.optional(),
        entity_type: documentEntityEnum.optional(),
        search: z.string().optional(),
        limit: z.string().regex(/^\d+$/).optional().transform(Number),
        offset: z.string().regex(/^\d+$/).optional().transform(Number),
    }),
});

/**
 * GET /api/helpdesk/documents/internal-summary
 * Get internal approval summary (super admin dashboard stats)
 */
export const internalApprovalSummarySchema = z.object({
    query: z.object({
        entity_type: documentEntityEnum.optional(),
    }).optional(),
});

/**
 * GET /api/helpdesk/documents/requester-summary
 * Get requester dashboard summary
 */
export const requesterSummarySchema = z.object({
    query: z.object({
        user_id: z.string().uuid().optional(),
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
export type UpdateDocumentFileBody = z.infer<typeof updateDocumentFileSchema>['body'];
export type FileValidation = z.infer<typeof fileValidationSchema>;

// Two-Step Approval Types
export type InternalPreviewDocumentBody = z.infer<typeof internalPreviewDocumentSchema>['body'];
export type InternalApproveDocumentBody = z.infer<typeof internalApproveDocumentSchema>['body'];
export type InternalRejectDocumentBody = z.infer<typeof internalRejectDocumentSchema>['body'];
export type InternalRequestChangesBody = z.infer<typeof internalRequestChangesSchema>['body'];
export type InternalCancelApprovalBody = z.infer<typeof internalCancelApprovalSchema>['body'];
export type SendBackToRequesterBody = z.infer<typeof sendBackToRequesterSchema>['body'];
export type ResubmitDocumentBody = z.infer<typeof resubmitDocumentSchema>['body'];
export type PendingInternalApprovalsQuery = z.infer<typeof pendingInternalApprovalsSchema>['query'];
export type RequesterDashboardQuery = z.infer<typeof requesterDashboardSchema>['query'];

// ─── NEW: Stamp Type ──────────────────────────────────────────────────────────
export type StampType = z.infer<typeof stampTypeEnum>;

// Export enums for use in routes
export {
    documentFormatEnum,
    documentEntityEnum,
    documentStatusEnum,
    stampTypeEnum,
    internalApprovalStatusEnum,
    requesterVisibleStatusEnum,
    requestTypeEnum,
    aideStatusEnum,
    sentryStatusEnum,
    officerRankEnum,
    unitTypeEnum,
    dateStringSchema,
};