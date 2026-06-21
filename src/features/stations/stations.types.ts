// src/features/stations/stations.types.ts

export type StationType =
  | 'high_court'
  | 'magistrate_court'
  | 'environment_court'
  | 'kadhis_court'
  | 'sub_registry';

export interface Station {
  id: string;
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