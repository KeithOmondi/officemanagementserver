// src/features/users/users.types.ts

import { UserRole } from '../../middleware/auth.middleware';
import type {
  UserFiltersInput,
  UpdateUserInput as ValidatorUpdateUserInput,
  CreateUserInput as ValidatorCreateUserInput,
} from './users.validator';

export interface User {
  id:            string;
  full_name:     string;
  email:         string;
  pj_number:     string;
  role:          UserRole;
  department_id: string | null;
  is_active:     boolean;
  created_at:    Date;
  updated_at:    Date;
  last_login?:   Date;
}

export type CreateUserInput       = ValidatorCreateUserInput;
export type UpdateUserInput       = ValidatorUpdateUserInput;
export type UserFilters           = UserFiltersInput;

export interface UserPaginationResponse {
  data:       User[];
  total:      number;
  page:       number;
  limit:      number;
  totalPages: number;
}