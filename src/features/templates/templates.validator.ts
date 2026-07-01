// src/features/templates/templates.validator.ts
import { z } from 'zod';

export const templateTypeEnum = z.enum(['memo', 'letter']);

export const uploadTemplateSchema = z.object({
  params: z.object({
    departmentId: z.string().uuid('Department ID must be a valid UUID'),
    type: templateTypeEnum,
  }),
});

export const getTemplateSchema = z.object({
  params: z.object({
    departmentId: z.string().uuid('Department ID must be a valid UUID'),
    type: templateTypeEnum,
  }),
});

export const listForDepartmentSchema = z.object({
  params: z.object({
    departmentId: z.string().uuid('Department ID must be a valid UUID'),
  }),
});

export const globalTemplateSchema = z.object({
  params: z.object({
    type: templateTypeEnum,
  }),
});

export const templateIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Template ID must be a valid UUID'),
  }),
});