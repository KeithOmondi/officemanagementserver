// src/features/external-links/external-links.service.ts

import { pool } from '../../config/db';
import { AppError } from '../../utils/response';
import type {
    ExternalLink,
    ExternalLinkCategory,
    LinkStats,
    CreateLinkInput,
    UpdateLinkInput,
    CreateCategoryInput,
    UpdateCategoryInput,
    LinkFilters,
} from './links.types';

const LINK_SELECT = `
    l.id, l.category_id, l.name, l.description, l.url, 
    l.icon_name, l.color, l.tags, l.is_featured, l.sort_order, l.is_active,
    l.click_count, l.last_clicked_at, l.created_by, l.created_at, l.updated_at,
    jsonb_build_object(
        'id', c.id,
        'name', c.name,
        'emoji', c.emoji,
        'description', c.description,
        'sort_order', c.sort_order,
        'is_active', c.is_active,
        'created_at', c.created_at,
        'updated_at', c.updated_at
    ) as category
`;

export class ExternalLinksService {

    // ─── Categories ──────────────────────────────────────────────────────────

    static async getCategories(
        includeInactive: boolean = false,
        includeCounts: boolean = false
    ): Promise<ExternalLinkCategory[]> {
        let query = `
            SELECT c.* ${includeCounts ? ', COUNT(l.id) as link_count' : ''}
            FROM external_link_categories c
            ${includeCounts ? 'LEFT JOIN external_links l ON l.category_id = c.id AND l.is_active = true' : ''}
            WHERE 1=1
            ${!includeInactive ? 'AND c.is_active = true' : ''}
            GROUP BY c.id
            ORDER BY c.sort_order ASC, c.name ASC
        `;

        const { rows } = await pool.query(query);
        return rows;
    }

    static async getCategoryById(id: string): Promise<ExternalLinkCategory | null> {
        const { rows } = await pool.query(
            `SELECT * FROM external_link_categories WHERE id = $1`,
            [id]
        );
        return rows[0] || null;
    }

