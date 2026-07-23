// src/features/tasks/tasks.controller.ts

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { TaskService } from './tasks.service';
import {
  createProjectSchema,
  updateProjectSchema,
  createTaskSchema,
  updateTaskSchema,
  createSubtaskSchema,
  updateSubtaskSchema,
  createTaskNoteSchema,
  updateTaskNoteSchema,
  createReminderSchema,
  updateReminderSchema,
  taskFiltersSchema,
  taskIdSchema,
  projectIdSchema,
  subtaskIdSchema,
  taskNoteIdSchema,
  reminderIdSchema,
  taskAttachmentSchema,
  taskAttachmentIdSchema,
  taskActivitySchema,
  taskDependencySchema,
  taskDependencyIdSchema,
  createTaskTemplateSchema,
  taskTemplateIdSchema,
  timeEntryIdSchema,
  addWatcherSchema,
  removeWatcherSchema,
  taskExportSchema,
  CreateProjectInput,
  CreateTaskInput,
  UpdateTaskInput,
  UpdateSubtaskInput,
  CreateReminderInput,
  CreateSubtaskInput,
  CreateTaskNoteInput,
  CreateTaskTemplateInput,
} from './tasks.validator';
import { AppError, sendSuccess } from '../../utils/response';

const taskService = new TaskService();

const getId = (param: string | string[]): string => String(param);

// Minimal ad hoc UUID param schema for the couple of routes (project
// attachment deletion) that don't have a dedicated *IdSchema in the
// validator.
const genericIdParamSchema = z.object({ id: z.string().uuid('ID must be a valid UUID') });

// taskAttachmentSchema.shape.params is exactly `{ taskId: uuid }`
const taskIdParamSchema = taskAttachmentSchema.shape.params;

// ─── Projects ──────────────────────────────────────────────────────────────────

export const createProject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) throw new AppError(401, 'Unauthorized');

    const parsed = createProjectSchema.shape.body.parse(req.body);
    const data: CreateProjectInput = {
      title: parsed.title,
      description: parsed.description ?? null,
      deadline: parsed.deadline,
      priority: parsed.priority ?? 'normal',
      members: parsed.members ?? [],
      owner_id: parsed.owner_id,
      department_id: parsed.department_id,
      tags: parsed.tags ?? [],
      start_date: parsed.start_date ?? null,
      status: parsed.status ?? 'active',
    };
    const project = await taskService.createProject(data, userId);
    sendSuccess(res, project, 'Project created successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const getProject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedParams = projectIdSchema.shape.params.parse(req.params);
    const project = await taskService.getProjectById(parsedParams.id);
    if (!project) throw new AppError(404, 'Project not found');
    sendSuccess(res, project);
  } catch (error) {
    next(error);
  }
};

export const listProjects = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const projects = await taskService.listProjects(userId);
    sendSuccess(res, projects);
  } catch (error) {
    next(error);
  }
};

export const updateProject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = updateProjectSchema.parse({ params: req.params, body: req.body });
    const data: any = { id: parsed.params.id };

    if (parsed.body.title !== undefined) data.title = parsed.body.title;
    if (parsed.body.description !== undefined) data.description = parsed.body.description ?? null;
    if (parsed.body.deadline !== undefined) data.deadline = parsed.body.deadline;
    if (parsed.body.priority !== undefined) data.priority = parsed.body.priority;
    if (parsed.body.members !== undefined) data.members = parsed.body.members;
    if (parsed.body.owner_id !== undefined) data.owner_id = parsed.body.owner_id;
    if (parsed.body.department_id !== undefined) data.department_id = parsed.body.department_id;
    if (parsed.body.tags !== undefined) data.tags = parsed.body.tags;
    if (req.body.start_date !== undefined) data.start_date = parsed.body.start_date ?? null;
    if (parsed.body.status !== undefined) data.status = parsed.body.status;

    const project = await taskService.updateProject(parsed.params.id, data);
    sendSuccess(res, project, 'Project updated successfully');
  } catch (error) {
    next(error);
  }
};

