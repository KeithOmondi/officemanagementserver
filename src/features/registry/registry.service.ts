// src/features/registry/registry.service.ts
import { pool } from '../../config/db';
import { AppError } from '../../utils/response';
import type {
  RegistryEntry,
  RegistryPaginationResponse,
  StationWithFileCount,
} from './registry.types';
import type {
  RouteFileInput,
  ReturnFileInput,
  RegistryFilters,
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

const ALLOWED_SORT = new Set(['routed_at', 'received_at', 'created_at']);

// ── Service ───────────────────────────────────────────────────────────────────

export class RegistryService {

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
         VALUES ($1,$2,$3,$4,$5,'in_transit', true)
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
    if (entry.status !== 'in_transit') {
      throw new AppError(409, `Cannot receive a file with status "${entry.status}"`);
    }

    await pool.query(
      `UPDATE document_registry
       SET status = 'received', received_at = NOW(), received_by = $1
       WHERE id = $2`,
      [receivedBy, id]
    );
    return (await this.findById(id))!;
  }

  // ── Mark filed (closed out at the station, stays on record there) ────────────

  static async markFiled(id: string): Promise<RegistryEntry> {
    const entry = await this.findById(id);
    if (!entry) throw new AppError(404, 'Registry entry not found');
    if (entry.status !== 'received') {
      throw new AppError(409, 'A file must be received before it can be marked filed');
    }

    await pool.query(
      `UPDATE document_registry SET status = 'filed' WHERE id = $1`,
      [id]
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
       SET status = 'returned', is_active = false, note = $1
       WHERE id = $2`,
      [combinedNote, id]
    );
    return (await this.findById(id))!;
  }

  // ── Station file counts (for the registry dashboard grid) ────────────────────

  static async getStationFileCounts(): Promise<StationWithFileCount[]> {
    const { rows } = await pool.query(
      `SELECT s.id, s.name, s.type, s.location, s.is_active,
              COUNT(reg.id) FILTER (WHERE reg.is_active = true) AS file_count
       FROM stations s
       LEFT JOIN document_registry reg ON reg.station_id = s.id
       GROUP BY s.id, s.name, s.type, s.location, s.is_active
       ORDER BY s.name ASC`
    );
    return rows.map((r) => ({ ...r, file_count: parseInt(r.file_count, 10) }));
  }
}