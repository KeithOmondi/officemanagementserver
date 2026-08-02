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
  bulkUpdateTasksSchema,
  bulkTaskActionSchema,
  bulkUpdateSubtasksSchema,
  createTaskListSchema,
  updateTaskListSchema,
  //deleteTaskListSchema,
  addListMembersSchema,
  updateListMemberSchema,
  taskFiltersSchema,
  taskSummarySchema,
  taskTimelineSchema,
  taskAnalyticsSchema,
  taskSearchSchema,
  taskExportSchema,
  taskImportSchema,
  taskIdSchema,
  listIdSchema,
  commentIdSchema,
  tagIdSchema,
  uploadTaskAttachmentSchema,
  deleteTaskAttachmentSchema,
  createReminderSchema,
  updateReminderSchema,
  deleteReminderSchema,
  createCommentSchema,
  updateCommentSchema,
  deleteCommentSchema,
  createTagSchema,
  updateTagSchema,
  createDependencySchema,
  deleteDependencySchema,
  updateRecurrenceSchema,
  moveTaskSchema,
  copyTaskSchema,
  notificationFiltersSchema,
  markNotificationReadSchema,
  taskEventsSchema,
  NotificationFilters,
  markAllNotificationsReadSchema,
} from './tasks.validator';
//import type { Express } from 'express';
import { TaskEventFilter } from './tasks.types';
import { NotificationsService } from '../notifications/notifications.service';

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
      description: body.description ?? undefined,
      notes: body.notes ?? undefined,
      due_date: body.due_date ?? undefined,
      assigned_to: body.assigned_to ?? undefined,
      parent_task_id: body.parent_task_id ?? undefined,
      estimated_hours: body.estimated_hours ?? undefined,
      start_date: body.start_date ?? undefined,
      color: body.color ?? undefined,
      position: body.position ?? undefined,
      is_favorite: body.is_favorite ?? false,
      recurrence: body.recurrence ?? undefined,
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

  const bodyResult = updateTaskSchema.shape.body.safeParse(req.body);
  if (!bodyResult.success) {
    throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid update data');
  }

  const task = await TaskService.updateTask(
    paramsResult.data.params.id,
    bodyResult.data,
    req.user?.id
  );

  return sendSuccess(res, task, 'Task updated successfully');
}),

toggleTaskStatus: asyncHandler(async (req: Request, res: Response) => {
  const paramsResult = taskIdSchema.safeParse({ params: req.params });
  if (!paramsResult.success) {
    throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid task ID');
  }

  const bodyResult = toggleTaskStatusSchema.shape.body.safeParse(req.body);
  if (!bodyResult.success) {
    throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid status');
  }

  const task = await TaskService.toggleTaskStatus(
    paramsResult.data.params.id,
    bodyResult.data.status,
    req.user?.id
  );

  return sendSuccess(res, task, 'Task status updated successfully');
}),

  deleteTask: asyncHandler(async (req: Request, res: Response) => {
    const { params } = validateRequest<{ params: { id: string } }>(
      taskIdSchema,
      { params: req.params },
      'Invalid task ID'
    );

    await TaskService.deleteTask(params.id, req.user?.id);
    return sendSuccess(res, null, 'Task deleted successfully');
  }),

  // ─── Bulk Operations ───────────────────────────────────────────────────────

  bulkUpdateTasks: asyncHandler(async (req: Request, res: Response) => {
    const { body } = validateRequest<{ body: any }>(
      bulkUpdateTasksSchema,
      { body: req.body },
      'Invalid bulk update data'
    );

    const tasks = await TaskService.bulkUpdateTasks(body, req.user!.id);
    return sendSuccess(res, tasks, 'Tasks updated successfully');
  }),

  bulkAction: asyncHandler(async (req: Request, res: Response) => {
    const { body } = validateRequest<{ body: any }>(
      bulkTaskActionSchema,
      { body: req.body },
      'Invalid bulk action data'
    );

    const result = await TaskService.bulkAction(body, req.user!.id);
    return sendSuccess(res, result, 'Bulk action completed successfully');
  }),

  // ─── Move Task ─────────────────────────────────────────────────────────────

 // src/features/tasks/tasks.controller.ts

