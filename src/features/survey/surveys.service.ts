// src/features/surveys/surveys.service.ts

import { randomUUID } from 'crypto';
import { pool } from '../../config/db';
import { AppError } from '../../utils/response';
import type {
  Survey,
  SurveyField,
  SurveyResponseRecord,
  SurveyDraftRecord,
  CreateSurveyInput,
  UpdateSurveyInput,
  PublicSurveyView,
} from './surveys.types';

const SURVEY_SELECT = `id, slug, permanent_slug, title, description, fields, status, created_by, created_at, updated_at`;

// Postgres error codes we handle explicitly instead of letting them bubble as 500s
const PG_UNIQUE_VIOLATION = '23505';
const PG_FOREIGN_KEY_VIOLATION = '23503';

function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return `${base}-${Date.now().toString(36)}`;
}

function generatePermanentSlug(title: string): string {
  // Generate a clean slug without timestamp
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * Ensures a permanent_slug is unique by appending a random suffix if needed
 */
async function ensureUniquePermanentSlug(permanentSlug: string): Promise<string> {
  let uniqueSlug = permanentSlug;
  let isUnique = false;
  let attempts = 0;

  while (!isUnique && attempts < 10) {
    const existing = await pool.query(
      'SELECT id FROM surveys WHERE permanent_slug = $1',
      [uniqueSlug]
    );
    if (existing.rows.length === 0) {
      isUnique = true;
    } else {
      uniqueSlug = `${permanentSlug}-${Date.now().toString(36)}`;
      attempts++;
    }
  }

  if (!isUnique) {
    throw new AppError(409, 'Unable to generate a unique permanent slug');
  }

  return uniqueSlug;
}

/** Treats `undefined`, `null`, empty string, and empty array as "not answered". */
function isEmptyValue(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v === 'string') return v.trim().length === 0;
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

/** For dropdown/checkbox fields, ensures every submitted value is one of the field's defined options. */
function validateFieldOptions(field: SurveyField, value: string | string[] | undefined): string | null {
  if (field.type !== 'dropdown' && field.type !== 'checkbox') return null;
  if (isEmptyValue(value)) return null; // required-ness is checked separately

  const options = field.options ?? [];
  const submitted = Array.isArray(value) ? value : [value as string];
  const invalid = submitted.filter((v) => !options.includes(v));

  if (invalid.length) {
    return `Invalid option(s) for "${field.label}": ${invalid.join(', ')}`;
  }
  return null;
}

/** Validates numbered_list field - ensures array and min/max constraints */
function validateNumberedList(field: SurveyField, value: unknown): string | null {
  if (field.type !== 'numbered_list') return null;
  if (isEmptyValue(value)) return null; // required-ness is checked separately

  if (!Array.isArray(value)) {
    return `"${field.label}" must be an array of items`;
  }

  const items = value.filter((v) => typeof v === 'string' && v.trim().length > 0);
  
  if (field.min !== undefined && items.length < field.min) {
    return `"${field.label}" requires at least ${field.min} item${field.min > 1 ? 's' : ''}`;
  }

  if (field.max !== undefined && items.length > field.max) {
    return `"${field.label}" allows at most ${field.max} item${field.max > 1 ? 's' : ''}`;
  }

  return null;
}

export class SurveyService {
  static async create(input: CreateSurveyInput, createdBy: string): Promise<Survey> {
    const fields: SurveyField[] = input.fields.map((f) => ({ ...f, id: randomUUID() }));
    const slug = slugify(input.title);
    
    // Use provided permanent_slug or generate from title
    let permanentSlug = input.permanent_slug || generatePermanentSlug(input.title);
    
    // Ensure permanent_slug is unique
    permanentSlug = await ensureUniquePermanentSlug(permanentSlug);

    try {
      const { rows } = await pool.query(
        `INSERT INTO surveys (slug, permanent_slug, title, description, fields, status, created_by)
         VALUES ($1, $2, $3, $4, $5, 'draft', $6)
         RETURNING ${SURVEY_SELECT}`,
        [slug, permanentSlug, input.title.trim(), input.description?.trim() ?? null, JSON.stringify(fields), createdBy],
      );
      return rows[0];
    } catch (err: any) {
      if (err?.code === PG_UNIQUE_VIOLATION) {
        throw new AppError(409, 'A survey with this title or permanent slug already exists');
      }
      throw err;
    }
  }

  static async findAll(): Promise<Survey[]> {
    const { rows } = await pool.query(`SELECT ${SURVEY_SELECT} FROM surveys ORDER BY created_at DESC`);
    return rows;
  }

  static async findById(id: string): Promise<Survey | null> {
    const { rows } = await pool.query(`SELECT ${SURVEY_SELECT} FROM surveys WHERE id = $1`, [id]);
    return rows[0] ?? null;
  }

  static async findBySlug(slug: string): Promise<Survey | null> {
    const { rows } = await pool.query(`SELECT ${SURVEY_SELECT} FROM surveys WHERE slug = $1`, [slug]);
    return rows[0] ?? null;
  }

  static async findByPermanentSlug(permanentSlug: string): Promise<Survey | null> {
    const { rows } = await pool.query(
      `SELECT ${SURVEY_SELECT} FROM surveys WHERE permanent_slug = $1`,
      [permanentSlug]
    );
    return rows[0] ?? null;
  }

  /** Admin "get one" — for populating an edit form. Unlike getPublicView, works regardless of status. */
  static async getForAdmin(id: string, requester: { id: string; role?: string }): Promise<Survey> {
    const survey = await this.findById(id);
    if (!survey) throw new AppError(404, 'Survey not found');
    this.assertOwnerOrAdmin(survey, requester);
    return survey;
  }

  /** Throws 403 unless requester created the survey or holds an elevated role. */
  private static assertOwnerOrAdmin(survey: Survey, requester: { id: string; role?: string }): void {
    const isOwner = survey.created_by === requester.id;
    const isAdmin = requester.role === 'admin' || requester.role === 'super_admin';
    if (!isOwner && !isAdmin) {
      throw new AppError(403, 'You do not have permission to access this survey');
    }
  }

  static async update(
    id: string,
    input: UpdateSurveyInput,
    requester: { id: string; role?: string },
  ): Promise<Survey> {
    const existing = await this.findById(id);
    if (!existing) throw new AppError(404, 'Survey not found');
    this.assertOwnerOrAdmin(existing, requester);

    const updates: string[] = [];
    const values: unknown[] = [];
    let p = 1;

    if (input.title !== undefined) {
      updates.push(`title = $${p++}`);
      values.push(input.title.trim());
      // When title changes, update the auto-generated slug too
      updates.push(`slug = $${p++}`);
      values.push(slugify(input.title));
      // NEVER update permanent_slug - it stays the same forever
    }
    if (input.description !== undefined) {
      updates.push(`description = $${p++}`);
      values.push(input.description);
    }
    if (input.fields !== undefined) {
      const fields: SurveyField[] = input.fields.map((f) =>
        'id' in f && f.id ? (f as SurveyField) : { ...f, id: randomUUID() },
      );
      updates.push(`fields = $${p++}`);
      values.push(JSON.stringify(fields));
    }
    if (input.status !== undefined) {
      updates.push(`status = $${p++}`);
      values.push(input.status);
    }

    if (!updates.length) throw new AppError(400, 'No valid fields provided to update');

    updates.push(`updated_at = NOW()`);
    values.push(id);

    await pool.query(`UPDATE surveys SET ${updates.join(', ')} WHERE id = $${p}`, values);
    return (await this.findById(id))!;
  }

  static async delete(id: string, requester: { id: string; role?: string }): Promise<void> {
    const existing = await this.findById(id);
    if (!existing) throw new AppError(404, 'Survey not found');
    this.assertOwnerOrAdmin(existing, requester);

    try {
      const { rows } = await pool.query(`DELETE FROM surveys WHERE id = $1 RETURNING id`, [id]);
      if (!rows.length) throw new AppError(404, 'Survey not found');
    } catch (err: any) {
      if (err?.code === PG_FOREIGN_KEY_VIOLATION) {
        throw new AppError(409, 'Cannot delete a survey that already has responses');
      }
      throw err;
    }
  }

  static async getPublicView(permanentSlug: string): Promise<PublicSurveyView> {
    const survey = await this.findByPermanentSlug(permanentSlug);
    if (!survey || survey.status !== 'active') {
      throw new AppError(404, 'Survey not found or not accepting responses');
    }
    // Only expose what the public form needs — never leak created_by, internal ids, etc.
    return {
      permanent_slug: survey.permanent_slug,
      title: survey.title,
      description: survey.description,
      fields: survey.fields
    };
  }

  // ---- Draft Methods ----

  static async getDraft(permanentSlug: string, ip?: string): Promise<SurveyDraftRecord | null> {
    const survey = await this.findByPermanentSlug(permanentSlug);
    if (!survey) throw new AppError(404, 'Survey not found');

    const { rows } = await pool.query(
      `SELECT id, survey_id, draft_data, submitter_ip, created_at, updated_at 
       FROM survey_drafts 
       WHERE survey_id = $1 AND submitter_ip = $2`,
      [survey.id, ip ?? 'unknown']
    );
    return rows[0] ?? null;
  }

  static async saveDraft(
    permanentSlug: string,
    draftData: Record<string, string | string[]>,
    ip?: string
  ): Promise<{ id: string }> {
    const survey = await this.findByPermanentSlug(permanentSlug);
    if (!survey) throw new AppError(404, 'Survey not found');

    const { rows } = await pool.query(
      `INSERT INTO survey_drafts (survey_id, draft_data, submitter_ip, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (survey_id, submitter_ip) 
       DO UPDATE SET draft_data = $2, updated_at = NOW()
       RETURNING id`,
      [survey.id, JSON.stringify(draftData), ip ?? 'unknown']
    );
    return rows[0];
  }

  static async deleteDraft(permanentSlug: string, ip?: string): Promise<void> {
    const survey = await this.findByPermanentSlug(permanentSlug);
    if (!survey) return;

    await pool.query(
      `DELETE FROM survey_drafts WHERE survey_id = $1 AND submitter_ip = $2`,
      [survey.id, ip ?? 'unknown']
    );
  }

  // ---- Response Methods ----

  static async submitResponse(
    permanentSlug: string,
    responseData: Record<string, string | string[]>,
    ip?: string,
  ): Promise<SurveyResponseRecord> {
    const survey = await this.findByPermanentSlug(permanentSlug);
    if (!survey) throw new AppError(404, 'Survey not found');
    if (survey.status !== 'active') throw new AppError(400, 'This survey is not currently accepting responses');

    const errors: string[] = [];

    for (const field of survey.fields) {
      const value = responseData[field.id];

      // Required validation
      if (field.required && isEmptyValue(value)) {
        errors.push(`"${field.label}" is required`);
        continue;
      }

      // Skip further validation if empty and not required
      if (isEmptyValue(value)) continue;

      // Field-specific validation
      if (field.type === 'dropdown' || field.type === 'checkbox') {
        const optionError = validateFieldOptions(field, value);
        if (optionError) errors.push(optionError);
      }

      if (field.type === 'numbered_list') {
        const listError = validateNumberedList(field, value);
        if (listError) errors.push(listError);
      }

      if ((field.type === 'text' || field.type === 'textarea') && typeof value === 'string') {
        if (field.min !== undefined && value.length < field.min) {
          errors.push(`"${field.label}" must be at least ${field.min} characters`);
        }
        if (field.max !== undefined && value.length > field.max) {
          errors.push(`"${field.label}" must be at most ${field.max} characters`);
        }
      }
    }

    if (errors.length) {
      throw new AppError(400, errors.join('; '));
    }

    const { rows } = await pool.query(
      `INSERT INTO survey_responses (survey_id, response_data, submitter_ip)
       VALUES ($1, $2, $3) RETURNING *`,
      [survey.id, JSON.stringify(responseData), ip ?? null],
    );
    return rows[0];
  }

  static async getResponses(surveyId: string, requester: { id: string; role?: string }): Promise<SurveyResponseRecord[]> {
    const survey = await this.findById(surveyId);
    if (!survey) throw new AppError(404, 'Survey not found');
    this.assertOwnerOrAdmin(survey, requester);

    const { rows } = await pool.query(
      `SELECT * FROM survey_responses WHERE survey_id = $1 ORDER BY submitted_at DESC`,
      [surveyId],
    );
    return rows;
  }
}