    static async createCategory(input: CreateCategoryInput): Promise<ExternalLinkCategory> {
        const { rows } = await pool.query(
            `INSERT INTO external_link_categories (name, emoji, description, sort_order, is_active)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [input.name, input.emoji || null, input.description || null, input.sort_order || 0, input.is_active ?? true]
        );
        return rows[0];
    }

    static async updateCategory(
        id: string,
        input: UpdateCategoryInput
    ): Promise<ExternalLinkCategory> {
        const updates: string[] = [];
        const values: unknown[] = [];
        let paramCount = 1;

        if (input.name !== undefined) {
            updates.push(`name = $${paramCount++}`);
            values.push(input.name);
        }
        if (input.emoji !== undefined) {
            updates.push(`emoji = $${paramCount++}`);
            values.push(input.emoji);
        }
        if (input.description !== undefined) {
            updates.push(`description = $${paramCount++}`);
            values.push(input.description);
        }
        if (input.sort_order !== undefined) {
            updates.push(`sort_order = $${paramCount++}`);
            values.push(input.sort_order);
        }
        if (input.is_active !== undefined) {
            updates.push(`is_active = $${paramCount++}`);
            values.push(input.is_active);
        }

        if (updates.length === 0) {
            throw new AppError(400, 'No fields to update');
        }

        values.push(id);

        const { rows } = await pool.query(
            `UPDATE external_link_categories
             SET ${updates.join(', ')}, updated_at = NOW()
             WHERE id = $${paramCount}
             RETURNING *`,
            values
        );

        if (rows.length === 0) {
            throw new AppError(404, 'Category not found');
        }

        return rows[0];
    }

    static async deleteCategory(id: string): Promise<void> {
        const { rowCount } = await pool.query(
            `DELETE FROM external_link_categories WHERE id = $1`,
            [id]
        );
        if (rowCount === 0) {
            throw new AppError(404, 'Category not found');
        }
    }

    // ─── Links ──────────────────────────────────────────────────────────────

    static async getLinks(
        filters: LinkFilters = {}
    ): Promise<{ links: ExternalLink[]; total: number }> {
        let query = `
            SELECT ${LINK_SELECT}
            FROM external_links l
            LEFT JOIN external_link_categories c ON c.id = l.category_id
            WHERE 1=1
        `;
        const params: unknown[] = [];
        let paramCount = 1;

        if (filters.category_id) {
            query += ` AND l.category_id = $${paramCount++}`;
            params.push(filters.category_id);
        }

        if (filters.is_active !== undefined) {
            query += ` AND l.is_active = $${paramCount++}`;
            params.push(filters.is_active);
        }

        if (filters.is_featured !== undefined) {
            query += ` AND l.is_featured = $${paramCount++}`;
            params.push(filters.is_featured);
        }

        if (filters.tags && filters.tags.length > 0) {
            query += ` AND l.tags && $${paramCount++}`;
            params.push(filters.tags);
        }

        if (filters.search) {
            query += ` AND (l.name ILIKE $${paramCount} OR l.description ILIKE $${paramCount})`;
            params.push(`%${filters.search}%`);
            paramCount++;
        }

        // Get total count
        const countQuery = query.replace(
            `SELECT ${LINK_SELECT}`,
            'SELECT COUNT(*) as total'
        );
        const { rows: countRows } = await pool.query(
            countQuery,
            params.slice(0, paramCount - 1)
        );
        const total = parseInt(countRows[0]?.total || '0');

        // Order and pagination
        query += ` ORDER BY l.is_featured DESC, l.sort_order ASC, l.name ASC`;

        if (filters.limit) {
            query += ` LIMIT $${paramCount++}`;
            params.push(filters.limit);
        }
        if (filters.offset) {
            query += ` OFFSET $${paramCount++}`;
            params.push(filters.offset);
        }

        const { rows } = await pool.query(query, params);
        return { links: rows, total };
    }

    static async getLinkById(id: string): Promise<ExternalLink | null> {
        const { rows } = await pool.query(
            `SELECT ${LINK_SELECT}
             FROM external_links l
             LEFT JOIN external_link_categories c ON c.id = l.category_id
             WHERE l.id = $1`,
            [id]
        );
        return rows[0] || null;
    }

    static async createLink(
        input: CreateLinkInput,
        userId?: string
    ): Promise<ExternalLink> {
        const { rows } = await pool.query(
            `INSERT INTO external_links (
                category_id, name, description, url, icon_name, color, tags,
                is_featured, sort_order, is_active, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *`,
            [
                input.category_id,
                input.name,
                input.description || null,
                input.url,
                input.icon_name || null,
                input.color || 'blue',
                input.tags || [],
                input.is_featured ?? false,
                input.sort_order ?? 0,
                input.is_active ?? true,
                userId || null,
            ]
        );

        return rows[0];
    }

    static async updateLink(
        id: string,
        input: UpdateLinkInput
    ): Promise<ExternalLink> {
        const updates: string[] = [];
        const values: unknown[] = [];
        let paramCount = 1;

        if (input.category_id !== undefined) {
            updates.push(`category_id = $${paramCount++}`);
            values.push(input.category_id);
        }
        if (input.name !== undefined) {
            updates.push(`name = $${paramCount++}`);
            values.push(input.name);
        }
        if (input.description !== undefined) {
            updates.push(`description = $${paramCount++}`);
            values.push(input.description);
        }
        if (input.url !== undefined) {
            updates.push(`url = $${paramCount++}`);
            values.push(input.url);
        }
        if (input.icon_name !== undefined) {
            updates.push(`icon_name = $${paramCount++}`);
            values.push(input.icon_name);
        }
        if (input.color !== undefined) {
            updates.push(`color = $${paramCount++}`);
            values.push(input.color);
        }
        if (input.tags !== undefined) {
            updates.push(`tags = $${paramCount++}`);
            values.push(input.tags);
        }
        if (input.is_featured !== undefined) {
            updates.push(`is_featured = $${paramCount++}`);
            values.push(input.is_featured);
        }
        if (input.sort_order !== undefined) {
            updates.push(`sort_order = $${paramCount++}`);
            values.push(input.sort_order);
        }
        if (input.is_active !== undefined) {
            updates.push(`is_active = $${paramCount++}`);
            values.push(input.is_active);
        }

        if (updates.length === 0) {
            throw new AppError(400, 'No fields to update');
        }

        values.push(id);

        const { rows } = await pool.query(
            `UPDATE external_links
             SET ${updates.join(', ')}, updated_at = NOW()
             WHERE id = $${paramCount}
             RETURNING *`,
            values
        );

        if (rows.length === 0) {
            throw new AppError(404, 'Link not found');
        }

        return rows[0];
    }

    static async deleteLink(id: string): Promise<void> {
        const { rowCount } = await pool.query(
            `DELETE FROM external_links WHERE id = $1`,
            [id]
        );
        if (rowCount === 0) {
            throw new AppError(404, 'Link not found');
        }
    }

    // ─── Click Tracking ──────────────────────────────────────────────────────

    static async trackClick(
        linkId: string,
        userId?: string,
        ipAddress?: string,
        userAgent?: string,
        referer?: string
    ): Promise<void> {
        // Update click count
        await pool.query(
            `UPDATE external_links
             SET click_count = click_count + 1,
                 last_clicked_at = NOW()
             WHERE id = $1`,
            [linkId]
        );

        // Log click
        await pool.query(
            `INSERT INTO external_link_clicks (link_id, user_id, ip_address, user_agent, referer)
             VALUES ($1, $2, $3, $4, $5)`,
            [linkId, userId || null, ipAddress || null, userAgent || null, referer || null]
        );
    }

    static async getLinkStats(): Promise<LinkStats> {
        // Total links
        const { rows: totalRows } = await pool.query(
            `SELECT COUNT(*)::int as count FROM external_links WHERE is_active = true`
        );

        // Total categories
        const { rows: categoryRows } = await pool.query(
            `SELECT COUNT(*)::int as count FROM external_link_categories WHERE is_active = true`
        );

        // Total clicks
        const { rows: clickRows } = await pool.query(
            `SELECT COUNT(*)::int as count FROM external_link_clicks`
        );

        // Featured links
        const { rows: featuredRows } = await pool.query(
            `SELECT COUNT(*)::int as count FROM external_links WHERE is_featured = true AND is_active = true`
        );

        // Recent clicks (last 7 days)
        const { rows: recentRows } = await pool.query(`
            SELECT DATE(clicked_at) as date, COUNT(*)::int as count
            FROM external_link_clicks
            WHERE clicked_at >= NOW() - INTERVAL '7 days'
            GROUP BY DATE(clicked_at)
            ORDER BY date ASC
        `);

        // Top links
        const { rows: topRows } = await pool.query(`
            SELECT id, name, click_count
            FROM external_links
            WHERE is_active = true
            ORDER BY click_count DESC
            LIMIT 5
        `);

        return {
            total_links: totalRows[0]?.count || 0,
            total_categories: categoryRows[0]?.count || 0,
            total_clicks: clickRows[0]?.count || 0,
            featured_links: featuredRows[0]?.count || 0,
            recent_clicks: recentRows,
            top_links: topRows,
        };
    }
}