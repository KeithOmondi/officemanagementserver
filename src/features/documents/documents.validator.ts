// src/features/documents/documents.validator.ts

import { z } from 'zod';

export const documentTypeEnum = z.enum([
  'judgment',
  'ruling',
  'order',
  'correspondence',
  'upload',
  'memo',
  'letter',
]);

/**
 * Document status lifecycle:
 * - `draft` → `uploaded`/`pending_review` → `dept_assigned` (Super Admin assigns to dept)
 * - `dept_assigned` → `user_assigned` (Dept Head assigns to a specific user)
 * - `user_assigned` → `in_progress` (User acknowledges and starts working)
 * - `in_progress` → `completed` (User finishes)
 * - `completed` → `ready_to_release` or `filed`
 * - `ready_to_release` → `released`
 *
 * Legacy `marked` is kept for backward compatibility (maps to `dept_assigned` in logic).
 */
export const documentStatusEnum = z.enum([
  'draft',
  'uploaded',
  'pending_review',
  'dept_assigned',   // Super Admin assigned to department
  'user_assigned',   // Dept Head assigned to a specific user
  'in_progress',
  'completed',
  'filed',
  'ready_to_release',
  'released',
  // Legacy – kept for compatibility; new code should use `dept_assigned`
  'marked',
]);

export const documentCategoryEnum = z.enum([
  'judgments',
  'rulings',
  'correspondence',
  'orders',
  'drafts',
  'general',
]);

export const refTypeEnum = z.enum([
  'for_signature',
  'for_attention',
  'for_information',
  'direction',
  'other',
]);

// ── Follow-up Enums ──────────────────────────────────────────────────────────

export const followUpStatusEnum = z.enum([
  'pending',
  'in_progress',
  'completed',
  'cancelled',
  'filed_away',     // ✅ New: filed away with no future date
]);

export const followUpPriorityEnum = z.enum([
  'low',
  'normal',
  'urgent',
]);

// ── Create composed document ────────────────────────────────────────────────

export const createComposedDocumentSchema = z.object({
  body: z
    .object({
      title: z.string().min(1, 'Title is required').max(255).trim(),
      type: z.enum(['judgment', 'ruling', 'order']),
      category: documentCategoryEnum.optional(),
      reference_no: z.string().max(100).trim().optional(),
      body: z.string().min(1, 'Document body is required'),
      assigned_to: z.string().uuid().optional(),
      department_id: z.string().uuid().optional(),
    })
    .strict(),
});

// ── Create upload document ─────────────────────────────────────────────────

export const createUploadDocumentSchema = z.object({
  body: z
    .object({
      title: z.string().min(1, 'Title is required').max(255).trim(),
      type: documentTypeEnum,
      category: documentCategoryEnum.optional(),
      reference_no: z.string().max(100).trim().optional(),
      ref_type: refTypeEnum,
      ref_other_description: z.string().max(500).trim().optional(),
      priority: z.enum(['low', 'normal', 'urgent']).default('normal'),
      assigned_to: z.string().uuid().optional(),
      department_id: z.string().uuid().optional(),
      is_draft: z.coerce.boolean().default(false),
    })
    .strict()
    .refine(
      (b) => b.ref_type !== 'other' || !!b.ref_other_description,
      {
        message: 'ref_other_description is required when ref_type is "other"',
        path: ['ref_other_description'],
      }
    ),
});

// ── Update ──────────────────────────────────────────────────────────────────

export const updateDocumentSchema = z.object({
  body: z
    .object({
      title: z.string().min(1).max(255).trim().optional(),
      category: documentCategoryEnum.optional(),
      reference_no: z.string().max(100).trim().optional(),
      body: z.string().optional(),
      status: documentStatusEnum.optional(),
      assigned_to: z.string().uuid().nullable().optional(),
      department_id: z.string().uuid().nullable().optional(),
      // Memo/Letter specific fields (editable by super admin)
      to_recipient: z.string().max(500).trim().optional(),
      from_sender: z.string().max(500).trim().optional(),
      document_date: z.string().optional(),
      subject: z.string().max(500).trim().optional(),
      cc: z.string().max(500).trim().optional(),
      enclosures: z.string().max(500).trim().optional(),
      signature_name: z.string().max(255).trim().optional(),
      signature_title: z.string().max(255).trim().optional(),
      from_first: z.boolean().optional(),   // controls TO/FROM field order in the memo header
      // Custom signature position (draggable) – absolute positioning
      signature_position_x: z.number().nullable().optional(),
      signature_position_y: z.number().nullable().optional(),
      signature_position_width: z.number().nullable().optional(),
      signature_position_height: z.number().nullable().optional(),
    })
    .strict()
    .refine((b) => Object.keys(b).length > 0, {
      message: 'At least one field must be provided to update',
    }),
});

