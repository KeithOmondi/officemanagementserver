// src/features/standalone/standalone.service.ts
import { pool } from '../../config/db';
import { AppError } from '../../utils/response';
import type {
    StandaloneTask,
    StandaloneTaskSubtask,
    StandaloneTaskComment,
    StandaloneTaskAttachment,
    StandaloneTaskHistory,
    StandaloneTaskPaginationResponse,
    StandaloneTaskStats,
    CreateStandaloneTaskInput,
    UpdateStandaloneTaskInput,
    CreateStandaloneSubtaskInput,
    UpdateStandaloneSubtaskInput,
    CreateStandaloneCommentInput,
    UpdateStandaloneCommentInput,
    StandaloneTaskFilters,
    RecurrenceType,
} from './standalone.types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const toDbValue = <T>(value: T | null | undefined): T | null => {
    if (value === undefined) return null;
    return value as T;
};

const ALLOWED_SORT = new Set(['created_at', 'end_date', 'priority', 'status', 'title']);

// ─── SELECT Fragments ────────────────────────────────────────────────────────

// src/features/standalone/standalone.service.ts

const TASK_SELECT = `
     t.id, t.title, t.description, t.status, t.priority,
    t.assigned_to, au.full_name AS assigned_to_name,
    t.assigned_to_team, ad.name AS assigned_to_team_name,
    t.created_by, t.created_by_name,
    t.start_date, t.end_date,
    t.estimated_hours, t.actual_hours,
    t.is_recurring, t.recurrence_type, t.recurrence_end_date,
    t.parent_task_id,
    t.is_active, t.is_archived,
    t.created_at, t.updated_at,
    COALESCE(
        (SELECT json_agg(jsonb_build_object(
            'id', s.id,
            'task_id', s.task_id,
            'title', s.title,
            'description', s.description,
            'completed', s.completed,
            'is_active', s.is_active,
            'created_at', s.created_at,
            'updated_at', s.updated_at
        )) 
        FROM standalone_subtasks s 
        WHERE s.task_id = t.id AND s.is_active = true)
    , '[]'::json) AS subtasks,
    COALESCE(
        (SELECT json_agg(jsonb_build_object(
            'id', c.id,
            'task_id', c.task_id,
            'user_id', c.user_id,
            'user_name', c.user_name,
            'content', c.content,
            'created_at', c.created_at,
            'updated_at', c.updated_at
        )) 
        FROM standalone_comments c 
        WHERE c.task_id = t.id)
    , '[]'::json) AS comments,
    COALESCE(
        (SELECT json_agg(jsonb_build_object(
            'id', a.id,
            'task_id', a.task_id,
            'file_name', a.file_name,
            'file_url', a.file_url,
            'file_size', a.file_size,
            'mime_type', a.mime_type,
            'uploaded_by', a.uploaded_by,
            'uploaded_by_name', a.uploaded_by_name,
            'created_at', a.created_at
        )) 
        FROM standalone_attachments a 
        WHERE a.task_id = t.id)
    , '[]'::json) AS attachments,
    COALESCE(
        (SELECT json_agg(jsonb_build_object(
            'id', h.id,
            'task_id', h.task_id,
            'user_id', h.user_id,
            'user_name', h.user_name,
            'field', h.field,
            'old_value', h.old_value,
            'new_value', h.new_value,
            'created_at', h.created_at
        )) 
        FROM standalone_task_history h 
        WHERE h.task_id = t.id)
    , '[]'::json) AS history
`;
const TASK_JOIN = `
    FROM standalone_tasks t
    LEFT JOIN users au ON au.id = t.assigned_to
    LEFT JOIN departments ad ON ad.id = t.assigned_to_team
`;

const SUBTASK_SELECT = `
    s.id, s.task_id, s.title, s.description, s.completed, s.is_active,
    s.created_at, s.updated_at
`;

const COMMENT_SELECT = `
    c.id, c.task_id, c.user_id, c.user_name, c.content,
    c.created_at, c.updated_at
`;

const ATTACHMENT_SELECT = `
    a.id, a.task_id, a.file_name, a.file_url, a.file_size, a.mime_type,
    a.uploaded_by, a.uploaded_by_name, a.created_at
`;

