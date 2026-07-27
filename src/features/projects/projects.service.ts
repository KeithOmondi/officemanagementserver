// src/features/projects/projects.service.ts
import { pool } from '../../config/db';
import { AppError } from '../../utils/response';
import type {
    Project,
    ProjectTask,
    ProjectSubtask,
    ProjectTaskComment,
    ProjectPaginationResponse,
    ProjectTaskPaginationResponse,
    ProjectStats,
    CreateProjectInput,
    UpdateProjectInput,
    CreateProjectTaskInput,
    UpdateProjectTaskInput,
    ProjectTaskFilters,
    CreateProjectSubtaskInput,
    UpdateProjectSubtaskInput,
    CreateProjectCommentInput,
    UpdateProjectCommentInput,
    ProjectUser,
} from './projects.types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const parseTags = (tags: string | string[] | null | undefined): string[] => {
    if (!tags) return [];
    if (Array.isArray(tags)) return tags;
    return tags.split(',').map(t => t.trim()).filter(Boolean);
};

const toDbValue = <T>(value: T | null | undefined): T | null => {
    if (value === undefined) return null;
    return value as T;
};

const ALLOWED_SORT = new Set(['created_at', 'deadline', 'priority', 'status', 'title']);

// ─── SELECT Fragments ────────────────────────────────────────────────────────

const PROJECT_SELECT = `
    p.id, p.title, p.description, p.priority, p.deadline, p.tags,
    p.is_active, p.created_by, p.created_by_name, p.created_at, p.updated_at,
    COALESCE((SELECT COUNT(*) FROM project_tasks t WHERE t.project_id = p.id AND t.is_active = true), 0) AS task_count,
    COALESCE((SELECT COUNT(*) FROM project_tasks t WHERE t.project_id = p.id AND t.status = 'done' AND t.is_active = true), 0) AS completed_task_count,
    COALESCE((
        SELECT json_agg(DISTINCT jsonb_build_object(
            'id', u.id,
            'full_name', u.full_name,
            'pj_number', u.pj_number,
            'email', u.email
        ))
        FROM project_members pm 
        JOIN users u ON u.id = pm.user_id 
        WHERE pm.project_id = p.id AND pm.is_active = true AND u.is_active = true
    ), '[]'::json) AS members
`;

const TASK_SELECT = `
    t.id, t.project_id, t.title, t.description, t.status, t.priority, t.type,
    t.assignee, t.assignee_name, t.deadline, t.start_date, t.tags,
    t.estimated_hours, t.actual_hours, t.parent_task_id, t.visibility,
    t.is_active, t.created_by, t.created_by_name, t.created_at, t.updated_at,
    COALESCE((
        SELECT json_agg(jsonb_build_object(
            'id', s.id,
            'task_id', s.task_id,
            'title', s.title,
            'description', s.description,
            'completed', s.completed,
            'is_active', s.is_active,
            'assigned_to', s.assigned_to,
            'created_at', s.created_at,
            'updated_at', s.updated_at
        ))
        FROM project_subtasks s 
        WHERE s.task_id = t.id AND s.is_active = true
    ), '[]'::json) AS subtasks,
    COALESCE((
        SELECT json_agg(jsonb_build_object(
            'id', c.id,
            'task_id', c.task_id,
            'user_id', c.user_id,
            'content', c.content,
            'created_at', c.created_at,
            'updated_at', c.updated_at
        ))
        FROM project_task_comments c 
        WHERE c.task_id = t.id
    ), '[]'::json) AS comments
`;

const TASK_JOIN = `
    FROM project_tasks t
`;

const SUBTASK_SELECT = `
    s.id, s.task_id, s.title, s.description, s.completed, s.is_active,
    s.assigned_to, s.created_at, s.updated_at
`;

// ─── Service ─────────────────────────────────────────────────────────────────

export class ProjectService {

    // ═══════════════════════════════════════════════════════════════════════════
    //  PROJECT OPERATIONS
    // ═══════════════════════════════════════════════════════════════════════════

    static async createProject(input: CreateProjectInput, userId: string, userName?: string): Promise<Project> {
        const { rows } = await pool.query(
            `INSERT INTO projects (title, description, priority, deadline, tags, created_by, created_by_name)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id`,
            [
                input.title.trim(),
                toDbValue(input.description),
                input.priority || 'normal',
                toDbValue(input.deadline),
                input.tags || [],
                userId,
                userName || 'System',
            ]
        );

        // Add members
        if (input.member_ids && input.member_ids.length > 0) {
            for (const memberId of input.member_ids) {
                await pool.query(
                    `INSERT INTO project_members (project_id, user_id)
                     VALUES ($1, $2)
                     ON CONFLICT (project_id, user_id) DO NOTHING`,
                    [rows[0].id, memberId]
                );
            }
        }

        // Add creator as owner
        await pool.query(
            `INSERT INTO project_members (project_id, user_id, role)
             VALUES ($1, $2, 'owner')
             ON CONFLICT (project_id, user_id) DO NOTHING`,
            [rows[0].id, userId]
        );

        return (await this.findProjectById(rows[0].id))!;
    }

