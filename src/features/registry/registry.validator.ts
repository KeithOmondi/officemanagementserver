// src/features/registry/registry.validator.ts
import { z } from 'zod';

// ── Enums ──────────────────────────────────────────────────────────────────────

export const registryPriorityEnum = z.enum([
  'normal', 'urgent', 'confidential', 'for_information_only',
]);

// Simplified status - only 'active' and 'returned'
export const registryStatusEnum = z.enum([
  'active', 'returned',
]);

export const folderCategoryEnum = z.enum([
  'court', 'registry', 'administrative', 'other',
]);

export const folderStatusEnum = z.enum([
  'active', 'archived',
]);

export const documentSourceEnum = z.enum([
  'routed', 'direct',
]);

// ── Station Type Validation ──────────────────────────────────────────────────
// We no longer validate station types against a predefined list
// since we allow custom types. This is a no-op validator that accepts any string.

export const stationTypeSchema = z.string()
  .min(1, 'Station type is required')
  .max(100, 'Station type is too long');

// ── Court Reference Number Validation ──────────────────────────────────────

/**
 * Validates a court reference number in the format: RHC/[CODE]/[NUMBER]
 * Examples: RHC/MSB/22, RHC/KAB/23, RHC/GRN/24
 */
export const courtReferenceSchema = z.string()
  .regex(/^RHC\/[A-Z]{2,4}\/\d{1,3}$/, 
    'Reference must be in format: RHC/[CODE]/[NUMBER] (e.g., RHC/MSB/22)')
  .min(8, 'Reference number is too short')
  .max(15, 'Reference number is too long');

// ── Document Reference Number (for non-court docs) ──────────────────────────

export const documentRefNoSchema = z.string()
  .min(2, 'Reference number must be at least 2 characters')
  .max(50, 'Reference number is too long')
  .optional()
  .nullable();

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

// ── Return to registry ────────────────────────────────────────────────────────

export const returnFileSchema = z.object({
  body: z.object({
    note: z.string().max(1000).trim().optional(),
  }).strict(),
});

// ── Direct Document Upload Schemas ──────────────────────────────────────────

/**
 * Single direct document upload to a station
 * The file is handled by multer separately, so we only validate the body fields
 */
export const directUploadSchema = z.object({
  body: z.object({
    title:     z.string().min(1, 'Document title is required').max(200, 'Title is too long'),
    ref_no:    documentRefNoSchema,
    station_id: z.string().uuid('Must be a valid station ID'),
    priority:  registryPriorityEnum.default('normal'),
    note:      z.string().max(1000).trim().optional(),
  }).strict(),
});

/**
 * Bulk direct document upload to a station
 * Multiple files uploaded at once, same station and priority
 */
export const bulkDirectUploadSchema = z.object({
  body: z.object({
    station_id: z.string().uuid('Must be a valid station ID'),
    priority:   registryPriorityEnum.default('normal'),
    note:       z.string().max(1000).trim().optional(),
  }).strict(),
});

/**
 * Upload document to a specific folder
 */
export const uploadDocumentToFolderSchema = z.object({
  body: z.object({
    title:     z.string().min(1, 'Document title is required').max(200, 'Title is too long'),
    ref_no:    documentRefNoSchema,
    priority:  registryPriorityEnum.default('normal'),
    note:      z.string().max(1000).trim().optional(),
  }).strict(),
  params: z.object({
    id: z.string().uuid('Folder ID must be a valid UUID'),
  }),
});

// ── Filters ───────────────────────────────────────────────────────────────────

export const registryFiltersSchema = z.object({
  query: z.object({
    document_id: z.string().uuid().optional(),
    station_id:  z.string().uuid().optional(),
    status:      registryStatusEnum.optional(),
    priority:    registryPriorityEnum.optional(),
    source:      documentSourceEnum.optional(),
    page:        z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1)).optional(),
    limit:       z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
    sort_by:     z.enum(['routed_at', 'received_at', 'created_at']).optional(),
    sort_order:  z.enum(['ASC', 'DESC']).optional(),
  }),
});

// ── Folder/Court Record Validation ─────────────────────────────────────────

export const createFolderSchema = z.object({
  body: z.object({
    ref_no:          courtReferenceSchema,
    name:            z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name is too long'),
    category:        folderCategoryEnum.default('court'),
    description:     z.string().max(500).trim().optional(),
    parent_folder_id: z.string().uuid('Parent folder ID must be a valid UUID').optional(),
    status:          folderStatusEnum.default('active'),
  }).strict(),
});

