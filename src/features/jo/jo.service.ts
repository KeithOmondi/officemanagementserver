import { pool } from '../../config/db';
import { AppError } from '../../utils/response';
import { uploadToCloudinary, deleteFromCloudinary } from '../../config/cloudinary';
import type {
  JoDocument,
  JoDocumentWithResponses,
  JoDocumentResponse,
  JoDocumentFlowEntry,
  JoDocumentPaginationResponse,
  JoDocumentStatus,
} from './jo.types';
import type {
  CreateJoDocumentInput,
  UpdateJoDocumentInput,
  SendToSuperAdminInput,
  RespondToJoDocumentInput,
  ApproveJoDocumentInput,
  RejectJoDocumentInput,
  ResubmitJoDocumentInput,
  JoDocumentFilters,
} from './jo.validator';

const JD_SELECT = `
  jd.id, jd.title, jd.file_url, jd.file_public_id, jd.file_size_bytes,
  jd.mime_type, jd.original_name, jd.status,
  jd.uploaded_by, jd.uploaded_by_name,
  jd.department_id, jd.department_name,
  jd.assigned_to, jd.assigned_to_name,
  jd.rejection_reason,
  jd.reviewed_by, jd.reviewed_by_name, jd.reviewed_at,
  jd.revision_count, jd.is_active, jd.created_at, jd.updated_at,
  (SELECT COUNT(*) FROM jo_document_responses r WHERE r.jo_document_id = jd.id) AS response_count
`;

const JD_FROM = `FROM jo_documents jd`;

const JD_RESPONSE_SELECT = `
  r.id, r.jo_document_id, r.response_number, r.responded_by,
  u.full_name AS responded_by_name,
  r.note, r.file_url, r.file_public_id, r.file_size_bytes, r.mime_type, r.original_name,
  r.created_at
`;

const JD_RESPONSE_JOIN = `
  FROM jo_document_responses r
  JOIN users u ON u.id = r.responded_by
`;

function mapRow(row: any): JoDocument {
  return {
    id: row.id,
    title: row.title,
    file_url: row.file_url,
    file_public_id: row.file_public_id,
    file_size_bytes: row.file_size_bytes,
    mime_type: row.mime_type,
    original_name: row.original_name,
    status: row.status as JoDocumentStatus,
    uploaded_by: row.uploaded_by,
    uploaded_by_name: row.uploaded_by_name,
    department_id: row.department_id,
    department_name: row.department_name,
    assigned_to: row.assigned_to,
    assigned_to_name: row.assigned_to_name,
    rejection_reason: row.rejection_reason,
    reviewed_by: row.reviewed_by,
    reviewed_by_name: row.reviewed_by_name,
    reviewed_at: row.reviewed_at,
    revision_count: row.revision_count,
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
    response_count: parseInt(row.response_count ?? '0', 10),
  };
}

async function logFlow(
  client: any,
  jo_document_id: string,
  action: string,
  actor_id: string | null,
  actor_name: string | null,
  note?: string
) {
  await client.query(
    `INSERT INTO jo_document_flow (jo_document_id, action, actor_id, actor_name, note)
     VALUES ($1, $2, $3, $4, $5)`,
    [jo_document_id, action, actor_id, actor_name, note ?? null]
  );
}

export class JoService {

  // ── Create (upload, draft or send-immediately) ────────────────────────────

  static async create(
    input: CreateJoDocumentInput,
    file: Express.Multer.File,
    uploadedBy: string,
    uploadedByName: string
  ): Promise<JoDocument> {
    const uploaded = await uploadToCloudinary(file, 'jo/documents');

    let departmentName: string | null = null;
    if (input.department_id) {
      const { rows } = await pool.query(`SELECT name FROM departments WHERE id = $1`, [input.department_id]);
      departmentName = rows[0]?.name ?? null;
    }

    const status: JoDocumentStatus = input.is_draft ? 'draft' : 'pending_review';

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows } = await client.query(
        `INSERT INTO jo_documents
           (title, file_url, file_public_id, file_size_bytes, mime_type, original_name,
            status, uploaded_by, uploaded_by_name, department_id, department_name)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         RETURNING id`,
        [
          input.title.trim(), uploaded.secure_url, uploaded.public_id, file.size, file.mimetype, file.originalname,
          status, uploadedBy, uploadedByName, input.department_id ?? null, departmentName,
        ]
      );

