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


const getParamString = (param: string | string[] | undefined): string => {
  if (!param) throw new AppError(400, 'Parameter is required');
  return Array.isArray(param) ? param[0] : param;
};

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

  getByRefNo: asyncHandler(async (req: Request, res: Response) => {
    const refNo = getParamString(req.params.refNo);
    const station = await StationService.findByRefNo(refNo);
    if (!station) throw new AppError(404, 'Station not found');
    return sendSuccess(res, station, 'Station retrieved successfully');
  }),

  getActiveStations: asyncHandler(async (req: Request, res: Response) => {
    const stations = await StationService.getActiveStationsWithCounts();
    return sendSuccess(res, stations, 'Active stations retrieved successfully');
  }),

  getCourtStations: asyncHandler(async (req: Request, res: Response) => {
    const stations = await StationService.getCourtStations();
    return sendSuccess(res, stations, 'Court stations retrieved successfully');
  }),

  getByType: asyncHandler(async (req: Request, res: Response) => {
    const type = getParamString(req.params.type);
    const stations = await StationService.findByType(type);
    return sendSuccess(res, stations, 'Stations retrieved successfully');
  }),

  // ── New: Get all station types (predefined + custom) ──────────────────────

  getStationTypes: asyncHandler(async (req: Request, res: Response) => {
    const types = await StationService.getStationTypes();
    return sendSuccess(res, types, 'Station types retrieved successfully');
  }),

  // ── New: Get stations by custom type ──────────────────────────────────────

  getByCustomType: asyncHandler(async (req: Request, res: Response) => {
    const customType = getParamString(req.params.customType);
    const stations = await StationService.findByCustomType(customType);
    return sendSuccess(res, stations, 'Stations retrieved successfully');
  }),

  // ── New: Check if a type is custom ─────────────────────────────────────────

  checkType: asyncHandler(async (req: Request, res: Response) => {
    const type = getParamString(req.params.type);
    const isCustom = await StationService.isCustomType(type);
    return sendSuccess(res, { type, isCustom }, 'Type check completed');
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