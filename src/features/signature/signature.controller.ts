// src/features/users/signature.controller.ts
import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { AppError, sendSuccess } from '../../utils/response';
import { uploadToCloudinary, deleteFromCloudinary } from '../../config/cloudinary';
import { pool } from '../../config/db';

export const signatureController = {
  uploadSignature: asyncHandler(async (req: Request, res: Response) => {
    const file = req.file;
    if (!file) throw new AppError(400, 'Signature image is required');

    // Delete old signature if exists
    const { rows: existing } = await pool.query(
      `SELECT signature_public_id FROM users WHERE id = $1`,
      [req.user!.id]
    );
    if (existing[0]?.signature_public_id) {
      await deleteFromCloudinary(existing[0].signature_public_id).catch(console.error);
    }

    const uploaded = await uploadToCloudinary(file, 'registrar/signatures');

    await pool.query(
      `UPDATE users SET signature_url = $1, signature_public_id = $2 WHERE id = $3`,
      [uploaded.secure_url, uploaded.public_id, req.user!.id]
    );

    return sendSuccess(res, { signature_url: uploaded.secure_url }, 'Signature saved successfully');
  }),

  deleteSignature: asyncHandler(async (req: Request, res: Response) => {
    const { rows } = await pool.query(
      `SELECT signature_public_id FROM users WHERE id = $1`,
      [req.user!.id]
    );
    if (rows[0]?.signature_public_id) {
      await deleteFromCloudinary(rows[0].signature_public_id).catch(console.error);
    }
    await pool.query(
      `UPDATE users SET signature_url = NULL, signature_public_id = NULL WHERE id = $1`,
      [req.user!.id]
    );
    return sendSuccess(res, null, 'Signature removed');
  }),
};