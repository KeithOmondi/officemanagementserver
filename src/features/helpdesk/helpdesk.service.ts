import { pool } from '../../config/db';
import { AppError } from '../../utils/response';
import type {
    JudgeUtility,
    ClubMembership,
    Circuit,
    SpecialBench,
    PartHeard,
    JudgeRequest,
    VisaRequest,
    ProtocolEvent,
    HelpDeskAuditEntry,
    HelpDeskStats,
    CreateUtilityInput,
    CreateClubMembershipInput,
    CreateCircuitInput,
    CreateSpecialBenchInput,
    CreatePartHeardInput,
    CreateJudgeRequestInput,
    CreateVisaRequestInput,
    CreateProtocolEventInput,
    UpdateStatusInput,
    HelpDeskFilters,
    DSADetailInput,
    ServiceWeek,
    CreateServiceWeekInput,
} from './helpdesk.types';

// ─── Constants ─────────────────────────────────────────────────────────────────

const UTILITY_SELECT = `
    id, judge_name, utility_type, amount, period, description,
    supporting_document_url, status, created_by, created_at, updated_at
`;

const CLUB_SELECT = `
    id, judge_name, club_name, annual_fee, period,
    supporting_document_url, status, created_by, created_at, updated_at
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

const REQUEST_SELECT = `
    id, judge_name, nature, mode, received_date, status, resolution_notes,
    created_by, created_at, updated_at
`;

const VISA_SELECT = `
    id, judge_name, request_date, destination_country, visa_type,
    travel_date, status, notes, created_by, created_at, updated_at
`;

const PROTOCOL_SELECT = `
    id, event_name, start_date, end_date, dsa_required, total_dsa, status, notes,
    created_by, created_at, updated_at
`;

// DSA detail select with all fields including notes
const DSA_DETAIL_SELECT = `
    id, judge_name, pj_number, dsa_per_day, days, total, notes