// ─── Service ─────────────────────────────────────────────────────────────────

export class StandaloneTaskService {

    // ═══════════════════════════════════════════════════════════════════════════
    //  TASK OPERATIONS
    // ═══════════════════════════════════════════════════════════════════════════

    static async createTask(input: CreateStandaloneTaskInput, userId: string, userName: string): Promise<StandaloneTask> {
        // Check if assigned_to is a valid user
        if (input.assigned_to) {
            const { rows } = await pool.query(
                `SELECT id FROM users WHERE id = $1 AND is_active = true`,
                [input.assigned_to]
            );
            if (rows.length === 0) {
                throw new AppError(404, 'Assigned user not found');
            }
        }

        // Check if assigned_to_team is a valid department
        if (input.assigned_to_team) {
            const { rows } = await pool.query(
                `SELECT id FROM departments WHERE id = $1 AND is_active = true`,
                [input.assigned_to_team]
            );
            if (rows.length === 0) {
                throw new AppError(404, 'Assigned team not found');
            }
        }

        const { rows } = await pool.query(
            `INSERT INTO standalone_tasks (
                title, description, status, priority,
                assigned_to, assigned_to_name, assigned_to_team, assigned_to_team_name,
                created_by, created_by_name,
                start_date, end_date,
                estimated_hours, actual_hours,
                is_recurring, recurrence_type, recurrence_end_date
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
            RETURNING id`,
            [
                input.title.trim(),
                toDbValue(input.description),
                input.status || 'pending',
                input.priority || 'normal',
                toDbValue(input.assigned_to),
                null, // assigned_to_name will be populated on fetch
                toDbValue(input.assigned_to_team),
                null, // assigned_to_team_name will be populated on fetch
                userId,
                userName,
                toDbValue(input.start_date),
                input.end_date,
                toDbValue(input.estimated_hours),
                null, // actual_hours initially null
                input.is_recurring || false,
                input.recurrence_type || 'none',
                toDbValue(input.recurrence_end_date),
            ]
        );

        const taskId = rows[0].id;

        // Log creation in history
        await this.logHistory(taskId, userId, userName, 'created', null, 'Task created');

        // If recurring, generate child tasks
        if (input.is_recurring && input.recurrence_type !== 'none' && input.recurrence_end_date) {
            await this.generateRecurringTasks(taskId, userId, userName);
        }

        return (await this.findTaskById(taskId))!;
    }

