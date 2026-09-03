// src/features/registry/registry.types.ts
import type { StationType } from '../stations/stations.types';

// ── Registry Priority ─────────────────────────────────────────────────────────

export type RegistryPriority =
  | 'normal'
  | 'urgent'
  | 'confidential'
  | 'for_information_only';

// ── Registry Status ──────────────────────────────────────────────────────────

export type RegistryStatus =
  | 'active'     // document is currently at this station
  | 'returned';  // document has been returned to the registry

// ── Document Source ──────────────────────────────────────────────────────────

export type DocumentSource = 
  | 'routed'      // Document came through routing (sent from another station)
  | 'direct';     // Document was uploaded directly to this station

// ── Folder Status ────────────────────────────────────────────────────────────

export type FolderStatus = 'active' | 'archived';

// ── Folder Category ──────────────────────────────────────────────────────────

export type FolderCategory = 
  | 'court'
  | 'registry'
  | 'administrative'
  | 'other';

// ── Cloudinary Types ─────────────────────────────────────────────────────────

export interface CloudinaryUploadResult {
  public_id: string;
  version: number;
  format: string;
  resource_type: string;
  url: string;
  secure_url: string;
  bytes: number;
  original_filename: string;
  width?: number;
  height?: number;
  created_at?: string;
}

export interface CloudinaryFile {
  url: string;
  public_id: string;
  version: number;
  format: string;
  resource_type: string;
  bytes: number;
  original_filename: string;
  secure_url?: string;
  width?: number;
  height?: number;
  uploaded_at: string;
}

// ── Document File (simplified for storage) ─────────────────────────────────

export interface DocumentFile {
  file_url: string;
  file_public_id: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  uploaded_at: string;
  format?: string;
  cloudinary_version?: number;
}

// ── Registry Entry ───────────────────────────────────────────────────────────

export interface RegistryEntry {
  id:               string;
  document_id:      string;
  document_title:   string;
  document_ref_no:  string | null;
  station_id:       string;
  station_name:     string;
  station_type:     StationType;
  routed_by:        string;
  routed_by_name:   string;
  priority:         RegistryPriority;
  note:             string | null;
  status:           RegistryStatus;
  routed_at:        string;
  received_at:      string | null;
  received_by:      string | null;
  received_by_name: string | null;
  is_active:        boolean;
  created_at:       string;
  source:           DocumentSource;
  uploaded_by:      string | null;
  uploaded_by_name: string | null;
  file:             DocumentFile | null;
}

// ─── Folder Document Entry ─────────────────────────────────────────────────

export interface FolderRegistryEntry {
  id:               string;
  document_id:      string;
  document_title:   string;
  document_ref_no:  string | null;
  station_id:       string;
  station_name:     string;
  station_type:     StationType;
  folder_id:        string;
  folder_ref_no:    string;
  folder_name:      string;
  is_folder_document: boolean;
  created_at:       string;
  file_url:         string | null;
  file_name:        string | null;
  file_size:        number | null;
  mime_type:        string | null;
}

// ── Station file counts ─────────────────────────────────────────────────────

export interface StationWithFileCount {
  id:         string;
  ref_no:     string | null;
  name:       string;
  type:       StationType;
  location:   string | null;
  is_active:  boolean;
  file_count: number;
  routed_count?: number;
  direct_count?: number;
}

// ── Pagination ────────────────────────────────────────────────────────────────

export interface RegistryPaginationResponse {
  data:       RegistryEntry[];
  total:      number;
  page:       number;
  limit:      number;
  totalPages: number;
}

export interface FolderRegistryPaginationResponse {
  data:       FolderRegistryEntry[];
  total:      number;
  page:       number;
  limit:      number;
  totalPages: number;
}

// ── Court Reference Types ──────────────────────────────────────────────────

export interface CourtReference {
  code: string;
  number: number;
  fullRef: string;
}

export interface CourtConfig {
  code: string;
  name: string;
  refPrefix: string;
  nextNumber: number;
}

// ── Folder Types ─────────────────────────────────────────────────────────────

export interface RHCFolder {
  id: string;
  ref_no: string;
  name: string;
  category: FolderCategory;
  description: string | null;
  status: FolderStatus;
  parent_folder_id: string | null;
  created_at: string;
  updated_at: string;
  sub_folder_count?: number;
  document_count?: number;
}

export interface FolderDocument {
  id: string;
  title: string;
  ref: string | null;
  format: string;
  file_url: string | null;
  file_public_id: string | null;
  created_at: string;
  added_at: string;
  file_name?: string;
  file_size?: number;
  mime_type?: string;
  source?: DocumentSource;
}

export interface FolderHierarchy extends RHCFolder {
  parent_chain: RHCFolder[];
  children: RHCFolder[];
}

export interface DocumentInFolder {
  id: string;
  title: string;
  ref: string | null;
  format: string;
  file_url: string | null;
  file_public_id: string | null;
  created_at: string;
  added_at: string;
  file_name?: string;
  file_size?: number;
  mime_type?: string;
}

