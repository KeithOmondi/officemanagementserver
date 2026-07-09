import { pool } from '../../config/db';
import { AppError } from '../../utils/response';
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
    UpdateStatusInput,
    HelpDeskFilters,
    DSADetailInput,
    ServiceWeek,
    CreateServiceWeekInput,
    OtherPayment,
    CreateOtherPaymentInput,
    UpdateBenchInput,
    UpdatePartHeardInput,
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
    id, s_no, judge_name, request, date_received, officer_assigned, status, remarks,
    created_by, created_at, updated_at
`;

const VISA_SELECT = `
    id, s_no, name, destination_country, date_of_travel, date_of_return,
    visa_type, purpose_of_travel, remarks, status, notes,
    created_by, created_at, updated_at
`;

const PROTOCOL_SELECT = `
    id, s_no, activity, period_from, period_to, officers_assigned, remarks,
    dsa_required, total_dsa, status, notes,
    created_by, created_at, updated_at
`;

const DSA_DETAIL_SELECT = `
    id, judge_name, pj_number, designation, dsa_per_day, days, total, notes
`;

const OTHER_PAYMENT_SELECT = `
    id, name, description, start_date, end_date, total_dsa, status,
    created_by, created_at, updated_at
`;

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

    private static async getDSADetails(table: string, foreignKey: string, id: string): Promise<any[]> {
        const { rows } = await pool.query(
            `SELECT ${DSA_DETAIL_SELECT} 
             FROM ${table} 
             WHERE ${foreignKey} = $1 AND is_active = true
             ORDER BY created_at ASC`,
            [id]
        );
        return rows;
    }

    // ─── Judge Utilities (one judge → many utility items) ────────────────────

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

    // ─── Club Membership ─────────────────────────────────────────────────────

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

    // ─── Circuits ────────────────────────────────────────────────────────────

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
            circuit.dsa_details = await this.getDSADetails('circuit_dsa_details', 'circuit_id', circuit.id);
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
        circuit.dsa_details = await this.getDSADetails('circuit_dsa_details', 'circuit_id', id);
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
                for (const detail of input.dsa_details) {
                    const total = detail.dsa_per_day * detail.days;
                    await client.query(
                        `INSERT INTO circuit_dsa_details (
                            circuit_id, judge_name, pj_number, designation, dsa_per_day, days, total, notes
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                        [
                            circuitId,
                            detail.judge_name.trim(),
                            detail.pj_number.trim(),
                            detail.designation || null,
                            detail.dsa_per_day,
                            detail.days,
                            total,
                            detail.notes || null,
                        ]
                    );
                }
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

            await client.query(
                `UPDATE circuit_dsa_details SET is_active = false WHERE circuit_id = $1`,
                [circuitId]
            );

            if (dsaDetails && dsaDetails.length > 0) {
                for (const detail of dsaDetails) {
                    const total = detail.dsa_per_day * detail.days;
                    await client.query(
                        `INSERT INTO circuit_dsa_details (
                            circuit_id, judge_name, pj_number, designation, dsa_per_day, days, total, notes
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                        [
                            circuitId,
                            detail.judge_name.trim(),
                            detail.pj_number.trim(),
                            detail.designation || null,
                            detail.dsa_per_day,
                            detail.days,
                            total,
                            detail.notes || null,
                        ]
                    );
                }
            }

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

    // ─── Special Benches ─────────────────────────────────────────────────────

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
            bench.dsa_details = await this.getDSADetails('special_bench_dsa_details', 'bench_id', bench.id);
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
        bench.dsa_details = await this.getDSADetails('special_bench_dsa_details', 'bench_id', id);
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
                for (const detail of input.dsa_details) {
                    const total = detail.dsa_per_day * detail.days;
                    await client.query(
                        `INSERT INTO special_bench_dsa_details (
                            bench_id, judge_name, pj_number, designation, dsa_per_day, days, total, notes
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                        [
                            benchId,
                            detail.judge_name.trim(),
                            detail.pj_number.trim(),
                            detail.designation || null,
                            detail.dsa_per_day,
                            detail.days,
                            total,
                            detail.notes || null,
                        ]
                    );
                }
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
                // Soft delete existing DSA details
                await client.query(
                    `UPDATE special_bench_dsa_details SET is_active = false WHERE bench_id = $1`,
                    [id]
                );

                // Insert new DSA details
                if (input.dsa_details.length > 0) {
                    for (const detail of input.dsa_details) {
                        const total = detail.dsa_per_day * detail.days;
                        await client.query(
                            `INSERT INTO special_bench_dsa_details (
                                bench_id, judge_name, pj_number, designation, dsa_per_day, days, total, notes
                            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                            [
                                id,
                                detail.judge_name.trim(),
                                detail.pj_number.trim(),
                                detail.designation || null,
                                detail.dsa_per_day,
                                detail.days,
                                total,
                                detail.notes || null,
                            ]
                        );
                    }
                }
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

    // ─── Part-Heards ─────────────────────────────────────────────────────────

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
            ph.dsa_details = await this.getDSADetails('part_heard_dsa_details', 'part_heard_id', ph.id);
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
        ph.dsa_details = await this.getDSADetails('part_heard_dsa_details', 'part_heard_id', id);
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
                for (const detail of input.dsa_details) {
                    const total = detail.dsa_per_day * detail.days;
                    await client.query(
                        `INSERT INTO part_heard_dsa_details (
                            part_heard_id, judge_name, pj_number, designation, dsa_per_day, days, total, notes
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                        [
                            phId,
                            detail.judge_name.trim(),
                            detail.pj_number.trim(),
                            detail.designation || null,
                            detail.dsa_per_day,
                            detail.days,
                            total,
                            detail.notes || null,
                        ]
                    );
                }
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
                // Soft delete existing DSA details
                await client.query(
                    `UPDATE part_heard_dsa_details SET is_active = false WHERE part_heard_id = $1`,
                    [id]
                );

                // Insert new DSA details
                if (input.dsa_details.length > 0) {
                    for (const detail of input.dsa_details) {
                        const total = detail.dsa_per_day * detail.days;
                        await client.query(
                            `INSERT INTO part_heard_dsa_details (
                                part_heard_id, judge_name, pj_number, designation, dsa_per_day, days, total, notes
                            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                            [
                                id,
                                detail.judge_name.trim(),
                                detail.pj_number.trim(),
                                detail.designation || null,
                                detail.dsa_per_day,
                                detail.days,
                                total,
                                detail.notes || null,
                            ]
                        );
                    }
                }
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

    // ─── Service Weeks ──────────────────────────────────────────────────────

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
            week.dsa_details = await this.getDSADetails('service_week_dsa_details', 'service_week_id', week.id);
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
        week.dsa_details = await this.getDSADetails('service_week_dsa_details', 'service_week_id', id);
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
                for (const detail of input.dsa_details) {
                    const total = detail.dsa_per_day * detail.days;
                    await client.query(
                        `INSERT INTO service_week_dsa_details (
                            service_week_id, judge_name, pj_number, designation, dsa_per_day, days, total, notes
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                        [
                            weekId,
                            detail.judge_name.trim(),
                            detail.pj_number.trim(),
                            detail.designation || null,
                            detail.dsa_per_day,
                            detail.days,
                            total,
                            detail.notes || null,
                        ]
                    );
                }
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

    // ─── Medical Expense Claims ──────────────────────────────────────────────

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
        const { rows } = await pool.query(
            `INSERT INTO medical_claims (
                s_no, officer_name, claim_amount, date_forwarded_dhr, status, remarks, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id`,
            [
                input.s_no || null,
                input.officer_name.trim(),
                input.claim_amount,
                input.date_forwarded_dhr || null,
                input.status || 'Pending',
                input.remarks || null,
                userId,
            ]
        );

        const claim = await this.findMedicalClaimById(rows[0].id);
        if (!claim) throw new AppError(500, 'Failed to create medical claim');
        return claim;
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

    // ─── General Requests ─────────────────────────────────────────────────────

    static async findAllGeneralRequests(filters: HelpDeskFilters = {}): Promise<GeneralRequest[]> {
        let query = `SELECT ${GENERAL_REQUEST_SELECT} FROM general_requests WHERE is_active = true`;
        const params: unknown[] = [];
        let paramCount = 1;

        if (filters.search) {
            query += ` AND (judge_name ILIKE $${paramCount} OR request ILIKE $${paramCount})`;
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

    static async findGeneralRequestById(id: string): Promise<GeneralRequest | null> {
        const { rows } = await pool.query(
            `SELECT ${GENERAL_REQUEST_SELECT} FROM general_requests WHERE id = $1 AND is_active = true`,
            [id]
        );
        return rows[0] || null;
    }

    static async createGeneralRequest(
        input: CreateGeneralRequestInput,
        userId: string
    ): Promise<GeneralRequest> {
        const { rows } = await pool.query(
            `INSERT INTO general_requests (
                s_no, judge_name, request, date_received, officer_assigned, status, remarks, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id`,
            [
                input.s_no || null,
                input.judge_name.trim(),
                input.request.trim(),
                input.date_received || null,
                input.officer_assigned || null,
                input.status || 'Pending',
                input.remarks || null,
                userId,
            ]
        );

        const request = await this.findGeneralRequestById(rows[0].id);
        if (!request) throw new AppError(500, 'Failed to create general request');
        return request;
    }

    static async updateGeneralRequestStatus(
        id: string,
        input: { status: string; remarks?: string }
    ): Promise<GeneralRequest> {
        const existing = await this.findGeneralRequestById(id);
        if (!existing) {
            throw new AppError(404, 'General request not found');
        }

        await pool.query(
            `UPDATE general_requests 
             SET status = $1, remarks = COALESCE($2, remarks)
             WHERE id = $3`,
            [input.status, input.remarks || null, id]
        );

        const updated = await this.findGeneralRequestById(id);
        if (!updated) throw new AppError(500, 'Failed to update general request status');
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

    // ─── Visa Support ────────────────────────────────────────────────────────

    static async findAllVisaRequests(filters: HelpDeskFilters = {}): Promise<VisaRequest[]> {
        let query = `SELECT ${VISA_SELECT} FROM visa_requests WHERE is_active = true`;
        const params: unknown[] = [];
        let paramCount = 1;

        if (filters.search) {
            query += ` AND (name ILIKE $${paramCount} OR destination_country ILIKE $${paramCount})`;
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

        for (const visa of rows) {
            const { rows: docRows } = await pool.query(
                `SELECT * FROM visa_documents WHERE visa_request_id = $1 AND is_active = true`,
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
            `SELECT * FROM visa_documents WHERE visa_request_id = $1 AND is_active = true`,
            [id]
        );
        visa.documents = docRows;

        return visa;
    }

    static async createVisaRequest(
        input: CreateVisaRequestInput,
        userId: string
    ): Promise<VisaRequest> {
        const { rows } = await pool.query(
            `INSERT INTO visa_requests (
                s_no, name, destination_country, date_of_travel, date_of_return,
                visa_type, purpose_of_travel, remarks, notes, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id`,
            [
                input.s_no || null,
                input.name.trim(),
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

        const visa = await this.findVisaRequestById(rows[0].id);
        if (!visa) throw new AppError(500, 'Failed to create visa request');
        return visa;
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
             WHERE id = $3`,
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

    // ─── Protocol Support ────────────────────────────────────────────────────

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
            event.dsa_details = await this.getDSADetails('protocol_dsa_details', 'protocol_event_id', event.id);
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
        event.dsa_details = await this.getDSADetails('protocol_dsa_details', 'protocol_event_id', id);
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

            const { rows } = await client.query(
                `INSERT INTO protocol_events (
                    s_no, activity, period_from, period_to, officers_assigned, remarks,
                    dsa_required, notes, created_by
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING id`,
                [
                    input.s_no || null,
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
                for (const detail of input.dsa_details) {
                    const total = detail.dsa_per_day * detail.days;
                    await client.query(
                        `INSERT INTO protocol_dsa_details (
                            protocol_event_id, judge_name, pj_number, designation, dsa_per_day, days, total, notes
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                        [
                            eventId,
                            detail.judge_name.trim(),
                            detail.pj_number.trim(),
                            detail.designation || null,
                            detail.dsa_per_day,
                            detail.days,
                            total,
                            detail.notes || null,
                        ]
                    );
                }
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

    // ─── Other Payments ──────────────────────────────────────────────────────

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
            payment.dsa_details = await this.getDSADetails('other_payment_dsa_details', 'other_payment_id', payment.id);
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
        payment.dsa_details = await this.getDSADetails('other_payment_dsa_details', 'other_payment_id', id);
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
                for (const detail of input.dsa_details) {
                    const total = detail.dsa_per_day * detail.days;
                    await client.query(
                        `INSERT INTO other_payment_dsa_details (
                            other_payment_id, judge_name, pj_number, designation, dsa_per_day, days, total, notes
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                        [
                            paymentId,
                            detail.judge_name.trim(),
                            detail.pj_number.trim(),
                            detail.designation || null,
                            detail.dsa_per_day,
                            detail.days,
                            total,
                            detail.notes || null,
                        ]
                    );
                }
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

            await client.query(
                `UPDATE other_payment_dsa_details SET is_active = false WHERE other_payment_id = $1`,
                [paymentId]
            );

            if (dsaDetails && dsaDetails.length > 0) {
                for (const detail of dsaDetails) {
                    const total = detail.dsa_per_day * detail.days;
                    await client.query(
                        `INSERT INTO other_payment_dsa_details (
                            other_payment_id, judge_name, pj_number, designation, dsa_per_day, days, total, notes
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                        [
                            paymentId,
                            detail.judge_name.trim(),
                            detail.pj_number.trim(),
                            detail.designation || null,
                            detail.dsa_per_day,
                            detail.days,
                            total,
                            detail.notes || null,
                        ]
                    );
                }
            }

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
}