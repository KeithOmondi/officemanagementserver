// src/features/tasks/task.service.ts
import { pool } from '../../config/db';
import { AppError } from '../../utils/response';
import type {
    Project,
    Task,
    ProjectMember,
    TaskStats,
    ProjectStats,
} from './task.types';
import type {
    CreateProjectInput,
    UpdateProjectInput,
    CreateTaskInput,
    UpdateTaskInput,
    AddProjectMemberInput,
} from './task.validator';

// ── Constants ─────────────────────────────────────────────────────────────────

const PROJECT_SELECT = `
    p.id,
    p.name,
    p.description,
    p.status,
    p.priority,
    p.deadline,
    p.progress,
    p.created_by,
    p.is_active,
    p.created_at,
    p.updated_at,
    COUNT(DISTINCT t.id)::int AS task_count,
    COUNT(DISTINCT CASE WHEN t.status = 'done' THEN t.id END)::int AS completed_tasks
`;

const PROJECT_JOIN = `
    FROM projects p
    LEFT JOIN tasks t ON t.project_id = p.id AND t.is_active = true
`;

const TASK_SELECT = `
    t.id,
    t.project_id,
    t.title,
    t.description,
    t.status,
    t.priority,
    t.assignee_id,
    u.full_name AS assignee_name,
    t.due_date,
    t.start_date,
    t.completed_at,
    t.is_active,
    t.created_by,
    t.created_at,
    t.updated_at,
    p.name AS project_name
`;

const TASK_JOIN = `
    FROM tasks t
    LEFT JOIN projects p ON p.id = t.project_id AND p.is_active = true
    LEFT JOIN users u ON u.id = t.assignee_id AND u.is_active = true
`;

// ── Service Class ────────────────────────────────────────────────────────────

export class TaskService {

    // ── Statistics ──────────────────────────────────────────────────────────

    static async getTaskStats(): Promise<TaskStats> {
        const { rows } = await pool.query(`
            SELECT
                COUNT(CASE WHEN status = 'todo' AND due_date >= CURRENT_DATE THEN 1 END)::int AS todo,
                COUNT(CASE WHEN status = 'in_progress' THEN 1 END)::int AS in_progress,
                COUNT(CASE WHEN status = 'done' THEN 1 END)::int AS done,
                COUNT(CASE WHEN status != 'done' AND due_date < CURRENT_DATE THEN 1 END)::int AS overdue
            FROM tasks
            WHERE is_active = true
        `);
        return rows[0];
    }

    static async getProjectStats(): Promise<ProjectStats> {
        const { rows } = await pool.query(`
            SELECT
                COUNT(*)::int AS total,
                COUNT(CASE WHEN status = 'active' THEN 1 END)::int AS active,
                COUNT(CASE WHEN status = 'completed' THEN 1 END)::int AS completed,
                COUNT(CASE WHEN status = 'archived' THEN 1 END)::int AS archived
            FROM projects
            WHERE is_active = true
        `);
        return rows[0];
    }

    // ── Projects ─────────────────────────────────────────────────────────────

    static async findAllProjects(): Promise<Project[]> {
        const { rows } = await pool.query(
            `SELECT ${PROJECT_SELECT} ${PROJECT_JOIN}
             WHERE p.is_active = true
             GROUP BY p.id
             ORDER BY p.created_at DESC`
        );
        return rows;
    }

    static async findProjectById(id: string): Promise<Project | null> {
        const { rows } = await pool.query(
            `SELECT ${PROJECT_SELECT} ${PROJECT_JOIN}
             WHERE p.id = $1 AND p.is_active = true
             GROUP BY p.id`,
            [id]
        );
        return rows[0] || null;
    }

    static async getProjectMembers(projectId: string): Promise<ProjectMember[]> {
        const { rows } = await pool.query(`
            SELECT 
                pm.id,
                pm.project_id,
                pm.user_id,
                u.full_name AS user_name,
                pm.role,
                pm.is_active,
                pm.created_at,
                pm.updated_at
            FROM project_members pm
            JOIN users u ON u.id = pm.user_id AND u.is_active = true
            WHERE pm.project_id = $1 AND pm.is_active = true
            ORDER BY u.full_name ASC
        `, [projectId]);
        return rows;
    }

