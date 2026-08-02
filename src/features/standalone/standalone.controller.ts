// src/features/standalone/standalone.controller.ts
import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { AppError, sendSuccess } from '../../utils/response';
import { StandaloneTaskService } from './standalone.service';
import {
    createStandaloneTaskSchema,
    updateStandaloneTaskSchema,
    standaloneTaskFiltersSchema,
    idParamSchema,
    createStandaloneSubtaskSchema,
    updateStandaloneSubtaskSchema,
    createStandaloneCommentSchema,
    updateStandaloneCommentSchema,
    createStandaloneAttachmentSchema,
    deleteStandaloneAttachmentSchema,
    updateTaskStatusSchema,
    generateRecurringTasksSchema,
} from './standalone.validator';
import type { CreateStandaloneTaskInput } from './standalone.types';
import { uploadToCloudinary, deleteFromCloudinary } from '../../config/cloudinary';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const nullToUndefined = <T>(value: T | null | undefined): T | undefined => {
    if (value === null) return undefined;
    return value as T;
};

// ─── Controllers ─────────────────────────────────────────────────────────────

export const standaloneTaskController = {

    // ═══════════════════════════════════════════════════════════════════════════
    //  TASK CONTROLLERS
    // ═══════════════════════════════════════════════════════════════════════════

    createTask: asyncHandler(async (req: Request, res: Response) => {
        // Only super_admin can create standalone tasks
        if (req.user?.role !== 'super_admin') {
            throw new AppError(403, 'Only super administrators can create standalone tasks');
        }

        const result = createStandaloneTaskSchema.safeParse({ body: req.body });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid task data');
        }

        const data: CreateStandaloneTaskInput = {
            title: result.data.body.title,
            description: nullToUndefined(result.data.body.description),
            status: result.data.body.status,
            priority: result.data.body.priority,
            assigned_to: nullToUndefined(result.data.body.assigned_to),
            assigned_to_team: nullToUndefined(result.data.body.assigned_to_team),
            start_date: nullToUndefined(result.data.body.start_date),
            end_date: result.data.body.end_date,
            estimated_hours: nullToUndefined(result.data.body.estimated_hours),
            is_recurring: result.data.body.is_recurring,
            recurrence_type: result.data.body.recurrence_type,
            recurrence_end_date: nullToUndefined(result.data.body.recurrence_end_date),
        };

        const task = await StandaloneTaskService.createTask(
            data,
            req.user!.id,
            req.user!.full_name
        );
        return sendSuccess(res, task, 'Standalone task created successfully', 201);
    }),

    getAllTasks: asyncHandler(async (req: Request, res: Response) => {
        const result = standaloneTaskFiltersSchema.safeParse({ query: req.query });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid filters');
        }

        const tasks = await StandaloneTaskService.findAllTasks(
            result.data.query,
            req.user?.id,
            req.user?.role
        );
        return sendSuccess(res, tasks, 'Standalone tasks retrieved successfully');
    }),

    getTaskById: asyncHandler(async (req: Request, res: Response) => {
        const result = idParamSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid task ID');
        }

        // Check permission - users can only view tasks they have access to
        const canView = await StandaloneTaskService.canViewTask(
            result.data.params.id,
            req.user!.id,
            req.user!.role
        );
        if (!canView) {
            throw new AppError(403, 'You do not have permission to view this task');
        }

        const task = await StandaloneTaskService.findTaskById(result.data.params.id);
        if (!task) throw new AppError(404, 'Task not found');
        return sendSuccess(res, task, 'Task retrieved successfully');
    }),

    updateTask: asyncHandler(async (req: Request, res: Response) => {
        const result = updateStandaloneTaskSchema.safeParse({ params: req.params, body: req.body });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid update data');
        }

        const taskId = result.data.params.id;
        const userRole = req.user!.role;
        const userId = req.user!.id;

        // Check permission - super_admin or creator can edit
        const canEdit = await StandaloneTaskService.canEditTask(taskId, userId, userRole);
        if (!canEdit) {
            throw new AppError(403, 'You do not have permission to edit this task');
        }

        const task = await StandaloneTaskService.updateTask(
            taskId,
            result.data.body,
            userId,
            req.user!.full_name
        );
        return sendSuccess(res, task, 'Task updated successfully');
    }),

    deleteTask: asyncHandler(async (req: Request, res: Response) => {
        // Only super_admin can delete
        if (req.user?.role !== 'super_admin') {
            throw new AppError(403, 'Only super administrators can delete tasks');
        }

        const result = idParamSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid task ID');
        }

        // Get task to delete attachments from Cloudinary
        const task = await StandaloneTaskService.findTaskById(result.data.params.id);
        if (task && task.attachments) {
            // Delete all attachments from Cloudinary
            for (const attachment of task.attachments) {
                try {
                    // Extract public ID from URL
                    const publicId = attachment.file_url.split('/').pop()?.split('.')[0];
                    if (publicId) {
                        await deleteFromCloudinary(`standalone/${publicId}`);
                    }
                } catch (error) {
                    console.error('Failed to delete attachment from Cloudinary:', error);
                }
            }
        }

        await StandaloneTaskService.deleteTask(
            result.data.params.id,
            req.user!.id,
            req.user!.full_name
        );
        return sendSuccess(res, null, 'Task deleted successfully');
    }),

    updateTaskStatus: asyncHandler(async (req: Request, res: Response) => {
        const result = updateTaskStatusSchema.safeParse({ params: req.params, body: req.body });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid status data');
        }

        const taskId = result.data.params.id;
        const newStatus = result.data.body.status;
        const userId = req.user!.id;
        const userRole = req.user!.role;

        // If marking as complete, check if user has permission
        if (newStatus === 'complete') {
            const canComplete = await StandaloneTaskService.canCompleteTask(taskId, userId, userRole);
            if (!canComplete) {
                throw new AppError(403, 'Only the assignee, creator, or super administrator can mark this task as complete');
            }
        }

        // For 'in_progress' status, any user with view permission can start it
        if (newStatus === 'in_progress') {
            const canView = await StandaloneTaskService.canViewTask(taskId, userId, userRole);
            if (!canView) {
                throw new AppError(403, 'You do not have permission to update this task');
            }
        }

        const task = await StandaloneTaskService.updateTaskStatus(
            taskId,
            newStatus,
            userId,
            req.user!.full_name
        );
        return sendSuccess(res, task, 'Task status updated successfully');
    }),

    archiveTask: asyncHandler(async (req: Request, res: Response) => {
        const result = idParamSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid task ID');
        }

        const taskId = result.data.params.id;
        const userId = req.user!.id;
        const userRole = req.user!.role;

        // Super_admin, assignee, or creator can archive
        const task = await StandaloneTaskService.findTaskById(taskId);
        if (!task) throw new AppError(404, 'Task not found');

        const canArchive = userRole === 'super_admin' || 
                          task.assigned_to === userId || 
                          task.created_by === userId;

        if (!canArchive) {
            throw new AppError(403, 'You do not have permission to archive this task');
        }

        const archivedTask = await StandaloneTaskService.archiveTask(
            taskId,
            userId,
            req.user!.full_name
        );
        return sendSuccess(res, archivedTask, 'Task archived successfully');
    }),

    unarchiveTask: asyncHandler(async (req: Request, res: Response) => {
        // Only super_admin can unarchive
        if (req.user?.role !== 'super_admin') {
            throw new AppError(403, 'Only super administrators can unarchive tasks');
        }

        const result = idParamSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid task ID');
        }

        const task = await StandaloneTaskService.unarchiveTask(
            result.data.params.id,
            req.user!.id,
            req.user!.full_name
        );
        return sendSuccess(res, task, 'Task unarchived successfully');
    }),

    getTaskStats: asyncHandler(async (req: Request, res: Response) => {
        const stats = await StandaloneTaskService.getTaskStats(
            req.user?.id,
            req.user?.role
        );
        return sendSuccess(res, stats, 'Task stats retrieved successfully');
    }),

    getTaskHistory: asyncHandler(async (req: Request, res: Response) => {
        const result = idParamSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid task ID');
        }

        // Check permission - must be able to view the task
        const canView = await StandaloneTaskService.canViewTask(
            result.data.params.id,
            req.user!.id,
            req.user!.role
        );
        if (!canView) {
            throw new AppError(403, 'You do not have permission to view this task\'s history');
        }

        const history = await StandaloneTaskService.getTaskHistory(result.data.params.id);
        return sendSuccess(res, history, 'Task history retrieved successfully');
    }),

    generateRecurringTasks: asyncHandler(async (req: Request, res: Response) => {
        // Only super_admin can generate recurring tasks
        if (req.user?.role !== 'super_admin') {
            throw new AppError(403, 'Only super administrators can generate recurring tasks');
        }

        const result = generateRecurringTasksSchema.safeParse({ params: req.params, body: req.body });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid data');
        }

        // Check if task exists and is recurring
        const task = await StandaloneTaskService.findTaskById(result.data.params.id);
        if (!task) throw new AppError(404, 'Task not found');
        if (!task.is_recurring || task.recurrence_type === 'none') {
            throw new AppError(400, 'Task is not set to recur');
        }

        await StandaloneTaskService.generateRecurringTasks(
            result.data.params.id,
            req.user!.id,
            req.user!.full_name
        );
        return sendSuccess(res, null, 'Recurring tasks generated successfully');
    }),

    // ═══════════════════════════════════════════════════════════════════════════
    //  SUBTASK CONTROLLERS
    // ═══════════════════════════════════════════════════════════════════════════

    createSubtask: asyncHandler(async (req: Request, res: Response) => {
        const paramsResult = createStandaloneSubtaskSchema.shape.params.safeParse(req.params);
        if (!paramsResult.success) {
            throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid task ID');
        }
        const bodyResult = createStandaloneSubtaskSchema.shape.body.safeParse(req.body);
        if (!bodyResult.success) {
            throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid subtask data');
        }

        // Check permission - super_admin or creator can add subtasks
        const canEdit = await StandaloneTaskService.canEditTask(
            paramsResult.data.taskId,
            req.user!.id,
            req.user!.role
        );
        if (!canEdit) {
            throw new AppError(403, 'You do not have permission to add subtasks to this task');
        }

        const data = {
            title: bodyResult.data.title,
            description: nullToUndefined(bodyResult.data.description),
        };

        const subtask = await StandaloneTaskService.createSubtask(
            paramsResult.data.taskId,
            data,
            req.user!.id,
            req.user!.full_name
        );
        return sendSuccess(res, subtask, 'Subtask created successfully', 201);
    }),

    updateSubtask: asyncHandler(async (req: Request, res: Response) => {
        const paramsResult = updateStandaloneSubtaskSchema.shape.params.safeParse(req.params);
        if (!paramsResult.success) {
            throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid IDs');
        }
        const bodyResult = updateStandaloneSubtaskSchema.shape.body.safeParse(req.body);
        if (!bodyResult.success) {
            throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid subtask data');
        }

        // Check permission - super_admin or creator can update subtasks
        const canEdit = await StandaloneTaskService.canEditTask(
            paramsResult.data.taskId,
            req.user!.id,
            req.user!.role
        );
        if (!canEdit) {
            throw new AppError(403, 'You do not have permission to update subtasks of this task');
        }

        const subtask = await StandaloneTaskService.updateSubtask(
            paramsResult.data.taskId,
            paramsResult.data.subtaskId,
            bodyResult.data,
            req.user!.id,
            req.user!.full_name
        );
        return sendSuccess(res, subtask, 'Subtask updated successfully');
    }),

    deleteSubtask: asyncHandler(async (req: Request, res: Response) => {
        const paramsResult = updateStandaloneSubtaskSchema.shape.params.safeParse(req.params);
        if (!paramsResult.success) {
            throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid IDs');
        }

        // Check permission - super_admin or creator can delete subtasks
        const canEdit = await StandaloneTaskService.canEditTask(
            paramsResult.data.taskId,
            req.user!.id,
            req.user!.role
        );
        if (!canEdit) {
            throw new AppError(403, 'You do not have permission to delete subtasks of this task');
        }

        await StandaloneTaskService.deleteSubtask(
            paramsResult.data.taskId,
            paramsResult.data.subtaskId,
            req.user!.id,
            req.user!.full_name
        );
        return sendSuccess(res, null, 'Subtask deleted successfully');
    }),

    // ═══════════════════════════════════════════════════════════════════════════
    //  COMMENT CONTROLLERS
    // ═══════════════════════════════════════════════════════════════════════════

    createComment: asyncHandler(async (req: Request, res: Response) => {
        const paramsResult = createStandaloneCommentSchema.shape.params.safeParse(req.params);
        if (!paramsResult.success) {
            throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid task ID');
        }
        const bodyResult = createStandaloneCommentSchema.shape.body.safeParse(req.body);
        if (!bodyResult.success) {
            throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid comment data');
        }

        // Anyone who can view the task can comment
        const canView = await StandaloneTaskService.canViewTask(
            paramsResult.data.taskId,
            req.user!.id,
            req.user!.role
        );
        if (!canView) {
            throw new AppError(403, 'You do not have permission to comment on this task');
        }

        const comment = await StandaloneTaskService.createComment(
            paramsResult.data.taskId,
            bodyResult.data,
            req.user!.id,
            req.user!.full_name
        );
        return sendSuccess(res, comment, 'Comment added successfully', 201);
    }),

    updateComment: asyncHandler(async (req: Request, res: Response) => {
        const paramsResult = updateStandaloneCommentSchema.shape.params.safeParse(req.params);
        if (!paramsResult.success) {
            throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid IDs');
        }
        const bodyResult = updateStandaloneCommentSchema.shape.body.safeParse(req.body);
        if (!bodyResult.success) {
            throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid comment data');
        }

        // Only the comment author can update (service will verify)
        const comment = await StandaloneTaskService.updateComment(
            paramsResult.data.taskId,
            paramsResult.data.commentId,
            bodyResult.data,
            req.user!.id,
            req.user!.full_name
        );
        return sendSuccess(res, comment, 'Comment updated successfully');
    }),

    deleteComment: asyncHandler(async (req: Request, res: Response) => {
        const paramsResult = updateStandaloneCommentSchema.shape.params.safeParse(req.params);
        if (!paramsResult.success) {
            throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid IDs');
        }

        // Only the comment author or super_admin can delete (service will verify)
        await StandaloneTaskService.deleteComment(
            paramsResult.data.taskId,
            paramsResult.data.commentId,
            req.user!.id,
            req.user!.full_name
        );
        return sendSuccess(res, null, 'Comment deleted successfully');
    }),

    // ═══════════════════════════════════════════════════════════════════════════
    //  ATTACHMENT CONTROLLERS WITH CLOUDINARY
    // ═══════════════════════════════════════════════════════════════════════════

    createAttachment: asyncHandler(async (req: Request, res: Response) => {
        const paramsResult = createStandaloneAttachmentSchema.shape.params.safeParse(req.params);
        if (!paramsResult.success) {
            throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid task ID');
        }

        // Check permission - super_admin or creator can add attachments
        const canEdit = await StandaloneTaskService.canEditTask(
            paramsResult.data.taskId,
            req.user!.id,
            req.user!.role
        );
        if (!canEdit) {
            throw new AppError(403, 'You do not have permission to add attachments to this task');
        }

        const file = req.file;
        if (!file) {
            throw new AppError(400, 'No file uploaded');
        }

        // Upload to Cloudinary
        try {
            const result = await uploadToCloudinary(file, 'standalone');
            
            const fileData = {
                file_name: file.originalname,
                file_url: result.secure_url,
                file_size: file.size,
                mime_type: file.mimetype,
            };

            const attachment = await StandaloneTaskService.createAttachment(
                paramsResult.data.taskId,
                fileData,
                req.user!.id,
                req.user!.full_name
            );
            return sendSuccess(res, attachment, 'Attachment added successfully', 201);
        } catch (error) {
            console.error('Cloudinary upload error:', error);
            throw new AppError(500, 'Failed to upload file to cloud storage');
        }
    }),

    deleteAttachment: asyncHandler(async (req: Request, res: Response) => {
        const paramsResult = deleteStandaloneAttachmentSchema.shape.params.safeParse(req.params);
        if (!paramsResult.success) {
            throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid IDs');
        }

        // Check permission - super_admin or creator can delete attachments
        const canEdit = await StandaloneTaskService.canEditTask(
            paramsResult.data.taskId,
            req.user!.id,
            req.user!.role
        );
        if (!canEdit) {
            throw new AppError(403, 'You do not have permission to delete attachments from this task');
        }

        // Get the attachment to delete from Cloudinary
        const task = await StandaloneTaskService.findTaskById(paramsResult.data.taskId);
        if (task && task.attachments) {
            const attachment = task.attachments.find(a => a.id === paramsResult.data.attachmentId);
            if (attachment) {
                try {
                    // Extract public ID from Cloudinary URL
                    const urlParts = attachment.file_url.split('/');
                    const publicIdWithExt = urlParts[urlParts.length - 1];
                    const publicId = publicIdWithExt.split('.')[0];
                    await deleteFromCloudinary(`standalone/${publicId}`);
                } catch (error) {
                    console.error('Failed to delete from Cloudinary:', error);
                    // Continue with database deletion even if Cloudinary fails
                }
            }
        }

        await StandaloneTaskService.deleteAttachment(
            paramsResult.data.taskId,
            paramsResult.data.attachmentId,
            req.user!.id,
            req.user!.full_name
        );
        return sendSuccess(res, null, 'Attachment deleted successfully');
    }),

    // ═══════════════════════════════════════════════════════════════════════════
    //  PERMISSION CHECK CONTROLLER (for client-side authorization)
    // ═══════════════════════════════════════════════════════════════════════════

    checkPermissions: asyncHandler(async (req: Request, res: Response) => {
        const result = idParamSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid task ID');
        }

        const taskId = result.data.params.id;
        const userId = req.user!.id;
        const userRole = req.user!.role;
        const userDepartmentId = req.user!.department_id;

        // Get task to check department assignments
        const task = await StandaloneTaskService.findTaskById(taskId);
        if (!task) throw new AppError(404, 'Task not found');

        const [canView, canEdit, canDelete, canComplete] = await Promise.all([
            StandaloneTaskService.canViewTask(taskId, userId, userRole),
            StandaloneTaskService.canEditTask(taskId, userId, userRole),
            StandaloneTaskService.canDeleteTask(taskId, userId, userRole),
            StandaloneTaskService.canCompleteTask(taskId, userId, userRole),
        ]);

        // Determine additional role-based permissions
        const isSuperAdmin = userRole === 'super_admin';
        const isDeptHead = userRole === 'dept_head';
        const isStaff = userRole === 'staff';
        const isViewer = userRole === 'viewer';
        
        // Check if user is in the same department as the task's assigned team
        const isInSameDepartment = task.assigned_to_team !== null && 
                                   task.assigned_to_team === userDepartmentId;

        // Dept heads can manage tasks in their department
        const canManageDepartmentTasks = isDeptHead && isInSameDepartment;

        return sendSuccess(res, {
            canView,
            canEdit: canEdit || canManageDepartmentTasks,
            canDelete,
            canComplete: canComplete || (isDeptHead && isInSameDepartment && task.status !== 'complete'),
            canArchive: canComplete || isSuperAdmin || (isDeptHead && isInSameDepartment),
            canUnarchive: isSuperAdmin,
            canComment: canView,
            canAddAttachments: canEdit || canManageDepartmentTasks,
            canManageSubtasks: canEdit || canManageDepartmentTasks,
            canAssign: isSuperAdmin || isDeptHead,
            canRecurring: isSuperAdmin,
            role: userRole,
            roleLabel: isSuperAdmin ? 'Super Administrator' : 
                       isDeptHead ? 'Department Head' : 
                       isStaff ? 'Staff' : 'Viewer',
            isSuperAdmin,
            isDeptHead,
            isStaff,
            isViewer,
            isInSameDepartment,
            canManageDepartmentTasks,
            taskStatus: task.status,
            isTaskComplete: task.status === 'complete',
            isTaskArchived: task.is_archived,
            hasAttachments: task.attachments && task.attachments.length > 0,
        }, 'Permissions retrieved successfully');
    }),
};