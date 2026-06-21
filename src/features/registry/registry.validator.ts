// src/features/registry/registry.validator.ts
import { z } from 'zod';

export const registryPriorityEnum = z.enum([
  'normal', 'urgent', 'confidential', 'for_information_only',
]);

export const registryStatusEnum = z.enum([
  'in_transit', 'received', 'filed', 'returned',
]);

// ── Route a document to a station ────────────────────────────────────────────

export const routeFileSchema = z.object({
  body: z.object({
    document_id: z.string().uuid('Must be a valid document ID'),
    station_id:  z.string().uuid('Must be a valid station ID'),
    priority:    registryPriorityEnum.default('normal'),
    note:        z.string().max(1000).trim().optional(),
  }).strict(),
});

// ── Receive (station acknowledges the file arrived) ──────────────────────────

export const receiveFileSchema = z.object({
  body: z.object({}).strict(),
});

// ── Mark filed (closed out at the station) ───────────────────────────────────

export const markFiledSchema = z.object({
  body: z.object({}).strict(),
});

// ── Return to registry ────────────────────────────────────────────────────────

export const returnFileSchema = z.object({
  body: z.object({
    note: z.string().max(1000).trim().optional(),
  }).strict(),
});

// ── Filters ───────────────────────────────────────────────────────────────────

export const registryFiltersSchema = z.object({
  query: z.object({
    document_id: z.string().uuid().optional(),
    station_id:  z.string().uuid().optional(),
    status:      registryStatusEnum.optional(),
    priority:    registryPriorityEnum.optional(),
    page:        z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1)).optional(),
    limit:       z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
    sort_by:     z.enum(['routed_at', 'received_at', 'created_at']).optional(),
    sort_order:  z.enum(['ASC', 'DESC']).optional(),
  }),
});

// ── ID params ─────────────────────────────────────────────────────────────────

export const registryIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Registry entry ID must be a valid UUID'),
  }),
});

export const documentIdParamSchema = z.object({
  params: z.object({
    documentId: z.string().uuid('Document ID must be a valid UUID'),
  }),
});

// ── Inferred types ────────────────────────────────────────────────────────────

export type RouteFileInput   = z.infer<typeof routeFileSchema>['body'];
export type ReturnFileInput  = z.infer<typeof returnFileSchema>['body'];
export type RegistryFilters  = z.infer<typeof registryFiltersSchema>['query'];