    static async createProject(
        input: CreateProjectInput,
        createdBy: string
    ): Promise<Project> {
        const { rows } = await pool.query(
            `INSERT INTO projects (name, description, priority, deadline, created_by)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id`,
            [
                input.name.trim(),
                input.description || null,
                input.priority || 'medium',
                input.deadline,
                createdBy,
            ]
        );

        const projectId = rows[0].id;

        // Add members if provided
        if (input.member_ids && input.member_ids.length > 0) {
            const memberValues = input.member_ids.map((userId, index) => 
                `($${index * 2 + 1}, $${index * 2 + 2})`
            ).join(', ');
            
            const flatValues = input.member_ids.flatMap(id => [projectId, id]);
            
            await pool.query(
                `INSERT INTO project_members (project_id, user_id)
                 VALUES ${memberValues}`,
                flatValues
            );
        }

        const project = await this.findProjectById(projectId);
        if (!project) throw new AppError(500, 'Failed to create project');
        return project;
    }

    static async updateProject(
        id: string,
        input: UpdateProjectInput
    ): Promise<Project> {
        const existing = await this.findProjectById(id);
        if (!existing) {
            throw new AppError(404, 'Project not found');
        }

        const updates: string[] = [];
        const values: unknown[] = [];
        let paramCount = 1;

        if (input.name !== undefined) {
            updates.push(`name = $${paramCount++}`);
            values.push(input.name.trim());
        }
        if (input.description !== undefined) {
            updates.push(`description = $${paramCount++}`);
            values.push(input.description || null);
        }
        if (input.status !== undefined) {
            updates.push(`status = $${paramCount++}`);
            values.push(input.status);
        }
        if (input.priority !== undefined) {
            updates.push(`priority = $${paramCount++}`);
            values.push(input.priority);
        }
        if (input.deadline !== undefined) {
            updates.push(`deadline = $${paramCount++}`);
            values.push(input.deadline);
        }
        if (input.is_active !== undefined) {
            updates.push(`is_active = $${paramCount++}`);
            values.push(input.is_active);
        }

        if (updates.length === 0) {
            return existing;
        }

        updates.push(`updated_at = NOW()`);
        values.push(id);

        await pool.query(
            `UPDATE projects SET ${updates.join(', ')} WHERE id = $${paramCount}`,
            values
        );

        const updated = await this.findProjectById(id);
        if (!updated) throw new AppError(500, 'Failed to update project');
        return updated;
    }

    static async deleteProject(id: string): Promise<void> {
        const { rows } = await pool.query(
            `UPDATE projects 
             SET is_active = false, updated_at = NOW()
             WHERE id = $1 AND is_active = true
             RETURNING id`,
            [id]
        );

        if (rows.length === 0) {
            throw new AppError(404, 'Project not found');
        }

        // Soft delete all associated tasks
        await pool.query(
            `UPDATE tasks 
             SET is_active = false, updated_at = NOW()
             WHERE project_id = $1 AND is_active = true`,
            [id]
        );
    }

    // ── Project Members ──────────────────────────────────────────────────────

    static async addProjectMember(
        projectId: string,
        input: AddProjectMemberInput
    ): Promise<ProjectMember> {
        // Verify project exists
        const project = await this.findProjectById(projectId);
        if (!project) {
            throw new AppError(404, 'Project not found');
        }

        // Verify user exists
        const { rows: userCheck } = await pool.query(
            `SELECT id FROM users WHERE id = $1 AND is_active = true`,
            [input.user_id]
        );
        if (userCheck.length === 0) {
            throw new AppError(404, 'User not found');
        }

        const { rows } = await pool.query(
            `INSERT INTO project_members (project_id, user_id, role)
             VALUES ($1, $2, $3)
             ON CONFLICT (project_id, user_id) 
             WHERE is_active = true DO NOTHING
             RETURNING id`,
            [projectId, input.user_id, input.role || null]
        );

        if (rows.length === 0) {
            throw new AppError(409, 'User is already a member of this project');
        }

        const members = await this.getProjectMembers(projectId);
        return members.find(m => m.user_id === input.user_id)!;
    }

    static async removeProjectMember(
        projectId: string,
        memberId: string
    ): Promise<void> {
        const { rows } = await pool.query(
            `UPDATE project_members
             SET is_active = false, updated_at = NOW()
             WHERE id = $1 AND project_id = $2 AND is_active = true
             RETURNING id`,
            [memberId, projectId]
        );

        if (rows.length === 0) {
            throw new AppError(404, 'Member not found');
        }
    }

    // ── Tasks ─────────────────────────────────────────────────────────────────

    static async findAllTasks(projectId?: string): Promise<Task[]> {
        let query = `SELECT ${TASK_SELECT} ${TASK_JOIN} WHERE t.is_active = true`;
        const params: string[] = [];

        if (projectId) {
            query += ` AND t.project_id = $1`;
            params.push(projectId);
        }

        query += ` ORDER BY t.due_date ASC, t.created_at DESC`;

        const { rows } = await pool.query(query, params);
        return rows;
    }

