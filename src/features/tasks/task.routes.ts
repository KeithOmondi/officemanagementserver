// src/features/tasks/task.routes.ts
import { Router } from 'express';
import { taskController } from './task.controller';
import { protect, requireRole } from '../../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(protect);

// ── Statistics ──────────────────────────────────────────────────────────────
router.get('/stats', taskController.getStats);

// ── Project Routes ──────────────────────────────────────────────────────────
router.get('/projects',                taskController.getAllProjects);
router.get('/projects/:id',            taskController.getProjectById);
router.get('/projects/:id/members',    taskController.getProjectMembers);

router.post(  '/projects',     requireRole('dept_head', 'super_admin'), taskController.createProject);
router.put(   '/projects/:id', requireRole('dept_head', 'super_admin'), taskController.updateProject);
router.delete('/projects/:id', requireRole('dept_head', 'super_admin'), taskController.deleteProject);

// ── Project Member Routes ────────────────────────────────────────────────────
router.post(  '/projects/:id/members',                    requireRole('dept_head', 'super_admin'), taskController.addProjectMember);
router.delete('/projects/:projectId/members/:memberId',   requireRole('dept_head', 'super_admin'), taskController.removeProjectMember);

// ── Task Routes ──────────────────────────────────────────────────────────────
router.get('/tasks',             taskController.getAllTasks);
router.get('/tasks/standalone',  taskController.getStandaloneTasks);
router.get('/tasks/:id',         taskController.getTaskById);

router.post(  '/tasks',     requireRole('staff', 'dept_head', 'super_admin'), taskController.createTask);
router.put(   '/tasks/:id', requireRole('staff', 'dept_head', 'super_admin'), taskController.updateTask);
router.delete('/tasks/:id', requireRole('dept_head', 'super_admin'),          taskController.deleteTask);

export default router;