moveTask: asyncHandler(async (req: Request, res: Response) => {
  const paramsResult = taskIdSchema.safeParse({ params: req.params });
  if (!paramsResult.success) {
    throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid task ID');
  }

  const bodyResult = moveTaskSchema.safeParse({ body: req.body });
  if (!bodyResult.success) {
    throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid move data');
  }

  // ✅ FIX: Include task_id in the input
  const task = await TaskService.moveTask(
    paramsResult.data.params.id,
    {
      task_id: paramsResult.data.params.id,  // Add this
      new_day: bodyResult.data.body.new_day,
      new_list_id: bodyResult.data.body.new_list_id,
      new_position: bodyResult.data.body.new_position,
      new_parent_task_id: bodyResult.data.body.new_parent_task_id,
    },
    req.user?.id
  );

  return sendSuccess(res, task, 'Task moved successfully');
}),

  // ─── Copy Task ─────────────────────────────────────────────────────────────

  copyTask: asyncHandler(async (req: Request, res: Response) => {
  const paramsResult = taskIdSchema.safeParse({ params: req.params });
  if (!paramsResult.success) {
    throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid task ID');
  }

  const bodyResult = copyTaskSchema.safeParse({ body: req.body });
  if (!bodyResult.success) {
    throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid copy data');
  }

  // ✅ FIX: Add task_id to the input
  const task = await TaskService.copyTask(
    paramsResult.data.params.id,
    {
      task_id: paramsResult.data.params.id,  // Add this
      new_list_id: bodyResult.data.body.new_list_id,
      new_day: bodyResult.data.body.new_day,
      include_subtasks: bodyResult.data.body.include_subtasks,
      include_attachments: bodyResult.data.body.include_attachments,
    },
    req.user!.id
  );

  return sendSuccess(res, task, 'Task copied successfully', 201);
}),
  // ─── Get Task Summary ─────────────────────────────────────────────────────

  getTaskSummary: asyncHandler(async (req: Request, res: Response) => {
    const result = taskSummarySchema.safeParse({ query: req.query });
    if (!result.success) {
      throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid filters');
    }

    const summary = await TaskService.getTaskSummary(req.user?.id);
    return sendSuccess(res, summary, 'Task summary retrieved successfully');
  }),

  // ─── Get Task Timeline ────────────────────────────────────────────────────

  getTaskTimeline: asyncHandler(async (req: Request, res: Response) => {
    const { query } = validateRequest<{ query: any }>(
      taskTimelineSchema,
      { query: req.query },
      'Invalid timeline filters'
    );

    const timeline = await TaskService.getTaskTimeline(query, req.user?.id);
    return sendSuccess(res, timeline, 'Task timeline retrieved successfully');
  }),

  // ─── Get Task Analytics ───────────────────────────────────────────────────

  getTaskAnalytics: asyncHandler(async (req: Request, res: Response) => {
    const { query } = validateRequest<{ query: any }>(
      taskAnalyticsSchema,
      { query: req.query },
      'Invalid analytics filters'
    );

    const analytics = await TaskService.getTaskAnalytics(query, req.user?.id);
    return sendSuccess(res, analytics, 'Task analytics retrieved successfully');
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

  // ─── Bulk Update Subtasks ─────────────────────────────────────────────────

  bulkUpdateSubtasks: asyncHandler(async (req: Request, res: Response) => {
    const { body } = validateRequest<{ body: any }>(
      bulkUpdateSubtasksSchema,
      { body: req.body },
      'Invalid bulk subtask update data'
    );

    const subtasks = await TaskService.bulkUpdateSubtasks(body);
    return sendSuccess(res, subtasks, 'Subtasks updated successfully');
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

  // ─── List Members ─────────────────────────────────────────────────────────

  getListMembers: asyncHandler(async (req: Request, res: Response) => {
    const { params } = validateRequest<{ params: { id: string } }>(
      listIdSchema,
      { params: req.params },
      'Invalid list ID'
    );

    const members = await TaskService.getListMembers(params.id);
    return sendSuccess(res, members, 'List members retrieved successfully');
  }),

  addMembersToList: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = listIdSchema.safeParse({ params: req.params });
    if (!paramsResult.success) {
      throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid list ID');
    }

    const bodyResult = addListMembersSchema.safeParse({ body: req.body });
    if (!bodyResult.success) {
      throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid member data');
    }

    await TaskService.addMembersToList(
      paramsResult.data.params.id,
      bodyResult.data.body
    );

    return sendSuccess(res, null, 'Members added to list successfully');
  }),

  updateListMember: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = updateListMemberSchema.safeParse({ params: req.params });
    if (!paramsResult.success) {
      throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid parameters');
    }

    await TaskService.updateListMember(
      paramsResult.data.params.id,
      paramsResult.data.params.userId,
      paramsResult.data.body
    );

    return sendSuccess(res, null, 'List member updated successfully');
  }),

  removeMemberFromList: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = listIdSchema.safeParse({ params: req.params });
    if (!paramsResult.success) {
      throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid list ID');
    }

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

  uploadAttachments: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = uploadTaskAttachmentSchema.shape.params.safeParse(req.params);
    if (!paramsResult.success) {
      throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid task ID');
    }

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

  deleteAttachment: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = deleteTaskAttachmentSchema.shape.params.safeParse(req.params);
    if (!paramsResult.success) {
      throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid attachment ID');
    }

    await TaskService.deleteAttachment(paramsResult.data.attachmentId, req.user?.id);
    return sendSuccess(res, null, 'Attachment deleted successfully');
  }),

  getTaskAttachments: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = uploadTaskAttachmentSchema.shape.params.safeParse(req.params);
    if (!paramsResult.success) {
      throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid task ID');
    }

    const attachments = await TaskService.getTaskAttachments(paramsResult.data.taskId);
    return sendSuccess(res, attachments, 'Attachments retrieved successfully');
  }),

  // ═══════════════════════════════════════════════════════════════════════════
  //  COMMENT CONTROLLERS
  // ═══════════════════════════════════════════════════════════════════════════

 createComment: asyncHandler(async (req: Request, res: Response) => {
  const paramsResult = createCommentSchema.shape.params.safeParse(req.params);
  if (!paramsResult.success) {
    throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid task ID');
  }

  const bodyResult = createCommentSchema.shape.body.safeParse(req.body);
  if (!bodyResult.success) {
    throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid comment data');
  }

  // ✅ FIX: Add task_id to the input
  const comment = await TaskService.createComment(
    paramsResult.data.taskId,
    {
      task_id: paramsResult.data.taskId,  // Add this
      content: bodyResult.data.content,
      mentions: bodyResult.data.mentions,
      attachment_ids: bodyResult.data.attachment_ids,
      parent_comment_id: bodyResult.data.parent_comment_id,
    },
    req.user!.id
  );

  return sendSuccess(res, comment, 'Comment created successfully', 201);
}),

  updateComment: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = updateCommentSchema.safeParse({ params: req.params });
    if (!paramsResult.success) {
      throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid comment ID');
    }

    const bodyResult = updateCommentSchema.shape.body.safeParse(req.body);
    if (!bodyResult.success) {
      throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid comment data');
    }

    const comment = await TaskService.updateComment(
      paramsResult.data.params.id,
      bodyResult.data,
      req.user!.id
    );

    return sendSuccess(res, comment, 'Comment updated successfully');
  }),

  deleteComment: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = deleteCommentSchema.safeParse({ params: req.params });
    if (!paramsResult.success) {
      throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid comment ID');
    }

    await TaskService.deleteComment(paramsResult.data.params.id, req.user!.id);
    return sendSuccess(res, null, 'Comment deleted successfully');
  }),

  getTaskComments: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = taskIdSchema.safeParse({ params: req.params });
    if (!paramsResult.success) {
      throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid task ID');
    }

    const comments = await TaskService.getTaskComments(paramsResult.data.params.id);
    return sendSuccess(res, comments, 'Comments retrieved successfully');
  }),

  // ═══════════════════════════════════════════════════════════════════════════
  //  REMINDER CONTROLLERS
  // ═══════════════════════════════════════════════════════════════════════════

  createReminder: asyncHandler(async (req: Request, res: Response) => {
    const { body } = validateRequest<{ body: any }>(
      createReminderSchema,
      { body: req.body },
      'Invalid reminder data'
    );

    const reminder = await TaskService.createReminder(body, req.user!.id);
    return sendSuccess(res, reminder, 'Reminder created successfully', 201);
  }),

  updateReminder: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = updateReminderSchema.safeParse({ params: req.params });
    if (!paramsResult.success) {
      throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid reminder ID');
    }

    const bodyResult = updateReminderSchema.shape.body.safeParse(req.body);
    if (!bodyResult.success) {
      throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid reminder data');
    }

    const reminder = await TaskService.updateReminder(
      paramsResult.data.params.id,
      bodyResult.data,
      req.user!.id
    );

    return sendSuccess(res, reminder, 'Reminder updated successfully');
  }),

  deleteReminder: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = deleteReminderSchema.safeParse({ params: req.params });
    if (!paramsResult.success) {
      throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid reminder ID');
    }

    await TaskService.deleteReminder(paramsResult.data.params.id, req.user!.id);
    return sendSuccess(res, null, 'Reminder deleted successfully');
  }),

  getTaskReminders: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = taskIdSchema.safeParse({ params: req.params });
    if (!paramsResult.success) {
      throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid task ID');
    }

    const reminders = await TaskService.getTaskReminders(paramsResult.data.params.id);
    return sendSuccess(res, reminders, 'Reminders retrieved successfully');
  }),

  // ═══════════════════════════════════════════════════════════════════════════
  //  TAG CONTROLLERS
  // ═══════════════════════════════════════════════════════════════════════════

  createTag: asyncHandler(async (req: Request, res: Response) => {
    const { body } = validateRequest<{ body: any }>(
      createTagSchema,
      { body: req.body },
      'Invalid tag data'
    );

    const tag = await TaskService.createTag(body, req.user!.id);
    return sendSuccess(res, tag, 'Tag created successfully', 201);
  }),

  getAllTags: asyncHandler(async (req: Request, res: Response) => {
    const tags = await TaskService.findAllTags(req.user?.id);
    return sendSuccess(res, tags, 'Tags retrieved successfully');
  }),

  getTagById: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = tagIdSchema.safeParse({ params: req.params });
    if (!paramsResult.success) {
      throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid tag ID');
    }

    const tag = await TaskService.findTagById(paramsResult.data.params.id);
    if (!tag) {
      throw new AppError(404, 'Tag not found');
    }

    return sendSuccess(res, tag, 'Tag retrieved successfully');
  }),

  updateTag: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = updateTagSchema.safeParse({ params: req.params });
    if (!paramsResult.success) {
      throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid tag ID');
    }

    const bodyResult = updateTagSchema.shape.body.safeParse(req.body);
    if (!bodyResult.success) {
      throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid tag data');
    }

    const tag = await TaskService.updateTag(
      paramsResult.data.params.id,
      bodyResult.data
    );

    return sendSuccess(res, tag, 'Tag updated successfully');
  }),

  deleteTag: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = tagIdSchema.safeParse({ params: req.params });
    if (!paramsResult.success) {
      throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid tag ID');
    }

    await TaskService.deleteTag(paramsResult.data.params.id);
    return sendSuccess(res, null, 'Tag deleted successfully');
  }),

  // ═══════════════════════════════════════════════════════════════════════════
  //  DEPENDENCY CONTROLLERS
  // ═══════════════════════════════════════════════════════════════════════════

  createDependency: asyncHandler(async (req: Request, res: Response) => {
    const { body } = validateRequest<{ body: any }>(
      createDependencySchema,
      { body: req.body },
      'Invalid dependency data'
    );

    const dependency = await TaskService.createDependency(body, req.user!.id);
    return sendSuccess(res, dependency, 'Dependency created successfully', 201);
  }),

  deleteDependency: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = deleteDependencySchema.safeParse({ params: req.params });
    if (!paramsResult.success) {
      throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid dependency ID');
    }

    await TaskService.deleteDependency(paramsResult.data.params.id, req.user!.id);
    return sendSuccess(res, null, 'Dependency deleted successfully');
  }),

  getTaskDependencies: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = taskIdSchema.safeParse({ params: req.params });
    if (!paramsResult.success) {
      throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid task ID');
    }

    const dependencies = await TaskService.getTaskDependencies(paramsResult.data.params.id);
    return sendSuccess(res, dependencies, 'Dependencies retrieved successfully');
  }),

  // ═══════════════════════════════════════════════════════════════════════════
  //  RECURRENCE CONTROLLERS
  // ═══════════════════════════════════════════════════════════════════════════

  updateRecurrence: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = updateRecurrenceSchema.safeParse({ params: req.params });
    if (!paramsResult.success) {
      throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid task ID');
    }

    const bodyResult = updateRecurrenceSchema.shape.body.safeParse(req.body);
    if (!bodyResult.success) {
      throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid recurrence data');
    }

    const recurrence = await TaskService.updateRecurrence(
      paramsResult.data.params.taskId,
      bodyResult.data,
      req.user!.id
    );

    return sendSuccess(res, recurrence, 'Recurrence updated successfully');
  }),

  deleteRecurrence: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = taskIdSchema.safeParse({ params: req.params });
    if (!paramsResult.success) {
      throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid task ID');
    }

    await TaskService.deleteRecurrence(paramsResult.data.params.id, req.user!.id);
    return sendSuccess(res, null, 'Recurrence deleted successfully');
  }),

  // ═══════════════════════════════════════════════════════════════════════════
  //  SEARCH, EXPORT, IMPORT CONTROLLERS
  // ═══════════════════════════════════════════════════════════════════════════

  searchTasks: asyncHandler(async (req: Request, res: Response) => {
    const { body } = validateRequest<{ body: any }>(
      taskSearchSchema,
      { body: req.body },
      'Invalid search data'
    );

    const results = await TaskService.searchTasks(body, req.user?.id);
    return sendSuccess(res, results, 'Search completed successfully');
  }),

  exportTasks: asyncHandler(async (req: Request, res: Response) => {
    const { body } = validateRequest<{ body: any }>(
      taskExportSchema,
      { body: req.body },
      'Invalid export data'
    );

    const data = await TaskService.exportTasks(body, req.user?.id);

    // Handle different export formats
    if (body.format === 'csv') {
      // For CSV, send as downloadable file
      const headers = data.headers.join(',');
      const rows = data.rows.map((row: any[]) => row.join(',')).join('\n');
      const csv = `${headers}\n${rows}`;
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=tasks.csv');
      return res.send(csv);
    } else if (body.format === 'json') {
      return sendSuccess(res, data, 'Tasks exported successfully');
    } else {
      // For PDF and HTML, return structured data
      return sendSuccess(res, data, `Tasks exported in ${body.format} format`);
    }
  }),

  importTasks: asyncHandler(async (req: Request, res: Response) => {
    const { body } = validateRequest<{ body: any }>(
      taskImportSchema,
      { body: req.body },
      'Invalid import data'
    );

    const result = await TaskService.importTasks(body, req.user!.id);
    return sendSuccess(res, result, 'Tasks imported successfully');
  }),

  // ═══════════════════════════════════════════════════════════════════════════
  //  NOTIFICATION CONTROLLERS
  // ═══════════════════════════════════════════════════════════════════════════