    static async findAllTasks(filters: StandaloneTaskFilters, userId?: string, userRole?: string): Promise<StandaloneTaskPaginationResponse> {
        const {
            status, priority, assigned_to, assigned_to_team,
            search, start_date_from, start_date_to,
            end_date_from, end_date_to,
            is_archived,
            page = 1, limit = 20,
            sort_by = 'created_at', sort_order = 'DESC',
        } = filters;

        const sortCol = ALLOWED_SORT.has(sort_by) ? `t.${sort_by}` : 't.created_at';
        const sortDir = sort_order === 'ASC' ? 'ASC' : 'DESC';
        const offset = (page - 1) * limit;

        const conditions: string[] = ['t.is_active = true'];
        const values: unknown[] = [];
        let p = 1;

        // Permission filter: Only show tasks the user can see
        if (userId && userRole !== 'super_admin') {
            conditions.push(`(
                t.assigned_to = $${p} OR 
                t.created_by = $${p} OR 
                t.assigned_to_team IN (SELECT department_id FROM users WHERE id = $${p})
            )`);
            values.push(userId);
            p++;
        }

        if (status) { conditions.push(`t.status = $${p}`); values.push(status); p++; }
        if (priority) { conditions.push(`t.priority = $${p}`); values.push(priority); p++; }
        if (assigned_to) { conditions.push(`t.assigned_to = $${p}`); values.push(assigned_to); p++; }
        if (assigned_to_team) { conditions.push(`t.assigned_to_team = $${p}`); values.push(assigned_to_team); p++; }
        if (is_archived !== undefined) { conditions.push(`t.is_archived = $${p}`); values.push(is_archived); p++; }
        if (search) {
            conditions.push(`(t.title ILIKE $${p} OR t.description ILIKE $${p})`);
            values.push(`%${search}%`);
            p++;
        }
        if (start_date_from) { conditions.push(`t.start_date >= $${p}`); values.push(start_date_from); p++; }
        if (start_date_to) { conditions.push(`t.start_date <= $${p}`); values.push(start_date_to); p++; }
        if (end_date_from) { conditions.push(`t.end_date >= $${p}`); values.push(end_date_from); p++; }
        if (end_date_to) { conditions.push(`t.end_date <= $${p}`); values.push(end_date_to); p++; }

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
                attachments: row.attachments || [],
                history: row.history || [],
            })),
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    static async findTaskById(id: string): Promise<StandaloneTask | null> {
        const { rows } = await pool.query(
            `SELECT ${TASK_SELECT} ${TASK_JOIN} WHERE t.id = $1 AND t.is_active = true`,
            [id]
        );
        if (!rows[0]) return null;
        return {
            ...rows[0],
            subtasks: rows[0].subtasks || [],
            comments: rows[0].comments || [],
            attachments: rows[0].attachments || [],
            history: rows[0].history || [],
        };
    }

    static async updateTask(id: string, input: UpdateStandaloneTaskInput, userId: string, userName: string): Promise<StandaloneTask> {
        const existing = await this.findTaskById(id);
        if (!existing) throw new AppError(404, 'Task not found');

        // Check permission: Only super_admin or creator can edit
        // (Assignee can only update status)
        // We'll handle this at the controller level

        const updates: string[] = [];
        const values: unknown[] = [];
        let p = 1;

        // Track changes for history
        const changes: { field: string; old_value: string | null; new_value: string | null }[] = [];

        const addUpdate = (field: string, value: any, oldValue: any) => {
            if (value !== undefined && value !== oldValue) {
                updates.push(`${field} = $${p++}`);
                values.push(toDbValue(value));
                changes.push({
                    field,
                    old_value: oldValue !== null && oldValue !== undefined ? String(oldValue) : null,
                    new_value: value !== null && value !== undefined ? String(value) : null,
                });
            }
        };

        if (input.title !== undefined) { addUpdate('title', input.title, existing.title); }
        if (input.description !== undefined) { addUpdate('description', input.description, existing.description); }
        if (input.status !== undefined) { addUpdate('status', input.status, existing.status); }
        if (input.priority !== undefined) { addUpdate('priority', input.priority, existing.priority); }
        if (input.assigned_to !== undefined) { 
            // If assigned_to changed, update the name too
            if (input.assigned_to !== existing.assigned_to) {
                addUpdate('assigned_to', input.assigned_to, existing.assigned_to);
                if (input.assigned_to) {
                    const { rows } = await pool.query(
                        `SELECT full_name FROM users WHERE id = $1`,
                        [input.assigned_to]
                    );
                    const name = rows[0]?.full_name || null;
                    addUpdate('assigned_to_name', name, existing.assigned_to_name);
                    updates.push(`assigned_to_name = $${p++}`);
                    values.push(name);
                } else {
                    addUpdate('assigned_to_name', null, existing.assigned_to_name);
                }
            }
        }
        if (input.assigned_to_team !== undefined) {
            if (input.assigned_to_team !== existing.assigned_to_team) {
                addUpdate('assigned_to_team', input.assigned_to_team, existing.assigned_to_team);
                if (input.assigned_to_team) {
                    const { rows } = await pool.query(
                        `SELECT name FROM departments WHERE id = $1`,
                        [input.assigned_to_team]
                    );
                    const name = rows[0]?.name || null;
                    addUpdate('assigned_to_team_name', name, existing.assigned_to_team_name);
                    updates.push(`assigned_to_team_name = $${p++}`);
                    values.push(name);
                } else {
                    addUpdate('assigned_to_team_name', null, existing.assigned_to_team_name);
                }
            }
        }
        if (input.start_date !== undefined) { addUpdate('start_date', input.start_date, existing.start_date); }
        if (input.end_date !== undefined) { addUpdate('end_date', input.end_date, existing.end_date); }
        if (input.estimated_hours !== undefined) { addUpdate('estimated_hours', input.estimated_hours, existing.estimated_hours); }
        if (input.actual_hours !== undefined) { addUpdate('actual_hours', input.actual_hours, existing.actual_hours); }
        if (input.is_recurring !== undefined) { addUpdate('is_recurring', input.is_recurring, existing.is_recurring); }
        if (input.recurrence_type !== undefined) { addUpdate('recurrence_type', input.recurrence_type, existing.recurrence_type); }
        if (input.recurrence_end_date !== undefined) { addUpdate('recurrence_end_date', input.recurrence_end_date, existing.recurrence_end_date); }
        if (input.is_archived !== undefined) { addUpdate('is_archived', input.is_archived, existing.is_archived); }

        if (!updates.length) return existing;

        updates.push(`updated_at = NOW()`);
        values.push(id);

        await pool.query(
            `UPDATE standalone_tasks SET ${updates.join(', ')} WHERE id = $${p} AND is_active = true`,
            values
        );

        // Log all changes in history
        for (const change of changes) {
            await this.logHistory(id, userId, userName, change.field, change.old_value, change.new_value);
        }

        return (await this.findTaskById(id))!;
    }

    static async deleteTask(id: string, userId: string, userName: string): Promise<void> {
        const existing = await this.findTaskById(id);
        if (!existing) throw new AppError(404, 'Task not found');

        // Check if there are subtasks
        const { rows } = await pool.query(
            `SELECT COUNT(*) FROM standalone_subtasks WHERE task_id = $1 AND is_active = true`,
            [id]
        );
        if (parseInt(rows[0].count, 10) > 0) {
            throw new AppError(409, 'Cannot delete task with active subtasks');
        }

        // Log deletion in history
        await this.logHistory(id, userId, userName, 'deleted', null, 'Task deleted');

        await pool.query(
            `UPDATE standalone_tasks SET is_active = false, updated_at = NOW() WHERE id = $1`,
            [id]
        );
    }

    static async archiveTask(id: string, userId: string, userName: string): Promise<StandaloneTask> {
        const existing = await this.findTaskById(id);
        if (!existing) throw new AppError(404, 'Task not found');

        if (existing.status !== 'complete') {
            throw new AppError(400, 'Only completed tasks can be archived');
        }

        await pool.query(
            `UPDATE standalone_tasks SET is_archived = true, updated_at = NOW() WHERE id = $1`,
            [id]
        );

        await this.logHistory(id, userId, userName, 'archived', 'false', 'true');

        return (await this.findTaskById(id))!;
    }

    static async unarchiveTask(id: string, userId: string, userName: string): Promise<StandaloneTask> {
        const existing = await this.findTaskById(id);
        if (!existing) throw new AppError(404, 'Task not found');

        await pool.query(
            `UPDATE standalone_tasks SET is_archived = false, updated_at = NOW() WHERE id = $1`,
            [id]
        );

        await this.logHistory(id, userId, userName, 'archived', 'true', 'false');

        return (await this.findTaskById(id))!;
    }

    static async getTaskStats(userId?: string, userRole?: string): Promise<StandaloneTaskStats> {
        const conditions: string[] = ['t.is_active = true', 't.is_archived = false'];
        const values: unknown[] = [];
        let p = 1;

        if (userId && userRole !== 'super_admin') {
            conditions.push(`(
                t.assigned_to = $${p} OR 
                t.created_by = $${p} OR 
                t.assigned_to_team IN (SELECT department_id FROM users WHERE id = $${p})
            )`);
            values.push(userId);
            p++;
        }

        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

        const { rows } = await pool.query(
            `SELECT
             COUNT(*) FILTER (WHERE t.status = 'pending') AS pending,
             COUNT(*) FILTER (WHERE t.status = 'in_progress') AS in_progress,
             COUNT(*) FILTER (WHERE t.status = 'complete') AS complete,
             COUNT(*) FILTER (WHERE t.status != 'complete' AND t.end_date < NOW()) AS overdue,
             COUNT(*) AS total
             FROM standalone_tasks t
             ${where}`,
            values
        );

        const row = rows[0] || {};
        return {
            pending: parseInt(row.pending || '0', 10),
            in_progress: parseInt(row.in_progress || '0', 10),
            complete: parseInt(row.complete || '0', 10),
            overdue: parseInt(row.overdue || '0', 10),
            total: parseInt(row.total || '0', 10),
        };
    }

    static async updateTaskStatus(id: string, status: string, userId: string, userName: string): Promise<StandaloneTask> {
        const existing = await this.findTaskById(id);
        if (!existing) throw new AppError(404, 'Task not found');

        // Only assignee can mark complete
        if (status === 'complete' && existing.assigned_to !== userId) {
            // Check if user is super_admin or creator
            // This will be handled at controller level
        }

        await pool.query(
            `UPDATE standalone_tasks SET status = $1, updated_at = NOW() WHERE id = $2`,
            [status, id]
        );

        await this.logHistory(id, userId, userName, 'status', existing.status, status);

        // If marking complete, archive automatically
        if (status === 'complete') {
            await pool.query(
                `UPDATE standalone_tasks SET is_archived = true, updated_at = NOW() WHERE id = $1`,
                [id]
            );
            await this.logHistory(id, userId, userName, 'archived', 'false', 'true');
        }

        return (await this.findTaskById(id))!;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  RECURRING TASKS
    // ═══════════════════════════════════════════════════════════════════════════

    static async generateRecurringTasks(taskId: string, userId: string, userName: string): Promise<void> {
        const task = await this.findTaskById(taskId);
        if (!task) throw new AppError(404, 'Task not found');

        if (!task.is_recurring || task.recurrence_type === 'none') {
            throw new AppError(400, 'Task is not set to recur');
        }

        const endDate = new Date(task.recurrence_end_date!);
        const startDate = new Date(task.end_date);
        const currentDate = new Date(startDate);

        const tasks: CreateStandaloneTaskInput[] = [];
        let count = 0;

        while (currentDate < endDate) {
            count++;
            // Calculate next date based on recurrence type
            switch (task.recurrence_type) {
                case 'daily':
                    currentDate.setDate(currentDate.getDate() + 1);
                    break;
                case 'weekly':
                    currentDate.setDate(currentDate.getDate() + 7);
                    break;
                case 'monthly':
                    currentDate.setMonth(currentDate.getMonth() + 1);
                    break;
                default:
                    break;
            }

            if (currentDate > endDate) break;

            // Create child task
            const childTask: CreateStandaloneTaskInput = {
                title: `${task.title} (${task.recurrence_type})`,
                description: task.description,
                status: 'pending',
                priority: task.priority,
                assigned_to: task.assigned_to,
                assigned_to_team: task.assigned_to_team,
                start_date: task.start_date ? new Date(task.start_date).toISOString() : null,
                end_date: currentDate.toISOString(),
                estimated_hours: task.estimated_hours,
                is_recurring: false,
                recurrence_type: 'none',
                recurrence_end_date: null,
            };

            await this.createTask(childTask, userId, userName);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  SUBTASK OPERATIONS
    // ═══════════════════════════════════════════════════════════════════════════

    static async createSubtask(taskId: string, input: CreateStandaloneSubtaskInput, userId: string, userName: string): Promise<StandaloneTaskSubtask> {
        const task = await this.findTaskById(taskId);
        if (!task) throw new AppError(404, 'Task not found');

        const { rows } = await pool.query(
            `INSERT INTO standalone_subtasks (task_id, title, description)
             VALUES ($1, $2, $3)
             RETURNING id`,
            [
                taskId,
                input.title.trim(),
                toDbValue(input.description),
            ]
        );

        await this.logHistory(taskId, userId, userName, 'subtask_added', null, input.title);

        const { rows: subtaskRows } = await pool.query(
            `SELECT ${SUBTASK_SELECT} FROM standalone_subtasks s WHERE s.id = $1`,
            [rows[0].id]
        );

        return subtaskRows[0];
    }

    static async updateSubtask(taskId: string, subtaskId: string, input: UpdateStandaloneSubtaskInput, userId: string, userName: string): Promise<StandaloneTaskSubtask> {
        const { rows: existing } = await pool.query(
            `SELECT id, completed FROM standalone_subtasks WHERE id = $1 AND task_id = $2 AND is_active = true`,
            [subtaskId, taskId]
        );
        if (!existing.length) throw new AppError(404, 'Subtask not found');

        const updates: string[] = [];
        const values: unknown[] = [];
        let p = 1;

        if (input.title !== undefined) { updates.push(`title = $${p++}`); values.push(input.title.trim()); }
        if (input.description !== undefined) { updates.push(`description = $${p++}`); values.push(toDbValue(input.description)); }
        if (input.completed !== undefined) { 
            updates.push(`completed = $${p++}`); 
            values.push(input.completed);
            await this.logHistory(taskId, userId, userName, 'subtask_completed', String(existing[0].completed), String(input.completed));
        }

        if (!updates.length) {
            const { rows: subtaskRows } = await pool.query(
                `SELECT ${SUBTASK_SELECT} FROM standalone_subtasks s WHERE s.id = $1`,
                [subtaskId]
            );
            return subtaskRows[0];
        }

        updates.push(`updated_at = NOW()`);
        values.push(subtaskId);

        await pool.query(
            `UPDATE standalone_subtasks SET ${updates.join(', ')} WHERE id = $${p} AND is_active = true`,
            values
        );

        const { rows: subtaskRows } = await pool.query(
            `SELECT ${SUBTASK_SELECT} FROM standalone_subtasks s WHERE s.id = $1`,
            [subtaskId]
        );

        return subtaskRows[0];
    }

    static async deleteSubtask(taskId: string, subtaskId: string, userId: string, userName: string): Promise<void> {
        const { rows } = await pool.query(
            `UPDATE standalone_subtasks SET is_active = false
             WHERE id = $1 AND task_id = $2
             RETURNING id`,
            [subtaskId, taskId]
        );
        if (!rows.length) throw new AppError(404, 'Subtask not found');

        await this.logHistory(taskId, userId, userName, 'subtask_deleted', null, 'Subtask deleted');
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  COMMENT OPERATIONS
    // ═══════════════════════════════════════════════════════════════════════════

    static async createComment(taskId: string, input: CreateStandaloneCommentInput, userId: string, userName: string): Promise<StandaloneTaskComment> {
        const task = await this.findTaskById(taskId);
        if (!task) throw new AppError(404, 'Task not found');

        const { rows } = await pool.query(
            `INSERT INTO standalone_comments (task_id, user_id, user_name, content)
             VALUES ($1, $2, $3, $4)
             RETURNING id`,
            [taskId, userId, userName, input.content.trim()]
        );

        await this.logHistory(taskId, userId, userName, 'comment_added', null, 'Comment added');

        const { rows: commentRows } = await pool.query(
            `SELECT ${COMMENT_SELECT} FROM standalone_comments c WHERE c.id = $1`,
            [rows[0].id]
        );

        return commentRows[0];
    }

    static async updateComment(taskId: string, commentId: string, input: UpdateStandaloneCommentInput, userId: string, userName: string): Promise<StandaloneTaskComment> {
        const { rows: existing } = await pool.query(
            `SELECT id FROM standalone_comments WHERE id = $1 AND task_id = $2`,
            [commentId, taskId]
        );
        if (!existing.length) throw new AppError(404, 'Comment not found');

        await pool.query(
            `UPDATE standalone_comments
             SET content = $1, updated_at = NOW()
             WHERE id = $2`,
            [input.content.trim(), commentId]
        );

        await this.logHistory(taskId, userId, userName, 'comment_updated', null, 'Comment updated');

        const { rows: commentRows } = await pool.query(
            `SELECT ${COMMENT_SELECT} FROM standalone_comments c WHERE c.id = $1`,
            [commentId]
        );

        return commentRows[0];
    }

    static async deleteComment(taskId: string, commentId: string, userId: string, userName: string): Promise<void> {
        const { rows } = await pool.query(
            `DELETE FROM standalone_comments WHERE id = $1 AND task_id = $2 RETURNING id`,
            [commentId, taskId]
        );
        if (!rows.length) throw new AppError(404, 'Comment not found');

        await this.logHistory(taskId, userId, userName, 'comment_deleted', null, 'Comment deleted');
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  ATTACHMENT OPERATIONS
    // ═══════════════════════════════════════════════════════════════════════════

    static async createAttachment(
        taskId: string,
        fileData: {
            file_name: string;
            file_url: string;
            file_size: number;
            mime_type: string;
        },
        userId: string,
        userName: string
    ): Promise<StandaloneTaskAttachment> {
        const task = await this.findTaskById(taskId);
        if (!task) throw new AppError(404, 'Task not found');

        const { rows } = await pool.query(
            `INSERT INTO standalone_attachments (
                task_id, file_name, file_url, file_size, mime_type,
                uploaded_by, uploaded_by_name
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id`,
            [
                taskId,
                fileData.file_name,
                fileData.file_url,
                fileData.file_size,
                fileData.mime_type,
                userId,
                userName,
            ]
        );

        await this.logHistory(taskId, userId, userName, 'attachment_added', null, fileData.file_name);

        const { rows: attachmentRows } = await pool.query(
            `SELECT ${ATTACHMENT_SELECT} FROM standalone_attachments a WHERE a.id = $1`,
            [rows[0].id]
        );

        return attachmentRows[0];
    }

    static async deleteAttachment(taskId: string, attachmentId: string, userId: string, userName: string): Promise<void> {
        const { rows } = await pool.query(
            `DELETE FROM standalone_attachments WHERE id = $1 AND task_id = $2 RETURNING file_url`,
            [attachmentId, taskId]
        );
        if (!rows.length) throw new AppError(404, 'Attachment not found');

        await this.logHistory(taskId, userId, userName, 'attachment_deleted', null, 'Attachment deleted');

        // Note: Actual file deletion from storage should be handled by the controller
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  HISTORY OPERATIONS
    // ═══════════════════════════════════════════════════════════════════════════

    static async logHistory(
        taskId: string,
        userId: string,
        userName: string,
        field: string,
        old_value: string | null,
        new_value: string | null
    ): Promise<void> {
        await pool.query(
            `INSERT INTO standalone_task_history (task_id, user_id, user_name, field, old_value, new_value)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [taskId, userId, userName, field, old_value, new_value]
        );
    }

    static async getTaskHistory(taskId: string): Promise<StandaloneTaskHistory[]> {
        const { rows } = await pool.query(
            `SELECT id, task_id, user_id, user_name, field, old_value, new_value, created_at
             FROM standalone_task_history
             WHERE task_id = $1
             ORDER BY created_at DESC`,
            [taskId]
        );
        return rows;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  PERMISSION CHECKS
    // ═══════════════════════════════════════════════════════════════════════════

    static async canViewTask(taskId: string, userId: string, userRole: string): Promise<boolean> {
        if (userRole === 'super_admin') return true;

        const task = await this.findTaskById(taskId);
        if (!task) return false;

        // Creator can view
        if (task.created_by === userId) return true;

        // Assignee can view
        if (task.assigned_to === userId) return true;

        // Team member can view if assigned to team
        if (task.assigned_to_team) {
            const { rows } = await pool.query(
                `SELECT id FROM users WHERE id = $1 AND department_id = $2`,
                [userId, task.assigned_to_team]
            );
            if (rows.length > 0) return true;
        }

        return false;
    }

    static async canEditTask(taskId: string, userId: string, userRole: string): Promise<boolean> {
        if (userRole === 'super_admin') return true;

        const task = await this.findTaskById(taskId);
        if (!task) return false;

        // Creator can edit
        if (task.created_by === userId) return true;

        return false;
    }

    static async canDeleteTask(taskId: string, userId: string, userRole: string): Promise<boolean> {
        // Only super_admin can delete
        return userRole === 'super_admin';
    }

    static async canCompleteTask(taskId: string, userId: string, userRole: string): Promise<boolean> {
        if (userRole === 'super_admin') return true;

        const task = await this.findTaskById(taskId);
        if (!task) return false;

        // Assignee can complete
        if (task.assigned_to === userId) return true;

        // Creator can complete
        if (task.created_by === userId) return true;

        return false;
    }
}