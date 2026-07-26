// src/features/registry/registry.types.ts
import type { StationType } from '../stations/stations.types';

// ── Registry Priority ─────────────────────────────────────────────────────────

export type RegistryPriority =
  | 'normal'
  | 'urgent'
  | 'confidential'
  | 'for_information_only';

// ── Registry Status ──────────────────────────────────────────────────────────
// Simplified status - only 'active' (currently at station) or 'returned' (sent back)

export type RegistryStatus =
  | 'active'     // document is currently at this station
  | 'returned';  // document has been returned to the registry

// ── Folder Status ────────────────────────────────────────────────────────────

export type FolderStatus = 'active' | 'archived';

// ── Folder Category ──────────────────────────────────────────────────────────

export type FolderCategory = 
  | 'court'
  | 'registry'
  | 'administrative'
  | 'other';

// ── Registry Entry ───────────────────────────────────────────────────────────
// One row = one "leg" of a document's journey through the registry.
// Only one entry per document should have is_active = true at a time —
// that's the document's current location.

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
  routed_at:        Date;
  received_at:      Date | null;
  received_by:      string | null;
  received_by_name: string | null;
  is_active:        boolean;
  created_at:       Date;
}

// ── Station file counts (for the registry dashboard grid) ───────────────────

export interface StationWithFileCount {
  id:         string;
  name:       string;
  type:       StationType;
  location:   string | null;
  is_active:  boolean;
  file_count: number; // count of active (currently-on-record) registry entries
}

// ── Pagination ────────────────────────────────────────────────────────────────

export interface RegistryPaginationResponse {
  data:       RegistryEntry[];
  total:      number;
  page:       number;
  limit:      number;
  totalPages: number;
}

// ── Court Reference Number Format ────────────────────────────────────────────

/**
 * Court reference number format: RHC/[CODE]/[NUMBER]
 * Examples:
 * - RHC/MSB/22  -> Marasabi High Court
 * - RHC/KAB/23  -> Kabarnet High Court
 * - RHC/GRN/24  -> Garsen High Court
 * - RHC/KMS/25  -> Machakos High Court
 * - RHC/KLD/26  -> Kailado High Court
 * - RHC/ELD/27  -> Eldoret High Court
 * - RHC/KSM/28  -> Kisumu High Court
 * - RHC/NYK/29  -> Nanyuki High Court
 * - RHC/SYA/30  -> Siaya High Court
 * - RHC/CHK/31  -> Chuka High Court
 */

export interface CourtReference {
  code: string;      // e.g., "MSB", "KAB", "GRN"
  number: number;    // e.g., 22, 23, 24
  fullRef: string;   // e.g., "RHC/MSB/22"
}

// ── Court Reference Configuration ────────────────────────────────────────────

export interface CourtConfig {
  code: string;
  name: string;
  refPrefix: string; // Always "RHC" for High Court
  nextNumber: number; // The next available number for this court
}

// ── Folder Types ─────────────────────────────────────────────────────────────

export interface RHCFolder {
  id: string;
  ref_no: string;              // e.g., "RHC/MSB/22"
  name: string;                // e.g., "Marasabi High Court"
  category: FolderCategory;
  description: string | null;
  status: FolderStatus;
  parent_folder_id: string | null;
  created_at: Date;
  updated_at: Date;
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
  created_at: Date;
  added_at: Date;
}

// ── Create/Update Folder Request ─────────────────────────────────────────────

export interface CreateRegistryFolderInput {
  ref_no: string;              // e.g., "RHC/MSB/22"
  name: string;                // e.g., "Marasabi High Court"
  category?: FolderCategory;   // defaults to 'court'
  description?: string;
  parent_folder_id?: string;
  status?: FolderStatus;       // defaults to 'active'
}

export interface UpdateRegistryFolderInput {
  name?: string;
  description?: string;
  status?: FolderStatus;
  // Note: ref_no should NOT be changeable once set
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

// ── Folder Hierarchy ─────────────────────────────────────────────────────────

export interface FolderHierarchy extends RHCFolder {
  parent_chain: RHCFolder[];
  children: RHCFolder[];
}

// ── Folder Category Count ───────────────────────────────────────────────────

export interface FolderCategoryCount {
  category: FolderCategory;
  count: number;
}

// ── Document in Folder ──────────────────────────────────────────────────────

export interface DocumentInFolder {
  id: string;
  title: string;
  ref: string | null;
  format: string;
  file_url: string | null;
  file_public_id: string | null;
  created_at: Date;
  added_at: Date;
}

// ── Bulk Add Documents Result ──────────────────────────────────────────────

export interface BulkAddDocumentsResult {
  added: number;
  skipped: number;
  errors: string[];
}

// ── Display Labels ───────────────────────────────────────────────────────────

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