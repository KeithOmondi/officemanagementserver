// src/features/projects/projects.controller.ts
import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { AppError, sendSuccess } from '../../utils/response';
import { ProjectService } from './projects.service';
import {
    createProjectSchema,
    updateProjectSchema,
    projectFiltersSchema,
    createTaskSchema,
    updateTaskSchema,
    taskFiltersSchema,
    idParamSchema,
    createSubtaskSchema,
    updateSubtaskSchema,
    createCommentSchema,
    updateCommentSchema,
    uploadFileSchema,
    deleteFileSchema,
    bulkUpdateTaskSchema,
} from './projects.validator';
import type { CreateProjectTaskInput, ProjectTaskFilters, ProjectFilters } from './projects.types';
import { ZodSchema } from 'zod';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const nullToUndefined = <T>(value: T | null | undefined): T | undefined => {
    if (value === null) return undefined;
    return value as T;
};

const getDefaultDeadline = (): string => {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return date.toISOString().split('T')[0];
};

const getParamAsString = (param: string | string[] | undefined): string | undefined => {
    if (!param) return undefined;
    return Array.isArray(param) ? param[0] : param;
};

const validate = <T>(schema: ZodSchema<T>, data: unknown): T => {
    const result = schema.safeParse(data);
    if (!result.success) {
        throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid data');
    }
    return result.data;
};

// ─── Clean filter helpers ──────────────────────────────────────────────────

const cleanProjectFilters = (filters: Record<string, unknown>): ProjectFilters => {
    const result: ProjectFilters = {};
    if (filters.search !== undefined && filters.search !== null) result.search = filters.search as string;
    if (filters.page !== undefined && filters.page !== null) result.page = filters.page as number;
    if (filters.limit !== undefined && filters.limit !== null) result.limit = filters.limit as number;
    if (filters.member_id !== undefined && filters.member_id !== null) result.member_id = filters.member_id as string;
    if (filters.created_by !== undefined && filters.created_by !== null) result.created_by = filters.created_by as string;
    if (filters.is_active !== undefined && filters.is_active !== null) result.is_active = filters.is_active as boolean;
    if (filters.priority !== undefined && filters.priority !== null) result.priority = filters.priority as ProjectFilters['priority'];
    if (filters.deadline_from !== undefined && filters.deadline_from !== null) result.deadline_from = filters.deadline_from as string;
    if (filters.deadline_to !== undefined && filters.deadline_to !== null) result.deadline_to = filters.deadline_to as string;
    return result;
};

const cleanTaskFilters = (filters: Record<string, unknown>): ProjectTaskFilters => {
    const result: ProjectTaskFilters = {};
    if (filters.project_id !== undefined && filters.project_id !== null) result.project_id = filters.project_id as string;
    if (filters.status !== undefined && filters.status !== null) result.status = filters.status as ProjectTaskFilters['status'];
    if (filters.priority !== undefined && filters.priority !== null) result.priority = filters.priority as ProjectTaskFilters['priority'];
    if (filters.type !== undefined && filters.type !== null) result.type = filters.type as string;
    if (filters.assignee !== undefined && filters.assignee !== null) result.assignee = filters.assignee as string;
    if (filters.assigned_to_me !== undefined && filters.assigned_to_me !== null) result.assigned_to_me = filters.assigned_to_me as boolean;
    if (filters.tags !== undefined && filters.tags !== null) result.tags = filters.tags as string;
    if (filters.search !== undefined && filters.search !== null) result.search = filters.search as string;
    if (filters.deadline_from !== undefined && filters.deadline_from !== null) result.deadline_from = filters.deadline_from as string;
    if (filters.deadline_to !== undefined && filters.deadline_to !== null) result.deadline_to = filters.deadline_to as string;
    if (filters.page !== undefined && filters.page !== null) result.page = filters.page as number;
    if (filters.limit !== undefined && filters.limit !== null) result.limit = filters.limit as number;
    if (filters.sort_by !== undefined && filters.sort_by !== null) result.sort_by = filters.sort_by as ProjectTaskFilters['sort_by'];
    if (filters.sort_order !== undefined && filters.sort_order !== null) result.sort_order = filters.sort_order as ProjectTaskFilters['sort_order'];
    return result;
};

