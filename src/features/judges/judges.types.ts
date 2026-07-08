// src/types/judges.types.ts

export interface Judge {
  id: string;
  s_no: number;
  name: string;
  pj_number: string;
  daily_dsa_rate: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateJudgeInput {
  s_no: number;
  name: string;
  pj_number: string;
  daily_dsa_rate?: number;
}

export interface UpdateJudgeInput {
  s_no?: number;
  name?: string;
  pj_number?: string;
  daily_dsa_rate?: number;
  is_active?: boolean;
}

export interface JudgeFilters {
  search?: string;
  is_active?: boolean;
  page?: number;
  limit?: number;
  sort_by?: 's_no' | 'name' | 'pj_number' | 'created_at';
  sort_order?: 'ASC' | 'DESC';
}

export interface JudgePaginationResponse {
  data: Judge[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface JudgeStats {
  total: number;
  active: number;
  inactive: number;
}