export const updateFolderSchema = z.object({
  body: z.object({
    name:        z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name is too long').optional(),
    description: z.string().max(500).trim().optional(),
    status:      folderStatusEnum.optional(),
    // Note: ref_no is NOT allowed to be updated - it's the unique identifier
  }).strict(),
  params: z.object({
    id: z.string().uuid('Folder ID must be a valid UUID'),
  }),
});

export const folderIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('Folder ID must be a valid UUID'),
  }),
});

// ── Move Folder ────────────────────────────────────────────────────────────────

export const moveFolderSchema = z.object({
  body: z.object({
    parent_folder_id: z.string().uuid('Parent folder ID must be a valid UUID').nullable().optional(),
  }).strict(),
  params: z.object({
    id: z.string().uuid('Folder ID must be a valid UUID'),
  }),
});

// ── Add Document to Folder ─────────────────────────────────────────────────────

export const addDocumentToFolderSchema = z.object({
  body: z.object({
    document_id: z.string().uuid('Must be a valid document ID'),
  }).strict(),
  params: z.object({
    id: z.string().uuid('Folder ID must be a valid UUID'),
  }),
});

// ── Bulk Add Documents to Folder ──────────────────────────────────────────────

export const bulkAddDocumentsSchema = z.object({
  body: z.object({
    document_ids: z.array(z.string().uuid('Must be a valid document ID'))
      .min(1, 'At least one document ID is required')
      .max(100, 'Cannot add more than 100 documents at once'),
  }).strict(),
  params: z.object({
    id: z.string().uuid('Folder ID must be a valid UUID'),
  }),
});

// ── Remove Document from Folder ───────────────────────────────────────────────

