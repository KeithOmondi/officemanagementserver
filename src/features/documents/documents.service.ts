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
} from './documents.validator';
import { embedSignatureIntoHTML, embedSignatureIntoPDF } from '../../utils/embedSignature';
import axios from 'axios';
import { generateOTP } from '../../utils/SendOTP';
import { sendMail } from '../../utils/sendMail';
import { NotificationsService } from '../notifications/notifications.service';
import jsPDF from 'jspdf';
import { Buffer } from 'buffer';

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

// ── MARK_SELECT for detail view (without alias prefixes) ────────────────────

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

// ── Response thread ──────────────────────────────────────────────────────────

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

const JUDICIARY_CREST_SRC = 'https://res.cloudinary.com/do0yflasl/image/upload/v1781759596/JOB_LOGO_ubls4m.jpg';
const FOOTER_EMBLEM_SRC = 'https://res.cloudinary.com/do0yflasl/image/upload/v1782893389/footer-emblem_n0ncm9.jpg';

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

  static async createUpload(
    input: CreateUploadDocumentInput,
    file: Express.Multer.File,
    createdBy: string,
    createdByRole: string
  ): Promise<Document> {
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
      return (await this.findById(rows[0].id))!;
    } catch (err) {
      await deleteFromCloudinary(uploaded.public_id).catch(console.error);
      throw err;
    }
  }

  // ── Find all ─────────────────────────────────────────────────────────────────
  //
  // NOTE ON `for_my_action` + `department_id` (fixed):
  //
  // Previously, `for_my_action` unconditionally pushed an extra
  // `d.assigned_to = requestingUserId` condition, which was then joined with
  // AND alongside any separately-supplied `department_id` condition. For a
  // dept_head, the frontend sends BOTH `department_id` (their own dept) and
  // `for_my_action=true` on every request — so the query collapsed to:
  //
  //   WHERE d.department_id = <dept>  AND  d.assigned_to = <dept head id>
  //
  // ...which silently excluded every document routed to the department but
  // assigned to someone else on the team (e.g. marked to a specific staff
  // member). A dept_head needs to see the WHOLE department queue to
  // delegate/mark documents, not just items individually assigned to them.
  //
  // Fix: when `for_my_action` is requested alongside a `department_id`, OR
  // the two conditions together instead of ANDing them, and don't also apply
  // `department_id` as a second, separate AND condition.

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

    // Drafts are private to their creator until finalized (assigned to a user
    // or sent to the super admin). Without this, every caller — including the
    // super admin's own document list — would see unfinalized drafts the
    // moment they're uploaded.
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

    // ── for_my_action / department_id (fixed) ──────────────────────────────
    //
    // - for_my_action + department_id  → documents routed to my department
    //                                     OR individually assigned to me.
    // - for_my_action only             → documents individually assigned to me.
    // - department_id only (no action) → strict department filter, unchanged.
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

    // Transform the results to include active_mark
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

    // Verify the department exists
    const { rows: deptCheck } = await pool.query(
      `SELECT id, name FROM departments WHERE id = $1 AND is_active = true`,
      [input.department_id]
    );
    if (!deptCheck.length) {
      throw new AppError(400, 'Department not found or inactive');
    }

    // If a specific user is provided, verify they exist and belong to the department
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

      // Update document status and assignment
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

  static async finalizeDraft(
    documentId: string,
    input: { assigned_to?: string; send_to_super_admin?: boolean },
    actingUser: string
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

    await pool.query(
      `UPDATE documents
       SET is_draft = false, assigned_to = $1, status = 'pending_review', updated_at = NOW()
       WHERE id = $2`,
      [targetUserId, documentId]
    );
    await this.logFlow(
      pool, documentId,
      input.send_to_super_admin ? 'sent_to_admin' : 'assigned',
      actingUser, targetUserId
    );
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

  // ── Helper: Fetch image as base64 ───────────────────────────────────────────

  private static async fetchImageAsBase64(url: string): Promise<string> {
    try {
      const response = await axios.get(url, { responseType: 'arraybuffer' });
      const base64 = Buffer.from(response.data).toString('base64');
      const contentType = response.headers['content-type'] || 'image/jpeg';
      return `data:${contentType};base64,${base64}`;
    } catch (error) {
      console.error(`Failed to fetch image from ${url}:`, error);
      return '';
    }
  }

  // ── Helper: Add header logo to PDF ────────────────────────────────────────────

  private static async addHeaderLogoToPDF(
    doc: jsPDF,
    pageWidth: number,
    pageHeight: number
  ): Promise<void> {
    try {
      const crestBase64 = await this.fetchImageAsBase64(JUDICIARY_CREST_SRC);
      if (crestBase64) {
        // Center the logo at the top
        const logoWidth = 50;
        const logoHeight = 50;
        const logoX = (pageWidth - logoWidth) / 2;
        const logoY = 10;
        doc.addImage(crestBase64, 'JPEG', logoX, logoY, logoWidth, logoHeight);
      }
    } catch (error) {
      console.error('Failed to add header logo to PDF:', error);
    }
  }

  // ── Helper: Add footer image to PDF ────────────────────────────────────────────

  private static async addFooterImageToPDF(
    doc: jsPDF,
    pageWidth: number,
    pageHeight: number,
    margin: number
  ): Promise<void> {
    try {
      const footerBase64 = await this.fetchImageAsBase64(FOOTER_EMBLEM_SRC);
      if (footerBase64) {
        // Position footer emblem on the right side
        const footerWidth = 35;
        const footerHeight = 35;
        const footerX = pageWidth - margin - footerWidth;
        const footerY = pageHeight - margin - 5;
        doc.addImage(footerBase64, 'JPEG', footerX, footerY, footerWidth, footerHeight);
      }
    } catch (error) {
      console.error('Failed to add footer image to PDF:', error);
    }
  }


 // ── Generate Memo PDF ──────────────────────────────────────────────────────

// src/features/documents/documents.service.ts

// ... keep all your existing code up to the generateMemoPDF method ...

// ── Generate Memo PDF ──────────────────────────────────────────────────────

private static async generateMemoPDF(input: {
  to: string;
  from: string;
  cc?: string;
  ref: string;
  date: string;
  subject: string;
  body: string;
  senderName: string;
  senderInitials: string;
  senderSignature?: string;
}): Promise<Buffer> {
  const {
    to,
    from,
    cc,
    ref,
    date,
    subject,
    body,
    senderName,
    senderInitials,
    senderSignature,
  } = input;

  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 25;
  let y = margin;

  const checkPage = (needed: number = 20) => {
    if (y > pageHeight - margin - needed) {
      doc.addPage();
      y = margin;
      // Re-add header elements on new page
      try {
        const crestBase64 = this.fetchImageAsBase64(JUDICIARY_CREST_SRC);
        // ... we can add crest re-add logic if needed
      } catch {}
    }
  };

  // --- Crest / Logo ---
  try {
    const crestBase64 = await this.fetchImageAsBase64(JUDICIARY_CREST_SRC);
    if (crestBase64) {
      const imgWidth = 40;
      const imgHeight = 40;
      const imgX = (pageWidth - imgWidth) / 2;
      doc.addImage(crestBase64, 'JPEG', imgX, y, imgWidth, imgHeight);
      y += imgHeight + 4;
    } else {
      y += 10;
    }
  } catch {
    y += 10;
  }

  // --- Header (matches frontend exactly) ---
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('OFFICE OF THE REGISTRAR HIGH COURT', pageWidth / 2, y, { align: 'center' });
  y += 8;

  doc.setFontSize(16);
  doc.text('INTERNAL MEMO', pageWidth / 2, y, { align: 'center' });
  y += 4;
  
  // Underline after INTERNAL MEMO (matches frontend)
  doc.line(margin + 30, y, pageWidth - margin - 30, y);
  y += 10;

  // --- Fields (matches frontend: labels with colon, no extra spacing) ---
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');

  // TO
  doc.text('TO', margin, y);
  doc.text(':', margin + 18, y);
  doc.setFont('helvetica', 'normal');
  doc.text(to.toUpperCase(), margin + 22, y);
  y += 7;

  // FROM
  doc.setFont('helvetica', 'bold');
  doc.text('FROM', margin, y);
  doc.text(':', margin + 18, y);
  doc.setFont('helvetica', 'normal');
  doc.text(from.toUpperCase(), margin + 22, y);
  y += 7;

  // CC (if provided)
  if (cc) {
    doc.setFont('helvetica', 'bold');
    doc.text('CC', margin, y);
    doc.text(':', margin + 18, y);
    doc.setFont('helvetica', 'normal');
    doc.text(cc.toUpperCase(), margin + 22, y);
    y += 7;
  }

  // REF
  doc.setFont('helvetica', 'bold');
  doc.text('REF', margin, y);
  doc.text(':', margin + 18, y);
  doc.setFont('helvetica', 'normal');
  doc.text(ref.toUpperCase(), margin + 22, y);
  y += 7;

  // DATE
  doc.setFont('helvetica', 'bold');
  doc.text('DATE', margin, y);
  doc.text(':', margin + 18, y);
  doc.setFont('helvetica', 'normal');
  doc.text(date, margin + 22, y);
  y += 7;

  // SUBJECT
  doc.setFont('helvetica', 'bold');
  doc.text('SUBJECT', margin, y);
  doc.text(':', margin + 18, y);
  doc.setFont('helvetica', 'normal');
  doc.text(subject.toUpperCase(), margin + 22, y);
  y += 3;
  
  // Underline after subject (matches frontend)
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // --- Body ---
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);

  const lines = body.split('\n');
  for (const line of lines) {
    checkPage(15);
    if (line.trim() === '') {
      y += 4;
      continue;
    }
    
    const wrappedLines = doc.splitTextToSize(line, pageWidth - margin * 2);
    for (const wrapped of wrappedLines) {
      checkPage(10);
      doc.text(wrapped, margin, y);
      y += 6;
    }
    y += 2;
  }

  // --- Sign-off ---
  checkPage(40);
  y += 20;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(senderName, margin, y);
  y += 4;

  // Signature
  if (senderSignature) {
    try {
      const signatureBase64 = await this.fetchImageAsBase64(senderSignature);
      if (signatureBase64) {
        doc.addImage(signatureBase64, 'PNG', margin, y, 40, 15);
        y += 20;
      } else {
        doc.line(margin, y + 2, margin + 40, y + 2);
        y += 8;
      }
    } catch {
      doc.line(margin, y + 2, margin + 40, y + 2);
      y += 8;
    }
  } else {
    doc.line(margin, y + 2, margin + 40, y + 2);
    y += 8;
  }

  // From line with underline
  doc.setFont('helvetica', 'bold');
  doc.text(from.toUpperCase(), margin, y);
  y += 4;
  
  // Initials
  doc.setFontSize(10);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(102, 102, 102);
  doc.text(`RHC/${senderInitials}`, margin, y);
  y += 12;

  // --- Footer (with emblem image, matching frontend) ---
  checkPage(30);
  
  // Position footer at bottom of page
  const footerY = pageHeight - margin - 15;
  
  // Add footer emblem (matches frontend - positioned on left side)
  try {
    const footerBase64 = await this.fetchImageAsBase64(FOOTER_EMBLEM_SRC);
    if (footerBase64) {
      doc.addImage(footerBase64, 'JPEG', margin, footerY - 12, 25, 25);
    }
  } catch {
    // Continue without footer image
  }

  // Footer text (positioned to the right of the emblem)
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(102, 102, 102);
  
  // Calculate text position to the right of the emblem
  const textX = margin + 35;
  doc.text('Milimani Law Courts | 3rd Floor, Chamber 337 | P.O. Box 30041-00100 | Nairobi', textX, footerY - 8, { align: 'left' });
  doc.text('Tel. +254 0730 181478 | registrarhighcourt@court.go.ke | www.judiciary.go.ke', textX, footerY - 3, { align: 'left' });
  
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(26, 61, 28);
  doc.text('Justice Be Our Shield and Defender', textX, footerY + 2, { align: 'left' });

  // --- Output ---
  const pdfBuffer = doc.output('arraybuffer');
  return Buffer.from(pdfBuffer);
}