export const deleteProject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedParams = projectIdSchema.shape.params.parse(req.params);
    await taskService.deleteProject(parsedParams.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

// ─── Project Attachments ──────────────────────────────────────────────────────

export const addProjectAttachment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedParams = projectIdSchema.shape.params.parse(req.params);
    const userId = req.user?.id;
    if (!userId) throw new AppError(401, 'Unauthorized');
    if (!req.file) throw new AppError(400, 'File is required');

    const attachment = await taskService.addProjectAttachment(parsedParams.id, req.file, userId);
    sendSuccess(res, attachment, 'Attachment added successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const deleteProjectAttachment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedParams = genericIdParamSchema.parse(req.params);
    await taskService.deleteProjectAttachment(parsedParams.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

// ─── Tasks ────────────────────────────────────────────────────────────────────

export const createTask = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) throw new AppError(401, 'Unauthorized');

    const parsed = createTaskSchema.shape.body.parse(req.body);
    const data: CreateTaskInput = {
      project_id: parsed.project_id ?? null,
      title: parsed.title,
      description: parsed.description ?? null,
      assignee: parsed.assignee ?? null,
      priority: parsed.priority ?? 'normal',
      deadline: parsed.deadline,
      start_date: parsed.start_date ?? null,
      type: parsed.type ?? 'task',
      visibility: parsed.visibility ?? 'team',
      tags: parsed.tags ?? [],
      estimated_hours: parsed.estimated_hours ?? null,
      parent_task_id: parsed.parent_task_id ?? null,
    };
    const task = await taskService.createTask(data, userId);
    sendSuccess(res, task, 'Task created successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const getTask = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedParams = taskIdSchema.shape.params.parse(req.params);
    const fullTask = await taskService.getFullTask(parsedParams.id);
    if (!fullTask) throw new AppError(404, 'Task not found');
    sendSuccess(res, fullTask);
  } catch (error) {
    next(error);
  }
};

export const listTasks = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = taskFiltersSchema.parse({ query: req.query });
    const filters = parsed.query;
    const userId = req.user?.id;
    const result = await taskService.listTasks(filters, userId);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

export const updateTask = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) throw new AppError(401, 'Unauthorized');

    const parsed = updateTaskSchema.parse({ params: req.params, body: req.body });
    const data: Partial<UpdateTaskInput> = {};

    if (parsed.body.title !== undefined) data.title = parsed.body.title;
    if (parsed.body.description !== undefined) data.description = parsed.body.description ?? null;
    if (parsed.body.assignee !== undefined) data.assignee = parsed.body.assignee ?? null;
    if (parsed.body.priority !== undefined) data.priority = parsed.body.priority;
    if (parsed.body.deadline !== undefined) data.deadline = parsed.body.deadline;
    if (req.body.start_date !== undefined) data.start_date = parsed.body.start_date ?? null;
    if (parsed.body.status !== undefined) data.status = parsed.body.status;
    if (parsed.body.progress !== undefined) data.progress = parsed.body.progress;
    if (parsed.body.type !== undefined) data.type = parsed.body.type;
    if (parsed.body.visibility !== undefined) data.visibility = parsed.body.visibility;
    if (parsed.body.tags !== undefined) data.tags = parsed.body.tags;
    if (parsed.body.estimated_hours !== undefined) data.estimated_hours = parsed.body.estimated_hours ?? null;
    if (parsed.body.actual_hours !== undefined) data.actual_hours = parsed.body.actual_hours ?? null;
    if (parsed.body.parent_task_id !== undefined) data.parent_task_id = parsed.body.parent_task_id ?? null;
    if (parsed.body.blocked_by !== undefined) data.blocked_by = parsed.body.blocked_by;

    const task = await taskService.updateTask(parsed.params.id, data, userId);
    sendSuccess(res, task, 'Task updated successfully');
  } catch (error) {
    next(error);
  }
};

