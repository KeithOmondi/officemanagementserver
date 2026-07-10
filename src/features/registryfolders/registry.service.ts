// src/features/registry/registry.service.ts

import { pool } from '../../config/db';
import { AppError } from '../../utils/response';
import type {
    RegistryFolder,
    RegistryFolderWithStats,
    CreateRegistryFolderInput,
    UpdateRegistryFolderInput,
    RegistryFolderFilters,
    RegistryCategory,
} from './registry.types';
import { REGISTRY_CATEGORIES } from './registry.types';

const FOLDER_SELECT = `
    f.id, f.ref_no, f.name, f.category, f.description,
    f.parent_folder_id, f.status, f.department_id,
    f.created_by, f.created_at, f.updated_at, f.updated_by,
    f.is_active,
    u.full_name as created_by_name,
    u2.full_name as updated_by_name
`;

export class RegistryService {

    // ── Create Folder ──────────────────────────────────────────────────────

    static async createFolder(
        input: CreateRegistryFolderInput,
        userId: string
    ): Promise<RegistryFolder> {
        // Check if ref_no already exists
        const existing = await pool.query(
            'SELECT id FROM rhc_folders WHERE ref_no = $1 AND is_active = true',
            [input.ref_no]
        );

        if (existing.rows.length > 0) {
            throw new AppError(409, `Folder with reference ${input.ref_no} already exists`);
        }

        // If parent folder is specified, verify it exists
        if (input.parent_folder_id) {
            const parent = await pool.query(
                'SELECT id FROM rhc_folders WHERE id = $1 AND is_active = true',
                [input.parent_folder_id]
            );
            if (parent.rows.length === 0) {
                throw new AppError(404, 'Parent folder not found');
            }
        }

        const { rows } = await pool.query(
            `INSERT INTO rhc_folders
                (ref_no, name, category, description, parent_folder_id,
                 status, department_id, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING id`,
            [
                input.ref_no.trim(),
                input.name.trim(),
                input.category,
                input.description?.trim() || null,
                input.parent_folder_id || null,
                input.status || 'active',
                input.department_id || null,
                userId,
            ]
        );

        const folder = await this.findById(rows[0].id);
        if (!folder) {
            throw new AppError(500, 'Failed to create folder');
        }
        return folder;
    }

    // ── Find by ID ──────────────────────────────────────────────────────────

    static async findById(id: string): Promise<RegistryFolder | null> {
        const { rows } = await pool.query(
            `SELECT ${FOLDER_SELECT}
             FROM rhc_folders f
             LEFT JOIN users u ON f.created_by = u.id
             LEFT JOIN users u2 ON f.updated_by = u2.id
             WHERE f.id = $1 AND f.is_active = true`,
            [id]
        );
        return rows[0] || null;
    }

    // ── List Folders ────────────────────────────────────────────────────────

    static async findAll(filters: RegistryFolderFilters = {}): Promise<RegistryFolderWithStats[]> {
        let query = `
            SELECT ${FOLDER_SELECT},
                   COUNT(DISTINCT d.id) as document_count,
                   COUNT(DISTINCT sf.id) as sub_folder_count
            FROM rhc_folders f
            LEFT JOIN users u ON f.created_by = u.id
            LEFT JOIN users u2 ON f.updated_by = u2.id
            LEFT JOIN helpdesk_documents d ON d.entity_id = f.id AND d.entity_type = 'rhc_folder' AND d.is_active = true
            LEFT JOIN rhc_folders sf ON sf.parent_folder_id = f.id AND sf.is_active = true
            WHERE f.is_active = true
        `;

        const params: unknown[] = [];
        let p = 1;

        if (filters.search) {
            query += ` AND (f.ref_no ILIKE $${p} OR f.name ILIKE $${p})`;
            params.push(`%${filters.search}%`);
            p++;
        }

        if (filters.category) {
            query += ` AND f.category = $${p}`;
            params.push(filters.category);
            p++;
        }

        if (filters.status) {
            query += ` AND f.status = $${p}`;
            params.push(filters.status);
            p++;
        }

        if (filters.parent_folder_id !== undefined) {
            if (filters.parent_folder_id === null) {
                query += ` AND f.parent_folder_id IS NULL`;
            } else {
                query += ` AND f.parent_folder_id = $${p}`;
                params.push(filters.parent_folder_id);
                p++;
            }
        }

        if (filters.department_id) {
            query += ` AND f.department_id = $${p}`;
            params.push(filters.department_id);
            p++;
        }

        query += ` GROUP BY f.id, u.full_name, u2.full_name`;

        if (!filters.include_sub_folders) {
            // Only show root folders by default
            query += ` HAVING f.parent_folder_id IS NULL`;
        }

        query += ` ORDER BY f.ref_no ASC`;

        if (filters.limit) {
            query += ` LIMIT $${p}`;
            params.push(filters.limit);
            p++;
        }
        if (filters.offset) {
            query += ` OFFSET $${p}`;
            params.push(filters.offset);
        }

        const { rows } = await pool.query(query, params);
        return rows;
    }

    // ── Get Children ────────────────────────────────────────────────────────

    static async getChildren(
        parentId: string,
        limit?: number,
        offset?: number
    ): Promise<RegistryFolder[]> {
        let query = `
            SELECT ${FOLDER_SELECT}
            FROM rhc_folders f
            LEFT JOIN users u ON f.created_by = u.id
            LEFT JOIN users u2 ON f.updated_by = u2.id
            WHERE f.parent_folder_id = $1 AND f.is_active = true
            ORDER BY f.ref_no ASC
        `;

        const params: unknown[] = [parentId];
        let p = 2;

        if (limit) {
            query += ` LIMIT $${p}`;
            params.push(limit);
            p++;
        }
        if (offset) {
            query += ` OFFSET $${p}`;
            params.push(offset);
        }

        const { rows } = await pool.query(query, params);
        return rows;
    }

