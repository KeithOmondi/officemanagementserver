// src/features/tasks/task.types.ts

export interface Project {
    id: string;
    name: string;
    description: string | null;
    status: 'active' | 'completed' | 'archived';
    priority: 'low' | 'medium' | 'high' | 'urgent';
    deadline: string;
    progress: number;
    created_by: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    // Aggregated fields
    task_count?: number;
    completed_tasks?: number;
    members?: ProjectMember[];
}

export interface Task {
    id: string;
    project_id: string | null;
    project_name?: string;
    title: string;
    description: string | null;
    status: 'todo' | 'in_progress' | 'done';
    priority: 'low' | 'medium' | 'high' | 'urgent';
    assignee_id: string | null;
    assignee_name?: string;
    due_date: string;
    start_date: string | null;
    completed_at: string | null;
    is_active: boolean;
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

export interface ProjectMember {
    id: string;
    project_id: string;
    user_id: string;
    user_name?: string;
    role: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface TaskStats {
    todo: number;
    in_progress: number;
    done: number;
    overdue: number;
}

export interface ProjectStats {
    total: number;
    active: number;
    completed: number;
    archived: number;
}

export interface CreateProjectInput {
    name: string;
    description?: string;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    deadline: string;
    member_ids?: string[];
}

export interface UpdateProjectInput {
    name?: string;
    description?: string;
    status?: 'active' | 'completed' | 'archived';
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    deadline?: string;
    is_active?: boolean;
}

export interface CreateTaskInput {
    project_id?: string;
    title: string;
    description?: string;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    assignee_id?: string;
    due_date: string;
    start_date?: string;
}

export interface UpdateTaskInput {
    title?: string;
    description?: string;
    status?: 'todo' | 'in_progress' | 'done';
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    assignee_id?: string | null;
    due_date?: string;
    start_date?: string | null;
    is_active?: boolean;
}

export interface AddProjectMemberInput {
    user_id: string;
    role?: string;
}