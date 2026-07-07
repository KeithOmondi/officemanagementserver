import { z } from 'zod';

export const uploadTemplateSchema = z.object({
  body: z.object({
    type: z.enum(['memo', 'letter']),
    department_id: z.string().uuid().optional(), // omit for a global template
  }).strict(),
});

export const templateFiltersSchema = z.object({
  query: z.object({
    type: z.enum(['memo', 'letter']).optional(),
    department_id: z.string().uuid().optional(),
  }),
});

export const templateIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Template ID must be a valid UUID'),
  }),
});

export type UploadTemplateInput = z.infer<typeof uploadTemplateSchema>['body'];
export type TemplateFilters = z.infer<typeof templateFiltersSchema>['query'];