export const deleteTask = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedParams = taskIdSchema.shape.params.parse(req.params);
    await taskService.deleteTask(parsedParams.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

// ─── Task Attachments ────────────────────────────────────────────────────────

export const addTaskAttachment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedParams = taskAttachmentSchema.shape.params.parse(req.params);
    const userId = req.user?.id;
    if (!userId) throw new AppError(401, 'Unauthorized');
    if (!req.file) throw new AppError(400, 'File is required');

    const attachment = await taskService.addTaskAttachment(parsedParams.taskId, req.file, userId);
    sendSuccess(res, attachment, 'Attachment added successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const deleteTaskAttachment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedParams = taskAttachmentIdSchema.shape.params.parse(req.params);
    await taskService.deleteTaskAttachment(parsedParams.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

// ─── Task Activities ─────────────────────────────────────────────────────────

export const getTaskActivities = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = taskActivitySchema.parse({ params: req.params, query: req.query });
    const { page, limit } = parsed.query;
    const result = await taskService.getTaskActivities(parsed.params.taskId, page, limit);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

// ─── Subtasks ──────────────────────────────────────────────────────────────

export const createSubtask = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) throw new AppError(401, 'Unauthorized');

    const parsed = createSubtaskSchema.shape.body.parse(req.body);
    const data: CreateSubtaskInput = {
      task_id: parsed.task_id,
      title: parsed.title,
      description: parsed.description ?? null,
      assigned_to: parsed.assigned_to ?? null,
      due_date: parsed.due_date ?? null,
      priority: parsed.priority ?? 'normal',
    };
    const subtask = await taskService.createSubtask(data, userId);
    sendSuccess(res, subtask, 'Subtask created successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const listSubtasks = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedParams = taskIdParamSchema.parse(req.params);
    const subtasks = await taskService.listSubtasksByTask(parsedParams.taskId);
    sendSuccess(res, subtasks);
  } catch (error) {
    next(error);
  }
};

export const updateSubtask = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = updateSubtaskSchema.parse({ params: req.params, body: req.body });
    const data: Partial<UpdateSubtaskInput> = {};

    if (parsed.body.title !== undefined) data.title = parsed.body.title;
    if (parsed.body.description !== undefined) data.description = parsed.body.description ?? null;
    if (parsed.body.completed !== undefined) data.completed = parsed.body.completed;
    if (parsed.body.assigned_to !== undefined) data.assigned_to = parsed.body.assigned_to ?? null;
    if (req.body.due_date !== undefined) data.due_date = parsed.body.due_date ?? null;
    if (parsed.body.priority !== undefined) data.priority = parsed.body.priority;

    const subtask = await taskService.updateSubtask(parsed.params.id, data);
    sendSuccess(res, subtask, 'Subtask updated successfully');
  } catch (error) {
    next(error);
  }
};

export const deleteSubtask = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedParams = subtaskIdSchema.shape.params.parse(req.params);
    await taskService.deleteSubtask(parsedParams.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

// ─── Task Notes ────────────────────────────────────────────────────────────

export const createTaskNote = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) throw new AppError(401, 'Unauthorized');

    const parsed = createTaskNoteSchema.shape.body.parse(req.body);
    const data: CreateTaskNoteInput = {
      task_id: parsed.task_id,
      content: parsed.content,
      is_internal: parsed.is_internal ?? false,
      parent_note_id: parsed.parent_note_id ?? null,
    };
    const note = await taskService.createTaskNote(data, userId);
    sendSuccess(res, note, 'Note added successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const listTaskNotes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedParams = taskIdParamSchema.parse(req.params);
    const includeInternal = req.query.includeInternal === 'true';
    const notes = await taskService.listTaskNotes(parsedParams.taskId, includeInternal);
    sendSuccess(res, notes);
  } catch (error) {
    next(error);
  }
};

export const updateTaskNote = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = updateTaskNoteSchema.parse({ params: req.params, body: req.body });
    const data: { content?: string; is_internal?: boolean } = {};

    if (parsed.body.content !== undefined) data.content = parsed.body.content;
    if (parsed.body.is_internal !== undefined) data.is_internal = parsed.body.is_internal;

    const note = await taskService.updateTaskNote(parsed.params.id, data);
    sendSuccess(res, note, 'Note updated successfully');
  } catch (error) {
    next(error);
  }
};

