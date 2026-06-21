// src/features/stream/streamFile.ts
import https from 'https';
import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { AppError } from '../../utils/response';
import { env } from '../../config/env';
import { cloudinary } from '../../config/cloudinary';
import { pool } from '../../config/db';
import type { UserRole } from '../../middleware/auth.middleware';

const PRIVILEGED_ROLES: UserRole[] = ['super_admin', 'dept_head'];

const MIME_MAP: Record<string, string> = {
  pdf:  'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  jpg:  'image/jpeg',
  jpeg: 'image/jpeg',
  png:  'image/png',
  webp: 'image/webp',
  mp4:  'video/mp4',
};

/**
 * Extracts the Cloudinary public_id from a secure URL.
 * e.g. https://res.cloudinary.com/mycloud/raw/upload/v123/docs/file.pdf
 * →    docs/file.pdf
 */
const extractPublicId = (url: string): string => {
  const match = url.match(/\/upload\/(?:v\d+\/)?(.+)$/);
  if (!match) throw new AppError(400, 'Could not parse Cloudinary public ID from URL.');
  return match[1];
};

export const streamFile = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) throw new AppError(401, 'Authentication required.');

  const rawUrl = req.query.url as string;
  if (!rawUrl) throw new AppError(400, 'File URL is required.');

  const url = decodeURIComponent(rawUrl);

  // ── Validate it's our Cloudinary cloud ──────────────────────────────────
  if (!url.startsWith('https://res.cloudinary.com/')) {
    throw new AppError(400, 'Invalid file URL provided.');
  }

  const cloudMatch = url.match(/^https:\/\/res\.cloudinary\.com\/([^/]+)\//);
  if (!cloudMatch || cloudMatch[1] !== env.CLOUDINARY_CLOUD_NAME) {
    throw new AppError(403, 'Unable to verify file source. Access denied.');
  }

  // ── Authorisation ────────────────────────────────────────────────────────
  let isAuthorized = false;

  if (user.role === 'super_admin') {
    const { rows } = await pool.query<{ id: string }>(
      `SELECT id FROM documents WHERE file_url = $1 AND is_active = TRUE LIMIT 1`,
      [url],
    );
    isAuthorized = rows.length > 0;

  } else if (user.role === 'dept_head') {
    const { rows } = await pool.query<{ id: string }>(
      `SELECT id FROM documents
       WHERE file_url = $1 AND is_active = TRUE AND department_id = $2 LIMIT 1`,
      [url, user.department_id],
    );
    isAuthorized = rows.length > 0;

  } else {
    // staff / viewer — must be the assigned user within their department
    const { rows } = await pool.query<{ id: string }>(
      `SELECT id FROM documents
       WHERE file_url = $1 AND is_active = TRUE
         AND assigned_to = $2 AND department_id = $3 LIMIT 1`,
      [url, user.id, user.department_id],
    );
    isAuthorized = rows.length > 0;
  }

  if (!isAuthorized) {
    throw new AppError(403, "You don't have permission to access this file.");
  }

  // ── Parse URL parts ──────────────────────────────────────────────────────
  const resourceTypeMatch = url.match(/\/(\w+)\/upload\//);
  const resourceType = (resourceTypeMatch?.[1] ?? 'raw') as 'image' | 'video' | 'raw';

  const publicId  = extractPublicId(url);
  const ext       = publicId.split('.').pop()?.toLowerCase() ?? '';
  const contentType = MIME_MAP[ext] ?? 'application/octet-stream';

  // ── Generate a 60-second signed URL then pipe it ─────────────────────────
  const signedUrl = cloudinary.utils.private_download_url(publicId, ext, {
    resource_type: resourceType,
    expires_at:    Math.floor(Date.now() / 1000) + 60,
  });

  res.setHeader('Content-Type',  contentType);
  res.setHeader('Cache-Control', 'private, no-store');

  await new Promise<void>((resolve, reject) => {
    https.get(signedUrl, (upstream) => {
      // Forward a non-200 from Cloudinary as a 502
      if (upstream.statusCode && upstream.statusCode >= 400) {
        reject(new AppError(502, `Cloudinary returned ${upstream.statusCode}.`));
        upstream.resume(); // drain the socket
        return;
      }

      const len = upstream.headers['content-length'];
      if (len) res.setHeader('Content-Length', len);

      upstream.pipe(res);
      upstream.on('end',   resolve);
      upstream.on('error', reject);
    }).on('error', reject);
  });
});