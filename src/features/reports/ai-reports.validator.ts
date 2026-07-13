import { z } from 'zod';

export const monthlyReportQuerySchema = z.object({
    query: z.object({
        month: z.string().regex(/^([1-9]|1[0-2])$/).transform(Number),
        year: z.string().regex(/^\d{4}$/).transform(Number),
    }).strict(),
});

export const reportFiltersSchema = z.object({
    query: z.object({
        report_type: z.enum(['monthly', 'quarterly']).optional(),
        limit: z.string().regex(/^\d+$/).optional().transform(Number),
        offset: z.string().regex(/^\d+$/).optional().transform(Number),
    }).strict(),
});

export const idSchema = z.object({
    params: z.object({
        id: z.string().uuid('ID must be a valid UUID'),
    }),
});