export const deleteTaskNote = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedParams = taskNoteIdSchema.shape.params.parse(req.params);
    await taskService.deleteTaskNote(parsedParams.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

// ─── Reminders ──────────────────────────────────────────────────────────────

export const createReminder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) throw new AppError(401, 'Unauthorized');

    const parsed = createReminderSchema.shape.body.parse(req.body);
    const data: CreateReminderInput = {
      task_id: parsed.task_id,
      remind_at: parsed.remind_at,
      repeat: parsed.repeat ?? 'none',
      message: parsed.message ?? null,
    };
    const reminder = await taskService.createReminder(data, userId);
    sendSuccess(res, reminder, 'Reminder created successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const listReminders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedParams = taskIdParamSchema.parse(req.params);
    const reminders = await taskService.listRemindersForTask(parsedParams.taskId);
    sendSuccess(res, reminders);
  } catch (error) {
    next(error);
  }
};

export const updateReminder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = updateReminderSchema.parse({ params: req.params, body: req.body });
    const data: { remind_at?: string; repeat?: typeof parsed.body.repeat; message?: string | null } = {};

    if (parsed.body.remind_at !== undefined) data.remind_at = parsed.body.remind_at;
    if (parsed.body.repeat !== undefined) data.repeat = parsed.body.repeat;
    if (parsed.body.message !== undefined) data.message = parsed.body.message ?? null;

    const reminder = await taskService.updateReminder(parsed.params.id, data);
    sendSuccess(res, reminder, 'Reminder updated successfully');
  } catch (error) {
    next(error);
  }
};

export const deleteReminder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedParams = reminderIdSchema.shape.params.parse(req.params);
    await taskService.deleteReminder(parsedParams.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

// ─── Task Watchers ──────────────────────────────────────────────────────────

export const addWatcher = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = addWatcherSchema.parse({ params: req.params, body: req.body });
    await taskService.addWatcher(parsed.params.taskId, parsed.body.user_id);
    sendSuccess(res, null, 'Watcher added successfully');
  } catch (error) {
    next(error);
  }
};

export const removeWatcher = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = removeWatcherSchema.parse({ params: req.params });
    await taskService.removeWatcher(parsed.params.taskId, parsed.params.userId);
    sendSuccess(res, null, 'Watcher removed successfully');
  } catch (error) {
    next(error);
  }
};

// ─── Task Dependencies ──────────────────────────────────────────────────────

export const addDependency = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = taskDependencySchema.parse({ params: req.params, body: req.body });
    await taskService.addDependency(parsed.params.taskId, parsed.body.depends_on, parsed.body.dependency_type);
    sendSuccess(res, null, 'Dependency added successfully');
  } catch (error) {
    next(error);
  }
};

export const removeDependency = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedParams = taskDependencyIdSchema.shape.params.parse(req.params);
    await taskService.removeDependency(parsedParams.id);
    sendSuccess(res, null, 'Dependency removed successfully');
  } catch (error) {
    next(error);
  }
};

// ─── Time Tracking ──────────────────────────────────────────────────────────

export const startTimeEntry = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) throw new AppError(401, 'Unauthorized');

    const parsedParams = taskIdParamSchema.parse(req.params);
    const entry = await taskService.startTimeEntry(parsedParams.taskId, userId);
    sendSuccess(res, entry, 'Time tracking started successfully');
  } catch (error) {
    next(error);
  }
};

export const stopTimeEntry = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedParams = timeEntryIdSchema.shape.params.parse(req.params);
    const entry = await taskService.stopTimeEntry(parsedParams.id);
    sendSuccess(res, entry, 'Time tracking stopped successfully');
  } catch (error) {
    next(error);
  }
};

export const getTimeEntries = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedParams = taskIdParamSchema.parse(req.params);
    const entries = await taskService.getTimeEntriesForTask(parsedParams.taskId);
    sendSuccess(res, entries);
  } catch (error) {
    next(error);
  }
};

export const getTimeSummary = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedParams = taskIdParamSchema.parse(req.params);
    const summary = await taskService.getTimeSummaryForTask(parsedParams.taskId);
    sendSuccess(res, summary);
  } catch (error) {
    next(error);
  }
};

