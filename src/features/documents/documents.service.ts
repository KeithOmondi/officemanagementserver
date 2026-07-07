// src/features/documents/documents.service.ts

import { pool } from '../../config/db';
import { AppError } from '../../utils/response';
import crypto from 'crypto';
import { uploadToCloudinary, deleteFromCloudinary } from '../../config/cloudinary';
import type {
  Document,
  DocumentWithAnnotations,
  DocumentPaginationResponse,
  DocumentAnnotation,
  DocumentMark,
  DocumentFlowEntry,
  DocumentResponse,
} from './documents.types';
import type {
  CreateComposedDocumentInput,
  CreateUploadDocumentInput,
  UpdateDocumentInput,
  DocumentFilters,
  CreateAnnotationInput,
  MarkDocumentInput,
  RespondToDocumentInput,
  ComposeMemoInput,
  ComposeLetterInput,
} from './documents.validator';
import axios from 'axios';
import { generateOTP } from '../../utils/SendOTP';
import { sendMail } from '../../utils/sendMail';
import { NotificationsService } from '../notifications/notifications.service';
import { embedSignatureIntoHTML, embedSignatureIntoPDF } from '../../utils/embedSignature';
import { generateDocumentFromTemplate } from '../../utils/documentGenerator';

// ─── SELECT fragments ──────────────────────────────────────────────────────────

const DOC_SELECT = `
  d.id, d.title, d.type, d.category, d.status, d.reference_no,
  d.body, d.file_url, d.file_public_id, d.file_size_bytes, d.mime_type, d.original_name,
  d.assigned_to,    au.full_name  AS assigned_to_name,
  d.created_by,     cu.full_name  AS created_by_name,
  d.department_id,  dep.name      AS department_name,
  d.is_signed,
  d.signed_by,      su.full_name  AS signed_by_name,
  d.signed_at, d.is_sent, d.sent_at,
  d.is_draft, d.ref_type, d.ref_other_description,
  d.is_active, d.created_at, d.updated_at,
  (SELECT COUNT(*) FROM document_responses r WHERE r.document_id = d.id) AS response_count
`;

const DOC_JOIN = `
  FROM documents d
  LEFT JOIN users au       ON au.id  = d.assigned_to
  LEFT JOIN users cu       ON cu.id  = d.created_by
  LEFT JOIN users su       ON su.id  = d.signed_by
  LEFT JOIN departments dep ON dep.id = d.department_id
`;

const ANNOTATION_SELECT = `
  a.id, a.document_id, a.annotated_by,
  u.full_name AS annotated_by_name,
  a.comment, a.is_urgent, a.visible_in_summary, a.created_at
`;

const MARK_SELECT = `
  m.id AS mark_id,
  m.document_id AS mark_document_id,
  m.marked_by AS mark_marked_by,
  mb.full_name AS mark_marked_by_name,
  m.marked_to_dept AS mark_marked_to_dept,
  md.name AS mark_marked_to_dept_name,
  m.assigned_to AS mark_assigned_to,
  mu.full_name AS mark_assigned_to_name,
  m.instructions AS mark_instructions,
  m.priority AS mark_priority,
  m.marked_at AS mark_marked_at,
  m.acknowledged_at AS mark_acknowledged_at,
  m.completed_at AS mark_completed_at,
  m.is_active AS mark_is_active
`;

const MARK_JOIN = `
  LEFT JOIN document_marks m ON m.document_id = d.id AND m.is_active = true
  LEFT JOIN users mb ON mb.id = m.marked_by
  LEFT JOIN departments md ON md.id = m.marked_to_dept
  LEFT JOIN users mu ON mu.id = m.assigned_to
`;

const MARK_SELECT_DETAIL = `
  m.id, m.document_id,
  m.marked_by,      mb.full_name  AS marked_by_name,
  m.marked_to_dept, md.name       AS marked_to_dept_name,
  m.assigned_to,    mu.full_name  AS assigned_to_name,
  m.instructions, m.priority,
  m.marked_at, m.acknowledged_at, m.completed_at,
  m.is_active
`;

const MARK_JOIN_DETAIL = `
  FROM document_marks m
  LEFT JOIN users mb        ON mb.id  = m.marked_by
  LEFT JOIN departments md  ON md.id  = m.marked_to_dept
  LEFT JOIN users mu        ON mu.id  = m.assigned_to
`;

const RESPONSE_SELECT = `
  r.id, r.document_id, r.response_number, r.responded_by,
  ru.full_name AS responded_by_name,
  r.note, r.file_url, r.file_public_id, r.file_size_bytes, r.mime_type, r.original_name,
  r.created_at
`;

const RESPONSE_JOIN = `
  FROM document_responses r
  JOIN users ru ON ru.id = r.responded_by
`;

const ALLOWED_SORT = new Set(['created_at', 'updated_at', 'title', 'status']);

// ─── Service ───────────────────────────────────────────────────────────────────

export class DocumentService {

  // ── Create composed ─────────────────────────────────────────────────────────

  static async createComposed(
    input: CreateComposedDocumentInput,
    createdBy: string
  ): Promise<Document> {
    const { rows } = await pool.query(
      `INSERT INTO documents
         (title, type, category, reference_no, body, assigned_to, department_id, created_by, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'draft')
       RETURNING id`,
      [
        input.title.trim(),
        input.type,
        input.category ?? null,
        input.reference_no?.trim() ?? null,
        input.body,
        input.assigned_to ?? null,
        input.department_id ?? null,
        createdBy,
      ]
    );
    return (await this.findById(rows[0].id))!;
  }

