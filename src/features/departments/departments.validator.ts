// src/features/departments/departments.validator.ts
import { z } from 'zod';

const nameField = z
  .string()
  .min(1, 'Department name cannot be empty')
  .max(150, 'Department name cannot exceed 150 characters')
  .trim();

const codeField = z
  .string()
  .min(1, 'Department code cannot be empty')
  .max(20, 'Department code cannot exceed 20 characters')
  .toUpperCase()
  .trim();

export const createDepartmentSchema = z.object({
  body: z.object({
    name: nameField,
    code: codeField.optional(),
  }).strict(),
});

export const updateDepartmentSchema = z.object({
  body: z.object({
    name: nameField.optional(),
    code: codeField.optional(),
    is_active: z.boolean({ message: 'is_active must be a boolean' }).optional(),
  })
  .strict()
  .refine(
    (b) => Object.keys(b).length > 0,
    { message: 'At least one field must be provided to update' }
  ),
});

export const departmentIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Department ID must be a valid UUID'),
  }),
});

export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>['body'];
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>['body'];