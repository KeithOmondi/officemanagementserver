// src/features/stations/stations.controller.ts
import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { AppError, sendSuccess } from '../../utils/response';
import { StationService } from './stations.service';
import {
  createStationSchema,
  updateStationSchema,
  stationFiltersSchema,
  stationIdSchema,
} from './stations.validator';

export const stationController = {

  // ── Create ────────────────────────────────────────────────────────────────────

  create: asyncHandler(async (req: Request, res: Response) => {
    const result = createStationSchema.safeParse({ body: req.body });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid data');
    const station = await StationService.create(result.data.body);
    return sendSuccess(res, station, 'Station created successfully', 201);
  }),

  // ── Read ──────────────────────────────────────────────────────────────────────

  getAll: asyncHandler(async (req: Request, res: Response) => {
    const result = stationFiltersSchema.safeParse({ query: req.query });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid filters');
    const stations = await StationService.findAll(result.data.query);
    return sendSuccess(res, stations, 'Stations retrieved successfully');
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const result = stationIdSchema.safeParse({ params: req.params });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
    const station = await StationService.findById(result.data.params.id);
    if (!station) throw new AppError(404, 'Station not found');
    return sendSuccess(res, station, 'Station retrieved successfully');
  }),

  // ── Update ────────────────────────────────────────────────────────────────────

  update: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = stationIdSchema.safeParse({ params: req.params });
    if (!paramsResult.success) throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
    const bodyResult = updateStationSchema.safeParse({ body: req.body });
    if (!bodyResult.success) throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid data');
    const station = await StationService.update(paramsResult.data.params.id, bodyResult.data.body);
    return sendSuccess(res, station, 'Station updated successfully');
  }),

  // ── Delete ────────────────────────────────────────────────────────────────────

  delete: asyncHandler(async (req: Request, res: Response) => {
    const result = stationIdSchema.safeParse({ params: req.params });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
    await StationService.delete(result.data.params.id);
    return sendSuccess(res, null, 'Station deleted successfully');
  }),
};