  // ── Create upload ──────────────────────────────────────────────────────────

  // src/features/documents/documents.service.ts

// src/features/documents/documents.service.ts

static async createUpload(
  input: CreateUploadDocumentInput,
  file: Express.Multer.File,
  createdBy: string,
  createdByRole: string,
  io?: any
): Promise<Document> {
  console.log('[Upload] Starting document upload...');

  if (createdByRole === 'dept_head' && input.type !== 'correspondence') {
    throw new AppError(400, 'Department heads can only upload correspondence documents');
  }

  const uploaded = await uploadToCloudinary(file, 'registrar/documents');
  const status = input.is_draft ? 'draft' : 'uploaded';

  try {
    const { rows } = await pool.query(
      `INSERT INTO documents
         (title, type, category, reference_no, ref_type, ref_other_description,
          file_url, file_public_id, file_size_bytes, mime_type, original_name,
          assigned_to, department_id, created_by, status, is_draft, priority)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       RETURNING id`,
      [
        input.title.trim(), input.type, input.category ?? null,
        input.reference_no?.trim() ?? null,
        input.ref_type, input.ref_other_description?.trim() ?? null,
        uploaded.secure_url, uploaded.public_id, file.size, file.mimetype, file.originalname,
        input.assigned_to ?? null, input.department_id ?? null,
        createdBy, status, input.is_draft, input.priority,
      ]
    );

    await this.logFlow(pool, rows[0].id, input.is_draft ? 'draft_saved' : 'created', createdBy, null);

    console.log(`[Upload] Document saved with ID: ${rows[0].id}, is_draft: ${input.is_draft}`);

    // ── Notify super admins if not a draft ──
    if (!input.is_draft) {
      console.log('[Upload] Document is NOT a draft – notifying super admins.');
      const { rows: userRows } = await pool.query(
        `SELECT full_name FROM users WHERE id = $1`,
        [createdBy]
      );
      const creatorName = userRows[0]?.full_name || 'Unknown';
      await this.notifySuperAdmins(rows[0].id, 'uploaded', creatorName, io);
    } else {
      console.log('[Upload] Document is a draft – skipping notifications.');
    }

    return (await this.findById(rows[0].id))!;
  } catch (err) {
    console.error('[Upload] Error during upload:', err);
    await deleteFromCloudinary(uploaded.public_id).catch(console.error);
    throw err;
  }
}



  // ── Find all ─────────────────────────────────────────────────────────────────