export const removeDocumentFromFolderSchema = z.object({
  params: z.object({
    id: z.string().uuid('Folder ID must be a valid UUID'),
    documentId: z.string().uuid('Document ID must be a valid UUID'),
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

// ── Folder Query Filters ──────────────────────────────────────────────────────

export const folderFiltersSchema = z.object({
  query: z.object({
    category:           folderCategoryEnum.optional(),
    status:             folderStatusEnum.optional(),
    search:             z.string().min(2, 'Search query must be at least 2 characters').optional(),
    include_sub_folders: z.string().transform(val => val === 'true').optional(),
  }),
});

// ── Search Query ──────────────────────────────────────────────────────────────

export const searchQuerySchema = z.object({
  query: z.object({
    q: z.string().min(2, 'Search query must be at least 2 characters'),
    source: documentSourceEnum.optional(),
  }),
});

// ── Get Folder Documents by Station ──────────────────────────────────────────

export const getStationFolderDocumentsSchema = z.object({
  params: z.object({
    stationId: z.string().uuid('Station ID must be a valid UUID'),
  }),
  query: z.object({
    page:  z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1)).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
    source: documentSourceEnum.optional(),
  }),
});

// ── Move Document to Folder ──────────────────────────────────────────────────

export const moveDocumentToFolderSchema = z.object({
  params: z.object({
    id: z.string().uuid('Source folder ID must be a valid UUID'),
    documentId: z.string().uuid('Document ID must be a valid UUID'),
  }),
  body: z.object({
    target_folder_id: z.string().uuid('Target folder ID must be a valid UUID'),
  }).strict(),
});

// ── Update Document Metadata ────────────────────────────────────────────────

export const updateDocumentMetadataSchema = z.object({
  params: z.object({
    documentId: z.string().uuid('Document ID must be a valid UUID'),
  }),
  body: z.object({
    title:     z.string().min(1, 'Document title is required').max(200, 'Title is too long').optional(),
    ref_no:    documentRefNoSchema,
    priority:  registryPriorityEnum.optional(),
    note:      z.string().max(1000).trim().optional(),
  }).strict(),
});

// ── Delete Document ─────────────────────────────────────────────────────────

export const deleteDocumentSchema = z.object({
  params: z.object({
    documentId: z.string().uuid('Document ID must be a valid UUID'),
  }),
  body: z.object({
    delete_from_storage: z.boolean().default(false).optional(),
  }).strict(),
});

// ── Get Document Details ────────────────────────────────────────────────────

export const getDocumentDetailsSchema = z.object({
  params: z.object({
    documentId: z.string().uuid('Document ID must be a valid UUID'),
  }),
});

// ── File Validation Schemas ─────────────────────────────────────────────────

/**
 * Cloudinary upload configuration validator
 */
export const cloudinaryUploadConfigSchema = z.object({
  folder: z.string().min(1, 'Folder path is required'),
  maxFileSize: z.number().int().positive('Max file size must be positive'),
  allowedFormats: z.array(z.string().min(1)).min(1, 'At least one allowed format is required'),
  allowedMimeTypes: z.array(z.string().min(1)).min(1, 'At least one allowed MIME type is required'),
  maxFilesPerBatch: z.number().int().positive().optional(),
  transformation: z.object({
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    crop: z.string().optional(),
    quality: z.string().optional(),
  }).optional(),
});

export type CloudinaryUploadConfigInput = z.infer<typeof cloudinaryUploadConfigSchema>;

// ── NEW: File Validation Request Schema ─────────────────────────────────────

/**
 * Validate that files exist in the request
 * This is for routes that expect files
 */
export const validateFilesExistSchema = (required: boolean = true) => {
  return z.object({
    files: z.custom<Express.Multer.File[]>().refine(
      (files) => {
        if (required && !files) return false;
        if (required && files.length === 0) return false;
        return true;
      },
      {
        message: required 
          ? 'At least one file is required' 
          : 'No files provided',
      }
    ),
  });
};

/**
 * Validate file count for bulk uploads
 */
export const validateFileCountSchema = (maxFiles: number = 10) => {
  return z.object({
    files: z.custom<Express.Multer.File[]>().refine(
      (files) => files.length <= maxFiles,
      {
        message: `Maximum ${maxFiles} files allowed per upload`,
      }
    ),
  });
};

// ── Station Document Upload Schema ─────────────────────────────────────────

/**
 * Validates station ID for document uploads
 */
export const stationUploadSchema = z.object({
  params: z.object({
    stationId: z.string().uuid('Station ID must be a valid UUID'),
  }),
  body: z.object({
    title:     z.string().min(1, 'Document title is required').max(200, 'Title is too long'),
    ref_no:    documentRefNoSchema,
    priority:  registryPriorityEnum.default('normal'),
    note:      z.string().max(1000).trim().optional(),
  }).strict(),
});

// ── Bulk Station Upload Schema ─────────────────────────────────────────────

export const bulkStationUploadSchema = z.object({
  params: z.object({
    stationId: z.string().uuid('Station ID must be a valid UUID'),
  }),
  body: z.object({
    priority:  registryPriorityEnum.default('normal'),
    note:      z.string().max(1000).trim().optional(),
  }).strict(),
});

// ── Document Replacement Schema ────────────────────────────────────────────

/**
 * Replace a document file with a new version
 */
export const replaceDocumentSchema = z.object({
  params: z.object({
    documentId: z.string().uuid('Document ID must be a valid UUID'),
  }),
  body: z.object({
    title:     z.string().min(1, 'Document title is required').max(200, 'Title is too long').optional(),
    ref_no:    documentRefNoSchema,
    note:      z.string().max(1000).trim().optional(),
  }).strict(),
});

// ── Document Transfer Schema ───────────────────────────────────────────────

/**
 * Transfer a document from one station to another
 */
export const transferDocumentSchema = z.object({
  body: z.object({
    target_station_id: z.string().uuid('Target station ID must be a valid UUID'),
    priority:          registryPriorityEnum.default('normal'),
    note:              z.string().max(1000).trim().optional(),
  }).strict(),
  params: z.object({
    entryId: z.string().uuid('Registry entry ID must be a valid UUID'),
  }),
});

// ── Bulk Document Transfer Schema ──────────────────────────────────────────

export const bulkTransferDocumentsSchema = z.object({
  body: z.object({
    entry_ids: z.array(z.string().uuid('Entry ID must be a valid UUID'))
      .min(1, 'At least one entry ID is required')
      .max(50, 'Cannot transfer more than 50 documents at once'),
    target_station_id: z.string().uuid('Target station ID must be a valid UUID'),
    priority:          registryPriorityEnum.default('normal'),
    note:              z.string().max(1000).trim().optional(),
  }).strict(),
});

// ── Inferred types ────────────────────────────────────────────────────────────

export type RouteFileInput           = z.infer<typeof routeFileSchema>['body'];
export type ReturnFileInput          = z.infer<typeof returnFileSchema>['body'];
export type RegistryFilters          = z.infer<typeof registryFiltersSchema>['query'];
export type CreateFolderInput        = z.infer<typeof createFolderSchema>['body'];
export type UpdateFolderInput        = z.infer<typeof updateFolderSchema>['body'];
export type MoveFolderInput          = z.infer<typeof moveFolderSchema>['body'];
export type AddDocumentToFolderInput = z.infer<typeof addDocumentToFolderSchema>['body'];
export type BulkAddDocumentsInput    = z.infer<typeof bulkAddDocumentsSchema>['body'];
export type FolderFilters            = z.infer<typeof folderFiltersSchema>['query'];
export type SearchQuery              = z.infer<typeof searchQuerySchema>['query'];
export type GetStationFolderDocumentsQuery = z.infer<typeof getStationFolderDocumentsSchema>['query'];
export type MoveDocumentToFolderBody = z.infer<typeof moveDocumentToFolderSchema>['body'];

export type DirectUploadInput           = z.infer<typeof directUploadSchema>['body'];
export type BulkDirectUploadInput       = z.infer<typeof bulkDirectUploadSchema>['body'];
export type UploadDocumentToFolderInput = z.infer<typeof uploadDocumentToFolderSchema>['body'];
export type UpdateDocumentMetadataInput = z.infer<typeof updateDocumentMetadataSchema>['body'];
export type DeleteDocumentInput         = z.infer<typeof deleteDocumentSchema>['body'];

export type StationUploadInput         = z.infer<typeof stationUploadSchema>['body'];
export type BulkStationUploadInput     = z.infer<typeof bulkStationUploadSchema>['body'];
export type ReplaceDocumentInput       = z.infer<typeof replaceDocumentSchema>['body'];
export type TransferDocumentInput      = z.infer<typeof transferDocumentSchema>['body'];
export type BulkTransferDocumentsInput = z.infer<typeof bulkTransferDocumentsSchema>['body'];

// ── Helper Functions for File Validation ─────────────────────────────────

/**
 * Validate file size and format before Cloudinary upload
 * Use this in middleware or service layer
 */
export const validateFileForUpload = (
  file: Express.Multer.File,
  allowedMimeTypes: string[],
  maxSize: number
): { valid: boolean; error?: string } => {
  if (!allowedMimeTypes.includes(file.mimetype)) {
    return {
      valid: false,
      error: `File type ${file.mimetype} is not allowed. Allowed types: ${allowedMimeTypes.join(', ')}`
    };
  }

  if (file.size > maxSize) {
    const maxMB = (maxSize / (1024 * 1024)).toFixed(1);
    const fileMB = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `File size ${fileMB}MB exceeds maximum allowed size of ${maxMB}MB`
    };
  }

  return { valid: true };
};

/**
 * Generate a human-friendly error message for upload validation
 */
export const getUploadValidationErrorMessage = (
  files: Express.Multer.File[],
  allowedMimeTypes: string[],
  maxSize: number
): string[] => {
  const errors: string[] = [];

  files.forEach((file) => {
    const validation = validateFileForUpload(file, allowedMimeTypes, maxSize);
    if (!validation.valid) {
      errors.push(`File "${file.originalname}": ${validation.error}`);
    }
  });

  return errors;
};

/**
 * Validate multiple files against configuration
 */
export const validateMultipleFiles = (
  files: Express.Multer.File[],
  config: {
    allowedMimeTypes: string[];
    maxSize: number;
    maxFiles?: number;
  }
): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (config.maxFiles && files.length > config.maxFiles) {
    errors.push(`Maximum ${config.maxFiles} files allowed, got ${files.length}`);
  }

  files.forEach((file) => {
    const validation = validateFileForUpload(
      file,
      config.allowedMimeTypes,
      config.maxSize
    );
    if (!validation.valid) {
      errors.push(`File "${file.originalname}": ${validation.error}`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Check if a file type is an image
 */
export const isImageFile = (mimeType: string): boolean => {
  return mimeType.startsWith('image/');
};

/**
 * Check if a file type is a PDF
 */
export const isPdfFile = (mimeType: string): boolean => {
  return mimeType === 'application/pdf';
};

/**
 * Check if a file type is a document (Word, Excel, etc.)
 */
export const isDocumentFile = (mimeType: string): boolean => {
  const docTypes = [
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ];
  return docTypes.includes(mimeType);
};

/**
 * Get file extension from filename
 */
export const getFileExtensionFromName = (fileName: string): string => {
  return fileName.split('.').pop()?.toLowerCase() || '';
};