// ── Mark to Department ─────────────────────────────────────────────────────

export const markDocumentSchema = z.object({
  body: z
    .object({
      department_id: z.string().uuid('Must be a valid department ID'),
      assigned_to: z.string().uuid('Must be a valid user ID').optional(),
      instructions: z.string().max(2000).trim().optional(),
      priority: z.enum(['low', 'normal', 'urgent']).default('normal'),
    })
    .strict(),
});

export const acknowledgeMarkSchema = z.object({
  body: z.object({}).strict(),
});

// ── Filters ─────────────────────────────────────────────────────────────────

export const documentFiltersSchema = z.object({
  query: z.object({
    search: z.string().trim().max(100).optional(),
    type: documentTypeEnum.optional(),
    category: documentCategoryEnum.optional(),
    status: documentStatusEnum.optional(),
    assigned_to: z.string().uuid().optional(),
    department_id: z.string().uuid().optional(),
    folder_id: z.string().uuid().optional(),
    for_my_action: z
      .enum(['true', 'false'])
      .transform((v) => v === 'true')
      .optional(),
    visible_in_summary: z
      .enum(['true', 'false'])
      .transform((v) => v === 'true')
      .optional(),
    has_bring_up_date: z
      .enum(['true', 'false'])
      .transform((v) => v === 'true')
      .optional(),
    page: z
      .string()
      .regex(/^\d+$/)
      .transform(Number)
      .pipe(z.number().int().min(1))
      .optional(),
    limit: z
      .string()
      .regex(/^\d+$/)
      .transform(Number)
      .pipe(z.number().int().min(1).max(100))
      .optional(),
    sort_by: z.enum(['created_at', 'updated_at', 'title', 'status']).optional(),
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
    id: z.string().uuid('Document ID must be a valid UUID'),
    annotationId: z.string().uuid('Annotation ID must be a valid UUID'),
  }),
});

// ── Follow-up ID params ────────────────────────────────────────────────────

export const followUpIdSchema = z.object({
  params: z.object({
    followUpId: z.string().uuid('Follow-up ID must be a valid UUID'),
  }),
});

export const documentFollowUpIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Document ID must be a valid UUID'),
    followUpId: z.string().uuid('Follow-up ID must be a valid UUID'),
  }),
});

// ── Annotation ─────────────────────────────────────────────────────────────

export const createAnnotationSchema = z.object({
  body: z
    .object({
      comment: z.string().min(1, 'Comment cannot be empty').max(2000).trim(),
      is_urgent: z.boolean().default(false),
      visible_in_summary: z.boolean().default(false),
    })
    .strict(),
});

// ── Response (threaded reply to a return/action request) ───────────────────

export const respondToDocumentSchema = z.object({
  body: z
    .object({
      note: z.string().min(1, 'A response note is required').max(2000).trim(),
    })
    .strict(),
});

// ── Return document for action ─────────────────────────────────────────────

export const returnDocumentSchema = z.object({
  body: z
    .object({
      note: z.string().min(1, 'A reason for returning is required').max(1000).trim(),
      requires_more_docs: z.boolean().default(false),
    })
    .strict(),
});

// ── Finalize draft ─────────────────────────────────────────────────────────

export const finalizeDraftSchema = z.object({
  body: z
    .object({
      assigned_to: z.string().uuid().optional(),
      send_to_super_admin: z.boolean().default(false),
    })
    .strict()
    .refine((b) => !!b.assigned_to !== !!b.send_to_super_admin, {
      message: 'Provide either assigned_to or send_to_super_admin, not both',
    }),
});

