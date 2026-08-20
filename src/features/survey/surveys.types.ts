// src/features/surveys/surveys.types.ts

export type SurveyFieldType = 'text' | 'textarea' | 'dropdown' | 'checkbox' | 'date' | 'numbered_list';

export interface SurveyField {
  id: string;
  label: string;
  type: SurveyFieldType;
  required: boolean;
  options?: string[]; // used by 'dropdown' and 'checkbox'
  placeholder?: string;
  display_as_ordered?: boolean; // If true, renders options as <ol> instead of <ul> (for checkbox)
  help_text?: string; // Optional help text displayed below the field
  min?: number; // For text/number fields - minimum value or length. For numbered_list: minimum number of items
  max?: number; // For text/number fields - maximum value or length. For numbered_list: maximum number of items
}

export type SurveyStatus = 'draft' | 'active' | 'closed';

export interface Survey {
  id: string;
  slug: string;           // Auto-generated from title (can change when title changes)
  permanent_slug: string; // NEVER changes - used for public URLs
  title: string;
  description: string | null;
  fields: SurveyField[];
  status: SurveyStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface SurveyResponseRecord {
  id: string;
  survey_id: string;
  response_data: Record<string, string | string[]>;
  submitted_at: string;
  submitter_ip: string | null;
}

export interface SurveyDraftRecord {
  id: string;
  survey_id: string;
  draft_data: Record<string, string | string[]>;
  submitter_ip: string | null;
  created_at: string;
  updated_at: string;
}

export interface DraftSurveyField {
  label: string;
  type: SurveyFieldType;
  required: boolean;
  options?: string[];
  placeholder?: string;
  display_as_ordered?: boolean; // If true, renders options as <ol> instead of <ul>
  help_text?: string; // Optional help text
  min?: number; // For text/number fields. For numbered_list: minimum number of items
  max?: number; // For text/number fields. For numbered_list: maximum number of items
}

export interface CreateSurveyInput {
  title: string;
  description?: string;
  fields: DraftSurveyField[];
  permanent_slug?: string; // Optional - auto-generated if not provided
}

export interface UpdateSurveyInput {
  title?: string;
  description?: string;
  fields?: (DraftSurveyField | SurveyField)[];
  status?: SurveyStatus;
  // NOTE: permanent_slug is NOT in UpdateSurveyInput - it can never be updated
}

export interface SubmitResponseInput {
  response_data: Record<string, string | string[]>;
}

export interface SaveDraftInput {
  draft_data: Record<string, string | string[]>;
}

export interface PublicSurveyView {
  permanent_slug: string; // Use this for public URLs
  title: string;
  description: string | null;
  fields: SurveyField[];
}