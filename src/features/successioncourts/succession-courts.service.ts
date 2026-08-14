// ============================================================
// src/features/succession-courts/succession-courts.service.ts
// ============================================================

import { pool } from '../../config/db';
import { AppError } from '../../utils/response';
import type {
    SuccessionCourt,
    SuccessionCourtWithUser,
    CreateSuccessionCourtInput,
    UpdateSuccessionCourtInput,
    SuccessionCourtFilters,
    SupportPersonAssignment,
    AssignSupportPersonByCategoryInput,
    AssignSupportPersonByStationInput,
    ReassignSupportPersonInput,
} from './succession-courts.types';

const SUCCESSION_COURT_SELECT = `
    id, name, station, category, support_person, support_person_id, contact, is_active,
    created_by, created_at, updated_at
`;

export class SuccessionCourtService {

    // ─── Find All ─────────────────────────────────────────────────────────

    static async findAll(filters: SuccessionCourtFilters = {}): Promise<SuccessionCourt[]> {
        let query = `SELECT ${SUCCESSION_COURT_SELECT} FROM succession_courts WHERE 1=1`;
        const params: unknown[] = [];
        let paramCount = 1;

        if (filters.search) {
            query += ` AND (name ILIKE $${paramCount} OR station ILIKE $${paramCount})`;
            params.push(`%${filters.search}%`);
            paramCount++;
        }
        if (filters.category) {
            query += ` AND category = $${paramCount}`;
            params.push(filters.category);
            paramCount++;
        }
        if (filters.station) {
            query += ` AND station ILIKE $${paramCount}`;
            params.push(`%${filters.station}%`);
            paramCount++;
        }
        if (filters.support_person_id) {
            query += ` AND support_person_id = $${paramCount}`;
            params.push(filters.support_person_id);
            paramCount++;
        }
        if (filters.is_active !== undefined) {
            query += ` AND is_active = $${paramCount}`;
            params.push(filters.is_active);
            paramCount++;
        }

        query += ` ORDER BY category ASC, name ASC`;
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

    // ─── Find By ID ──────────────────────────────────────────────────────

    static async findById(id: string): Promise<SuccessionCourt | null> {
        const { rows } = await pool.query(
            `SELECT ${SUCCESSION_COURT_SELECT} FROM succession_courts WHERE id = $1`,
            [id]
        );
        return rows[0] || null;
    }

    // ─── Find With User Details ─────────────────────────────────────────

    static async findByIdWithUser(id: string): Promise<SuccessionCourtWithUser | null> {
        const { rows } = await pool.query(
            `SELECT sc.*, 
                    u.id as user_id, 
                    u.full_name as user_name, 
                    u.email as user_email, 
                    u.role as user_role
             FROM succession_courts sc
             LEFT JOIN users u ON sc.support_person_id = u.id
             WHERE sc.id = $1`,
            [id]
        );
        
        if (rows.length === 0) return null;
        
        const row = rows[0];
        return {
            ...row,
            support_person_user: row.user_id ? {
                id: row.user_id,
                name: row.user_name,
                email: row.user_email,
                role: row.user_role,
            } : null,
        };
    }

    // ─── Enrich Courts With User Details ──────────────────────────────

    static async enrichWithSupportPersonDetails(
        courts: SuccessionCourt[]
    ): Promise<SuccessionCourtWithUser[]> {
        if (courts.length === 0) return [];

        const userIds = courts
            .map(c => c.support_person_id)
            .filter((id): id is string => id !== null);

        if (userIds.length === 0) {
            return courts.map(court => ({
                ...court,
                support_person_user: null,
            }));
        }

        const { rows: users } = await pool.query(
            `SELECT id, full_name as name, email, role FROM users WHERE id = ANY($1)`,
            [userIds]
        );

        const userMap = new Map(users.map(u => [u.id, u]));

        return courts.map(court => ({
            ...court,
            support_person_user: court.support_person_id 
                ? userMap.get(court.support_person_id) || null
                : null,
        }));
    }

    // ─── Get Available Support Persons ──────────────────────────────────

    static async getAvailableSupportPersons(): Promise<any[]> {
        const { rows } = await pool.query(
            `SELECT id, full_name as name, email, role 
             FROM users 
             WHERE role IN ('super_admin', 'dept_head', 'staff')
             AND is_active = true
             ORDER BY full_name`
        );
        return rows;
    }

    // ─── Get Support Person Assignments ─────────────────────────────────

    static async getSupportPersonAssignments(
        userId?: string,
        category?: string
    ): Promise<SupportPersonAssignment[]> {
        let query = `
            SELECT 
                u.id as user_id,
                u.full_name as user_name,
                u.email as user_email,
                u.role as user_role,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'id', sc.id,
                            'name', sc.name,
                            'station', sc.station,
                            'category', sc.category,
                            'contact', sc.contact
                        ) ORDER BY sc.category, sc.name
                    ) FILTER (WHERE sc.id IS NOT NULL),
                    '[]'::json
                ) as assigned_courts,
                COUNT(sc.id) as total_assigned
            FROM users u
            LEFT JOIN succession_courts sc ON u.id = sc.support_person_id AND sc.is_active = true
            WHERE u.role IN ('super_admin', 'dept_head', 'staff')
            AND u.is_active = true
        `;

        const params: unknown[] = [];
        let paramCount = 1;

        if (userId) {
            query += ` AND u.id = $${paramCount}`;
            params.push(userId);
            paramCount++;
        }

        if (category) {
            query += ` AND sc.category = $${paramCount}`;
            params.push(category);
            paramCount++;
        }

        query += ` GROUP BY u.id, u.full_name, u.email, u.role ORDER BY u.full_name`;

        const { rows } = await pool.query(query, params);
        return rows.map(row => ({
            userId: row.user_id,
            userName: row.user_name,
            userEmail: row.user_email,
            userRole: row.user_role,
            assignedCourts: row.assigned_courts || [],
            totalAssigned: parseInt(row.total_assigned, 10) || 0,
        }));
    }

    // ─── Create ──────────────────────────────────────────────────────────

    static async create(
        input: CreateSuccessionCourtInput,
        userId: string
    ): Promise<SuccessionCourt> {
        if (input.support_person_id) {
            const userCheck = await pool.query(
                `SELECT id FROM users WHERE id = $1 AND is_active = true`,
                [input.support_person_id]
            );
            if (userCheck.rows.length === 0) {
                throw new AppError(404, 'Support person not found');
            }
        }

        const { rows } = await pool.query(
            `INSERT INTO succession_courts (
                name, station, category, support_person_id, contact, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id`,
            [
                input.name.trim(),
                input.station.trim(),
                input.category,
                input.support_person_id || null,
                input.contact?.trim() || null,
                userId,
            ]
        );

        const court = await this.findById(rows[0].id);
        if (!court) throw new AppError(500, 'Failed to create succession court');
        return court;
    }

    // ─── Update ──────────────────────────────────────────────────────────

    static async update(
        id: string,
        input: UpdateSuccessionCourtInput
    ): Promise<SuccessionCourt> {
        const existing = await this.findById(id);
        if (!existing) {
            throw new AppError(404, 'Succession court not found');
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

        if (input.support_person_id !== undefined) {
            if (input.support_person_id) {
                const userCheck = await pool.query(
                    `SELECT id, full_name FROM users WHERE id = $1 AND is_active = true`,
                    [input.support_person_id]
                );
                if (userCheck.rows.length === 0) {
                    throw new AppError(404, 'Support person not found');
                }
                setField('support_person', userCheck.rows[0].full_name);
            } else {
                setField('support_person', null);
            }
            setField('support_person_id', input.support_person_id);
        }

        setField('name', input.name?.trim());
        setField('station', input.station?.trim());
        setField('category', input.category);
        setField('contact', input.contact?.trim() || null);
        setField('is_active', input.is_active);

        if (fields.length === 0) {
            return existing;
        }

        fields.push(`updated_at = now()`);
        values.push(id);

        await pool.query(
            `UPDATE succession_courts SET ${fields.join(', ')} WHERE id = $${paramCount}`,
            values
        );

        const updated = await this.findById(id);
        if (!updated) throw new AppError(500, 'Failed to update succession court');
        return updated;
    }

    // ─── Assign Support Person ──────────────────────────────────────────

    static async assignSupportPerson(
        courtId: string,
        userId: string,
        contact?: string
    ): Promise<SuccessionCourt> {
        const existing = await this.findById(courtId);
        if (!existing) {
            throw new AppError(404, 'Succession court not found');
        }

        const userResult = await pool.query(
            `SELECT id, full_name FROM users WHERE id = $1 AND is_active = true`,
            [userId]
        );
        if (userResult.rows.length === 0) {
            throw new AppError(404, 'User not found or inactive');
        }

        const userName = userResult.rows[0].full_name;

        const { rows } = await pool.query(
            `UPDATE succession_courts 
             SET support_person_id = $1, 
                 support_person = $2,
                 contact = COALESCE($3, contact),
                 updated_at = now()
             WHERE id = $4
             RETURNING ${SUCCESSION_COURT_SELECT}`,
            [userId, userName, contact || null, courtId]
        );

        return rows[0];
    }

    // ─── Bulk Assign Support Person ─────────────────────────────────────

    static async bulkAssignSupportPerson(
        courtIds: string[],
        userId: string,
        contact?: string
    ): Promise<{ updated: number; skipped: number; errors: string[] }> {
        const userResult = await pool.query(
            `SELECT id, full_name FROM users WHERE id = $1 AND is_active = true`,
            [userId]
        );
        if (userResult.rows.length === 0) {
            throw new AppError(404, 'User not found or inactive');
        }

        const userName = userResult.rows[0].full_name;
        let updated = 0;
        let skipped = 0;
        const errors: string[] = [];

        for (const courtId of courtIds) {
            try {
                const courtCheck = await pool.query(
                    `SELECT id FROM succession_courts WHERE id = $1`,
                    [courtId]
                );
                if (courtCheck.rows.length === 0) {
                    skipped++;
                    errors.push(`Court ${courtId} not found`);
                    continue;
                }

                await pool.query(
                    `UPDATE succession_courts 
                     SET support_person_id = $1, 
                         support_person = $2,
                         contact = COALESCE($3, contact),
                         updated_at = now()
                     WHERE id = $4`,
                    [userId, userName, contact || null, courtId]
                );
                updated++;
            } catch (error) {
                errors.push(`Failed to update court ${courtId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                skipped++;
            }
        }

        return { updated, skipped, errors };
    }

    // ─── NEW: Assign Support Person by Category ────────────────────────

    static async assignSupportPersonByCategory(
        input: AssignSupportPersonByCategoryInput
    ): Promise<{ updated: number; skipped: number; errors: string[] }> {
        const { category, userId, contact } = input;

        // Verify user exists and is active
        const userResult = await pool.query(
            `SELECT id, full_name FROM users WHERE id = $1 AND is_active = true`,
            [userId]
        );
        if (userResult.rows.length === 0) {
            throw new AppError(404, 'User not found or inactive');
        }

        const userName = userResult.rows[0].full_name;
        let updated = 0;
        let skipped = 0;
        const errors: string[] = [];

        try {
            // Get all active courts in this category
            const { rows: courts } = await pool.query(
                `SELECT id FROM succession_courts WHERE category = $1 AND is_active = true`,
                [category]
            );

            if (courts.length === 0) {
                throw new AppError(404, `No active courts found in category ${category}`);
            }

            // Update all courts in this category
            const result = await pool.query(
                `UPDATE succession_courts 
                 SET support_person_id = $1, 
                     support_person = $2,
                     contact = COALESCE($3, contact),
                     updated_at = now()
                 WHERE category = $4 AND is_active = true
                 RETURNING id`,
                [userId, userName, contact || null, category]
            );

            updated = result.rows.length;
            skipped = courts.length - updated;

            return { updated, skipped, errors };
        } catch (error) {
            errors.push(`Failed to assign support person by category: ${error instanceof Error ? error.message : 'Unknown error'}`);
            throw error;
        }
    }

    // ─── NEW: Assign Support Person by Station ─────────────────────────

    static async assignSupportPersonByStation(
        input: AssignSupportPersonByStationInput
    ): Promise<{ updated: number; skipped: number; errors: string[] }> {
        const { station, userId, contact } = input;

        // Verify user exists and is active
        const userResult = await pool.query(
            `SELECT id, full_name FROM users WHERE id = $1 AND is_active = true`,
            [userId]
        );
        if (userResult.rows.length === 0) {
            throw new AppError(404, 'User not found or inactive');
        }

        const userName = userResult.rows[0].full_name;
        let updated = 0;
        let skipped = 0;
        const errors: string[] = [];

        try {
            // Get all active courts at this station
            const { rows: courts } = await pool.query(
                `SELECT id FROM succession_courts WHERE station = $1 AND is_active = true`,
                [station]
            );

            if (courts.length === 0) {
                throw new AppError(404, `No active courts found at station: ${station}`);
            }

            // Update all courts at this station
            const result = await pool.query(
                `UPDATE succession_courts 
                 SET support_person_id = $1, 
                     support_person = $2,
                     contact = COALESCE($3, contact),
                     updated_at = now()
                 WHERE station = $4 AND is_active = true
                 RETURNING id`,
                [userId, userName, contact || null, station]
            );

            updated = result.rows.length;
            skipped = courts.length - updated;

            return { updated, skipped, errors };
        } catch (error) {
            errors.push(`Failed to assign support person by station: ${error instanceof Error ? error.message : 'Unknown error'}`);
            throw error;
        }
    }

    // ─── NEW: Reassign Support Person ──────────────────────────────────

    static async reassignSupportPerson(
        input: ReassignSupportPersonInput
    ): Promise<{ updated: number; skipped: number; errors: string[] }> {
        const { currentUserId, newUserId, category, station } = input;

        // Verify both users exist and are active
        const userResult = await pool.query(
            `SELECT id, full_name FROM users WHERE id = ANY($1) AND is_active = true`,
            [[currentUserId, newUserId]]
        );
        if (userResult.rows.length !== 2) {
            throw new AppError(404, 'One or both users not found or inactive');
        }

        // Get the new user's name
        const newUser = userResult.rows.find(u => u.id === newUserId);
        const newUserName = newUser?.full_name;

        let updated = 0;
        let skipped = 0;
        const errors: string[] = [];

        try {
            // Build the WHERE clause for courts to reassign
            let whereClause = `support_person_id = $1 AND is_active = true`;
            const params: unknown[] = [currentUserId];
            let paramCount = 2;

            if (category) {
                whereClause += ` AND category = $${paramCount}`;
                params.push(category);
                paramCount++;
            }

            if (station) {
                whereClause += ` AND station = $${paramCount}`;
                params.push(station);
                paramCount++;
            }

            // Get courts that will be reassigned
            const { rows: courts } = await pool.query(
                `SELECT id FROM succession_courts WHERE ${whereClause}`,
                params
            );

            if (courts.length === 0) {
                const filterMsg = category ? ` in category ${category}` : '';
                const stationMsg = station ? ` at station ${station}` : '';
                throw new AppError(404, `No courts found assigned to this user${filterMsg}${stationMsg}`);
            }

            // Update the courts - reassign to new user
            const updateParams = [newUserId, newUserName, currentUserId];
            let updateQuery = `
                UPDATE succession_courts 
                SET support_person_id = $1, 
                    support_person = $2,
                    updated_at = now()
                WHERE support_person_id = $3 AND is_active = true
            `;

            let updateParamCount = 4;

            if (category) {
                updateQuery += ` AND category = $${updateParamCount}`;
                updateParams.push(category);
                updateParamCount++;
            }

            if (station) {
                updateQuery += ` AND station = $${updateParamCount}`;
                updateParams.push(station);
                updateParamCount++;
            }

            updateQuery += ` RETURNING id`;

            const result = await pool.query(updateQuery, updateParams);

            updated = result.rows.length;
            skipped = courts.length - updated;

            return { updated, skipped, errors };
        } catch (error) {
            errors.push(`Failed to reassign support person: ${error instanceof Error ? error.message : 'Unknown error'}`);
            throw error;
        }
    }

    // ─── Remove Support Person ──────────────────────────────────────────

    static async removeSupportPerson(courtId: string): Promise<SuccessionCourt> {
        const existing = await this.findById(courtId);
        if (!existing) {
            throw new AppError(404, 'Succession court not found');
        }

        const { rows } = await pool.query(
            `UPDATE succession_courts 
             SET support_person_id = NULL, 
                 support_person = NULL,
                 updated_at = now()
             WHERE id = $1
             RETURNING ${SUCCESSION_COURT_SELECT}`,
            [courtId]
        );

        return rows[0];
    }

    // ─── Bulk Remove Support Person ─────────────────────────────────────

    static async bulkRemoveSupportPerson(
        courtIds: string[]
    ): Promise<{ updated: number; skipped: number; errors: string[] }> {
        let updated = 0;
        let skipped = 0;
        const errors: string[] = [];

        for (const courtId of courtIds) {
            try {
                const result = await pool.query(
                    `UPDATE succession_courts 
                     SET support_person_id = NULL, 
                         support_person = NULL,
                         updated_at = now()
                     WHERE id = $1
                     RETURNING id`,
                    [courtId]
                );
                if (result.rows.length > 0) {
                    updated++;
                } else {
                    skipped++;
                    errors.push(`Court ${courtId} not found`);
                }
            } catch (error) {
                errors.push(`Failed to update court ${courtId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                skipped++;
            }
        }

        return { updated, skipped, errors };
    }

    // ─── Delete ──────────────────────────────────────────────────────────

    static async delete(id: string): Promise<void> {
        const { rows } = await pool.query(
            `DELETE FROM succession_courts WHERE id = $1 RETURNING id`,
            [id]
        );
        if (rows.length === 0) {
            throw new AppError(404, 'Succession court not found');
        }
    }
}