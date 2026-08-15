// src/features/registry/registry.service.ts
import { pool } from '../../config/db';
import { AppError } from '../../utils/response';
import type {
  RegistryEntry,
  RegistryPaginationResponse,
  StationWithFileCount,
  RHCFolder,
  FolderDocument,
  FolderStatistics,
  FolderHierarchy,
  FolderCategoryCount,
  BulkAddDocumentsResult,
  FolderRegistryEntry,
  FolderRegistryPaginationResponse,
} from './registry.types';
import type {
  RouteFileInput,
  ReturnFileInput,
  RegistryFilters,
  CreateFolderInput,
  UpdateFolderInput,
  MoveFolderInput,
  AddDocumentToFolderInput,
  BulkAddDocumentsInput,
  GetStationFolderDocumentsQuery,
} from './registry.validator';

// ── SELECT fragments ──────────────────────────────────────────────────────────

const REGISTRY_SELECT = `
  reg.id, reg.document_id,
  d.title         AS document_title,
  d.reference_no  AS document_ref_no,
  reg.station_id,
  s.name          AS station_name,
  s.type          AS station_type,
  reg.routed_by,
  rb.full_name    AS routed_by_name,
  reg.priority, reg.note, reg.status,
  reg.routed_at, reg.received_at,
  reg.received_by,
  rcv.full_name   AS received_by_name,
  reg.is_active, reg.created_at
`;

const REGISTRY_JOIN = `
  FROM document_registry reg
  JOIN documents d     ON d.id  = reg.document_id
  JOIN stations  s     ON s.id  = reg.station_id
  JOIN users     rb    ON rb.id = reg.routed_by
  LEFT JOIN users rcv  ON rcv.id = reg.received_by
`;

const FOLDER_SELECT = `
  f.id, f.ref_no, f.name, f.category, f.description,
  f.status, f.parent_folder_id, f.created_at, f.updated_at,
  (SELECT COUNT(*) FROM folders WHERE parent_folder_id = f.id AND status = 'active') AS sub_folder_count,
  (SELECT COUNT(*) FROM folder_documents fd WHERE fd.folder_id = f.id) AS document_count
`;

const ALLOWED_SORT = new Set(['routed_at', 'received_at', 'created_at']);

// ── Service ───────────────────────────────────────────────────────────────────

export class RegistryService {

  // ═══════════════════════════════════════════════════════════════════════════
  //  REGISTRY ENTRY OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Route a document to a station ───────────────────────────────────────────

