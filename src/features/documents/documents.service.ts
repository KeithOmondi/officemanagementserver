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
  FollowUp,
  FollowUpComment,
  FollowUpWithComments,
  FollowUpPaginationResponse,
  FollowUpReminder,
  DocumentRequestDetails,
  RoutePriority,
  DocumentStatus,
  DocumentType,
  DocumentCategory,
  RefType,
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
  UpdateMarkInput,
  CreateFollowUpInput,
  UpdateFollowUpInput,
  CompleteFollowUpInput,
  CancelFollowUpInput,
  AddFollowUpCommentInput,
  FollowUpFilters,
  FileAwayFollowUpInput,
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
  d.folder_id,      f.name        AS folder_name,
  d.is_signed,
  d.signed_by,      su.full_name  AS signed_by_name,
  d.signed_at,
  d.released_at,    ru.full_name  AS released_by_name,
  d.is_sent, d.sent_at,
  d.is_draft, d.ref_type, d.ref_other_description,
  d.is_active, d.created_at, d.updated_at,
  d.to_recipient, d.from_sender, d.document_date, d.subject, d.cc, d.enclosures,
  d.signature_name, d.signature_title,
  d.signature_position_x,
  d.signature_position_y,
  d.signature_position_width,
  d.signature_position_height,
  d.request_details,
  (SELECT COUNT(*) FROM document_responses r WHERE r.document_id = d.id) AS response_count
`;

const DOC_JOIN = `
  FROM documents d
  LEFT JOIN users au       ON au.id  = d.assigned_to
  LEFT JOIN users cu       ON cu.id  = d.created_by
  LEFT JOIN users su       ON su.id  = d.signed_by
  LEFT JOIN users ru       ON ru.id  = d.released_by
  LEFT JOIN departments dep ON dep.id = d.department_id
  LEFT JOIN rhc_folders f  ON f.id   = d.folder_id
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
  m.bring_up_date AS mark_bring_up_date,
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
  m.instructions,
  m.bring_up_date,
  m.priority,
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

// ── Follow-up SELECT fragments ───────────────────────────────────────────────

const FOLLOW_UP_SELECT = `
  fu.id, fu.document_id, fu.mark_id, 
  fu.notes,
  fu.assigned_to, u.full_name AS assigned_to_name,
  fu.created_by, c.full_name AS created_by_name,
  fu.due_date, fu.priority, fu.status,
  fu.completed_at, fu.cancelled_at, fu.cancellation_reason,
  fu.completion_notes, fu.is_active, fu.created_at, fu.updated_at,
  (SELECT COUNT(*) FROM follow_up_comments fc WHERE fc.follow_up_id = fu.id) AS comment_count
`;

const FOLLOW_UP_JOIN = `
  FROM follow_ups fu
  LEFT JOIN users u ON u.id = fu.assigned_to
  LEFT JOIN users c ON c.id = fu.created_by
`;

const FOLLOW_UP_COMMENT_SELECT = `
  fc.id, fc.follow_up_id, fc.user_id,
  u.full_name AS user_name,
  fc.comment, fc.file_url, fc.file_public_id, fc.created_at
`;

const FOLLOW_UP_COMMENT_JOIN = `
  FROM follow_up_comments fc
  LEFT JOIN users u ON u.id = fc.user_id
`;

const ALLOWED_SORT = new Set(['created_at', 'updated_at', 'title', 'status']);
const ALLOWED_FOLLOW_UP_SORT = new Set(['created_at', 'due_date', 'priority', 'status', 'notes']);

// ─── Helper to map DB row to Document ─────────────────────────────────────────

