import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { AppError, sendSuccess } from '../../utils/response';
import { TaskService } from './task.service';
import {
  createProjectSchema,
  updateProjectSchema,
  createTaskSchema,
  updateTaskSchema,
  addProjectMemberSchema,
  projectIdSchema,
  taskIdSchema,
  memberIdSchema,
  addAttachmentSchema,
  attachmentIdSchema,
} from './task.validator';

export const taskController = {

  // ── Statistics ──────────────────────────────────────────────────────────
  getStats: asyncHandler(async (req: Request, res: Response) => {
    const [taskStats, projectStats] = await Promise.all([
      TaskService.getTaskStats(req.user!.id),
      TaskService.getProjectStats(req.user!.id),
    ]);
    return sendSuccess(res, { tasks: taskStats, projects: projectStats }, 'Statistics retrieved');
  }),

  // ── Projects ─────────────────────────────────────────────────────────────
  getAllProjects: asyncHandler(async (req: Request, res: Response) => {
    const projects = await TaskService.findAllProjects(req.user!.id);
    return sendSuccess(res, projects, 'Projects retrieved');
  }),

  getProjectById: asyncHandler(async (req: Request, res: Response) => {
    const result = projectIdSchema.safeParse({ params: req.params });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
    const project = await TaskService.findProjectById(result.data.params.id, req.user!.id);
    if (!project) throw new AppError(404, 'Project not found');
    project.members = await TaskService.getProjectMembers(result.data.params.id);
    return sendSuccess(res, project, 'Project retrieved');
  }),

  getProjectMembers: asyncHandler(async (req: Request, res: Response) => {
    const result = projectIdSchema.safeParse({ params: req.params });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
    const project = await TaskService.findProjectById(result.data.params.id, req.user!.id);
    if (!project) throw new AppError(404, 'Project not found');
    const members = await TaskService.getProjectMembers(result.data.params.id);
    return sendSuccess(res, members, 'Project members retrieved');
  }),

  createProject: asyncHandler(async (req: Request, res: Response) => {
    const result = createProjectSchema.safeParse({ body: req.body });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid data');
    const project = await TaskService.createProject(result.data.body, req.user!.id);
    return sendSuccess(res, project, 'Project created', 201);
  }),

  updateProject: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = projectIdSchema.safeParse({ params: req.params });
    if (!paramsResult.success) throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
    const bodyResult = updateProjectSchema.safeParse({ body: req.body });
    if (!bodyResult.success) throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid data');
    const project = await TaskService.updateProject(
      paramsResult.data.params.id,
      bodyResult.data.body,
      req.user!.id
    );
    return sendSuccess(res, project, 'Project updated');
  }),

  deleteProject: asyncHandler(async (req: Request, res: Response) => {
    const result = projectIdSchema.safeParse({ params: req.params });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
    await TaskService.deleteProject(result.data.params.id, req.user!.id);
    return sendSuccess(res, null, 'Project deleted');
  }),

  // ── Project Members ──────────────────────────────────────────────────────
  addProjectMember: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = projectIdSchema.safeParse({ params: req.params });
    if (!paramsResult.success) throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
    const bodyResult = addProjectMemberSchema.safeParse({ body: req.body });
    if (!bodyResult.success) throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid data');
    const member = await TaskService.addProjectMember(
      paramsResult.data.params.id,
      bodyResult.data.body,
      req.user!.id
    );
    return sendSuccess(res, member, 'Member added to project', 201);
  }),

  removeProjectMember: asyncHandler(async (req: Request, res: Response) => {
    const result = memberIdSchema.safeParse({ params: req.params });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
    await TaskService.removeProjectMember(
      result.data.params.projectId,
      result.data.params.memberId,
      req.user!.id
    );
    return sendSuccess(res, null, 'Member removed from project');
  }),

  // ── Tasks ─────────────────────────────────────────────────────────────────
  getAllTasks: asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.query.projectId as string | undefined;
    const tasks = await TaskService.findAllTasks(req.user!.id, projectId);
    return sendSuccess(res, tasks, 'Tasks retrieved');
  }),

  getStandaloneTasks: asyncHandler(async (req: Request, res: Response) => {
    const tasks = await TaskService.findStandaloneTasks(req.user!.id);
    return sendSuccess(res, tasks, 'Standalone tasks retrieved');
  }),

  getTaskById: asyncHandler(async (req: Request, res: Response) => {
    const result = taskIdSchema.safeParse({ params: req.params });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
    const task = await TaskService.findTaskById(result.data.params.id, req.user!.id);
    if (!task) throw new AppError(404, 'Task not found');
    return sendSuccess(res, task, 'Task retrieved');
  }),

  createTask: asyncHandler(async (req: Request, res: Response) => {
    const result = createTaskSchema.safeParse({ body: req.body });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid data');
    const task = await TaskService.createTask(result.data.body, req.user!.id);
    return sendSuccess(res, task, 'Task created', 201);
  }),

  updateTask: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = taskIdSchema.safeParse({ params: req.params });
    if (!paramsResult.success) throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
    const bodyResult = updateTaskSchema.safeParse({ body: req.body });
    if (!bodyResult.success) throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid data');
    const task = await TaskService.updateTask(
      paramsResult.data.params.id,
      bodyResult.data.body,
      req.user!.id
    );
    return sendSuccess(res, task, 'Task updated');
  }),

  deleteTask: asyncHandler(async (req: Request, res: Response) => {
    const result = taskIdSchema.safeParse({ params: req.params });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
    await TaskService.deleteTask(result.data.params.id, req.user!.id);
    return sendSuccess(res, null, 'Task deleted');
  }),

  // ── Attachments ──────────────────────────────────────────────────────────
  getAttachments: asyncHandler(async (req: Request, res: Response) => {
    const result = taskIdSchema.safeParse({ params: req.params });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
    const attachments = await TaskService.getAttachments(
      result.data.params.id,
      req.user!.id
    );
    return sendSuccess(res, attachments, 'Attachments retrieved');
  }),

  addAttachment: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = taskIdSchema.safeParse({ params: req.params });
    if (!paramsResult.success) throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
    const bodyResult = addAttachmentSchema.safeParse({ body: req.body });
    if (!bodyResult.success) throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid data');
    const attachment = await TaskService.addAttachment(
      paramsResult.data.params.id,
      bodyResult.data.body,
      req.user!.id
    );
    return sendSuccess(res, attachment, 'Attachment added', 201);
  }),

  deleteAttachment: asyncHandler(async (req: Request, res: Response) => {
    const result = attachmentIdSchema.safeParse({ params: req.params });
    if (!result.success) throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
    await TaskService.removeAttachment(result.data.params.attachmentId, req.user!.id);
    return sendSuccess(res, null, 'Attachment deleted');
  }),
};