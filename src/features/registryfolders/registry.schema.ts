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

export const getRegistryFolderSchema = z.object({
    params: z.object({
        id: z.string().uuid('Folder ID must be a valid UUID'),
    }),
});

export const getRegistryFolderChildrenSchema = z.object({
    params: z.object({
        id: z.string().uuid('Folder ID must be a valid UUID'),
    }),
    query: z.object({
        limit: z.string().regex(/^\d+$/).optional().transform(Number),
        offset: z.string().regex(/^\d+$/).optional().transform(Number),
    }),
});

export const getRegistryCategoriesSchema = z.object({
    query: z.object({
        include_count: z.string().transform((val) => val === 'true').optional(),
    }),
});

export const getFolderDocumentsSchema = z.object({
    params: z.object({
        id: z.string().uuid('Folder ID must be a valid UUID'),
    }),
    query: z.object({
        limit: z.string().regex(/^\d+$/).optional().transform(Number),
        offset: z.string().regex(/^\d+$/).optional().transform(Number),
    }),
});

export const deleteRegistryFolderSchema = z.object({
    params: z.object({
        id: z.string().uuid('Folder ID must be a valid UUID'),
    }),
});

export const addDocumentToFolderSchema = z.object({
    params: z.object({
        id: z.string().uuid('Folder ID must be a valid UUID'),
    }),
    body: z.object({
        document_id: z.string().uuid('Document ID must be a valid UUID'),
    }).strict(),
});

export const removeDocumentFromFolderSchema = z.object({
    params: z.object({
        id: z.string().uuid('Folder ID must be a valid UUID'),
        documentId: z.string().uuid('Document ID must be a valid UUID'),
    }),
});

export const bulkAddDocumentsToFolderSchema = z.object({
    params: z.object({
        id: z.string().uuid('Folder ID must be a valid UUID'),
    }),
    body: z.object({
        document_ids: z.array(z.string().uuid('Document ID must be a valid UUID')),
    }).strict(),
});

export const moveDocumentToFolderSchema = z.object({
    params: z.object({
        id: z.string().uuid('Source folder ID must be a valid UUID'),
        documentId: z.string().uuid('Document ID must be a valid UUID'),
    }),
    body: z.object({
        target_folder_id: z.string().uuid('Target folder ID must be a valid UUID'),
    }).strict(),
});

export const searchRegistryFoldersSchema = z.object({
    query: z.object({
        q: z.string().min(2, 'Search query must be at least 2 characters'),
        limit: z.string().regex(/^\d+$/).optional().transform(Number),
        offset: z.string().regex(/^\d+$/).optional().transform(Number),
    }),
});

export const getRootFoldersSchema = z.object({
    query: z.object({
        include_stats: z.string().transform((val) => val === 'true').optional(),
    }),
});

export const getActiveFoldersSchema = z.object({
    query: z.object({
        limit: z.string().regex(/^\d+$/).optional().transform(Number),
        offset: z.string().regex(/^\d+$/).optional().transform(Number),
    }),
});

export const getFolderHierarchySchema = z.object({
    params: z.object({
        id: z.string().uuid('Folder ID must be a valid UUID'),
    }),
});

export const getFolderStatisticsSchema = z.object({
    query: z.object({
        include_document_stats: z.string().transform((val) => val === 'true').optional(),
    }),
});

export const moveFolderSchema = z.object({
    params: z.object({
        id: z.string().uuid('Folder ID must be a valid UUID'),
    }),
    body: z.object({
        parent_folder_id: z.string().uuid('Target folder ID must be a valid UUID').nullable(),
    }).strict(),
});

export type CreateRegistryFolderBody = z.infer<typeof createRegistryFolderSchema>['body'];
export type UpdateRegistryFolderBody = z.infer<typeof updateRegistryFolderSchema>['body'];
export type ListRegistryFoldersQuery = z.infer<typeof listRegistryFoldersSchema>['query'];
export type GetFolderChildrenQuery = z.infer<typeof getRegistryFolderChildrenSchema>['query'];
export type GetFolderDocumentsQuery = z.infer<typeof getFolderDocumentsSchema>['query'];
export type MoveDocumentToFolderBody = z.infer<typeof moveDocumentToFolderSchema>['body'];
export type AddDocumentToFolderBody = z.infer<typeof addDocumentToFolderSchema>['body'];
export type RemoveDocumentFromFolderParams = z.infer<typeof removeDocumentFromFolderSchema>['params'];
export type BulkAddDocumentsToFolderBody = z.infer<typeof bulkAddDocumentsToFolderSchema>['body'];
export type SearchRegistryFoldersQuery = z.infer<typeof searchRegistryFoldersSchema>['query'];
export type MoveFolderBody = z.infer<typeof moveFolderSchema>['body'];