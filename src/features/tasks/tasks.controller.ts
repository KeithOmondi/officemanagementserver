// src/features/tasks/tasks.controller.ts
import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { AppError, sendSuccess } from '../../utils/response';
import { TaskService } from './tasks.service';
import {
  createTaskSchema,
  updateTaskSchema,
  toggleTaskStatusSchema,
  createSubtaskSchema,
  updateSubtaskSchema,
  deleteSubtaskSchema,
  createTaskListSchema,
  updateTaskListSchema,
  deleteTaskListSchema,
  taskFiltersSchema,
  taskSummarySchema,
  taskIdSchema,
  listIdSchema,
  uploadTaskAttachmentSchema,
  deleteTaskAttachmentSchema,
} from './tasks.validator';
import type { Express } from 'express';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const validateRequest = <T>(
  schema: any,
  data: unknown,
  errorMessage: string = 'Invalid request data'
): T => {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new AppError(400, result.error.issues[0]?.message ?? errorMessage);
  }
  return result.data;
};

const getParamAsString = (param: string | string[] | undefined): string | undefined => {
  if (!param) return undefined;
  return Array.isArray(param) ? param[0] : param;
};

// ─── Controller ──────────────────────────────────────────────────────────────

export const taskController = {

  // ═══════════════════════════════════════════════════════════════════════════
  //  TASK CONTROLLERS
  // ═══════════════════════════════════════════════════════════════════════════

  createTask: asyncHandler(async (req: Request, res: Response) => {
    const { body } = validateRequest<{ body: any }>(
      createTaskSchema,
      { body: req.body },
      'Invalid task data'
    );

    const taskData = {
      ...body,
      list_id: body.list_id ?? undefined,
      notes: body.notes ?? undefined,
      due_date: body.due_date ?? undefined,
      assigned_to: body.assigned_to ?? undefined,
    };

    const task = await TaskService.createTask(taskData, req.user!.id);
    return sendSuccess(res, task, 'Task created successfully', 201);
  }),

  getAllTasks: asyncHandler(async (req: Request, res: Response) => {
    const { query } = validateRequest<{ query: any }>(
      taskFiltersSchema,
      { query: req.query },
      'Invalid filters'
    );

    const tasks = await TaskService.findAllTasks(query, req.user?.id);
    return sendSuccess(res, tasks, 'Tasks retrieved successfully');
  }),

  getTaskById: asyncHandler(async (req: Request, res: Response) => {
    const { params } = validateRequest<{ params: { id: string } }>(
      taskIdSchema,
      { params: req.params },
      'Invalid task ID'
    );

    const task = await TaskService.findTaskById(params.id);
    if (!task) {
      throw new AppError(404, 'Task not found');
    }

    return sendSuccess(res, task, 'Task retrieved successfully');
  }),

  updateTask: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = taskIdSchema.safeParse({ params: req.params });
    if (!paramsResult.success) {
      throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid task ID');
    }

    const bodyResult = updateTaskSchema.safeParse({ body: req.body });
    if (!bodyResult.success) {
      throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid update data');
    }

    const task = await TaskService.updateTask(
      paramsResult.data.params.id,
      bodyResult.data.body
    );

    return sendSuccess(res, task, 'Task updated successfully');
  }),

  toggleTaskStatus: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = taskIdSchema.safeParse({ params: req.params });
    if (!paramsResult.success) {
      throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid task ID');
    }

    const bodyResult = toggleTaskStatusSchema.safeParse({ body: req.body });
    if (!bodyResult.success) {
      throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid status');
    }

    const task = await TaskService.toggleTaskStatus(
      paramsResult.data.params.id,
      bodyResult.data.body.status
    );

    return sendSuccess(res, task, 'Task status updated successfully');
  }),

  deleteTask: asyncHandler(async (req: Request, res: Response) => {
    const { params } = validateRequest<{ params: { id: string } }>(
      taskIdSchema,
      { params: req.params },
      'Invalid task ID'
    );

    await TaskService.deleteTask(params.id);
    return sendSuccess(res, null, 'Task deleted successfully');
  }),

  getTaskSummary: asyncHandler(async (req: Request, res: Response) => {
    const result = taskSummarySchema.safeParse({ query: req.query });
    if (!result.success) {
      throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid filters');
    }

    const summary = await TaskService.getTaskSummary(req.user?.id);
    return sendSuccess(res, summary, 'Task summary retrieved successfully');
  }),

  // ═══════════════════════════════════════════════════════════════════════════
  //  SUBTASK CONTROLLERS
  // ═══════════════════════════════════════════════════════════════════════════

  createSubtask: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = createSubtaskSchema.shape.params.safeParse(req.params);
    if (!paramsResult.success) {
      throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid task ID');
    }

    const bodyResult = createSubtaskSchema.shape.body.safeParse(req.body);
    if (!bodyResult.success) {
      throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid subtask data');
    }

    const subtask = await TaskService.createSubtask(
      paramsResult.data.taskId,
      bodyResult.data
    );

    return sendSuccess(res, subtask, 'Subtask created successfully', 201);
  }),

  updateSubtask: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = updateSubtaskSchema.shape.params.safeParse(req.params);
    if (!paramsResult.success) {
      throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid IDs');
    }

    const bodyResult = updateSubtaskSchema.shape.body.safeParse(req.body);
    if (!bodyResult.success) {
      throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid subtask data');
    }

    const subtask = await TaskService.updateSubtask(
      paramsResult.data.taskId,
      paramsResult.data.subtaskId,
      bodyResult.data
    );

    return sendSuccess(res, subtask, 'Subtask updated successfully');
  }),

  deleteSubtask: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = deleteSubtaskSchema.shape.params.safeParse(req.params);
    if (!paramsResult.success) {
      throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid IDs');
    }

    await TaskService.deleteSubtask(
      paramsResult.data.taskId,
      paramsResult.data.subtaskId
    );

    return sendSuccess(res, null, 'Subtask deleted successfully');
  }),

  // ═══════════════════════════════════════════════════════════════════════════
  //  TASK LIST CONTROLLERS
  // ═══════════════════════════════════════════════════════════════════════════

  createTaskList: asyncHandler(async (req: Request, res: Response) => {
    const { body } = validateRequest<{ body: any }>(
      createTaskListSchema,
      { body: req.body },
      'Invalid list data'
    );

    const list = await TaskService.createTaskList(body, req.user!.id);
    return sendSuccess(res, list, 'Task list created successfully', 201);
  }),

  getAllTaskLists: asyncHandler(async (req: Request, res: Response) => {
    const lists = await TaskService.findAllTaskLists(req.user?.id);
    return sendSuccess(res, lists, 'Task lists retrieved successfully');
  }),

  getTaskListById: asyncHandler(async (req: Request, res: Response) => {
    const { params } = validateRequest<{ params: { id: string } }>(
      listIdSchema,
      { params: req.params },
      'Invalid list ID'
    );

    const list = await TaskService.findTaskListById(params.id);
    if (!list) {
      throw new AppError(404, 'Task list not found');
    }

    return sendSuccess(res, list, 'Task list retrieved successfully');
  }),

  updateTaskList: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = listIdSchema.safeParse({ params: req.params });
    if (!paramsResult.success) {
      throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid list ID');
    }

    const bodyResult = updateTaskListSchema.safeParse({ body: req.body });
    if (!bodyResult.success) {
      throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid update data');
    }

    const list = await TaskService.updateTaskList(
      paramsResult.data.params.id,
      bodyResult.data.body
    );

    return sendSuccess(res, list, 'Task list updated successfully');
  }),

  deleteTaskList: asyncHandler(async (req: Request, res: Response) => {
    const { params } = validateRequest<{ params: { id: string } }>(
      listIdSchema,
      { params: req.params },
      'Invalid list ID'
    );

    await TaskService.deleteTaskList(params.id);
    return sendSuccess(res, null, 'Task list deleted successfully');
  }),

  getListMembers: asyncHandler(async (req: Request, res: Response) => {
    const { params } = validateRequest<{ params: { id: string } }>(
      listIdSchema,
      { params: req.params },
      'Invalid list ID'
    );

    const members = await TaskService.getListMembers(params.id);
    return sendSuccess(res, members, 'List members retrieved successfully');
  }),

  addMemberToList: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = listIdSchema.safeParse({ params: req.params });
    if (!paramsResult.success) {
      throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid list ID');
    }

    const { userId } = req.body;
    if (!userId) {
      throw new AppError(400, 'User ID is required');
    }

    await TaskService.addMemberToList(paramsResult.data.params.id, userId);
    return sendSuccess(res, null, 'Member added to list successfully');
  }),

  removeMemberFromList: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = listIdSchema.safeParse({ params: req.params });
    if (!paramsResult.success) {
      throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid list ID');
    }

    // Fix: Ensure userId is a string
    const userId = getParamAsString(req.params.userId);
    if (!userId) {
      throw new AppError(400, 'User ID is required');
    }

    await TaskService.removeMemberFromList(paramsResult.data.params.id, userId);
    return sendSuccess(res, null, 'Member removed from list successfully');
  }),

  // ═══════════════════════════════════════════════════════════════════════════
  //  ATTACHMENT CONTROLLERS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Upload one or more files as attachments to a task.
   * Expects multipart/form-data with field name 'documents' (or similar).
   * The route must use the `uploadBulkEvidence` middleware.
   */
  uploadAttachments: asyncHandler(async (req: Request, res: Response) => {
    // Validate taskId param
    const paramsResult = uploadTaskAttachmentSchema.shape.params.safeParse(req.params);
    if (!paramsResult.success) {
      throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid task ID');
    }

    // Access files from req.files (populated by multer)
    const files = (req as any).files as Express.Multer.File[] | undefined;
    if (!files || files.length === 0) {
      throw new AppError(400, 'At least one file must be uploaded');
    }

    const attachments = await TaskService.uploadAttachments(
      paramsResult.data.taskId,
      files,
      req.user!.id
    );

    return sendSuccess(res, attachments, 'Attachments uploaded successfully', 201);
  }),

  /**
   * Delete an attachment by its ID.
   * This will remove the file from Cloudinary and soft-delete the record.
   */
  deleteAttachment: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = deleteTaskAttachmentSchema.shape.params.safeParse(req.params);
    if (!paramsResult.success) {
      throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid attachment ID');
    }

    await TaskService.deleteAttachment(paramsResult.data.attachmentId);

    return sendSuccess(res, null, 'Attachment deleted successfully');
  }),

  /**
   * Retrieve all attachments for a task.
   */
  getTaskAttachments: asyncHandler(async (req: Request, res: Response) => {
    // Validate taskId param (reuse the same shape as uploadTaskAttachmentSchema)
    const paramsResult = uploadTaskAttachmentSchema.shape.params.safeParse(req.params);
    if (!paramsResult.success) {
      throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid task ID');
    }

    const attachments = await TaskService.getTaskAttachments(paramsResult.data.taskId);

    return sendSuccess(res, attachments, 'Attachments retrieved successfully');
  }),
};