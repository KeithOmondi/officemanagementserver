// src/features/dashboard/dashboard.types.ts

/**
 * Dashboard Statistics - Complete dashboard data aggregated from multiple modules
 * This is the response format for the GET /dashboard/stats endpoint
 */
export interface DashboardStats {
  // ── Document Stats ──────────────────────────────────────────────────────
  documents: DocumentStats;
  
  // ── User Stats ──────────────────────────────────────────────────────────
  users: UserStats;
  
  // ── Registry Stats ──────────────────────────────────────────────────────
  registry: RegistryStats;
  
  // ── Notices Stats ──────────────────────────────────────────────────────
  notices: NoticeStats;
  
  // ── Inventory Stats ────────────────────────────────────────────────────
  inventory: InventoryStats;
  
  // ── Financial Stats ────────────────────────────────────────────────────
  financial: FinancialStats;
  
  // ── DSA Stats ──────────────────────────────────────────────────────────
  dsa: DSAStats;
  
  // ── Messages Stats ─────────────────────────────────────────────────────
  messages: MessageStats;
}

// ─── Document Stats ──────────────────────────────────────────────────────

export interface DocumentStats {
  total: number;           // Total documents (all statuses, active + inactive)
  active: number;          // Active documents only
  inactive: number;        // Inactive/filed documents
  byStatus: DocumentStatusBreakdown;
  assigned: AssignedStats;
}

export interface DocumentStatusBreakdown {
  draft: number;
  uploaded: number;
  pending_review: number;
  marked: number;          // Super Admin → Department
  dept_assigned: number;   // Department Head → User
  user_assigned: number;
  in_progress: number;
  completed: number;
  filed: number;
  ready_to_release: number;
  released: number;
}

export interface AssignedStats {
  total: number;           // marked + dept_assigned (active only)
  marked: number;          // Super Admin marked to department
  dept_assigned: number;   // Department Head assigned to user
}

// ─── User Stats ──────────────────────────────────────────────────────────

export interface UserStats {
  total: number;
  active: number;
  inactive: number;
  byRole: UserRoleStats[];
}

export interface UserRoleStats {
  role: string;   // 'super_admin' | 'dept_head' | 'staff' | 'viewer'
  count: number;
}

// ─── Registry Stats ──────────────────────────────────────────────────────

export interface RegistryStats {
  stations: StationStats;
  totalFiles: number;      // Total active files across all stations
  topStations: TopStation[];
}

export interface StationStats {
  total: number;
  active: number;
  inactive: number;
}

export interface TopStation {
  id: string;
  name: string;
  ref_no: string | null;  // e.g., "RHC/MSB/22"
  file_count: number;
}

// ─── Notices Stats ──────────────────────────────────────────────────────

export interface NoticeStats {
  total: number;
  unread: number;
  read: number;
}

// ─── Inventory Stats ────────────────────────────────────────────────────

export interface InventoryStats {
  total: number;
  in_stock: number;
  low_stock: number;      // Stock level between 1 and 10
  out_of_stock: number;
}

// ─── Financial Stats ────────────────────────────────────────────────────

export interface FinancialStats {
  total_allocated: number;
  total_paid: number;
  committed_unpaid: number;   // Allocated - Paid
  pro_bono_approved: number;   // Count of pro bono cases
}

// ─── DSA Stats ──────────────────────────────────────────────────────────

export interface DSAStats {
  total_activities: number;
  total_night_outs: number;
  staff_involved: number;
  total_kes_payable: number;
}

// ─── Messages Stats ─────────────────────────────────────────────────────

export interface MessageStats {
  unread_total: number;
  groups_with_unread: number;
  by_group: MessageGroupStats[];
}

export interface MessageGroupStats {
  group_id: string;
  group_name: string;
  unread_count: number;
}

// ─── Dashboard Response Wrapper ──────────────────────────────────────────

export interface DashboardResponse {
  success: boolean;
  data: DashboardStats;
  message: string;
}

// ─── Optional: Real-time Trends ──────────────────────────────────────────

export interface DashboardTrends {
  financial: {
    labels: string[];
    allocated: number[];
    paid: number[];
  };
  inventory: {
    labels: string[];
    in_stock: number[];
    low_stock: number[];
    out_of_stock: number[];
  };
  dsa: {
    labels: string[];
    nights: number[];
    staff: number[];
  };
}

// ─── Optional: Activity Feed ────────────────────────────────────────────

export interface DashboardActivity {
  id: string;
  type: 'document' | 'user' | 'registry' | 'notice' | 'message';
  action: string;
  description: string;
  user: string;
  timestamp: string;
}