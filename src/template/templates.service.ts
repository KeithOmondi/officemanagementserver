// src/modules/templates/templates.service.ts
import { deleteFromCloudinary, uploadToCloudinary } from '../config/cloudinary';
import { pool } from '../config/db';
import { extractFooterAssets } from '../utils/extractDocxFooter';
import { AppError } from '../utils/response';
import type { DocumentTemplate, TemplateType } from './templates.types';
import type { UploadTemplateInput, TemplateFilters } from './templates.validator';

const SELECT = `
  t.id, t.type, t.department_id, dep.name AS department_name,
  t.file_url, t.file_public_id, t.original_name,
  t.footer_image_url, t.footer_text, t.is_active,
  t.uploaded_by, u.full_name AS uploaded_by_name,
  t.created_at, t.updated_at
`;

const JOIN = `
  FROM document_templates t
  LEFT JOIN departments dep ON dep.id = t.department_id
  LEFT JOIN users u ON u.id = t.uploaded_by
`;

export class TemplatesService {

  static async uploadTemplate(
    file: Express.Multer.File,
    input: UploadTemplateInput,
    uploadedBy: string
  ): Promise<DocumentTemplate> {
    console.log(`[TemplatesService] uploadTemplate started`);
    console.log(`[TemplatesService] File: ${file.originalname}`);
    console.log(`[TemplatesService] Type: ${input.type}`);
    console.log(`[TemplatesService] Department: ${input.department_id || 'global'}`);

    if (!file.originalname.toLowerCase().endsWith('.docx')) {
      console.error(`[TemplatesService] Invalid file type: ${file.originalname}`);
      throw new AppError(400, 'Only .docx files are supported for templates');
    }

    console.log(`[TemplatesService] Uploading to Cloudinary...`);
    const uploaded = await uploadToCloudinary(file, 'registrar/templates');
    console.log(`[TemplatesService] Uploaded to Cloudinary: ${uploaded.secure_url}`);

    console.log(`[TemplatesService] Extracting footer assets...`);
    const { footerImageBuffer, footerImageMime, footerText } = extractFooterAssets(file.buffer);
    console.log(`[TemplatesService] Footer extraction: image=${!!footerImageBuffer}, text="${footerText?.substring(0, 50)}..."`);

    let footerImageUrl: string | null = null;
    if (footerImageBuffer) {
      console.log(`[TemplatesService] Uploading footer image to Cloudinary...`);
      try {
        const footerUpload = await uploadToCloudinary(
          {
            buffer: footerImageBuffer,
            mimetype: footerImageMime!,
            originalname: `footer-${Date.now()}.${footerImageMime === 'image/png' ? 'png' : 'jpg'}`,
            size: footerImageBuffer.length,
            fieldname: 'file',
            encoding: '7bit',
          } as Express.Multer.File,
          'registrar/template-assets'
        );
        footerImageUrl = footerUpload.secure_url;
        console.log(`[TemplatesService] Footer image uploaded: ${footerImageUrl}`);
      } catch (err) {
        console.error('[TemplatesService] Failed to upload footer image:', err);
      }
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      console.log(`[TemplatesService] Database transaction started`);

      // Deactivate existing active template
      const deactivateResult = await client.query(
        `UPDATE document_templates
         SET is_active = false, updated_at = NOW()
         WHERE type = $1
           AND COALESCE(department_id, '00000000-0000-0000-0000-000000000000')
             = COALESCE($2::uuid, '00000000-0000-0000-0000-000000000000')
           AND is_active = true`,
        [input.type, input.department_id ?? null]
      );
      console.log(`[TemplatesService] Deactivated ${deactivateResult.rowCount} existing template(s)`);

      // Insert new template
      const { rows } = await client.query(
        `INSERT INTO document_templates
           (type, department_id, file_url, file_public_id, original_name,
            footer_image_url, footer_text, uploaded_by, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8, true)
         RETURNING id`,
        [
          input.type, input.department_id ?? null,
          uploaded.secure_url, uploaded.public_id, file.originalname,
          footerImageUrl, footerText || null, uploadedBy,
        ]
      );

      console.log(`[TemplatesService] Template inserted with ID: ${rows[0].id}`);
      await client.query('COMMIT');
      console.log(`[TemplatesService] Transaction committed`);

      const result = await this.findById(rows[0].id);
      console.log(`[TemplatesService] Upload complete, template:`, result);
      return result!;
      
    } catch (err) {
      console.error('[TemplatesService] Upload failed:', err);
      await client.query('ROLLBACK');
      await deleteFromCloudinary(uploaded.public_id).catch(console.error);
      throw err;
    } finally {
      client.release();
    }
  }

  static async findById(id: string): Promise<DocumentTemplate | null> {
    console.log(`[TemplatesService] findById: ${id}`);
    const { rows } = await pool.query(`SELECT ${SELECT} ${JOIN} WHERE t.id = $1`, [id]);
    return rows[0] ?? null;
  }

  static async findAll(filters: TemplateFilters): Promise<DocumentTemplate[]> {
    console.log(`[TemplatesService] findAll with filters:`, filters);
    const conditions: string[] = [];
    const values: unknown[] = [];
    let p = 1;

    if (filters.type) { 
      conditions.push(`t.type = $${p++}`); 
      values.push(filters.type); 
    }
    if (filters.department_id) { 
      conditions.push(`t.department_id = $${p++}`); 
      values.push(filters.department_id); 
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await pool.query(
      `SELECT ${SELECT} ${JOIN} ${where} ORDER BY t.type, t.department_id NULLS FIRST, t.created_at DESC`,
      values
    );
    console.log(`[TemplatesService] findAll returned ${rows.length} templates`);
    return rows;
  }

  static async getActive(type: TemplateType, departmentId: string | null): Promise<DocumentTemplate | null> {
    console.log(`[TemplatesService] getActive: type=${type}, departmentId=${departmentId || 'global'}`);

    if (departmentId) {
      console.log(`[TemplatesService] Looking for department-specific active template...`);
      const { rows } = await pool.query(
        `SELECT ${SELECT} ${JOIN} WHERE t.type = $1 AND t.department_id = $2 AND t.is_active = true`,
        [type, departmentId]
      );
      if (rows[0]) {
        console.log(`[TemplatesService] Found department-specific template: ${rows[0].id}`);
        return rows[0];
      }
      console.log(`[TemplatesService] No department-specific active template found`);
    }

    console.log(`[TemplatesService] Looking for global active template...`);
    const { rows } = await pool.query(
      `SELECT ${SELECT} ${JOIN} WHERE t.type = $1 AND t.department_id IS NULL AND t.is_active = true`,
      [type]
    );
    
    if (rows[0]) {
      console.log(`[TemplatesService] Found global template: ${rows[0].id}`);
    } else {
      console.log(`[TemplatesService] No global active template found`);
    }
    
    return rows[0] ?? null;
  }

  static async delete(id: string): Promise<void> {
    console.log(`[TemplatesService] delete: ${id}`);
    const template = await this.findById(id);
    if (!template) {
      console.log(`[TemplatesService] Template ${id} not found`);
      throw new AppError(404, 'Template not found');
    }

    await pool.query(`DELETE FROM document_templates WHERE id = $1`, [id]);
    console.log(`[TemplatesService] Template ${id} deleted from database`);
    
    await deleteFromCloudinary(template.file_public_id).catch((err) => {
      console.error(`[TemplatesService] Failed to delete from Cloudinary:`, err);
    });
    console.log(`[TemplatesService] Template ${id} deleted from Cloudinary`);
  }
}