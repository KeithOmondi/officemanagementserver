// src/features/users/users.validator.ts
import { z } from 'zod';

const fullNameField = z.string().min(1, 'Full name cannot be empty').max(100).trim();
const emailField    = z.string().email('Invalid email address').max(255).toLowerCase().trim();
const pjNumberField = z.string().min(1, 'PJ number cannot be empty').max(50).trim();
const roleEnum      = z.enum(['super_admin', 'dept_head', 'staff', 'viewer']);

// ── createUserSchema ──────────────────────────────────────────────────────────

export const createUserSchema = z.object({
  body: z.object({
    full_name:     fullNameField,
    email:         emailField,
    pj_number:     pjNumberField,
    role:          roleEnum,
    department_id: z.string().uuid('Department ID must be a valid UUID').nullable().default(null),
  }).strict(),
});

// ── updateUserSchema ──────────────────────────────────────────────────────────

export const updateUserSchema = z.object({
  body: z.object({
    full_name:     fullNameField.optional(),
    email:         emailField.optional(),
    role:          roleEnum.optional(),
    department_id: z.string().uuid('Department ID must be a valid UUID').nullable().optional(),
    is_active:     z.boolean().optional(),
  })
  .strict()
  .refine(
    (b) => Object.keys(b).length > 0,
    { message: 'At least one field must be provided to update' }
  ),
});

// ── userIdSchema ──────────────────────────────────────────────────────────────

export const userIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('User ID must be a valid UUID'),
  }),
});

// ── userFiltersSchema ─────────────────────────────────────────────────────────

const SORTABLE_COLUMNS = ['created_at', 'updated_at', 'full_name', 'email', 'pj_number', 'last_login'] as const;

export const userFiltersSchema = z.object({
  query: z.object({
    search:          z.string().trim().max(100).optional(),
    department_id:   z.string().uuid().optional(),
    role:            roleEnum.optional(),
    is_active:       z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
    page:            z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1)).optional(),
    limit:           z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
    sort_by:         z.enum(SORTABLE_COLUMNS).optional(),
    sort_order:      z.enum(['ASC', 'DESC']).optional(),
  }),
});

// ── Inferred types ────────────────────────────────────────────────────────────

export type UserIdParams     = z.infer<typeof userIdSchema>['params'];
export type CreateUserInput  = z.infer<typeof createUserSchema>['body'];
export type UpdateUserInput  = z.infer<typeof updateUserSchema>['body'];
export type UserFiltersInput = z.infer<typeof userFiltersSchema>['query'];