    static async findTaskById(id: string): Promise<Task | null> {
        const { rows } = await pool.query(
            `SELECT ${TASK_SELECT} ${TASK_JOIN}
             WHERE t.id = $1 AND t.is_active = true`,
            [id]
        );
        return rows[0] || null;
    }

    static async createTask(
        input: CreateTaskInput,
        createdBy: string
    ): Promise<Task> {
        // If project_id is provided, verify it exists
        if (input.project_id) {
            const project = await this.findProjectById(input.project_id);
            if (!project) {
                throw new AppError(404, 'Project not found');
            }
            
            // Verify task deadline doesn't exceed project deadline
            if (new Date(input.due_date) > new Date(project.deadline)) {
                throw new AppError(400, 'Task deadline cannot exceed project deadline');
            }
        }

        // Verify assignee exists if provided
        if (input.assignee_id) {
            const { rows } = await pool.query(
                `SELECT id FROM users WHERE id = $1 AND is_active = true`,
                [input.assignee_id]
            );
            if (rows.length === 0) {
                throw new AppError(404, 'Assignee not found');
            }
        }

        const { rows } = await pool.query(
            `INSERT INTO tasks (
                project_id, title, description, priority, 
                assignee_id, due_date, start_date, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id`,
            [
                input.project_id || null,
                input.title.trim(),
                input.description || null,
                input.priority || 'medium',
                input.assignee_id || null,
                input.due_date,
                input.start_date || null,
                createdBy,
            ]
        );

        const task = await this.findTaskById(rows[0].id);
        if (!task) throw new AppError(500, 'Failed to create task');
        return task;
    }

    static async updateTask(
        id: string,
        input: UpdateTaskInput
    ): Promise<Task> {
        const existing = await this.findTaskById(id);
        if (!existing) {
            throw new AppError(404, 'Task not found');
        }

        // If project_id is changing or being set, verify it exists
        if (input.assignee_id !== undefined && input.assignee_id !== null) {
            const { rows } = await pool.query(
                `SELECT id FROM users WHERE id = $1 AND is_active = true`,
                [input.assignee_id]
            );
            if (rows.length === 0) {
                throw new AppError(404, 'Assignee not found');
            }
        }

        const updates: string[] = [];
        const values: unknown[] = [];
        let paramCount = 1;

        if (input.title !== undefined) {
            updates.push(`title = $${paramCount++}`);
            values.push(input.title.trim());
        }
        if (input.description !== undefined) {
            updates.push(`description = $${paramCount++}`);
            values.push(input.description || null);
        }
        if (input.status !== undefined) {
            updates.push(`status = $${paramCount++}`);
            values.push(input.status);
            if (input.status === 'done') {
                updates.push(`completed_at = NOW()`);
            } else {
                updates.push(`completed_at = NULL`);
            }
        }
        if (input.priority !== undefined) {
            updates.push(`priority = $${paramCount++}`);
            values.push(input.priority);
        }
        if (input.assignee_id !== undefined) {
            updates.push(`assignee_id = $${paramCount++}`);
            values.push(input.assignee_id);
        }
        if (input.due_date !== undefined) {
            updates.push(`due_date = $${paramCount++}`);
            values.push(input.due_date);
        }
        if (input.start_date !== undefined) {
            updates.push(`start_date = $${paramCount++}`);
            values.push(input.start_date);
        }
        if (input.is_active !== undefined) {
            updates.push(`is_active = $${paramCount++}`);
            values.push(input.is_active);
        }

        if (updates.length === 0) {
            return existing;
        }

        updates.push(`updated_at = NOW()`);
        values.push(id);

        await pool.query(
            `UPDATE tasks SET ${updates.join(', ')} WHERE id = $${paramCount}`,
            values
        );

        const updated = await this.findTaskById(id);
        if (!updated) throw new AppError(500, 'Failed to update task');
        return updated;
    }

    static async deleteTask(id: string): Promise<void> {
        const { rows } = await pool.query(
            `UPDATE tasks 
             SET is_active = false, updated_at = NOW()
             WHERE id = $1 AND is_active = true
             RETURNING id`,
            [id]
        );

        if (rows.length === 0) {
            throw new AppError(404, 'Task not found');
        }
    }

    // ── Standalone Tasks ─────────────────────────────────────────────────────

    static async findStandaloneTasks(): Promise<Task[]> {
        const { rows } = await pool.query(
            `SELECT ${TASK_SELECT} ${TASK_JOIN}
             WHERE t.is_active = true AND t.project_id IS NULL
             ORDER BY t.due_date ASC, t.created_at DESC`
        );
        return rows;
    }
}