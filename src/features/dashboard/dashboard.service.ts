// src/features/dashboard/dashboard.service.ts
import { pool } from '../../config/db';
import type { DashboardStats } from './dashboard.types';

export class DashboardService {
  
  static async getStats(): Promise<DashboardStats> {
    // Run all queries in parallel with error handling
    const [
      documentStats,
      userStats,
      registryStats,
      noticeStats,
      inventoryStats,
      financialStats,
      dsaStats,
      messageStats
    ] = await Promise.all([
      this.getDocumentStats(),
      this.getUserStats(),
      this.getRegistryStats(),
      this.getNoticeStats(),
      this.getInventoryStats(),
      this.getFinancialStats(),
      this.getDsaStats(),
      this.getMessageStats(),
    ]);

    return {
      documents: documentStats,
      users: userStats,
      registry: registryStats,
      notices: noticeStats,
      inventory: inventoryStats,
      financial: financialStats,
      dsa: dsaStats,
      messages: messageStats,
    };
  }

  // ── Document Stats ──────────────────────────────────────────────────────

  private static async getDocumentStats() {
    try {
      // Get active documents grouped by status
      const { rows: statusRows } = await pool.query(`
        SELECT 
          status,
          COUNT(*) as count
        FROM documents
        WHERE is_active = true
        GROUP BY status
      `);

      // Get total, active, inactive counts
      const { rows: totalRows } = await pool.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE is_active = true) as active,
          COUNT(*) FILTER (WHERE is_active = false) as inactive
        FROM documents
      `);

      const total = parseInt(totalRows[0]?.total || '0');
      const active = parseInt(totalRows[0]?.active || '0');
      const inactive = parseInt(totalRows[0]?.inactive || '0');

      // Initialize all statuses with 0
      const byStatus = {
        draft: 0,
        uploaded: 0,
        pending_review: 0,
        marked: 0,
        dept_assigned: 0,
        user_assigned: 0,
        in_progress: 0,
        completed: 0,
        filed: 0,
        ready_to_release: 0,
        released: 0,
      };

      // Populate with actual counts
      statusRows.forEach(row => {
        const status = row.status as keyof typeof byStatus;
        if (status in byStatus) {
          byStatus[status] = parseInt(row.count || '0');
        }
      });

      // Get assigned counts (marked + dept_assigned)
      const marked = byStatus.marked;
      const deptAssigned = byStatus.dept_assigned;

      return {
        total,
        active,
        inactive,
        byStatus,
        assigned: {
          total: marked + deptAssigned,
          marked,
          dept_assigned: deptAssigned,
        },
      };
    } catch (error) {
      console.error('[Dashboard] Failed to fetch document stats:', error);
      return {
        total: 0,
        active: 0,
        inactive: 0,
        byStatus: {
          draft: 0,
          uploaded: 0,
          pending_review: 0,
          marked: 0,
          dept_assigned: 0,
          user_assigned: 0,
          in_progress: 0,
          completed: 0,
          filed: 0,
          ready_to_release: 0,
          released: 0,
        },
        assigned: {
          total: 0,
          marked: 0,
          dept_assigned: 0,
        },
      };
    }
  }

  // ── User Stats ──────────────────────────────────────────────────────────

  private static async getUserStats() {
    try {
      // Check if users table exists
      const { rows: tableCheck } = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'users'
        )
      `);
      
      if (!tableCheck[0].exists) {
        return {
          total: 0,
          active: 0,
          inactive: 0,
          byRole: [],
        };
      }

