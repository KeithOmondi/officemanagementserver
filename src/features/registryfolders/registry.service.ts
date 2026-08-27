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
    FolderDocument,
    MoveDocumentResult,
    BulkAddDocumentsResult,
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

    static async createFolder(input: CreateRegistryFolderInput, userId: string): Promise<RegistryFolder> {
        const existing = await pool.query(
            'SELECT id FROM rhc_folders WHERE ref_no = $1 AND is_active = true',
            [input.ref_no]
        );
        if (existing.rows.length > 0) {
            throw new AppError(409, `Folder with reference ${input.ref_no} already exists`);
        }
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
        if (!folder) throw new AppError(500, 'Failed to create folder');
        return folder;
    }

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

    static async findAll(filters: RegistryFolderFilters = {}): Promise<RegistryFolderWithStats[]> {
        let query = `
            SELECT ${FOLDER_SELECT},
                   COUNT(DISTINCT d.id) as document_count,
                   COUNT(DISTINCT sf.id) as sub_folder_count
            FROM rhc_folders f
            LEFT JOIN users u ON f.created_by = u.id
            LEFT JOIN users u2 ON f.updated_by = u2.id
            LEFT JOIN documents d ON d.folder_id = f.id AND d.is_active = true
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

    static async getChildren(parentId: string, limit?: number, offset?: number): Promise<RegistryFolder[]> {
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
        if (limit) { query += ` LIMIT $${p}`; params.push(limit); p++; }
        if (offset) { query += ` OFFSET $${p}`; params.push(offset); }
        const { rows } = await pool.query(query, params);
        return rows;
    }

    static async getHierarchy(rootId: string): Promise<{ folder: RegistryFolder; children: RegistryFolder[] }> {
        const folder = await this.findById(rootId);
        if (!folder) throw new AppError(404, 'Folder not found');
        const children = await this.getChildren(rootId);
        return { folder, children };
    }

    static async updateFolder(id: string, input: UpdateRegistryFolderInput, userId: string): Promise<RegistryFolder> {
        const folder = await this.findById(id);
        if (!folder) throw new AppError(404, 'Folder not found');
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
        if (updates.length === 0) throw new AppError(400, 'No fields to update');
        updates.push(`updated_by = $${p}`);
        values.push(userId);
        p++;
        updates.push(`updated_at = NOW()`);
        values.push(id);
        await pool.query(
            `UPDATE rhc_folders SET ${updates.join(', ')} WHERE id = $${p} AND is_active = true`,
            values
        );
        const updated = await this.findById(id);
        if (!updated) throw new AppError(500, 'Failed to update folder');
        return updated;
    }

    static async deleteFolder(id: string, userId: string): Promise<void> {
        const folder = await this.findById(id);
        if (!folder) throw new AppError(404, 'Folder not found');
        const children = await pool.query('SELECT id FROM rhc_folders WHERE parent_folder_id = $1 AND is_active = true', [id]);
        if (children.rows.length > 0) throw new AppError(400, 'Cannot delete folder with sub-folders');
        const documents = await pool.query('SELECT id FROM documents WHERE folder_id = $1 AND is_active = true', [id]);
        if (documents.rows.length > 0) throw new AppError(400, 'Cannot delete folder with documents');
        await pool.query(`UPDATE rhc_folders SET is_active = false, updated_by = $1, updated_at = NOW() WHERE id = $2`, [userId, id]);
    }

    static async getCategoriesWithCounts(): Promise<{ category: RegistryCategory; count: number }[]> {
        const { rows } = await pool.query(
            `SELECT category, COUNT(*) as count FROM rhc_folders WHERE is_active = true GROUP BY category ORDER BY count DESC`
        );
        const allCategories = Object.values(REGISTRY_CATEGORIES);
        const countsMap = new Map(rows.map((r) => [r.category, parseInt(r.count)]));
        return allCategories.map((category) => ({
            category: category as RegistryCategory,
            count: countsMap.get(category) || 0,
        }));
    }

    static async getFolderDocuments(folderId: string, limit?: number, offset?: number): Promise<FolderDocument[]> {
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
        return rows.map(row => ({
            id: row.id,
            subject: row.subject,
            ref: row.ref,
            format: row.format,
            file_url: row.file_url,
            file_public_id: null,
            created_at: row.created_at,
            updated_at: row.updated_at,
            uploaded_by: row.uploaded_by,
            uploaded_by_name: row.uploaded_by_name,
            added_at: row.created_at,
        }));
    }

    static async searchFolders(query: string): Promise<RegistryFolder[]> {
        const { rows } = await pool.query(
            `SELECT ${FOLDER_SELECT}
             FROM rhc_folders f
             LEFT JOIN users u ON f.created_by = u.id
             LEFT JOIN users u2 ON f.updated_by = u2.id
             WHERE f.is_active = true AND (f.ref_no ILIKE $1 OR f.name ILIKE $1)
             ORDER BY f.ref_no ASC LIMIT 20`,
            [`%${query}%`]
        );
        return rows;
    }

    static async getRootFolders(): Promise<RegistryFolder[]> {
        const { rows } = await pool.query(
            `SELECT ${FOLDER_SELECT}
             FROM rhc_folders f
             LEFT JOIN users u ON f.created_by = u.id
             LEFT JOIN users u2 ON f.updated_by = u2.id
             WHERE f.is_active = true AND f.parent_folder_id IS NULL
             ORDER BY f.ref_no ASC`
        );
        return rows;
    }

    static async getActiveFolders(limit?: number, offset?: number): Promise<RegistryFolder[]> {
        let query = `
            SELECT ${FOLDER_SELECT}
            FROM rhc_folders f
            LEFT JOIN users u ON f.created_by = u.id
            LEFT JOIN users u2 ON f.updated_by = u2.id
            WHERE f.is_active = true AND f.status = 'active'
            ORDER BY f.ref_no ASC
        `;
        const params: unknown[] = [];
        let p = 1;
        if (limit) { query += ` LIMIT $${p}`; params.push(limit); p++; }
        if (offset) { query += ` OFFSET $${p}`; params.push(offset); }
        const { rows } = await pool.query(query, params);
        return rows;
    }

    static async getFolderStatistics(options?: { include_document_stats?: boolean }): Promise<any> {
        const stats: any = { total_folders: 0, active_folders: 0, archived_folders: 0, closed_folders: 0, by_category: {} };
        const { rows: countRows } = await pool.query(`SELECT status, COUNT(*) as count FROM rhc_folders WHERE is_active = true GROUP BY status`);
        countRows.forEach((row: any) => {
            stats[`${row.status}_folders`] = parseInt(row.count);
            stats.total_folders += parseInt(row.count);
        });
        const { rows: categoryRows } = await pool.query(`SELECT category, COUNT(*) as count FROM rhc_folders WHERE is_active = true GROUP BY category`);
        categoryRows.forEach((row: any) => {
            stats.by_category[row.category] = parseInt(row.count);
        });
        if (options?.include_document_stats) {
            const { rows: docRows } = await pool.query(
                `SELECT COUNT(*) as total_documents, COUNT(DISTINCT folder_id) as folders_with_documents
                 FROM documents WHERE is_active = true AND folder_id IS NOT NULL`
            );
            stats.total_documents = parseInt(docRows[0].total_documents);
            stats.folders_with_documents = parseInt(docRows[0].folders_with_documents);
        }
        return stats;
    }

    static async moveFolder(id: string, newParentId: string | null, userId: string): Promise<RegistryFolder> {
        const folder = await this.findById(id);
        if (!folder) throw new AppError(404, 'Folder not found');
        if (newParentId) {
            let currentId = newParentId;
            let depth = 0;
            while (currentId && depth < 100) {
                if (currentId === id) throw new AppError(400, 'Cannot move a folder into itself or its descendant');
                const parent = await pool.query('SELECT parent_folder_id FROM rhc_folders WHERE id = $1 AND is_active = true', [currentId]);
                if (parent.rows.length === 0) break;
                currentId = parent.rows[0].parent_folder_id;
                depth++;
            }
            const parent = await this.findById(newParentId);
            if (!parent) throw new AppError(404, 'Parent folder not found');
        }
        await pool.query(`UPDATE rhc_folders SET parent_folder_id = $1, updated_by = $2, updated_at = NOW() WHERE id = $3 AND is_active = true`, [newParentId || null, userId, id]);
        const updated = await this.findById(id);
        if (!updated) throw new AppError(500, 'Failed to move folder');
        return updated;
    }

    static async addDocumentToFolder(folderId: string, documentId: string, userId: string): Promise<FolderDocument> {
        const folder = await this.findById(folderId);
        if (!folder) throw new AppError(404, 'Folder not found');
        const { rows: docCheck } = await pool.query(
            `SELECT d.id, d.title, d.reference_no, d.file_url, d.mime_type, d.created_at
             FROM documents d WHERE d.id = $1 AND d.is_active = true`,
            [documentId]
        );
        if (!docCheck.length) throw new AppError(404, 'Document not found');
        const document = docCheck[0];
        if (document.folder_id) throw new AppError(409, 'Document is already in a folder');
        await pool.query(`UPDATE documents SET folder_id = $1, updated_by = $2, updated_at = NOW() WHERE id = $3`, [folderId, userId, documentId]);
        return {
            id: document.id,
            subject: document.title,
            ref: document.reference_no,
            format: document.mime_type || 'unknown',
            file_url: document.file_url,
            file_public_id: null,
            created_at: document.created_at,
            updated_at: new Date().toISOString(),
            uploaded_by: userId,
            uploaded_by_name: null,
            added_at: new Date().toISOString(),
        };
    }

    static async removeDocumentFromFolder(folderId: string, documentId: string, userId: string): Promise<void> {
        const folder = await this.findById(folderId);
        if (!folder) throw new AppError(404, 'Folder not found');
        const { rows: docCheck } = await pool.query(
            `SELECT id FROM documents WHERE id = $1 AND folder_id = $2 AND is_active = true`,
            [documentId, folderId]
        );
        if (!docCheck.length) throw new AppError(404, 'Document not found in this folder');
        await pool.query(`UPDATE documents SET folder_id = NULL, updated_by = $1, updated_at = NOW() WHERE id = $2`, [userId, documentId]);
    }

    static async bulkAddDocumentsToFolder(folderId: string, documentIds: string[], userId: string): Promise<BulkAddDocumentsResult> {
        const folder = await this.findById(folderId);
        if (!folder) throw new AppError(404, 'Folder not found');
        const results: BulkAddDocumentsResult = { added: 0, failed: 0, errors: [] };
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            for (const documentId of documentIds) {
                try {
                    const { rows: docCheck } = await client.query(
                        `SELECT id FROM documents WHERE id = $1 AND is_active = true AND folder_id IS NULL`,
                        [documentId]
                    );
                    if (!docCheck.length) {
                        results.failed++;
                        results.errors?.push(`Document ${documentId} not found or already in a folder`);
                        continue;
                    }
                    await client.query(`UPDATE documents SET folder_id = $1, updated_by = $2, updated_at = NOW() WHERE id = $3`, [folderId, userId, documentId]);
                    results.added++;
                } catch (err) {
                    results.failed++;
                    results.errors?.push(`Failed to add document ${documentId}: ${err}`);
                }
            }
            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
        return results;
    }

    static async moveDocumentToFolder(sourceFolderId: string, documentId: string, targetFolderId: string, userId: string): Promise<MoveDocumentResult> {
        const sourceFolder = await this.findById(sourceFolderId);
        if (!sourceFolder) throw new AppError(404, 'Source folder not found');
        const targetFolder = await this.findById(targetFolderId);
        if (!targetFolder) throw new AppError(404, 'Target folder not found');
        const { rows: docCheck } = await pool.query(
            `SELECT d.id, d.title, d.reference_no, d.file_url, d.mime_type, d.created_at
             FROM documents d WHERE d.id = $1 AND d.folder_id = $2 AND d.is_active = true`,
            [documentId, sourceFolderId]
        );
        if (!docCheck.length) throw new AppError(404, 'Document not found in source folder');
        const { rows: existing } = await pool.query(
            `SELECT id FROM documents WHERE id = $1 AND folder_id = $2 AND is_active = true`,
            [documentId, targetFolderId]
        );
        if (existing.length) throw new AppError(409, 'Document already exists in target folder');
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await client.query(`UPDATE documents SET folder_id = $1, updated_by = $2, updated_at = NOW() WHERE id = $3`, [targetFolderId, userId, documentId]);
            await client.query('COMMIT');
            const document = docCheck[0];
            const updatedSource = await this.findById(sourceFolderId);
            const updatedTarget = await this.findById(targetFolderId);
            return {
                sourceFolder: updatedSource!,
                targetFolder: updatedTarget!,
                document: {
                    id: document.id,
                    subject: document.title,
                    ref: document.reference_no,
                    format: document.mime_type || 'unknown',
                    file_url: document.file_url,
                    file_public_id: null,
                    created_at: document.created_at,
                    updated_at: new Date().toISOString(),
                    uploaded_by: userId,
                    uploaded_by_name: null,
                    added_at: new Date().toISOString(),
                }
            };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }
}