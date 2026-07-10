// src/features/e-stamp/e-stamp.controller.ts

import { Request, Response, NextFunction } from 'express';
import { EStampService } from './e-stamp.service';
import { AppError, sendSuccess } from '../../utils/response';
import {
    generateEStampSchema,
    verifyEStampSchema,
    revokeEStampSchema,
    getEStampByDocumentSchema,
    listEStampsSchema,
} from './e-stamp.schema';

function getParam(req: Request, key: string): string {
    const value = req.params[key];
    if (Array.isArray(value)) {
        throw new AppError(400, `Parameter ${key} must be a string`);
    }
    if (!value) {
        throw new AppError(400, `Parameter ${key} is required`);
    }
    return value;
}

export class EStampController {

    // ── POST /api/e-stamps/generate ──────────────────────────────────────────
    static async generateEStamp(req: Request, res: Response, next: NextFunction) {
        try {
            const body = req.body;
            const userId = (req as any).user?.id as string;

            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: 'User not authenticated',
                });
            }

            const stamp = await EStampService.generateEStamp(body, userId);

            console.log(`📜 E-Stamp generated:`, {
                id: stamp.id,
                document_id: stamp.document_id,
                stamp_type: stamp.stamp_type,
                userId,
            });

            return sendSuccess(res, stamp, 'E-Stamp generated successfully', 201);
        } catch (err) {
            next(err);
        }
    }

    // ── POST /api/e-stamps/verify ────────────────────────────────────────────
    static async verifyEStamp(req: Request, res: Response, next: NextFunction) {
        try {
            const { verification_code } = req.body;

            if (!verification_code) {
                throw new AppError(400, 'Verification code is required');
            }

            const result = await EStampService.verifyEStamp(verification_code);

            return sendSuccess(res, result, result.valid ? 'E-Stamp verified successfully' : 'E-Stamp verification failed');
        } catch (err) {
            next(err);
        }
    }

    // ── POST /api/e-stamps/:id/revoke ────────────────────────────────────────
    static async revokeEStamp(req: Request, res: Response, next: NextFunction) {
        try {
            const id = getParam(req, 'id');
            const userId = (req as any).user?.id as string;
            const { reason } = req.body;

            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: 'User not authenticated',
                });
            }

            if (!reason) {
                throw new AppError(400, 'Revocation reason is required');
            }

            await EStampService.revokeEStamp(id, userId, reason);

            console.log(`📜 E-Stamp revoked:`, { id, userId, reason });

            return sendSuccess(res, null, 'E-Stamp revoked successfully');
        } catch (err) {
            next(err);
        }
    }

    // ── GET /api/e-stamps/document/:document_id ─────────────────────────────
    static async getEStampByDocument(req: Request, res: Response, next: NextFunction) {
        try {
            const document_id = getParam(req, 'document_id');
            const { stamp_type } = req.query;

            const stamp = await EStampService.getEStampByDocument(
                document_id,
                stamp_type as any
            );

            if (!stamp) {
                throw new AppError(404, 'No e-stamp found for this document');
            }

            return sendSuccess(res, stamp, 'E-Stamp retrieved successfully');
        } catch (err) {
            next(err);
        }
    }

    // ── GET /api/e-stamps ─────────────────────────────────────────────────────
    static async listEStamps(req: Request, res: Response, next: NextFunction) {
        try {
            const { document_id, stamp_type, status, limit, offset } = req.query;

            const stamps = await EStampService.listEStamps({
                document_id: document_id as string,
                stamp_type: stamp_type as any,
                status: status as string,
                limit: limit ? Number(limit) : undefined,
                offset: offset ? Number(offset) : undefined,
            });

            return sendSuccess(res, stamps, `Found ${stamps.length} e-stamps`);
        } catch (err) {
            next(err);
        }
    }
}