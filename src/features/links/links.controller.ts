// src/features/external-links/external-links.controller.ts

import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { AppError, sendSuccess } from '../../utils/response';
import { ExternalLinksService } from './links.service';
import {
    createCategorySchema,
    updateCategorySchema,
    createLinkSchema,
    updateLinkSchema,
    linkFiltersSchema,
    idSchema,
    categoryIdSchema,
} from './links.validator';

export const externalLinksController = {

    // ─── Categories ──────────────────────────────────────────────────────────

    getCategories: asyncHandler(async (req: Request, res: Response) => {
        const includeInactive = req.query.include_inactive === 'true';
        const includeCounts = req.query.include_counts === 'true';
        const categories = await ExternalLinksService.getCategories(
            includeInactive,
            includeCounts
        );
        return sendSuccess(res, categories, 'Categories retrieved');
    }),

    getCategoryById: asyncHandler(async (req: Request, res: Response) => {
        const result = categoryIdSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        const category = await ExternalLinksService.getCategoryById(
            result.data.params.categoryId
        );
        if (!category) {
            throw new AppError(404, 'Category not found');
        }
        return sendSuccess(res, category, 'Category retrieved');
    }),

    createCategory: asyncHandler(async (req: Request, res: Response) => {
        const result = createCategorySchema.safeParse({ body: req.body });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid data');
        }
        const category = await ExternalLinksService.createCategory(result.data.body);
        return sendSuccess(res, category, 'Category created', 201);
    }),

    updateCategory: asyncHandler(async (req: Request, res: Response) => {
        const idResult = categoryIdSchema.safeParse({ params: req.params });
        if (!idResult.success) {
            throw new AppError(400, idResult.error.issues[0]?.message ?? 'Invalid ID');
        }
        const bodyResult = updateCategorySchema.safeParse({ body: req.body });
        if (!bodyResult.success) {
            throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid data');
        }
        const category = await ExternalLinksService.updateCategory(
            idResult.data.params.categoryId,
            bodyResult.data.body
        );
        return sendSuccess(res, category, 'Category updated');
    }),

    deleteCategory: asyncHandler(async (req: Request, res: Response) => {
        const result = categoryIdSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        await ExternalLinksService.deleteCategory(result.data.params.categoryId);
        return sendSuccess(res, null, 'Category deleted');
    }),

    // ─── Links ──────────────────────────────────────────────────────────────

    getLinks: asyncHandler(async (req: Request, res: Response) => {
        const result = linkFiltersSchema.safeParse({ query: req.query });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid filters');
        }
        const { links, total } = await ExternalLinksService.getLinks(result.data.query);
        return sendSuccess(res, { links, total }, 'Links retrieved');
    }),

    getLinkById: asyncHandler(async (req: Request, res: Response) => {
        const result = idSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        const link = await ExternalLinksService.getLinkById(result.data.params.id);
        if (!link) {
            throw new AppError(404, 'Link not found');
        }
        return sendSuccess(res, link, 'Link retrieved');
    }),

    createLink: asyncHandler(async (req: Request, res: Response) => {
        const result = createLinkSchema.safeParse({ body: req.body });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid data');
        }
        const link = await ExternalLinksService.createLink(
            result.data.body,
            req.user?.id
        );
        return sendSuccess(res, link, 'Link created', 201);
    }),

    updateLink: asyncHandler(async (req: Request, res: Response) => {
        const idResult = idSchema.safeParse({ params: req.params });
        if (!idResult.success) {
            throw new AppError(400, idResult.error.issues[0]?.message ?? 'Invalid ID');
        }
        const bodyResult = updateLinkSchema.safeParse({ body: req.body });
        if (!bodyResult.success) {
            throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid data');
        }
        const link = await ExternalLinksService.updateLink(
            idResult.data.params.id,
            bodyResult.data.body
        );
        return sendSuccess(res, link, 'Link updated');
    }),

    deleteLink: asyncHandler(async (req: Request, res: Response) => {
        const result = idSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        await ExternalLinksService.deleteLink(result.data.params.id);
        return sendSuccess(res, null, 'Link deleted');
    }),

    // ─── Click Tracking ──────────────────────────────────────────────────────

    trackClick: asyncHandler(async (req: Request, res: Response) => {
        const result = idSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        await ExternalLinksService.trackClick(
            result.data.params.id,
            req.user?.id,
            req.ip,
            req.headers['user-agent'],
            req.headers['referer']
        );
        return sendSuccess(res, null, 'Click tracked');
    }),

    getStats: asyncHandler(async (req: Request, res: Response) => {
        const stats = await ExternalLinksService.getLinkStats();
        return sendSuccess(res, stats, 'Stats retrieved');
    }),
};