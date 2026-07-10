// src/features/e-stamp/e-stamp.schema.ts

import { z } from 'zod';

const stampTypeEnum = z.enum(['approved', 'received']);
const stampStatusEnum = z.enum(['pending', 'stamped', 'failed', 'revoked']);

// IP address validation using regex
const ipAddressRegex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

// ── Generate E-Stamp ────────────────────────────────────────────────────────

export const generateEStampSchema = z.object({
    body: z.object({
        document_id: z.string().uuid('Document ID must be a valid UUID'),
        stamp_type: stampTypeEnum,
        signature_url: z.string().url('Signature URL must be a valid URL'),
        metadata: z.object({
            ip_address: z.string().regex(ipAddressRegex, 'Invalid IP address format').optional(),
            user_agent: z.string().optional(),
            department_id: z.string().uuid('Department ID must be a valid UUID').optional(),
            station_name: z.string().optional(),
            department_name: z.string().optional(),
        }).optional(),
    }),
});

// ── Verify E-Stamp ──────────────────────────────────────────────────────────

export const verifyEStampSchema = z.object({
    body: z.object({
        verification_code: z.string().min(8).max(64),
    }),
});

// ── Revoke E-Stamp ──────────────────────────────────────────────────────────

export const revokeEStampSchema = z.object({
    params: z.object({
        id: z.string().uuid('E-Stamp ID must be a valid UUID'),
    }),
    body: z.object({
        reason: z.string().min(1, 'Revocation reason is required').max(500),
    }),
});

// ── Get E-Stamp by Document ────────────────────────────────────────────────

export const getEStampByDocumentSchema = z.object({
    params: z.object({
        document_id: z.string().uuid('Document ID must be a valid UUID'),
    }),
    query: z.object({
        stamp_type: stampTypeEnum.optional(),
    }),
});

// ── List E-Stamps ───────────────────────────────────────────────────────────

export const listEStampsSchema = z.object({
    query: z.object({
        document_id: z.string().uuid().optional(),
        stamp_type: stampTypeEnum.optional(),
        status: z.enum(['active', 'revoked', 'all']).optional(),
        limit: z.string().regex(/^\d+$/).optional().transform(Number),
        offset: z.string().regex(/^\d+$/).optional().transform(Number),
    }),
});

// ── Type exports ────────────────────────────────────────────────────────────

export type GenerateEStampInput = z.infer<typeof generateEStampSchema>['body'];
export type VerifyEStampInput = z.infer<typeof verifyEStampSchema>['body'];
export type RevokeEStampInput = z.infer<typeof revokeEStampSchema>['body'];
export type GetEStampByDocumentQuery = z.infer<typeof getEStampByDocumentSchema>['query'];
export type ListEStampsQuery = z.infer<typeof listEStampsSchema>['query'];