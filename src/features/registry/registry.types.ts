// src/features/registry/registry.types.ts
import type { StationType } from '../stations/stations.types';

export type RegistryPriority =
  | 'normal'
  | 'urgent'
  | 'confidential'
  | 'for_information_only';

export type RegistryStatus =
  | 'in_transit'   // routed, station hasn't acknowledged receipt yet
  | 'received'     // station has acknowledged receipt
  | 'filed'        // closed out / archived at the station
  | 'returned';     // sent back to the registry (did not stay at the station)

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