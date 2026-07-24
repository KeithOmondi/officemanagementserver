// ============================================================
// helpdesk.service.ts
// ============================================================

import { pool } from '../../config/db';
import type { PoolClient } from 'pg';
import { AppError } from '../../utils/response';
import { sendGeneralRequestAcknowledgement } from '../../utils/sendMail';
import type {
    JudgeUtility,
    UtilityItem,
    ClubMembership,
    Circuit,
    SpecialBench,
    PartHeard,
    MedicalClaim,
    GeneralRequest,
    VisaRequest,
    ProtocolEvent,
    SecurityRequest,
    HelpDeskAuditEntry,
    HelpDeskStats,
    CreateUtilityInput,
    AddUtilityItemInput,
    UpdateUtilityItemInput,
    UtilityFilters,
    CreateClubMembershipInput,
    CreateCircuitInput,
    CreateSpecialBenchInput,
    CreatePartHeardInput,
    CreateMedicalClaimInput,
    CreateGeneralRequestInput,
    CreateVisaRequestInput,
    CreateProtocolEventInput,
    CreateSecurityRequestInput,
    UpdateSecurityRequestInput,
    UpdateStatusInput,
    HelpDeskFilters,
    DSADetailInput,
    ServiceWeek,
    CreateServiceWeekInput,
    OtherPayment,
    CreateOtherPaymentInput,
    UpdateBenchInput,
    UpdatePartHeardInput,
    DSAReportRow,
    DSAReportFilters,
    ReportModule,
    DSAPaymentStatus,
    DocumentView,
    RequestType,
    RemarkType,
    GeneralRequestCategory,
    UpdateGeneralRequestInput,
} from './helpdesk.types';

// ─── Constants ─────────────────────────────────────────────────────────────────

const UTILITY_REQUEST_SELECT = `
    id, judge_name, created_by, created_at, updated_at
`;

const UTILITY_ITEM_SELECT = `
    id, request_id, utility_type, requisition_number, amount::float8 AS amount, period, description,
    date_received, date_forwarded_dass, date_paid, status,
    supporting_document_url, created_at, updated_at
`;

const CLUB_SELECT = `
    id, pj_no, judge_name, club_name, 
    entry_fee::float8 AS entry_fee, 
    annual_fee::float8 AS annual_fee, 
    date_submitted_dass, court, payment_date, remarks,
    status, created_by, created_at, updated_at
`;

const CIRCUIT_SELECT = `
    id, name, location, start_date, end_date, total_dsa, status,
    created_by, created_at, updated_at
`;

const BENCH_SELECT = `
    id, name, case_reference, start_date, end_date, total_dsa, status,
    created_by, created_at, updated_at
`;

const PART_HEARD_SELECT = `
    id, case_reference, approved_by, start_date, end_date, total_dsa, status,
    created_by, created_at, updated_at
`;

const SERVICE_WEEK_SELECT = `
    id, name, week_number, year, start_date, end_date, total_dsa, status,
    created_by, created_at, updated_at
`;

const MEDICAL_CLAIM_SELECT = `
    id, s_no, officer_name, claim_amount::float8 AS claim_amount, 
    date_forwarded_dhr, status, remarks,
    created_by, created_at, updated_at
`;

const GENERAL_REQUEST_SELECT = `
    id, s_no, ticket_number, judge_name, request, request_type, category,
    date_received, officer_assigned, status, remarks, remark_type,
    request_date, location, firearm_type, force_number, officer_name,
    assigned_to, priority, notes,
    rank, reporting_date,
    created_by, created_at, updated_at
`;

const VISA_SELECT = `
    id, s_no, judge_name, destination_country, date_of_travel, date_of_return,
    visa_type, purpose_of_travel, remarks, status, notes,
    created_by, created_at, updated_at
`;

const VISA_DOCUMENT_SELECT = `
    id, visa_request_id, document_name, document_url, viewed_at, view_count, created_at
`;

const PROTOCOL_SELECT = `
    id, s_no, activity, period_from, period_to, officers_assigned, remarks,
    dsa_required, total_dsa, status, notes,
    created_by, created_at, updated_at
`;

// Deprecated - kept for backward compatibility
const SECURITY_REQUEST_SELECT = `
    id, s_no, judge_name, request_type, request_date, officer_assigned,
    status, remarks, remark_type, location, firearm_type, force_number,
    created_by, created_at, updated_at
`;

const DSA_DETAIL_SELECT = `
    id, judge_name, pj_number, designation, dsa_per_day::float8 AS dsa_per_day,
    days, total::float8 AS total, notes,
    date_of_request, date_of_ticket_facilitation, date_of_conference_facilitation,
    travel_date, travel_back, requisition_number, requisition_initiation_date, payment_status
`;

const OTHER_PAYMENT_SELECT = `
    id, name, description, start_date, end_date, total_dsa, status,
    created_by, created_at, updated_at
`;

// ─── DSA Detail Table Configuration ──────────────────────────────────────────

type DSATableConfig = {
    table: string;
    foreignKey: string;
    parentType: string;
};

const DSA_TABLE_CONFIG: Record<string, DSATableConfig> = {
    circuit: { table: 'circuit_dsa_details', foreignKey: 'circuit_id', parentType: 'circuit' },
    bench: { table: 'special_bench_dsa_details', foreignKey: 'bench_id', parentType: 'special_bench' },
    partHeard: { table: 'part_heard_dsa_details', foreignKey: 'part_heard_id', parentType: 'part_heard' },
    serviceWeek: { table: 'service_week_dsa_details', foreignKey: 'service_week_id', parentType: 'service_week' },
    otherPayment: { table: 'other_payment_dsa_details', foreignKey: 'other_payment_id', parentType: 'other_payment' },
    protocol: { table: 'protocol_dsa_details', foreignKey: 'protocol_event_id', parentType: 'protocol' },
};

const REPORT_MODULE_CONFIG: Record<
    ReportModule,
    { parentTable: string; dsaTable: string; fk: string; activityCol: string; parentType: string }
> = {
    circuit: { 
        parentTable: 'circuits', 
        dsaTable: 'circuit_dsa_details', 
        fk: 'circuit_id', 
        activityCol: 'name',
        parentType: 'circuit'
    },
    special_bench: { 
        parentTable: 'special_benches', 
        dsaTable: 'special_bench_dsa_details', 
        fk: 'bench_id', 
        activityCol: 'name',
        parentType: 'special_bench'
    },
    part_heard: { 
        parentTable: 'part_heards', 
        dsaTable: 'part_heard_dsa_details', 
        fk: 'part_heard_id', 
        activityCol: 'case_reference',
        parentType: 'part_heard'
    },
    service_week: { 
        parentTable: 'service_weeks', 
        dsaTable: 'service_week_dsa_details', 
        fk: 'service_week_id', 
        activityCol: 'name',
        parentType: 'service_week'
    },
    other_payment: { 
        parentTable: 'other_payments', 
        dsaTable: 'other_payment_dsa_details', 
        fk: 'other_payment_id', 
        activityCol: 'name',
        parentType: 'other_payment'
    },
};

// ─── Helper Functions ─────────────────────────────────────────────────────────

async function generateSerialNumber(client: PoolClient, table: string): Promise<number> {
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [table]);

    const { rows } = await client.query(
        `SELECT COALESCE(MAX(s_no), 0) + 1 as next_serial FROM ${table} WHERE is_active = true`
    );
    return rows[0].next_serial;
}

async function generateTicketNumber(client: PoolClient): Promise<string> {
    const today = new Date();
    const dateStr = today.getFullYear() +
        String(today.getMonth() + 1).padStart(2, '0') +
        String(today.getDate()).padStart(2, '0');

    const { rows } = await client.query(`SELECT nextval('general_requests_ticket_seq') AS seq`);
    const seq = String(rows[0].seq).padStart(4, '0');
    return `GR-${dateStr}-${seq}`;
}

// ─── Service Class ────────────────────────────────────────────────────────────

export class HelpDeskService {

    // ─── Statistics ──────────────────────────────────────────────────────────

    static async getStats(): Promise<HelpDeskStats> {
        const { rows } = await pool.query(`
            SELECT
                (SELECT COUNT(*)::int FROM judge_utility_requests WHERE is_active = true) +
                (SELECT COUNT(*)::int FROM club_memberships WHERE is_active = true) +
                (SELECT COUNT(*)::int FROM circuits WHERE is_active = true) +
                (SELECT COUNT(*)::int FROM special_benches WHERE is_active = true) +
                (SELECT COUNT(*)::int FROM part_heards WHERE is_active = true) +
                (SELECT COUNT(*)::int FROM service_weeks WHERE is_active = true) +
                (SELECT COUNT(*)::int FROM medical_claims WHERE is_active = true) +
                (SELECT COUNT(*)::int FROM general_requests WHERE is_active = true) +
                (SELECT COUNT(*)::int FROM other_payments WHERE is_active = true) AS total_records,
                (SELECT COUNT(*)::int FROM judge_utility_items WHERE status IN ('Awaiting', 'Awaiting Documentation', 'Awaiting Funding', 'In Process') AND is_active = true) +
                (SELECT COUNT(*)::int FROM circuits WHERE status IN ('Pending', 'In Progress') AND is_active = true) +
                (SELECT COUNT(*)::int FROM special_benches WHERE status IN ('Pending', 'In Progress') AND is_active = true) +
                (SELECT COUNT(*)::int FROM part_heards WHERE status IN ('Pending', 'In Progress') AND is_active = true) +
                (SELECT COUNT(*)::int FROM service_weeks WHERE status IN ('Pending', 'In Progress') AND is_active = true) +
                (SELECT COUNT(*)::int FROM medical_claims WHERE status IN ('Pending', 'In Progress') AND is_active = true) +
                (SELECT COUNT(*)::int FROM general_requests WHERE status IN ('Pending', 'In Progress') AND is_active = true) +
                (SELECT COUNT(*)::int FROM other_payments WHERE status IN ('Pending', 'In Progress') AND is_active = true) AS in_progress,
                (SELECT COUNT(*)::int FROM visa_requests WHERE status = 'Active' AND is_active = true) AS visa_active,
                (SELECT COUNT(*)::int FROM protocol_events WHERE status = 'Pending' AND is_active = true) AS protocol_pending
        `);
        return rows[0];
    }

    // ─── Audit Log ────────────────────────────────────────────────────────────