// ─── Get user from request ──────────────────────────────────────────────────

const getUser = (req: Request): { id: string; full_name: string } => {
    const user = (req as any).user;
    if (!user) throw new AppError(401, 'User not authenticated');
    return {
        id: user.id,
        full_name: user.full_name || 'System',
    };
};

export const projectController = {

    // ═══════════════════════════════════════════════════════════════════════════
    //  PROJECT CONTROLLERS
    // ═══════════════════════════════════════════════════════════════════════════

    createProject: asyncHandler(async (req: Request, res: Response) => {
        const user = getUser(req);
        const { body } = validate(createProjectSchema, { body: req.body });
        
        const project = await ProjectService.createProject(
            {
                ...body,
                description: nullToUndefined(body.description),
                deadline: nullToUndefined(body.deadline),
                start_date: nullToUndefined(body.start_date),
            },
            user.id,
            user.full_name
        );
        return sendSuccess(res, project, 'Project created successfully', 201);
    }),

    getAllProjects: asyncHandler(async (req: Request, res: Response) => {
        const { query } = validate(projectFiltersSchema, { query: req.query });
        const user = (req as any).user;
        const cleanQuery = cleanProjectFilters(query);
        const result = await ProjectService.findAllProjects(cleanQuery, user?.id);
        return sendSuccess(res, result, 'Projects retrieved successfully');
    }),

    getProjectById: asyncHandler(async (req: Request, res: Response) => {
        const id = getParamAsString(req.params.id);
        if (!id) throw new AppError(400, 'Invalid project ID');
        const project = await ProjectService.findProjectById(id);
        if (!project) throw new AppError(404, 'Project not found');
        return sendSuccess(res, project, 'Project retrieved successfully');
    }),



updateProject: asyncHandler(async (req: Request, res: Response) => {
    const requestId = `upd-proj-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    console.log(`\n🔵 [${requestId}] ═══ UpdateProject START ═══`);
    console.time(`[${requestId}] Total duration`);

    const user = getUser(req);
    console.log(`👤 [${requestId}] Requesting user:`, {
        id: user.id,
        full_name: user.full_name,
    });

    const id = getParamAsString(req.params.id);
    console.log(`🔑 [${requestId}] Project ID param:`, id);

    if (!id) {
        console.error(`❌ [${requestId}] Missing/invalid project ID — aborting`);
        console.timeEnd(`[${requestId}] Total duration`);
        throw new AppError(400, 'Invalid project ID');
    }

    console.log(`📥 [${requestId}] Raw request body:`, JSON.stringify(req.body, null, 2));
    console.log(`📥 [${requestId}] Request query:`, req.query);
    console.log(`📥 [${requestId}] Request headers (relevant):`, {
        'content-type': req.headers['content-type'],
        authorization: req.headers.authorization ? '[present]' : '[absent]',
    });

    // ─── Validation ────────────────────────────────────────────────
    console.log(`🔍 [${requestId}] Validating schema...`);
    console.time(`[${requestId}] Validation duration`);
    let body: any;
    try {
        // FIX: Pass the correct structure - the schema expects { params, body }
        const result = validate(updateProjectSchema, { 
            params: { id }, 
            body: req.body 
        });
        body = result.body;
        console.timeEnd(`[${requestId}] Validation duration`);
        console.log(`✅ [${requestId}] Validation passed. Validated body:`, JSON.stringify(body, null, 2));
    } catch (validationErr) {
        console.timeEnd(`[${requestId}] Validation duration`);
        console.error(`❌ [${requestId}] Validation FAILED:`, validationErr);
        console.timeEnd(`[${requestId}] Total duration`);
        throw validationErr;
    }

    // ─── Prepare update payload ───────────────────────────────────
    const updateData = {
        ...body,
        description: nullToUndefined(body.description),
        deadline: nullToUndefined(body.deadline),
        start_date: nullToUndefined(body.start_date),
    };
    console.log(`🛠️  [${requestId}] Prepared update data:`, JSON.stringify(updateData, null, 2));
    console.log(`🛠️  [${requestId}] Diff — fields present in body but transformed:`, {
        description: { before: body.description, after: updateData.description },
        deadline: { before: body.deadline, after: updateData.deadline },
        start_date: { before: body.start_date, after: updateData.start_date },
    });

    // ─── Service call ──────────────────────────────────────────────
    console.log(`🚀 [${requestId}] Calling ProjectService.updateProject...`);
    console.time(`[${requestId}] Service call duration`);
    let project;
    try {
        project = await ProjectService.updateProject(
            id,
            updateData,
            user.id,
            user.full_name
        );
        console.timeEnd(`[${requestId}] Service call duration`);
        console.log(`✅ [${requestId}] Service returned successfully:`, JSON.stringify(project, null, 2));
    } catch (serviceErr) {
        console.timeEnd(`[${requestId}] Service call duration`);
        console.error(`❌ [${requestId}] Service call FAILED:`, serviceErr);
        console.timeEnd(`[${requestId}] Total duration`);
        throw serviceErr;
    }

    // ─── Response ──────────────────────────────────────────────────
    console.log(`📤 [${requestId}] Sending success response`);
    console.timeEnd(`[${requestId}] Total duration`);
    console.log(`🔵 [${requestId}] ═══ UpdateProject END ═══\n`);

    return sendSuccess(res, project, 'Project updated successfully');
}),

    deleteProject: asyncHandler(async (req: Request, res: Response) => {
        const id = getParamAsString(req.params.id);
        if (!id) throw new AppError(400, 'Invalid project ID');
        await ProjectService.deleteProject(id);
        return sendSuccess(res, null, 'Project deleted successfully');
    }),

    getProjectMembers: asyncHandler(async (req: Request, res: Response) => {
        const id = getParamAsString(req.params.id);
        if (!id) throw new AppError(400, 'Invalid project ID');
        const members = await ProjectService.getProjectMembers(id);
        return sendSuccess(res, members, 'Project members retrieved successfully');
    }),

    addProjectMember: asyncHandler(async (req: Request, res: Response) => {
        const id = getParamAsString(req.params.id);
        if (!id) throw new AppError(400, 'Invalid project ID');
        const { userId } = req.body;
        if (!userId) throw new AppError(400, 'User ID is required');
        await ProjectService.addProjectMember(id, userId);
        return sendSuccess(res, null, 'Member added successfully');
    }),

    removeProjectMember: asyncHandler(async (req: Request, res: Response) => {
        const id = getParamAsString(req.params.id);
        if (!id) throw new AppError(400, 'Invalid project ID');
        const userId = getParamAsString(req.params.userId);
        if (!userId) throw new AppError(400, 'User ID is required');
        await ProjectService.removeProjectMember(id, userId);
        return sendSuccess(res, null, 'Member removed successfully');
    }),

    // ═══════════════════════════════════════════════════════════════════════════
    //  TASK CONTROLLERS
    // ═══════════════════════════════════════════════════════════════════════════

    createTask: asyncHandler(async (req: Request, res: Response) => {
        const user = getUser(req);
        const { body } = validate(createTaskSchema, { body: req.body });
        
        const data: CreateProjectTaskInput = {
            title: body.title,
            project_id: nullToUndefined(body.project_id),
            description: nullToUndefined(body.description),
            status: body.status,
            priority: body.priority,
            type: nullToUndefined(body.type),
            assignee: nullToUndefined(body.assignee),
            deadline: body.deadline || getDefaultDeadline(),
            start_date: nullToUndefined(body.start_date),
            tags: body.tags,
            estimated_hours: nullToUndefined(body.estimated_hours),
            parent_task_id: nullToUndefined(body.parent_task_id),
            visibility: body.visibility,
        };
        
        const task = await ProjectService.createTask(data, user.id, user.full_name);
        return sendSuccess(res, task, 'Task created successfully', 201);
    }),

    getAllTasks: asyncHandler(async (req: Request, res: Response) => {
        const { query } = validate(taskFiltersSchema, { query: req.query });
        const user = (req as any).user;
        const cleanQuery = cleanTaskFilters(query);
        const tasks = await ProjectService.findAllTasks(cleanQuery, user?.id);
        return sendSuccess(res, tasks, 'Tasks retrieved successfully');
    }),

    getTaskById: asyncHandler(async (req: Request, res: Response) => {
        const id = getParamAsString(req.params.id);
        if (!id) throw new AppError(400, 'Invalid task ID');
        const task = await ProjectService.findTaskById(id);
        if (!task) throw new AppError(404, 'Task not found');
        return sendSuccess(res, task, 'Task retrieved successfully');
    }),

updateTask: asyncHandler(async (req: Request, res: Response) => {
    const requestId = `upd-task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    console.log(`\n🟢 [${requestId}] ═══ UpdateTask START ═══`);
    console.time(`[${requestId}] Total duration`);

    const user = getUser(req);
    console.log(`👤 [${requestId}] Requesting user:`, {
        id: user.id,
        full_name: user.full_name,
    });

    const id = getParamAsString(req.params.id);
    console.log(`🔑 [${requestId}] Task ID param:`, id);

    if (!id) {
        console.error(`❌ [${requestId}] Missing/invalid task ID — aborting`);
        console.timeEnd(`[${requestId}] Total duration`);
        throw new AppError(400, 'Invalid task ID');
    }

    console.log(`📥 [${requestId}] Raw request body:`, JSON.stringify(req.body, null, 2));

    // ─── Validation ────────────────────────────────────────────────
    console.log(`🔍 [${requestId}] Validating schema...`);
    console.time(`[${requestId}] Validation duration`);
    let body: any;
    try {
        // FIX: schema requires both params and body — pass params: { id }
        const result = validate(updateTaskSchema, {
            params: { id },
            body: req.body,
        });
        body = result.body;
        console.timeEnd(`[${requestId}] Validation duration`);
        console.log(`✅ [${requestId}] Validation passed. Validated body:`, JSON.stringify(body, null, 2));
    } catch (validationErr) {
        console.timeEnd(`[${requestId}] Validation duration`);
        console.error(`❌ [${requestId}] Validation FAILED:`, validationErr);
        console.timeEnd(`[${requestId}] Total duration`);
        throw validationErr;
    }

    // ─── Prepare update payload ───────────────────────────────────
    const updateData = {
        ...body,
        project_id: nullToUndefined(body.project_id),
        description: nullToUndefined(body.description),
        assignee: nullToUndefined(body.assignee),
        deadline: nullToUndefined(body.deadline),
        start_date: nullToUndefined(body.start_date),
        estimated_hours: nullToUndefined(body.estimated_hours),
        actual_hours: nullToUndefined(body.actual_hours),
        parent_task_id: nullToUndefined(body.parent_task_id),
        type: nullToUndefined(body.type),
        completed_at: nullToUndefined(body.completed_at),
    };
    console.log(`🛠️  [${requestId}] Prepared update data:`, JSON.stringify(updateData, null, 2));
    console.log(`🛠️  [${requestId}] Diff — fields transformed via nullToUndefined:`, {
        project_id: { before: body.project_id, after: updateData.project_id },
        description: { before: body.description, after: updateData.description },
        assignee: { before: body.assignee, after: updateData.assignee },
        deadline: { before: body.deadline, after: updateData.deadline },
        start_date: { before: body.start_date, after: updateData.start_date },
        estimated_hours: { before: body.estimated_hours, after: updateData.estimated_hours },
        actual_hours: { before: body.actual_hours, after: updateData.actual_hours },
        parent_task_id: { before: body.parent_task_id, after: updateData.parent_task_id },
        type: { before: body.type, after: updateData.type },
        completed_at: { before: body.completed_at, after: updateData.completed_at },
    });

    // ─── Service call ──────────────────────────────────────────────
    console.log(`🚀 [${requestId}] Calling ProjectService.updateTask...`);
    console.time(`[${requestId}] Service call duration`);
    let task;
    try {
        task = await ProjectService.updateTask(
            id,
            updateData,
            user.id,
            user.full_name
        );
        console.timeEnd(`[${requestId}] Service call duration`);
        console.log(`✅ [${requestId}] Service returned successfully:`, JSON.stringify(task, null, 2));
    } catch (serviceErr) {
        console.timeEnd(`[${requestId}] Service call duration`);
        console.error(`❌ [${requestId}] Service call FAILED:`, serviceErr);
        console.timeEnd(`[${requestId}] Total duration`);
        throw serviceErr;
    }

    // ─── Response ──────────────────────────────────────────────────
    console.log(`📤 [${requestId}] Sending success response`);
    console.timeEnd(`[${requestId}] Total duration`);
    console.log(`🟢 [${requestId}] ═══ UpdateTask END ═══\n`);

    return sendSuccess(res, task, 'Task updated successfully');
}),

    deleteTask: asyncHandler(async (req: Request, res: Response) => {
        const id = getParamAsString(req.params.id);
        if (!id) throw new AppError(400, 'Invalid task ID');
        await ProjectService.deleteTask(id);
        return sendSuccess(res, null, 'Task deleted successfully');
    }),

    getTaskStats: asyncHandler(async (req: Request, res: Response) => {
        const projectId = getParamAsString(req.query.projectId as string | string[] | undefined);
        const stats = await ProjectService.getTaskStats(projectId);
        return sendSuccess(res, stats, 'Task stats retrieved successfully');
    }),

    bulkUpdateTasks: asyncHandler(async (req: Request, res: Response) => {
        const user = getUser(req);
        const { body } = validate(bulkUpdateTaskSchema, { body: req.body });
        await ProjectService.bulkUpdateTasks(body.updates, user.id, user.full_name);
        return sendSuccess(res, null, 'Tasks updated successfully');
    }),

    getTasksByAssignee: asyncHandler(async (req: Request, res: Response) => {
        const assigneeId = getParamAsString(req.query.assigneeId as string | string[] | undefined);
        const projectId = getParamAsString(req.query.projectId as string | string[] | undefined);
        if (!assigneeId) throw new AppError(400, 'Assignee ID is required');
        const tasks = await ProjectService.getTasksByAssignee(assigneeId, projectId);
        return sendSuccess(res, tasks, 'Tasks retrieved successfully');
    }),

    getTasksByStatus: asyncHandler(async (req: Request, res: Response) => {
        const projectId = getParamAsString(req.query.projectId as string | string[] | undefined);
        const status = getParamAsString(req.query.status as string | string[] | undefined);
        if (!projectId) throw new AppError(400, 'Project ID is required');
        if (!status) throw new AppError(400, 'Status is required');
        const tasks = await ProjectService.getTasksByStatus(projectId, status);
        return sendSuccess(res, tasks, 'Tasks retrieved successfully');
    }),

    getOverdueTasks: asyncHandler(async (req: Request, res: Response) => {
        const user = (req as any).user;
        const projectId = getParamAsString(req.query.projectId as string | string[] | undefined);
        const tasks = await ProjectService.getOverdueTasks(projectId, user?.id);
        return sendSuccess(res, tasks, 'Overdue tasks retrieved successfully');
    }),

    // ═══════════════════════════════════════════════════════════════════════════
    //  SUBTASK CONTROLLERS
    // ═══════════════════════════════════════════════════════════════════════════

    createSubtask: asyncHandler(async (req: Request, res: Response) => {
        const taskId = getParamAsString(req.params.taskId);
        if (!taskId) throw new AppError(400, 'Invalid task ID');
        const { body } = validate(createSubtaskSchema, { body: req.body });
        const subtask = await ProjectService.createSubtask(taskId, {
            title: body.title,
            description: nullToUndefined(body.description),
            assigned_to: nullToUndefined(body.assigned_to),
        });
        return sendSuccess(res, subtask, 'Subtask created successfully', 201);
    }),

    updateSubtask: asyncHandler(async (req: Request, res: Response) => {
        const taskId = getParamAsString(req.params.taskId);
        const subtaskId = getParamAsString(req.params.subtaskId);
        if (!taskId) throw new AppError(400, 'Invalid task ID');
        if (!subtaskId) throw new AppError(400, 'Invalid subtask ID');
        const { body } = validate(updateSubtaskSchema, { body: req.body });
        const subtask = await ProjectService.updateSubtask(taskId, subtaskId, body);
        return sendSuccess(res, subtask, 'Subtask updated successfully');
    }),

    deleteSubtask: asyncHandler(async (req: Request, res: Response) => {
        const taskId = getParamAsString(req.params.taskId);
        const subtaskId = getParamAsString(req.params.subtaskId);
        if (!taskId) throw new AppError(400, 'Invalid task ID');
        if (!subtaskId) throw new AppError(400, 'Invalid subtask ID');
        await ProjectService.deleteSubtask(taskId, subtaskId);
        return sendSuccess(res, null, 'Subtask deleted successfully');
    }),

    // ═══════════════════════════════════════════════════════════════════════════
    //  COMMENT CONTROLLERS
    // ═══════════════════════════════════════════════════════════════════════════

    createComment: asyncHandler(async (req: Request, res: Response) => {
        const user = getUser(req);
        const taskId = getParamAsString(req.params.taskId);
        if (!taskId) throw new AppError(400, 'Invalid task ID');
        const { body } = validate(createCommentSchema, { body: req.body });
        const comment = await ProjectService.createComment(taskId, body, user.id);
        return sendSuccess(res, comment, 'Comment added successfully', 201);
    }),

    updateComment: asyncHandler(async (req: Request, res: Response) => {
        const taskId = getParamAsString(req.params.taskId);
        const commentId = getParamAsString(req.params.commentId);
        if (!taskId) throw new AppError(400, 'Invalid task ID');
        if (!commentId) throw new AppError(400, 'Invalid comment ID');
        const { body } = validate(updateCommentSchema, { body: req.body });
        const comment = await ProjectService.updateComment(taskId, commentId, body);
        return sendSuccess(res, comment, 'Comment updated successfully');
    }),

    deleteComment: asyncHandler(async (req: Request, res: Response) => {
        const taskId = getParamAsString(req.params.taskId);
        const commentId = getParamAsString(req.params.commentId);
        if (!taskId) throw new AppError(400, 'Invalid task ID');
        if (!commentId) throw new AppError(400, 'Invalid comment ID');
        await ProjectService.deleteComment(taskId, commentId);
        return sendSuccess(res, null, 'Comment deleted successfully');
    }),

    // ═══════════════════════════════════════════════════════════════════════════
    //  FILE/ATTACHMENT CONTROLLERS
    // ═══════════════════════════════════════════════════════════════════════════

    uploadFile: asyncHandler(async (req: Request, res: Response) => {
        const file = (req as any).file;
        if (!file) throw new AppError(400, 'No file uploaded');
        const taskId = getParamAsString(req.params.taskId);
        if (!taskId) throw new AppError(400, 'Invalid task ID');
        // TODO: Upload to Cloudinary and save to database
        return sendSuccess(res, { message: 'File uploaded successfully' }, 'File uploaded successfully');
    }),

    deleteFile: asyncHandler(async (req: Request, res: Response) => {
        const fileId = getParamAsString(req.params.fileId);
        if (!fileId) throw new AppError(400, 'Invalid file ID');
        // TODO: Delete from Cloudinary and database
        return sendSuccess(res, null, 'File deleted successfully');
    }),
};