// src/features/users/users.controller.ts
import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { AppError, sendSuccess } from '../../utils/response';
import { UserService } from './users.service';
import { userFiltersSchema, userIdSchema, createUserSchema, updateUserSchema } from './users.validator';

export const userController = {
  createUser: asyncHandler(async (req: Request, res: Response) => {
    const result = createUserSchema.safeParse({ body: req.body });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid user data');
    const user = await UserService.create(result.data.body);
    return sendSuccess(res, user, 'User created successfully', 201);
  }),

  getAllUsers: asyncHandler(async (req: Request, res: Response) => {
    const result = userFiltersSchema.safeParse({ query: req.query });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid query parameters');
    const users = await UserService.findAll(result.data.query);
    return sendSuccess(res, users, 'Users retrieved successfully');
  }),

  getUserStats: asyncHandler(async (_req: Request, res: Response) => {
    const stats = await UserService.getStats();
    return sendSuccess(res, stats, 'User statistics retrieved successfully');
  }),

  getCurrentUser: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new AppError(401, 'User not authenticated');
    const user = await UserService.findById(req.user.id);
    if (!user) throw new AppError(404, 'User not found');
    return sendSuccess(res, user, 'Profile retrieved successfully');
  }),

  updateCurrentUser: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new AppError(401, 'User not authenticated');
    const result = updateUserSchema.safeParse({ body: req.body });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid update data');
    // Self-update: never allow role or department changes via /me
    const { role: _r, department_id: _d, is_active: _a, ...safeFields } = result.data.body;
    const updated = await UserService.update(req.user.id, safeFields);
    return sendSuccess(res, updated, 'Profile updated successfully');
  }),

  getUserById: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = userIdSchema.safeParse({ params: req.params });
    if (!paramsResult.success) throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid user ID');
    const user = await UserService.findById(paramsResult.data.params.id);
    if (!user) throw new AppError(404, 'User not found');
    return sendSuccess(res, user, 'User retrieved successfully');
  }),

  updateUser: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = userIdSchema.safeParse({ params: req.params });
    if (!paramsResult.success) throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid user ID');
    const bodyResult = updateUserSchema.safeParse({ body: req.body });
    if (!bodyResult.success) throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid update data');

    const { id } = paramsResult.data.params;
    if (req.user?.id === id && bodyResult.data.body.role) {
      throw new AppError(403, 'You cannot change your own role');
    }

    const updated = await UserService.update(id, bodyResult.data.body);
    return sendSuccess(res, updated, 'User updated successfully');
  }),

  deleteUser: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = userIdSchema.safeParse({ params: req.params });
    if (!paramsResult.success) throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid user ID');
    const { id } = paramsResult.data.params;
    if (req.user?.id === id) throw new AppError(403, 'You cannot deactivate your own account');
    await UserService.softDelete(id);
    return sendSuccess(res, null, 'User deactivated successfully');
  }),

  hardDeleteUser: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = userIdSchema.safeParse({ params: req.params });
    if (!paramsResult.success) throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid user ID');
    const { id } = paramsResult.data.params;
    if (req.user?.id === id) throw new AppError(403, 'You cannot delete your own account');
    await UserService.hardDelete(id);
    return sendSuccess(res, null, 'User permanently deleted successfully');
  }),
};