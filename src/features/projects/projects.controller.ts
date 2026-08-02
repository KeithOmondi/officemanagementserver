// src/features/projects/projects.controller.ts
import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { AppError, sendSuccess } from '../../utils/response';
import { ProjectService } from './projects.service';
import {
    createProjectSchema,
    updateProjectSchema,
    createTaskSchema,
    updateTaskSchema,
    taskFiltersSchema,
    idParamSchema,
    createSubtaskSchema,
    updateSubtaskSchema,
    createCommentSchema,
    updateCommentSchema,
    checklistFiltersSchema,
    updateChecklistStatusSchema,
    bulkUpdateChecklistSchema,
    reorderChecklistSchema,
    taskBySerialNumberSchema,
} from './projects.validator';
import type { CreateProjectTaskInput, ChecklistStatus } from './projects.types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getParamAsString = (param: string | string[] | undefined): string | undefined => {
    if (!param) return undefined;
    return Array.isArray(param) ? param[0] : param;
};

const nullToUndefined = <T>(value: T | null | undefined): T | undefined => {
    if (value === null) return undefined;
    return value as T;
};

const getDefaultDeadline = (): string => {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return date.toISOString().split('T')[0];
};

export const projectController = {

    // ═══════════════════════════════════════════════════════════════════════════
    //  PROJECT CONTROLLERS
    // ═══════════════════════════════════════════════════════════════════════════

    createProject: asyncHandler(async (req: Request, res: Response) => {
        const result = createProjectSchema.safeParse({ body: req.body });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid project data');
        }
        
        const data = {
            ...result.data.body,
            description: nullToUndefined(result.data.body.description),
            deadline: nullToUndefined(result.data.body.deadline),
        };
        
        const project = await ProjectService.createProject(
            data,
            req.user!.id,
            req.user!.full_name
        );
        return sendSuccess(res, project, 'Project created successfully', 201);
    }),

    getAllProjects: asyncHandler(async (req: Request, res: Response) => {
        const { search, page, limit } = req.query;
        const result = await ProjectService.findAllProjects(
            {
                search: search as string,
                page: page ? parseInt(page as string) : undefined,
                limit: limit ? parseInt(limit as string) : undefined,
            },
            req.user?.id
        );
        return sendSuccess(res, result, 'Projects retrieved successfully');
    }),

    getProjectById: asyncHandler(async (req: Request, res: Response) => {
        const result = idParamSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid project ID');
        }
        const project = await ProjectService.findProjectById(result.data.params.id);
        if (!project) throw new AppError(404, 'Project not found');
        return sendSuccess(res, project, 'Project retrieved successfully');
    }),

    updateProject: asyncHandler(async (req: Request, res: Response) => {
        const result = updateProjectSchema.safeParse({ params: req.params, body: req.body });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid update data');
        }
        const project = await ProjectService.updateProject(
            result.data.params.id,
            result.data.body
        );
        return sendSuccess(res, project, 'Project updated successfully');
    }),

    deleteProject: asyncHandler(async (req: Request, res: Response) => {
        const result = idParamSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid project ID');
        }
        await ProjectService.deleteProject(result.data.params.id);
        return sendSuccess(res, null, 'Project deleted successfully');
    }),

    getProjectMembers: asyncHandler(async (req: Request, res: Response) => {
        const result = idParamSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid project ID');
        }
        const members = await ProjectService.getProjectMembers(result.data.params.id);
        return sendSuccess(res, members, 'Project members retrieved successfully');
    }),

    addProjectMember: asyncHandler(async (req: Request, res: Response) => {
        const paramsResult = idParamSchema.safeParse({ params: req.params });
        if (!paramsResult.success) {
            throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid project ID');
        }
        const { userId } = req.body;
        if (!userId) throw new AppError(400, 'User ID is required');
        await ProjectService.addProjectMember(paramsResult.data.params.id, userId);
        return sendSuccess(res, null, 'Member added successfully');
    }),

    removeProjectMember: asyncHandler(async (req: Request, res: Response) => {
        const paramsResult = idParamSchema.safeParse({ params: req.params });
        if (!paramsResult.success) {
            throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid project ID');
        }
        const userId = getParamAsString(req.params.userId);
        if (!userId) throw new AppError(400, 'User ID is required');
        await ProjectService.removeProjectMember(paramsResult.data.params.id, userId);
        return sendSuccess(res, null, 'Member removed successfully');
    }),

    // ═══════════════════════════════════════════════════════════════════════════
    //  TASK CONTROLLERS
    // ═══════════════════════════════════════════════════════════════════════════

    createTask: asyncHandler(async (req: Request, res: Response) => {
        const result = createTaskSchema.safeParse({ body: req.body });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid task data');
        }
        
        const data: CreateProjectTaskInput = {
            title: result.data.body.title,
            project_id: nullToUndefined(result.data.body.project_id),
            description: nullToUndefined(result.data.body.description),
            status: result.data.body.status,
            priority: result.data.body.priority,
            type: nullToUndefined(result.data.body.type), // ✅ Convert null to undefined
            assignee: nullToUndefined(result.data.body.assignee),
            deadline: result.data.body.deadline || getDefaultDeadline(),
            start_date: nullToUndefined(result.data.body.start_date),
            tags: result.data.body.tags,
            estimated_hours: nullToUndefined(result.data.body.estimated_hours),
            parent_task_id: nullToUndefined(result.data.body.parent_task_id),
            visibility: result.data.body.visibility,
            // Checklist fields
            checklist_status: nullToUndefined(result.data.body.checklist_status),
            next_steps: nullToUndefined(result.data.body.next_steps),
            team_lead: nullToUndefined(result.data.body.team_lead),
            serial_number: nullToUndefined(result.data.body.serial_number),
            category: nullToUndefined(result.data.body.category),
        };
        
        const task = await ProjectService.createTask(
            data,
            req.user!.id,
            req.user!.full_name
        );
        return sendSuccess(res, task, 'Task created successfully', 201);
    }),

    getAllTasks: asyncHandler(async (req: Request, res: Response) => {
        const result = taskFiltersSchema.safeParse({ query: req.query });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid filters');
        }
        const tasks = await ProjectService.findAllTasks(result.data.query, req.user?.id);
        return sendSuccess(res, tasks, 'Tasks retrieved successfully');
    }),

    getTaskById: asyncHandler(async (req: Request, res: Response) => {
        const result = idParamSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid task ID');
        }
        const task = await ProjectService.findTaskById(result.data.params.id);
        if (!task) throw new AppError(404, 'Task not found');
        return sendSuccess(res, task, 'Task retrieved successfully');
    }),

    updateTask: asyncHandler(async (req: Request, res: Response) => {
        const result = updateTaskSchema.safeParse({ params: req.params, body: req.body });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid update data');
        }
        
        // Convert null to undefined for all fields
        const body = {
            ...result.data.body,
            type: nullToUndefined(result.data.body.type),
            project_id: nullToUndefined(result.data.body.project_id),
            description: nullToUndefined(result.data.body.description),
            assignee: nullToUndefined(result.data.body.assignee),
            deadline: nullToUndefined(result.data.body.deadline),
            start_date: nullToUndefined(result.data.body.start_date),
            estimated_hours: nullToUndefined(result.data.body.estimated_hours),
            actual_hours: nullToUndefined(result.data.body.actual_hours),
            parent_task_id: nullToUndefined(result.data.body.parent_task_id),
            checklist_status: nullToUndefined(result.data.body.checklist_status),
            next_steps: nullToUndefined(result.data.body.next_steps),
            team_lead: nullToUndefined(result.data.body.team_lead),
            serial_number: nullToUndefined(result.data.body.serial_number),
            category: nullToUndefined(result.data.body.category),
        };
        
        const task = await ProjectService.updateTask(
            result.data.params.id,
            body
        );
        return sendSuccess(res, task, 'Task updated successfully');
    }),

    deleteTask: asyncHandler(async (req: Request, res: Response) => {
        const result = idParamSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid task ID');
        }
        await ProjectService.deleteTask(result.data.params.id);
        return sendSuccess(res, null, 'Task deleted successfully');
    }),

    getTaskStats: asyncHandler(async (req: Request, res: Response) => {
        const { projectId } = req.query;
        const stats = await ProjectService.getTaskStats(projectId as string);
        return sendSuccess(res, stats, 'Task stats retrieved successfully');
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
        
        const data = {
            title: bodyResult.data.title,
            description: nullToUndefined(bodyResult.data.description),
            assigned_to: nullToUndefined(bodyResult.data.assigned_to),
        };
        
        const subtask = await ProjectService.createSubtask(
            paramsResult.data.taskId,
            data
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
        const subtask = await ProjectService.updateSubtask(
            paramsResult.data.taskId,
            paramsResult.data.subtaskId,
            bodyResult.data
        );
        return sendSuccess(res, subtask, 'Subtask updated successfully');
    }),

    deleteSubtask: asyncHandler(async (req: Request, res: Response) => {
        const paramsResult = updateSubtaskSchema.shape.params.safeParse(req.params);
        if (!paramsResult.success) {
            throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid IDs');
        }
        await ProjectService.deleteSubtask(
            paramsResult.data.taskId,
            paramsResult.data.subtaskId
        );
        return sendSuccess(res, null, 'Subtask deleted successfully');
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
        const comment = await ProjectService.createComment(
            paramsResult.data.taskId,
            bodyResult.data,
            req.user!.id
        );
        return sendSuccess(res, comment, 'Comment added successfully', 201);
    }),

    updateComment: asyncHandler(async (req: Request, res: Response) => {
        const paramsResult = updateCommentSchema.shape.params.safeParse(req.params);
        if (!paramsResult.success) {
            throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid IDs');
        }
        const bodyResult = updateCommentSchema.shape.body.safeParse(req.body);
        if (!bodyResult.success) {
            throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid comment data');
        }
        const comment = await ProjectService.updateComment(
            paramsResult.data.taskId,
            paramsResult.data.commentId,
            bodyResult.data
        );
        return sendSuccess(res, comment, 'Comment updated successfully');
    }),

    deleteComment: asyncHandler(async (req: Request, res: Response) => {
        const paramsResult = updateCommentSchema.shape.params.safeParse(req.params);
        if (!paramsResult.success) {
            throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid IDs');
        }
        await ProjectService.deleteComment(
            paramsResult.data.taskId,
            paramsResult.data.commentId
        );
        return sendSuccess(res, null, 'Comment deleted successfully');
    }),

    // ═══════════════════════════════════════════════════════════════════════════
    //  CHECKLIST-SPECIFIC CONTROLLERS
    // ═══════════════════════════════════════════════════════════════════════════

    getChecklistStats: asyncHandler(async (req: Request, res: Response) => {
        const { projectId, category } = req.query;
        const stats = await ProjectService.getChecklistStats(
            projectId as string,
            category as string
        );
        return sendSuccess(res, stats, 'Checklist stats retrieved successfully');
    }),

    getChecklistTasks: asyncHandler(async (req: Request, res: Response) => {
        const result = checklistFiltersSchema.safeParse({ query: req.query });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid filters');
        }
        
        const { projectId } = req.query;
        const tasks = await ProjectService.getChecklistTasks({
            project_id: projectId as string,
            category: result.data.query.category,
            checklist_status: result.data.query.status as ChecklistStatus,
            team_lead: result.data.query.team_lead,
            search: result.data.query.search,
            page: result.data.query.page,
            limit: result.data.query.limit,
        });
        return sendSuccess(res, tasks, 'Checklist tasks retrieved successfully');
    }),

    updateChecklistStatus: asyncHandler(async (req: Request, res: Response) => {
        const paramsResult = updateChecklistStatusSchema.shape.params.safeParse(req.params);
        if (!paramsResult.success) {
            throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid task ID');
        }
        const bodyResult = updateChecklistStatusSchema.shape.body.safeParse(req.body);
        if (!bodyResult.success) {
            throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid checklist data');
        }
        
        const task = await ProjectService.updateChecklistStatus(
            paramsResult.data.taskId,
            {
                checklist_status: bodyResult.data.checklist_status,
                next_steps: nullToUndefined(bodyResult.data.next_steps),
                team_lead: nullToUndefined(bodyResult.data.team_lead),
            }
        );
        return sendSuccess(res, task, 'Checklist status updated successfully');
    }),

    bulkUpdateChecklist: asyncHandler(async (req: Request, res: Response) => {
        const result = bulkUpdateChecklistSchema.safeParse({ body: req.body });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid bulk update data');
        }
        
        await ProjectService.bulkUpdateChecklist(result.data.body.tasks);
        return sendSuccess(res, null, 'Checklist items updated successfully');
    }),

    reorderChecklist: asyncHandler(async (req: Request, res: Response) => {
        const result = reorderChecklistSchema.safeParse({ body: req.body });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid reorder data');
        }
        
        await ProjectService.reorderChecklist(
            result.data.body.tasks,
            result.data.body.category
        );
        return sendSuccess(res, null, 'Checklist reordered successfully');
    }),

    getChecklistCategories: asyncHandler(async (req: Request, res: Response) => {
        const { projectId } = req.query;
        const categories = await ProjectService.getChecklistCategories(projectId as string);
        return sendSuccess(res, categories, 'Checklist categories retrieved successfully');
    }),

    getTaskBySerialNumber: asyncHandler(async (req: Request, res: Response) => {
        const result = taskBySerialNumberSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid parameters');
        }
        
        const task = await ProjectService.getTaskBySerialNumber(
            result.data.params.projectId,
            parseInt(result.data.params.serialNumber, 10)
        );
        
        if (!task) throw new AppError(404, 'Task not found');
        return sendSuccess(res, task, 'Task retrieved successfully');
    }),
};