// ... keep the rest of your service code unchanged ...

  // ── Generate Letter PDF ────────────────────────────────────────────────────

  private static async generateLetterPDF(data: {
    to: string;
    from: string;
    ref: string;
    date: string;
    subject: string;
    body: string;
    senderName: string;
    senderSignature: string | null;
    senderInitials: string;
  }): Promise<Buffer> {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 25;
    let y = margin + 60; // Start lower to accommodate logo

    // ─── Add Header Logo (non-editable) ──────────────────────────────────
    await this.addHeaderLogoToPDF(doc, pageWidth, pageHeight);

    const checkPage = (needed: number = 20) => {
      if (y > pageHeight - margin - needed) {
        doc.addPage();
        y = margin + 60;
        // Re-add logo on new page
        this.addHeaderLogoToPDF(doc, pageWidth, pageHeight);
        this.addFooterImageToPDF(doc, pageWidth, pageHeight, margin);
      }
    };

    // ─── Add Footer Image (non-editable) ──────────────────────────────────
    await this.addFooterImageToPDF(doc, pageWidth, pageHeight, margin);

    // ─── Header Text ──────────────────────────────────────────────────────
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('THE JUDICIARY', pageWidth / 2, y, { align: 'center' });
    y += 6;

    doc.setFontSize(14);
    doc.text('OFFICE OF THE REGISTRAR HIGH COURT', pageWidth / 2, y, { align: 'center' });
    y += 12;

    // Ref (editable)
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Ref:', pageWidth - margin - 60, y);
    doc.setFont('helvetica', 'normal');
    doc.text(data.ref, pageWidth - margin - 30, y);
    y += 7;

    // Date (editable)
    doc.setFont('helvetica', 'bold');
    doc.text('Date:', pageWidth - margin - 60, y);
    doc.setFont('helvetica', 'normal');
    doc.text(data.date, pageWidth - margin - 30, y);
    y += 12;

    // To (editable)
    doc.setFont('helvetica', 'bold');
    doc.text('To:', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(data.to.toUpperCase(), margin + 20, y);
    y += 8;

    // From (editable)
    doc.setFont('helvetica', 'bold');
    doc.text('From:', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(data.from.toUpperCase(), margin + 20, y);
    y += 8;

    // Subject (editable)
    doc.setFont('helvetica', 'bold');
    doc.text('Subject:', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(data.subject.toUpperCase(), margin + 20, y);
    y += 10;

    // ─── Body (editable) ─────────────────────────────────────────────────────
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);

    const lines = data.body.split('\n');
    for (const line of lines) {
      checkPage(15);
      if (line.trim() === '') {
        y += 4;
        continue;
      }
      const wrappedLines = doc.splitTextToSize(line, pageWidth - margin * 2);
      for (const wrapped of wrappedLines) {
        checkPage(10);
        doc.text(wrapped, margin, y);
        y += 6;
      }
      y += 2;
    }

    // ─── Yours sincerely (editable) ──────────────────────────────────────
    checkPage(40);
    y += 20;

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(11);
    doc.text('Yours sincerely,', margin, y);
    y += 12;

    // Sign-off (editable)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(data.senderName, margin, y);
    y += 4;

    doc.line(margin, y + 2, margin + 40, y + 2);
    y += 8;

    doc.setFont('helvetica', 'bold');
    doc.text(data.from.toUpperCase(), margin, y);
    y += 4;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(102, 102, 102);
    doc.text(`RHC/${data.senderInitials}`, margin, y);
    y += 12;

    // ─── Footer Text (non-editable) ─────────────────────────────────────
    // Position footer text above the footer image
    const footerY = pageHeight - margin - 15;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(102, 102, 102);
    doc.text('Milimani Law Courts | 3rd Floor, Chamber 337 | P.O. Box 30041-00100 | Nairobi', margin + 20, footerY - 10, { align: 'left' });
    doc.text('Tel. +254 0730 181478 | registrarhighcourt@court.go.ke | www.judiciary.go.ke', margin + 20, footerY - 5, { align: 'left' });
    doc.text('Justice Be Our Shield and Defender', margin + 20, footerY, { align: 'left' });

    return Buffer.from(doc.output('arraybuffer'));
  }

  // src/features/documents/documents.service.ts

// ── Create Memo ──────────────────────────────────────────────────────────────

static async createMemo(
  input: {
    to: string;
    from: string;
    cc?: string;
    ref: string;
    date: string;
    subject: string;
    body: string;
    recipient_id?: string;
    note?: string;
  },
  createdBy: string,
  file?: Express.Multer.File  // This is the PDF from the frontend!
): Promise<Document> {
  const title = `MEMO: ${input.subject}`;

  // Get the sender's full name and initials
  const { rows: senderRows } = await pool.query(
    `SELECT full_name, signature_url FROM users WHERE id = $1`,
    [createdBy]
  );
  const senderName = senderRows[0]?.full_name || input.from;
  const senderSignature = senderRows[0]?.signature_url || null;
  const senderInitials = senderName
    .split(' ')
    .map((n: string) => n.charAt(0).toUpperCase())
    .join('');

  // ─── UPLOAD THE FRONTEND-GENERATED PDF ────────────────────────────────
  // Use the file from the frontend instead of regenerating!
  let uploaded: { secure_url: string; public_id: string };
  
  if (file) {
    // The frontend already generated the PDF - just upload it
    const multerFile = {
      buffer: file.buffer,
      mimetype: file.mimetype || 'application/pdf',
      originalname: file.originalname || `Memo_${input.ref || 'untitled'}.pdf`,
      size: file.size,
      fieldname: 'file',
      encoding: '7bit',
    } as Express.Multer.File;
    
    uploaded = await uploadToCloudinary(multerFile, 'registrar/memos');
  } else {
    // Fallback: generate PDF on backend if no file was provided
    const pdfBuffer = await this.generateMemoPDF({
      to: input.to,
      from: input.from,
      cc: input.cc,
      ref: input.ref,
      date: input.date,
      subject: input.subject,
      body: input.body,
      senderName,
      senderSignature,
      senderInitials,
    });

    uploaded = await uploadToCloudinary(
      {
        buffer: pdfBuffer,
        mimetype: 'application/pdf',
        originalname: `Memo_${input.ref || 'untitled'}.pdf`,
        size: pdfBuffer.length,
        fieldname: 'file',
        encoding: '7bit',
      } as Express.Multer.File,
      'registrar/memos'
    );
  }

  // ─── HTML preview (matches frontend exactly) ──────────────────────────
  const htmlContent = `
    <div style="font-family: 'Times New Roman', Times, serif; max-width: 794px; margin: 0 auto; padding: 48px 56px; background: white;">
      <div style="text-align: center; margin-bottom: 32px;">
        <img src="${JUDICIARY_CREST_SRC}" alt="Judiciary of Kenya" style="height: 80px; width: auto; object-fit: contain; display: block; margin: 0 auto;" />
      </div>
      <div style="text-align: center; margin-bottom: 24px;">
        <p style="font-size: 14px; font-weight: bold; text-transform: uppercase; color: #1a3d1c; margin: 4px 0;">OFFICE OF THE REGISTRAR HIGH COURT</p>
        <p style="font-size: 16px; font-weight: bold; text-transform: uppercase; color: #1a3d1c; margin: 4px 0;">INTERNAL MEMO</p>
      </div>
      <div style="margin-bottom: 24px;">
        <div style="display: flex; margin-bottom: 4px; font-size: 12px;">
          <span style="width: 80px; font-weight: bold; flex-shrink: 0;">TO :</span>
          <span style="font-weight: bold;">${input.to.toUpperCase()}</span>
        </div>
        <div style="display: flex; margin-bottom: 4px; font-size: 12px;">
          <span style="width: 80px; font-weight: bold; flex-shrink: 0;">FROM :</span>
          <span style="font-weight: bold;">${input.from.toUpperCase()}</span>
        </div>
        ${input.cc ? `
        <div style="display: flex; margin-bottom: 4px; font-size: 12px;">
          <span style="width: 80px; font-weight: bold; flex-shrink: 0;">CC :</span>
          <span style="font-weight: bold;">${input.cc.toUpperCase()}</span>
        </div>` : ''}
        <div style="display: flex; margin-bottom: 4px; font-size: 12px;">
          <span style="width: 80px; font-weight: bold; flex-shrink: 0;">REF :</span>
          <span style="font-weight: bold;">${input.ref.toUpperCase()}</span>
        </div>
        <div style="display: flex; margin-bottom: 4px; font-size: 12px;">
          <span style="width: 80px; font-weight: bold; flex-shrink: 0;">DATE :</span>
          <span style="font-weight: bold;">${input.date}</span>
        </div>
        <div style="display: flex; margin-bottom: 4px; font-size: 12px; border-bottom: 2px solid #000000; padding-bottom: 8px;">
          <span style="width: 80px; font-weight: bold; flex-shrink: 0;">SUBJECT :</span>
          <span style="font-weight: bold;">${input.subject.toUpperCase()}</span>
        </div>
      </div>
      <div style="margin-bottom: 40px; line-height: 1.8; font-size: 12px; min-height: 200px;">
        ${input.body.replace(/\n/g, '<br>')}
      </div>
      <div style="margin-top: 48px;">
        <p style="font-size: 13px; font-weight: bold; margin-bottom: 4px;">${senderName}</p>
        ${senderSignature ? `<img src="${senderSignature}" alt="Signature" style="max-height: 50px; margin-bottom: 4px; display: block;" />` : '<div style="height: 24px;"></div>'}
        <p style="font-size: 12px; font-weight: bold; text-decoration: underline; margin-bottom: 2px;">${input.from.toUpperCase()}</p>
        <p style="font-size: 10px; font-style: italic; color: #666666; margin-top: 2px;">RHC/${senderInitials}</p>
      </div>
      <div style="margin-top: 48px; padding-top: 16px; border-top: 1px solid #d1d5db; display: flex; align-items: center; justify-content: space-between;">
        <img src="${FOOTER_EMBLEM_SRC}" alt="Footer emblem" style="height: 40px; width: auto; object-fit: contain;" />
        <div style="text-align: right;">
          <p style="font-size: 8px; color: #666666; margin: 2px 0; line-height: 1.4;">Milimani Law Courts | 3rd Floor, Chamber 337 | P.O. Box 30041-00100 | Nairobi</p>
          <p style="font-size: 8px; color: #666666; margin: 2px 0; line-height: 1.4;">Tel. +254 0730 181478 | registrarhighcourt@court.go.ke | www.judiciary.go.ke</p>
          <p style="font-size: 8px; font-weight: bold; color: #1a3d1c; margin: 4px 0 0 0; line-height: 1.4;">Justice Be Our Shield and Defender</p>
        </div>
      </div>
    </div>
  `;

  const status = input.recipient_id ? 'pending_review' : 'draft';

  const { rows } = await pool.query(
    `INSERT INTO documents
       (title, type, body, file_url, file_public_id, file_size_bytes, mime_type, original_name,
        reference_no, assigned_to, created_by, status, is_draft, department_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     RETURNING id`,
    [
      title,
      'memo',
      htmlContent,
      uploaded.secure_url,
      uploaded.public_id,
      uploaded.secure_url ? (file?.size || 0) : 0,
      'application/pdf',
      `Memo_${input.ref || 'untitled'}.pdf`,
      input.ref,
      input.recipient_id || null,
      createdBy,
      status,
      !input.recipient_id,
      null,
    ]
  );

  const doc = await this.findById(rows[0].id);

  if (input.recipient_id && doc) {
    await NotificationsService.createNotification({
      user_id: input.recipient_id,
      type_name: 'memo',
      title: `New Memo: ${input.subject}`,
      message: `You have received a new memo from ${input.from}.${input.note ? `\n\nNote: ${input.note}` : ''}`,
      icon: 'FileText',
      color: '#1a3d1c',
      link: `/documents/${doc.id}`,
      priority: 'high',
      metadata: {
        document_id: doc.id,
        document_type: 'memo',
        document_title: input.subject,
        from_user: createdBy,
        note: input.note,
      },
      send_email: true,
    });

    await this.logFlow(
      pool,
      doc.id,
      'sent_to_user',
      createdBy,
      input.recipient_id,
      input.note || `Memo sent: ${input.subject}`
    );
  }

  return doc!;
}

  // ── Create Letter ────────────────────────────────────────────────────────────

  static async createLetter(
    input: {
      to: string;
      from: string;
      ref: string;
      date: string;
      subject: string;
      body: string;
      recipient_id?: string;
      note?: string;
    },
    createdBy: string,
    file?: Express.Multer.File
  ): Promise<Document> {
    const title = `LETTER: ${input.subject}`;

    // Get the sender's full name and initials
    const { rows: senderRows } = await pool.query(
      `SELECT full_name, signature_url FROM users WHERE id = $1`,
      [createdBy]
    );
    const senderName = senderRows[0]?.full_name || input.from;
    const senderSignature = senderRows[0]?.signature_url || null;
    const senderInitials = senderName
      .split(' ')
      .map((n: string) => n.charAt(0).toUpperCase())
      .join('');

    // ─── Generate PDF (with images) ──────────────────────────────────────
    const pdfBuffer = await this.generateLetterPDF({
      to: input.to,
      from: input.from,
      ref: input.ref,
      date: input.date,
      subject: input.subject,
      body: input.body,
      senderName,
      senderSignature,
      senderInitials,
    });

    // ─── Upload PDF to Cloudinary ─────────────────────────────────────────
    const uploaded = await uploadToCloudinary(
      {
        buffer: pdfBuffer,
        mimetype: 'application/pdf',
        originalname: `Letter_${input.ref || 'untitled'}.pdf`,
        size: pdfBuffer.length,
        fieldname: 'file',
        encoding: '7bit',
      } as Express.Multer.File,
      'registrar/letters'
    );

    // ─── HTML preview ──────────────────────────────────────────────────────
    const htmlContent = `
      <div style="font-family: 'Times New Roman', serif; max-width: 794px; margin: 0 auto; padding: 40px; background: white;">
        <div style="text-align: center; margin-bottom: 16px;">
          <img src="${JUDICIARY_CREST_SRC}" alt="Judiciary of Kenya" style="height: 80px; width: auto; object-fit: contain;" />
        </div>
        <div style="text-align: center; margin-bottom: 16px;">
          <h1 style="font-size: 14px; font-weight: bold; text-transform: uppercase; color: #555; margin: 0;">THE JUDICIARY</h1>
          <h2 style="font-size: 16px; font-weight: bold; text-transform: uppercase; color: #1a3d1c; margin: 4px 0;">OFFICE OF THE REGISTRAR HIGH COURT</h2>
        </div>
        <div style="text-align: right; margin-bottom: 20px;">
          <p style="margin: 2px 0; font-size: 12px;"><strong>Ref:</strong> ${input.ref}</p>
          <p style="margin: 2px 0; font-size: 12px;"><strong>Date:</strong> ${input.date}</p>
        </div>
        <div style="margin-bottom: 20px;">
          <p style="margin: 4px 0; font-size: 12px;"><strong>To:</strong> ${input.to.toUpperCase()}</p>
          <p style="margin: 4px 0; font-size: 12px;"><strong>From:</strong> ${input.from.toUpperCase()}</p>
        </div>
        <div style="margin-bottom: 30px;">
          <p style="margin: 4px 0; font-size: 12px;"><strong>Subject:</strong> ${input.subject.toUpperCase()}</p>
        </div>
        <div style="margin-bottom: 30px; line-height: 1.6; font-size: 11px; min-height: 200px;">
          ${input.body.replace(/\n/g, '<br>')}
        </div>
        <div style="margin-top: 40px;">
          <p style="font-size: 12px; font-style: italic;">Yours sincerely,</p>
          <div style="margin-top: 30px;">
            <p style="font-size: 12px; font-weight: bold; margin-bottom: 4px;">${senderName}</p>
            ${senderSignature ? `<img src="${senderSignature}" alt="Signature" style="max-height: 40px; margin-bottom: 4px; display: block;" />` : '<div style="height: 20px;"></div>'}
            <p style="font-size: 12px; font-weight: bold; text-decoration: underline;">${input.from.toUpperCase()}</p>
            <p style="font-size: 10px; font-style: italic; color: #666; margin-top: 4px;">RHC/${senderInitials}</p>
          </div>
        </div>
        <div style="margin-top: 40px; padding-top: 12px; border-top: 1px solid #ccc; display: flex; align-items: center; justify-content: space-between;">
          <img src="${FOOTER_EMBLEM_SRC}" alt="Footer emblem" style="height: 40px; width: auto; object-fit: contain;" />
          <div style="text-align: right;">
            <p style="font-size: 8px; color: #666; margin: 2px 0;">Milimani Law Courts | 3rd Floor, Chamber 337 | P.O. Box 30041-00100 | Nairobi</p>
            <p style="font-size: 8px; color: #666; margin: 2px 0;">Tel. +254 0730 181478 | registrarhighcourt@court.go.ke | www.judiciary.go.ke</p>
            <p style="font-size: 8px; font-weight: bold; color: #1a3d1c; margin: 4px 0 0 0;">Justice Be Our Shield and Defender</p>
          </div>
        </div>
      </div>
    `;

    const status = input.recipient_id ? 'pending_review' : 'draft';

    const { rows } = await pool.query(
      `INSERT INTO documents
         (title, type, body, file_url, file_public_id, file_size_bytes, mime_type, original_name,
          reference_no, assigned_to, created_by, status, is_draft, department_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING id`,
      [
        title,
        'letter',
        htmlContent,
        uploaded.secure_url,
        uploaded.public_id,
        pdfBuffer.length,
        'application/pdf',
        `Letter_${input.ref || 'untitled'}.pdf`,
        input.ref,
        input.recipient_id || null,
        createdBy,
        status,
        !input.recipient_id,
        null,
      ]
    );

    const doc = await this.findById(rows[0].id);

    if (input.recipient_id && doc) {
      await NotificationsService.createNotification({
        user_id: input.recipient_id,
        type_name: 'letter',
        title: `New Letter: ${input.subject}`,
        message: `You have received a new letter from ${input.from}.${input.note ? `\n\nNote: ${input.note}` : ''}`,
        icon: 'Mail',
        color: '#1a3d1c',
        link: `/documents/${doc.id}`,
        priority: 'high',
        metadata: {
          document_id: doc.id,
          document_type: 'letter',
          document_title: input.subject,
          from_user: createdBy,
          note: input.note,
        },
        send_email: true,
      });

      await this.logFlow(
        pool,
        doc.id,
        'sent_to_user',
        createdBy,
        input.recipient_id,
        input.note || `Letter sent: ${input.subject}`
      );
    }

    return doc!;
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
    await NotificationsService.createNotification({
      user_id: userId,
      type_name: type,
      title: title,
      message: message,
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
  }
}