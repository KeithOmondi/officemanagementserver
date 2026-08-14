// ============================================================
// src/features/succession-courts/succession-courts.types.ts
// ============================================================

export type SuccessionCourtCategory = 'A' | 'B' | 'C' | 'D';

// ─── User Types ────────────────────────────────────────────────────────────

export interface User {
  id: string;
  full_name: string;
  email: string;
  role: 'super_admin' | 'dept_head' | 'staff' | 'viewer';
  phone?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Court Types ──────────────────────────────────────────────────────────

export interface SuccessionCourt {
  id: string;
  name: string;
  station: string;
  category: SuccessionCourtCategory;
  support_person: string | null;
  support_person_id: string | null;
  contact: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SuccessionCourtWithUser extends SuccessionCourt {
  support_person_user?: {
    id: string;
    name: string;
    email: string;
    role: string;
    phone?: string | null;
  } | null;
}

export interface SuccessionCourtWithSupportDetails extends SuccessionCourtWithUser {
  support_person_email?: string;
  support_person_phone?: string;
}

// ─── Request/Response Types ──────────────────────────────────────────────

export interface CreateSuccessionCourtInput {
  name: string;
  station: string;
  category: SuccessionCourtCategory;
  support_person_id?: string;
  contact?: string;
}

export interface UpdateSuccessionCourtInput {
  name?: string;
  station?: string;
  category?: SuccessionCourtCategory;
  support_person_id?: string | null;
  contact?: string;
  is_active?: boolean;
}

export interface AssignSupportPersonInput {
  userId: string;
  contact?: string;
}

export interface BulkAssignSupportPersonInput {
  courtIds: string[];
  userId: string;
  contact?: string;
}

export interface BulkRemoveSupportPersonInput {
  courtIds: string[];
}

// ─── NEW: Assign Support Person by Category ─────────────────────────────

export interface AssignSupportPersonByCategoryInput {
  category: SuccessionCourtCategory;
  userId: string;
  contact?: string;
}

// ─── NEW: Assign Support Person by Station ──────────────────────────────

export interface AssignSupportPersonByStationInput {
  station: string;
  userId: string;
  contact?: string;
}

// ─── NEW: Reassign Support Person ───────────────────────────────────────

export interface ReassignSupportPersonInput {
  currentUserId: string;      // The user currently assigned
  newUserId: string;          // The user to reassign to
  category?: SuccessionCourtCategory; // Optional: filter by category
  station?: string;           // Optional: filter by station
}

export interface BulkAssignResult {
  updated: number;
  skipped: number;
  errors: string[];
}

// ─── Seed Courts Payload ─────────────────────────────────────────────────

export interface SeedCourtsPayload {
  dryRun?: boolean;
  force?: boolean;
}

// ─── Filter Types ─────────────────────────────────────────────────────────

export interface SuccessionCourtFilters {
  search?: string;
  category?: SuccessionCourtCategory;
  station?: string;
  is_active?: boolean;
  support_person_id?: string;
  limit?: number;
  offset?: number;
  page?: number;
}

// ─── Response Types ──────────────────────────────────────────────────────

export interface GroupedSuccessionCourts {
  [category: string]: SuccessionCourtWithUser[];
}

export interface SupportPersonAssignment {
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  assignedCourts: SuccessionCourt[];
  totalAssigned: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data: T;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── Result Types ─────────────────────────────────────────────────────────

export interface SeedResult {
  inserted: number;
  skipped: number;
  errors: string[];
}

export interface BulkOperationResult {
  updated: number;
  skipped: number;
  errors: string[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface DeleteResult {
  deleted: number;
}

// ─── Slice State ─────────────────────────────────────────────────────────

export interface SuccessionCourtState {
  courts: SuccessionCourtWithUser[];
  groupedCourts: GroupedSuccessionCourts | null;
  selectedCourt: SuccessionCourtWithUser | null;
  availableSupportPersons: User[];
  supportPersonAssignments: SupportPersonAssignment[];

  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;

  total: number;
  page: number;
  limit: number;
  totalPages: number;

  filters: SuccessionCourtFilters;

  seedResult: SeedResult | null;
  isSeeding: boolean;
  isValidating: boolean;
  validationResult: ValidationResult | null;

  actionInProgress?: {
    creatingCourt: boolean;
    updatingCourt: string | null;
    deletingCourt: string | null;
    fetchingCourt: string | null;
    assigningSupport: string | null;
    bulkAssigning: boolean;
    removingSupport: string | null;
    bulkRemoving: boolean;
    seeding: boolean;
    validating: boolean;
    clearing: boolean;
  };

  latestRequestId?: string | null;
}

// ─── Form Types ───────────────────────────────────────────────────────────

export interface SuccessionCourtFormValues {
  name: string;
  station: string;
  category: SuccessionCourtCategory | '';
  support_person_id: string | '';
  contact: string;
}

export interface AssignSupportPersonFormValues {
  userId: string;
  contact: string;
}

export interface BulkAssignByCategoryFormValues {
  category: SuccessionCourtCategory | '';
  userId: string;
  contact: string;
}

// ─── NEW: Assign by Station Form ────────────────────────────────────────

export interface AssignByStationFormValues {
  station: string;
  userId: string;
  contact: string;
}

// ─── NEW: Reassign Form ─────────────────────────────────────────────────

export interface ReassignFormValues {
  currentUserId: string;
  newUserId: string;
  category: SuccessionCourtCategory | '';
  station: string;
}

// ─── Component Props ─────────────────────────────────────────────────────

export interface SuccessionCourtTableProps {
  courts: SuccessionCourtWithUser[];
  isLoading: boolean;
  onEdit?: (court: SuccessionCourt) => void;
  onDelete?: (id: string) => void;
  onAssign?: (courtId: string) => void;
  onRemoveSupport?: (courtId: string) => void;
  onToggleActive?: (court: SuccessionCourt) => void;
}

export interface SuccessionCourtFiltersProps {
  filters: SuccessionCourtFilters;
  onFilterChange: (filters: SuccessionCourtFilters) => void;
  onClearFilters: () => void;
}

export interface SuccessionCourtStatsProps {
  counts: {
    total: number;
    active: number;
    inactive: number;
    withSupport: number;
    withoutSupport: number;
    categoryA: number;
    categoryB: number;
    categoryC: number;
    categoryD: number;
  };
}

// ─── Hook Return Types ──────────────────────────────────────────────────

export interface UseSuccessionCourtsReturn {
  courts: SuccessionCourtWithUser[];
  groupedCourts: GroupedSuccessionCourts | null;
  selectedCourt: SuccessionCourtWithUser | null;
  availableSupportPersons: User[];
  supportPersonAssignments: SupportPersonAssignment[];
  filteredCourts: SuccessionCourtWithUser[];
  
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;
  isSeeding: boolean;
  isValidating: boolean;
  
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  
  filters: SuccessionCourtFilters;
  
  // Actions
  fetchCourts: (filters?: SuccessionCourtFilters) => Promise<void>;
  fetchCourtsWithSupport: (filters?: SuccessionCourtFilters) => Promise<void>;
  fetchGroupedCourts: () => Promise<void>;
  fetchGroupedCourtsWithSupport: () => Promise<void>;
  fetchCourtById: (id: string) => Promise<void>;
  fetchCourtWithUser: (id: string) => Promise<void>;
  fetchAvailableSupportPersons: () => Promise<void>;
  fetchSupportPersonAssignments: (params?: { userId?: string; category?: string }) => Promise<void>;
  
  // CRUD
  createCourt: (data: CreateSuccessionCourtInput) => Promise<SuccessionCourt>;
  updateCourt: (id: string, data: UpdateSuccessionCourtInput) => Promise<SuccessionCourt>;
  deleteCourt: (id: string) => Promise<void>;
  
  // Assign
  assignSupportPerson: (courtId: string, data: AssignSupportPersonInput) => Promise<SuccessionCourt>;
  bulkAssignSupportPerson: (data: BulkAssignSupportPersonInput) => Promise<BulkOperationResult>;
  assignSupportPersonByCategory: (data: AssignSupportPersonByCategoryInput) => Promise<BulkOperationResult>;
  assignSupportPersonByStation: (data: AssignSupportPersonByStationInput) => Promise<BulkOperationResult>;
  
  // Reassign
  reassignSupportPerson: (data: ReassignSupportPersonInput) => Promise<BulkOperationResult>;
  
  // Remove
  removeSupportPerson: (courtId: string) => Promise<SuccessionCourt>;
  bulkRemoveSupportPerson: (data: BulkRemoveSupportPersonInput) => Promise<BulkOperationResult>;
  
  // Seed
  seedCourts: (payload?: SeedCourtsPayload) => Promise<SeedResult>;
  validateSeedData: () => Promise<ValidationResult>;
  clearSeedData: () => Promise<DeleteResult>;
  
  // Filters
  setFilters: (filters: SuccessionCourtFilters) => void;
  clearFilters: () => void;
  resetFilters: () => void;
  
  // Selection
  setSelectedCourt: (court: SuccessionCourtWithUser | null) => void;
  clearSelectedCourt: () => void;
  
  // Misc
  clearError: () => void;
  resetState: () => void;
}