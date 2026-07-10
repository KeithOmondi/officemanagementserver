import { Router } from 'express';
import { taskController } from './task.controller';
import { protect, requireRole } from '../../middleware/auth.middleware';

const router = Router();
router.use(protect);

// ── Statistics ──────────────────────────────────────────────────────────────
router.get('/stats', taskController.getStats);

// ── Projects ──────────────────────────────────────────────────────────────
router.get('/projects',                taskController.getAllProjects);
router.get('/projects/:id',            taskController.getProjectById);
router.get('/projects/:id/members',    taskController.getProjectMembers);
router.post(  '/projects',     requireRole('dept_head', 'super_admin'), taskController.createProject);
router.put(   '/projects/:id', requireRole('dept_head', 'super_admin'), taskController.updateProject);
router.delete('/projects/:id', requireRole('dept_head', 'super_admin'), taskController.deleteProject);

// ── Project Members ────────────────────────────────────────────────────────
router.post(  '/projects/:id/members',                 requireRole('dept_head', 'super_admin'), taskController.addProjectMember);
router.delete('/projects/:projectId/members/:memberId', requireRole('dept_head', 'super_admin'), taskController.removeProjectMember);

// ── Tasks ──────────────────────────────────────────────────────────────────
router.get('/',             taskController.getAllTasks);
router.get('/standalone',  taskController.getStandaloneTasks);
router.get('/:id',         taskController.getTaskById);
router.post(  '/',     requireRole('staff', 'dept_head', 'super_admin'), taskController.createTask);
router.put(   '/:id', requireRole('staff', 'dept_head', 'super_admin'), taskController.updateTask);
router.delete('/:id', requireRole('dept_head', 'super_admin'),          taskController.deleteTask);

// ── Attachments ────────────────────────────────────────────────────────────
router.get(   '/:id/attachments', taskController.getAttachments);
router.post(  '/:id/attachments', taskController.addAttachment);
router.delete('/attachments/:attachmentId', taskController.deleteAttachment);

export default router;