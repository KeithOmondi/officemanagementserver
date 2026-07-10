import type {
  CreateProjectInput,
  UpdateProjectInput,
  CreateTaskInput,
  UpdateTaskInput,
  AddProjectMemberInput,
  AddAttachmentInput,
} from './task.validator';

export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: 'active' | 'completed' | 'archived';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  deadline: string;
  progress: number;
  created_by: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
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
  status: 'pending' | 'completed';          // changed
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignee_id: string | null;
  assignee_name?: string;
  due_date: string;
  start_date: string | null;
  remind_at: string | null;                 // new
  reminder_sent: boolean;                   // new
  completed_at: string | null;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  // computed
  is_overdue?: boolean;                     // will be added by service
}

export interface TaskAttachment {
  id: string;
  task_id: string;
  file_name: string;
  file_url: string;
  uploaded_by: string;
  uploader_name?: string;
  created_at: string;
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
  total: number;
  pending: number;
  completed: number;
  overdue: number;
}

export interface ProjectStats {
  total: number;
  active: number;
  completed: number;
  archived: number;
}