    static async getAuditLog(limit: number = 50): Promise<HelpDeskAuditEntry[]> {
        const { rows } = await pool.query(
            `SELECT * FROM help_desk_audit_log 
             WHERE is_active = true
             ORDER BY timestamp DESC
             LIMIT $1`,
            [limit]
        );
        return rows;
    }

    // ─── Helper: Get DSA Details ─────────────────────────────────────────────

    /**
     * Get DSA details for a specific parent entity.
     * Filters by both the foreign key and parent_type to ensure data integrity.
     */
    private static async getDSADetails(
        table: string, 
        foreignKey: string, 
        parentId: string, 
        parentType: string
    ): Promise<any[]> {
        const { rows } = await pool.query(
            `SELECT ${DSA_DETAIL_SELECT} 
             FROM ${table} 
             WHERE ${foreignKey} = $1 AND is_active = true AND parent_type = $2
             ORDER BY created_at ASC`,
            [parentId, parentType]
        );
        return rows;
    }

    /**
     * Get DSA details using the configuration for a specific entity type.
     */
    private static async getDSADetailsByType(
        entityType: keyof typeof DSA_TABLE_CONFIG,
        parentId: string
    ): Promise<any[]> {
        const config = DSA_TABLE_CONFIG[entityType];
        if (!config) {
            throw new AppError(400, `Unknown entity type: ${entityType}`);
        }
        return this.getDSADetails(config.table, config.foreignKey, parentId, config.parentType);
    }

    // ─── NEW: Firearm validation helper ──────────────────────────────────────

    /**
     * Validates the business rule for Firearm requests:
     * firearm_type is required when officer_assigned is provided.
     */
    private static validateGeneralRequestInput(
        input: Partial<CreateGeneralRequestInput | UpdateGeneralRequestInput>,
        isUpdate: boolean = false
    ): void {
        // Only enforce if request_type is Firearm and officer_assigned is set
        if (input.request_type === 'Firearm' && input.officer_assigned) {
            const firearm = input.firearm_type;
            if (!firearm || firearm.trim() === '') {
                throw new AppError(400, 'firearm_type is required when an officer is assigned to a Firearm request');
            }
        }
    }

    // ============================================================
    // GENERAL REQUESTS (UNIFIED - includes all security/personnel)
    // ============================================================

    // ─── General Requests ──────────────────────────────────────────────────

    static async findAllGeneralRequests(filters: HelpDeskFilters = {}): Promise<GeneralRequest[]> {
        let query = `SELECT ${GENERAL_REQUEST_SELECT} FROM general_requests WHERE is_active = true`;
        const params: unknown[] = [];
        let paramCount = 1;

        if (filters.search) {
            query += ` AND (judge_name ILIKE $${paramCount} OR request ILIKE $${paramCount} OR ticket_number ILIKE $${paramCount})`;
            params.push(`%${filters.search}%`);
            paramCount++;
        }
        if (filters.status) {
            query += ` AND status = $${paramCount}`;
            params.push(filters.status);
            paramCount++;
        }
        if (filters.judge_name) {
            query += ` AND judge_name ILIKE $${paramCount}`;
            params.push(`%${filters.judge_name}%`);
            paramCount++;
        }
        if (filters.request_type) {
            query += ` AND request_type = $${paramCount}`;
            params.push(filters.request_type);
            paramCount++;
        }
        if (filters.remark_type) {
            query += ` AND remark_type = $${paramCount}`;
            params.push(filters.remark_type);
            paramCount++;
        }
        if (filters.category) {
            query += ` AND category = $${paramCount}`;
            params.push(filters.category);
            paramCount++;
        }

        query += ` ORDER BY created_at DESC`;
        if (filters.limit) {
            query += ` LIMIT $${paramCount}`;
            params.push(filters.limit);
            paramCount++;
        }
        if (filters.offset) {
            query += ` OFFSET $${paramCount}`;
            params.push(filters.offset);
        }

        const { rows } = await pool.query(query, params);
        return rows;
    }

    static async findGeneralRequestById(id: string): Promise<GeneralRequest | null> {
        const { rows } = await pool.query(
            `SELECT ${GENERAL_REQUEST_SELECT} FROM general_requests WHERE id = $1 AND is_active = true`,
            [id]
        );
        return rows[0] || null;
    }

    static async findGeneralRequestsByJudge(judgeName: string): Promise<GeneralRequest[]> {
        const { rows } = await pool.query(
            `SELECT ${GENERAL_REQUEST_SELECT} 
             FROM general_requests 
             WHERE judge_name ILIKE $1 AND is_active = true
             ORDER BY created_at DESC`,
            [`%${judgeName}%`]
        );
        return rows;
    }

    static async findGeneralRequestsByType(requestType: RequestType): Promise<GeneralRequest[]> {
        const { rows } = await pool.query(
            `SELECT ${GENERAL_REQUEST_SELECT} 
             FROM general_requests 
             WHERE request_type = $1 AND is_active = true
             ORDER BY created_at DESC`,
            [requestType]
        );
        return rows;
    }

    static async findGeneralRequestsByRemarkType(remarkType: RemarkType): Promise<GeneralRequest[]> {
        const { rows } = await pool.query(
            `SELECT ${GENERAL_REQUEST_SELECT} 
             FROM general_requests 
             WHERE remark_type = $1 AND is_active = true
             ORDER BY created_at DESC`,
            [remarkType]
        );
        return rows;
    }

    // ─── UPDATED: Added rank, reporting_date, and Firearm validation ──────