  static async findAll(
    filters: DocumentFilters,
    requestingUserId: string
  ): Promise<DocumentPaginationResponse> {
    const {
      search, type, category, status, assigned_to,
      department_id, for_my_action,
      page = 1, limit = 20,
      sort_by = 'created_at', sort_order = 'DESC',
    } = filters;

    const sortCol = ALLOWED_SORT.has(sort_by ?? '') ? `d.${sort_by}` : 'd.created_at';
    const sortDir = sort_order === 'ASC' ? 'ASC' : 'DESC';
    const offset = (page - 1) * limit;

    const conditions: string[] = ['d.is_active = true'];
    const values: unknown[] = [];
    let p = 1;

    conditions.push(`(d.is_draft = false OR d.created_by = $${p})`);
    values.push(requestingUserId);
    p++;

    if (search) {
      conditions.push(`(d.title ILIKE $${p} OR d.reference_no ILIKE $${p} OR d.original_name ILIKE $${p})`);
      values.push(`%${search}%`); p++;
    }
    if (type) { conditions.push(`d.type = $${p}`); values.push(type); p++; }
    if (category) { conditions.push(`d.category = $${p}`); values.push(category); p++; }
    if (status) { conditions.push(`d.status = $${p}`); values.push(status); p++; }
    if (assigned_to) { conditions.push(`d.assigned_to = $${p}`); values.push(assigned_to); p++; }

    if (for_my_action && department_id) {
      conditions.push(`(d.department_id = $${p} OR d.assigned_to = $${p + 1})`);
      values.push(department_id, requestingUserId);
      p += 2;
    } else if (for_my_action) {
      conditions.push(`d.assigned_to = $${p}`);
      values.push(requestingUserId);
      p++;
    } else if (department_id) {
      conditions.push(`d.department_id = $${p}`);
      values.push(department_id);
      p++;
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const [countResult, dataResult] = await Promise.all([
      pool.query(`SELECT COUNT(*) AS total ${DOC_JOIN} ${where}`, values),
      pool.query(
        `SELECT 
          ${DOC_SELECT},
          ${MARK_SELECT}
         ${DOC_JOIN}
         ${MARK_JOIN}
         ${where}
         ORDER BY ${sortCol} ${sortDir}
         LIMIT $${p} OFFSET $${p + 1}`,
        [...values, limit, offset]
      ),
    ]);

    const documents = dataResult.rows.map((row) => {
      const doc: Document = {
        id: row.id,
        title: row.title,
        type: row.type,
        category: row.category,
        status: row.status,
        reference_no: row.reference_no,
        ref_type: row.ref_type,
        ref_other_description: row.ref_other_description,
        body: row.body,
        file_url: row.file_url,
        file_public_id: row.file_public_id,
        file_size_bytes: row.file_size_bytes,
        mime_type: row.mime_type,
        original_name: row.original_name,
        assigned_to: row.assigned_to,
        assigned_to_name: row.assigned_to_name,
        created_by: row.created_by,
        created_by_name: row.created_by_name,
        department_id: row.department_id,
        department_name: row.department_name,
        is_signed: row.is_signed,
        signed_by: row.signed_by,
        signed_by_name: row.signed_by_name,
        signed_at: row.signed_at,
        is_sent: row.is_sent,
        sent_at: row.sent_at,
        is_draft: row.is_draft,
        is_active: row.is_active,
        created_at: row.created_at,
        updated_at: row.updated_at,
        active_mark: row.mark_id ? {
          id: row.mark_id,
          document_id: row.mark_document_id,
          marked_by: row.mark_marked_by,
          marked_by_name: row.mark_marked_by_name,
          marked_to_dept: row.mark_marked_to_dept,
          marked_to_dept_name: row.mark_marked_to_dept_name,
          assigned_to: row.mark_assigned_to,
          assigned_to_name: row.mark_assigned_to_name,
          instructions: row.mark_instructions,
          priority: row.mark_priority,
          marked_at: row.mark_marked_at,
          acknowledged_at: row.mark_acknowledged_at,
          completed_at: row.mark_completed_at,
          is_active: row.mark_is_active,
        } : null,
        response_count: parseInt(row.response_count ?? '0', 10),
      };
      return doc;
    });

    const total = parseInt(countResult.rows[0]?.total ?? '0', 10);
    return {
      data: documents,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ── Find single ─────────────────────────────────────────────────────────────

  static async findById(id: string): Promise<Document | null> {
    const { rows } = await pool.query(
      `SELECT ${DOC_SELECT} ${DOC_JOIN} WHERE d.id = $1 AND d.is_active = true`,
      [id]
    );
    return rows[0] ?? null;
  }

  static async findByIdWithAnnotations(id: string): Promise<DocumentWithAnnotations | null> {
    const [docResult, annotResult, markResult, historyResult, responseResult] = await Promise.all([
      pool.query(
        `SELECT ${DOC_SELECT} ${DOC_JOIN} WHERE d.id = $1 AND d.is_active = true`,
        [id]
      ),
      pool.query(
        `SELECT ${ANNOTATION_SELECT}
         FROM document_annotations a
         JOIN users u ON u.id = a.annotated_by
         WHERE a.document_id = $1
         ORDER BY a.created_at ASC`,
        [id]
      ),
      pool.query(
        `SELECT ${MARK_SELECT_DETAIL} ${MARK_JOIN_DETAIL}
         WHERE m.document_id = $1 AND m.is_active = true`,
        [id]
      ),
      pool.query(
        `SELECT ${MARK_SELECT_DETAIL} ${MARK_JOIN_DETAIL}
         WHERE m.document_id = $1
         ORDER BY m.marked_at DESC`,
        [id]
      ),
      pool.query(
        `SELECT ${RESPONSE_SELECT} ${RESPONSE_JOIN}
         WHERE r.document_id = $1
         ORDER BY r.response_number ASC`,
        [id]
      ),
    ]);

    if (!docResult.rows[0]) return null;

    return {
      ...docResult.rows[0],
      annotations: annotResult.rows,
      active_mark: markResult.rows[0] ?? null,
      mark_history: historyResult.rows,
      responses: responseResult.rows,
      response_count: parseInt(docResult.rows[0].response_count ?? '0', 10),
    };
  }

  // ── Update ────────────────────────────────────────────────────────────────────

  static async update(id: string, input: UpdateDocumentInput): Promise<Document> {
    const existing = await this.findById(id);
    if (!existing) throw new AppError(404, 'Document not found');
    if (existing.status === 'filed') {
      throw new AppError(409, 'Filed documents cannot be edited.');
    }

    const updates: string[] = [];
    const values: unknown[] = [];
    let p = 1;

    if (input.title !== undefined) { updates.push(`title = $${p++}`); values.push(input.title.trim()); }
    if (input.category !== undefined) { updates.push(`category = $${p++}`); values.push(input.category); }
    if (input.reference_no !== undefined) { updates.push(`reference_no = $${p++}`); values.push(input.reference_no.trim()); }
    if (input.body !== undefined) { updates.push(`body = $${p++}`); values.push(input.body); }
    if (input.status !== undefined) { updates.push(`status = $${p++}`); values.push(input.status); }
    if (input.assigned_to !== undefined) { updates.push(`assigned_to = $${p++}`); values.push(input.assigned_to); }
    if (input.department_id !== undefined) { updates.push(`department_id = $${p++}`); values.push(input.department_id); }

    if (!updates.length) return existing;

    updates.push(`updated_at = NOW()`);
    values.push(id);

    await pool.query(
      `UPDATE documents SET ${updates.join(', ')} WHERE id = $${p}`,
      values
    );
    return (await this.findById(id))!;
  }

  // ── Send ──────────────────────────────────────────────────────────────────────

  static async send(id: string): Promise<Document> {
    const doc = await this.findById(id);
    if (!doc) throw new AppError(404, 'Document not found');
    if (doc.is_sent) throw new AppError(409, 'Document has already been sent');

    await pool.query(
      `UPDATE documents
       SET is_sent = true, sent_at = NOW(), status = 'filed', updated_at = NOW()
       WHERE id = $1`,
      [id]
    );
    return (await this.findById(id))!;
  }

  // ── Soft delete ───────────────────────────────────────────────────────────────

  static async softDelete(id: string): Promise<void> {
    const doc = await this.findById(id);
    if (!doc) throw new AppError(404, 'Document not found');

    await pool.query(
      `UPDATE documents SET is_active = false, updated_at = NOW() WHERE id = $1`,
      [id]
    );

    if (doc.file_public_id) {
      await deleteFromCloudinary(doc.file_public_id).catch(console.error);
    }
  }

  // ── Mark to Department ────────────────────────────────────────────────────────

  static async markDocument(
    documentId: string,
    input: MarkDocumentInput,
    markedBy: string
  ): Promise<Document> {
    const doc = await this.findById(documentId);
    if (!doc) throw new AppError(404, 'Document not found');
    if (doc.status === 'filed') {
      throw new AppError(409, 'Filed documents cannot be marked');
    }

    const { rows: deptCheck } = await pool.query(
      `SELECT id, name FROM departments WHERE id = $1 AND is_active = true`,
      [input.department_id]
    );
    if (!deptCheck.length) {
      throw new AppError(400, 'Department not found or inactive');
    }

    if (input.assigned_to) {
      const { rows: userCheck } = await pool.query(
        `SELECT id FROM users WHERE id = $1 AND department_id = $2 AND is_active = true`,
        [input.assigned_to, input.department_id]
      );
      if (!userCheck.length) {
        throw new AppError(400, 'The selected user does not exist or does not belong to the selected department');
      }
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `INSERT INTO document_marks
           (document_id, marked_by, marked_to_dept, assigned_to, instructions, priority)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          documentId, markedBy,
          input.department_id,
          input.assigned_to ?? null,
          input.instructions ?? null,
          input.priority,
        ]
      );

      await client.query(
        `UPDATE documents
         SET status = 'marked', 
             department_id = $1, 
             assigned_to = $2,
             updated_at = NOW()
         WHERE id = $3`,
        [input.department_id, input.assigned_to ?? null, documentId]
      );

      await client.query('COMMIT');
      return (await this.findById(documentId))!;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // ── Acknowledge Mark ──────────────────────────────────────────────────────

  static async acknowledgeMark(documentId: string, userId: string): Promise<Document> {
    const doc = await this.findById(documentId);
    if (!doc) throw new AppError(404, 'Document not found');

    const { rows } = await pool.query(
      `SELECT id FROM document_marks
       WHERE document_id = $1 AND assigned_to = $2 AND is_active = true`,
      [documentId, userId]
    );
    if (!rows.length) throw new AppError(403, 'This document was not assigned to you');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE document_marks
         SET acknowledged_at = NOW()
         WHERE document_id = $1 AND assigned_to = $2 AND is_active = true`,
        [documentId, userId]
      );
      await client.query(
        `UPDATE documents SET status = 'in_progress', updated_at = NOW() WHERE id = $1`,
        [documentId]
      );
      await client.query('COMMIT');
      return (await this.findById(documentId))!;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // ── Complete Mark ─────────────────────────────────────────────────────────

  static async completeMark(documentId: string, userId: string): Promise<Document> {
    const doc = await this.findById(documentId);
    if (!doc) throw new AppError(404, 'Document not found');

    const { rows } = await pool.query(
      `SELECT id, acknowledged_at FROM document_marks
       WHERE document_id = $1 AND assigned_to = $2 AND is_active = true`,
      [documentId, userId]
    );
    if (!rows.length) throw new AppError(403, 'This document was not assigned to you');
    if (!rows[0].acknowledged_at) {
      throw new AppError(400, 'You must acknowledge the document before marking it complete');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE document_marks
         SET completed_at = NOW()
         WHERE document_id = $1 AND assigned_to = $2 AND is_active = true`,
        [documentId, userId]
      );
      await client.query(
        `UPDATE documents SET status = 'completed', updated_at = NOW() WHERE id = $1`,
        [documentId]
      );
      await client.query('COMMIT');
      return (await this.findById(documentId))!;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // ── Mark queries ─────────────────────────────────────────────────────────

  static async getActiveMark(documentId: string): Promise<DocumentMark | null> {
    const { rows } = await pool.query(
      `SELECT ${MARK_SELECT_DETAIL} ${MARK_JOIN_DETAIL}
       WHERE m.document_id = $1 AND m.is_active = true`,
      [documentId]
    );
    return rows[0] ?? null;
  }

  static async getMarkHistory(documentId: string): Promise<DocumentMark[]> {
    const { rows } = await pool.query(
      `SELECT ${MARK_SELECT_DETAIL} ${MARK_JOIN_DETAIL}
       WHERE m.document_id = $1
       ORDER BY m.marked_at DESC`,
      [documentId]
    );
    return rows;
  }

  static async getMyMarked(userId: string): Promise<Document[]> {
    const { rows } = await pool.query(
      `SELECT ${DOC_SELECT} ${DOC_JOIN}
       WHERE d.is_active = true
         AND EXISTS (
           SELECT 1 FROM document_marks m
           WHERE m.document_id = d.id
             AND m.assigned_to = $1
             AND m.is_active = true
         )
       ORDER BY d.updated_at DESC`,
      [userId]
    );
    return rows;
  }

  // ── Annotations ─────────────────────────────────────────────────────────────

  static async addAnnotation(
    documentId: string,
    input: CreateAnnotationInput,
    annotatedBy: string
  ): Promise<DocumentAnnotation> {
    const doc = await this.findById(documentId);
    if (!doc) throw new AppError(404, 'Document not found');

    const { rows } = await pool.query(
      `INSERT INTO document_annotations
         (document_id, annotated_by, comment, is_urgent, visible_in_summary)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id`,
      [documentId, annotatedBy, input.comment.trim(), input.is_urgent, input.visible_in_summary]
    );

    const { rows: result } = await pool.query(
      `SELECT ${ANNOTATION_SELECT}
       FROM document_annotations a
       JOIN users u ON u.id = a.annotated_by
       WHERE a.id = $1`,
      [rows[0].id]
    );
    return result[0];
  }

  static async deleteAnnotation(
    documentId: string,
    annotationId: string,
    requestingUserId: string
  ): Promise<void> {
    const { rows } = await pool.query(
      `SELECT id, annotated_by FROM document_annotations
       WHERE id = $1 AND document_id = $2`,
      [annotationId, documentId]
    );
    if (!rows.length) throw new AppError(404, 'Annotation not found');
    if (rows[0].annotated_by !== requestingUserId) {
      throw new AppError(403, 'You can only delete your own annotations');
    }
    await pool.query(`DELETE FROM document_annotations WHERE id = $1`, [annotationId]);
  }

  // ── Response thread ──────────────────────────────────────────────────────

  static async getResponses(documentId: string): Promise<DocumentResponse[]> {
    const { rows } = await pool.query(
      `SELECT ${RESPONSE_SELECT} ${RESPONSE_JOIN}
       WHERE r.document_id = $1
       ORDER BY r.response_number ASC`,
      [documentId]
    );
    return rows;
  }

  static async addResponse(
    documentId: string,
    input: RespondToDocumentInput,
    respondedBy: string,
    file?: Express.Multer.File
  ): Promise<DocumentResponse> {
    const doc = await this.findById(documentId);
    if (!doc) throw new AppError(404, 'Document not found');

    if (doc.assigned_to !== respondedBy) {
      throw new AppError(403, 'This document is not currently assigned to you, so you cannot respond to it');
    }

    let uploaded: { secure_url: string; public_id: string } | null = null;
    if (file) {
      uploaded = await uploadToCloudinary(file, 'registrar/document-responses');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows: countRows } = await client.query(
        `SELECT COUNT(*) AS count FROM document_responses WHERE document_id = $1`,
        [documentId]
      );
      const nextNumber = parseInt(countRows[0].count, 10) + 1;

      const { rows } = await client.query(
        `INSERT INTO document_responses
           (document_id, response_number, responded_by, note,
            file_url, file_public_id, file_size_bytes, mime_type, original_name)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING id`,
        [
          documentId, nextNumber, respondedBy, input.note.trim(),
          uploaded?.secure_url ?? null, uploaded?.public_id ?? null,
          file?.size ?? null, file?.mimetype ?? null, file?.originalname ?? null,
        ]
      );

      const { rows: adminRows } = await client.query(
        `SELECT id FROM users WHERE role = 'super_admin' AND is_active = true LIMIT 1`
      );
      const superAdminId = adminRows[0]?.id ?? null;

      await client.query(
        `UPDATE documents
         SET status = 'pending_review', assigned_to = $1, updated_at = NOW()
         WHERE id = $2`,
        [superAdminId, documentId]
      );

      await this.logFlow(
        client, documentId, 'responded', respondedBy, superAdminId,
        `Response #${nextNumber}: ${input.note.trim()}`
      );

      await client.query('COMMIT');

      const { rows: result } = await pool.query(
        `SELECT ${RESPONSE_SELECT} ${RESPONSE_JOIN} WHERE r.id = $1`,
        [rows[0].id]
      );
      return result[0];
    } catch (err) {
      await client.query('ROLLBACK');
      if (uploaded) await deleteFromCloudinary(uploaded.public_id).catch(console.error);
      throw err;
    } finally {
      client.release();
    }
  }

  // ── Request sign OTP ──────────────────────────────────────────────────────────

  static async requestSignOtp(documentId: string): Promise<void> {
    const doc = await this.findById(documentId);
    if (!doc) throw new AppError(404, 'Document not found');
    if (doc.is_signed) throw new AppError(409, 'Document is already signed');

    const { rows } = await pool.query(
      `SELECT email, full_name FROM users
       WHERE role = 'super_admin' AND is_active = true LIMIT 1`
    );
    const admin = rows[0];
    if (!admin) throw new AppError(400, 'No active super admin found');

    const { rawOTP, hashedOTP, expiresAt } = generateOTP(5);

    await pool.query(
      `UPDATE documents
       SET sign_otp = $1, sign_otp_expires_at = $2
       WHERE id = $3`,
      [hashedOTP, expiresAt, documentId]
    );

    await sendMail({
      to: admin.email,
      subject: 'E-Sign OTP — Document Signing Request',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #eee;border-radius:8px;">
          <h2 style="color:#1E4620;margin-bottom:4px;">Document Signing Request</h2>
          <p style="color:#555;font-size:14px;">A request was made to e-sign the following document:</p>
          <p style="font-weight:bold;color:#333;font-size:14px;">"${doc.title}"</p>

          <div style="background:#f4f6f9;padding:16px;text-align:center;border-radius:6px;margin:24px 0;">
            <p style="font-size:12px;color:#888;margin:0 0 8px;">Your one-time signing PIN</p>
            <p style="font-size:36px;font-weight:bold;letter-spacing:10px;color:#1E4620;margin:0;">${rawOTP}</p>
          </div>

          <p style="font-size:12px;color:#999;">
            This OTP expires in <strong>5 minutes</strong>.<br/>
            If you did not request this, ignore this email — no document will be signed.
          </p>
        </div>
      `,
    });
  }

  // ── Sign with OTP verification ────────────────────────────────────────────────

  static async sign(id: string, signedBy: string, otp: string): Promise<Document> {
    const doc = await this.findById(id);
    if (!doc) throw new AppError(404, 'Document not found');
    if (doc.is_signed) throw new AppError(409, 'Document is already signed');

    const { rows: otpRows } = await pool.query(
      `SELECT sign_otp, sign_otp_expires_at FROM documents WHERE id = $1`,
      [id]
    );
    const record = otpRows[0];

    if (!record?.sign_otp) {
      throw new AppError(400, 'No OTP was requested for this document. Please request a new one.');
    }
    if (new Date() > new Date(record.sign_otp_expires_at)) {
      throw new AppError(400, 'OTP has expired. Please request a new one.');
    }

    const hashed = crypto.createHash('sha256').update(otp).digest('hex');
    if (hashed !== record.sign_otp) {
      throw new AppError(400, 'Invalid OTP. Please try again.');
    }

    await pool.query(
      `UPDATE documents SET sign_otp = NULL, sign_otp_expires_at = NULL WHERE id = $1`,
      [id]
    );

    const { rows: userRows } = await pool.query(
      `SELECT full_name, signature_url FROM users 
       WHERE role = 'super_admin' AND is_active = true LIMIT 1`
    );
    const signer = userRows[0];
    if (!signer?.signature_url) {
      throw new AppError(400, 'No super admin signature found. Please upload a signature first.');
    }

    if (doc.body && !doc.file_url) {
      const signedBody = embedSignatureIntoHTML(doc.body, signer.signature_url);
      await pool.query(
        `UPDATE documents
         SET body = $1, is_signed = true, signed_by = $2, signed_at = NOW(), updated_at = NOW()
         WHERE id = $3`,
        [signedBody, signedBy, id]
      );
      return (await this.findById(id))!;
    }

    if (doc.file_url) {
      if (doc.mime_type !== 'application/pdf') {
        await pool.query(
          `UPDATE documents
           SET is_signed = true, signed_by = $1, signed_at = NOW(), updated_at = NOW()
           WHERE id = $2`,
          [signedBy, id]
        );
        return (await this.findById(id))!;
      }

      const response = await axios.get<ArrayBuffer>(doc.file_url, { responseType: 'arraybuffer' });
      const originalPdf = Buffer.from(response.data);
      const signedPdf = await embedSignatureIntoPDF(originalPdf, signer.signature_url);

      if (doc.file_public_id) {
        await deleteFromCloudinary(doc.file_public_id).catch(console.error);
      }

      const multerFile: Express.Multer.File = {
        buffer: signedPdf,
        mimetype: 'application/pdf',
        originalname: doc.original_name ?? 'signed-document.pdf',
        size: signedPdf.length,
        fieldname: 'file',
        encoding: '7bit',
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };
      const uploaded = await uploadToCloudinary(multerFile, 'registrar/documents');

      await pool.query(
        `UPDATE documents
         SET file_url = $1, file_public_id = $2, file_size_bytes = $3,
             is_signed = true, signed_by = $4, signed_at = NOW(), updated_at = NOW()
         WHERE id = $5`,
        [uploaded.secure_url, uploaded.public_id, signedPdf.length, signedBy, id]
      );
      return (await this.findById(id))!;
    }

    await pool.query(
      `UPDATE documents
       SET is_signed = true, signed_by = $1, signed_at = NOW(), updated_at = NOW()
       WHERE id = $2`,
      [signedBy, id]
    );
    return (await this.findById(id))!;
  }

  // ── Flow logging ──────────────────────────────────────────────────────────────

  static async logFlow(
    client: any,
    documentId: string,
    action: string,
    fromUser: string | null,
    toUser: string | null,
    note?: string
  ) {
    await client.query(
      `INSERT INTO document_flow (document_id, action, from_user, to_user, note)
       VALUES ($1,$2,$3,$4,$5)`,
      [documentId, action, fromUser, toUser, note ?? null]
    );
  }

  static async getFlowHistory(documentId: string): Promise<DocumentFlowEntry[]> {
    const { rows } = await pool.query(
      `SELECT f.id, f.document_id, f.action,
              f.from_user, fu.full_name AS from_user_name,
              f.to_user,   tu.full_name AS to_user_name,
              f.note, f.created_at
       FROM document_flow f
       LEFT JOIN users fu ON fu.id = f.from_user
       LEFT JOIN users tu ON tu.id = f.to_user
       WHERE f.document_id = $1
       ORDER BY f.created_at ASC`,
      [documentId]
    );
    return rows;
  }

  // ── Finalize draft ────────────────────────────────────────────────────────────

  // In documents.service.ts

static async finalizeDraft(
  documentId: string,
  input: { assigned_to?: string; send_to_super_admin?: boolean },
  actingUser: string,
  io?: any // 👈 add optional io
): Promise<Document> {
  const doc = await this.findById(documentId);
  if (!doc) throw new AppError(404, 'Document not found');
  if (!doc.is_draft) throw new AppError(409, 'Document is not a draft');

  let targetUserId: string | null = null;
  if (input.send_to_super_admin) {
    const { rows } = await pool.query(
      `SELECT id FROM users WHERE role = 'super_admin' AND is_active = true LIMIT 1`
    );
    if (!rows.length) throw new AppError(400, 'No active super admin found');
    targetUserId = rows[0].id;
  } else if (input.assigned_to) {
    targetUserId = input.assigned_to;
  }

  // ── Update document ────────────────────────────────────────────
  await pool.query(
    `UPDATE documents
     SET is_draft = false, assigned_to = $1, status = 'pending_review', updated_at = NOW()
     WHERE id = $2`,
    [targetUserId, documentId]
  );

  // ── Log flow ──────────────────────────────────────────────────
  await this.logFlow(
    pool, documentId,
    input.send_to_super_admin ? 'sent_to_admin' : 'assigned',
    actingUser, targetUserId
  );

  // ── 🆕 Notify super admins if sent to them ───────────────────
  if (input.send_to_super_admin) {
    // Fetch creator name for the notification
    const { rows: userRows } = await pool.query(
      `SELECT full_name FROM users WHERE id = $1`,
      [actingUser]
    );
    const creatorName = userRows[0]?.full_name || 'Unknown';
    // Use the same helper – it will find all active super admins
    await this.notifySuperAdmins(documentId, 'finalized', creatorName, io);
  }

  return (await this.findById(documentId))!;
}

  // ── Return document ──────────────────────────────────────────────────────────

  static async returnDocument(
    documentId: string,
    input: { note: string; requires_more_docs: boolean },
    returnedBy: string
  ): Promise<Document> {
    const doc = await this.findById(documentId);
    if (!doc) throw new AppError(404, 'Document not found');
    if (!doc.created_by) throw new AppError(400, 'Cannot determine original submitter');

    await pool.query(
      `UPDATE documents
       SET status = $1, assigned_to = $2, is_draft = false, updated_at = NOW()
       WHERE id = $3`,
      [input.requires_more_docs ? 'pending_review' : 'in_progress', doc.created_by, documentId]
    );
    await this.logFlow(
      pool, documentId,
      input.requires_more_docs ? 'requires_more_docs' : 'returned',
      returnedBy, doc.created_by, input.note
    );
    return (await this.findById(documentId))!;
  }

  // ── Send to User ─────────────────────────────────────────────────────────────

  static async sendToUser(
    documentId: string,
    recipientId: string,
    sentBy: string,
    note?: string
  ): Promise<Document> {
    const doc = await this.findById(documentId);
    if (!doc) throw new AppError(404, 'Document not found');
    if (doc.is_sent) throw new AppError(409, 'Document has already been sent');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE documents
         SET assigned_to = $1, 
             status = 'pending_review', 
             is_draft = false,
             updated_at = NOW()
         WHERE id = $2`,
        [recipientId, documentId]
      );

      await this.createNotification(
        recipientId,
        `New Document: ${doc.title}`,
        `You have received a new document from ${doc.created_by_name}.${note ? `\n\nNote: ${note}` : ''}`,
        doc.type,
        documentId
      );

      await this.logFlow(
        client,
        documentId,
        'sent_to_user',
        sentBy,
        recipientId,
        note || `Document sent: ${doc.title}`
      );

      await client.query('COMMIT');
      return (await this.findById(documentId))!;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // ── Get Received Documents ──────────────────────────────────────────────────

  static async getReceivedDocuments(userId: string): Promise<Document[]> {
    const { rows } = await pool.query(
      `SELECT ${DOC_SELECT} ${DOC_JOIN}
       WHERE d.is_active = true
         AND d.assigned_to = $1
         AND d.status != 'filed'
         AND d.is_draft = false
       ORDER BY d.created_at DESC`,
      [userId]
    );
    return rows;
  }

  // ── Create Notification (helper) ────────────────────────────────────────────

 static async createNotification(
  userId: string,
  title: string,
  message: string,
  type: string,
  documentId?: string
): Promise<void> {
  console.log(`[DocHelper] Creating notification for user ${userId}, type: ${type}`);
  try {
    await NotificationsService.createNotification({
      user_id: userId,
      type_name: type,
      title,
      message,
      icon: type === 'memo' ? 'FileText' : type === 'letter' ? 'Mail' : 'Bell',
      color: type === 'memo' || type === 'letter' ? '#1a3d1c' : '#6b7280',
      link: documentId ? `/documents/${documentId}` : undefined,
      priority: type === 'memo' || type === 'letter' ? 'high' : 'normal',
      metadata: {
        document_id: documentId,
        type: type,
      },
      send_email: true,
    });
    console.log(`[DocHelper] Notification created successfully.`);
  } catch (error) {
    console.error(`[DocHelper] Failed to create notification for user ${userId}:`, error);
    // Don’t re-throw – notification failure should not break the main flow
  }
}


  // ════════════════════════════════════════════════════════════════════════════
  //  NEW: Memo & Letter generation with PDF
  // ════════════════════════════════════════════════════════════════════════════

  private static async getUserDisplayName(userId: string): Promise<string> {
    const { rows } = await pool.query(
      `SELECT full_name FROM users WHERE id = $1 AND is_active = true`,
      [userId]
    );
    return rows[0]?.full_name || 'Unknown User';
  }

  // ── Save Document Helper ──────────────────────────────────────────────────

  private static async saveDocument(
    title: string,
    type: string,
    ref: string,
    body: string,
    pdfBuffer: Buffer,
    createdBy: string,
    departmentId?: string
  ): Promise<Document> {
    const multerFile: Express.Multer.File = {
      buffer: pdfBuffer,
      originalname: `${type}_${Date.now()}.pdf`,
      mimetype: 'application/pdf',
      size: pdfBuffer.length,
      fieldname: 'file',
      encoding: '7bit',
      stream: null as any,
      destination: '',
      filename: '',
      path: '',
    };

    const uploaded = await uploadToCloudinary(multerFile, `registrar/documents/${type}s`);

    const { rows } = await pool.query(
      `INSERT INTO documents
         (title, type, category, reference_no, body, file_url, file_public_id,
          file_size_bytes, mime_type, original_name, created_by, department_id, status, is_draft)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING id`,
      [title, type, null, ref, body, uploaded.secure_url, uploaded.public_id, pdfBuffer.length,
       'application/pdf', multerFile.originalname, createdBy, departmentId || null, 'draft', true]
    );

    await this.logFlow(pool, rows[0].id, 'created', createdBy, null);
    return (await this.findById(rows[0].id))!;
  }

  // ── Generate Memo ─────────────────────────────────────────────────────────

  static async generateMemo(input: ComposeMemoInput, createdBy: string): Promise<Document> {
    const sender = input.from || (await this.getUserDisplayName(createdBy));
    const ref = input.reference_no || `RHC/MEMO/${new Date().getFullYear()}/${Date.now().toString().slice(-6)}`;

    const logoUrl = process.env.MEMO_LOGO_URL || undefined;
    const footerEmblemUrl = process.env.MEMO_FOOTER_EMBLEM_URL || undefined;

    const pdfBuffer = await generateDocumentFromTemplate('memo', {
      to: input.to,
      from: sender,
      ref: ref,
      date: input.date ? new Date(input.date).toLocaleDateString('en-KE', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }) : new Date().toLocaleDateString('en-KE', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      subject: input.title,
      body: input.body,
      signatureName: sender,
      signatureTitle: input.signatureTitle || 'Registrar, High Court',
      logoUrl: logoUrl,
      footerEmblemUrl: footerEmblemUrl
    });

    return await this.saveDocument(input.title, 'memo', ref, input.body, pdfBuffer, createdBy, input.department_id);
  }

  // ── Generate Letter ───────────────────────────────────────────────────────

  static async generateLetter(input: ComposeLetterInput, createdBy: string): Promise<Document> {
    const sender = input.from || (await this.getUserDisplayName(createdBy));
    const ref = input.reference_no || `RHC/LTR/${new Date().getFullYear()}/${Date.now().toString().slice(-6)}`;

    const logoUrl = process.env.LETTER_LOGO_URL || undefined;
    const footerEmblemUrl = process.env.LETTER_FOOTER_EMBLEM_URL || undefined;

    const pdfBuffer = await generateDocumentFromTemplate('letter', {
      ref: ref,
      date: input.date ? new Date(input.date).toLocaleDateString('en-KE', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }) : new Date().toLocaleDateString('en-KE', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      to: input.to,
      from: sender,
      subject: input.title,
      body: input.body,
      sender: sender,
      senderTitle: input.signatureTitle || 'Registrar, High Court',
      cc: input.cc || '',
      enclosures: input.enclosures || '',
      logoUrl: logoUrl,
      footerEmblemUrl: footerEmblemUrl
    });

    return await this.saveDocument(input.title, 'letter', ref, input.body, pdfBuffer, createdBy, input.department_id);
  }

  // ── Notify all active super admins ──────────────────────────────────────────

private static async notifySuperAdmins(
  documentId: string,
  action: 'created' | 'uploaded' | 'finalized',
  creatorName?: string,
  io?: any
): Promise<void> {
  console.log(`[Notify] Looking for active super admins...`);
  const { rows: admins } = await pool.query(
    `SELECT id FROM users WHERE role = 'super_admin' AND is_active = true`
  );

  if (!admins.length) {
    console.warn('[Notify] No active super admins found – skipping notifications.');
    return;
  }

  console.log(`[Notify] Found ${admins.length} active super admin(s).`);

  const doc = await this.findById(documentId);
  if (!doc) {
    console.error(`[Notify] Document ${documentId} not found – aborting.`);
    return;
  }

  const title = `New ${doc.type} document ${action}`;
  const message = `A new ${doc.type} "${doc.title}" has been ${action} by ${creatorName || 'a user'}.`;

  for (const admin of admins) {
    try {
      console.log(`[Notify] Creating notification for admin ${admin.id}...`);
      await NotificationsService.createNotification(
        {
          user_id: admin.id,
          type_name: doc.type,
          title,
          message,
          icon: doc.type === 'memo' ? 'FileText' : doc.type === 'letter' ? 'Mail' : 'Bell',
          color: '#1a3d1c',
          link: `/documents/${documentId}`,
          priority: 'high',
          metadata: { document_id: documentId, type: doc.type },
          send_email: true,
        },
        io
      );
      console.log(`[Notify] Notification created for admin ${admin.id}.`);
    } catch (error) {
      console.error(`[Notify] Failed to create notification for admin ${admin.id}:`, error);
    }
  }
}

}