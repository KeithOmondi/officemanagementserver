// src/features/stations/stations.types.ts

// ── Predefined Station Types ──────────────────────────────────────────────────

export type PredefinedStationType =
  | 'high_court'
  | 'magistrate_court'
  | 'environment_court'
  | 'kadhis_court'
  | 'sub_registry';

// ── Station Type (allows custom types) ──────────────────────────────────────

export type StationType = PredefinedStationType | string;

// ── Constants ─────────────────────────────────────────────────────────────────

export const PREDEFINED_STATION_TYPES: PredefinedStationType[] = [
  'high_court',
  'magistrate_court',
  'environment_court',
  'kadhis_court',
  'sub_registry',
];

export const isPredefinedStationType = (type: string): type is PredefinedStationType => {
  return PREDEFINED_STATION_TYPES.includes(type as PredefinedStationType);
};

// ── Station Interface ────────────────────────────────────────────────────────

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

// ── Display Labels for Predefined Types ─────────────────────────────────────

export const STATION_TYPE_LABELS: Record<PredefinedStationType, string> = {
  high_court: 'High Court',
  magistrate_court: 'Magistrate Court',
  environment_court: 'Environment & Land Court',
  kadhis_court: "Kadhi's Court",
  sub_registry: 'Sub-Registry',
};

export const STATION_TYPE_ICONS: Record<PredefinedStationType, string> = {
  high_court: '🏛',
  magistrate_court: '🏛',
  environment_court: '🏛',
  kadhis_court: '🏛',
  sub_registry: '📁',
};

export const STATION_TYPE_COLORS: Record<PredefinedStationType, string> = {
  high_court: 'bg-amber-100 text-amber-700',
  magistrate_court: 'bg-blue-100 text-blue-700',
  environment_court: 'bg-green-100 text-green-700',
  kadhis_court: 'bg-purple-100 text-purple-700',
  sub_registry: 'bg-slate-100 text-slate-700',
};

// ── Helper function to get label for any type ──────────────────────────────

export const getStationTypeLabel = (type: StationType): string => {
  // Check if it's a predefined type
  if (isPredefinedStationType(type)) {
    return STATION_TYPE_LABELS[type];
  }
  // For custom types, return the type itself (formatted)
  return type
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export const getStationTypeIcon = (type: StationType): string => {
  if (isPredefinedStationType(type)) {
    return STATION_TYPE_ICONS[type];
  }
  return '🏛'; // Default icon for custom types
};

export const getStationTypeColor = (type: StationType): string => {
  if (isPredefinedStationType(type)) {
    return STATION_TYPE_COLORS[type];
  }
  return 'bg-stone-100 text-stone-700'; // Default color for custom types
};