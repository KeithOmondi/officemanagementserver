// src/features/projects/projects.service.ts
import { pool } from "../../config/db";
import { AppError } from "../../utils/response";
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
  ProjectFilters,
  CreateProjectSubtaskInput,
  UpdateProjectSubtaskInput,
  CreateProjectCommentInput,
  UpdateProjectCommentInput,
  ProjectUser,
  ProjectTaskStatus,
} from "./projects.types";
import { canTransitionTo } from "./projects.types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const parseTags = (tags: string | string[] | null | undefined): string[] => {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags;
  return tags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
};

const toDbValue = <T>(value: T | null | undefined): T | null => {
  if (value === undefined) return null;
  return value as T;
};

const ALLOWED_SORT = new Set([
  "created_at",
  "deadline",
  "priority",
  "status",
  "title",
  "updated_at",
]);

// ─── SELECT Fragments ────────────────────────────────────────────────────────

const PROJECT_SELECT = `
    p.id, p.title, p.description, p.priority, p.deadline, p.start_date, p.tags,
    p.is_active, p.created_by, p.created_by_name, p.created_at, p.updated_at,
    p.updated_by, p.updated_by_name,
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
    t.assignee, au.full_name AS assignee_name, t.deadline, t.start_date, t.tags,
    t.estimated_hours, t.actual_hours, t.parent_task_id, t.visibility,
    t.is_active, t.created_by, t.created_by_name, t.created_at, t.updated_at,
    t.updated_by, t.updated_by_name, t.completed_at,
    COALESCE((
        SELECT json_agg(jsonb_build_object(
            'id', s.id,
            'task_id', s.task_id,
            'title', s.title,
            'description', s.description,
            'completed', s.completed,
            'is_active', s.is_active,
            'assigned_to', s.assigned_to,
            'assigned_to_name', au2.full_name,
            'created_at', s.created_at,
            'updated_at', s.updated_at
        ))
        FROM project_subtasks s
        LEFT JOIN users au2 ON au2.id = s.assigned_to
        WHERE s.task_id = t.id AND s.is_active = true
    ), '[]'::json) AS subtasks,
    COALESCE((
        SELECT json_agg(jsonb_build_object(
            'id', c.id,
            'task_id', c.task_id,
            'user_id', c.user_id,
            'user_name', u.full_name,
            'content', c.content,
            'created_at', c.created_at,
            'updated_at', c.updated_at
        ))
        FROM project_task_comments c
        LEFT JOIN users u ON u.id = c.user_id
        WHERE c.task_id = t.id
    ), '[]'::json) AS comments
`;

const TASK_JOIN = `
    FROM project_tasks t
    LEFT JOIN users au ON au.id = t.assignee
`;

const SUBTASK_SELECT = `
    s.id, s.task_id, s.title, s.description, s.completed, s.is_active,
    s.assigned_to, au.full_name AS assigned_to_name, s.created_at, s.updated_at
`;

const SUBTASK_JOIN = `
    FROM project_subtasks s
    LEFT JOIN users au ON au.id = s.assigned_to
`;

// ─── Service ─────────────────────────────────────────────────────────────────

