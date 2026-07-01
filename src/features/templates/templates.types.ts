// src/features/templates/templates.types.ts

export type TemplateType = 'memo' | 'letter';

export interface DepartmentTemplate {
  id: string;
  department_id: string | null;       // null = global/default template
  department_name: string;            // 'Global' when department_id is null
  type: TemplateType;
  file_url: string;
  file_public_id: string;
  original_name: string;
  mime_type: string;
  file_size_bytes: number;
  uploaded_by: string;
  uploaded_by_name: string;
  is_active: boolean;
  is_fallback?: boolean;              // set only on getActive responses
  created_at: Date;
  updated_at: Date;
}

export type GroupedTemplates = Record<string, DepartmentTemplate[]>;