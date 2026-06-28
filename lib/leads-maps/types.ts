export interface MapsLead {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  search_location?: string | null;
  maps_url?: string | null;
  state_code?: string | null;
  city_name?: string | null;
}

export type MapsJobStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface MapsJobResponse {
  job_id: string;
  keyword: string;
  status: MapsJobStatus;
  logs: string[];
  businesses: MapsLead[];
  current_city: string;
  cities_done: number;
  cities_total: number;
  leads_count: number;
  error?: string | null;
  created_at: string;
  finished_at?: string | null;
  csv_ready: boolean;
  state_codes?: string[];
}

export interface RegionCity {
  name: string;
  extracted: boolean;
  extracted_at?: string | null;
  leads_count: number;
}

export interface RegionState {
  code: string;
  name: string;
  parent_city: string;
  cities: RegionCity[];
  city_count: number;
  extracted_count: number;
}

export interface RegionsResponse {
  keyword: string;
  states: RegionState[];
}

export interface MapsScrapeRequest {
  keyword: string;
  state_codes: string[];
  per_city_limit: number;
  city_names?: string[];
  skip_extracted: boolean;
}