    // ── Get Folder Hierarchy ───────────────────────────────────────────────

    static async getHierarchy(
        rootId: string
    ): Promise<{ folder: RegistryFolder; children: RegistryFolder[] }> {
        const folder = await this.findById(rootId);
        if (!folder) {
            throw new AppError(404, 'Folder not found');
        }

        const children = await this.getChildren(rootId);
        return { folder, children };
    }

    // ── Update Folder ──────────────────────────────────────────────────────

    static async updateFolder(
        id: string,
        input: UpdateRegistryFolderInput,
        userId: string
    ): Promise<RegistryFolder> {
        const folder = await this.findById(id);
        if (!folder) {
            throw new AppError(404, 'Folder not found');
        }

        const updates: string[] = [];
        const values: unknown[] = [];
        let p = 1;

        if (input.name !== undefined) {
            updates.push(`name = $${p}`);
            values.push(input.name.trim());
            p++;
        }

        if (input.description !== undefined) {
            updates.push(`description = $${p}`);
            values.push(input.description?.trim() || null);
            p++;
        }

        if (input.status !== undefined) {
            updates.push(`status = $${p}`);
            values.push(input.status);
            p++;
        }

        if (input.department_id !== undefined) {
            updates.push(`department_id = $${p}`);
            values.push(input.department_id || null);
            p++;
        }

        if (updates.length === 0) {
            throw new AppError(400, 'No fields to update');
        }

        updates.push(`updated_by = $${p}`);
        values.push(userId);
        p++;

        updates.push(`updated_at = NOW()`);

        values.push(id);

        await pool.query(
            `UPDATE rhc_folders
             SET ${updates.join(', ')}
             WHERE id = $${p} AND is_active = true`,
            values
        );

        const updated = await this.findById(id);
        if (!updated) {
            throw new AppError(500, 'Failed to update folder');
        }
        return updated;
    }

    // ── Delete Folder ──────────────────────────────────────────────────────

    static async deleteFolder(id: string, userId: string): Promise<void> {
        const folder = await this.findById(id);
        if (!folder) {
            throw new AppError(404, 'Folder not found');
        }

        // Check if folder has children
        const children = await pool.query(
            'SELECT id FROM rhc_folders WHERE parent_folder_id = $1 AND is_active = true',
            [id]
        );

        if (children.rows.length > 0) {
            throw new AppError(400, 'Cannot delete folder with sub-folders');
        }

        // Check if folder has documents
        const documents = await pool.query(
            'SELECT id FROM helpdesk_documents WHERE entity_id = $1 AND entity_type = $2 AND is_active = true',
            [id, 'rhc_folder']
        );

        if (documents.rows.length > 0) {
            throw new AppError(400, 'Cannot delete folder with documents');
        }

        await pool.query(
            `UPDATE rhc_folders
             SET is_active = false, updated_by = $1, updated_at = NOW()
             WHERE id = $2`,
            [userId, id]
        );
    }

    // ── Get Categories with Counts ────────────────────────────────────────

    static async getCategoriesWithCounts(): Promise<{ category: RegistryCategory; count: number }[]> {
        const { rows } = await pool.query(
            `SELECT category, COUNT(*) as count
             FROM rhc_folders
             WHERE is_active = true
             GROUP BY category
             ORDER BY count DESC`
        );

        // Ensure all categories are represented
        const allCategories = Object.values(REGISTRY_CATEGORIES);
        const countsMap = new Map(rows.map((r) => [r.category, parseInt(r.count)]));

        return allCategories.map((category) => ({
            category: category as RegistryCategory,
            count: countsMap.get(category) || 0,
        }));
    }

    // ── Get Folder Documents ──────────────────────────────────────────────

    static async getFolderDocuments(
    folderId: string,
    limit?: number,
    offset?: number
): Promise<any[]> {
    const folder = await this.findById(folderId);
    if (!folder) throw new AppError(404, 'Folder not found');

    let query = `
        SELECT d.id, d.title AS subject, d.reference_no AS ref,
               d.file_url, d.mime_type AS format, d.created_at, d.updated_at,
               d.created_by AS uploaded_by, u.full_name AS uploaded_by_name
        FROM documents d
        LEFT JOIN users u ON u.id = d.created_by
        WHERE d.folder_id = $1 AND d.is_active = true
        ORDER BY d.created_at DESC
    `;
    const params: unknown[] = [folderId];
    let p = 2;
    if (limit) { query += ` LIMIT $${p}`; params.push(limit); p++; }
    if (offset) { query += ` OFFSET $${p}`; params.push(offset); }

    const { rows } = await pool.query(query, params);
    return rows;
}

    // ── Search Folders ─────────────────────────────────────────────────────

    static async searchFolders(query: string): Promise<RegistryFolder[]> {
        const { rows } = await pool.query(
            `SELECT ${FOLDER_SELECT}
             FROM rhc_folders f
             LEFT JOIN users u ON f.created_by = u.id
             LEFT JOIN users u2 ON f.updated_by = u2.id
             WHERE f.is_active = true
               AND (f.ref_no ILIKE $1 OR f.name ILIKE $1)
             ORDER BY f.ref_no ASC
             LIMIT 20`,
            [`%${query}%`]
        );
        return rows;
    }
}