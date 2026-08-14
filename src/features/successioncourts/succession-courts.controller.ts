// ============================================================
// src/features/succession-courts/succession-courts.controller.ts
// ============================================================

import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { AppError, sendSuccess } from '../../utils/response';
import { SuccessionCourtService } from './succession-courts.service';
import {
    createSuccessionCourtSchema,
    updateSuccessionCourtSchema,
    successionCourtFiltersSchema,
    idSchema,
    assignSupportPersonSchema,
    bulkAssignSupportPersonSchema,
    assignSupportPersonByCategorySchema,
    assignSupportPersonByStationSchema,
    reassignSupportPersonSchema,
    removeSupportPersonSchema,
    bulkRemoveSupportPersonSchema,
    supportPersonAssignmentsSchema,
} from './succession-courts.schema';
import { pool } from '../../config/db';

export const successionCourtController = {

    // ─── Basic CRUD ──────────────────────────────────────────────────────

    /**
     * GET /api/succession-courts
     * Get all succession courts with optional filters
     */
    getAll: asyncHandler(async (req: Request, res: Response) => {
        const result = successionCourtFiltersSchema.safeParse({ query: req.query });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid filters');
        }
        const courts = await SuccessionCourtService.findAll(result.data.query);
        return sendSuccess(res, courts, 'Succession courts retrieved');
    }),

    /**
     * GET /api/succession-courts/:id
     * Get a specific succession court by ID
     */
    getById: asyncHandler(async (req: Request, res: Response) => {
        const result = idSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        const court = await SuccessionCourtService.findById(result.data.params.id);
        if (!court) {
            throw new AppError(404, 'Succession court not found');
        }
        return sendSuccess(res, court, 'Succession court retrieved');
    }),

    /**
     * GET /api/succession-courts/:id/with-user
     * Get a specific succession court with support person details
     */
    getByIdWithUser: asyncHandler(async (req: Request, res: Response) => {
        const result = idSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        const court = await SuccessionCourtService.findByIdWithUser(result.data.params.id);
        if (!court) {
            throw new AppError(404, 'Succession court not found');
        }
        return sendSuccess(res, court, 'Succession court with support person retrieved');
    }),

    /**
     * POST /api/succession-courts
     * Create a new succession court
     */
    create: asyncHandler(async (req: Request, res: Response) => {
        const result = createSuccessionCourtSchema.safeParse({ body: req.body });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid data');
        }
        const court = await SuccessionCourtService.create(result.data.body, req.user!.id);
        return sendSuccess(res, court, 'Succession court created', 201);
    }),

    /**
     * PUT /api/succession-courts/:id
     * Update a succession court
     */
    update: asyncHandler(async (req: Request, res: Response) => {
        const paramsResult = idSchema.safeParse({ params: req.params });
        if (!paramsResult.success) {
            throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
        }
        const bodyResult = updateSuccessionCourtSchema.safeParse({ body: req.body });
        if (!bodyResult.success) {
            throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid data');
        }
        const court = await SuccessionCourtService.update(
            paramsResult.data.params.id,
            bodyResult.data.body
        );
        return sendSuccess(res, court, 'Succession court updated');
    }),

    /**
     * DELETE /api/succession-courts/:id
     * Delete a succession court
     */
    delete: asyncHandler(async (req: Request, res: Response) => {
        const result = idSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        await SuccessionCourtService.delete(result.data.params.id);
        return sendSuccess(res, null, 'Succession court deleted');
    }),

    // ─── Support Person Management ─────────────────────────────────────

    /**
     * GET /api/succession-courts/with-support
     * Get all courts with support person details enriched from users table
     */
    getWithSupportPersons: asyncHandler(async (req: Request, res: Response) => {
        const result = successionCourtFiltersSchema.safeParse({ query: req.query });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid filters');
        }
        
        const courts = await SuccessionCourtService.findAll(result.data.query);
        const enrichedCourts = await SuccessionCourtService.enrichWithSupportPersonDetails(courts);
        
        return sendSuccess(res, enrichedCourts, 'Succession courts with support persons retrieved');
    }),

    /**
     * GET /api/succession-courts/categories
     * Get all succession courts grouped by category
     */
    getByCategory: asyncHandler(async (req: Request, res: Response) => {
        const courts = await SuccessionCourtService.findAll({ is_active: true });
        const grouped = courts.reduce((acc, court) => {
            const category = court.category;
            if (!acc[category]) acc[category] = [];
            acc[category].push(court);
            return acc;
        }, {} as Record<string, typeof courts>);
        return sendSuccess(res, grouped, 'Succession courts grouped by category');
    }),

    /**
     * GET /api/succession-courts/categories/with-support
     * Get all succession courts grouped by category with support person details
     */
    getByCategoryWithSupport: asyncHandler(async (req: Request, res: Response) => {
        const courts = await SuccessionCourtService.findAll({ is_active: true });
        const enrichedCourts = await SuccessionCourtService.enrichWithSupportPersonDetails(courts);
        
        const grouped = enrichedCourts.reduce((acc, court) => {
            const category = court.category;
            if (!acc[category]) acc[category] = [];
            acc[category].push(court);
            return acc;
        }, {} as Record<string, typeof enrichedCourts>);

        return sendSuccess(res, grouped, 'Succession courts grouped by category with support persons');
    }),

    /**
     * GET /api/succession-courts/available-support-persons
     * Get list of users who can be assigned as support persons
     */
    getAvailableSupportPersons: asyncHandler(async (req: Request, res: Response) => {
        const users = await SuccessionCourtService.getAvailableSupportPersons();
        return sendSuccess(res, users, 'Available support persons retrieved');
    }),

    /**
     * GET /api/succession-courts/support-person-assignments
     * Get support person assignments (workload distribution)
     */
    getSupportPersonAssignments: asyncHandler(async (req: Request, res: Response) => {
        const result = supportPersonAssignmentsSchema.safeParse({ query: req.query });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid filters');
        }
        
        const assignments = await SuccessionCourtService.getSupportPersonAssignments(
            result.data.query.userId,
            result.data.query.category
        );
        return sendSuccess(res, assignments, 'Support person assignments retrieved');
    }),

    /**
     * POST /api/succession-courts/:id/assign-support
     * Assign a support person to a specific court
     */
    assignSupportPerson: asyncHandler(async (req: Request, res: Response) => {
        const result = assignSupportPersonSchema.safeParse({ 
            params: req.params, 
            body: req.body 
        });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid data');
        }

        const court = await SuccessionCourtService.assignSupportPerson(
            result.data.params.id,
            result.data.body.userId,
            result.data.body.contact
        );

        return sendSuccess(res, court, 'Support person assigned successfully');
    }),

    /**
     * POST /api/succession-courts/bulk-assign-support
     * Assign a support person to multiple courts at once
     */
    bulkAssignSupportPerson: asyncHandler(async (req: Request, res: Response) => {
        const result = bulkAssignSupportPersonSchema.safeParse({ body: req.body });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid data');
        }

        const results = await SuccessionCourtService.bulkAssignSupportPerson(
            result.data.body.courtIds,
            result.data.body.userId,
            result.data.body.contact
        );

        let message = `${results.updated} courts updated`;
        if (results.skipped > 0) {
            message += `, ${results.skipped} skipped`;
        }
        if (results.errors.length > 0) {
            message += `, ${results.errors.length} errors encountered`;
        }

        return sendSuccess(res, results, message);
    }),

    /**
     * POST /api/succession-courts/assign-by-category
     * Assign a support person to all courts in a specific category
     */
    assignSupportPersonByCategory: asyncHandler(async (req: Request, res: Response) => {
        const result = assignSupportPersonByCategorySchema.safeParse({ body: req.body });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid data');
        }

        const results = await SuccessionCourtService.assignSupportPersonByCategory({
            category: result.data.body.category,
            userId: result.data.body.userId,
            contact: result.data.body.contact,
        });

        let message = `${results.updated} courts in Category ${result.data.body.category} updated`;
        if (results.skipped > 0) {
            message += `, ${results.skipped} skipped`;
        }
        if (results.errors.length > 0) {
            message += `, ${results.errors.length} errors encountered`;
        }

        return sendSuccess(res, results, message);
    }),

    /**
     * POST /api/succession-courts/assign-by-station
     * Assign a support person to all courts at a specific station
     */
    assignSupportPersonByStation: asyncHandler(async (req: Request, res: Response) => {
        const result = assignSupportPersonByStationSchema.safeParse({ body: req.body });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid data');
        }

        const results = await SuccessionCourtService.assignSupportPersonByStation({
            station: result.data.body.station,
            userId: result.data.body.userId,
            contact: result.data.body.contact,
        });

        let message = `${results.updated} courts at station "${result.data.body.station}" updated`;
        if (results.skipped > 0) {
            message += `, ${results.skipped} skipped`;
        }
        if (results.errors.length > 0) {
            message += `, ${results.errors.length} errors encountered`;
        }

        return sendSuccess(res, results, message);
    }),

    /**
     * POST /api/succession-courts/reassign
     * Reassign courts from one support person to another
     */
    reassignSupportPerson: asyncHandler(async (req: Request, res: Response) => {
        const result = reassignSupportPersonSchema.safeParse({ body: req.body });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid data');
        }

        const results = await SuccessionCourtService.reassignSupportPerson({
            currentUserId: result.data.body.currentUserId,
            newUserId: result.data.body.newUserId,
            category: result.data.body.category,
            station: result.data.body.station,
        });

        let message = `${results.updated} courts reassigned`;
        if (results.skipped > 0) {
            message += `, ${results.skipped} skipped`;
        }
        if (results.errors.length > 0) {
            message += `, ${results.errors.length} errors encountered`;
        }
        if (result.data.body.category) {
            message += ` in Category ${result.data.body.category}`;
        }
        if (result.data.body.station) {
            message += ` at station "${result.data.body.station}"`;
        }

        return sendSuccess(res, results, message);
    }),

    /**
     * POST /api/succession-courts/:id/remove-support
     * Remove support person from a specific court
     */
    removeSupportPerson: asyncHandler(async (req: Request, res: Response) => {
        const result = removeSupportPersonSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }

        const court = await SuccessionCourtService.removeSupportPerson(
            result.data.params.id
        );

        return sendSuccess(res, court, 'Support person removed successfully');
    }),

    /**
     * POST /api/succession-courts/bulk-remove-support
     * Remove support persons from multiple courts at once
     */
    bulkRemoveSupportPerson: asyncHandler(async (req: Request, res: Response) => {
        const result = bulkRemoveSupportPersonSchema.safeParse({ body: req.body });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid data');
        }

        const results = await SuccessionCourtService.bulkRemoveSupportPerson(
            result.data.body.courtIds
        );

        let message = `${results.updated} courts updated`;
        if (results.skipped > 0) {
            message += `, ${results.skipped} skipped`;
        }
        if (results.errors.length > 0) {
            message += `, ${results.errors.length} errors encountered`;
        }

        return sendSuccess(res, results, message);
    }),
};