// src/features/dashboard/dashboard.controller.ts
import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/response';
import { DashboardService } from './dashboard.service';
import { dashboardStatsSchema } from './dashboard.validator';

export const dashboardController = {
  /**
   * GET /api/dashboard/stats
   * Get all dashboard statistics in a single request
   * 
   * Returns:
   * - Document stats (total, active, inactive, by status, assigned)
   * - User stats (total, active, inactive, by role)
   * - Registry stats (stations, total files, top stations)
   * - Notice stats (total, unread, read)
   * - Inventory stats (total, in stock, low stock, out of stock)
   * - Financial stats (allocated, paid, committed unpaid, pro bono)
   * - DSA stats (activities, night outs, staff involved, total payable)
   * - Message stats (unread total, groups with unread, by group)
   */
  getStats: asyncHandler(async (req: Request, res: Response) => {
    // Validate query params (for future extensibility)
    const result = dashboardStatsSchema.safeParse({ query: req.query });
    if (!result.success) {
      // Even if validation fails, we still proceed with defaults
      // But we log the error for debugging
      console.warn('[Dashboard] Invalid query params:', result.error.issues);
    }

    const stats = await DashboardService.getStats();
    return sendSuccess(res, stats, 'Dashboard statistics retrieved successfully');
  }),
};