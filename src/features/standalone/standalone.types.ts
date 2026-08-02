// src/features/standalone/standalone.types.ts

export type StandaloneTaskStatus = 'pending' | 'in_progress' | 'complete';
export type StandaloneTaskPriority = 'low' | 'normal' | 'high' | 'urgent' | 'critical';
export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly';

export interface StandaloneTaskSubtask {
    id: string;
    task_id: string;
    title: string;
    description: string | null;
    completed: boolean;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface StandaloneTaskComment {
    id: string;
    task_id: string;
    user_id: string;
    user_name: string;
    content: string;
    created_at: string;
    updated_at: string;
}

export interface StandaloneTaskAttachment {
    id: string;
    task_id: string;
    file_name: string;
    file_url: string;
    file_size: number;
    mime_type: string;
    uploaded_by: string;
    uploaded_by_name: string;
    created_at: string;
}

export interface StandaloneTaskHistory {
    id: string;
    task_id: string;
    user_id: string;
    user_name: string;
    field: string;
    old_value: string | null;
    new_value: string | null;
    created_at: string;
}

export interface StandaloneTask {
    id: string;
    title: string;
    description: string | null;
    status: StandaloneTaskStatus;
    priority: StandaloneTaskPriority;
    assigned_to: string | null; // User ID
    assigned_to_name: string | null;
    assigned_to_team: string | null; // Department ID if assigned to team
    assigned_to_team_name: string | null;
    created_by: string;
    created_by_name: string;
    start_date: string | null;
    end_date: string;
    estimated_hours: number | null;
    actual_hours: number | null;
    is_recurring: boolean;
    recurrence_type: RecurrenceType;
    recurrence_end_date: string | null;
    parent_task_id: string | null; // For recurring tasks
    is_active: boolean;
    is_archived: boolean;
    created_at: string;
    updated_at: string;
    subtasks?: StandaloneTaskSubtask[];
    comments?: StandaloneTaskComment[];
    attachments?: StandaloneTaskAttachment[];
    history?: StandaloneTaskHistory[];
}

// ─── Input Types ──────────────────────────────────────────────────────────────

export interface CreateStandaloneTaskInput {
    title: string;
    description?: string | null;
    status?: StandaloneTaskStatus;
    priority?: StandaloneTaskPriority;
    assigned_to?: string | null; // User ID
    assigned_to_team?: string | null; // Department ID
    start_date?: string | null;
    end_date: string;
    estimated_hours?: number | null;
    is_recurring?: boolean;
    recurrence_type?: RecurrenceType;
    recurrence_end_date?: string | null;
}

export interface UpdateStandaloneTaskInput {
    title?: string;
    description?: string | null;
    status?: StandaloneTaskStatus;
    priority?: StandaloneTaskPriority;
    assigned_to?: string | null;
    assigned_to_team?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    estimated_hours?: number | null;
    actual_hours?: number | null;
    is_recurring?: boolean;
    recurrence_type?: RecurrenceType;
    recurrence_end_date?: string | null;
    is_archived?: boolean;
}

export interface CreateStandaloneSubtaskInput {
    title: string;
    description?: string | null;
}

export interface UpdateStandaloneSubtaskInput {
    title?: string;
    description?: string | null;
    completed?: boolean;
}

export interface CreateStandaloneCommentInput {
    content: string;
}

export interface UpdateStandaloneCommentInput {
    content: string;
}

export interface StandaloneTaskFilters {
    status?: StandaloneTaskStatus;
    priority?: StandaloneTaskPriority;
    assigned_to?: string;
    assigned_to_team?: string;
    search?: string;
    start_date_from?: string;
    start_date_to?: string;
    end_date_from?: string;
    end_date_to?: string;
    is_archived?: boolean;
    page?: number;
    limit?: number;
    sort_by?: 'created_at' | 'end_date' | 'priority' | 'status' | 'title';
    sort_order?: 'ASC' | 'DESC';
}

// ─── Response Types ──────────────────────────────────────────────────────────

export interface StandaloneTaskPaginationResponse {
    data: StandaloneTask[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export interface StandaloneTaskStats {
    pending: number;
    in_progress: number;
    complete: number;
    overdue: number;
    total: number;
}

// ─── Recurrence Options ──────────────────────────────────────────────────────

export const RECURRENCE_OPTIONS: Array<{ value: RecurrenceType; label: string }> = [
    { value: 'none', label: 'None' },
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
];

export const STANDALONE_TASK_STATUS_LABELS: Record<StandaloneTaskStatus, string> = {
    pending: 'Pending',
    in_progress: 'In Progress',
    complete: 'Complete',
};

export const STANDALONE_TASK_STATUS_COLORS: Record<StandaloneTaskStatus, string> = {
    pending: 'bg-amber-100 text-amber-700',
    in_progress: 'bg-blue-100 text-blue-700',
    complete: 'bg-emerald-100 text-emerald-700',
};

export const STANDALONE_TASK_PRIORITY_LABELS: Record<StandaloneTaskPriority, string> = {
    low: 'Low',
    normal: 'Normal',
    high: 'High',
    urgent: 'Urgent',
    critical: 'Critical',
};

export const STANDALONE_TASK_PRIORITY_COLORS: Record<StandaloneTaskPriority, string> = {
    low: 'bg-slate-100 text-slate-600',
    normal: 'bg-emerald-100 text-emerald-700',
    high: 'bg-amber-100 text-amber-700',
    urgent: 'bg-red-100 text-red-700',
    critical: 'bg-rose-100 text-rose-700',
};