      // Get total, active, inactive counts
      const { rows: totalRows } = await pool.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE is_active = true) as active,
          COUNT(*) FILTER (WHERE is_active = false) as inactive
        FROM users
      `);

      // Get role breakdown
      const { rows: roleRows } = await pool.query(`
        SELECT role, COUNT(*) as count
        FROM users
        GROUP BY role
        ORDER BY role
      `);

      return {
        total: parseInt(totalRows[0]?.total || '0'),
        active: parseInt(totalRows[0]?.active || '0'),
        inactive: parseInt(totalRows[0]?.inactive || '0'),
        byRole: roleRows.map(r => ({
          role: r.role,
          count: parseInt(r.count || '0'),
        })),
      };
    } catch (error) {
      console.warn('[Dashboard] Failed to fetch user stats:', error);
      return {
        total: 0,
        active: 0,
        inactive: 0,
        byRole: [],
      };
    }
  }

  // ── Registry Stats ──────────────────────────────────────────────────────

  private static async getRegistryStats() {
    try {
      // Station counts
      const { rows: stationRows } = await pool.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE is_active = true) as active,
          COUNT(*) FILTER (WHERE is_active = false) as inactive
        FROM stations
      `);

      // Total files across all stations (active registry entries)
      const { rows: fileRows } = await pool.query(`
        SELECT COUNT(*) as total
        FROM document_registry
        WHERE is_active = true
      `);

      // Top 6 stations by file count
      const { rows: topStations } = await pool.query(`
        SELECT 
          s.id,
          s.name,
          s.ref_no,
          COUNT(reg.id) as file_count
        FROM stations s
        LEFT JOIN document_registry reg ON reg.station_id = s.id AND reg.is_active = true
        WHERE s.is_active = true
        GROUP BY s.id, s.name, s.ref_no
        ORDER BY file_count DESC
        LIMIT 6
      `);

      return {
        stations: {
          total: parseInt(stationRows[0]?.total || '0'),
          active: parseInt(stationRows[0]?.active || '0'),
          inactive: parseInt(stationRows[0]?.inactive || '0'),
        },
        totalFiles: parseInt(fileRows[0]?.total || '0'),
        topStations: topStations.map(s => ({
          id: s.id,
          name: s.name,
          ref_no: s.ref_no,
          file_count: parseInt(s.file_count || '0'),
        })),
      };
    } catch (error) {
      console.warn('[Dashboard] Failed to fetch registry stats:', error);
      return {
        stations: {
          total: 0,
          active: 0,
          inactive: 0,
        },
        totalFiles: 0,
        topStations: [],
      };
    }
  }

  // ── Notice Stats ────────────────────────────────────────────────────────

  private static async getNoticeStats() {
    try {
      const { rows } = await pool.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE is_read = false) as unread,
          COUNT(*) FILTER (WHERE is_read = true) as read
        FROM notices
        WHERE is_active = true
      `);

      return {
        total: parseInt(rows[0]?.total || '0'),
        unread: parseInt(rows[0]?.unread || '0'),
        read: parseInt(rows[0]?.read || '0'),
      };
    } catch (error) {
      console.warn('[Dashboard] Failed to fetch notice stats:', error);
      return {
        total: 0,
        unread: 0,
        read: 0,
      };
    }
  }

  // ── Inventory Stats ─────────────────────────────────────────────────────

  private static async getInventoryStats() {
    try {
      // Check which stock column exists
      const { rows: columns } = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'inventory_items'
      `);
      
      const columnNames = columns.map(c => c.column_name);
      
      // Use stock_level if it exists, otherwise try quantity
      const stockCol = columnNames.includes('stock_level') ? 'stock_level' :
                       columnNames.includes('quantity') ? 'quantity' : 'stock_level';

      const { rows } = await pool.query(`
        SELECT 
          COUNT(*) as total_items,
          COUNT(*) FILTER (WHERE ${stockCol} > 10) as in_stock,
          COUNT(*) FILTER (WHERE ${stockCol} BETWEEN 1 AND 10) as low_stock,
          COUNT(*) FILTER (WHERE ${stockCol} = 0) as out_of_stock
        FROM inventory_items
        WHERE is_active = true
      `);

      return {
        total: parseInt(rows[0]?.total_items || '0'),
        in_stock: parseInt(rows[0]?.in_stock || '0'),
        low_stock: parseInt(rows[0]?.low_stock || '0'),
        out_of_stock: parseInt(rows[0]?.out_of_stock || '0'),
      };
    } catch (error) {
      console.warn('[Dashboard] Failed to fetch inventory stats:', error);
      return {
        total: 0,
        in_stock: 0,
        low_stock: 0,
        out_of_stock: 0,
      };
    }
  }

  // ── Financial Stats ─────────────────────────────────────────────────────

  private static async getFinancialStats() {
    try {
      // Check if financial_activities table exists
      const { rows: tableCheck } = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'financial_activities'
        )
      `);

      if (!tableCheck[0].exists) {
        return {
          total_allocated: 0,
          total_paid: 0,
          committed_unpaid: 0,
          pro_bono_approved: 0,
        };
      }

      const { rows } = await pool.query(`
        SELECT 
          COALESCE(SUM(amount), 0) as total_allocated,
          COALESCE(SUM(amount_paid), 0) as total_paid,
          COALESCE(SUM(amount - amount_paid), 0) as committed_unpaid,
          COALESCE(SUM(amount) FILTER (WHERE is_pro_bono = true), 0) as pro_bono_approved
        FROM financial_activities
        WHERE is_active = true
      `);

      return {
        total_allocated: parseFloat(rows[0]?.total_allocated || '0'),
        total_paid: parseFloat(rows[0]?.total_paid || '0'),
        committed_unpaid: parseFloat(rows[0]?.committed_unpaid || '0'),
        pro_bono_approved: parseInt(rows[0]?.pro_bono_approved || '0'),
      };
    } catch (error) {
      console.warn('[Dashboard] Failed to fetch financial stats:', error);
      return {
        total_allocated: 0,
        total_paid: 0,
        committed_unpaid: 0,
        pro_bono_approved: 0,
      };
    }
  }

  // ── DSA Stats ───────────────────────────────────────────────────────────

  private static async getDsaStats() {
    try {
      // Check which night column exists
      const { rows: columns } = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'dsa_activities'
      `);
      
      const columnNames = columns.map(c => c.column_name);
      
      // Use nights if it exists, otherwise try night_outs
      const nightsCol = columnNames.includes('nights') ? 'nights' :
                        columnNames.includes('night_outs') ? 'night_outs' : 'nights';

      const { rows } = await pool.query(`
        SELECT 
          COUNT(*) as total_activities,
          COALESCE(SUM(${nightsCol}), 0) as total_night_outs,
          COALESCE(SUM(staff_count), 0) as staff_involved,
          COALESCE(SUM(total_amount), 0) as total_kes_payable
        FROM dsa_activities
        WHERE is_active = true
      `);

      return {
        total_activities: parseInt(rows[0]?.total_activities || '0'),
        total_night_outs: parseInt(rows[0]?.total_night_outs || '0'),
        staff_involved: parseInt(rows[0]?.staff_involved || '0'),
        total_kes_payable: parseFloat(rows[0]?.total_kes_payable || '0'),
      };
    } catch (error) {
      console.warn('[Dashboard] Failed to fetch DSA stats:', error);
      return {
        total_activities: 0,
        total_night_outs: 0,
        staff_involved: 0,
        total_kes_payable: 0,
      };
    }
  }

  // ── Message Stats ───────────────────────────────────────────────────────

