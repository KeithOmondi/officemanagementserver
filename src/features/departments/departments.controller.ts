// src/features/departments/departments.controller.ts
import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { AppError, sendSuccess } from '../../utils/response';
import { DepartmentService } from './departments.service';
import {
  createDepartmentSchema,
  updateDepartmentSchema,
  departmentIdSchema,
} from './departments.validator';

export const departmentController = {
  create: asyncHandler(async (req: Request, res: Response) => {
    const result = createDepartmentSchema.safeParse({ body: req.body });
    if (!result.success) {
      throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid department data');
    }
    const department = await DepartmentService.create(result.data.body);
    return sendSuccess(res, department, 'Department created successfully', 201);
  }),

  getAll: asyncHandler(async (_req: Request, res: Response) => {
    const departments = await DepartmentService.findAll();
    return sendSuccess(res, departments, 'Departments retrieved successfully');
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const result = departmentIdSchema.safeParse({ params: req.params });
    if (!result.success) {
      throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid department ID');
    }
    const department = await DepartmentService.findByIdOrThrow(result.data.params.id);
    return sendSuccess(res, department, 'Department retrieved successfully');
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = departmentIdSchema.safeParse({ params: req.params });
    if (!paramsResult.success) {
      throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid department ID');
    }
    const bodyResult = updateDepartmentSchema.safeParse({ body: req.body });
    if (!bodyResult.success) {
      throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid update data');
    }
    const department = await DepartmentService.update(
      paramsResult.data.params.id,
      bodyResult.data.body
    );
    return sendSuccess(res, department, 'Department updated successfully');
  }),

  delete: asyncHandler(async (req: Request, res: Response) => {
    const result = departmentIdSchema.safeParse({ params: req.params });
    if (!result.success) {
      throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid department ID');
    }
    await DepartmentService.delete(result.data.params.id);
    return sendSuccess(res, null, 'Department deleted successfully');
  }),
};