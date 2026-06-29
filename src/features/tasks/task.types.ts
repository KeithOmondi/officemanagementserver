// src/features/tasks/task.types.ts

export type {
    CreateProjectInput,
    UpdateProjectInput,
    CreateTaskInput,
    UpdateTaskInput,
    AddProjectMemberInput,
} from './task.validator';

export interface Project {
    id:          string;
    name:        string;
    description: string | null;
    status:      'active' | 'completed' | 'archived';
    priority:    'low' | 'medium' | 'high' | 'urgent';
    deadline:    string;
    progress:    number;
    created_by:  string;          // required — every project has an owner
    is_active:   boolean;
    created_at:  string;
    updated_at:  string;
    task_count?:      number;
    completed_tasks?: number;
    members?:         ProjectMember[];
}

export interface Task {
    id:           string;
    project_id:   string | null;
    project_name?: string;
    title:        string;
    description:  string | null;
    status:       'todo' | 'in_progress' | 'done';
    priority:     'low' | 'medium' | 'high' | 'urgent';
    assignee_id:  string | null;
    assignee_name?: string;
    due_date:     string;
    start_date:   string | null;
    completed_at: string | null;
    is_active:    boolean;
    created_by:   string;         // required
    created_at:   string;
    updated_at:   string;
}

export interface ProjectMember {
    id:         string;
    project_id: string;
    user_id:    string;
    user_name?: string;
    role:       string | null;
    is_active:  boolean;
    created_at: string;
    updated_at: string;
}

export interface TaskStats {
    todo:        number;
    in_progress: number;
    done:        number;
    overdue:     number;
}

export interface ProjectStats {
    total:     number;
    active:    number;
    completed: number;
    archived:  number;
}