      const id = rows[0].id;
      await logFlow(client, id, input.is_draft ? 'draft_saved' : 'sent', uploadedBy, uploadedByName);

      await client.query('COMMIT');
      return (await this.findById(id))!;
    } catch (err) {
      await client.query('ROLLBACK');
      await deleteFromCloudinary(uploaded.public_id).catch(console.error);
      throw err;
    } finally {
      client.release();
    }
  }

  // ── Update draft (title only, must still be draft) ────────────────────────

  static async updateDraft(id: string, input: UpdateJoDocumentInput, requestingUserId: string): Promise<JoDocument> {
    const doc = await this.findById(id);
    if (!doc) throw new AppError(404, 'Document not found');
    if (doc.uploaded_by !== requestingUserId) throw new AppError(403, 'You can only edit your own documents');
    if (doc.status !== 'draft') throw new AppError(409, 'Only drafts can be edited directly');

    const updates: string[] = [];
    const values: unknown[] = [];
    let p = 1;
    if (input.title !== undefined) { updates.push(`title = $${p++}`); values.push(input.title.trim()); }
    if (!updates.length) return doc;

    updates.push(`updated_at = NOW()`);
    values.push(id);
    await pool.query(`UPDATE jo_documents SET ${updates.join(', ')} WHERE id = $${p}`, values);
    return (await this.findById(id))!;
  }

  // ── Send to super admin (from draft, or re-send after rejection) ──────────

  static async sendToSuperAdmin(
    id: string,
    input: SendToSuperAdminInput,
    requestingUserId: string
  ): Promise<JoDocument> {
    const doc = await this.findById(id);
    if (!doc) throw new AppError(404, 'Document not found');
    if (doc.uploaded_by !== requestingUserId) throw new AppError(403, 'You can only send your own documents');
    if (doc.status !== 'draft') throw new AppError(409, 'Only draft documents can be sent');

    let assignedToName: string | null = null;
    if (input.assigned_to) {
      const { rows } = await pool.query(
        `SELECT full_name FROM users WHERE id = $1 AND role = 'super_admin' AND is_active = true`,
        [input.assigned_to]
      );
      if (!rows.length) throw new AppError(400, 'Assigned user must be an active super admin');
      assignedToName = rows[0].full_name;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE jo_documents
         SET status = 'pending_review', assigned_to = $1, assigned_to_name = $2, updated_at = NOW()
         WHERE id = $3`,
        [input.assigned_to ?? null, assignedToName, id]
      );
      await logFlow(client, id, 'sent', requestingUserId, doc.uploaded_by_name, input.note);
      await client.query('COMMIT');
      return (await this.findById(id))!;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // ── Read ────────────────────────────────────────────────────────────────

  static async findAll(
    filters: JoDocumentFilters,
    requestingUserId: string,
    requestingUserRole: string
  ): Promise<JoDocumentPaginationResponse> {
    const {
      status, department_id, mine, assigned_to_me, search,
      page = 1, limit = 20, sort_by = 'created_at', sort_order = 'DESC',
    } = filters;

    const allowedSort = new Set(['created_at', 'updated_at', 'title', 'status']);
    const sortCol = allowedSort.has(sort_by) ? `jd.${sort_by}` : 'jd.created_at';
    const sortDir = sort_order === 'ASC' ? 'ASC' : 'DESC';
    const offset = (page - 1) * limit;

    const conditions: string[] = ['jd.is_active = true'];
    const values: unknown[] = [];
    let p = 1;

    if (requestingUserRole !== 'super_admin') {
      // Non-super-admins only ever see their own uploads through this module.
      conditions.push(`jd.uploaded_by = $${p++}`);
      values.push(requestingUserId);
    } else {
      if (mine) {
        conditions.push(`jd.uploaded_by = $${p++}`);
        values.push(requestingUserId);
      } else {
        // Super admin queue: never show drafts (JO hasn't sent them yet)
        conditions.push(`jd.status != 'draft'`);
      }
      if (assigned_to_me) {
        conditions.push(`jd.assigned_to = $${p++}`);
        values.push(requestingUserId);
      }
    }

    if (status) { conditions.push(`jd.status = $${p++}`); values.push(status); }
    if (department_id) { conditions.push(`jd.department_id = $${p++}`); values.push(department_id); }
    if (search) {
      conditions.push(`(jd.title ILIKE $${p} OR jd.original_name ILIKE $${p})`);
      values.push(`%${search}%`); p++;
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const [countResult, dataResult] = await Promise.all([
      pool.query(`SELECT COUNT(*) AS total ${JD_FROM} ${where}`, values),
      pool.query(
        `SELECT ${JD_SELECT} ${JD_FROM} ${where} ORDER BY ${sortCol} ${sortDir} LIMIT $${p} OFFSET $${p + 1}`,
        [...values, limit, offset]
      ),
    ]);

    const total = parseInt(countResult.rows[0]?.total ?? '0', 10);
    return {
      data: dataResult.rows.map(mapRow),
      total, page, limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  static async findById(id: string): Promise<JoDocument | null> {
    const { rows } = await pool.query(
      `SELECT ${JD_SELECT} ${JD_FROM} WHERE jd.id = $1 AND jd.is_active = true`,
      [id]
    );
    return rows[0] ? mapRow(rows[0]) : null;
  }

  static async findByIdWithResponses(id: string): Promise<JoDocumentWithResponses | null> {
    const doc = await this.findById(id);
    if (!doc) return null;
    const { rows } = await pool.query(
      `SELECT ${JD_RESPONSE_SELECT} ${JD_RESPONSE_JOIN} WHERE r.jo_document_id = $1 ORDER BY r.response_number ASC`,
      [id]
    );
    return { ...doc, responses: rows };
  }

  static async getFlowHistory(id: string): Promise<JoDocumentFlowEntry[]> {
    const { rows } = await pool.query(
      `SELECT id, jo_document_id, action, actor_id, actor_name, note, created_at
       FROM jo_document_flow WHERE jo_document_id = $1 ORDER BY created_at ASC`,
      [id]
    );
    return rows;
  }

  // ── Chat / response thread ─────────────────────────────────────────────

  static async addResponse(
    id: string,
    input: RespondToJoDocumentInput,
    respondedBy: string,
    requestingUserRole: string
  ): Promise<JoDocumentResponse> {
    const doc = await this.findById(id);
    if (!doc) throw new AppError(404, 'Document not found');
    if (doc.status === 'draft') throw new AppError(409, 'Cannot respond to a draft document');

    const isOwner = doc.uploaded_by === respondedBy;
    const isSuperAdmin = requestingUserRole === 'super_admin';
    if (!isOwner && !isSuperAdmin) {
      throw new AppError(403, 'You do not have access to this document');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows: countRows } = await client.query(
        `SELECT COUNT(*) AS count FROM jo_document_responses WHERE jo_document_id = $1`,
        [id]
      );
      const nextNumber = parseInt(countRows[0].count, 10) + 1;

      const { rows } = await client.query(
        `INSERT INTO jo_document_responses (jo_document_id, response_number, responded_by, note)
         VALUES ($1,$2,$3,$4) RETURNING id`,
        [id, nextNumber, respondedBy, input.note.trim()]
      );

      await client.query(`UPDATE jo_documents SET updated_at = NOW() WHERE id = $1`, [id]);
      await client.query('COMMIT');

      const { rows: result } = await pool.query(
        `SELECT ${JD_RESPONSE_SELECT} ${JD_RESPONSE_JOIN} WHERE r.id = $1`,
        [rows[0].id]
      );
      return result[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // ── Approve ─────────────────────────────────────────────────────────────

  static async approve(id: string, input: ApproveJoDocumentInput, reviewerId: string, reviewerName: string): Promise<JoDocument> {
    const doc = await this.findById(id);
    if (!doc) throw new AppError(404, 'Document not found');
    if (doc.status !== 'pending_review') throw new AppError(409, 'Only documents pending review can be approved');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE jo_documents
         SET status = 'approved', reviewed_by = $1, reviewed_by_name = $2, reviewed_at = NOW(),
             rejection_reason = NULL, updated_at = NOW()
         WHERE id = $3`,
        [reviewerId, reviewerName, id]
      );
      await logFlow(client, id, 'approved', reviewerId, reviewerName, input.note);
      await client.query('COMMIT');
      return (await this.findById(id))!;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // ── Reject ──────────────────────────────────────────────────────────────

  static async reject(id: string, input: RejectJoDocumentInput, reviewerId: string, reviewerName: string): Promise<JoDocument> {
    const doc = await this.findById(id);
    if (!doc) throw new AppError(404, 'Document not found');
    if (doc.status !== 'pending_review') throw new AppError(409, 'Only documents pending review can be rejected');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE jo_documents
         SET status = 'rejected', reviewed_by = $1, reviewed_by_name = $2, reviewed_at = NOW(),
             rejection_reason = $3, updated_at = NOW()
         WHERE id = $4`,
        [reviewerId, reviewerName, input.reason.trim(), id]
      );
      await logFlow(client, id, 'rejected', reviewerId, reviewerName, input.reason);
      await client.query('COMMIT');
      return (await this.findById(id))!;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // ── Resubmit (JO edits after rejection, sends back) ────────────────────

  static async resubmit(id: string, input: ResubmitJoDocumentInput, requestingUserId: string): Promise<JoDocument> {
    const doc = await this.findById(id);
    if (!doc) throw new AppError(404, 'Document not found');
    if (doc.uploaded_by !== requestingUserId) throw new AppError(403, 'You can only resubmit your own documents');
    if (doc.status !== 'rejected') throw new AppError(409, 'Only rejected documents can be resubmitted');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE jo_documents
         SET status = 'pending_review', rejection_reason = NULL,
             reviewed_by = NULL, reviewed_by_name = NULL, reviewed_at = NULL,
             revision_count = revision_count + 1, updated_at = NOW()
         WHERE id = $1`,
        [id]
      );
      await logFlow(client, id, 'resubmitted', requestingUserId, doc.uploaded_by_name, input.note);
      await client.query('COMMIT');
      return (await this.findById(id))!;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // ── Replace file on a draft or a rejected doc before resubmitting ───────

  static async replaceFile(id: string, file: Express.Multer.File, requestingUserId: string): Promise<JoDocument> {
    const doc = await this.findById(id);
    if (!doc) throw new AppError(404, 'Document not found');
    if (doc.uploaded_by !== requestingUserId) throw new AppError(403, 'You can only edit your own documents');
    if (doc.status !== 'draft' && doc.status !== 'rejected') {
      throw new AppError(409, 'File can only be replaced while in draft or after rejection');
    }

    const uploaded = await uploadToCloudinary(file, 'jo/documents');
    const oldPublicId = doc.file_public_id;

    await pool.query(
      `UPDATE jo_documents
       SET file_url = $1, file_public_id = $2, file_size_bytes = $3, mime_type = $4, original_name = $5, updated_at = NOW()
       WHERE id = $6`,
      [uploaded.secure_url, uploaded.public_id, file.size, file.mimetype, file.originalname, id]
    );

    if (oldPublicId) await deleteFromCloudinary(oldPublicId).catch(console.error);
    return (await this.findById(id))!;
  }

  // ── Delete draft ─────────────────────────────────────────────────────────

  static async deleteDraft(id: string, requestingUserId: string): Promise<void> {
    const doc = await this.findById(id);
    if (!doc) throw new AppError(404, 'Document not found');
    if (doc.uploaded_by !== requestingUserId) throw new AppError(403, 'You can only delete your own documents');
    if (doc.status !== 'draft') throw new AppError(409, 'Only drafts can be deleted; sent documents are kept for the record');

    await pool.query(`UPDATE jo_documents SET is_active = false, updated_at = NOW() WHERE id = $1`, [id]);
    if (doc.file_public_id) await deleteFromCloudinary(doc.file_public_id).catch(console.error);
  }
}