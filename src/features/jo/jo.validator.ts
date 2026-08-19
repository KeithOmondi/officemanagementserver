import { z } from 'zod';

export const joDocumentStatusEnum = z.enum(['draft', 'pending_review', 'approved', 'rejected']);

export const createJoDocumentSchema = z.object({
  body: z
    .object({
      title: z.string().min(1, 'Title is required').max(255).trim(),
      department_id: z.string().uuid().optional(),
      is_draft: z.coerce.boolean().default(false),
    })
    .strict(),
});

export const updateJoDocumentSchema = z.object({
  params: z.object({
    id: z.string().uuid('Document ID must be a valid UUID'),
  }),
  body: z
    .object({
      title: z.string().min(1).max(255).trim().optional(),
    })
    .strict()
    .refine((b) => Object.keys(b).length > 0, {
      message: 'At least one field must be provided to update',
    }),
});

export const sendToSuperAdminSchema = z.object({
  params: z.object({
    id: z.string().uuid('Document ID must be a valid UUID'),
  }),
  body: z
    .object({
      assigned_to: z.string().uuid('Must be a valid user ID').optional(),
      note: z.string().max(1000).trim().optional(),
    })
    .strict(),
});

export const respondToJoDocumentSchema = z.object({
  params: z.object({
    id: z.string().uuid('Document ID must be a valid UUID'),
  }),
  body: z
    .object({
      note: z.string().min(1, 'A response note is required').max(2000).trim(),
    })
    .strict(),
});

export const approveJoDocumentSchema = z.object({
  params: z.object({
    id: z.string().uuid('Document ID must be a valid UUID'),
  }),
  body: z
    .object({
      note: z.string().max(1000).trim().optional(),
    })
    .strict(),
});

export const rejectJoDocumentSchema = z.object({
  params: z.object({
    id: z.string().uuid('Document ID must be a valid UUID'),
  }),
  body: z
    .object({
      reason: z.string().min(1, 'A rejection reason is required').max(2000).trim(),
    })
    .strict(),
});

export const resubmitJoDocumentSchema = z.object({
  params: z.object({
    id: z.string().uuid('Document ID must be a valid UUID'),
  }),
  body: z
    .object({
      note: z.string().max(1000).trim().optional(),
    })
    .strict(),
});

export const joDocumentIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Document ID must be a valid UUID'),
  }),
});

export const joDocumentFiltersSchema = z.object({
  query: z.object({
    status: joDocumentStatusEnum.optional(),
    department_id: z.string().uuid().optional(),
    mine: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
    assigned_to_me: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
    search: z.string().trim().max(100).optional(),
    page: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1)).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
    sort_by: z.enum(['created_at', 'updated_at', 'title', 'status']).optional(),
    sort_order: z.enum(['ASC', 'DESC']).optional(),
  }),
});

export type CreateJoDocumentInput = z.infer<typeof createJoDocumentSchema>['body'];
export type UpdateJoDocumentInput = z.infer<typeof updateJoDocumentSchema>['body'];
export type SendToSuperAdminInput = z.infer<typeof sendToSuperAdminSchema>['body'];
export type RespondToJoDocumentInput = z.infer<typeof respondToJoDocumentSchema>['body'];
export type ApproveJoDocumentInput = z.infer<typeof approveJoDocumentSchema>['body'];
export type RejectJoDocumentInput = z.infer<typeof rejectJoDocumentSchema>['body'];
export type ResubmitJoDocumentInput = z.infer<typeof resubmitJoDocumentSchema>['body'];
export type JoDocumentFilters = z.infer<typeof joDocumentFiltersSchema>['query'];