    static async createGeneralRequest(
        input: CreateGeneralRequestInput,
        userId: string
    ): Promise<GeneralRequest> {
        // Validate business rule
        this.validateGeneralRequestInput(input, false);

        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            const s_no = await generateSerialNumber(client, 'general_requests');
            const ticketNumber = await generateTicketNumber(client);

            // Determine category if not provided
            let category = input.category;
            if (!category) {
                const securityTypes: RequestType[] = ['Firearm', 'Current Station', 'Force Number', 'Residence Security', 'Sentry'];
                const personnelTypes: RequestType[] = ['Driver', 'Bodyguard'];

                if (securityTypes.includes(input.request_type)) {
                    category = 'Security';
                } else if (personnelTypes.includes(input.request_type)) {
                    category = 'Personnel';
                } else {
                    category = 'Administrative';
                }
            }

            const { rows } = await client.query(
                `INSERT INTO general_requests (
                    s_no, ticket_number, judge_name, request, request_type, category,
                    date_received, officer_assigned, status, remarks, remark_type,
                    request_date, location, firearm_type, force_number, officer_name,
                    assigned_to, priority, notes,
                    rank, reporting_date,
                    created_by
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
                RETURNING id`,
                [
                    s_no,
                    ticketNumber,
                    input.judge_name.trim(),
                    input.request.trim(),
                    input.request_type,
                    category,
                    input.date_received || null,
                    input.officer_assigned || null,
                    input.status || 'Pending',
                    input.remarks || null,
                    input.remark_type || null,
                    input.request_date,
                    input.location || null,
                    input.firearm_type || null,
                    input.force_number || null,
                    input.officer_name || null,
                    input.assigned_to || null,
                    input.priority || null,
                    input.notes || null,
                    input.rank || null,
                    input.reporting_date || null,
                    userId,
                ]
            );

            await client.query('COMMIT');

            const request = await this.findGeneralRequestById(rows[0].id);
            if (!request) throw new AppError(500, 'Failed to create general request');

            // Send email only if send_email is true and email is provided
            if (input.send_email && input.email) {
                try {
                    await sendGeneralRequestAcknowledgement({
                        to: input.email,
                        ticketNumber,
                        judgeName: input.judge_name,
                        request: input.request,
                    });
                } catch (emailError) {
                    console.error('[EMAIL ERROR] Failed to send general request acknowledgement:', emailError);
                    // Don't throw - we don't want to fail the request creation if email fails
                }
            }

            return request;

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    static async updateGeneralRequest(
        id: string,
        input: UpdateGeneralRequestInput
    ): Promise<GeneralRequest> {
        // Validate business rule
        this.validateGeneralRequestInput(input, true);

        const existing = await this.findGeneralRequestById(id);
        if (!existing) {
            throw new AppError(404, 'General request not found');
        }

        const fields: string[] = [];
        const values: unknown[] = [];
        let paramCount = 1;

        const setField = (column: string, value: unknown) => {
            if (value !== undefined) {
                fields.push(`${column} = $${paramCount}`);
                values.push(value);
                paramCount++;
            }
        };

        setField('request', input.request?.trim());
        setField('request_type', input.request_type);
        setField('category', input.category);
        setField('date_received', input.date_received);
        setField('officer_assigned', input.officer_assigned);
        setField('status', input.status);
        setField('remarks', input.remarks);
        setField('remark_type', input.remark_type);
        setField('request_date', input.request_date);
        setField('location', input.location);
        setField('firearm_type', input.firearm_type);
        setField('force_number', input.force_number);
        setField('officer_name', input.officer_name);
        setField('assigned_to', input.assigned_to);
        setField('priority', input.priority);
        setField('notes', input.notes);
        setField('rank', input.rank);
        setField('reporting_date', input.reporting_date);

        if (fields.length === 0) {
            return existing;
        }

        fields.push(`updated_at = now()`);
        values.push(id);

        await pool.query(
            `UPDATE general_requests SET ${fields.join(', ')} WHERE id = $${paramCount}`,
            values
        );

        const updated = await this.findGeneralRequestById(id);
        if (!updated) throw new AppError(500, 'Failed to update general request');
        return updated;
    }

    static async updateGeneralRequestStatus(
        id: string,
        input: UpdateStatusInput
    ): Promise<GeneralRequest> {
        const existing = await this.findGeneralRequestById(id);
        if (!existing) {
            throw new AppError(404, 'General request not found');
        }

        await pool.query(
            `UPDATE general_requests 
             SET status = $1, remarks = COALESCE($2, remarks), updated_at = now()
             WHERE id = $3`,
            [input.status, input.notes || null, id]
        );

        const updated = await this.findGeneralRequestById(id);
        if (!updated) throw new AppError(500, 'Failed to update general request status');

        // Send email based on status change
        if (input.email) {
            try {
                if (input.status === 'Resolved') {
                    const { sendGeneralRequestResolved } = require('../../utils/sendMail');
                    
                    await sendGeneralRequestResolved({
                        to: input.email,
                        ticketNumber: updated.ticket_number || 'N/A',
                        judgeName: updated.judge_name,
                        request: updated.request,
                        resolution: input.remarks || 'Request has been resolved satisfactorily.',
                        resolvedBy: input.resolvedBy || 'System Administrator',
                    });
                } else if (input.status === 'Rejected') {
                    const { sendGeneralRequestRejected } = require('../../utils/sendMail');
                    
                    await sendGeneralRequestRejected({
                        to: input.email,
                        ticketNumber: updated.ticket_number || 'N/A',
                        judgeName: updated.judge_name,
                        request: updated.request,
                        reason: input.remarks || 'No specific reason provided.',
                        rejectedBy: input.rejectedBy || 'System Administrator',
                    });
                }
            } catch (emailError) {
                console.error('[EMAIL ERROR] Failed to send status update email:', emailError);
                // Don't throw - we don't want to fail the status update if email fails
            }
        }

        return updated;
    }

    static async deleteGeneralRequest(id: string): Promise<void> {
        const { rows } = await pool.query(
            `UPDATE general_requests SET is_active = false WHERE id = $1 RETURNING id`,
            [id]
        );
        if (rows.length === 0) {
            throw new AppError(404, 'General request not found');
        }
    }

    // ─── General Request Bulk Operations ──────────────────────────────────

    static async getGeneralRequestStats(): Promise<{
        total: number;
        byType: Record<RequestType, number>;
        byStatus: Record<string, number>;
        byRemarkType: Record<RemarkType, number>;
        byCategory: Record<GeneralRequestCategory, number>;
    }> {
        const { rows: totalRows } = await pool.query(
            `SELECT COUNT(*)::int as count FROM general_requests WHERE is_active = true`
        );

        const { rows: byTypeRows } = await pool.query(
            `SELECT request_type, COUNT(*)::int as count 
             FROM general_requests 
             WHERE is_active = true 
             GROUP BY request_type`
        );

        const { rows: byStatusRows } = await pool.query(
            `SELECT status, COUNT(*)::int as count 
             FROM general_requests 
             WHERE is_active = true 
             GROUP BY status`
        );

        const { rows: byRemarkRows } = await pool.query(
            `SELECT remark_type, COUNT(*)::int as count 
             FROM general_requests 
             WHERE is_active = true AND remark_type IS NOT NULL
             GROUP BY remark_type`
        );

        const { rows: byCategoryRows } = await pool.query(
            `SELECT category, COUNT(*)::int as count 
             FROM general_requests 
             WHERE is_active = true AND category IS NOT NULL
             GROUP BY category`
        );

        const byType = byTypeRows.reduce((acc, row) => {
            acc[row.request_type] = row.count;
            return acc;
        }, {} as Record<RequestType, number>);

        const byStatus = byStatusRows.reduce((acc, row) => {
            acc[row.status] = row.count;
            return acc;
        }, {} as Record<string, number>);

        const byRemarkType = byRemarkRows.reduce((acc, row) => {
            acc[row.remark_type] = row.count;
            return acc;
        }, {} as Record<RemarkType, number>);

        const byCategory = byCategoryRows.reduce((acc, row) => {
            acc[row.category] = row.count;
            return acc;
        }, {} as Record<GeneralRequestCategory, number>);

        return {
            total: totalRows[0].count,
            byType,
            byStatus,
            byRemarkType,
            byCategory,
        };
    }

    // ─── General Request Email Notifications ─────────────────────────────

    static async sendGeneralRequestEmail(
        id: string,
        email: string,
        type: 'acknowledgement' | 'resolved' | 'rejected'
    ): Promise<void> {
        const request = await this.findGeneralRequestById(id);
        if (!request) {
            throw new AppError(404, 'General request not found');
        }

        try {
            if (type === 'acknowledgement') {
                await sendGeneralRequestAcknowledgement({
                    to: email,
                    ticketNumber: request.ticket_number || 'N/A',
                    judgeName: request.judge_name,
                    request: request.request,
                });
            } else {
                const { sendGeneralRequestResolved, sendGeneralRequestRejected } = require('../../utils/sendMail');
                
                if (type === 'resolved') {
                    await sendGeneralRequestResolved({
                        to: email,
                        ticketNumber: request.ticket_number || 'N/A',
                        judgeName: request.judge_name,
                        request: request.request,
                        resolution: request.remarks || 'Request has been resolved satisfactorily.',
                        resolvedBy: 'System Administrator',
                    });
                } else if (type === 'rejected') {
                    await sendGeneralRequestRejected({
                        to: email,
                        ticketNumber: request.ticket_number || 'N/A',
                        judgeName: request.judge_name,
                        request: request.request,
                        reason: request.remarks || 'No specific reason provided.',
                        rejectedBy: 'System Administrator',
                    });
                }
            }
        } catch (emailError) {
            console.error(`[EMAIL ERROR] Failed to send ${type} email:`, emailError);
            throw new AppError(500, `Failed to send ${type} email`);
        }
    }

    // ============================================================
    // LEGACY SECURITY REQUESTS (Deprecated - kept for backward compatibility)
    // ============================================================

    /**
     * @deprecated Use findAllGeneralRequests with request_type filter instead
     */
    static async findAllSecurityRequests(filters: HelpDeskFilters = {}): Promise<SecurityRequest[]> {
        const generalRequests = await this.findAllGeneralRequests({
            ...filters,
            request_type: filters.request_type as RequestType,
        });
        
        return generalRequests.map(req => ({
            id: req.id,
            s_no: req.s_no,
            judge_name: req.judge_name,
            request_type: req.request_type,
            request_date: req.request_date,
            officer_assigned: req.officer_assigned,
            status: req.status,
            remarks: req.remarks,
            remark_type: req.remark_type,
            location: req.location,
            firearm_type: req.firearm_type,
            force_number: req.force_number,
            created_by: req.created_by,
            created_at: req.created_at,
            updated_at: req.updated_at,
        }));
    }

    /**
     * @deprecated Use findGeneralRequestById instead
     */
    static async findSecurityRequestById(id: string): Promise<SecurityRequest | null> {
        const req = await this.findGeneralRequestById(id);
        if (!req) return null;
        
        return {
            id: req.id,
            s_no: req.s_no,
            judge_name: req.judge_name,
            request_type: req.request_type,
            request_date: req.request_date,
            officer_assigned: req.officer_assigned,
            status: req.status,
            remarks: req.remarks,
            remark_type: req.remark_type,
            location: req.location,
            firearm_type: req.firearm_type,
            force_number: req.force_number,
            created_by: req.created_by,
            created_at: req.created_at,
            updated_at: req.updated_at,
        };
    }

    /**
     * @deprecated Use findGeneralRequestsByJudge instead
     */
    static async findSecurityRequestsByJudge(judgeName: string): Promise<SecurityRequest[]> {
        const generalRequests = await this.findGeneralRequestsByJudge(judgeName);
        return generalRequests.map(req => ({
            id: req.id,
            s_no: req.s_no,
            judge_name: req.judge_name,
            request_type: req.request_type,
            request_date: req.request_date,
            officer_assigned: req.officer_assigned,
            status: req.status,
            remarks: req.remarks,
            remark_type: req.remark_type,
            location: req.location,
            firearm_type: req.firearm_type,
            force_number: req.force_number,
            created_by: req.created_by,
            created_at: req.created_at,
            updated_at: req.updated_at,
        }));
    }

    /**
     * @deprecated Use findGeneralRequestsByType instead
     */
    static async findSecurityRequestsByType(requestType: RequestType): Promise<SecurityRequest[]> {
        const generalRequests = await this.findGeneralRequestsByType(requestType);
        return generalRequests.map(req => ({
            id: req.id,
            s_no: req.s_no,
            judge_name: req.judge_name,
            request_type: req.request_type,
            request_date: req.request_date,
            officer_assigned: req.officer_assigned,
            status: req.status,
            remarks: req.remarks,
            remark_type: req.remark_type,
            location: req.location,
            firearm_type: req.firearm_type,
            force_number: req.force_number,
            created_by: req.created_by,
            created_at: req.created_at,
            updated_at: req.updated_at,
        }));
    }

    /**
     * @deprecated Use createGeneralRequest instead
     */
    static async createSecurityRequest(
        input: CreateSecurityRequestInput,
        userId: string
    ): Promise<SecurityRequest> {
        const generalInput: CreateGeneralRequestInput = {
            judge_name: input.judge_name,
            request: `Security Request - ${input.request_type}`,
            request_type: input.request_type,
            date_received: input.request_date || undefined,
            officer_assigned: input.officer_assigned,
            status: input.status,
            remarks: input.remarks,
            remark_type: input.remark_type,
            request_date: input.request_date,
            location: input.location,
            firearm_type: input.firearm_type,
            force_number: input.force_number,
            email: input.email,
            send_email: input.send_email || false,
        };

        const result = await this.createGeneralRequest(generalInput, userId);
        
        return {
            id: result.id,
            s_no: result.s_no,
            judge_name: result.judge_name,
            request_type: result.request_type,
            request_date: result.request_date,
            officer_assigned: result.officer_assigned,
            status: result.status,
            remarks: result.remarks,
            remark_type: result.remark_type,
            location: result.location,
            firearm_type: result.firearm_type,
            force_number: result.force_number,
            created_by: result.created_by,
            created_at: result.created_at,
            updated_at: result.updated_at,
        };
    }

    /**
     * @deprecated Use updateGeneralRequest instead
     */
    static async updateSecurityRequest(
        id: string,
        input: UpdateSecurityRequestInput
    ): Promise<SecurityRequest> {
        const updateInput: UpdateGeneralRequestInput = {
            request_type: input.request_type,
            request_date: input.request_date,
            officer_assigned: input.officer_assigned,
            status: input.status,
            remarks: input.remarks,
            remark_type: input.remark_type,
            location: input.location,
            firearm_type: input.firearm_type,
            force_number: input.force_number,
        };

        const result = await this.updateGeneralRequest(id, updateInput);
        
        return {
            id: result.id,
            s_no: result.s_no,
            judge_name: result.judge_name,
            request_type: result.request_type,
            request_date: result.request_date,
            officer_assigned: result.officer_assigned,
            status: result.status,
            remarks: result.remarks,
            remark_type: result.remark_type,
            location: result.location,
            firearm_type: result.firearm_type,
            force_number: result.force_number,
            created_by: result.created_by,
            created_at: result.created_at,
            updated_at: result.updated_at,
        };
    }

    /**
     * @deprecated Use updateGeneralRequestStatus instead
     */
    static async updateSecurityRequestStatus(
        id: string,
        input: UpdateStatusInput
    ): Promise<SecurityRequest> {
        const result = await this.updateGeneralRequestStatus(id, input);
        
        return {
            id: result.id,
            s_no: result.s_no,
            judge_name: result.judge_name,
            request_type: result.request_type,
            request_date: result.request_date,
            officer_assigned: result.officer_assigned,
            status: result.status,
            remarks: result.remarks,
            remark_type: result.remark_type,
            location: result.location,
            firearm_type: result.firearm_type,
            force_number: result.force_number,
            created_by: result.created_by,
            created_at: result.created_at,
            updated_at: result.updated_at,
        };
    }

    /**
     * @deprecated Use deleteGeneralRequest instead
     */
    static async deleteSecurityRequest(id: string): Promise<void> {
        return this.deleteGeneralRequest(id);
    }

    /**
     * @deprecated Use getGeneralRequestStats instead
     */
    static async getSecurityRequestStats(): Promise<{
        total: number;
        byType: Record<RequestType, number>;
        byStatus: Record<string, number>;
        byRemarkType: Record<RemarkType, number>;
    }> {
        const stats = await this.getGeneralRequestStats();
        return {
            total: stats.total,
            byType: stats.byType,
            byStatus: stats.byStatus,
            byRemarkType: stats.byRemarkType,
        };
    }

    // ============================================================
    // JUDGE UTILITIES
    // ============================================================

    private static async getUtilityItems(requestId: string): Promise<UtilityItem[]> {
        const { rows } = await pool.query(
            `SELECT ${UTILITY_ITEM_SELECT}
             FROM judge_utility_items
             WHERE request_id = $1 AND is_active = true
             ORDER BY created_at ASC`,
            [requestId]
        );
        return rows;
    }

    static async findAllUtilities(filters: UtilityFilters = {}): Promise<JudgeUtility[]> {
        let query = `SELECT ${UTILITY_REQUEST_SELECT} FROM judge_utility_requests WHERE is_active = true`;
        const params: unknown[] = [];
        let paramCount = 1;

        if (filters.search) {
            query += ` AND judge_name ILIKE $${paramCount}`;
            params.push(`%${filters.search}%`);
            paramCount++;
        }
        if (filters.judge_name) {
            query += ` AND judge_name ILIKE $${paramCount}`;
            params.push(`%${filters.judge_name}%`);
            paramCount++;
        }

        query += ` ORDER BY created_at DESC`;
        if (filters.limit) {
            query += ` LIMIT $${paramCount}`;
            params.push(filters.limit);
            paramCount++;
        }
        if (filters.offset) {
            query += ` OFFSET $${paramCount}`;
            params.push(filters.offset);
        }

        const { rows } = await pool.query(query, params);

        for (const request of rows) {
            let items = await this.getUtilityItems(request.id);
            if (filters.status) {
                items = items.filter((item) => item.status === filters.status);
            }
            request.items = items;
        }

        return filters.status ? rows.filter((r) => r.items.length > 0) : rows;
    }

    static async findUtilityById(id: string): Promise<JudgeUtility | null> {
        const { rows } = await pool.query(
            `SELECT ${UTILITY_REQUEST_SELECT} FROM judge_utility_requests WHERE id = $1 AND is_active = true`,
            [id]
        );
        if (rows.length === 0) return null;

        const request = rows[0];
        request.items = await this.getUtilityItems(id);
        return request;
    }

    static async createUtility(
        input: CreateUtilityInput,
        userId: string
    ): Promise<JudgeUtility> {
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            const { rows } = await client.query(
                `INSERT INTO judge_utility_requests (judge_name, created_by)
                 VALUES ($1, $2)
                 RETURNING id`,
                [input.judge_name.trim(), userId]
            );

            const requestId = rows[0].id;

            for (const item of input.items) {
                await client.query(
                    `INSERT INTO judge_utility_items (
                        request_id, utility_type, requisition_number, amount, period, description,
                        date_received, date_forwarded_dass, date_paid, status
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                    [
                        requestId,
                        item.utility_type,
                        item.requisition_number || null,
                        item.amount,
                        item.period.trim(),
                        item.description || null,
                        item.date_received || null,
                        item.date_forwarded_dass || null,
                        item.date_paid || null,
                        item.status || 'Awaiting',
                    ]
                );
            }

            await client.query('COMMIT');

            const utility = await this.findUtilityById(requestId);
            if (!utility) throw new AppError(500, 'Failed to create judge utility record');
            return utility;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    static async addUtilityItem(
        requestId: string,
        input: AddUtilityItemInput
    ): Promise<JudgeUtility> {
        const existing = await this.findUtilityById(requestId);
        if (!existing) {
            throw new AppError(404, 'Judge utility record not found');
        }

        await pool.query(
            `INSERT INTO judge_utility_items (
                request_id, utility_type, requisition_number, amount, period, description,
                date_received, date_forwarded_dass, date_paid, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
                requestId,
                input.utility_type,
                input.requisition_number || null,
                input.amount,
                input.period.trim(),
                input.description || null,
                input.date_received || null,
                input.date_forwarded_dass || null,
                input.date_paid || null,
                input.status || 'Awaiting',
            ]
        );

        const updated = await this.findUtilityById(requestId);
        if (!updated) throw new AppError(500, 'Failed to add utility item');
        return updated;
    }

    static async updateUtilityItem(
        requestId: string,
        itemId: string,
        input: UpdateUtilityItemInput
    ): Promise<JudgeUtility> {
        const request = await this.findUtilityById(requestId);
        if (!request) {
            throw new AppError(404, 'Judge utility record not found');
        }

        const item = request.items.find((i) => i.id === itemId);
        if (!item) {
            throw new AppError(404, 'Utility item not found');
        }

        const fields: string[] = [];
        const values: unknown[] = [];
        let paramCount = 1;

        const setField = (column: string, value: unknown) => {
            if (value !== undefined) {
                fields.push(`${column} = $${paramCount}`);
                values.push(value);
                paramCount++;
            }
        };

        setField('status', input.status);
        setField('date_received', input.date_received);
        setField('date_forwarded_dass', input.date_forwarded_dass);
        setField('date_paid', input.date_paid);
        setField('amount', input.amount);
        setField('period', input.period?.trim());
        setField('description', input.description);
        setField('utility_type', input.utility_type);
        setField('requisition_number', input.requisition_number);

        if (fields.length === 0) {
            return request;
        }

        fields.push(`updated_at = now()`);
        values.push(itemId);

        await pool.query(
            `UPDATE judge_utility_items SET ${fields.join(', ')} WHERE id = $${paramCount}`,
            values
        );

        const updated = await this.findUtilityById(requestId);
        if (!updated) throw new AppError(500, 'Failed to update utility item');
        return updated;
    }

    static async deleteUtilityItem(requestId: string, itemId: string): Promise<void> {
        const { rows } = await pool.query(
            `UPDATE judge_utility_items
             SET is_active = false
             WHERE id = $1 AND request_id = $2
             RETURNING id`,
            [itemId, requestId]
        );
        if (rows.length === 0) {
            throw new AppError(404, 'Utility item not found');
        }
    }

    static async deleteUtility(id: string): Promise<void> {
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            const { rows } = await client.query(
                `UPDATE judge_utility_requests SET is_active = false WHERE id = $1 RETURNING id`,
                [id]
            );
            if (rows.length === 0) {
                throw new AppError(404, 'Judge utility record not found');
            }

            await client.query(
                `UPDATE judge_utility_items SET is_active = false WHERE request_id = $1`,
                [id]
            );

            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    // ============================================================
    // CLUB MEMBERSHIP
    // ============================================================

    static async findAllClubMemberships(filters: HelpDeskFilters = {}): Promise<ClubMembership[]> {
        let query = `SELECT ${CLUB_SELECT} FROM club_memberships WHERE is_active = true`;
        const params: unknown[] = [];
        let paramCount = 1;

        if (filters.search) {
            query += ` AND (judge_name ILIKE $${paramCount} OR club_name ILIKE $${paramCount} OR pj_no ILIKE $${paramCount})`;
            params.push(`%${filters.search}%`);
            paramCount++;
        }
        if (filters.status) {
            query += ` AND status = $${paramCount}`;
            params.push(filters.status);
            paramCount++;
        }
        if (filters.judge_name) {
            query += ` AND judge_name ILIKE $${paramCount}`;
            params.push(`%${filters.judge_name}%`);
            paramCount++;
        }

        query += ` ORDER BY created_at DESC`;
        if (filters.limit) {
            query += ` LIMIT $${paramCount}`;
            params.push(filters.limit);
            paramCount++;
        }
        if (filters.offset) {
            query += ` OFFSET $${paramCount}`;
            params.push(filters.offset);
        }

        const { rows } = await pool.query(query, params);
        return rows;
    }

    static async findClubMembershipById(id: string): Promise<ClubMembership | null> {
        const { rows } = await pool.query(
            `SELECT ${CLUB_SELECT} FROM club_memberships WHERE id = $1 AND is_active = true`,
            [id]
        );
        return rows[0] || null;
    }

    static async createClubMembership(
        input: CreateClubMembershipInput,
        userId: string
    ): Promise<ClubMembership> {
        const { rows } = await pool.query(
            `INSERT INTO club_memberships (
                pj_no, judge_name, club_name, entry_fee, annual_fee,
                date_submitted_dass, court, payment_date, remarks, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id`,
            [
                input.pj_no || null,
                input.judge_name.trim(),
                input.club_name.trim(),
                input.entry_fee || null,
                input.annual_fee || null,
                input.date_submitted_dass || null,
                input.court || null,
                input.payment_date || null,
                input.remarks || null,
                userId,
            ]
        );

        const membership = await this.findClubMembershipById(rows[0].id);
        if (!membership) throw new AppError(500, 'Failed to create club membership');
        return membership;
    }

    static async updateClubMembershipStatus(
        id: string,
        input: UpdateStatusInput
    ): Promise<ClubMembership> {
        const existing = await this.findClubMembershipById(id);
        if (!existing) {
            throw new AppError(404, 'Club membership not found');
        }

        await pool.query(
            `UPDATE club_memberships SET status = $1 WHERE id = $2`,
            [input.status, id]
        );

        const updated = await this.findClubMembershipById(id);
        if (!updated) throw new AppError(500, 'Failed to update membership status');
        return updated;
    }

    static async deleteClubMembership(id: string): Promise<void> {
        const { rows } = await pool.query(
            `UPDATE club_memberships SET is_active = false WHERE id = $1 RETURNING id`,
            [id]
        );
        if (rows.length === 0) {
            throw new AppError(404, 'Club membership not found');
        }
    }

    // ============================================================
    // DSA HELPER: UPSERT DSA DETAILS
    // ============================================================

    /**
     * Upsert DSA details for a parent entity.
     * Soft deletes existing records and inserts new ones.
     * Also stores parent_type to ensure data integrity.
     */
    private static async upsertDSADetails(
        client: any,
        table: string,
        foreignKey: string,
        parentId: string,
        details: DSADetailInput[],
        parentType: string
    ): Promise<void> {
        // Soft delete existing
        await client.query(
            `UPDATE ${table} SET is_active = false WHERE ${foreignKey} = $1`,
            [parentId]
        );

        if (details && details.length > 0) {
            for (const detail of details) {
                const total = detail.dsa_per_day * detail.days;
                await client.query(
                    `INSERT INTO ${table} (
                        ${foreignKey}, judge_name, pj_number, designation, dsa_per_day, days, total, notes,
                        date_of_request, date_of_ticket_facilitation, date_of_conference_facilitation,
                        travel_date, travel_back, requisition_number, requisition_initiation_date, payment_status,
                        parent_type
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
                    [
                        parentId,
                        detail.judge_name.trim(),
                        detail.pj_number.trim(),
                        detail.designation || null,
                        detail.dsa_per_day,
                        detail.days,
                        total,
                        detail.notes || null,
                        detail.date_of_request || null,
                        detail.date_of_ticket_facilitation || null,
                        detail.date_of_conference_facilitation || null,
                        detail.travel_date || null,
                        detail.travel_back || null,
                        detail.requisition_number || null,
                        detail.requisition_initiation_date || null,
                        detail.payment_status || 'Pending',
                        parentType,
                    ]
                );
            }
        }
    }

    /**
     * Upsert DSA details using the configuration for a specific entity type.
     */
    private static async upsertDSADetailsByType(
        client: any,
        entityType: keyof typeof DSA_TABLE_CONFIG,
        parentId: string,
        details: DSADetailInput[]
    ): Promise<void> {
        const config = DSA_TABLE_CONFIG[entityType];
        if (!config) {
            throw new AppError(400, `Unknown entity type: ${entityType}`);
        }
        return this.upsertDSADetails(
            client,
            config.table,
            config.foreignKey,
            parentId,
            details,
            config.parentType
        );
    }

    // ============================================================
    // CIRCUITS
    // ============================================================

    static async findAllCircuits(filters: HelpDeskFilters = {}): Promise<Circuit[]> {
        let query = `SELECT ${CIRCUIT_SELECT} FROM circuits WHERE is_active = true`;
        const params: unknown[] = [];
        let paramCount = 1;

        if (filters.search) {
            query += ` AND name ILIKE $${paramCount}`;
            params.push(`%${filters.search}%`);
            paramCount++;
        }
        if (filters.status) {
            query += ` AND status = $${paramCount}`;
            params.push(filters.status);
            paramCount++;
        }

        query += ` ORDER BY created_at DESC`;
        if (filters.limit) {
            query += ` LIMIT $${paramCount}`;
            params.push(filters.limit);
            paramCount++;
        }
        if (filters.offset) {
            query += ` OFFSET $${paramCount}`;
            params.push(filters.offset);
        }

        const { rows } = await pool.query(query, params);

        for (const circuit of rows) {
            circuit.dsa_details = await this.getDSADetails(
                'circuit_dsa_details', 
                'circuit_id', 
                circuit.id,
                'circuit'
            );
            if (circuit.dsa_details.length > 0) {
                circuit.total_dsa = circuit.dsa_details.reduce((sum: number, detail: any) => sum + Number(detail.total), 0);
            } else {
                circuit.total_dsa = 0;
            }
        }

        return rows;
    }

    static async findCircuitById(id: string): Promise<Circuit | null> {
        const { rows } = await pool.query(
            `SELECT ${CIRCUIT_SELECT} FROM circuits WHERE id = $1 AND is_active = true`,
            [id]
        );

        if (rows.length === 0) return null;

        const circuit = rows[0];
        circuit.dsa_details = await this.getDSADetails(
            'circuit_dsa_details', 
            'circuit_id', 
            id,
            'circuit'
        );
        circuit.total_dsa = circuit.dsa_details.reduce((sum: number, detail: any) => sum + Number(detail.total), 0);

        return circuit;
    }

    static async createCircuit(
        input: CreateCircuitInput,
        userId: string
    ): Promise<Circuit> {
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');

            const { rows } = await client.query(
                `INSERT INTO circuits (
                    name, location, start_date, end_date, created_by
                ) VALUES ($1, $2, $3, $4, $5)
                RETURNING id`,
                [
                    input.name.trim(),
                    input.location || null,
                    input.start_date,
                    input.end_date,
                    userId,
                ]
            );

            const circuitId = rows[0].id;

            if (input.dsa_details && input.dsa_details.length > 0) {
                await this.upsertDSADetails(
                    client,
                    'circuit_dsa_details',
                    'circuit_id',
                    circuitId,
                    input.dsa_details,
                    'circuit'
                );
            }

            await client.query('COMMIT');

            const circuit = await this.findCircuitById(circuitId);
            if (!circuit) throw new AppError(500, 'Failed to create circuit');
            return circuit;
            
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    static async updateCircuitStatus(
        id: string,
        input: UpdateStatusInput
    ): Promise<Circuit> {
        const existing = await this.findCircuitById(id);
        if (!existing) {
            throw new AppError(404, 'Circuit not found');
        }

        await pool.query(
            `UPDATE circuits SET status = $1 WHERE id = $2`,
            [input.status, id]
        );

        const updated = await this.findCircuitById(id);
        if (!updated) throw new AppError(500, 'Failed to update circuit status');
        return updated;
    }

    static async updateCircuitDSADetails(
        circuitId: string,
        dsaDetails: DSADetailInput[]
    ): Promise<Circuit> {
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');

            const circuit = await this.findCircuitById(circuitId);
            if (!circuit) {
                throw new AppError(404, 'Circuit not found');
            }

            await this.upsertDSADetails(
                client,
                'circuit_dsa_details',
                'circuit_id',
                circuitId,
                dsaDetails,
                'circuit'
            );

            await client.query('COMMIT');

            const updatedCircuit = await this.findCircuitById(circuitId);
            if (!updatedCircuit) throw new AppError(500, 'Failed to update circuit DSA details');
            return updatedCircuit;
            
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    static async deleteCircuit(id: string): Promise<void> {
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');

            const { rows } = await client.query(
                `UPDATE circuits SET is_active = false WHERE id = $1 RETURNING id`,
                [id]
            );
            
            if (rows.length === 0) {
                throw new AppError(404, 'Circuit not found');
            }

            await client.query(
                `UPDATE circuit_dsa_details SET is_active = false WHERE circuit_id = $1`,
                [id]
            );

            await client.query('COMMIT');
            
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    // ============================================================
    // SPECIAL BENCHES
    // ============================================================

    static async findAllBenches(filters: HelpDeskFilters = {}): Promise<SpecialBench[]> {
        let query = `SELECT ${BENCH_SELECT} FROM special_benches WHERE is_active = true`;
        const params: unknown[] = [];
        let paramCount = 1;

        if (filters.search) {
            query += ` AND (name ILIKE $${paramCount} OR case_reference ILIKE $${paramCount})`;
            params.push(`%${filters.search}%`);
            paramCount++;
        }
        if (filters.status) {
            query += ` AND status = $${paramCount}`;
            params.push(filters.status);
            paramCount++;
        }

        query += ` ORDER BY created_at DESC`;
        if (filters.limit) {
            query += ` LIMIT $${paramCount}`;
            params.push(filters.limit);
            paramCount++;
        }
        if (filters.offset) {
            query += ` OFFSET $${paramCount}`;
            params.push(filters.offset);
        }

        const { rows } = await pool.query(query, params);

        for (const bench of rows) {
            bench.dsa_details = await this.getDSADetails(
                'special_bench_dsa_details', 
                'bench_id', 
                bench.id,
                'special_bench'
            );
            bench.total_dsa = bench.dsa_details.reduce((sum: number, detail: any) => sum + Number(detail.total), 0);
        }

        return rows;
    }

    static async findBenchById(id: string): Promise<SpecialBench | null> {
        const { rows } = await pool.query(
            `SELECT ${BENCH_SELECT} FROM special_benches WHERE id = $1 AND is_active = true`,
            [id]
        );

        if (rows.length === 0) return null;

        const bench = rows[0];
        bench.dsa_details = await this.getDSADetails(
            'special_bench_dsa_details', 
            'bench_id', 
            id,
            'special_bench'
        );
        bench.total_dsa = bench.dsa_details.reduce((sum: number, detail: any) => sum + Number(detail.total), 0);

        return bench;
    }

    static async createSpecialBench(
        input: CreateSpecialBenchInput,
        userId: string
    ): Promise<SpecialBench> {
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');

            const { rows } = await client.query(
                `INSERT INTO special_benches (
                    name, case_reference, start_date, end_date, created_by
                ) VALUES ($1, $2, $3, $4, $5)
                RETURNING id`,
                [
                    input.name.trim(),
                    input.case_reference || null,
                    input.start_date,
                    input.end_date,
                    userId,
                ]
            );

            const benchId = rows[0].id;

            if (input.dsa_details && input.dsa_details.length > 0) {
                await this.upsertDSADetails(
                    client,
                    'special_bench_dsa_details',
                    'bench_id',
                    benchId,
                    input.dsa_details,
                    'special_bench'
                );
            }

            await client.query('COMMIT');

            const bench = await this.findBenchById(benchId);
            if (!bench) throw new AppError(500, 'Failed to create special bench');
            return bench;
            
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    static async updateBench(
        id: string,
        input: UpdateBenchInput
    ): Promise<SpecialBench> {
        const existing = await this.findBenchById(id);
        if (!existing) {
            throw new AppError(404, 'Special bench not found');
        }

        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');

            const fields: string[] = [];
            const values: unknown[] = [];
            let paramCount = 1;

            const setField = (column: string, value: unknown) => {
                if (value !== undefined) {
                    fields.push(`${column} = $${paramCount}`);
                    values.push(value);
                    paramCount++;
                }
            };

            setField('name', input.name?.trim());
            setField('case_reference', input.case_reference);
            setField('start_date', input.start_date);
            setField('end_date', input.end_date);
            setField('status', input.status);

            if (fields.length > 0) {
                fields.push(`updated_at = now()`);
                values.push(id);

                await client.query(
                    `UPDATE special_benches SET ${fields.join(', ')} WHERE id = $${paramCount}`,
                    values
                );
            }

            // Update DSA details if provided
            if (input.dsa_details !== undefined) {
                await this.upsertDSADetails(
                    client,
                    'special_bench_dsa_details',
                    'bench_id',
                    id,
                    input.dsa_details,
                    'special_bench'
                );
            }

            await client.query('COMMIT');

            const updated = await this.findBenchById(id);
            if (!updated) throw new AppError(500, 'Failed to update special bench');
            return updated;
            
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    static async updateBenchStatus(
        id: string,
        input: UpdateStatusInput
    ): Promise<SpecialBench> {
        const existing = await this.findBenchById(id);
        if (!existing) {
            throw new AppError(404, 'Special bench not found');
        }

        await pool.query(
            `UPDATE special_benches SET status = $1, updated_at = now() WHERE id = $2`,
            [input.status, id]
        );

        const updated = await this.findBenchById(id);
        if (!updated) throw new AppError(500, 'Failed to update bench status');
        return updated;
    }

    static async deleteBench(id: string): Promise<void> {
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');

            const { rows } = await client.query(
                `UPDATE special_benches SET is_active = false WHERE id = $1 RETURNING id`,
                [id]
            );
            
            if (rows.length === 0) {
                throw new AppError(404, 'Special bench not found');
            }

            await client.query(
                `UPDATE special_bench_dsa_details SET is_active = false WHERE bench_id = $1`,
                [id]
            );

            await client.query('COMMIT');
            
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    // ============================================================
    // PART-HEARDS
    // ============================================================

    static async findAllPartHeards(filters: HelpDeskFilters = {}): Promise<PartHeard[]> {
        let query = `SELECT ${PART_HEARD_SELECT} FROM part_heards WHERE is_active = true`;
        const params: unknown[] = [];
        let paramCount = 1;

        if (filters.search) {
            query += ` AND case_reference ILIKE $${paramCount}`;
            params.push(`%${filters.search}%`);
            paramCount++;
        }
        if (filters.status) {
            query += ` AND status = $${paramCount}`;
            params.push(filters.status);
            paramCount++;
        }

        query += ` ORDER BY created_at DESC`;
        if (filters.limit) {
            query += ` LIMIT $${paramCount}`;
            params.push(filters.limit);
            paramCount++;
        }
        if (filters.offset) {
            query += ` OFFSET $${paramCount}`;
            params.push(filters.offset);
        }

        const { rows } = await pool.query(query, params);

        for (const ph of rows) {
            ph.dsa_details = await this.getDSADetails(
                'part_heard_dsa_details', 
                'part_heard_id', 
                ph.id,
                'part_heard'
            );
            ph.total_dsa = ph.dsa_details.reduce((sum: number, detail: any) => sum + Number(detail.total), 0);
        }

        return rows;
    }

    static async findPartHeardById(id: string): Promise<PartHeard | null> {
        const { rows } = await pool.query(
            `SELECT ${PART_HEARD_SELECT} FROM part_heards WHERE id = $1 AND is_active = true`,
            [id]
        );

        if (rows.length === 0) return null;

        const ph = rows[0];
        ph.dsa_details = await this.getDSADetails(
            'part_heard_dsa_details', 
            'part_heard_id', 
            id,
            'part_heard'
        );
        ph.total_dsa = ph.dsa_details.reduce((sum: number, detail: any) => sum + Number(detail.total), 0);

        return ph;
    }

    static async createPartHeard(
        input: CreatePartHeardInput,
        userId: string
    ): Promise<PartHeard> {
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');

            const { rows } = await client.query(
                `INSERT INTO part_heards (
                    case_reference, approved_by, start_date, end_date, created_by
                ) VALUES ($1, $2, $3, $4, $5)
                RETURNING id`,
                [
                    input.case_reference.trim(),
                    input.approved_by || null,
                    input.start_date,
                    input.end_date,
                    userId,
                ]
            );

            const phId = rows[0].id;

            if (input.dsa_details && input.dsa_details.length > 0) {
                await this.upsertDSADetails(
                    client,
                    'part_heard_dsa_details',
                    'part_heard_id',
                    phId,
                    input.dsa_details,
                    'part_heard'
                );
            }

            await client.query('COMMIT');

            const partHeard = await this.findPartHeardById(phId);
            if (!partHeard) throw new AppError(500, 'Failed to create part-heard');
            return partHeard;
            
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    static async updatePartHeard(
        id: string,
        input: UpdatePartHeardInput
    ): Promise<PartHeard> {
        const existing = await this.findPartHeardById(id);
        if (!existing) {
            throw new AppError(404, 'Part-heard not found');
        }

        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');

            const fields: string[] = [];
            const values: unknown[] = [];
            let paramCount = 1;

            const setField = (column: string, value: unknown) => {
                if (value !== undefined) {
                    fields.push(`${column} = $${paramCount}`);
                    values.push(value);
                    paramCount++;
                }
            };

            setField('case_reference', input.case_reference?.trim());
            setField('approved_by', input.approved_by);
            setField('start_date', input.start_date);
            setField('end_date', input.end_date);
            setField('status', input.status);

            if (fields.length > 0) {
                fields.push(`updated_at = now()`);
                values.push(id);

                await client.query(
                    `UPDATE part_heards SET ${fields.join(', ')} WHERE id = $${paramCount}`,
                    values
                );
            }

            // Update DSA details if provided
            if (input.dsa_details !== undefined) {
                await this.upsertDSADetails(
                    client,
                    'part_heard_dsa_details',
                    'part_heard_id',
                    id,
                    input.dsa_details,
                    'part_heard'
                );
            }

            await client.query('COMMIT');

            const updated = await this.findPartHeardById(id);
            if (!updated) throw new AppError(500, 'Failed to update part-heard');
            return updated;
            
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    static async updatePartHeardStatus(
        id: string,
        input: UpdateStatusInput
    ): Promise<PartHeard> {
        const existing = await this.findPartHeardById(id);
        if (!existing) {
            throw new AppError(404, 'Part-heard not found');
        }

        await pool.query(
            `UPDATE part_heards SET status = $1, updated_at = now() WHERE id = $2`,
            [input.status, id]
        );

        const updated = await this.findPartHeardById(id);
        if (!updated) throw new AppError(500, 'Failed to update part-heard status');
        return updated;
    }

    static async deletePartHeard(id: string): Promise<void> {
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');

            const { rows } = await client.query(
                `UPDATE part_heards SET is_active = false WHERE id = $1 RETURNING id`,
                [id]
            );
            
            if (rows.length === 0) {
                throw new AppError(404, 'Part-heard not found');
            }

            await client.query(
                `UPDATE part_heard_dsa_details SET is_active = false WHERE part_heard_id = $1`,
                [id]
            );

            await client.query('COMMIT');
            
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    // ============================================================
    // SERVICE WEEKS
    // ============================================================

    static async findAllServiceWeeks(filters: HelpDeskFilters = {}): Promise<ServiceWeek[]> {
        let query = `SELECT ${SERVICE_WEEK_SELECT} FROM service_weeks WHERE is_active = true`;
        const params: unknown[] = [];
        let paramCount = 1;

        if (filters.search) {
            query += ` AND (name ILIKE $${paramCount} OR week_number ILIKE $${paramCount})`;
            params.push(`%${filters.search}%`);
            paramCount++;
        }
        if (filters.status) {
            query += ` AND status = $${paramCount}`;
            params.push(filters.status);
            paramCount++;
        }

        query += ` ORDER BY created_at DESC`;
        if (filters.limit) {
            query += ` LIMIT $${paramCount}`;
            params.push(filters.limit);
            paramCount++;
        }
        if (filters.offset) {
            query += ` OFFSET $${paramCount}`;
            params.push(filters.offset);
        }

        const { rows } = await pool.query(query, params);

        for (const week of rows) {
            week.dsa_details = await this.getDSADetails(
                'service_week_dsa_details', 
                'service_week_id', 
                week.id,
                'service_week'
            );
            week.total_dsa = week.dsa_details.reduce((sum: number, detail: any) => sum + Number(detail.total), 0);
        }

        return rows;
    }

    static async findServiceWeekById(id: string): Promise<ServiceWeek | null> {
        const { rows } = await pool.query(
            `SELECT ${SERVICE_WEEK_SELECT} FROM service_weeks WHERE id = $1 AND is_active = true`,
            [id]
        );

        if (rows.length === 0) return null;

        const week = rows[0];
        week.dsa_details = await this.getDSADetails(
            'service_week_dsa_details', 
            'service_week_id', 
            id,
            'service_week'
        );
        week.total_dsa = week.dsa_details.reduce((sum: number, detail: any) => sum + Number(detail.total), 0);

        return week;
    }

    static async createServiceWeek(
        input: CreateServiceWeekInput,
        userId: string
    ): Promise<ServiceWeek> {
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');

            const { rows } = await client.query(
                `INSERT INTO service_weeks (
                    name, week_number, year, start_date, end_date, created_by
                ) VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING id`,
                [
                    input.name.trim(),
                    input.week_number.trim(),
                    input.year,
                    input.start_date,
                    input.end_date,
                    userId,
                ]
            );

            const weekId = rows[0].id;

            if (input.dsa_details && input.dsa_details.length > 0) {
                await this.upsertDSADetails(
                    client,
                    'service_week_dsa_details',
                    'service_week_id',
                    weekId,
                    input.dsa_details,
                    'service_week'
                );
            }

            await client.query('COMMIT');

            const week = await this.findServiceWeekById(weekId);
            if (!week) throw new AppError(500, 'Failed to create service week');
            return week;
            
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    static async updateServiceWeekStatus(
        id: string,
        input: UpdateStatusInput
    ): Promise<ServiceWeek> {
        const existing = await this.findServiceWeekById(id);
        if (!existing) {
            throw new AppError(404, 'Service week not found');
        }

        await pool.query(
            `UPDATE service_weeks SET status = $1 WHERE id = $2`,
            [input.status, id]
        );

        const updated = await this.findServiceWeekById(id);
        if (!updated) throw new AppError(500, 'Failed to update service week status');
        return updated;
    }

    static async deleteServiceWeek(id: string): Promise<void> {
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');

            const { rows } = await client.query(
                `UPDATE service_weeks SET is_active = false WHERE id = $1 RETURNING id`,
                [id]
            );
            
            if (rows.length === 0) {
                throw new AppError(404, 'Service week not found');
            }

            await client.query(
                `UPDATE service_week_dsa_details SET is_active = false WHERE service_week_id = $1`,
                [id]
            );

            await client.query('COMMIT');
            
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    // ============================================================
    // MEDICAL EXPENSE CLAIMS
    // ============================================================

    static async findAllMedicalClaims(filters: HelpDeskFilters = {}): Promise<MedicalClaim[]> {
        let query = `SELECT ${MEDICAL_CLAIM_SELECT} FROM medical_claims WHERE is_active = true`;
        const params: unknown[] = [];
        let paramCount = 1;

        if (filters.search) {
            query += ` AND officer_name ILIKE $${paramCount}`;
            params.push(`%${filters.search}%`);
            paramCount++;
        }
        if (filters.status) {
            query += ` AND status = $${paramCount}`;
            params.push(filters.status);
            paramCount++;
        }

        query += ` ORDER BY created_at DESC`;
        if (filters.limit) {
            query += ` LIMIT $${paramCount}`;
            params.push(filters.limit);
            paramCount++;
        }
        if (filters.offset) {
            query += ` OFFSET $${paramCount}`;
            params.push(filters.offset);
        }

        const { rows } = await pool.query(query, params);
        return rows;
    }

    static async findMedicalClaimById(id: string): Promise<MedicalClaim | null> {
        const { rows } = await pool.query(
            `SELECT ${MEDICAL_CLAIM_SELECT} FROM medical_claims WHERE id = $1 AND is_active = true`,
            [id]
        );
        return rows[0] || null;
    }

    static async createMedicalClaim(
        input: CreateMedicalClaimInput,
        userId: string
    ): Promise<MedicalClaim> {
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            const s_no = await generateSerialNumber(client, 'medical_claims');

            const { rows } = await client.query(
                `INSERT INTO medical_claims (
                    s_no, officer_name, claim_amount, date_forwarded_dhr, status, remarks, created_by
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING id`,
                [
                    s_no,
                    input.officer_name.trim(),
                    input.claim_amount,
                    input.date_forwarded_dhr || null,
                    input.status || 'Pending',
                    input.remarks || null,
                    userId,
                ]
            );

            await client.query('COMMIT');

            const claim = await this.findMedicalClaimById(rows[0].id);
            if (!claim) throw new AppError(500, 'Failed to create medical claim');
            return claim;

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    static async updateMedicalClaimStatus(
        id: string,
        input: { status: string; remarks?: string }
    ): Promise<MedicalClaim> {
        const existing = await this.findMedicalClaimById(id);
        if (!existing) {
            throw new AppError(404, 'Medical claim not found');
        }

        await pool.query(
            `UPDATE medical_claims 
             SET status = $1, remarks = COALESCE($2, remarks)
             WHERE id = $3`,
            [input.status, input.remarks || null, id]
        );

        const updated = await this.findMedicalClaimById(id);
        if (!updated) throw new AppError(500, 'Failed to update medical claim status');
        return updated;
    }

    static async deleteMedicalClaim(id: string): Promise<void> {
        const { rows } = await pool.query(
            `UPDATE medical_claims SET is_active = false WHERE id = $1 RETURNING id`,
            [id]
        );
        if (rows.length === 0) {
            throw new AppError(404, 'Medical claim not found');
        }
    }

    // ============================================================
    // VISA SUPPORT
    // ============================================================

    static async findAllVisaRequests(filters: HelpDeskFilters = {}): Promise<VisaRequest[]> {
        let query = `SELECT ${VISA_SELECT} FROM visa_requests WHERE is_active = true`;
        const params: unknown[] = [];
        let paramCount = 1;

        if (filters.search) {
            query += ` AND (judge_name ILIKE $${paramCount} OR destination_country ILIKE $${paramCount})`;
            params.push(`%${filters.search}%`);
            paramCount++;
        }
        if (filters.status) {
            query += ` AND status = $${paramCount}`;
            params.push(filters.status);
            paramCount++;
        }
        if (filters.judge_name) {
            query += ` AND judge_name ILIKE $${paramCount}`;
            params.push(`%${filters.judge_name}%`);
            paramCount++;
        }

        query += ` ORDER BY created_at DESC`;
        if (filters.limit) {
            query += ` LIMIT $${paramCount}`;
            params.push(filters.limit);
            paramCount++;
        }
        if (filters.offset) {
            query += ` OFFSET $${paramCount}`;
            params.push(filters.offset);
        }

        const { rows } = await pool.query(query, params);

        for (const visa of rows) {
            const { rows: docRows } = await pool.query(
                `SELECT ${VISA_DOCUMENT_SELECT} FROM visa_documents WHERE visa_request_id = $1 AND is_active = true`,
                [visa.id]
            );
            visa.documents = docRows;
        }

        return rows;
    }

    static async findVisaRequestById(id: string): Promise<VisaRequest | null> {
        const { rows } = await pool.query(
            `SELECT ${VISA_SELECT} FROM visa_requests WHERE id = $1 AND is_active = true`,
            [id]
        );

        if (rows.length === 0) return null;

        const visa = rows[0];
        const { rows: docRows } = await pool.query(
            `SELECT ${VISA_DOCUMENT_SELECT} FROM visa_documents WHERE visa_request_id = $1 AND is_active = true`,
            [id]
        );
        visa.documents = docRows;

        return visa;
    }

    static async createVisaRequest(
        input: CreateVisaRequestInput,
        userId: string
    ): Promise<VisaRequest> {
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            const s_no = await generateSerialNumber(client, 'visa_requests');

            const { rows } = await client.query(
                `INSERT INTO visa_requests (
                    s_no, judge_name, request_date, destination_country, date_of_travel, date_of_return,
                    visa_type, purpose_of_travel, remarks, notes, created_by
                ) VALUES ($1, $2, CURRENT_DATE, $3, $4, $5, $6, $7, $8, $9, $10)
                RETURNING id`,
                [
                    s_no,
                    input.judge_name.trim(),
                    input.destination_country.trim(),
                    input.date_of_travel || null,
                    input.date_of_return || null,
                    input.visa_type,
                    input.purpose_of_travel || null,
                    input.remarks || null,
                    input.notes || null,
                    userId,
                ]
            );

            await client.query('COMMIT');

            const visa = await this.findVisaRequestById(rows[0].id);
            if (!visa) throw new AppError(500, 'Failed to create visa request');
            return visa;

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    static async updateVisaStatus(
        id: string,
        input: UpdateStatusInput
    ): Promise<VisaRequest> {
        const existing = await this.findVisaRequestById(id);
        if (!existing) {
            throw new AppError(404, 'Visa request not found');
        }

        await pool.query(
            `UPDATE visa_requests SET status = $1, notes = COALESCE($2, notes)
             WHERE id = $3 AND is_active = true`,
            [input.status, input.notes || null, id]
        );

        const updated = await this.findVisaRequestById(id);
        if (!updated) throw new AppError(500, 'Failed to update visa status');
        return updated;
    }

    static async deleteVisaRequest(id: string): Promise<void> {
        const { rows } = await pool.query(
            `UPDATE visa_requests SET is_active = false WHERE id = $1 RETURNING id`,
            [id]
        );
        if (rows.length === 0) {
            throw new AppError(404, 'Visa request not found');
        }
    }

    // ─── Visa Document Tracking ──────────────────────────────────────────────

    static async markDocumentViewed(
        documentId: string,
        userId: string,
        userName: string,
        ipAddress?: string,
        userAgent?: string
    ): Promise<void> {
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');

            const { rows } = await client.query(
                `UPDATE visa_documents 
                 SET view_count = COALESCE(view_count, 0) + 1,
                     viewed_at = COALESCE(viewed_at, NOW())
                 WHERE id = $1 AND is_active = true
                 RETURNING id, visa_request_id, view_count`,
                [documentId]
            );

            if (rows.length === 0) {
                throw new AppError(404, 'Document not found');
            }

            await client.query(
                `INSERT INTO document_views (
                    document_id, document_type, viewer_id, viewer_name, 
                    viewed_at, ip_address, user_agent
                ) VALUES ($1, $2, $3, $4, NOW(), $5, $6)`,
                [
                    documentId,
                    'visa_document',
                    userId,
                    userName,
                    ipAddress || null,
                    userAgent || null,
                ]
            );

            await client.query('COMMIT');
            
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    static async getDocumentViewStatus(
        documentId: string,
        includeViewers: boolean = false
    ): Promise<any> {
        const { rows: docRows } = await pool.query(
            `SELECT id, document_name, document_url, viewed_at, view_count, created_at
             FROM visa_documents 
             WHERE id = $1 AND is_active = true`,
            [documentId]
        );

        if (docRows.length === 0) {
            throw new AppError(404, 'Document not found');
        }

        const document = docRows[0];

        if (includeViewers) {
            const { rows: viewerRows } = await pool.query(
                `SELECT id, viewer_id, viewer_name, viewed_at, ip_address, user_agent
                 FROM document_views 
                 WHERE document_id = $1
                 ORDER BY viewed_at DESC`,
                [documentId]
            );
            document.viewers = viewerRows;
        }

        return document;
    }

    // ============================================================
    // PROTOCOL SUPPORT
    // ============================================================

    static async findAllProtocolEvents(filters: HelpDeskFilters = {}): Promise<ProtocolEvent[]> {
        let query = `SELECT ${PROTOCOL_SELECT} FROM protocol_events WHERE is_active = true`;
        const params: unknown[] = [];
        let paramCount = 1;

        if (filters.search) {
            query += ` AND activity ILIKE $${paramCount}`;
            params.push(`%${filters.search}%`);
            paramCount++;
        }
        if (filters.status) {
            query += ` AND status = $${paramCount}`;
            params.push(filters.status);
            paramCount++;
        }

        query += ` ORDER BY created_at DESC`;
        if (filters.limit) {
            query += ` LIMIT $${paramCount}`;
            params.push(filters.limit);
            paramCount++;
        }
        if (filters.offset) {
            query += ` OFFSET $${paramCount}`;
            params.push(filters.offset);
        }

        const { rows } = await pool.query(query, params);

        for (const event of rows) {
            event.dsa_details = await this.getDSADetails(
                'protocol_dsa_details', 
                'protocol_event_id', 
                event.id,
                'protocol'
            );
            event.total_dsa = event.dsa_details.reduce((sum: number, detail: any) => sum + Number(detail.total), 0);
        }

        return rows;
    }

    static async findProtocolEventById(id: string): Promise<ProtocolEvent | null> {
        const { rows } = await pool.query(
            `SELECT ${PROTOCOL_SELECT} FROM protocol_events WHERE id = $1 AND is_active = true`,
            [id]
        );

        if (rows.length === 0) return null;

        const event = rows[0];
        event.dsa_details = await this.getDSADetails(
            'protocol_dsa_details', 
            'protocol_event_id', 
            id,
            'protocol'
        );
        event.total_dsa = event.dsa_details.reduce((sum: number, detail: any) => sum + Number(detail.total), 0);

        return event;
    }

    static async createProtocolEvent(
        input: CreateProtocolEventInput,
        userId: string
    ): Promise<ProtocolEvent> {
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');

            const s_no = await generateSerialNumber(client, 'protocol_events');

            const { rows } = await client.query(
                `INSERT INTO protocol_events (
                    s_no, activity, period_from, period_to, officers_assigned, remarks,
                    dsa_required, notes, created_by
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING id`,
                [
                    s_no,
                    input.activity.trim(),
                    input.period_from || null,
                    input.period_to || null,
                    input.officers_assigned || null,
                    input.remarks || null,
                    input.dsa_required || false,
                    input.notes || null,
                    userId,
                ]
            );

            const eventId = rows[0].id;

            if (input.dsa_details && input.dsa_details.length > 0) {
                await this.upsertDSADetails(
                    client,
                    'protocol_dsa_details',
                    'protocol_event_id',
                    eventId,
                    input.dsa_details,
                    'protocol'
                );
            }

            await client.query('COMMIT');

            const event = await this.findProtocolEventById(eventId);
            if (!event) throw new AppError(500, 'Failed to create protocol event');
            return event;
            
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    static async updateProtocolStatus(
        id: string,
        input: UpdateStatusInput
    ): Promise<ProtocolEvent> {
        const existing = await this.findProtocolEventById(id);
        if (!existing) {
            throw new AppError(404, 'Protocol event not found');
        }

        await pool.query(
            `UPDATE protocol_events SET status = $1, notes = COALESCE($2, notes)
             WHERE id = $3`,
            [input.status, input.notes || null, id]
        );

        const updated = await this.findProtocolEventById(id);
        if (!updated) throw new AppError(500, 'Failed to update protocol status');
        return updated;
    }

    static async deleteProtocolEvent(id: string): Promise<void> {
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');

            const { rows } = await client.query(
                `UPDATE protocol_events SET is_active = false WHERE id = $1 RETURNING id`,
                [id]
            );
            
            if (rows.length === 0) {
                throw new AppError(404, 'Protocol event not found');
            }

            await client.query(
                `UPDATE protocol_dsa_details SET is_active = false WHERE protocol_event_id = $1`,
                [id]
            );

            await client.query('COMMIT');
            
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    // ============================================================
    // OTHER PAYMENTS
    // ============================================================

    static async findAllOtherPayments(filters: HelpDeskFilters = {}): Promise<OtherPayment[]> {
        let query = `SELECT ${OTHER_PAYMENT_SELECT} FROM other_payments WHERE is_active = true`;
        const params: unknown[] = [];
        let paramCount = 1;

        if (filters.search) {
            query += ` AND name ILIKE $${paramCount}`;
            params.push(`%${filters.search}%`);
            paramCount++;
        }
        if (filters.status) {
            query += ` AND status = $${paramCount}`;
            params.push(filters.status);
            paramCount++;
        }

        query += ` ORDER BY created_at DESC`;
        if (filters.limit) {
            query += ` LIMIT $${paramCount}`;
            params.push(filters.limit);
            paramCount++;
        }
        if (filters.offset) {
            query += ` OFFSET $${paramCount}`;
            params.push(filters.offset);
        }

        const { rows } = await pool.query(query, params);

        for (const payment of rows) {
            payment.dsa_details = await this.getDSADetails(
                'other_payment_dsa_details', 
                'other_payment_id', 
                payment.id,
                'other_payment'
            );
            if (payment.dsa_details.length > 0) {
                payment.total_dsa = payment.dsa_details.reduce((sum: number, detail: any) => sum + Number(detail.total), 0);
            } else {
                payment.total_dsa = 0;
            }
        }

        return rows;
    }

    static async findOtherPaymentById(id: string): Promise<OtherPayment | null> {
        const { rows } = await pool.query(
            `SELECT ${OTHER_PAYMENT_SELECT} FROM other_payments WHERE id = $1 AND is_active = true`,
            [id]
        );

        if (rows.length === 0) return null;

        const payment = rows[0];
        payment.dsa_details = await this.getDSADetails(
            'other_payment_dsa_details', 
            'other_payment_id', 
            id,
            'other_payment'
        );
        payment.total_dsa = payment.dsa_details.reduce((sum: number, detail: any) => sum + Number(detail.total), 0);

        return payment;
    }

    static async createOtherPayment(
        input: CreateOtherPaymentInput,
        userId: string
    ): Promise<OtherPayment> {
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');

            const { rows } = await client.query(
                `INSERT INTO other_payments (
                    name, description, start_date, end_date, created_by
                ) VALUES ($1, $2, $3, $4, $5)
                RETURNING id`,
                [
                    input.name.trim(),
                    input.description || null,
                    input.start_date,
                    input.end_date,
                    userId,
                ]
            );

            const paymentId = rows[0].id;

            if (input.dsa_details && input.dsa_details.length > 0) {
                await this.upsertDSADetails(
                    client,
                    'other_payment_dsa_details',
                    'other_payment_id',
                    paymentId,
                    input.dsa_details,
                    'other_payment'
                );
            }

            await client.query('COMMIT');

            const payment = await this.findOtherPaymentById(paymentId);
            if (!payment) throw new AppError(500, 'Failed to create other payment');
            return payment;
            
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    static async updateOtherPaymentStatus(
        id: string,
        input: UpdateStatusInput
    ): Promise<OtherPayment> {
        const existing = await this.findOtherPaymentById(id);
        if (!existing) {
            throw new AppError(404, 'Other payment not found');
        }

        await pool.query(
            `UPDATE other_payments SET status = $1 WHERE id = $2`,
            [input.status, id]
        );

        const updated = await this.findOtherPaymentById(id);
        if (!updated) throw new AppError(500, 'Failed to update other payment status');
        return updated;
    }

    static async updateOtherPaymentDSADetails(
        paymentId: string,
        dsaDetails: DSADetailInput[]
    ): Promise<OtherPayment> {
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');

            const payment = await this.findOtherPaymentById(paymentId);
            if (!payment) {
                throw new AppError(404, 'Other payment not found');
            }

            await this.upsertDSADetails(
                client,
                'other_payment_dsa_details',
                'other_payment_id',
                paymentId,
                dsaDetails,
                'other_payment'
            );

            await client.query('COMMIT');

            const updatedPayment = await this.findOtherPaymentById(paymentId);
            if (!updatedPayment) throw new AppError(500, 'Failed to update other payment DSA details');
            return updatedPayment;
            
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    static async deleteOtherPayment(id: string): Promise<void> {
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');

            const { rows } = await client.query(
                `UPDATE other_payments SET is_active = false WHERE id = $1 RETURNING id`,
                [id]
            );
            
            if (rows.length === 0) {
                throw new AppError(404, 'Other payment not found');
            }

            await client.query(
                `UPDATE other_payment_dsa_details SET is_active = false WHERE other_payment_id = $1`,
                [id]
            );

            await client.query('COMMIT');
            
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    // ============================================================
    // DSA REPORT
    // ============================================================

    static async getDSAReport(filters: DSAReportFilters = {}): Promise<DSAReportRow[]> {
        const modules = filters.modules
            ? (filters.modules.filter((m) => m in REPORT_MODULE_CONFIG) as ReportModule[])
            : (Object.keys(REPORT_MODULE_CONFIG) as ReportModule[]);

        const allRows: DSAReportRow[] = [];

        for (const moduleKey of modules) {
            const { parentTable, dsaTable, fk, activityCol, parentType } = REPORT_MODULE_CONFIG[moduleKey];

            let query = `
                SELECT
                    '${moduleKey}' AS module,
                    p.id AS parent_id,
                    d.id AS dsa_detail_id,
                    p.${activityCol} AS activity,
                    p.status AS parent_status,
                    d.judge_name, d.pj_number, d.designation,
                    d.date_of_request, d.date_of_ticket_facilitation, d.date_of_conference_facilitation,
                    d.travel_date, d.travel_back,
                    d.dsa_per_day::float8 AS dsa_per_day, d.days, d.total::float8 AS total,
                    d.requisition_number, d.requisition_initiation_date, d.payment_status
                FROM ${dsaTable} d
                JOIN ${parentTable} p ON p.id = d.${fk}
                WHERE d.is_active = true AND p.is_active = true AND d.parent_type = $1
            `;
            const params: unknown[] = [parentType];
            let paramCount = 2;

            if (filters.judge_name) {
                query += ` AND d.judge_name ILIKE $${paramCount}`;
                params.push(`%${filters.judge_name}%`);
                paramCount++;
            }
            if (filters.payment_status) {
                query += ` AND d.payment_status = $${paramCount}`;
                params.push(filters.payment_status);
                paramCount++;
            }
            if (filters.travel_start) {
                query += ` AND d.travel_date >= $${paramCount}`;
                params.push(filters.travel_start);
                paramCount++;
            }
            if (filters.travel_end) {
                query += ` AND d.travel_date <= $${paramCount}`;
                params.push(filters.travel_end);
                paramCount++;
            }

            query += ` ORDER BY p.created_at DESC, d.created_at ASC`;

            const { rows } = await pool.query(query, params);
            allRows.push(...rows);
        }

        // Global pagination applied after merging
        if (filters.offset !== undefined && filters.offset > 0) {
            return allRows.slice(filters.offset, filters.limit ? filters.offset + filters.limit : undefined);
        }
        if (filters.limit !== undefined && filters.limit > 0) {
            return allRows.slice(0, filters.limit);
        }
        return allRows;
    }

} // end HelpDeskService