// ── Send to User ────────────────────────────────────────────────────────────

export const sendToUserSchema = z.object({
  body: z
    .object({
      recipient_id: z.string().uuid('Must be a valid user ID'),
      note: z.string().max(500).trim().optional(),
    })
    .strict(),
});

// ════════════════════════════════════════════════════════════════════════
//  Memo & Letter composition schemas
// ════════════════════════════════════════════════════════════════════════

const baseComposeSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255).trim(),
  to: z.string().min(1, 'Recipient is required').max(500).trim(),
  date: z.string().datetime().optional(),
  body: z.string().min(1, 'Body content is required'),
  from: z.string().optional(),
  signatureName: z.string().optional(),
  signatureTitle: z.string().optional(),
  fromFirst: z.boolean().default(false),   // controls TO/FROM field order in the memo header
  department_id: z.string().uuid().optional(),
  reference_no: z.string().max(100).trim().optional(),
});

export const composeMemoSchema = z.object({
  body: baseComposeSchema,
});

export const composeLetterSchema = z.object({
  body: baseComposeSchema.extend({
    cc: z.string().optional(),
    enclosures: z.string().optional(),
  }),
});

// ════════════════════════════════════════════════════════════════════════
//  Update Mark (instructions & bring_up_date)
// ════════════════════════════════════════════════════════════════════════

export const updateMarkSchema = z.object({
  params: z.object({
    markId: z.string().uuid('Mark ID must be a valid UUID'),
  }),
  body: z
    .object({
      instructions: z.string().max(2000).trim().optional(),
      bring_up_date: z.string().nullable().optional(),
    })
    .strict()
    .refine((b) => b.instructions !== undefined || b.bring_up_date !== undefined, {
      message: 'At least one field (instructions or bring_up_date) must be provided',
    }),
});

// ════════════════════════════════════════════════════════════════════════
//  FOLLOW-UP SCHEMAS (UPDATED - SIMPLIFIED)
// ════════════════════════════════════════════════════════════════════════

// ─── Date transformer helper ────────────────────────────────────────────────

/**
 * Transforms a date string to ISO datetime format.
 * Accepts:
 * - ISO datetime strings: "2026-07-23T00:00:00.000Z"
 * - Date-only strings: "2026-07-23"
 * - Date objects
 * - null (for filed away items)
 */
const transformDate = (val: unknown): string | null => {
  if (val === null || val === undefined) {
    return null;
  }
  if (val instanceof Date) {
    return val.toISOString();
  }
  if (typeof val === 'string') {
    // If it's a date-only string (YYYY-MM-DD), convert to ISO datetime
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
      return new Date(val + 'T00:00:00.000Z').toISOString();
    }
    // If it's already an ISO datetime, return as-is
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) {
      return val;
    }
    // If it's a date string like "2026-07-23T00:00:00", ensure it's valid
    const parsed = new Date(val);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  // If it's not a string or Date, let Zod handle the error
  return val as string;
};

/**
 * Zod schema that accepts:
 * - Date strings (YYYY-MM-DD or ISO)
 * - Date objects
 * - null (for filed away)
 * And transforms them to ISO datetime format or null.
 */
const optionalDateSchema = z
  .union([
    z.string().datetime({ message: 'Invalid due date format' }).optional(),
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (expected YYYY-MM-DD)').optional(),
    z.date().optional(),
    z.null(),
  ])
  .transform(transformDate);

// ─── Create Follow-Up Schema (Simplified) ──────────────────────────────────

/**
 * Simplified follow-up creation:
 * - notes: Required - what was done or needs to be done (replaces title + description)
 * - due_date: Optional - if not provided, follow-up is "filed away"
 * - mark_id: Optional - may not always be linked to a mark
 * - title: Removed - auto-generated from document title
 */
