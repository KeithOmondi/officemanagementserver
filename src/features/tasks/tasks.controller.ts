import { Request, Response, NextFunction } from 'express';
import { TaskService } from './tasks.service';
import {
  createProjectSchema,
  updateProjectSchema,
  createTaskSchema,
  updateTaskSchema,
  createSubtaskSchema,
  updateSubtaskSchema,
  createTaskNoteSchema,
  createReminderSchema,
  taskFiltersSchema,
} from './tasks.validator';
import { AppError, sendSuccess } from '../../utils/response';
import {
  CreateProjectInput,
  CreateTaskInput,
  CreateReminderInput,
} from './tasks.types';

const taskService = new TaskService();

const getId = (param: string | string[]): string => String(param);

// ─── Projects ──────────────────────────────────────────────
export const createProject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = createProjectSchema.parse(req.body);
    const data: CreateProjectInput = {
      title: parsed.title,
      description: parsed.description ?? null,
      deadline: parsed.deadline,
      priority: parsed.priority,
      members: parsed.members,
    };
    const project = await taskService.createProject(data);
    sendSuccess(res, project, 'Project created successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const getProject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = getId(req.params.id);
    const project = await taskService.getProjectById(id);
    if (!project) throw new AppError(404, 'Project not found');
    sendSuccess(res, project);
  } catch (error) {
    next(error);
  }
};

export const listProjects = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projects = await taskService.listProjects();
    sendSuccess(res, projects);
  } catch (error) {
    next(error);
  }
};

export const updateProject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = getId(req.params.id);
    const parsed = updateProjectSchema.parse({ ...req.body, id });
    const data: Partial<CreateProjectInput> & { id: string } = {
      id: parsed.id,
      title: parsed.title,
      deadline: parsed.deadline,
      priority: parsed.priority,
      members: parsed.members,
      description: parsed.description ?? null,
    };
    // Remove undefined fields
    Object.keys(data).forEach(key => {
      if (data[key as keyof typeof data] === undefined) delete data[key as keyof typeof data];
    });
    const project = await taskService.updateProject(id, data);
    sendSuccess(res, project, 'Project updated successfully');
  } catch (error) {
    next(error);
  }
};

export const deleteProject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = getId(req.params.id);
    await taskService.deleteProject(id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

// ─── Tasks ──────────────────────────────────────────────────
export const createTask = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = createTaskSchema.parse(req.body);
    const data: CreateTaskInput = {
      project_id: parsed.project_id ?? null,
      title: parsed.title,
      description: parsed.description ?? null,
      assignee: parsed.assignee, // ✅ No fallback – validator ensures it exists
      priority: parsed.priority ?? 'normal',
      deadline: parsed.deadline,
      start_date: parsed.start_date ?? null,
    };
    const task = await taskService.createTask(data);
    sendSuccess(res, task, 'Task created successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const getTask = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = getId(req.params.id);
    const fullTask = await taskService.getFullTask(id);
    if (!fullTask) throw new AppError(404, 'Task not found');
    sendSuccess(res, fullTask);
  } catch (error) {
    next(error);
  }
};

export const listTasks = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filters = taskFiltersSchema.parse(req.query);
    const tasks = await taskService.listTasks(filters);
    sendSuccess(res, tasks);
  } catch (error) {
    next(error);
  }
};

export const updateTask = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = getId(req.params.id);
    const parsed = updateTaskSchema.parse({ ...req.body, id });
    const data: any = { id: parsed.id };
    if (parsed.title !== undefined) data.title = parsed.title;
    if (parsed.description !== undefined) data.description = parsed.description ?? null;
    if (parsed.assignee !== undefined) data.assignee = parsed.assignee;
    if (parsed.priority !== undefined) data.priority = parsed.priority;
    if (parsed.deadline !== undefined) data.deadline = parsed.deadline;
    if (parsed.start_date !== undefined) data.start_date = parsed.start_date ?? null;
    if (parsed.status !== undefined) data.status = parsed.status;
    if (parsed.progress !== undefined) data.progress = parsed.progress;
    const task = await taskService.updateTask(id, data);
    sendSuccess(res, task, 'Task updated successfully');
  } catch (error) {
    next(error);
  }
};

export const deleteTask = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = getId(req.params.id);
    await taskService.deleteTask(id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

// ─── Subtasks ──────────────────────────────────────────────
export const createSubtask = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createSubtaskSchema.parse(req.body);
    const subtask = await taskService.createSubtask(data);
    sendSuccess(res, subtask, 'Subtask created successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const listSubtasks = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const taskId = getId(req.params.taskId);
    const subtasks = await taskService.listSubtasksByTask(taskId);
    sendSuccess(res, subtasks);
  } catch (error) {
    next(error);
  }
};

export const updateSubtask = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = getId(req.params.id);
    const data = updateSubtaskSchema.parse({ ...req.body, id });
    const subtask = await taskService.updateSubtask(id, data);
    sendSuccess(res, subtask, 'Subtask updated successfully');
  } catch (error) {
    next(error);
  }
};

export const deleteSubtask = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = getId(req.params.id);
    await taskService.deleteSubtask(id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

// ─── Task Notes ──────────────────────────────────────────────
export const createTaskNote = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createTaskNoteSchema.parse(req.body);
    const note = await taskService.createTaskNote(data);
    sendSuccess(res, note, 'Note added successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const listTaskNotes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const taskId = getId(req.params.taskId);
    const notes = await taskService.listTaskNotes(taskId);
    sendSuccess(res, notes);
  } catch (error) {
    next(error);
  }
};

export const deleteTaskNote = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = getId(req.params.id);
    await taskService.deleteTaskNote(id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

// ─── Reminders ──────────────────────────────────────────────
export const createReminder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = createReminderSchema.parse(req.body);
    const data: CreateReminderInput = {
      task_id: parsed.task_id,
      remind_at: new Date(parsed.remind_at),
    };
    const reminder = await taskService.createReminder(data);
    sendSuccess(res, reminder, 'Reminder created successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const listReminders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const taskId = getId(req.params.taskId);
    const reminders = await taskService.listRemindersForTask(taskId);
    sendSuccess(res, reminders);
  } catch (error) {
    next(error);
  }
};

export const deleteReminder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = getId(req.params.id);
    await taskService.deleteReminder(id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};