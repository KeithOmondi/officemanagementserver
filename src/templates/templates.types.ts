// src/modules/templates/templates.types.ts
export type TemplateType = 'memo' | 'letter';
export const GLOBAL_KEY = '__global__';

export interface DocumentTemplate {
  id: string;
  type: TemplateType;
  department_id: string | null;
  department_name: string | null;
  file_url: string;
  file_public_id: string;
  original_name: string | null;
  footer_image_url: string | null;
  footer_text: string | null;
  is_active: boolean;
  uploaded_by: string;
  uploaded_by_name: string;
  created_at: Date;
  updated_at: Date;
}