// src/features/tasks/tasks.controller.ts

getNotifications: asyncHandler(async (req: Request, res: Response) => {
  const result = notificationFiltersSchema.safeParse({ query: req.query });
  if (!result.success) {
    throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid notification filters');
  }

  const queryData = result.data.query;
  
  // ✅ FIX: Build the filters object with proper typing
  const filters: any = {};
  
  if (queryData) {
    if (queryData.is_read !== undefined) filters.is_read = queryData.is_read;
    if (queryData.event_type) filters.event_type = queryData.event_type;
    if (queryData.from_date) filters.from_date = queryData.from_date; // Keep as string for the service
    if (queryData.to_date) filters.to_date = queryData.to_date; // Keep as string for the service
    if (queryData.limit) filters.limit = queryData.limit;
    if (queryData.offset) filters.offset = queryData.offset;
  }

  // Get notifications from the real-time service
  const notifications = await NotificationsService.getUserNotifications(
    req.user!.id,
    filters
  );

  return sendSuccess(res, notifications, 'Notifications retrieved successfully');
}),

  markNotificationRead: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = markNotificationReadSchema.safeParse({ params: req.params });
    if (!paramsResult.success) {
      throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid notification ID');
    }

    await TaskService.markNotificationRead(paramsResult.data.params.id, req.user!.id);
    return sendSuccess(res, null, 'Notification marked as read');
  }),

  markAllNotificationsRead: asyncHandler(async (req: Request, res: Response) => {
    const bodyResult = markAllNotificationsReadSchema.shape.body.safeParse(req.body);
    if (!bodyResult.success) {
      throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid request');
    }

    await TaskService.markAllNotificationsRead(
      req.user!.id,
      bodyResult.data?.event_type
    );

    return sendSuccess(res, null, 'All notifications marked as read');
  }),

  deleteNotification: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = markNotificationReadSchema.safeParse({ params: req.params });
    if (!paramsResult.success) {
      throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid notification ID');
    }

    await TaskService.deleteNotification(paramsResult.data.params.id, req.user!.id);
    return sendSuccess(res, null, 'Notification deleted successfully');
  }),

  // ═══════════════════════════════════════════════════════════════════════════
  //  ACTIVITY EVENTS CONTROLLERS
  // ═══════════════════════════════════════════════════════════════════════════

  getTaskEvents: asyncHandler(async (req: Request, res: Response) => {
  const result = taskEventsSchema.safeParse({ query: req.query });
  if (!result.success) {
    throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid event filters');
  }

  // ✅ FIX: Convert string dates to Date objects and handle undefined
  const queryData = result.data.query;
  const filters: TaskEventFilter = queryData ? {
    task_id: queryData.task_id,
    user_id: queryData.user_id,
    event_type: queryData.event_type,
    from_date: queryData.from_date ? new Date(queryData.from_date) : undefined,
    to_date: queryData.to_date ? new Date(queryData.to_date) : undefined,
    limit: queryData.limit,
    offset: queryData.offset,
  } : {};

  const events = await TaskService.getTaskEvents(filters);
  return sendSuccess(res, events, 'Task events retrieved successfully');
}),
};