private static async getMessageStats() {
  try {
    // Check if message_groups table exists
    const { rows: groupsCheck } = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'message_groups'
      )
    `);

    // Check if messages table has is_read column
    const { rows: msgColumns } = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'messages'
    `);
    
    const msgColumnNames = msgColumns.map(c => c.column_name);
    const readCol = msgColumnNames.includes('is_read') ? 'is_read' :
                    msgColumnNames.includes('read') ? 'read' : 'is_read';

    // Get total unread count
    const { rows: totalRows } = await pool.query(`
      SELECT COUNT(*) as unread_total
      FROM messages
      WHERE ${readCol} = false AND is_active = true
    `);

    // If message_groups doesn't exist, return just the total
    if (!groupsCheck[0].exists) {
      return {
        unread_total: parseInt(totalRows[0]?.unread_total || '0'),
        groups_with_unread: 0,
        by_group: [],
      };
    }

    // Get groups with unread counts - simplified query without nested aggregates
    const { rows: groupRows } = await pool.query(`
      SELECT 
        mg.id as group_id,
        mg.name as group_name,
        COUNT(m.id) as unread_count
      FROM message_groups mg
      LEFT JOIN messages m ON m.group_id = mg.id AND m.${readCol} = false AND m.is_active = true
      WHERE mg.is_active = true
      GROUP BY mg.id, mg.name
      HAVING COUNT(m.id) > 0
    `);

    const groupsWithUnread = groupRows.length;

    return {
      unread_total: parseInt(totalRows[0]?.unread_total || '0'),
      groups_with_unread: groupsWithUnread,
      by_group: groupRows.map(row => ({
        group_id: row.group_id,
        group_name: row.group_name,
        unread_count: parseInt(row.unread_count || '0'),
      })),
    };
  } catch (error) {
    console.warn('[Dashboard] Failed to fetch message stats:', error);
    return {
      unread_total: 0,
      groups_with_unread: 0,
      by_group: [],
    };
  }
}
}