export const createFollowUpSchema = z.object({
  body: z
    .object({
      document_id: z.string().uuid('Document ID must be a valid UUID'),
      mark_id: z.string().uuid('Mark ID must be a valid UUID').optional().nullable(),
      notes: z.string().min(1, 'Notes are required').max(2000).trim(),
      assigned_to: z.string().uuid('Must be a valid user ID'),
      due_date: optionalDateSchema.optional().nullable(),
      priority: followUpPriorityEnum.default('normal'),
    })
    .strict()
    .refine(
      (data) => {
        // If due_date is provided, it must be a valid date string
        if (data.due_date === null || data.due_date === undefined) {
          return true;
        }
        const date = new Date(data.due_date);
        return !isNaN(date.getTime());
      },
      {
        message: 'Invalid due date format',
        path: ['due_date'],
      }
    ),
});

// ─── File Away Schema (New) ────────────────────────────────────────────────

/**
 * Quick action to file away a follow-up with no future date
 */
export const fileAwayFollowUpSchema = z.object({
  body: z
    .object({
      document_id: z.string().uuid('Document ID must be a valid UUID'),
      mark_id: z.string().uuid('Mark ID must be a valid UUID').optional().nullable(),
      notes: z.string().min(1, 'Notes are required').max(2000).trim(),
      completion_notes: z.string().max(2000).trim().optional(),
    })
    .strict(),
});

// ─── Update Follow-Up Schema (Simplified) ──────────────────────────────────

export const updateFollowUpSchema = z.object({
  params: z.object({
    followUpId: z.string().uuid('Follow-up ID must be a valid UUID'),
  }),
  body: z
    .object({
      notes: z.string().max(2000).trim().optional(),
      assigned_to: z.string().uuid('Must be a valid user ID').optional(),
      due_date: optionalDateSchema.optional().nullable(),
      priority: followUpPriorityEnum.optional(),
      status: followUpStatusEnum.optional(),
      completion_notes: z.string().max(2000).trim().optional(),
      cancellation_reason: z.string().max(1000).trim().optional(),
    })
    .strict()
    .refine((b) => Object.keys(b).length > 0, {
      message: 'At least one field must be provided to update',
    }),
});

// ─── Complete Follow-Up Schema ─────────────────────────────────────────────

export const completeFollowUpSchema = z.object({
  body: z
    .object({
      completion_notes: z.string().max(2000).trim().optional(),
    })
    .strict(),
});

// ─── Cancel Follow-Up Schema ───────────────────────────────────────────────

export const cancelFollowUpSchema = z.object({
  body: z
    .object({
      cancellation_reason: z.string().min(1, 'Cancellation reason is required').max(1000).trim(),
    })
    .strict(),
});

// ─── Add Follow-Up Comment Schema ─────────────────────────────────────────

export const addFollowUpCommentSchema = z.object({
  params: z.object({
    followUpId: z.string().uuid('Follow-up ID must be a valid UUID'),
  }),
  body: z
    .object({
      comment: z.string().min(1, 'Comment is required').max(2000).trim(),
    })
    .strict(),
});

// ─── Follow-Up Filters Schema (Updated) ────────────────────────────────────

export const followUpFiltersSchema = z.object({
  query: z.object({
    document_id: z.string().uuid('Document ID must be a valid UUID').optional(),
    assigned_to: z.string().uuid('User ID must be a valid UUID').optional(),
    status: followUpStatusEnum.optional(),
    priority: followUpPriorityEnum.optional(),
    due_from: optionalDateSchema.optional(),
    due_to: optionalDateSchema.optional(),
    search: z.string().trim().max(100).optional(),
    // ✅ New filters
    active_only: z
      .enum(['true', 'false'])
      .transform((v) => v === 'true')
      .optional(),
    filed_only: z
      .enum(['true', 'false'])
      .transform((v) => v === 'true')
      .optional(),
    page: z
      .string()
      .regex(/^\d+$/)
      .transform(Number)
      .pipe(z.number().int().min(1))
      .optional(),
    limit: z
      .string()
      .regex(/^\d+$/)
      .transform(Number)
      .pipe(z.number().int().min(1).max(100))
      .optional(),
    sort_by: z.enum(['created_at', 'due_date', 'priority', 'status', 'notes']).default('due_date'),
    sort_order: z.enum(['ASC', 'DESC']).default('ASC'),
  }),
});

// ════════════════════════════════════════════════════════════════════════
//  Sign & Release Document schemas
// ════════════════════════════════════════════════════════════════════════