// ─── Delete Time Entry ──────────────────────────────────────────────────────

export const deleteTimeEntry = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedParams = timeEntryIdSchema.shape.params.parse(req.params);
    await taskService.deleteTimeEntry(parsedParams.id);
    sendSuccess(res, null, 'Time entry deleted successfully');
  } catch (error) {
    next(error);
  }
};

// ─── Task Templates ──────────────────────────────────────────────────────────

export const createTemplate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) throw new AppError(401, 'Unauthorized');

    const parsed = createTaskTemplateSchema.shape.body.parse(req.body);
    const data: CreateTaskTemplateInput = {
      title: parsed.title,
      description: parsed.description ?? null,
      type: parsed.type ?? 'task',
      priority: parsed.priority ?? 'normal',
      estimated_hours: parsed.estimated_hours ?? null,
      tags: parsed.tags ?? [],
      subtasks: parsed.subtasks ?? [],
    };
    const template = await taskService.createTemplate(data, userId);
    sendSuccess(res, template, 'Template created successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const listTemplates = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const templates = await taskService.getTemplates();
    sendSuccess(res, templates);
  } catch (error) {
    next(error);
  }
};

export const getTemplate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedParams = taskTemplateIdSchema.shape.params.parse(req.params);
    const templates = await taskService.getTemplates();
    const template = templates.find(t => t.id === parsedParams.id);
    if (!template) throw new AppError(404, 'Template not found');
    sendSuccess(res, template);
  } catch (error) {
    next(error);
  }
};

export const updateTemplate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) throw new AppError(401, 'Unauthorized');

    const parsedParams = taskTemplateIdSchema.shape.params.parse(req.params);
    const parsed = createTaskTemplateSchema.shape.body.parse(req.body);
    const data: Partial<CreateTaskTemplateInput> = {
      title: parsed.title,
      description: parsed.description ?? null,
      type: parsed.type ?? 'task',
      priority: parsed.priority ?? 'normal',
      estimated_hours: parsed.estimated_hours ?? null,
      tags: parsed.tags ?? [],
      subtasks: parsed.subtasks ?? [],
    };
    const template = await taskService.updateTemplate(parsedParams.id, data);
    sendSuccess(res, template, 'Template updated successfully');
  } catch (error) {
    next(error);
  }
};

export const deleteTemplate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedParams = taskTemplateIdSchema.shape.params.parse(req.params);
    await taskService.deleteTemplate(parsedParams.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const applyTemplate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) throw new AppError(401, 'Unauthorized');

    const parsedParams = taskTemplateIdSchema.shape.params.parse(req.params);
    const projectId = req.body.project_id
      ? z.string().uuid('project_id must be a valid UUID').parse(req.body.project_id)
      : null;

    const task = await taskService.applyTemplate(parsedParams.id, projectId, userId);
    sendSuccess(res, task, 'Template applied successfully');
  } catch (error) {
    next(error);
  }
};

// ─── Dashboard / Stats ──────────────────────────────────────────────────────

export const getDashboardStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) throw new AppError(401, 'Unauthorized');

    const stats = await taskService.getDashboardStats(userId);
    sendSuccess(res, stats);
  } catch (error) {
    next(error);
  }
};

export const getUserStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) throw new AppError(401, 'Unauthorized');

    const stats = await taskService.getUserStats(userId);
    sendSuccess(res, stats);
  } catch (error) {
    next(error);
  }
};

// ─── Task Export ─────────────────────────────────────────────────────────────

export const exportTasks = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) throw new AppError(401, 'Unauthorized');

    const parsed = taskExportSchema.parse({ query: req.query });
    const result = await taskService.exportTasks(parsed.query, userId);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

// ─── Reminder Scheduler (Admin only) ────────────────────────────────────────

export const processReminders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userRole = req.user?.role;
    if (userRole !== 'super_admin' && userRole !== 'admin') {
      throw new AppError(403, 'Forbidden - Admin access required');
    }

    await taskService.processPendingReminders();
    sendSuccess(res, null, 'Reminders processed successfully');
  } catch (error) {
    next(error);
  }
};