    static async findAllProjects(filters: { search?: string; page?: number; limit?: number }, userId?: string): Promise<ProjectPaginationResponse> {
        const { search, page = 1, limit = 20 } = filters;
        const offset = (page - 1) * limit;

        const conditions: string[] = ['p.is_active = true'];
        const values: unknown[] = [];
        let p = 1;

        if (userId) {
            conditions.push(`EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = $${p} AND pm.is_active = true)`);
            values.push(userId);
            p++;
        }

        if (search) {
            conditions.push(`(p.title ILIKE $${p} OR p.description ILIKE $${p})`);
            values.push(`%${search}%`);
            p++;
        }

        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

        const [countResult, dataResult] = await Promise.all([
            pool.query(`SELECT COUNT(*) AS total FROM projects p ${where}`, values),
            pool.query(
                `SELECT ${PROJECT_SELECT}
                 FROM projects p
                 ${where}
                 ORDER BY p.created_at DESC
                 LIMIT $${p} OFFSET $${p + 1}`,
                [...values, limit, offset]
            ),
        ]);

        const total = parseInt(countResult.rows[0]?.total ?? '0', 10);
        return {
            data: dataResult.rows.map((row: any) => ({
                ...row,
                members: row.members || [],
            })),
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    static async findProjectById(id: string): Promise<Project | null> {
        const { rows } = await pool.query(
            `SELECT ${PROJECT_SELECT}
             FROM projects p
             WHERE p.id = $1 AND p.is_active = true`,
            [id]
        );
        if (!rows[0]) return null;
        return {
            ...rows[0],
            members: rows[0].members || [],
        };
    }

    static async updateProject(id: string, input: UpdateProjectInput): Promise<Project> {
        const existing = await this.findProjectById(id);
        if (!existing) throw new AppError(404, 'Project not found');

        const updates: string[] = [];
        const values: unknown[] = [];
        let p = 1;

        if (input.title !== undefined) { updates.push(`title = $${p++}`); values.push(input.title.trim()); }
        if (input.description !== undefined) { updates.push(`description = $${p++}`); values.push(toDbValue(input.description)); }
        if (input.priority !== undefined) { updates.push(`priority = $${p++}`); values.push(input.priority); }
        if (input.deadline !== undefined) { updates.push(`deadline = $${p++}`); values.push(toDbValue(input.deadline)); }
        if (input.tags !== undefined) { updates.push(`tags = $${p++}`); values.push(input.tags || []); }

        if (!updates.length) return existing;

        updates.push(`updated_at = NOW()`);
        values.push(id);

        await pool.query(
            `UPDATE projects SET ${updates.join(', ')} WHERE id = $${p} AND is_active = true`,
            values
        );

        return (await this.findProjectById(id))!;
    }

    static async deleteProject(id: string): Promise<void> {
        const existing = await this.findProjectById(id);
        if (!existing) throw new AppError(404, 'Project not found');

        // Check if there are active tasks
        const { rows } = await pool.query(
            `SELECT COUNT(*) FROM project_tasks WHERE project_id = $1 AND is_active = true`,
            [id]
        );
        if (parseInt(rows[0].count, 10) > 0) {
            throw new AppError(409, 'Cannot delete project with active tasks');
        }

        await pool.query(
            `UPDATE projects SET is_active = false, updated_at = NOW() WHERE id = $1`,
            [id]
        );
    }

    static async getProjectMembers(projectId: string): Promise<ProjectUser[]> {
        const { rows } = await pool.query(
            `SELECT u.id, u.full_name, u.pj_number, u.email
             FROM project_members pm
             JOIN users u ON u.id = pm.user_id
             WHERE pm.project_id = $1 AND pm.is_active = true AND u.is_active = true`,
            [projectId]
        );
        return rows;
    }

    static async addProjectMember(projectId: string, userId: string): Promise<void> {
        const project = await this.findProjectById(projectId);
        if (!project) throw new AppError(404, 'Project not found');

        await pool.query(
            `INSERT INTO project_members (project_id, user_id)
             VALUES ($1, $2)
             ON CONFLICT (project_id, user_id) DO NOTHING`,
            [projectId, userId]
        );
    }

    static async removeProjectMember(projectId: string, userId: string): Promise<void> {
        await pool.query(
            `UPDATE project_members SET is_active = false
             WHERE project_id = $1 AND user_id = $2`,
            [projectId, userId]
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  TASK OPERATIONS
    // ═══════════════════════════════════════════════════════════════════════════

    static async createTask(input: CreateProjectTaskInput, userId: string, userName?: string): Promise<ProjectTask> {
        const tags = parseTags(input.tags);

        const { rows } = await pool.query(
            `INSERT INTO project_tasks
             (project_id, title, description, status, priority, type,
              assignee, deadline, start_date, tags, estimated_hours,
              parent_task_id, visibility, created_by, created_by_name)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
             RETURNING id`,
            [
                toDbValue(input.project_id),
                input.title.trim(),
                toDbValue(input.description),
                input.status || 'todo',
                input.priority || 'normal',
                input.type || 'task',
                toDbValue(input.assignee),
                toDbValue(input.deadline),
                toDbValue(input.start_date),
                tags.length > 0 ? tags : [],
                toDbValue(input.estimated_hours),
                toDbValue(input.parent_task_id),
                input.visibility || 'team',
                userId,
                userName || 'System',
            ]
        );

        return (await this.findTaskById(rows[0].id))!;
    }

    static async findAllTasks(filters: ProjectTaskFilters, userId?: string): Promise<ProjectTaskPaginationResponse> {
        const {
            project_id, status, priority, type, assignee,
            tags, search,
            deadline_from, deadline_to,
            page = 1, limit = 20,
            sort_by = 'created_at', sort_order = 'DESC',
        } = filters;

        const sortCol = ALLOWED_SORT.has(sort_by) ? `t.${sort_by}` : 't.created_at';
        const sortDir = sort_order === 'ASC' ? 'ASC' : 'DESC';
        const offset = (page - 1) * limit;

        const conditions: string[] = ['t.is_active = true'];
        const values: unknown[] = [];
        let p = 1;

        if (userId) {
            conditions.push(`EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = t.project_id AND pm.user_id = $${p} AND pm.is_active = true)`);
            values.push(userId);
            p++;
        }

        if (project_id) { conditions.push(`t.project_id = $${p}`); values.push(project_id); p++; }
        if (status) { conditions.push(`t.status = $${p}`); values.push(status); p++; }
        if (priority) { conditions.push(`t.priority = $${p}`); values.push(priority); p++; }
        if (type) { conditions.push(`t.type = $${p}`); values.push(type); p++; }
        if (assignee) { conditions.push(`t.assignee = $${p}`); values.push(assignee); p++; }

        if (tags) {
            const tagArray = parseTags(tags);
            if (tagArray.length > 0) {
                conditions.push(`t.tags && $${p}`);
                values.push(tagArray);
                p++;
            }
        }

        if (search) {
            conditions.push(`(t.title ILIKE $${p} OR t.description ILIKE $${p})`);
            values.push(`%${search}%`);
            p++;
        }

        if (deadline_from) {
            conditions.push(`t.deadline >= $${p}`);
            values.push(deadline_from);
            p++;
        }

        if (deadline_to) {
            conditions.push(`t.deadline <= $${p}`);
            values.push(deadline_to);
            p++;
        }

        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

        const [countResult, dataResult] = await Promise.all([
            pool.query(`SELECT COUNT(*) AS total ${TASK_JOIN} ${where}`, values),
            pool.query(
                `SELECT ${TASK_SELECT} ${TASK_JOIN}
                 ${where}
                 ORDER BY ${sortCol} ${sortDir}
                 LIMIT $${p} OFFSET $${p + 1}`,
                [...values, limit, offset]
            ),
        ]);

        const total = parseInt(countResult.rows[0]?.total ?? '0', 10);
        return {
            data: dataResult.rows.map((row: any) => ({
                ...row,
                subtasks: row.subtasks || [],
                comments: row.comments || [],
            })),
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    static async findTaskById(id: string): Promise<ProjectTask | null> {
        const { rows } = await pool.query(
            `SELECT ${TASK_SELECT} ${TASK_JOIN} WHERE t.id = $1 AND t.is_active = true`,
            [id]
        );
        if (!rows[0]) return null;
        return {
            ...rows[0],
            subtasks: rows[0].subtasks || [],
            comments: rows[0].comments || [],
        };
    }

    static async updateTask(id: string, input: UpdateProjectTaskInput): Promise<ProjectTask> {
        const existing = await this.findTaskById(id);
        if (!existing) throw new AppError(404, 'Task not found');

        const updates: string[] = [];
        const values: unknown[] = [];
        let p = 1;

        if (input.project_id !== undefined) { updates.push(`project_id = $${p++}`); values.push(toDbValue(input.project_id)); }
        if (input.title !== undefined) { updates.push(`title = $${p++}`); values.push(input.title.trim()); }
        if (input.description !== undefined) { updates.push(`description = $${p++}`); values.push(toDbValue(input.description)); }
        if (input.status !== undefined) { updates.push(`status = $${p++}`); values.push(input.status); }
        if (input.priority !== undefined) { updates.push(`priority = $${p++}`); values.push(input.priority); }
        if (input.type !== undefined) { updates.push(`type = $${p++}`); values.push(input.type); }
        if (input.assignee !== undefined) { updates.push(`assignee = $${p++}`); values.push(toDbValue(input.assignee)); }
        if (input.deadline !== undefined) { updates.push(`deadline = $${p++}`); values.push(toDbValue(input.deadline)); }
        if (input.start_date !== undefined) { updates.push(`start_date = $${p++}`); values.push(toDbValue(input.start_date)); }
        if (input.tags !== undefined) {
            const tags = parseTags(input.tags);
            updates.push(`tags = $${p++}`);
            values.push(tags.length > 0 ? tags : []);
        }
        if (input.estimated_hours !== undefined) { updates.push(`estimated_hours = $${p++}`); values.push(toDbValue(input.estimated_hours)); }
        if (input.actual_hours !== undefined) { updates.push(`actual_hours = $${p++}`); values.push(toDbValue(input.actual_hours)); }
        if (input.parent_task_id !== undefined) { updates.push(`parent_task_id = $${p++}`); values.push(toDbValue(input.parent_task_id)); }
        if (input.visibility !== undefined) { updates.push(`visibility = $${p++}`); values.push(input.visibility); }

        if (!updates.length) return existing;

        updates.push(`updated_at = NOW()`);
        values.push(id);

        await pool.query(
            `UPDATE project_tasks SET ${updates.join(', ')} WHERE id = $${p} AND is_active = true`,
            values
        );

        return (await this.findTaskById(id))!;
    }

    static async deleteTask(id: string): Promise<void> {
        const existing = await this.findTaskById(id);
        if (!existing) throw new AppError(404, 'Task not found');

        // Check if there are subtasks
        const { rows } = await pool.query(
            `SELECT COUNT(*) FROM project_subtasks WHERE task_id = $1 AND is_active = true`,
            [id]
        );
        if (parseInt(rows[0].count, 10) > 0) {
            throw new AppError(409, 'Cannot delete task with active subtasks');
        }

        await pool.query(
            `UPDATE project_tasks SET is_active = false, updated_at = NOW() WHERE id = $1`,
            [id]
        );
    }

    static async getTaskStats(projectId?: string): Promise<ProjectStats> {
        const conditions: string[] = ['t.is_active = true'];
        const values: unknown[] = [];
        let p = 1;

        if (projectId) {
            conditions.push(`t.project_id = $${p}`);
            values.push(projectId);
            p++;
        }

        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

        const { rows } = await pool.query(
            `SELECT
             COUNT(*) FILTER (WHERE t.status = 'todo') AS todo,
             COUNT(*) FILTER (WHERE t.status = 'inprogress') AS inprogress,
             COUNT(*) FILTER (WHERE t.status = 'done') AS done,
             COUNT(*) FILTER (WHERE t.status = 'overdue') AS overdue,
             COUNT(*) FILTER (WHERE t.status = 'pending_approval') AS pending_approval,
             COUNT(*) FILTER (WHERE t.status = 'blocked') AS blocked,
             COUNT(*) FILTER (WHERE t.status = 'review') AS review,
             COUNT(*) AS total
             FROM project_tasks t
             ${where}`,
            values
        );

        const row = rows[0] || {};
        return {
            todo: parseInt(row.todo || '0', 10),
            inprogress: parseInt(row.inprogress || '0', 10),
            done: parseInt(row.done || '0', 10),
            overdue: parseInt(row.overdue || '0', 10),
            pending_approval: parseInt(row.pending_approval || '0', 10),
            blocked: parseInt(row.blocked || '0', 10),
            review: parseInt(row.review || '0', 10),
            total: parseInt(row.total || '0', 10),
        };
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  SUBTASK OPERATIONS
    // ═══════════════════════════════════════════════════════════════════════════

    static async createSubtask(taskId: string, input: CreateProjectSubtaskInput): Promise<ProjectSubtask> {
        const task = await this.findTaskById(taskId);
        if (!task) throw new AppError(404, 'Task not found');

        const { rows } = await pool.query(
            `INSERT INTO project_subtasks (task_id, title, description, assigned_to)
             VALUES ($1, $2, $3, $4)
             RETURNING id`,
            [
                taskId,
                input.title.trim(),
                toDbValue(input.description),
                toDbValue(input.assigned_to),
            ]
        );

        const { rows: subtaskRows } = await pool.query(
            `SELECT ${SUBTASK_SELECT} FROM project_subtasks s WHERE s.id = $1`,
            [rows[0].id]
        );

        return subtaskRows[0];
    }

    static async updateSubtask(taskId: string, subtaskId: string, input: UpdateProjectSubtaskInput): Promise<ProjectSubtask> {
        const { rows: existing } = await pool.query(
            `SELECT id FROM project_subtasks WHERE id = $1 AND task_id = $2 AND is_active = true`,
            [subtaskId, taskId]
        );
        if (!existing.length) throw new AppError(404, 'Subtask not found');

        const updates: string[] = [];
        const values: unknown[] = [];
        let p = 1;

        if (input.title !== undefined) { updates.push(`title = $${p++}`); values.push(input.title.trim()); }
        if (input.description !== undefined) { updates.push(`description = $${p++}`); values.push(toDbValue(input.description)); }
        if (input.completed !== undefined) { updates.push(`completed = $${p++}`); values.push(input.completed); }
        if (input.assigned_to !== undefined) { updates.push(`assigned_to = $${p++}`); values.push(toDbValue(input.assigned_to)); }

        if (!updates.length) {
            const { rows: subtaskRows } = await pool.query(
                `SELECT ${SUBTASK_SELECT} FROM project_subtasks s WHERE s.id = $1`,
                [subtaskId]
            );
            return subtaskRows[0];
        }

        updates.push(`updated_at = NOW()`);
        values.push(subtaskId);

        await pool.query(
            `UPDATE project_subtasks SET ${updates.join(', ')} WHERE id = $${p} AND is_active = true`,
            values
        );

        const { rows: subtaskRows } = await pool.query(
            `SELECT ${SUBTASK_SELECT} FROM project_subtasks s WHERE s.id = $1`,
            [subtaskId]
        );

        return subtaskRows[0];
    }

    static async deleteSubtask(taskId: string, subtaskId: string): Promise<void> {
        const { rows } = await pool.query(
            `UPDATE project_subtasks SET is_active = false
             WHERE id = $1 AND task_id = $2
             RETURNING id`,
            [subtaskId, taskId]
        );
        if (!rows.length) throw new AppError(404, 'Subtask not found');
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  COMMENT OPERATIONS
    // ═══════════════════════════════════════════════════════════════════════════

    static async createComment(taskId: string, input: CreateProjectCommentInput, userId: string): Promise<ProjectTaskComment> {
        const task = await this.findTaskById(taskId);
        if (!task) throw new AppError(404, 'Task not found');

        const { rows } = await pool.query(
            `INSERT INTO project_task_comments (task_id, user_id, content)
             VALUES ($1, $2, $3)
             RETURNING id`,
            [taskId, userId, input.content.trim()]
        );

        const { rows: commentRows } = await pool.query(
            `SELECT id, task_id, user_id, content, created_at, updated_at
             FROM project_task_comments
             WHERE id = $1`,
            [rows[0].id]
        );

        return commentRows[0];
    }

    static async updateComment(taskId: string, commentId: string, input: UpdateProjectCommentInput): Promise<ProjectTaskComment> {
        const { rows: existing } = await pool.query(
            `SELECT id FROM project_task_comments WHERE id = $1 AND task_id = $2`,
            [commentId, taskId]
        );
        if (!existing.length) throw new AppError(404, 'Comment not found');

        await pool.query(
            `UPDATE project_task_comments
             SET content = $1, updated_at = NOW()
             WHERE id = $2`,
            [input.content.trim(), commentId]
        );

        const { rows: commentRows } = await pool.query(
            `SELECT id, task_id, user_id, content, created_at, updated_at
             FROM project_task_comments
             WHERE id = $1`,
            [commentId]
        );

        return commentRows[0];
    }

    static async deleteComment(taskId: string, commentId: string): Promise<void> {
        const { rows } = await pool.query(
            `DELETE FROM project_task_comments WHERE id = $1 AND task_id = $2 RETURNING id`,
            [commentId, taskId]
        );
        if (!rows.length) throw new AppError(404, 'Comment not found');
    }
}