function mapRowToDocument(row: any): Document {
  return {
    id: row.id,
    title: row.title,
    type: row.type as DocumentType,
    category: row.category as DocumentCategory | null,
    status: row.status as DocumentStatus,
    reference_no: row.reference_no,
    ref_type: row.ref_type as RefType | null,
    ref_other_description: row.ref_other_description,
    body: row.body,
    file_url: row.file_url,
    file_public_id: row.file_public_id,
    file_size_bytes: row.file_size_bytes,
    mime_type: row.mime_type,
    original_name: row.original_name,
    priority: row.priority || 'normal' as RoutePriority,
    assigned_to: row.assigned_to,
    assigned_to_name: row.assigned_to_name,
    created_by: row.created_by,
    created_by_name: row.created_by_name,
    department_id: row.department_id,
    department_name: row.department_name,
    folder_id: row.folder_id,
    folder_name: row.folder_name,
    is_signed: row.is_signed,
    signed_by: row.signed_by,
    signed_by_name: row.signed_by_name,
    signed_at: row.signed_at,
    released_at: row.released_at,
    released_by: row.released_by,
    released_by_name: row.released_by_name,
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
      bring_up_date: row.mark_bring_up_date,
      priority: row.mark_priority,
      marked_at: row.mark_marked_at,
      acknowledged_at: row.mark_acknowledged_at,
      completed_at: row.mark_completed_at,
      is_active: row.mark_is_active,
    } : null,
    response_count: parseInt(row.response_count ?? '0', 10),
    to_recipient: row.to_recipient || null,
    from_sender: row.from_sender || null,
    document_date: row.document_date || null,
    subject: row.subject || null,
    cc: row.cc || null,
    enclosures: row.enclosures || null,
    signature_name: row.signature_name || null,
    signature_title: row.signature_title || null,
    signature_position_x: row.signature_position_x ?? null,
    signature_position_y: row.signature_position_y ?? null,
    signature_position_width: row.signature_position_width ?? null,
    signature_position_height: row.signature_position_height ?? null,
    request_details: row.request_details as DocumentRequestDetails | null,
    follow_ups: [],
  };
}

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
    createdByRole: string,
    io?: any
  ): Promise<Document> {
    console.log('[Upload] Starting document upload...');

    if (createdByRole === 'dept_head' && input.type !== 'correspondence') {
      throw new AppError(400, 'Department heads can only upload correspondence documents');
    }

    const uploaded = await uploadToCloudinary(file, 'registrar/documents');
    const status: DocumentStatus = input.is_draft ? 'draft' : 'uploaded';

    try {
      const { rows } = await pool.query(
        `INSERT INTO documents
           (title, type, category, reference_no, ref_type, ref_other_description,
            file_url, file_public_id, file_size_bytes, mime_type, original_name,
            assigned_to, department_id, created_by, status, is_draft, priority, request_details)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
         RETURNING id`,
        [
          input.title.trim(), input.type, input.category ?? null,
          input.reference_no?.trim() ?? null,
          input.ref_type, input.ref_other_description?.trim() ?? null,
          uploaded.secure_url, uploaded.public_id, file.size, file.mimetype, file.originalname,
          input.assigned_to ?? null, input.department_id ?? null,
          createdBy, status, input.is_draft, input.priority || 'normal',
          input.request_details || null,
        ]
      );

      await this.logFlow(pool, rows[0].id, input.is_draft ? 'draft_saved' : 'created', createdBy, null);

      console.log(`[Upload] Document saved with ID: ${rows[0].id}, is_draft: ${input.is_draft}`);

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
    requestingUserId: string,
    requestingUserRole?: string
  ): Promise<DocumentPaginationResponse> {
    const {
      search, type, category, status, assigned_to,
      department_id, folder_id, for_my_action,
      has_bring_up_date,
      page = 1, limit = 20,
      sort_by = 'created_at', sort_order = 'DESC',
    } = filters;

    const sortCol = ALLOWED_SORT.has(sort_by ?? '') ? `d.${sort_by}` : 'd.created_at';
    const sortDir = sort_order === 'ASC' ? 'ASC' : 'DESC';
    const offset = (page - 1) * limit;

    const conditions: string[] = ['d.is_active = true'];
    const values: unknown[] = [];
    let p = 1;

    if (requestingUserRole === 'super_admin') {
      console.log('[FindAll] Super admin - showing all documents');
    } else {
      conditions.push(`(d.is_draft = false OR d.created_by = $${p})`);
      values.push(requestingUserId);
      p++;
    }

    if (folder_id) {
      conditions.push(`d.folder_id = $${p}`);
      values.push(folder_id);
      p++;
    }

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

    if (has_bring_up_date) {
      conditions.push(`m.bring_up_date IS NOT NULL`);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const [countResult, dataResult] = await Promise.all([
      pool.query(`SELECT COUNT(*) AS total ${DOC_JOIN} ${MARK_JOIN} ${where}`, values),
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

    const documents = dataResult.rows.map(mapRowToDocument);

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
    if (!rows[0]) return null;
    return mapRowToDocument(rows[0]);
  }

  static async findByIdWithAnnotations(id: string): Promise<DocumentWithAnnotations | null> {
    const [docResult, annotResult, markResult, historyResult, responseResult, followUpResult] = await Promise.all([
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
      pool.query(
        `SELECT ${FOLLOW_UP_SELECT} ${FOLLOW_UP_JOIN}
         WHERE fu.document_id = $1 AND fu.is_active = true
         ORDER BY fu.due_date ASC NULLS LAST`,
        [id]
      ),
    ]);

    if (!docResult.rows[0]) return null;

    const doc = mapRowToDocument(docResult.rows[0]);
    
    return {
      ...doc,
      annotations: annotResult.rows,
      active_mark: markResult.rows[0] ?? null,
      mark_history: historyResult.rows,
      responses: responseResult.rows,
      follow_ups: followUpResult.rows,
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
    
    if (input.status === 'ready_to_release' || input.status === 'released') {
      throw new AppError(403, 'Status cannot be manually set to ready_to_release or released. These are system-managed.');
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
    if (input.to_recipient !== undefined) { updates.push(`to_recipient = $${p++}`); values.push(input.to_recipient.trim()); }
    if (input.from_sender !== undefined) { updates.push(`from_sender = $${p++}`); values.push(input.from_sender.trim()); }
    if (input.document_date !== undefined) { updates.push(`document_date = $${p++}`); values.push(input.document_date); }
    if (input.subject !== undefined) { updates.push(`subject = $${p++}`); values.push(input.subject.trim()); }
    if (input.cc !== undefined) { updates.push(`cc = $${p++}`); values.push(input.cc.trim()); }
    if (input.enclosures !== undefined) { updates.push(`enclosures = $${p++}`); values.push(input.enclosures.trim()); }
    if (input.signature_name !== undefined) { updates.push(`signature_name = $${p++}`); values.push(input.signature_name.trim()); }
    if (input.signature_title !== undefined) { updates.push(`signature_title = $${p++}`); values.push(input.signature_title.trim()); }
    
    // Position fields
    if (input.signature_position_x !== undefined) { updates.push(`signature_position_x = $${p++}`); values.push(input.signature_position_x); }
    if (input.signature_position_y !== undefined) { updates.push(`signature_position_y = $${p++}`); values.push(input.signature_position_y); }
    if (input.signature_position_width !== undefined) { updates.push(`signature_position_width = $${p++}`); values.push(input.signature_position_width); }
    if (input.signature_position_height !== undefined) { updates.push(`signature_position_height = $${p++}`); values.push(input.signature_position_height); }

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
    if (doc.status !== 'released') {
      throw new AppError(400, 'Document must be released before it can be sent/filed.');
    }

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

    // Determine the new status based on the marker's role
    const { rows: userRows } = await pool.query(
      `SELECT role FROM users WHERE id = $1 AND is_active = true`,
      [markedBy]
    );
    if (!userRows.length) throw new AppError(403, 'User not found');
    const role = userRows[0].role;

    let newStatus: DocumentStatus;
    if (role === 'super_admin') {
      newStatus = 'dept_assigned';
    } else if (role === 'dept_head') {
      newStatus = 'user_assigned';
    } else {
      newStatus = 'marked';
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE document_marks SET is_active = false WHERE document_id = $1 AND is_active = true`,
        [documentId]
      );

      await client.query(
        `INSERT INTO document_marks
           (document_id, marked_by, marked_to_dept, assigned_to, instructions, priority, bring_up_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          documentId, markedBy,
          input.department_id,
          input.assigned_to ?? null,
          input.instructions ?? null,
          input.priority,
          null,
        ]
      );

      await client.query(
        `UPDATE documents
         SET status = $1, 
             department_id = $2, 
             assigned_to = $3,
             updated_at = NOW()
         WHERE id = $4`,
        [newStatus, input.department_id, input.assigned_to ?? null, documentId]
      );

      await this.logFlow(
        client,
        documentId,
        role === 'super_admin' ? 'assigned_to_dept' : 'assigned_to_user',
        markedBy,
        input.assigned_to ?? null,
        input.instructions ?? undefined
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
      await this.logFlow(client, documentId, 'acknowledged', userId, null);
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
      await this.logFlow(client, documentId, 'completed', userId, null);
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
    return rows.map(mapRowToDocument);
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

  static async requestSignOtp(documentId: string, requestingUserId: string): Promise<void> {
    const doc = await this.findById(documentId);
    if (!doc) throw new AppError(404, 'Document not found');
    if (doc.is_signed) throw new AppError(409, 'Document is already signed');

    const { rows } = await pool.query(
      `SELECT email, full_name FROM users
       WHERE id = $1 AND role = 'super_admin' AND is_active = true`,
      [requestingUserId]
    );
    const admin = rows[0];
    if (!admin) throw new AppError(403, 'Only an active super admin can request e-sign for this document');

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

  // ─── Sign with OTP verification ──────────────────────────────────────────────

  static async sign(id: string, signedBy: string, otp: string): Promise<Document> {
    const doc = await this.findById(id);
    if (!doc) throw new AppError(404, 'Document not found');
    if (doc.is_signed) throw new AppError(409, 'Document is already signed');

    // ── OTP verification ──────────────────────────────────────────────────────
    const { rows: otpRows } = await pool.query(
      `SELECT sign_otp, sign_otp_expires_at FROM documents WHERE id = $1`,
      [id]
    );
    if (!otpRows.length) throw new AppError(404, 'Document not found');
    const { sign_otp: hashedOtp, sign_otp_expires_at: expiresAt } = otpRows[0];
    if (!hashedOtp) throw new AppError(400, 'No OTP requested for this document');
    if (new Date() > new Date(expiresAt)) {
      throw new AppError(400, 'OTP has expired. Please request a new one.');
    }

    const crypto = await import('crypto');
    const hash = crypto.createHash('sha256').update(otp).digest('hex');
    if (hash !== hashedOtp) {
      throw new AppError(400, 'Invalid OTP');
    }

    // ── Fetch signer (super admin) ──────────────────────────────────────────
    const { rows: userRows } = await pool.query(
      `SELECT full_name, signature_url FROM users 
       WHERE id = $1 AND role = 'super_admin' AND is_active = true`,
      [signedBy]
    );
    const signer = userRows[0];
    if (!signer?.signature_url) {
      throw new AppError(400, 'No super admin signature found. Please upload a signature first.');
    }

    const signatoryName = doc.signature_name || signer.full_name;

    const isTemplatedDocument = doc.type === 'memo' || doc.type === 'letter';

    const position = (!isTemplatedDocument && doc.signature_position_x !== null && doc.signature_position_x !== undefined)
      ? {
          x: doc.signature_position_x,
          y: doc.signature_position_y || 0,
          width: doc.signature_position_width || 200,
          height: doc.signature_position_height || 80,
        }
      : null;

    // ── HTML document (no file) ─────────────────────────────────────────────
    if (doc.body && !doc.file_url) {
      const signedBody = embedSignatureIntoHTML(
        doc.body,
        signer.signature_url,
        signatoryName
      );

      await pool.query(
        `UPDATE documents
         SET body = $1, 
             is_signed = true, 
             signed_by = $2, 
             signed_at = NOW(), 
             status = 'ready_to_release',
             sign_otp = NULL,
             sign_otp_expires_at = NULL,
             updated_at = NOW()
         WHERE id = $3`,
        [signedBody, signedBy, id]
      );

      await this.logFlow(
        pool,
        id,
        'signed',
        signedBy,
        null,
        'Document signed. Ready for release.'
      );

      return (await this.findById(id))!;
    }

    // ── File-based document ──────────────────────────────────────────────────
    if (doc.file_url) {
      if (doc.mime_type !== 'application/pdf') {
        await pool.query(
          `UPDATE documents
           SET is_signed = true, 
               signed_by = $1, 
               signed_at = NOW(), 
               status = 'ready_to_release',
               sign_otp = NULL,
               sign_otp_expires_at = NULL,
               updated_at = NOW()
           WHERE id = $2`,
          [signedBy, id]
        );

        await this.logFlow(
          pool,
          id,
          'signed',
          signedBy,
          null,
          'Document signed. Ready for release.'
        );

        return (await this.findById(id))!;
      }

      const response = await axios.get<ArrayBuffer>(doc.file_url, { responseType: 'arraybuffer' });
      const originalPdf = Buffer.from(response.data);

      const signedPdf = await embedSignatureIntoPDF(
        originalPdf,
        signer.signature_url,
        position,
        signatoryName
      );

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
         SET file_url = $1, 
             file_public_id = $2, 
             file_size_bytes = $3,
             is_signed = true, 
             signed_by = $4, 
             signed_at = NOW(), 
             status = 'ready_to_release',
             sign_otp = NULL,
             sign_otp_expires_at = NULL,
             updated_at = NOW()
         WHERE id = $5`,
        [uploaded.secure_url, uploaded.public_id, signedPdf.length, signedBy, id]
      );

      await this.logFlow(
        pool,
        id,
        'signed',
        signedBy,
        null,
        'Document signed. Ready for release.'
      );

      return (await this.findById(id))!;
    }

    await pool.query(
      `UPDATE documents
       SET is_signed = true, 
           signed_by = $1, 
           signed_at = NOW(), 
           status = 'ready_to_release',
           sign_otp = NULL,
           sign_otp_expires_at = NULL,
           updated_at = NOW()
       WHERE id = $2`,
      [signedBy, id]
    );

    await this.logFlow(
      pool,
      id,
      'signed',
      signedBy,
      null,
      'Document signed. Ready for release.'
    );

    return (await this.findById(id))!;
  }

  // ─── Release Document to Admin Side ──────────────────────────────────────────

  static async releaseDocument(
    id: string, 
    releasedBy: string, 
    note?: string,
    recipientId?: string
  ): Promise<Document> {
    const doc = await this.findById(id);
    if (!doc) throw new AppError(404, 'Document not found');
    
    if (doc.status !== 'ready_to_release') {
      throw new AppError(400, 'Document is not ready to release. It must be signed first.');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE documents
         SET status = 'released',
             released_at = NOW(),
             released_by = $1,
             assigned_to = COALESCE($2, assigned_to),
             updated_at = NOW()
         WHERE id = $3`,
        [releasedBy, recipientId || null, id]
      );

      await this.logFlow(
        client,
        id,
        'released',
        releasedBy,
        recipientId || null,
        note || 'Document released to admin side.'
      );

      await client.query('COMMIT');

      if (recipientId) {
        try {
          const { rows: userRows } = await pool.query(
            `SELECT full_name, email FROM users WHERE id = $1 AND is_active = true`,
            [recipientId]
          );
          if (userRows.length > 0) {
            const recipient = userRows[0];
            await NotificationsService.createNotification({
              user_id: recipientId,
              type_name: doc.type,
              title: `Document Assigned: ${doc.title}`,
              message: `A document has been assigned to you by ${doc.created_by_name || 'the Registrar'}.${note ? `\n\nNote: ${note}` : ''}`,
              icon: doc.type === 'memo' ? 'FileText' : doc.type === 'letter' ? 'Mail' : 'Bell',
              color: '#1a3d1c',
              link: `/documents/${id}`,
              priority: 'high',
              metadata: { document_id: id, type: doc.type },
              send_email: true,
            });
          }
        } catch (error) {
          console.error(`[Release] Failed to notify recipient ${recipientId}:`, error);
        }
      }

      if (doc.created_by) {
        try {
          await NotificationsService.createNotification({
            user_id: doc.created_by,
            type_name: doc.type,
            title: `Document Released: ${doc.title}`,
            message: `Your document "${doc.title}" has been released and is now available on the admin side.${note ? `\n\nNote: ${note}` : ''}`,
            icon: doc.type === 'memo' ? 'FileText' : doc.type === 'letter' ? 'Mail' : 'Bell',
            color: '#1a3d1c',
            link: `/documents/${id}`,
            priority: 'high',
            metadata: { document_id: id, type: doc.type },
            send_email: true,
          });
        } catch (error) {
          console.error(`[Release] Failed to notify creator ${doc.created_by}:`, error);
        }
      }

      return (await this.findById(id))!;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // ─── Get Released Documents ──────────────────────────────────────────────────

  static async getReleasedDocuments(userId: string): Promise<Document[]> {
    const { rows } = await pool.query(
      `SELECT ${DOC_SELECT} ${DOC_JOIN}
       WHERE d.is_active = true
         AND d.status IN ('released', 'filed')
         AND d.is_draft = false
       ORDER BY d.released_at DESC NULLS LAST, d.created_at DESC`,
      []
    );
    return rows.map(mapRowToDocument);
  }

  // ─── Is Visible to Admin ────────────────────────────────────────────────────

  static async isVisibleToAdmin(documentId: string): Promise<boolean> {
    const { rows } = await pool.query(
      `SELECT status FROM documents WHERE id = $1 AND is_active = true`,
      [documentId]
    );
    if (!rows.length) return false;
    return rows[0].status === 'released' || rows[0].status === 'filed';
  }

  // ─── Flow logging ──────────────────────────────────────────────────────────────

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
    actingUser: string,
    io?: any
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

    if (input.send_to_super_admin) {
      const { rows: userRows } = await pool.query(
        `SELECT full_name FROM users WHERE id = $1`,
        [actingUser]
      );
      const creatorName = userRows[0]?.full_name || 'Unknown';
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
    return rows.map(mapRowToDocument);
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
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  Memo & Letter generation with PDF
  // ════════════════════════════════════════════════════════════════════════════

  private static async getUserDisplayName(userId: string): Promise<string> {
    const { rows } = await pool.query(
      `SELECT full_name FROM users WHERE id = $1 AND is_active = true`,
      [userId]
    );
    return rows[0]?.full_name || 'Unknown User';
  }

  private static async saveDocument(params: {
    title: string;
    type: string;
    ref: string;
    body: string;
    pdfBuffer: Buffer;
    createdBy: string;
    departmentId?: string;
    toRecipient: string;
    fromSender: string;
    documentDate: string;
    subject: string;
    cc?: string;
    enclosures?: string;
    signatureName: string;
    signatureTitle: string;
  }): Promise<Document> {
    const {
      title, type, ref, body, pdfBuffer, createdBy, departmentId,
      toRecipient, fromSender, documentDate, subject, cc, enclosures,
      signatureName, signatureTitle,
    } = params;

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
          file_size_bytes, mime_type, original_name, created_by, department_id, status, is_draft,
          to_recipient, from_sender, document_date, subject, cc, enclosures, 
          signature_name, signature_title)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
       RETURNING id`,
      [
        title, type, null, ref, body, uploaded.secure_url, uploaded.public_id, pdfBuffer.length,
        'application/pdf', multerFile.originalname, createdBy, departmentId || null, 'draft', true,
        toRecipient, fromSender, documentDate, subject, cc || null, enclosures || null,
        signatureName, signatureTitle,
      ]
    );

    await this.logFlow(pool, rows[0].id, 'created', createdBy, null);
    return (await this.findById(rows[0].id))!;
  }

  static async generateMemo(input: ComposeMemoInput, createdBy: string): Promise<Document> {
    const fromDepartment = input.from || (await this.getUserDisplayName(createdBy));
    const signatureName = input.signatureName || fromDepartment;
    const signatureTitle = input.signatureTitle || 'Registrar, High Court';
    const ref = input.reference_no || `RHC/MEMO/${new Date().getFullYear()}/${Date.now().toString().slice(-6)}`;
    const documentDateIso = input.date ?? new Date().toISOString();
    const dateDisplay = new Date(documentDateIso).toLocaleDateString('en-KE', {
      year: 'numeric', month: 'long', day: 'numeric',
    });

    const pdfBuffer = await generateDocumentFromTemplate('memo', {
      to: input.to,
      from: fromDepartment,
      ref,
      date: dateDisplay,
      subject: input.title,
      body: input.body,
      signatureName,
      signatureTitle,
      logoUrl: process.env.MEMO_LOGO_URL || undefined,
      footerEmblemUrl: process.env.MEMO_FOOTER_EMBLEM_URL || undefined,
    });

    return await this.saveDocument({
      title: input.title,
      type: 'memo',
      ref,
      body: input.body,
      pdfBuffer,
      createdBy,
      departmentId: input.department_id,
      toRecipient: input.to,
      fromSender: fromDepartment,
      documentDate: documentDateIso,
      subject: input.title,
      signatureName,
      signatureTitle,
    });
  }

  static async generateLetter(input: ComposeLetterInput, createdBy: string): Promise<Document> {
    const fromDepartment = input.from || (await this.getUserDisplayName(createdBy));
    const signatureName = input.signatureName || fromDepartment;
    const signatureTitle = input.signatureTitle || 'Registrar, High Court';
    const ref = input.reference_no || `RHC/LTR/${new Date().getFullYear()}/${Date.now().toString().slice(-6)}`;
    const documentDateIso = input.date ?? new Date().toISOString();
    const dateDisplay = new Date(documentDateIso).toLocaleDateString('en-KE', {
      year: 'numeric', month: 'long', day: 'numeric',
    });

    const pdfBuffer = await generateDocumentFromTemplate('letter', {
      ref,
      date: dateDisplay,
      to: input.to,
      from: fromDepartment,
      subject: input.title,
      body: input.body,
      sender: signatureName,
      senderTitle: signatureTitle,
      cc: input.cc || '',
      enclosures: input.enclosures || '',
      logoUrl: process.env.LETTER_LOGO_URL || undefined,
      footerEmblemUrl: process.env.LETTER_FOOTER_EMBLEM_URL || undefined,
    });

    return await this.saveDocument({
      title: input.title,
      type: 'letter',
      ref,
      body: input.body,
      pdfBuffer,
      createdBy,
      departmentId: input.department_id,
      toRecipient: input.to,
      fromSender: fromDepartment,
      documentDate: documentDateIso,
      subject: input.title,
      cc: input.cc,
      enclosures: input.enclosures,
      signatureName,
      signatureTitle,
    });
  }

  static async regeneratePdf(documentId: string): Promise<Document> {
    const doc = await this.findById(documentId);
    if (!doc) throw new AppError(404, 'Document not found');
    if (doc.type !== 'memo' && doc.type !== 'letter') {
      throw new AppError(400, 'Only memo and letter documents can be regenerated');
    }
    if (doc.status === 'filed') {
      throw new AppError(409, 'Filed documents cannot be regenerated');
    }

    console.log(`[RegeneratePDF] Regenerating PDF for document ${documentId}`);

    const dateDisplay = doc.document_date
      ? new Date(doc.document_date).toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' })
      : new Date().toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' });

    let pdfBuffer: Buffer;
    if (doc.type === 'memo') {
      pdfBuffer = await generateDocumentFromTemplate('memo', {
        to: doc.to_recipient || '',
        from: doc.from_sender || '',
        ref: doc.reference_no || '',
        date: dateDisplay,
        subject: doc.subject || doc.title,
        body: doc.body || '',
        signatureName: doc.signature_name || '',
        signatureTitle: doc.signature_title || 'Registrar, High Court',
        logoUrl: process.env.MEMO_LOGO_URL || undefined,
        footerEmblemUrl: process.env.MEMO_FOOTER_EMBLEM_URL || undefined,
      });
    } else {
      pdfBuffer = await generateDocumentFromTemplate('letter', {
        ref: doc.reference_no || '',
        date: dateDisplay,
        to: doc.to_recipient || '',
        from: doc.from_sender || '',
        subject: doc.subject || doc.title,
        body: doc.body || '',
        sender: doc.signature_name || '',
        senderTitle: doc.signature_title || 'Registrar, High Court',
        cc: doc.cc || '',
        enclosures: doc.enclosures || '',
        logoUrl: process.env.LETTER_LOGO_URL || undefined,
        footerEmblemUrl: process.env.LETTER_FOOTER_EMBLEM_URL || undefined,
      });
    }

    const multerFile: Express.Multer.File = {
      buffer: pdfBuffer,
      originalname: `${doc.type}_${Date.now()}.pdf`,
      mimetype: 'application/pdf',
      size: pdfBuffer.length,
      fieldname: 'file',
      encoding: '7bit',
      stream: null as any,
      destination: '',
      filename: '',
      path: '',
    };

    const uploaded = await uploadToCloudinary(multerFile, `registrar/documents/${doc.type}s`);
    const oldPublicId = doc.file_public_id;
    const wasSigned = doc.is_signed;

    await pool.query(
      `UPDATE documents
       SET file_url = $1, file_public_id = $2, file_size_bytes = $3,
           mime_type = 'application/pdf', original_name = $4,
           is_signed = false, signed_by = NULL, signed_at = NULL,
           status = 'draft',
           updated_at = NOW()
       WHERE id = $5`,
      [uploaded.secure_url, uploaded.public_id, pdfBuffer.length, multerFile.originalname, documentId]
    );

    if (oldPublicId) {
      await deleteFromCloudinary(oldPublicId).catch(console.error);
    }

    await this.logFlow(
      pool, documentId, 'pdf_regenerated', null, null,
      wasSigned
        ? 'PDF regenerated from edits — previous signature cleared, re-signing required'
        : 'PDF regenerated from edits'
    );

    return (await this.findById(documentId))!;
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

  // ════════════════════════════════════════════════════════════════════════════
  //  Update Mark (instructions & bring_up_date)
  // ════════════════════════════════════════════════════════════════════════════

  static async updateMark(markId: string, input: UpdateMarkInput): Promise<DocumentMark> {
    const updates: string[] = [];
    const values: unknown[] = [];
    let p = 1;

    if (input.instructions !== undefined) {
      updates.push(`instructions = $${p++}`);
      values.push(input.instructions.trim() || null);
    }
    if (input.bring_up_date !== undefined) {
      updates.push(`bring_up_date = $${p++}`);
      values.push(input.bring_up_date);
    }

    if (!updates.length) {
      throw new AppError(400, 'No fields to update');
    }

    values.push(markId);

    await pool.query(
      `UPDATE document_marks SET ${updates.join(', ')} WHERE id = $${p}`,
      values
    );

    const { rows } = await pool.query(
      `SELECT ${MARK_SELECT_DETAIL} ${MARK_JOIN_DETAIL} WHERE m.id = $1`,
      [markId]
    );
    if (!rows.length) throw new AppError(404, 'Mark not found');
    return rows[0];
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  Folder Operations
  // ════════════════════════════════════════════════════════════════════════════

  static async redirectToFolder(
    documentId: string,
    folderId: string,
    userId: string,
    note?: string
  ): Promise<Document> {
    const doc = await this.findById(documentId);
    if (!doc) throw new AppError(404, 'Document not found');

    const { rows: folderRows } = await pool.query(
      `SELECT id, name FROM rhc_folders WHERE id = $1 AND is_active = true`,
      [folderId]
    );
    if (!folderRows.length) {
      throw new AppError(404, 'Folder not found or inactive');
    }

    await pool.query(
      `UPDATE documents 
       SET folder_id = $1, updated_at = NOW()
       WHERE id = $2`,
      [folderId, documentId]
    );

    await this.logFlow(
      pool,
      documentId,
      'redirected_to_folder',
      userId,
      null,
      `Document redirected to folder: ${folderRows[0].name}${note ? ` - ${note}` : ''}`
    );

    return (await this.findById(documentId))!;
  }

  static async removeFromFolder(
    documentId: string,
    userId: string,
    note?: string
  ): Promise<Document> {
    const doc = await this.findById(documentId);
    if (!doc) throw new AppError(404, 'Document not found');

    if (!doc.folder_id) {
      throw new AppError(400, 'Document is not in a folder');
    }

    await pool.query(
      `UPDATE documents 
       SET folder_id = NULL, updated_at = NOW()
       WHERE id = $1`,
      [documentId]
    );

    await this.logFlow(
      pool,
      documentId,
      'removed_from_folder',
      userId,
      null,
      `Document removed from folder${note ? ` - ${note}` : ''}`
    );

    return (await this.findById(documentId))!;
  }

  static async getDocumentsByFolder(
    folderId: string,
    page: number = 1,
    limit: number = 20,
    search?: string,
    type?: string,
    status?: string
  ): Promise<DocumentPaginationResponse> {
    const offset = (page - 1) * limit;

    const { rows: folderRows } = await pool.query(
      `SELECT id, name FROM rhc_folders WHERE id = $1 AND is_active = true`,
      [folderId]
    );
    if (!folderRows.length) {
      throw new AppError(404, 'Folder not found');
    }

    const conditions: string[] = ['d.folder_id = $1', 'd.is_active = true'];
    const values: unknown[] = [folderId];
    let p = 2;

    if (search) {
      conditions.push(`(d.title ILIKE $${p} OR d.reference_no ILIKE $${p} OR d.original_name ILIKE $${p})`);
      values.push(`%${search}%`);
      p++;
    }
    if (type) {
      conditions.push(`d.type = $${p}`);
      values.push(type);
      p++;
    }
    if (status) {
      conditions.push(`d.status = $${p}`);
      values.push(status);
      p++;
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const [countResult, dataResult] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) AS total ${DOC_JOIN} ${where}`,
        values
      ),
      pool.query(
        `SELECT ${DOC_SELECT} ${DOC_JOIN}
         ${where}
         ORDER BY d.created_at DESC
         LIMIT $${p} OFFSET $${p + 1}`,
        [...values, limit, offset]
      ),
    ]);

    const total = parseInt(countResult.rows[0]?.total ?? '0', 10);
    return {
      data: dataResult.rows.map(mapRowToDocument),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ── Bring-Up Date Reminders ──────────────────────────────────────────────

  static async sendBringUpDateReminders(io?: any): Promise<{ dueToday: number; dueTomorrow: number }> {
    const [dueTodayResult, dueTomorrowResult] = await Promise.all([
      pool.query(
        `SELECT
           m.id AS mark_id, m.document_id, m.assigned_to, m.marked_by,
           m.bring_up_date, m.instructions,
           d.title AS document_title, d.reference_no
         FROM document_marks m
         JOIN documents d ON d.id = m.document_id
         WHERE m.is_active = true
           AND m.completed_at IS NULL
           AND m.bring_up_due_reminder_sent_at IS NULL
           AND m.bring_up_date = CURRENT_DATE`
      ),
      pool.query(
        `SELECT
           m.id AS mark_id, m.document_id, m.assigned_to, m.marked_by,
           m.bring_up_date, m.instructions,
           d.title AS document_title, d.reference_no
         FROM document_marks m
         JOIN documents d ON d.id = m.document_id
         WHERE m.is_active = true
           AND m.completed_at IS NULL
           AND m.bring_up_reminder_sent_at IS NULL
           AND m.bring_up_date = (CURRENT_DATE + INTERVAL '1 day')::date`
      ),
    ]);

    const dueToday = await this.dispatchBringUpNotifications(
      dueTodayResult.rows, 'due_today', 'bring_up_due_reminder_sent_at', io
    );
    const dueTomorrow = await this.dispatchBringUpNotifications(
      dueTomorrowResult.rows, 'due_tomorrow', 'bring_up_reminder_sent_at', io
    );

    return { dueToday, dueTomorrow };
  }

  // ── Bring-Up Notification Dispatch (helper) ───────────────────────────────

  private static async dispatchBringUpNotifications(
    rows: any[],
    kind: 'due_today' | 'due_tomorrow',
    sentColumn: 'bring_up_reminder_sent_at' | 'bring_up_due_reminder_sent_at',
    io?: any
  ): Promise<number> {
    if (!rows.length) return 0;

    for (const row of rows) {
      const recipientId = row.assigned_to ?? row.marked_by;
      if (!recipientId) continue;

      const dueDate = new Date(row.bring_up_date).toLocaleDateString('en-KE', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });

      const titlePrefix = kind === 'due_today' ? 'Bring-up due today' : 'Bring-up reminder';
      const messageSuffix = kind === 'due_today'
        ? `is due for bring-up today (${dueDate}).`
        : `is due for bring-up tomorrow (${dueDate}).`;

      try {
        await NotificationsService.createNotification(
          {
            user_id: recipientId,
            type_name: 'bring_up_reminder',
            title: `${titlePrefix}: ${row.document_title}`,
            message: `"${row.document_title}"${row.reference_no ? ` (${row.reference_no})` : ''} ${messageSuffix}${row.instructions ? `\n\nInstructions: ${row.instructions}` : ''}`,
            icon: 'Clock',
            color: kind === 'due_today' ? '#b91c1c' : '#c9a84c',
            link: `/documents/${row.document_id}`,
            priority: 'high',
            metadata: { document_id: row.document_id, mark_id: row.mark_id, type: 'bring_up_reminder', kind },
            send_email: true,
          },
          io
        );

        await pool.query(
          `UPDATE document_marks SET ${sentColumn} = NOW() WHERE id = $1`,
          [row.mark_id]
        );
      } catch (error) {
        console.error(`[BringUpReminder:${kind}] Failed to notify user ${recipientId} for mark ${row.mark_id}:`, error);
      }
    }

    return rows.length;
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  FOLLOW-UP OPERATIONS
  // ════════════════════════════════════════════════════════════════════════════

  static async createFollowUp(
    input: CreateFollowUpInput,
    createdBy: string
  ): Promise<FollowUp> {
    console.log('[FollowUp] Creating new follow-up');

    const doc = await this.findById(input.document_id);
    if (!doc) {
      throw new AppError(404, 'Document not found');
    }

    const { rows: userRows } = await pool.query(
      `SELECT id, full_name FROM users WHERE id = $1 AND is_active = true`,
      [input.assigned_to]
    );
    if (!userRows.length) {
      throw new AppError(400, 'Assigned user not found or inactive');
    }

    const status = input.due_date ? 'pending' : 'filed_away';

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows } = await client.query(
        `INSERT INTO follow_ups
           (document_id, mark_id, notes, assigned_to, created_by, due_date, priority, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [
          input.document_id,
          input.mark_id || null,
          input.notes.trim(),
          input.assigned_to,
          createdBy,
          input.due_date || null,
          input.priority || 'normal',
          status,
        ]
      );

      const followUpId = rows[0].id;

      await this.logFlow(
        client,
        input.document_id,
        status === 'filed_away' ? 'follow_up_filed_away' : 'follow_up_created',
        createdBy,
        input.assigned_to,
        status === 'filed_away' 
          ? `Follow-up filed away: ${input.notes}`
          : `Follow-up created: ${input.notes}`
      );

      await client.query('COMMIT');

      await this.createFollowUpNotification(
        input.assigned_to,
        createdBy,
        input.document_id,
        followUpId,
        input.notes,
        status === 'filed_away' ? 'filed_away' : 'created'
      );

      console.log(`[FollowUp] Follow-up created successfully with ID: ${followUpId}, status: ${status}`);
      return (await this.getFollowUpById(followUpId))!;
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[FollowUp] Error creating follow-up:', err);
      throw err;
    } finally {
      client.release();
    }
  }

  static async fileAwayFollowUp(
    input: FileAwayFollowUpInput,
    userId: string
  ): Promise<FollowUp> {
    console.log('[FollowUp] Filing away follow-up');

    const doc = await this.findById(input.document_id);
    if (!doc) {
      throw new AppError(404, 'Document not found');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows } = await client.query(
        `INSERT INTO follow_ups
           (document_id, mark_id, notes, assigned_to, created_by, due_date, priority, status, completion_notes)
         VALUES ($1, $2, $3, $4, $5, NULL, 'normal', 'filed_away', $6)
         RETURNING id`,
        [
          input.document_id,
          input.mark_id || null,
          input.notes.trim(),
          userId,
          userId,
          input.completion_notes?.trim() || input.notes.trim(),
        ]
      );

      const followUpId = rows[0].id;

      await this.logFlow(
        client,
        input.document_id,
        'follow_up_filed_away',
        userId,
        null,
        `Follow-up filed away: ${input.notes}`
      );

      await client.query('COMMIT');

      console.log(`[FollowUp] Follow-up filed away successfully with ID: ${followUpId}`);
      return (await this.getFollowUpById(followUpId))!;
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[FollowUp] Error filing away follow-up:', err);
      throw err;
    } finally {
      client.release();
    }
  }

  static async getFollowUps(
    filters: FollowUpFilters
  ): Promise<FollowUpPaginationResponse> {
    const {
      document_id,
      assigned_to,
      status,
      priority,
      due_from,
      due_to,
      search,
      active_only,
      filed_only,
      page = 1,
      limit = 20,
      sort_by = 'due_date',
      sort_order = 'ASC',
    } = filters;

    const sortCol = ALLOWED_FOLLOW_UP_SORT.has(sort_by) ? `fu.${sort_by}` : 'fu.due_date';
    const sortDir = sort_order === 'ASC' ? 'ASC' : 'DESC';
    const offset = (page - 1) * limit;

    const conditions: string[] = ['fu.is_active = true'];
    const values: unknown[] = [];
    let p = 1;

    if (active_only) {
      conditions.push(`fu.due_date IS NOT NULL AND fu.status IN ('pending', 'in_progress')`);
    }
    
    if (filed_only) {
      conditions.push(`(fu.due_date IS NULL OR fu.status = 'filed_away')`);
    }

    if (document_id) {
      conditions.push(`fu.document_id = $${p}`);
      values.push(document_id);
      p++;
    }
    if (assigned_to) {
      conditions.push(`fu.assigned_to = $${p}`);
      values.push(assigned_to);
      p++;
    }
    if (status) {
      conditions.push(`fu.status = $${p}`);
      values.push(status);
      p++;
    }
    if (priority) {
      conditions.push(`fu.priority = $${p}`);
      values.push(priority);
      p++;
    }
    if (due_from) {
      conditions.push(`fu.due_date >= $${p}`);
      values.push(due_from);
      p++;
    }
    if (due_to) {
      conditions.push(`fu.due_date <= $${p}`);
      values.push(due_to);
      p++;
    }
    if (search) {
      conditions.push(`fu.notes ILIKE $${p}`);
      values.push(`%${search}%`);
      p++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [countResult, dataResult] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) AS total ${FOLLOW_UP_JOIN} ${where}`,
        values
      ),
      pool.query(
        `SELECT ${FOLLOW_UP_SELECT} ${FOLLOW_UP_JOIN}
         ${where}
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

  static async getFollowUpsByDocument(
    documentId: string,
    filters?: Omit<FollowUpFilters, 'document_id'>
  ): Promise<FollowUpPaginationResponse> {
    return this.getFollowUps({
      sort_by: 'due_date',
      sort_order: 'ASC',
      ...filters,
      document_id: documentId,
    });
  }

  static async getFollowUpsByUser(
    userId: string,
    filters?: Omit<FollowUpFilters, 'assigned_to'>
  ): Promise<FollowUpPaginationResponse> {
    return this.getFollowUps({
      sort_by: 'due_date',
      sort_order: 'ASC',
      ...filters,
      assigned_to: userId,
    });
  }

  static async getFollowUpById(followUpId: string): Promise<FollowUp | null> {
    const { rows } = await pool.query(
      `SELECT ${FOLLOW_UP_SELECT} ${FOLLOW_UP_JOIN}
       WHERE fu.id = $1 AND fu.is_active = true`,
      [followUpId]
    );
    return rows[0] || null;
  }

  static async getFollowUpWithComments(followUpId: string): Promise<FollowUpWithComments | null> {
    const followUp = await this.getFollowUpById(followUpId);
    if (!followUp) return null;

    const { rows: comments } = await pool.query(
      `SELECT ${FOLLOW_UP_COMMENT_SELECT} ${FOLLOW_UP_COMMENT_JOIN}
       WHERE fc.follow_up_id = $1
       ORDER BY fc.created_at ASC`,
      [followUpId]
    );

    return {
      ...followUp,
      comments,
    };
  }

  static async getFollowUpThread(followUpId: string): Promise<FollowUpWithComments | null> {
    return this.getFollowUpWithComments(followUpId);
  }

  static async updateFollowUp(
    followUpId: string,
    input: UpdateFollowUpInput,
    userId: string
  ): Promise<FollowUp> {
    console.log(`[FollowUp] Updating follow-up ${followUpId}`);

    const existing = await this.getFollowUpById(followUpId);
    if (!existing) {
      throw new AppError(404, 'Follow-up not found');
    }

    const { rows: userRows } = await pool.query(
      `SELECT role FROM users WHERE id = $1 AND is_active = true`,
      [userId]
    );
    const role = userRows[0]?.role;

    if (existing.created_by !== userId && existing.assigned_to !== userId && role !== 'super_admin') {
      throw new AppError(403, 'You do not have permission to update this follow-up');
    }

    const updates: string[] = [];
    const values: unknown[] = [];
    let p = 1;

    if (input.notes !== undefined) {
      updates.push(`notes = $${p++}`);
      values.push(input.notes.trim());
    }
    if (input.assigned_to !== undefined) {
      const { rows: userCheck } = await pool.query(
        `SELECT id FROM users WHERE id = $1 AND is_active = true`,
        [input.assigned_to]
      );
      if (!userCheck.length) {
        throw new AppError(400, 'Assigned user not found or inactive');
      }
      updates.push(`assigned_to = $${p++}`);
      values.push(input.assigned_to);
    }
    if (input.due_date !== undefined) {
      updates.push(`due_date = $${p++}`);
      values.push(input.due_date);
    }
    if (input.priority !== undefined) {
      updates.push(`priority = $${p++}`);
      values.push(input.priority);
    }
    if (input.status !== undefined) {
      if (input.status === 'filed_away') {
        updates.push(`due_date = $${p++}`);
        values.push(null);
      }
      updates.push(`status = $${p++}`);
      values.push(input.status);
    }
    if (input.completion_notes !== undefined && input.status === 'completed') {
      updates.push(`completion_notes = $${p++}`);
      values.push(input.completion_notes.trim() || null);
    }
    if (input.cancellation_reason !== undefined && input.status === 'cancelled') {
      updates.push(`cancellation_reason = $${p++}`);
      values.push(input.cancellation_reason.trim() || null);
    }

    if (!updates.length) {
      throw new AppError(400, 'No fields to update');
    }

    updates.push(`updated_at = NOW()`);
    values.push(followUpId);

    await pool.query(
      `UPDATE follow_ups SET ${updates.join(', ')} WHERE id = $${p}`,
      values
    );

    await this.logFlow(
      pool,
      existing.document_id,
      'follow_up_updated',
      userId,
      existing.assigned_to,
      `Follow-up updated: ${existing.notes}`
    );

    console.log(`[FollowUp] Follow-up ${followUpId} updated successfully`);
    return (await this.getFollowUpById(followUpId))!;
  }

  static async completeFollowUp(
    followUpId: string,
    userId: string,
    input: CompleteFollowUpInput
  ): Promise<FollowUp> {
    console.log(`[FollowUp] Completing follow-up ${followUpId}`);

    const existing = await this.getFollowUpById(followUpId);
    if (!existing) {
      throw new AppError(404, 'Follow-up not found');
    }

    if (existing.status === 'completed') {
      throw new AppError(409, 'Follow-up is already completed');
    }
    if (existing.status === 'cancelled') {
      throw new AppError(409, 'Follow-up has been cancelled');
    }

    const { rows: userRows } = await pool.query(
      `SELECT role FROM users WHERE id = $1 AND is_active = true`,
      [userId]
    );
    const role = userRows[0]?.role;

    if (existing.assigned_to !== userId && role !== 'super_admin') {
      throw new AppError(403, 'Only the assigned user or a super admin can complete this follow-up');
    }

    await pool.query(
      `UPDATE follow_ups
       SET status = 'completed',
           completed_at = NOW(),
           completion_notes = COALESCE($1, notes),
           updated_at = NOW()
       WHERE id = $2`,
      [input.completion_notes?.trim() || null, followUpId]
    );

    await this.logFlow(
      pool,
      existing.document_id,
      'follow_up_completed',
      userId,
      existing.created_by,
      `Follow-up completed: ${existing.notes}`
    );

    await this.createFollowUpNotification(
      existing.created_by,
      userId,
      existing.document_id,
      followUpId,
      existing.notes,
      'completed'
    );

    console.log(`[FollowUp] Follow-up ${followUpId} completed successfully`);
    return (await this.getFollowUpById(followUpId))!;
  }

  static async cancelFollowUp(
    followUpId: string,
    userId: string,
    input: CancelFollowUpInput
  ): Promise<FollowUp> {
    console.log(`[FollowUp] Cancelling follow-up ${followUpId}`);

    const existing = await this.getFollowUpById(followUpId);
    if (!existing) {
      throw new AppError(404, 'Follow-up not found');
    }

    if (existing.status === 'completed') {
      throw new AppError(409, 'Cannot cancel a completed follow-up');
    }
    if (existing.status === 'cancelled') {
      throw new AppError(409, 'Follow-up is already cancelled');
    }

    const { rows: userRows } = await pool.query(
      `SELECT role FROM users WHERE id = $1 AND is_active = true`,
      [userId]
    );
    const role = userRows[0]?.role;

    if (existing.created_by !== userId && existing.assigned_to !== userId && role !== 'super_admin') {
      throw new AppError(403, 'You do not have permission to cancel this follow-up');
    }

    await pool.query(
      `UPDATE follow_ups
       SET status = 'cancelled',
           cancelled_at = NOW(),
           cancellation_reason = $1,
           updated_at = NOW()
       WHERE id = $2`,
      [input.cancellation_reason.trim(), followUpId]
    );

    await this.logFlow(
      pool,
      existing.document_id,
      'follow_up_cancelled',
      userId,
      existing.assigned_to,
      `Follow-up cancelled: ${existing.notes} - ${input.cancellation_reason}`
    );

    if (existing.assigned_to !== userId) {
      await this.createFollowUpNotification(
        existing.assigned_to,
        userId,
        existing.document_id,
        followUpId,
        existing.notes,
        'cancelled',
        input.cancellation_reason
      );
    }

    console.log(`[FollowUp] Follow-up ${followUpId} cancelled successfully`);
    return (await this.getFollowUpById(followUpId))!;
  }

  static async addFollowUpComment(
    followUpId: string,
    input: AddFollowUpCommentInput,
    userId: string,
    file?: Express.Multer.File
  ): Promise<FollowUpComment> {
    console.log(`[FollowUp] Adding comment to follow-up ${followUpId}`);

    const existing = await this.getFollowUpById(followUpId);
    if (!existing) {
      throw new AppError(404, 'Follow-up not found');
    }

    let uploaded: { secure_url: string; public_id: string } | null = null;
    if (file) {
      uploaded = await uploadToCloudinary(file, 'registrar/follow-up-comments');
    }

    const { rows } = await pool.query(
      `INSERT INTO follow_up_comments
         (follow_up_id, user_id, comment, file_url, file_public_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [
        followUpId,
        userId,
        input.comment.trim(),
        uploaded?.secure_url || null,
        uploaded?.public_id || null,
      ]
    );

    await this.logFlow(
      pool,
      existing.document_id,
      'follow_up_comment_added',
      userId,
      existing.assigned_to,
      `Comment added to follow-up: ${existing.notes}`
    );

    const { rows: commentRows } = await pool.query(
      `SELECT ${FOLLOW_UP_COMMENT_SELECT} ${FOLLOW_UP_COMMENT_JOIN}
       WHERE fc.id = $1`,
      [rows[0].id]
    );

    console.log(`[FollowUp] Comment added to follow-up ${followUpId}`);
    return commentRows[0];
  }

  static async getFollowUpComments(followUpId: string): Promise<FollowUpComment[]> {
    const { rows } = await pool.query(
      `SELECT ${FOLLOW_UP_COMMENT_SELECT} ${FOLLOW_UP_COMMENT_JOIN}
       WHERE fc.follow_up_id = $1
       ORDER BY fc.created_at ASC`,
      [followUpId]
    );
    return rows;
  }

  private static async createFollowUpNotification(
    userId: string,
    actorId: string,
    documentId: string,
    followUpId: string,
    notes: string,
    action: 'created' | 'completed' | 'cancelled' | 'updated' | 'filed_away',
    reason?: string
  ): Promise<void> {
    try {
      const { rows: userRows } = await pool.query(
        `SELECT full_name FROM users WHERE id = $1 AND is_active = true`,
        [actorId]
      );
      const actorName = userRows[0]?.full_name || 'A user';

      const actionMessages = {
        created: `created a follow-up for you. Notes: "${notes}"`,
        completed: `has completed the follow-up. Notes: "${notes}"`,
        cancelled: `has cancelled the follow-up.${reason ? ` Reason: ${reason}` : ''}`,
        updated: `has updated the follow-up. Notes: "${notes}"`,
        filed_away: `has filed away the follow-up. Notes: "${notes}"`,
      };

      await NotificationsService.createNotification({
        user_id: userId,
        type_name: 'follow_up',
        title: `Follow-up ${action}: ${notes.slice(0, 50)}${notes.length > 50 ? '...' : ''}`,
        message: `${actorName} ${actionMessages[action]}`,
        icon: 'Clipboard',
        color: action === 'created' ? '#2563eb' : action === 'completed' ? '#16a34a' : action === 'filed_away' ? '#6b7280' : '#dc2626',
        link: `/documents/${documentId}?followUp=${followUpId}`,
        priority: 'high',
        metadata: {
          document_id: documentId,
          follow_up_id: followUpId,
          action,
        },
        send_email: true,
      });
    } catch (error) {
      console.error(`[FollowUp] Failed to create notification for user ${userId}:`, error);
    }
  }

  static async sendFollowUpReminders(io?: any): Promise<{ dueToday: number; overdue: number }> {
    console.log('[FollowUp] Sending follow-up reminders');

    const dueTodayResult = await pool.query(
      `SELECT ${FOLLOW_UP_SELECT} ${FOLLOW_UP_JOIN}
       WHERE fu.status IN ('pending', 'in_progress')
         AND fu.is_active = true
         AND fu.due_date IS NOT NULL
         AND DATE(fu.due_date) = CURRENT_DATE`
    );

    const overdueResult = await pool.query(
      `SELECT ${FOLLOW_UP_SELECT} ${FOLLOW_UP_JOIN}
       WHERE fu.status IN ('pending', 'in_progress')
         AND fu.is_active = true
         AND fu.due_date IS NOT NULL
         AND DATE(fu.due_date) < CURRENT_DATE`
    );

    let dueTodayCount = 0;
    for (const followUp of dueTodayResult.rows) {
      try {
        await NotificationsService.createNotification(
          {
            user_id: followUp.assigned_to,
            type_name: 'follow_up_reminder',
            title: `Follow-up due today: ${followUp.notes.slice(0, 40)}${followUp.notes.length > 40 ? '...' : ''}`,
            message: `Follow-up "${followUp.notes}" is due today.`,
            icon: 'Clock',
            color: '#2563eb',
            link: `/documents/${followUp.document_id}?followUp=${followUp.id}`,
            priority: 'high',
            metadata: {
              document_id: followUp.document_id,
              follow_up_id: followUp.id,
              type: 'follow_up_due_today',
            },
            send_email: true,
          },
          io
        );
        dueTodayCount++;
      } catch (error) {
        console.error(`[FollowUp] Failed to send due today reminder for follow-up ${followUp.id}:`, error);
      }
    }

    let overdueCount = 0;
    for (const followUp of overdueResult.rows) {
      try {
        await NotificationsService.createNotification(
          {
            user_id: followUp.assigned_to,
            type_name: 'follow_up_reminder',
            title: `⚠️ Follow-up overdue: ${followUp.notes.slice(0, 40)}${followUp.notes.length > 40 ? '...' : ''}`,
            message: `Follow-up "${followUp.notes}" was due on ${new Date(followUp.due_date).toLocaleDateString()} and is now overdue.`,
            icon: 'AlertTriangle',
            color: '#dc2626',
            link: `/documents/${followUp.document_id}?followUp=${followUp.id}`,
            priority: 'urgent',
            metadata: {
              document_id: followUp.document_id,
              follow_up_id: followUp.id,
              type: 'follow_up_overdue',
              due_date: followUp.due_date,
            },
            send_email: true,
          },
          io
        );
        overdueCount++;
      } catch (error) {
        console.error(`[FollowUp] Failed to send overdue reminder for follow-up ${followUp.id}:`, error);
      }
    }

    console.log(`[FollowUp] Sent ${dueTodayCount} due today reminders and ${overdueCount} overdue reminders`);
    return { dueToday: dueTodayCount, overdue: overdueCount };
  }

  static async getFollowUpSummary(userId: string): Promise<{ 
    pending: number; 
    overdue: number; 
    completed: number; 
    filed_away: number; 
    total: number;
    active: number;
  }> {
    const { rows } = await pool.query(
      `SELECT 
         COUNT(*) FILTER (WHERE fu.status = 'pending' AND fu.due_date IS NOT NULL) AS pending,
         COUNT(*) FILTER (WHERE fu.status IN ('pending', 'in_progress') AND fu.due_date IS NOT NULL AND fu.due_date < NOW()) AS overdue,
         COUNT(*) FILTER (WHERE fu.status = 'completed') AS completed,
         COUNT(*) FILTER (WHERE fu.status = 'filed_away' OR fu.due_date IS NULL) AS filed_away,
         COUNT(*) AS total,
         COUNT(*) FILTER (WHERE fu.status IN ('pending', 'in_progress')) AS active
       FROM follow_ups fu
       WHERE fu.is_active = true 
         AND fu.assigned_to = $1`,
      [userId]
    );

    return {
      pending: parseInt(rows[0]?.pending || '0', 10),
      overdue: parseInt(rows[0]?.overdue || '0', 10),
      completed: parseInt(rows[0]?.completed || '0', 10),
      filed_away: parseInt(rows[0]?.filed_away || '0', 10),
      total: parseInt(rows[0]?.total || '0', 10),
      active: parseInt(rows[0]?.active || '0', 10),
    };
  }
}