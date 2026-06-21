// src/features/departments/departments.types.ts

export interface Department {
  id: string;
  name: string;
  code: string | null;
  is_active: boolean;
  created_at: Date;
}

export interface DepartmentWithUserCount extends Department {
  user_count: number;
}