  static async routeFile(input: RouteFileInput, routedBy: string): Promise<RegistryEntry> {
    const { rows: docCheck } = await pool.query(
      `SELECT id FROM documents WHERE id = $1 AND is_active = true`,
      [input.document_id]
    );
    if (!docCheck.length) throw new AppError(404, 'Document not found');

    const { rows: stationCheck } = await pool.query(
      `SELECT id FROM stations WHERE id = $1 AND is_active = true`,
      [input.station_id]
    );
    if (!stationCheck.length) throw new AppError(404, 'Station not found or inactive');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // A document only lives in one place at a time — close out whatever
      // active entry it currently has before opening a new one.
      await client.query(
        `UPDATE document_registry SET is_active = false
         WHERE document_id = $1 AND is_active = true`,
        [input.document_id]
      );

      const { rows } = await client.query(
        `INSERT INTO document_registry
           (document_id, station_id, routed_by, priority, note, status, is_active)
         VALUES ($1,$2,$3,$4,$5,'active', true)
         RETURNING id`,
        [
          input.document_id,
          input.station_id,
          routedBy,
          input.priority,
          input.note ?? null,
        ]
      );

      await client.query('COMMIT');
      return (await this.findById(rows[0].id))!;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // ── Find all (paginated) ──────────────────────────────────────────────────────

  static async findAll(filters: RegistryFilters): Promise<RegistryPaginationResponse> {
    const {
      document_id, station_id, status, priority,
      page = 1, limit = 20,
      sort_by = 'routed_at', sort_order = 'DESC',
    } = filters;

    const sortCol = ALLOWED_SORT.has(sort_by ?? '') ? `reg.${sort_by}` : 'reg.routed_at';
    const sortDir = sort_order === 'ASC' ? 'ASC' : 'DESC';
    const offset  = (page - 1) * limit;

    const conditions: string[] = ['1=1'];
    const values: unknown[] = [];
    let p = 1;

    if (document_id) { conditions.push(`reg.document_id = $${p}`); values.push(document_id); p++; }
    if (station_id)  { conditions.push(`reg.station_id = $${p}`);  values.push(station_id);  p++; }
    if (status)       { conditions.push(`reg.status = $${p}`);     values.push(status);      p++; }
    if (priority)     { conditions.push(`reg.priority = $${p}`);   values.push(priority);    p++; }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const [countResult, dataResult] = await Promise.all([
      pool.query(`SELECT COUNT(*) AS total ${REGISTRY_JOIN} ${where}`, values),
      pool.query(
        `SELECT ${REGISTRY_SELECT} ${REGISTRY_JOIN} ${where}
         ORDER BY ${sortCol} ${sortDir}
         LIMIT $${p} OFFSET $${p + 1}`,
        [...values, limit, offset]
      ),
    ]);

    const total = parseInt(countResult.rows[0]?.total ?? '0', 10);
    return {
      data: dataResult.rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ── Find single ────────────────────────────────────────────────────────────────

  static async findById(id: string): Promise<RegistryEntry | null> {
    const { rows } = await pool.query(
      `SELECT ${REGISTRY_SELECT} ${REGISTRY_JOIN} WHERE reg.id = $1`,
      [id]
    );
    return rows[0] ?? null;
  }

  // ── Full routing history for one document ────────────────────────────────────

  static async getHistoryForDocument(documentId: string): Promise<RegistryEntry[]> {
    const { rows } = await pool.query(
      `SELECT ${REGISTRY_SELECT} ${REGISTRY_JOIN}
       WHERE reg.document_id = $1
       ORDER BY reg.routed_at DESC`,
      [documentId]
    );
    return rows;
  }

  static async getActiveForDocument(documentId: string): Promise<RegistryEntry | null> {
    const { rows } = await pool.query(
      `SELECT ${REGISTRY_SELECT} ${REGISTRY_JOIN}
       WHERE reg.document_id = $1 AND reg.is_active = true`,
      [documentId]
    );
    return rows[0] ?? null;
  }

  // ── Receive (station acknowledges the file arrived) ──────────────────────────

  static async receiveFile(id: string, receivedBy: string): Promise<RegistryEntry> {
    const entry = await this.findById(id);
    if (!entry) throw new AppError(404, 'Registry entry not found');
    if (entry.status !== 'active') {
      throw new AppError(409, `Cannot receive a file with status "${entry.status}"`);
    }

    await pool.query(
      `UPDATE document_registry
       SET received_at = NOW(), received_by = $1
       WHERE id = $2`,
      [receivedBy, id]
    );
    return (await this.findById(id))!;
  }

  // ── Return to registry (file leaves the station) ──────────────────────────────

  static async returnFile(id: string, input: ReturnFileInput): Promise<RegistryEntry> {
    const entry = await this.findById(id);
    if (!entry) throw new AppError(404, 'Registry entry not found');
    if (entry.status === 'returned') {
      throw new AppError(409, 'This file has already been returned');
    }

    const combinedNote = input.note
      ? `${entry.note ? entry.note + '\n' : ''}[Returned] ${input.note}`
      : entry.note;

    await pool.query(
      `UPDATE document_registry
       SET status = 'returned', is_active = false, note = $1, received_at = NOW()
       WHERE id = $2`,
      [combinedNote, id]
    );
    return (await this.findById(id))!;
  }

  // ── Station file counts (for the registry dashboard grid) ────────────────────

  static async getStationFileCounts(): Promise<StationWithFileCount[]> {
    const { rows } = await pool.query(
      `SELECT s.id, s.ref_no, s.name, s.type, s.location, s.is_active,
              COUNT(reg.id) FILTER (WHERE reg.is_active = true) AS file_count
       FROM stations s
       LEFT JOIN document_registry reg ON reg.station_id = s.id
       GROUP BY s.id, s.ref_no, s.name, s.type, s.location, s.is_active
       ORDER BY s.ref_no ASC NULLS LAST, s.name ASC`
    );
    return rows.map((r) => ({ 
      ...r, 
      file_count: parseInt(r.file_count, 10),
      ref_no: r.ref_no || null 
    }));
  }

  // ── Get Folder Documents for a Station ─────────────────────────────────────

// ── Get Folder Documents for a Station ─────────────────────────────────────

static async getStationFolderDocuments(
    stationId: string,
    filters: { page?: number; limit?: number } = {}
): Promise<{ data: any[]; total: number; page: number; limit: number; totalPages: number }> {
    const { page = 1, limit = 20 } = filters;
    const offset = (page - 1) * limit;

    // First, find the folder that belongs to this station
    const { rows: station } = await pool.query(
        `SELECT id, ref_no, name FROM stations WHERE id = $1 AND is_active = true`,
        [stationId]
    );

    if (!station.length) {
        throw new AppError(404, 'Station not found');
    }

    // Find folder that matches this station (by ref_no or name)
    const stationRef = station[0].ref_no;
    const stationName = station[0].name;

    let folderQuery = `
        SELECT id, ref_no, name FROM rhc_folders 
        WHERE is_active = true 
    `;
    const folderParams: unknown[] = [];
    let p = 1;

    if (stationRef) {
        folderQuery += ` AND (ref_no = $${p} OR ref_no ILIKE $${p})`;
        folderParams.push(stationRef);
        p++;
    }

    if (stationName) {
        if (stationRef) {
            folderQuery += ` OR name ILIKE $${p}`;
        } else {
            folderQuery += ` AND name ILIKE $${p}`;
        }
        folderParams.push(`%${stationName}%`);
        p++;
    }

    folderQuery += ` LIMIT 1`;

    const { rows: folders } = await pool.query(folderQuery, folderParams);

    if (!folders.length) {
        return {
            data: [],
            total: 0,
            page,
            limit,
            totalPages: 0,
        };
    }

    const folder = folders[0];

    // Now get documents from this folder
    const countQuery = `
        SELECT COUNT(*) as total
        FROM documents d
        WHERE d.folder_id = $1 AND d.is_active = true
    `;

    const countResult = await pool.query(countQuery, [folder.id]);
    const total = parseInt(countResult.rows[0]?.total ?? '0', 10);

    const dataQuery = `
        SELECT 
            d.id AS id,
            d.id AS document_id,
            d.title AS document_title,
            d.reference_no AS document_ref_no,
            $1::uuid AS station_id,
            $2::text AS station_name,
            s.type AS station_type,
            $3::uuid AS folder_id,
            $4::text AS folder_ref_no,
            $5::text AS folder_name,
            true AS is_folder_document,
            d.created_at
        FROM documents d
        CROSS JOIN stations s
        WHERE d.folder_id = $1 
            AND d.is_active = true
            AND s.id = $6
        ORDER BY d.created_at DESC
        LIMIT $7 OFFSET $8
    `;

    const { rows: documents } = await pool.query(dataQuery, [
        folder.id,
        station[0].name,
        folder.id,
        folder.ref_no,
        folder.name,
        stationId,
        limit,
        offset,
    ]);

    return {
        data: documents,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
    };
}

  // ═══════════════════════════════════════════════════════════════════════════
  //  FOLDER/COURT RECORD OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Create Folder ────────────────────────────────────────────────────────────

  static async createFolder(input: CreateFolderInput): Promise<RHCFolder> {
    // Check if ref_no already exists
    const { rows: existing } = await pool.query(
      `SELECT id FROM folders WHERE ref_no = $1`,
      [input.ref_no]
    );
    if (existing.length) {
      throw new AppError(409, `Folder with reference ${input.ref_no} already exists`);
    }

    // If parent_folder_id is provided, verify it exists
    if (input.parent_folder_id) {
      const { rows: parent } = await pool.query(
        `SELECT id, status FROM folders WHERE id = $1`,
        [input.parent_folder_id]
      );
      if (!parent.length) {
        throw new AppError(404, 'Parent folder not found');
      }
      if (parent[0].status === 'archived') {
        throw new AppError(409, 'Cannot add sub-folder to an archived folder');
      }
    }

    const { rows } = await pool.query(
      `INSERT INTO folders
         (ref_no, name, category, description, status, parent_folder_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        input.ref_no,
        input.name,
        input.category,
        input.description ?? null,
        input.status ?? 'active',
        input.parent_folder_id ?? null,
      ]
    );

    return rows[0];
  }

  // ── Get All Folders ──────────────────────────────────────────────────────────

  static async getAllFolders(options: {
    category?: string;
    status?: 'active' | 'archived';
    search?: string;
    include_sub_folders?: boolean;
  } = {}): Promise<RHCFolder[]> {
    const { category, status, search, include_sub_folders = true } = options;

    let query = `
      SELECT ${FOLDER_SELECT}
      FROM folders f
      WHERE 1=1
    `;
    const values: unknown[] = [];
    let p = 1;

    if (category) {
      query += ` AND f.category = $${p}`;
      values.push(category);
      p++;
    }

    if (status) {
      query += ` AND f.status = $${p}`;
      values.push(status);
      p++;
    }

    if (search) {
      query += ` AND (f.ref_no ILIKE $${p} OR f.name ILIKE $${p})`;
      values.push(`%${search}%`);
      p++;
    }

    if (!include_sub_folders) {
      query += ` AND f.parent_folder_id IS NULL`;
    }

    query += ` ORDER BY f.ref_no ASC`;

    const { rows } = await pool.query(query, values);
    return rows;
  }

  // ── Get Root Folders ─────────────────────────────────────────────────────────

  static async getRootFolders(): Promise<RHCFolder[]> {
    const { rows } = await pool.query(
      `SELECT ${FOLDER_SELECT}
       FROM folders f
       WHERE f.parent_folder_id IS NULL
       ORDER BY f.ref_no ASC`
    );
    return rows;
  }

  // ── Get Active Folders ──────────────────────────────────────────────────────

  static async getActiveFolders(): Promise<RHCFolder[]> {
    const { rows } = await pool.query(
      `SELECT ${FOLDER_SELECT}
       FROM folders f
       WHERE f.status = 'active'
       ORDER BY f.ref_no ASC`
    );
    return rows;
  }

  // ── Get Folder By ID ────────────────────────────────────────────────────────

  static async getFolderById(id: string): Promise<RHCFolder | null> {
    const { rows } = await pool.query(
      `SELECT ${FOLDER_SELECT}
       FROM folders f
       WHERE f.id = $1`,
      [id]
    );
    return rows[0] ?? null;
  }

  // ── Get Folder Children ─────────────────────────────────────────────────────

  static async getFolderChildren(folderId: string): Promise<RHCFolder[]> {
    const { rows } = await pool.query(
      `SELECT ${FOLDER_SELECT}
       FROM folders f
       WHERE f.parent_folder_id = $1
       ORDER BY f.ref_no ASC`,
      [folderId]
    );
    return rows;
  }

  // ── Get Folder Hierarchy ────────────────────────────────────────────────────

  static async getFolderHierarchy(folderId: string): Promise<FolderHierarchy> {
    const folder = await this.getFolderById(folderId);
    if (!folder) {
      throw new AppError(404, 'Folder not found');
    }

    const children = await this.getFolderChildren(folderId);
    
    // Get parent chain
    const parentChain: RHCFolder[] = [];
    let currentParentId = folder.parent_folder_id;
    while (currentParentId) {
      const parent = await this.getFolderById(currentParentId);
      if (parent) {
        parentChain.unshift(parent);
        currentParentId = parent.parent_folder_id;
      } else {
        break;
      }
    }

    return {
      ...folder,
      parent_chain: parentChain,
      children,
    };
  }

  // ── Update Folder ────────────────────────────────────────────────────────────

  static async updateFolder(id: string, input: UpdateFolderInput): Promise<RHCFolder> {
    const folder = await this.getFolderById(id);
    if (!folder) {
      throw new AppError(404, 'Folder not found');
    }

    const updates: string[] = [];
    const values: unknown[] = [];
    let p = 1;

    if (input.name !== undefined) {
      updates.push(`name = $${p}`);
      values.push(input.name);
      p++;
    }

    if (input.description !== undefined) {
      updates.push(`description = $${p}`);
      values.push(input.description);
      p++;
    }

    if (input.status !== undefined) {
      updates.push(`status = $${p}`);
      values.push(input.status);
      p++;
    }

    if (updates.length === 0) {
      return folder;
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const { rows } = await pool.query(
      `UPDATE folders
       SET ${updates.join(', ')}
       WHERE id = $${p}
       RETURNING *`,
      values
    );

    return rows[0];
  }

  // ── Delete Folder ────────────────────────────────────────────────────────────

  static async deleteFolder(id: string): Promise<void> {
    const folder = await this.getFolderById(id);
    if (!folder) {
      throw new AppError(404, 'Folder not found');
    }

    // Check if folder has sub-folders
    const { rows: children } = await pool.query(
      `SELECT COUNT(*) FROM folders WHERE parent_folder_id = $1`,
      [id]
    );
    if (parseInt(children[0].count, 10) > 0) {
      throw new AppError(409, 'Cannot delete folder with sub-folders');
    }

    // Check if folder has documents
    const { rows: documents } = await pool.query(
      `SELECT COUNT(*) FROM folder_documents WHERE folder_id = $1`,
      [id]
    );
    if (parseInt(documents[0].count, 10) > 0) {
      throw new AppError(409, 'Cannot delete folder with documents');
    }

    await pool.query(
      `DELETE FROM folders WHERE id = $1`,
      [id]
    );
  }

  // ── Search Folders ───────────────────────────────────────────────────────────

  static async searchFolders(query: string): Promise<RHCFolder[]> {
    const { rows } = await pool.query(
      `SELECT ${FOLDER_SELECT}
       FROM folders f
       WHERE f.ref_no ILIKE $1 OR f.name ILIKE $1
       ORDER BY 
         CASE 
           WHEN f.ref_no ILIKE $2 THEN 1
           WHEN f.name ILIKE $2 THEN 2
           ELSE 3
         END,
         f.ref_no ASC
       LIMIT 50`,
      [`%${query}%`, `${query}%`]
    );
    return rows;
  }

  // ── Get Folder Categories ───────────────────────────────────────────────────

  static async getFolderCategories(): Promise<FolderCategoryCount[]> {
    const { rows } = await pool.query(
      `SELECT category, COUNT(*) as count
       FROM folders
       WHERE status = 'active'
       GROUP BY category
       ORDER BY category`
    );
    return rows;
  }

  // ── Get Folder Documents ────────────────────────────────────────────────────

  static async getFolderDocuments(folderId: string): Promise<FolderDocument[]> {
    // Verify folder exists
    const folder = await this.getFolderById(folderId);
    if (!folder) {
      throw new AppError(404, 'Folder not found');
    }

    const { rows } = await pool.query(
      `SELECT 
         d.id, d.title, d.reference_no as ref, d.format, 
         d.file_url, d.created_at, d.file_public_id,
         fd.added_at
       FROM folder_documents fd
       JOIN documents d ON d.id = fd.document_id
       WHERE fd.folder_id = $1
       ORDER BY fd.added_at DESC`,
      [folderId]
    );
    return rows;
  }

  // ── Add Document to Folder ──────────────────────────────────────────────────

  static async addDocumentToFolder(folderId: string, documentId: string): Promise<void> {
    // Verify folder exists
    const folder = await this.getFolderById(folderId);
    if (!folder) {
      throw new AppError(404, 'Folder not found');
    }

    // Verify document exists
    const { rows: doc } = await pool.query(
      `SELECT id FROM documents WHERE id = $1 AND is_active = true`,
      [documentId]
    );
    if (!doc.length) {
      throw new AppError(404, 'Document not found');
    }

    // Check if already in folder
    const { rows: existing } = await pool.query(
      `SELECT id FROM folder_documents WHERE folder_id = $1 AND document_id = $2`,
      [folderId, documentId]
    );
    if (existing.length) {
      throw new AppError(409, 'Document already in this folder');
    }

    await pool.query(
      `INSERT INTO folder_documents (folder_id, document_id)
       VALUES ($1, $2)`,
      [folderId, documentId]
    );
  }

  // ── Remove Document from Folder ─────────────────────────────────────────────

  static async removeDocumentFromFolder(folderId: string, documentId: string): Promise<void> {
    const { rows } = await pool.query(
      `DELETE FROM folder_documents
       WHERE folder_id = $1 AND document_id = $2
       RETURNING id`,
      [folderId, documentId]
    );
    if (!rows.length) {
      throw new AppError(404, 'Document not found in this folder');
    }
  }

  // ── Get Folder Statistics ───────────────────────────────────────────────────

  static async getFolderStatistics(): Promise<FolderStatistics> {
    const [totalResult, activeResult, archivedResult, categoryResult] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM folders`),
      pool.query(`SELECT COUNT(*) FROM folders WHERE status = 'active'`),
      pool.query(`SELECT COUNT(*) FROM folders WHERE status = 'archived'`),
      pool.query(
        `SELECT category, COUNT(*) as count
         FROM folders
         GROUP BY category
         ORDER BY count DESC`
      ),
    ]);

    return {
      total: parseInt(totalResult.rows[0].count, 10),
      active: parseInt(activeResult.rows[0].count, 10),
      archived: parseInt(archivedResult.rows[0].count, 10),
      byCategory: categoryResult.rows,
    };
  }

  // ── Bulk Add Documents to Folder ────────────────────────────────────────────

  static async bulkAddDocumentsToFolder(folderId: string, documentIds: string[]): Promise<BulkAddDocumentsResult> {
    const folder = await this.getFolderById(folderId);
    if (!folder) {
      throw new AppError(404, 'Folder not found');
    }

    const results: BulkAddDocumentsResult = {
      added: 0,
      skipped: 0,
      errors: [],
    };

    for (const docId of documentIds) {
      try {
        await this.addDocumentToFolder(folderId, docId);
        results.added++;
      } catch (err) {
        if (err instanceof AppError && err.message === 'Document already in this folder') {
          results.skipped++;
        } else {
          results.errors.push(`Document ${docId}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }
    }

    return results;
  }

  // ── Move Folder ──────────────────────────────────────────────────────────────

  static async moveFolder(folderId: string, newParentId: string | null): Promise<RHCFolder> {
    const folder = await this.getFolderById(folderId);
    if (!folder) {
      throw new AppError(404, 'Folder not found');
    }

    // Check for circular reference
    if (newParentId) {
      if (newParentId === folderId) {
        throw new AppError(409, 'Folder cannot be its own parent');
      }

      // Check if new parent is a descendant of this folder
      let currentId: string | null = newParentId;
      while (currentId) {
        const parent = await this.getFolderById(currentId);
        if (!parent) break;
        if (parent.parent_folder_id === folderId) {
          throw new AppError(409, 'Cannot move folder into its own descendant');
        }
        currentId = parent.parent_folder_id;
      }

      // Verify new parent exists and is active
      const { rows: parent } = await pool.query(
        `SELECT id, status FROM folders WHERE id = $1`,
        [newParentId]
      );
      if (!parent.length) {
        throw new AppError(404, 'Parent folder not found');
      }
      if (parent[0].status === 'archived') {
        throw new AppError(409, 'Cannot move folder into an archived folder');
      }
    }

    const { rows } = await pool.query(
      `UPDATE folders
       SET parent_folder_id = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [newParentId, folderId]
    );

    return rows[0];
  }
}