`;

// ─── Service Class ────────────────────────────────────────────────────────────

export class HelpDeskService {

    // ─── Statistics ──────────────────────────────────────────────────────────

    static async getStats(): Promise<HelpDeskStats> {
        const { rows } = await pool.query(`
            SELECT
                (SELECT COUNT(*)::int FROM judge_utilities WHERE is_active = true) +
                (SELECT COUNT(*)::int FROM club_memberships WHERE is_active = true) +
                (SELECT COUNT(*)::int FROM circuits WHERE is_active = true) +
                (SELECT COUNT(*)::int FROM special_benches WHERE is_active = true) +
                (SELECT COUNT(*)::int FROM part_heards WHERE is_active = true) AS total_records,
                (SELECT COUNT(*)::int FROM circuits WHERE status IN ('Pending', 'In Progress') AND is_active = true) +
                (SELECT COUNT(*)::int FROM special_benches WHERE status IN ('Pending', 'In Progress') AND is_active = true) AS in_progress,
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

    // ─── Judge Utilities ─────────────────────────────────────────────────────

    static async findAllUtilities(filters: HelpDeskFilters = {}): Promise<JudgeUtility[]> {
        let query = `SELECT ${UTILITY_SELECT} FROM judge_utilities WHERE is_active = true`;
        const params: unknown[] = [];
        let paramCount = 1;

        if (filters.search) {
            query += ` AND (judge_name ILIKE $${paramCount} OR utility_type ILIKE $${paramCount})`;
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

    static async findUtilityById(id: string): Promise<JudgeUtility | null> {
        const { rows } = await pool.query(
            `SELECT ${UTILITY_SELECT} FROM judge_utilities WHERE id = $1 AND is_active = true`,
            [id]
        );
        return rows[0] || null;
    }

    static async createUtility(
        input: CreateUtilityInput,
        userId: string
    ): Promise<JudgeUtility> {
        const { rows } = await pool.query(
            `INSERT INTO judge_utilities (
                judge_name, utility_type, amount, period, description, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id`,
            [
                input.judge_name.trim(),
                input.utility_type,
                input.amount,
                input.period.trim(),
                input.description || null,
                userId,
            ]
        );

        const utility = await this.findUtilityById(rows[0].id);
        if (!utility) throw new AppError(500, 'Failed to create utility entry');
        return utility;
    }

    static async updateUtilityStatus(
        id: string,
        input: UpdateStatusInput
    ): Promise<JudgeUtility> {
        const existing = await this.findUtilityById(id);
        if (!existing) {
            throw new AppError(404, 'Utility entry not found');
        }

        await pool.query(
            `UPDATE judge_utilities SET status = $1 WHERE id = $2`,
            [input.status, id]
        );

        const updated = await this.findUtilityById(id);
        if (!updated) throw new AppError(500, 'Failed to update utility status');
        return updated;
    }

    static async deleteUtility(id: string): Promise<void> {
        const { rows } = await pool.query(
            `UPDATE judge_utilities SET is_active = false WHERE id = $1 RETURNING id`,
            [id]
        );
        if (rows.length === 0) {
            throw new AppError(404, 'Utility entry not found');
        }
    }

    // ─── Club Membership ─────────────────────────────────────────────────────

    static async findAllClubMemberships(filters: HelpDeskFilters = {}): Promise<ClubMembership[]> {
        let query = `SELECT ${CLUB_SELECT} FROM club_memberships WHERE is_active = true`;
        const params: unknown[] = [];
        let paramCount = 1;

        if (filters.search) {
            query += ` AND (judge_name ILIKE $${paramCount} OR club_name ILIKE $${paramCount})`;
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
                judge_name, club_name, annual_fee, period, created_by
            ) VALUES ($1, $2, $3, $4, $5)
            RETURNING id`,
            [
                input.judge_name.trim(),
                input.club_name.trim(),
                input.annual_fee,
                input.period.trim(),
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

        // Get DSA details for each circuit with all fields including notes
        for (const circuit of rows) {
            const { rows: dsaRows } = await pool.query(
                `SELECT ${DSA_DETAIL_SELECT} 
                 FROM circuit_dsa_details 
                 WHERE circuit_id = $1 AND is_active = true
                 ORDER BY created_at ASC`,
                [circuit.id]
            );
            circuit.dsa_details = dsaRows;
            
            // Calculate total DSA from all details
            if (dsaRows.length > 0) {
                circuit.total_dsa = dsaRows.reduce((sum: number, detail: any) => sum + Number(detail.total), 0);
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
        const { rows: dsaRows } = await pool.query(
            `SELECT ${DSA_DETAIL_SELECT} 
             FROM circuit_dsa_details 
             WHERE circuit_id = $1 AND is_active = true
             ORDER BY created_at ASC`,
            [id]
        );
        circuit.dsa_details = dsaRows;
        
        // Calculate total DSA from all details
        if (dsaRows.length > 0) {
            circuit.total_dsa = dsaRows.reduce((sum: number, detail: any) => sum + Number(detail.total), 0);
        } else {
            circuit.total_dsa = 0;
        }

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

            // Insert DSA details with all fields including notes
            if (input.dsa_details && input.dsa_details.length > 0) {
                for (const detail of input.dsa_details) {
                    const total = detail.dsa_per_day * detail.days;
                    await client.query(
                        `INSERT INTO circuit_dsa_details (
                            circuit_id, judge_name, pj_number, dsa_per_day, days, total, notes
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                        [
                            circuitId,
                            detail.judge_name.trim(),
                            detail.pj_number.trim(),
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

            // Check if circuit exists
            const circuit = await this.findCircuitById(circuitId);
            if (!circuit) {
                throw new AppError(404, 'Circuit not found');
            }

            // Soft delete existing DSA details
            await client.query(
                `UPDATE circuit_dsa_details SET is_active = false WHERE circuit_id = $1`,
                [circuitId]
            );

            // Insert new DSA details with all fields including notes
            if (dsaDetails && dsaDetails.length > 0) {
                for (const detail of dsaDetails) {
                    const total = detail.dsa_per_day * detail.days;
                    await client.query(
                        `INSERT INTO circuit_dsa_details (
                            circuit_id, judge_name, pj_number, dsa_per_day, days, total, notes
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                        [
                            circuitId,
                            detail.judge_name.trim(),
                            detail.pj_number.trim(),
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

            // Soft delete circuit
            const { rows } = await client.query(
                `UPDATE circuits SET is_active = false WHERE id = $1 RETURNING id`,
                [id]
            );
            
            if (rows.length === 0) {
                throw new AppError(404, 'Circuit not found');
            }

            // Soft delete associated DSA details
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
            const { rows: dsaRows } = await pool.query(
                `SELECT ${DSA_DETAIL_SELECT} 
                 FROM special_bench_dsa_details 
                 WHERE bench_id = $1 AND is_active = true
                 ORDER BY created_at ASC`,
                [bench.id]
            );
            bench.dsa_details = dsaRows;
            
            // Calculate total DSA
            if (dsaRows.length > 0) {
                bench.total_dsa = dsaRows.reduce((sum: number, detail: any) => sum + Number(detail.total), 0);
            } else {
                bench.total_dsa = 0;
            }
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
        const { rows: dsaRows } = await pool.query(
            `SELECT ${DSA_DETAIL_SELECT} 
             FROM special_bench_dsa_details 
             WHERE bench_id = $1 AND is_active = true
             ORDER BY created_at ASC`,
            [id]
        );
        bench.dsa_details = dsaRows;
        
        // Calculate total DSA
        if (dsaRows.length > 0) {
            bench.total_dsa = dsaRows.reduce((sum: number, detail: any) => sum + Number(detail.total), 0);
        } else {
            bench.total_dsa = 0;
        }

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
                            bench_id, judge_name, pj_number, dsa_per_day, days, total, notes
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                        [
                            benchId,
                            detail.judge_name.trim(),
                            detail.pj_number.trim(),
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

    static async updateBenchStatus(
        id: string,
        input: UpdateStatusInput
    ): Promise<SpecialBench> {
        const existing = await this.findBenchById(id);
        if (!existing) {
            throw new AppError(404, 'Special bench not found');
        }

        await pool.query(
            `UPDATE special_benches SET status = $1 WHERE id = $2`,
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
            const { rows: dsaRows } = await pool.query(
                `SELECT ${DSA_DETAIL_SELECT} 
                 FROM part_heard_dsa_details 
                 WHERE part_heard_id = $1 AND is_active = true
                 ORDER BY created_at ASC`,
                [ph.id]
            );
            ph.dsa_details = dsaRows;
            
            // Calculate total DSA
            if (dsaRows.length > 0) {
                ph.total_dsa = dsaRows.reduce((sum: number, detail: any) => sum + Number(detail.total), 0);
            } else {
                ph.total_dsa = 0;
            }
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
        const { rows: dsaRows } = await pool.query(
            `SELECT ${DSA_DETAIL_SELECT} 
             FROM part_heard_dsa_details 
             WHERE part_heard_id = $1 AND is_active = true
             ORDER BY created_at ASC`,
            [id]
        );
        ph.dsa_details = dsaRows;
        
        // Calculate total DSA
        if (dsaRows.length > 0) {
            ph.total_dsa = dsaRows.reduce((sum: number, detail: any) => sum + Number(detail.total), 0);
        } else {
            ph.total_dsa = 0;
        }

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
                            part_heard_id, judge_name, pj_number, dsa_per_day, days, total, notes
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                        [
                            phId,
                            detail.judge_name.trim(),
                            detail.pj_number.trim(),
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

    static async updatePartHeardStatus(
        id: string,
        input: UpdateStatusInput
    ): Promise<PartHeard> {
        const existing = await this.findPartHeardById(id);
        if (!existing) {
            throw new AppError(404, 'Part-heard not found');
        }

        await pool.query(
            `UPDATE part_heards SET status = $1 WHERE id = $2`,
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

    // ─── Judges' Requests ─────────────────────────────────────────────────────

    static async findAllRequests(filters: HelpDeskFilters = {}): Promise<JudgeRequest[]> {
        let query = `SELECT ${REQUEST_SELECT} FROM judge_requests WHERE is_active = true`;
        const params: unknown[] = [];
        let paramCount = 1;

        if (filters.search) {
            query += ` AND (judge_name ILIKE $${paramCount} OR nature ILIKE $${paramCount})`;
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

    static async findRequestById(id: string): Promise<JudgeRequest | null> {
        const { rows } = await pool.query(
            `SELECT ${REQUEST_SELECT} FROM judge_requests WHERE id = $1 AND is_active = true`,
            [id]
        );
        return rows[0] || null;
    }

    static async createRequest(
        input: CreateJudgeRequestInput,
        userId: string
    ): Promise<JudgeRequest> {
        const { rows } = await pool.query(
            `INSERT INTO judge_requests (
                judge_name, nature, mode, received_date, created_by
            ) VALUES ($1, $2, $3, $4, $5)
            RETURNING id`,
            [
                input.judge_name.trim(),
                input.nature.trim(),
                input.mode,
                input.received_date,
                userId,
            ]
        );

        const request = await this.findRequestById(rows[0].id);
        if (!request) throw new AppError(500, 'Failed to create request');
        return request;
    }

    static async updateRequest(
        id: string,
        input: { status: string; resolution_notes?: string }
    ): Promise<JudgeRequest> {
        const existing = await this.findRequestById(id);
        if (!existing) {
            throw new AppError(404, 'Request not found');
        }

        await pool.query(
            `UPDATE judge_requests 
             SET status = $1, resolution_notes = $2 
             WHERE id = $3`,
            [input.status, input.resolution_notes || null, id]
        );

        const updated = await this.findRequestById(id);
        if (!updated) throw new AppError(500, 'Failed to update request');
        return updated;
    }

    static async deleteRequest(id: string): Promise<void> {
        const { rows } = await pool.query(
            `UPDATE judge_requests SET is_active = false WHERE id = $1 RETURNING id`,
            [id]
        );
        if (rows.length === 0) {
            throw new AppError(404, 'Request not found');
        }
    }

    // ─── Visa Support ────────────────────────────────────────────────────────

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
                judge_name, request_date, destination_country, visa_type,
                travel_date, notes, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id`,
            [
                input.judge_name.trim(),
                input.request_date,
                input.destination_country.trim(),
                input.visa_type,
                input.travel_date || null,
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
            query += ` AND event_name ILIKE $${paramCount}`;
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
            const { rows: dsaRows } = await pool.query(
                `SELECT ${DSA_DETAIL_SELECT} 
                 FROM protocol_dsa_details 
                 WHERE protocol_event_id = $1 AND is_active = true
                 ORDER BY created_at ASC`,
                [event.id]
            );
            event.dsa_details = dsaRows;
            
            // Calculate total DSA
            if (dsaRows.length > 0) {
                event.total_dsa = dsaRows.reduce((sum: number, detail: any) => sum + Number(detail.total), 0);
            } else {
                event.total_dsa = 0;
            }
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
        const { rows: dsaRows } = await pool.query(
            `SELECT ${DSA_DETAIL_SELECT} 
             FROM protocol_dsa_details 
             WHERE protocol_event_id = $1 AND is_active = true
             ORDER BY created_at ASC`,
            [id]
        );
        event.dsa_details = dsaRows;
        
        // Calculate total DSA
        if (dsaRows.length > 0) {
            event.total_dsa = dsaRows.reduce((sum: number, detail: any) => sum + Number(detail.total), 0);
        } else {
            event.total_dsa = 0;
        }

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
                event_name, start_date, end_date, dsa_required, notes, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id`,
            [
                input.event_name.trim(),
                input.start_date,
                input.end_date,
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
                        protocol_event_id, judge_name, pj_number, dsa_per_day, days, total, notes
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    [
                        eventId,
                        detail.judge_name.trim(),
                        detail.pj_number.trim(),
                        detail.dsa_per_day,
                        detail.days,
                        total,
                        detail.notes || null, // Convert undefined to null for DB
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

    // Add to service class
static async findAllServiceWeeks(filters: HelpDeskFilters = {}): Promise<ServiceWeek[]> {
    let query = `SELECT id, name, week_number, year, start_date, end_date, total_dsa, status,
                        created_by, created_at, updated_at
                 FROM service_weeks WHERE is_active = true`;
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
        const { rows: dsaRows } = await pool.query(
            `SELECT id, judge_name, pj_number, dsa_per_day, days, total, notes
             FROM service_week_dsa_details 
             WHERE service_week_id = $1 AND is_active = true
             ORDER BY created_at ASC`,
            [week.id]
        );
        week.dsa_details = dsaRows;
        
        if (dsaRows.length > 0) {
            week.total_dsa = dsaRows.reduce((sum: number, detail: any) => sum + Number(detail.total), 0);
        } else {
            week.total_dsa = 0;
        }
    }

    return rows;
}

static async findServiceWeekById(id: string): Promise<ServiceWeek | null> {
    const { rows } = await pool.query(
        `SELECT id, name, week_number, year, start_date, end_date, total_dsa, status,
                created_by, created_at, updated_at
         FROM service_weeks WHERE id = $1 AND is_active = true`,
        [id]
    );

    if (rows.length === 0) return null;

    const week = rows[0];
    const { rows: dsaRows } = await pool.query(
        `SELECT id, judge_name, pj_number, dsa_per_day, days, total, notes
         FROM service_week_dsa_details 
         WHERE service_week_id = $1 AND is_active = true
         ORDER BY created_at ASC`,
        [id]
    );
    week.dsa_details = dsaRows;
    
    if (dsaRows.length > 0) {
        week.total_dsa = dsaRows.reduce((sum: number, detail: any) => sum + Number(detail.total), 0);
    } else {
        week.total_dsa = 0;
    }

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
                        service_week_id, judge_name, pj_number, dsa_per_day, days, total, notes
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    [
                        weekId,
                        detail.judge_name.trim(),
                        detail.pj_number.trim(),
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
}