export class ProjectService {
  // ═══════════════════════════════════════════════════════════════════════════
  //  PROJECT OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  static async createProject(
    input: CreateProjectInput,
    userId: string,
    userName?: string,
  ): Promise<Project> {
    const { rows } = await pool.query(
      `INSERT INTO projects (title, description, priority, deadline, start_date, tags, created_by, created_by_name)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING id`,
      [
        input.title.trim(),
        toDbValue(input.description),
        input.priority || "normal",
        toDbValue(input.deadline),
        toDbValue(input.start_date),
        input.tags || [],
        userId,
        userName || "System",
      ],
    );

    // Add members
    if (input.member_ids && input.member_ids.length > 0) {
      for (const memberId of input.member_ids) {
        await pool.query(
          `INSERT INTO project_members (project_id, user_id)
                     VALUES ($1, $2)
                     ON CONFLICT (project_id, user_id) DO NOTHING`,
          [rows[0].id, memberId],
        );
      }
    }

    // Add creator as owner
    await pool.query(
      `INSERT INTO project_members (project_id, user_id, role)
             VALUES ($1, $2, 'owner')
             ON CONFLICT (project_id, user_id) DO NOTHING`,
      [rows[0].id, userId],
    );

    return (await this.findProjectById(rows[0].id))!;
  }

  static async findAllProjects(
    filters: ProjectFilters,
    userId?: string,
  ): Promise<ProjectPaginationResponse> {
    const {
      search,
      page = 1,
      limit = 20,
      member_id,
      is_active = true,
      priority,
      deadline_from,
      deadline_to,
    } = filters;
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const values: unknown[] = [];
    let p = 1;

    if (is_active !== undefined) {
      conditions.push(`p.is_active = $${p}`);
      values.push(is_active);
      p++;
    }

    if (userId) {
      conditions.push(
        `EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = $${p} AND pm.is_active = true)`,
      );
      values.push(userId);
      p++;
    }

    if (member_id) {
      conditions.push(
        `EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = $${p} AND pm.is_active = true)`,
      );
      values.push(member_id);
      p++;
    }

    if (search) {
      conditions.push(`(p.title ILIKE $${p} OR p.description ILIKE $${p})`);
      values.push(`%${search}%`);
      p++;
    }

    if (priority) {
      conditions.push(`p.priority = $${p}`);
      values.push(priority);
      p++;
    }

    if (deadline_from) {
      conditions.push(`p.deadline >= $${p}`);
      values.push(deadline_from);
      p++;
    }

    if (deadline_to) {
      conditions.push(`p.deadline <= $${p}`);
      values.push(deadline_to);
      p++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const [countResult, dataResult] = await Promise.all([
      pool.query(`SELECT COUNT(*) AS total FROM projects p ${where}`, values),
      pool.query(
        `SELECT ${PROJECT_SELECT}
                 FROM projects p
                 ${where}
                 ORDER BY p.created_at DESC
                 LIMIT $${p} OFFSET $${p + 1}`,
        [...values, limit, offset],
      ),
    ]);

    const total = parseInt(countResult.rows[0]?.total ?? "0", 10);
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
             WHERE p.id = $1`,
      [id],
    );
    if (!rows[0]) return null;
    return {
      ...rows[0],
      members: rows[0].members || [],
    };
  }

  static async updateProject(
    id: string,
    input: UpdateProjectInput,
    userId?: string,
    userName?: string,
  ): Promise<Project> {
    const existing = await this.findProjectById(id);
    if (!existing) throw new AppError(404, "Project not found");

    const updates: string[] = [];
    const values: unknown[] = [];
    let p = 1;

    if (input.title !== undefined) {
      updates.push(`title = $${p++}`);
      values.push(input.title.trim());
    }
    if (input.description !== undefined) {
      updates.push(`description = $${p++}`);
      values.push(toDbValue(input.description));
    }
    if (input.priority !== undefined) {
      updates.push(`priority = $${p++}`);
      values.push(input.priority);
    }
    if (input.deadline !== undefined) {
      updates.push(`deadline = $${p++}`);
      values.push(toDbValue(input.deadline));
    }
    if (input.start_date !== undefined) {
      updates.push(`start_date = $${p++}`);
      values.push(toDbValue(input.start_date));
    }
    if (input.tags !== undefined) {
      updates.push(`tags = $${p++}`);
      values.push(input.tags || []);
    }
    if (input.is_active !== undefined) {
      updates.push(`is_active = $${p++}`);
      values.push(input.is_active);
    }

    // Update members if provided
    if (input.member_ids !== undefined) {
      // Deactivate all existing members
      await pool.query(
        `UPDATE project_members SET is_active = false WHERE project_id = $1`,
        [id],
      );
      // Add new members
      for (const memberId of input.member_ids) {
        await pool.query(
          `INSERT INTO project_members (project_id, user_id, is_active)
                     VALUES ($1, $2, true)
                     ON CONFLICT (project_id, user_id) DO UPDATE SET is_active = true`,
          [id, memberId],
        );
      }
    }

    if (!updates.length) return existing;

    updates.push(`updated_at = NOW()`);
    if (userId) {
      updates.push(`updated_by = $${p++}`);
      values.push(userId);
    }
    if (userName) {
      updates.push(`updated_by_name = $${p++}`);
      values.push(userName);
    }
    values.push(id);

    await pool.query(
      `UPDATE projects SET ${updates.join(", ")} WHERE id = $${p}`,
      values,
    );

    return (await this.findProjectById(id))!;
  }

  static async deleteProject(id: string): Promise<void> {
    const existing = await this.findProjectById(id);
    if (!existing) throw new AppError(404, "Project not found");

    // Check if there are active tasks
    const { rows } = await pool.query(
      `SELECT COUNT(*) FROM project_tasks WHERE project_id = $1 AND is_active = true`,
      [id],
    );
    if (parseInt(rows[0].count, 10) > 0) {
      throw new AppError(
        409,
        "Cannot delete project with active tasks. Please delete or complete all tasks first.",
      );
    }

    await pool.query(
      `UPDATE projects SET is_active = false, updated_at = NOW() WHERE id = $1`,
      [id],
    );
  }

  static async getProjectMembers(projectId: string): Promise<ProjectUser[]> {
    const { rows } = await pool.query(
      `SELECT u.id, u.full_name, u.pj_number, u.email
             FROM project_members pm
             JOIN users u ON u.id = pm.user_id
             WHERE pm.project_id = $1 AND pm.is_active = true AND u.is_active = true`,
      [projectId],
    );
    return rows;
  }

  static async addProjectMember(
    projectId: string,
    userId: string,
  ): Promise<void> {
    const project = await this.findProjectById(projectId);
    if (!project) throw new AppError(404, "Project not found");

    await pool.query(
      `INSERT INTO project_members (project_id, user_id)
             VALUES ($1, $2)
             ON CONFLICT (project_id, user_id) DO UPDATE SET is_active = true`,
      [projectId, userId],
    );
  }

  static async removeProjectMember(
    projectId: string,
    userId: string,
  ): Promise<void> {
    await pool.query(
      `UPDATE project_members SET is_active = false
             WHERE project_id = $1 AND user_id = $2`,
      [projectId, userId],
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  TASK OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  static async createTask(
    input: CreateProjectTaskInput,
    userId: string,
    userName?: string,
  ): Promise<ProjectTask> {
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
        input.status || "inprogress",
        input.priority || "normal",
        input.type || null,
        toDbValue(input.assignee),
        toDbValue(input.deadline),
        toDbValue(input.start_date),
        tags.length > 0 ? tags : [],
        toDbValue(input.estimated_hours),
        toDbValue(input.parent_task_id),
        input.visibility || "team",
        userId,
        userName || "System",
      ],
    );

    return (await this.findTaskById(rows[0].id))!;
  }

  static async findAllTasks(
    filters: ProjectTaskFilters,
    userId?: string,
  ): Promise<ProjectTaskPaginationResponse> {
    const {
      project_id,
      status,
      priority,
      type,
      assignee,
      assigned_to_me,
      tags,
      search,
      deadline_from,
      deadline_to,
      page = 1,
      limit = 20,
      sort_by = "created_at",
      sort_order = "DESC",
    } = filters;

    const sortCol = ALLOWED_SORT.has(sort_by) ? `t.${sort_by}` : "t.created_at";
    const sortDir = sort_order === "ASC" ? "ASC" : "DESC";
    const offset = (page - 1) * limit;

    const conditions: string[] = ["t.is_active = true"];
    const values: unknown[] = [];
    let p = 1;

    if (userId) {
      conditions.push(
        `EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = t.project_id AND pm.user_id = $${p} AND pm.is_active = true)`,
      );
      values.push(userId);
      p++;
    }

    if (assigned_to_me && userId) {
      conditions.push(`t.assignee = $${p}`);
      values.push(userId);
      p++;
    }

    if (project_id) {
      conditions.push(`t.project_id = $${p}`);
      values.push(project_id);
      p++;
    }
    if (status) {
      conditions.push(`t.status = $${p}`);
      values.push(status);
      p++;
    }
    if (priority) {
      conditions.push(`t.priority = $${p}`);
      values.push(priority);
      p++;
    }
    if (type) {
      conditions.push(`t.type ILIKE $${p}`);
      values.push(`%${type}%`);
      p++;
    }
    if (assignee) {
      conditions.push(`t.assignee = $${p}`);
      values.push(assignee);
      p++;
    }

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

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const [countResult, dataResult] = await Promise.all([
      pool.query(`SELECT COUNT(*) AS total ${TASK_JOIN} ${where}`, values),
      pool.query(
        `SELECT ${TASK_SELECT} ${TASK_JOIN}
                 ${where}
                 ORDER BY ${sortCol} ${sortDir}
                 LIMIT $${p} OFFSET $${p + 1}`,
        [...values, limit, offset],
      ),
    ]);

    const total = parseInt(countResult.rows[0]?.total ?? "0", 10);
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
      [id],
    );
    if (!rows[0]) return null;
    return {
      ...rows[0],
      subtasks: rows[0].subtasks || [],
      comments: rows[0].comments || [],
    };
  }

  static async updateTask(
    id: string,
    input: UpdateProjectTaskInput,
    userId?: string,
    userName?: string,
  ): Promise<ProjectTask> {
    const existing = await this.findTaskById(id);
    if (!existing) throw new AppError(404, "Task not found");

    // Validate status transition if status is being changed
    if (input.status && input.status !== existing.status) {
      if (!canTransitionTo(existing.status, input.status)) {
        throw new AppError(
          400,
          `Cannot transition from "${existing.status}" to "${input.status}". Invalid status transition.`,
        );
      }
    }

    const updates: string[] = [];
    const values: unknown[] = [];
    let p = 1;

    if (input.project_id !== undefined) {
      updates.push(`project_id = $${p++}`);
      values.push(toDbValue(input.project_id));
    }
    if (input.title !== undefined) {
      updates.push(`title = $${p++}`);
      values.push(input.title.trim());
    }
    if (input.description !== undefined) {
      updates.push(`description = $${p++}`);
      values.push(toDbValue(input.description));
    }
    if (input.status !== undefined) {
      updates.push(`status = $${p++}`);
      values.push(input.status);
      // If status is 'done', set completed_at
      if (input.status === "done" && existing.status !== "done") {
        updates.push(`completed_at = $${p++}`);
        values.push(new Date().toISOString());
      }
      // If status is not 'done' and was previously 'done', clear completed_at
      if (input.status !== "done" && existing.status === "done") {
        updates.push(`completed_at = $${p++}`);
        values.push(null);
      }
    }
    if (input.priority !== undefined) {
      updates.push(`priority = $${p++}`);
      values.push(input.priority);
    }
    if (input.type !== undefined) {
      updates.push(`type = $${p++}`);
      values.push(input.type);
    }
    if (input.assignee !== undefined) {
      updates.push(`assignee = $${p++}`);
      values.push(toDbValue(input.assignee));
    }
    if (input.deadline !== undefined) {
      updates.push(`deadline = $${p++}`);
      values.push(toDbValue(input.deadline));
    }
    if (input.start_date !== undefined) {
      updates.push(`start_date = $${p++}`);
      values.push(toDbValue(input.start_date));
    }
    if (input.tags !== undefined) {
      const tags = parseTags(input.tags);
      updates.push(`tags = $${p++}`);
      values.push(tags.length > 0 ? tags : []);
    }
    if (input.estimated_hours !== undefined) {
      updates.push(`estimated_hours = $${p++}`);
      values.push(toDbValue(input.estimated_hours));
    }
    if (input.actual_hours !== undefined) {
      updates.push(`actual_hours = $${p++}`);
      values.push(toDbValue(input.actual_hours));
    }
    if (input.parent_task_id !== undefined) {
      updates.push(`parent_task_id = $${p++}`);
      values.push(toDbValue(input.parent_task_id));
    }
    if (input.visibility !== undefined) {
      updates.push(`visibility = $${p++}`);
      values.push(input.visibility);
    }
    if (input.completed_at !== undefined) {
      updates.push(`completed_at = $${p++}`);
      values.push(toDbValue(input.completed_at));
    }

    if (!updates.length) return existing;

    updates.push(`updated_at = NOW()`);
    if (userId) {
      updates.push(`updated_by = $${p++}`);
      values.push(userId);
    }
    if (userName) {
      updates.push(`updated_by_name = $${p++}`);
      values.push(userName);
    }
    values.push(id);

    await pool.query(
      `UPDATE project_tasks SET ${updates.join(", ")} WHERE id = $${p} AND is_active = true`,
      values,
    );

    return (await this.findTaskById(id))!;
  }

  static async deleteTask(id: string): Promise<void> {
    const existing = await this.findTaskById(id);
    if (!existing) throw new AppError(404, "Task not found");

    // Check if there are subtasks
    const { rows } = await pool.query(
      `SELECT COUNT(*) FROM project_subtasks WHERE task_id = $1 AND is_active = true`,
      [id],
    );
    if (parseInt(rows[0].count, 10) > 0) {
      throw new AppError(
        409,
        "Cannot delete task with active subtasks. Please delete subtasks first.",
      );
    }

    await pool.query(
      `UPDATE project_tasks SET is_active = false, updated_at = NOW() WHERE id = $1`,
      [id],
    );
  }

  static async getTaskStats(projectId?: string): Promise<ProjectStats> {
    const conditions: string[] = ["t.is_active = true"];
    const values: unknown[] = [];
    let p = 1;

    if (projectId) {
      conditions.push(`t.project_id = $${p}`);
      values.push(projectId);
      p++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const { rows } = await pool.query(
      `SELECT
             COUNT(*) FILTER (WHERE t.status = 'inprogress') AS inprogress,
             COUNT(*) FILTER (WHERE t.status = 'done') AS done,
             COUNT(*) FILTER (WHERE t.status = 'overdue') AS overdue,
             COUNT(*) FILTER (WHERE t.status = 'pending_approval') AS pending_approval,
             COUNT(*) FILTER (WHERE t.status = 'blocked') AS blocked,
             COUNT(*) FILTER (WHERE t.status = 'review') AS review,
             COUNT(*) AS total
             FROM project_tasks t
             ${where}`,
      values,
    );

    const row = rows[0] || {};
    const total = parseInt(row.total || "0", 10);
    const done = parseInt(row.done || "0", 10);

    return {
      inprogress: parseInt(row.inprogress || "0", 10),
      done: done,
      overdue: parseInt(row.overdue || "0", 10),
      pending_approval: parseInt(row.pending_approval || "0", 10),
      blocked: parseInt(row.blocked || "0", 10),
      review: parseInt(row.review || "0", 10),
      total: total,
      completed_percentage: total > 0 ? Math.round((done / total) * 100) : 0,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  SUBTASK OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  static async createSubtask(
    taskId: string,
    input: CreateProjectSubtaskInput,
  ): Promise<ProjectSubtask> {
    const task = await this.findTaskById(taskId);
    if (!task) throw new AppError(404, "Task not found");

    const { rows } = await pool.query(
      `INSERT INTO project_subtasks (task_id, title, description, assigned_to)
             VALUES ($1, $2, $3, $4)
             RETURNING id`,
      [
        taskId,
        input.title.trim(),
        toDbValue(input.description),
        toDbValue(input.assigned_to),
      ],
    );

    const { rows: subtaskRows } = await pool.query(
      `SELECT ${SUBTASK_SELECT} ${SUBTASK_JOIN} WHERE s.id = $1`,
      [rows[0].id],
    );

    return subtaskRows[0];
  }

  static async updateSubtask(
    taskId: string,
    subtaskId: string,
    input: UpdateProjectSubtaskInput,
  ): Promise<ProjectSubtask> {
    const { rows: existing } = await pool.query(
      `SELECT id FROM project_subtasks WHERE id = $1 AND task_id = $2 AND is_active = true`,
      [subtaskId, taskId],
    );
    if (!existing.length) throw new AppError(404, "Subtask not found");

    const updates: string[] = [];
    const values: unknown[] = [];
    let p = 1;

    if (input.title !== undefined) {
      updates.push(`title = $${p++}`);
      values.push(input.title.trim());
    }
    if (input.description !== undefined) {
      updates.push(`description = $${p++}`);
      values.push(toDbValue(input.description));
    }
    if (input.completed !== undefined) {
      updates.push(`completed = $${p++}`);
      values.push(input.completed);
    }
    if (input.assigned_to !== undefined) {
      updates.push(`assigned_to = $${p++}`);
      values.push(toDbValue(input.assigned_to));
    }

    if (!updates.length) {
      const { rows: subtaskRows } = await pool.query(
        `SELECT ${SUBTASK_SELECT} ${SUBTASK_JOIN} WHERE s.id = $1`,
        [subtaskId],
      );
      return subtaskRows[0];
    }

    updates.push(`updated_at = NOW()`);
    values.push(subtaskId);

    await pool.query(
      `UPDATE project_subtasks SET ${updates.join(", ")} WHERE id = $${p} AND is_active = true`,
      values,
    );

    const { rows: subtaskRows } = await pool.query(
      `SELECT ${SUBTASK_SELECT} ${SUBTASK_JOIN} WHERE s.id = $1`,
      [subtaskId],
    );

    return subtaskRows[0];
  }

  static async deleteSubtask(taskId: string, subtaskId: string): Promise<void> {
    const { rows } = await pool.query(
      `UPDATE project_subtasks SET is_active = false
             WHERE id = $1 AND task_id = $2
             RETURNING id`,
      [subtaskId, taskId],
    );
    if (!rows.length) throw new AppError(404, "Subtask not found");
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  COMMENT OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  static async createComment(
    taskId: string,
    input: CreateProjectCommentInput,
    userId: string,
  ): Promise<ProjectTaskComment> {
    const task = await this.findTaskById(taskId);
    if (!task) throw new AppError(404, "Task not found");

    const { rows } = await pool.query(
      `INSERT INTO project_task_comments (task_id, user_id, content)
             VALUES ($1, $2, $3)
             RETURNING id`,
      [taskId, userId, input.content.trim()],
    );

    const { rows: commentRows } = await pool.query(
      `SELECT c.id, c.task_id, c.user_id, c.content, c.created_at, c.updated_at, u.full_name AS user_name
             FROM project_task_comments c
             LEFT JOIN users u ON u.id = c.user_id
             WHERE c.id = $1`,
      [rows[0].id],
    );

    return commentRows[0];
  }

  static async updateComment(
    taskId: string,
    commentId: string,
    input: UpdateProjectCommentInput,
  ): Promise<ProjectTaskComment> {
    const { rows: existing } = await pool.query(
      `SELECT id FROM project_task_comments WHERE id = $1 AND task_id = $2`,
      [commentId, taskId],
    );
    if (!existing.length) throw new AppError(404, "Comment not found");

    await pool.query(
      `UPDATE project_task_comments
             SET content = $1, updated_at = NOW()
             WHERE id = $2`,
      [input.content.trim(), commentId],
    );

    const { rows: commentRows } = await pool.query(
      `SELECT c.id, c.task_id, c.user_id, c.content, c.created_at, c.updated_at, u.full_name AS user_name
             FROM project_task_comments c
             LEFT JOIN users u ON u.id = c.user_id
             WHERE c.id = $1`,
      [commentId],
    );

    return commentRows[0];
  }

  static async deleteComment(taskId: string, commentId: string): Promise<void> {
    const { rows } = await pool.query(
      `DELETE FROM project_task_comments WHERE id = $1 AND task_id = $2 RETURNING id`,
      [commentId, taskId],
    );
    if (!rows.length) throw new AppError(404, "Comment not found");
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  BULK TASK OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  static async bulkUpdateTasks(
    updates: Array<{
      task_id: string;
      status?: ProjectTaskStatus; // ← Use the enum type
      priority?: string;
      assignee?: string | null;
      deadline?: string | null;
    }>,
    userId?: string,
    userName?: string,
  ): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      for (const update of updates) {
        // Get current task to validate status transition
        const { rows } = await client.query(
          `SELECT status FROM project_tasks WHERE id = $1 AND is_active = true`,
          [update.task_id],
        );

        if (!rows[0]) continue;

        const currentStatus = rows[0].status as ProjectTaskStatus;
        const newStatus = update.status;

        // Validate status transition if status is being changed
        if (newStatus && newStatus !== currentStatus) {
          if (!canTransitionTo(currentStatus, newStatus)) {
            throw new AppError(
              400,
              `Cannot transition task ${update.task_id} from "${currentStatus}" to "${newStatus}". Invalid status transition.`,
            );
          }
        }

        const setClauses: string[] = [];
        const values: unknown[] = [];
        let p = 1;

        if (newStatus !== undefined) {
          setClauses.push(`status = $${p++}`);
          values.push(newStatus);
          if (newStatus === "done" && currentStatus !== "done") {
            setClauses.push(`completed_at = $${p++}`);
            values.push(new Date().toISOString());
          }
          if (newStatus !== "done" && currentStatus === "done") {
            setClauses.push(`completed_at = $${p++}`);
            values.push(null);
          }
        }

        if (update.priority !== undefined) {
          setClauses.push(`priority = $${p++}`);
          values.push(update.priority);
        }

        if (update.assignee !== undefined) {
          setClauses.push(`assignee = $${p++}`);
          values.push(update.assignee);
        }

        if (update.deadline !== undefined) {
          setClauses.push(`deadline = $${p++}`);
          values.push(update.deadline);
        }

        if (setClauses.length === 0) continue;

        setClauses.push(`updated_at = NOW()`);
        if (userId) {
          setClauses.push(`updated_by = $${p++}`);
          values.push(userId);
        }
        if (userName) {
          setClauses.push(`updated_by_name = $${p++}`);
          values.push(userName);
        }
        values.push(update.task_id);

        await client.query(
          `UPDATE project_tasks SET ${setClauses.join(", ")} WHERE id = $${p}`,
          values,
        );
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  GET TASKS BY ASSIGNEE / STATUS
  // ═══════════════════════════════════════════════════════════════════════════

  static async getTasksByAssignee(
    assigneeId: string,
    projectId?: string,
  ): Promise<ProjectTask[]> {
    const conditions: string[] = ["t.is_active = true", "t.assignee = $1"];
    const values: unknown[] = [assigneeId];
    let p = 2;

    if (projectId) {
      conditions.push(`t.project_id = $${p}`);
      values.push(projectId);
      p++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const { rows } = await pool.query(
      `SELECT ${TASK_SELECT} ${TASK_JOIN}
             ${where}
             ORDER BY t.deadline ASC, t.created_at DESC`,
      values,
    );

    return rows.map((row: any) => ({
      ...row,
      subtasks: row.subtasks || [],
      comments: row.comments || [],
    }));
  }

  static async getTasksByStatus(
    projectId: string,
    status: string,
  ): Promise<ProjectTask[]> {
    const { rows } = await pool.query(
      `SELECT ${TASK_SELECT} ${TASK_JOIN} 
             WHERE t.project_id = $1 AND t.status = $2 AND t.is_active = true
             ORDER BY t.deadline ASC, t.created_at DESC`,
      [projectId, status],
    );

    return rows.map((row: any) => ({
      ...row,
      subtasks: row.subtasks || [],
      comments: row.comments || [],
    }));
  }

  static async getOverdueTasks(
    projectId?: string,
    userId?: string,
  ): Promise<ProjectTask[]> {
    const conditions: string[] = [
      "t.is_active = true",
      "t.status != $1",
      "t.deadline < NOW()::date",
    ];
    const values: unknown[] = ["done"];
    let p = 2;

    if (projectId) {
      conditions.push(`t.project_id = $${p}`);
      values.push(projectId);
      p++;
    }

    if (userId) {
      conditions.push(`t.assignee = $${p}`);
      values.push(userId);
      p++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const { rows } = await pool.query(
      `SELECT ${TASK_SELECT} ${TASK_JOIN}
             ${where}
             ORDER BY t.deadline ASC`,
      values,
    );

    return rows.map((row: any) => ({
      ...row,
      subtasks: row.subtasks || [],
      comments: row.comments || [],
    }));
  }
}
