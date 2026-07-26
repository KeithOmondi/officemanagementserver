// src/features/stations/stations.types.ts

export type StationType =
  | 'high_court'
  | 'magistrate_court'
  | 'environment_court'
  | 'kadhis_court'
  | 'sub_registry';

export interface Station {
  id: string;
  ref_no: string | null;        // e.g., "RHC/MSB/22" for high courts, null for sub-registries
  name: string;
  type: StationType;
  location: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface StationPaginationResponse {
  data: Station[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ── Station with file count (for registry dashboard) ──────────────────────

export interface StationWithFileCount extends Station {
  file_count: number; // count of active registry entries at this station
}

// ── Create/Update Station Inputs ───────────────────────────────────────────

export interface CreateStationInput {
  ref_no?: string;          // Optional for sub-registries, required for courts
  name: string;
  type: StationType;
  location?: string;
  is_active?: boolean;
}

export interface UpdateStationInput {
  ref_no?: string;
  name?: string;
  type?: StationType;
  location?: string | null;
  is_active?: boolean;
}

// ── Station Filters ─────────────────────────────────────────────────────────

export interface StationFilters {
  type?: StationType;
  is_active?: boolean;
  search?: string;
  page?: number;
  limit?: number;
  sort_by?: 'name' | 'type' | 'created_at' | 'ref_no';
  sort_order?: 'ASC' | 'DESC';
}

// ── Display Labels ─────────────────────────────────────────────────────────

export const STATION_TYPE_LABELS: Record<StationType, string> = {
  high_court: 'High Court',
  magistrate_court: 'Magistrate Court',
  environment_court: 'Environment & Land Court',
  kadhis_court: "Kadhi's Court",
  sub_registry: 'Sub-Registry',
};

export const STATION_TYPE_ICONS: Record<StationType, string> = {
  high_court: '🏛',
  magistrate_court: '🏛',
  environment_court: '🏛',
  kadhis_court: '🏛',
  sub_registry: '📁',
};

export const STATION_TYPE_COLORS: Record<StationType, string> = {
  high_court: 'bg-amber-100 text-amber-700',
  magistrate_court: 'bg-blue-100 text-blue-700',
  environment_court: 'bg-green-100 text-green-700',
  kadhis_court: 'bg-purple-100 text-purple-700',
  sub_registry: 'bg-slate-100 text-slate-700',
};