export const signDocumentSchema = z.object({
  params: z.object({
    id: z.string().uuid('Document ID must be a valid UUID'),
  }),
  body: z.object({
    otp: z.string().length(6, 'OTP must be exactly 6 digits').regex(/^\d{6}$/, 'OTP must contain only digits'),
    // Custom signature position (sent from frontend when user places the box)
    position_x: z.number().optional(),
    position_y: z.number().optional(),
    position_width: z.number().optional(),
    position_height: z.number().optional(),
  }),
});

export const releaseDocumentSchema = z.object({
  params: z.object({
    id: z.string().uuid('Document ID must be a valid UUID'),
  }),
  body: z
    .object({
      note: z.string().max(500).trim().optional(),
      recipient_id: z.string().uuid('Recipient ID must be a valid UUID').optional(),
    })
    .strict()
    .optional(),
});

// ════════════════════════════════════════════════════════════════════════
//  Folder Redirection schemas
// ════════════════════════════════════════════════════════════════════════

export const redirectToFolderSchema = z.object({
  body: z
    .object({
      folder_id: z.string().uuid('Folder ID must be a valid UUID'),
      note: z.string().max(500).trim().optional(),
    })
    .strict(),
});

export const removeFromFolderSchema = z.object({
  body: z
    .object({
      note: z.string().max(500).trim().optional(),
    })
    .strict()
    .optional(),
});

export const getFolderDocumentsSchema = z.object({
  params: z.object({
    folderId: z.string().uuid('Folder ID must be a valid UUID'),
  }),
  query: z.object({
    page: z
      .string()
      .regex(/^\d+$/)
      .transform(Number)
      .pipe(z.number().int().min(1))
      .optional(),
    limit: z
      .string()
      .regex(/^\d+$/)
      .transform(Number)
      .pipe(z.number().int().min(1).max(100))
      .optional(),
    search: z.string().trim().max(100).optional(),
    type: documentTypeEnum.optional(),
    status: documentStatusEnum.optional(),
  }),
});

// ── Inferred types ─────────────────────────────────────────────────────────

export type CreateComposedDocumentInput = z.infer<
  typeof createComposedDocumentSchema
>['body'];

export type CreateUploadDocumentInput = z.infer<
  typeof createUploadDocumentSchema
>['body'];

export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>['body'];

export type DocumentFilters = z.infer<typeof documentFiltersSchema>['query'];

export type CreateAnnotationInput = z.infer<
  typeof createAnnotationSchema
>['body'];

export type MarkDocumentInput = z.infer<typeof markDocumentSchema>['body'];

export type RespondToDocumentInput = z.infer<
  typeof respondToDocumentSchema
>['body'];

export type SendToUserInput = z.infer<typeof sendToUserSchema>['body'];

export type ComposeMemoInput = z.infer<typeof composeMemoSchema>['body'];
export type ComposeLetterInput = z.infer<typeof composeLetterSchema>['body'];

export type UpdateMarkInput = z.infer<typeof updateMarkSchema>['body'];

// ── Folder types ──────────────────────────────────────────────────────────

export type RedirectToFolderInput = z.infer<typeof redirectToFolderSchema>['body'];
export type RemoveFromFolderInput = z.infer<typeof removeFromFolderSchema>['body'];
export type GetFolderDocumentsQuery = z.infer<typeof getFolderDocumentsSchema>['query'];

// ── Follow-up types (Updated) ─────────────────────────────────────────────

export type CreateFollowUpInput = z.infer<typeof createFollowUpSchema>['body'];
export type FileAwayFollowUpInput = z.infer<typeof fileAwayFollowUpSchema>['body'];
export type UpdateFollowUpInput = z.infer<typeof updateFollowUpSchema>['body'];
export type CompleteFollowUpInput = z.infer<typeof completeFollowUpSchema>['body'];
export type CancelFollowUpInput = z.infer<typeof cancelFollowUpSchema>['body'];
export type AddFollowUpCommentInput = z.infer<typeof addFollowUpCommentSchema>['body'];
export type FollowUpFilters = z.infer<typeof followUpFiltersSchema>['query'];