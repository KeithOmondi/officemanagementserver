// src/features/registry/registry.schema.ts

import { z } from 'zod';

const folderStatusEnum = z.enum(['active', 'archived', 'closed']);
const folderCategoryEnum = z.enum([
    'court',
    'directorate',
    'general',
    'judges',
    'committee',
    'training',
    'hr',
    'finance',
    'procurement',
    'ict',
    'legal',
    'projects',
    'other',
]);

// ── POST /api/registry/folders ──────────────────────────────────────────────
export const createRegistryFolderSchema = z.object({
    body: z.object({
        ref_no: z.string().min(3).max(50),
        name: z.string().min(1).max(200),
        category: folderCategoryEnum,
        description: z.string().max(500).optional(),
        parent_folder_id: z.string().uuid().optional().nullable(),
        status: folderStatusEnum.default('active'),
        department_id: z.string().uuid().optional(),
    }),
});

// ── PUT /api/registry/folders/:id ───────────────────────────────────────────
export const updateRegistryFolderSchema = z.object({
    params: z.object({
        id: z.string().uuid('Folder ID must be a valid UUID'),
    }),
    body: z.object({
        name: z.string().min(1).max(200).optional(),
        description: z.string().max(500).optional(),
        status: folderStatusEnum.optional(),
        department_id: z.string().uuid().optional(),
    }),
});

// ── GET /api/registry/folders ───────────────────────────────────────────────
export const listRegistryFoldersSchema = z.object({
    query: z.object({
        search: z.string().optional(),
        category: folderCategoryEnum.optional(),
        status: folderStatusEnum.optional(),
        parent_folder_id: z.string().uuid().optional().nullable(),
        department_id: z.string().uuid().optional(),
        limit: z.string().regex(/^\d+$/).optional().transform(Number),
        offset: z.string().regex(/^\d+$/).optional().transform(Number),
        include_sub_folders: z.string().transform((val) => val === 'true').optional(),
    }).strict(),
});

// ── GET /api/registry/folders/:id ───────────────────────────────────────────
export const getRegistryFolderSchema = z.object({
    params: z.object({
        id: z.string().uuid('Folder ID must be a valid UUID'),
    }),
});

// ── GET /api/registry/folders/:id/children ──────────────────────────────────
export const getRegistryFolderChildrenSchema = z.object({
    params: z.object({
        id: z.string().uuid('Folder ID must be a valid UUID'),
    }),
    query: z.object({
        limit: z.string().regex(/^\d+$/).optional().transform(Number),
        offset: z.string().regex(/^\d+$/).optional().transform(Number),
    }),
});

// ── GET /api/registry/folders/categories ────────────────────────────────────
export const getRegistryCategoriesSchema = z.object({
    query: z.object({
        include_count: z.string().transform((val) => val === 'true').optional(),
    }),
});

// ── GET /api/registry/folders/:id/documents ─────────────────────────────────
export const getFolderDocumentsSchema = z.object({
    params: z.object({
        id: z.string().uuid('Folder ID must be a valid UUID'),
    }),
    query: z.object({
        limit: z.string().regex(/^\d+$/).optional().transform(Number),
        offset: z.string().regex(/^\d+$/).optional().transform(Number),
    }),
});

// ── DELETE /api/registry/folders/:id ────────────────────────────────────────
export const deleteRegistryFolderSchema = z.object({
    params: z.object({
        id: z.string().uuid('Folder ID must be a valid UUID'),
    }),
});

// ── Type exports ─────────────────────────────────────────────────────────────
export type CreateRegistryFolderBody = z.infer<typeof createRegistryFolderSchema>['body'];
export type UpdateRegistryFolderBody = z.infer<typeof updateRegistryFolderSchema>['body'];
export type ListRegistryFoldersQuery = z.infer<typeof listRegistryFoldersSchema>['query'];
export type GetFolderChildrenQuery = z.infer<typeof getRegistryFolderChildrenSchema>['query'];
export type GetFolderDocumentsQuery = z.infer<typeof getFolderDocumentsSchema>['query'];