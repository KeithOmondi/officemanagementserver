// src/features/projects/projects.types.ts

export type ProjectTaskStatus = 'todo' | 'inprogress' | 'done' | 'overdue' | 'pending_approval' | 'blocked' | 'review';
export type ProjectPriority = 'low' | 'normal' | 'high' | 'urgent' | 'critical';
export type ProjectTaskType = 'task' | 'bug' | 'feature' | 'improvement' | 'support' | 'maintenance';
export type ProjectVisibility = 'public' | 'private' | 'team';

export interface ProjectUser {
    id: string;
    full_name: string;
    pj_number: string;
    email: string;
}

export interface ProjectSubtask {
    id: string;
    task_id: string;
    title: string;
    description: string | null;
    completed: boolean;
    is_active: boolean;
    assigned_to: string | null;
    created_at: string;
    updated_at: string;
}

export interface ProjectTaskComment {
    id: string;
    task_id: string;
    user_id: string;
    content: string;
    created_at: string;
    updated_at: string;
}

export interface ProjectTask {
    id: string;
    project_id: string | null;
    title: string;
    description: string | null;
    status: ProjectTaskStatus;
    priority: ProjectPriority;
    type: ProjectTaskType;
    assignee: string | null;
    assignee_name: string | null;
    deadline: string;
    start_date: string | null;
    tags: string[];
    estimated_hours: number | null;
    actual_hours: number | null;
    parent_task_id: string | null;
    visibility: ProjectVisibility;
    is_active: boolean;
    created_by: string;
    created_by_name: string;
    created_at: string;
    updated_at: string;
    subtasks?: ProjectSubtask[];
    comments?: ProjectTaskComment[];
}

export interface Project {
    id: string;
    title: string;
    description: string | null;
    priority: ProjectPriority;
    deadline: string;
    tags: string[];
    members: ProjectUser[];
    tasks: ProjectTask[];
    task_count?: number;
    completed_task_count?: number;
    is_active: boolean;
    created_by: string;
    created_by_name?: string;
    created_at: string;
    updated_at: string;
}

// ─── Input Types ──────────────────────────────────────────────────────────────

export interface CreateProjectInput {
    title: string;
    description?: string;
    priority?: ProjectPriority;
    deadline?: string;
    tags?: string[];
    member_ids?: string[];
}

export interface UpdateProjectInput {
    title?: string;
    description?: string | null;
    priority?: ProjectPriority;
    deadline?: string | null;
    tags?: string[];
}

export interface CreateProjectTaskInput {
    project_id?: string;
    title: string;
    description?: string | null;
    status?: ProjectTaskStatus;
    priority?: ProjectPriority;
    type?: ProjectTaskType;
    assignee?: string | null;
    deadline?: string;
    start_date?: string | null;
    tags?: string[];
    estimated_hours?: number;
    parent_task_id?: string | null;
    visibility?: ProjectVisibility;
}

export interface UpdateProjectTaskInput {
    project_id?: string | null;
    title?: string;
    description?: string | null;
    status?: ProjectTaskStatus;
    priority?: ProjectPriority;
    type?: ProjectTaskType;
    assignee?: string | null;
    deadline?: string | null;
    start_date?: string | null;
    tags?: string[];
    estimated_hours?: number | null;
    actual_hours?: number | null;
    parent_task_id?: string | null;
    visibility?: ProjectVisibility;
}

export interface CreateProjectSubtaskInput {
    title: string;
    description?: string | null;  // ✅ Fixed: Allow null
    assigned_to?: string | null;  // ✅ Fixed: Allow null
}

export interface UpdateProjectSubtaskInput {
    title?: string;
    description?: string | null;
    completed?: boolean;
    assigned_to?: string | null;
}

export interface CreateProjectCommentInput {
    content: string;
}

export interface UpdateProjectCommentInput {
    content: string;
}

export interface ProjectTaskFilters {
    project_id?: string;
    status?: ProjectTaskStatus;
    priority?: ProjectPriority;
    type?: ProjectTaskType;
    assignee?: string;
    tags?: string[] | string;
    search?: string;
    deadline_from?: string;
    deadline_to?: string;
    page?: number;
    limit?: number;
    sort_by?: 'created_at' | 'deadline' | 'priority' | 'status' | 'title';
    sort_order?: 'ASC' | 'DESC';
}

export interface ProjectFilters {
    search?: string;
    page?: number;
    limit?: number;
}

export interface ProjectPaginationResponse {
    data: Project[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export interface ProjectTaskPaginationResponse {
    data: ProjectTask[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export interface ProjectStats {
    todo: number;
    inprogress: number;
    done: number;
    overdue: number;
    pending_approval: number;
    blocked: number;
    review: number;
    total: number;
}