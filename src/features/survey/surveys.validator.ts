// src/features/surveys/surveys.validator.ts

import { z } from 'zod';
import { AppError } from '../../utils/response';

const surveyFieldTypeEnum = z.enum(['text', 'textarea', 'dropdown', 'checkbox', 'date', 'numbered_list']);

const draftFieldSchema = z
  .object({
    id: z.string().optional(), // present on updates to existing fields, absent on new ones
    label: z.string().trim().min(1, 'Field label is required').max(255),
    type: surveyFieldTypeEnum,
    required: z.boolean(),
    options: z.array(z.string().trim().min(1)).optional(),
    placeholder: z.string().max(255).optional(),
    display_as_ordered: z.boolean().optional(), // If true, renders checkbox options as <ol> instead of <ul>
    help_text: z.string().max(500).optional(), // Help text displayed below the field
    min: z.number().int().optional(), // Minimum value/length for validation. For numbered_list: min items
    max: z.number().int().optional(), // Maximum value/length for validation. For numbered_list: max items
  })
  .refine((f) => (f.type !== 'dropdown' && f.type !== 'checkbox') || (f.options && f.options.length > 0), {
    message: 'Dropdown and checkbox fields need at least one option',
    path: ['options'],
  })
  .refine(
    (f) => {
      // If min is set, ensure it's a valid number
      if (f.min !== undefined && f.min < 0) return false;
      return true;
    },
    {
      message: 'Min value must be 0 or greater',
      path: ['min'],
    }
  )
  .refine(
    (f) => {
      // If max is set, ensure it's a valid number
      if (f.max !== undefined && f.max < 0) return false;
      return true;
    },
    {
      message: 'Max value must be 0 or greater',
      path: ['max'],
    }
  )
  .refine(
    (f) => {
      // Ensure min <= max if both are set
      if (f.min !== undefined && f.max !== undefined && f.min > f.max) return false;
      return true;
    },
    {
      message: 'Min value cannot be greater than max value',
      path: ['max'],
    }
  )
  .refine(
    (f) => {
      // display_as_ordered only makes sense for checkbox fields
      if (f.display_as_ordered && f.type !== 'checkbox') {
        return false;
      }
      return true;
    },
    {
      message: 'display_as_ordered can only be used with checkbox fields',
      path: ['display_as_ordered'],
    }
  )
  .refine(
    (f) => {
      // numbered_list needs at least min or max defined
      if (f.type === 'numbered_list') {
        if (f.min === undefined && f.max === undefined) {
          return false;
        }
        // If min is defined, it should be >= 1
        if (f.min !== undefined && f.min < 1) {
          return false;
        }
        // If max is defined, it should be >= 1
        if (f.max !== undefined && f.max < 1) {
          return false;
        }
      }
      return true;
    },
    {
      message: 'numbered_list fields need at least min or max defined (must be >= 1)',
      path: ['min'],
    }
  );

// Permanent slug validator - only lowercase letters, numbers, and hyphens
const permanentSlugSchema = z
  .string()
  .regex(/^[a-z0-9-]+$/, 'Permanent slug can only contain lowercase letters, numbers, and hyphens')
  .min(3, 'Permanent slug must be at least 3 characters')
  .max(100, 'Permanent slug must be less than 100 characters')
  .optional();

export const createSurveySchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(255),
  description: z.string().max(2000).optional(),
  fields: z.array(draftFieldSchema).min(1, 'At least one question is required'),
  permanent_slug: permanentSlugSchema, // Optional - auto-generated if not provided
});

export const updateSurveySchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  fields: z.array(draftFieldSchema).optional(),
  status: z.enum(['draft', 'active', 'closed']).optional(),
  // NOTE: permanent_slug is NOT in update schema - it can never be changed
});

export const submitResponseSchema = z.object({
  response_data: z.record(z.string(), z.union([z.string(), z.array(z.string())])),
});

export const saveDraftSchema = z.object({
  draft_data: z.record(z.string(), z.union([z.string(), z.array(z.string())])),
});

export type CreateSurveyBody = z.infer<typeof createSurveySchema>;
export type UpdateSurveyBody = z.infer<typeof updateSurveySchema>;
export type SubmitResponseBody = z.infer<typeof submitResponseSchema>;
export type SaveDraftBody = z.infer<typeof saveDraftSchema>;

/** Parses and validates a request body, throwing AppError(400, ...) on failure. */
export function validateBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    const message = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new AppError(400, message);
  }
  return result.data;
}