// ── Create/Update Folder Request ─────────────────────────────────────────────

export interface CreateRegistryFolderInput {
  ref_no: string;
  name: string;
  category?: FolderCategory;
  description?: string;
  parent_folder_id?: string;
  status?: FolderStatus;
}

export interface UpdateRegistryFolderInput {
  name?: string;
  description?: string;
  status?: FolderStatus;
}

// ── Folder Statistics ────────────────────────────────────────────────────────

export interface FolderStatistics {
  total: number;
  active: number;
  archived: number;
  byCategory: {
    category: FolderCategory;
    count: number;
  }[];
}

export interface FolderCategoryCount {
  category: FolderCategory;
  count: number;
}

export interface BulkAddDocumentsResult {
  added: number;
  skipped: number;
  errors: string[];
}

// ── Direct Document Upload Types ────────────────────────────────────────────

// Frontend request payload (files are sent as FormData)
export interface DirectDocumentUploadInput {
  title: string;
  ref_no?: string;
  station_id: string;
  priority?: RegistryPriority;
  note?: string;
}

export interface BulkDirectDocumentUploadInput {
  station_id: string;
  priority?: RegistryPriority;
  note?: string;
}

// ── Direct Document Upload Responses ───────────────────────────────────────

export interface DirectDocumentUploadResponse {
  success: boolean;
  message: string;
  data?: {
    entry: RegistryEntry;
    file: DocumentFile;
    cloudinary_metadata?: CloudinaryUploadResult;
  };
}

export interface BulkDirectDocumentUploadResponse {
  success: boolean;
  message: string;
  data?: {
    results: BulkDirectDocumentUploadResultItem[];
    totalProcessed: number;
    totalSuccess: number;
    totalFailed: number;
  };
}

export interface BulkDirectDocumentUploadResultItem {
  success: boolean;
  entry?: RegistryEntry;
  file?: DocumentFile;
  error?: string;
  fileName?: string;
  cloudinary_metadata?: CloudinaryUploadResult;
}

// ── File Upload Configuration ──────────────────────────────────────────────

export interface CloudinaryUploadConfig {
  folder: string;
  maxFileSize: number;
  allowedFormats: string[];
  allowedMimeTypes: string[];
  maxFilesPerBatch?: number;
  transformation?: {
    width?: number;
    height?: number;
    crop?: string;
    quality?: string;
  };
}

export interface FileValidationError {
  fileName: string;
  error: string;
}

// ── Helper Types for Backend Route Handlers ──────────────────────────────

export interface UploadedFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
  destination?: string;
  filename?: string;
  path?: string;
}

// ── Display Labels & Colors ──────────────────────────────────────────────────

export const SOURCE_LABELS: Record<DocumentSource, string> = {
  routed: 'Routed',
  direct: 'Direct Upload',
};

export const SOURCE_COLORS: Record<DocumentSource, string> = {
  routed: 'bg-blue-50 text-blue-700',
  direct: 'bg-green-50 text-green-700',
};

export const SOURCE_ICONS: Record<DocumentSource, string> = {
  routed: 'ArrowRightIcon',
  direct: 'UploadIcon',
};

export const CATEGORY_LABELS: Record<FolderCategory, string> = {
  court: 'Court',
  registry: 'Registry',
  administrative: 'Administrative',
  other: 'Other',
};

export const CATEGORY_COLORS: Record<FolderCategory, string> = {
  court: 'bg-amber-50 text-amber-700',
  registry: 'bg-blue-50 text-blue-700',
  administrative: 'bg-green-50 text-green-700',
  other: 'bg-stone-50 text-stone-700',
};

export const STATUS_LABELS: Record<FolderStatus, string> = {
  active: 'Active',
  archived: 'Archived',
};

export const STATUS_COLORS: Record<FolderStatus, string> = {
  active: 'bg-emerald-50 text-emerald-700',
  archived: 'bg-stone-50 text-stone-700',
};

export const PRIORITY_LABELS: Record<RegistryPriority, string> = {
  normal: 'Normal',
  urgent: 'Urgent',
  confidential: 'Confidential',
  for_information_only: 'For Information Only',
};

export const PRIORITY_COLORS: Record<RegistryPriority, string> = {
  normal: 'bg-slate-100 text-slate-700',
  urgent: 'bg-red-100 text-red-700',
  confidential: 'bg-amber-100 text-amber-700',
  for_information_only: 'bg-blue-100 text-blue-700',
};

// ── Utility Functions ──────────────────────────────────────────────────────

export const getFileSizeDisplay = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const getFileExtension = (fileName: string): string => {
  return fileName.split('.').pop()?.toLowerCase() || '';
};

export const isValidFileFormat = (format: string, allowedFormats: string[]): boolean => {
  return allowedFormats.includes(format.toLowerCase());
};

export const generateCloudinaryFolderPath = (category: FolderCategory, stationId: string): string => {
  return `registry/${category}/${stationId}`;
};