// src/features/judges/judges.validator.ts

import { z } from 'zod';

export const createJudgeSchema = z.object({
  body: z
    .object({
      s_no: z.number().int().positive('S/No must be a positive integer'),
      name: z.string().min(1, 'Name is required').max(255).trim(),
      pj_number: z.string().min(1, 'PJ Number is required').max(50).trim(),
      daily_dsa_rate: z.number().int().positive().default(25000),
    })
    .strict(),
});

export const updateJudgeSchema = z.object({
  body: z
    .object({
      s_no: z.number().int().positive().optional(),
      name: z.string().min(1).max(255).trim().optional(),
      pj_number: z.string().min(1).max(50).trim().optional(),
      daily_dsa_rate: z.number().int().positive().optional(),
      is_active: z.boolean().optional(),
    })
    .strict()
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field must be provided for update',
    }),
});

export const judgeFiltersSchema = z.object({
  query: z.object({
    search: z.string().trim().max(100).optional(),
    is_active: z
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
    sort_by: z.enum(['s_no', 'name', 'pj_number', 'created_at']).optional(),
    sort_order: z.enum(['ASC', 'DESC']).optional(),
  }),
});

export const judgeIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid judge ID format'),
  }),
});

export const judgePJNumberSchema = z.object({
  params: z.object({
    pj_number: z.string().min(1).max(50),
  }),
});

// Types
export type CreateJudgeInput = z.infer<typeof createJudgeSchema>['body'];
export type UpdateJudgeInput = z.infer<typeof updateJudgeSchema>['body'];
export type JudgeFilters = z.infer<typeof judgeFiltersSchema>['query'];