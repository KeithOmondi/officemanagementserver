// src/features/templates/templates.service.ts
import { pool } from '../../config/db';
import { AppError } from '../../utils/response';
import { uploadToCloudinary, deleteFromCloudinary } from '../../config/cloudinary';
import type { DepartmentTemplate, TemplateType, GroupedTemplates } from './templates.types';

const TEMPLATE_SELECT = `
  t.id, t.department_id, COALESCE(dep.name, 'Global') AS department_name,
  t.type, t.file_url, t.file_public_id, t.original_name,
  t.mime_type, t.file_size_bytes,
  t.uploaded_by, u.full_name AS uploaded_by_name,
  t.is_active, t.created_at, t.updated_at
`;

// LEFT JOIN departments — global templates have a null department_id
const TEMPLATE_JOIN = `
  FROM department_templates t
  LEFT JOIN departments dep ON dep.id = t.department_id
  JOIN users u              ON u.id  = t.uploaded_by
`;

export class TemplateService {

  // ── Upload (departmentId = null means "global/default") ────────────────

  static async upload(
    departmentId: string | null,
    type: TemplateType,
    file: Express.Multer.File,
    uploadedBy: string
  ): Promise<DepartmentTemplate> {
    if (departmentId) {
      const { rows: deptCheck } = await pool.query(
        `SELECT id FROM departments WHERE id = $1 AND is_active = true`,
        [departmentId]
      );
      if (!deptCheck.length) throw new AppError(404, 'Department not found or inactive');
    }

    const folder = departmentId
      ? `registrar/templates/${departmentId}`
      : `registrar/templates/global`;

    const uploaded = await uploadToCloudinary(file, folder);

    const client = await pool.connect();
    let newId: string;
    try {
      await client.query('BEGIN');

      // IS NOT DISTINCT FROM treats NULL = NULL as true, unlike plain "="
      const { rows: old } = await client.query(
        `UPDATE department_templates
         SET is_active = false, updated_at = NOW()
         WHERE type = $1 AND is_active = true
           AND department_id IS NOT DISTINCT FROM $2
         RETURNING file_public_id`,
        [type, departmentId]
      );

      const { rows } = await client.query(
        `INSERT INTO department_templates
           (department_id, type, file_url, file_public_id, original_name,
            mime_type, file_size_bytes, uploaded_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING id`,
        [
          departmentId, type, uploaded.secure_url, uploaded.public_id,
          file.originalname, file.mimetype, file.size, uploadedBy,
        ]
      );
      newId = rows[0].id;

      await client.query('COMMIT');

      if (old[0]?.file_public_id) {
        await deleteFromCloudinary(old[0].file_public_id, 'raw').catch(console.error);
      }
    } catch (err) {
      await client.query('ROLLBACK');
      await deleteFromCloudinary(uploaded.public_id, 'raw').catch(console.error);
      throw err;
    } finally {
      client.release();
    }

    return (await this.findById(newId))!;
  }

  // ── Read ─────────────────────────────────────────────────────────────────

  static async findById(id: string): Promise<DepartmentTemplate | null> {
    const { rows } = await pool.query(
      `SELECT ${TEMPLATE_SELECT} ${TEMPLATE_JOIN} WHERE t.id = $1`,
      [id]
    );
    return rows[0] ?? null;
  }

  // Resolves a department's template; falls back to the global one if the
  // department hasn't uploaded its own. Throws only if neither exists.
  static async getActive(
    departmentId: string | null,
    type: TemplateType
  ): Promise<DepartmentTemplate> {
    if (departmentId) {
      const { rows } = await pool.query(
        `SELECT ${TEMPLATE_SELECT} ${TEMPLATE_JOIN}
         WHERE t.department_id = $1 AND t.type = $2 AND t.is_active = true`,
        [departmentId, type]
      );
      if (rows.length) return { ...rows[0], is_fallback: false };
    }

    const { rows: globalRows } = await pool.query(
      `SELECT ${TEMPLATE_SELECT} ${TEMPLATE_JOIN}
       WHERE t.department_id IS NULL AND t.type = $1 AND t.is_active = true`,
      [type]
    );
    if (globalRows.length) {
      return { ...globalRows[0], is_fallback: departmentId !== null };
    }

    throw new AppError(
      404,
      departmentId
        ? `No ${type} template found for this department, and no global default is set`
        : `No global ${type} template has been uploaded yet`
    );
  }

  static async listForDepartment(departmentId: string): Promise<DepartmentTemplate[]> {
    const { rows } = await pool.query(
      `SELECT ${TEMPLATE_SELECT} ${TEMPLATE_JOIN}
       WHERE t.department_id = $1 AND t.is_active = true
       ORDER BY t.type`,
      [departmentId]
    );
    return rows;
  }

  static async listGlobal(): Promise<DepartmentTemplate[]> {
    const { rows } = await pool.query(
      `SELECT ${TEMPLATE_SELECT} ${TEMPLATE_JOIN}
       WHERE t.department_id IS NULL AND t.is_active = true
       ORDER BY t.type`
    );
    return rows;
  }

  static async listAllGrouped(): Promise<GroupedTemplates> {
    const { rows } = await pool.query(
      `SELECT ${TEMPLATE_SELECT} ${TEMPLATE_JOIN}
       WHERE t.is_active = true
       ORDER BY (t.department_id IS NULL) DESC, dep.name, t.type`
      // global rows (department_id IS NULL) sort to the top
    );
    const grouped: GroupedTemplates = {};
    for (const row of rows) {
      grouped[row.department_name] ??= [];
      grouped[row.department_name].push(row);
    }
    return grouped;
  }

  static async getHistory(departmentId: string | null, type: TemplateType): Promise<DepartmentTemplate[]> {
    const { rows } = await pool.query(
      `SELECT ${TEMPLATE_SELECT} ${TEMPLATE_JOIN}
       WHERE t.department_id IS NOT DISTINCT FROM $1 AND t.type = $2
       ORDER BY t.created_at DESC`,
      [departmentId, type]
    );
    return rows;
  }

  static async deactivate(id: string): Promise<void> {
    const tpl = await this.findById(id);
    if (!tpl) throw new AppError(404, 'Template not found');
    if (!tpl.is_active) throw new AppError(409, 'Template is already inactive');

    await pool.query(
      `UPDATE department_templates SET is_active = false, updated_at = NOW() WHERE id = $1`,
      [id]
    );
  }
}