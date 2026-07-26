// src/features/dashboard/dashboard.validator.ts
import { z } from 'zod';

// ─── Dashboard Stats Validator ──────────────────────────────────────────────

/**
 * Validator for dashboard statistics endpoint
 * Currently no query parameters needed, but we keep it for future extensibility
 */
export const dashboardStatsSchema = z.object({
  query: z.object({
    // Optional time range filter for future use
    range: z.enum(['7d', '30d', '90d', 'all']).optional().default('all'),
  }).optional(),
});

// ─── Inferred types ──────────────────────────────────────────────────────────

export type DashboardStatsQuery = z.infer<typeof dashboardStatsSchema>['query'];