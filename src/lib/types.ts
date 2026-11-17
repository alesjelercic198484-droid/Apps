export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  vehicle_name: string;
  vehicle_plate: string;
  speed_tolerance_kmh: number;
  home_region: string;
  audio_alerts: boolean;
  reputation: number;
  created_at: string;
}

export interface Camera {
  id: number;
  code: string;
  name: string;
  road_code: string;
  road_type: string;
  region: string;
  direction: string;
  lat: number;
  lng: number;
  image_url: string;
  source_url: string;
  operator: string;
  status: string;
  speed_limit_kmh: number;
  current_speed_kmh: number;
  traffic_flow: string;
  surface: string;
  temp_c: number;
  elevation_m: number;
  is_favorite: boolean;
  created_by: number | null;
  updated_at: string;
}

export type IncidentType = 'police' | 'accident' | 'jam' | 'roadwork' | 'hazard';
export type Severity = 'low' | 'medium' | 'high';

export interface Incident {
  id: number;
  type: IncidentType;
  severity: Severity;
  status: string;
  title: string;
  description: string;
  road_code: string;
  region: string;
  location_name: string;
  direction: string;
  lat: number;
  lng: number;
  delay_min: number;
  queue_km: number;
  speed_limit_kmh: number | null;
  measured_speed_kmh: number | null;
  confirmations: number;
  dismissals: number;
  reporter_id: number | null;
  reporter_name: string;
  my_vote: 'confirm' | 'dismiss' | null;
  created_at: string;
  updated_at: string;
}

export interface RoadSegment {
  id: number;
  code: string;
  name: string;
  corridor: string;
  region: string;
  road_type: string;
  length_km: number;
  speed_limit_kmh: number;
  avg_speed_kmh: number;
  density_pct: number;
  flow_status: string;
  surface: string;
  temp_c: number;
  wind_kmh: number;
  delay_min: number;
  note: string;
  polyline_key: string;
  updated_by: number | null;
  updated_at: string;
}

export interface SavedRoute {
  id: number;
  user_id: number;
  name: string;
  origin_name: string;
  origin_lat: number;
  origin_lng: number;
  dest_name: string;
  dest_name_lat?: number;
  dest_lat: number;
  dest_lng: number;
  via_roads: string;
  distance_km: number;
  base_duration_min: number;
  preset_key: string;
  notify_police: boolean;
  notify_accidents: boolean;
  notify_jams: boolean;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

export interface Stats {
  cameras_total: number;
  cameras_online: number;
  incidents_active: number;
  police_active: number;
  accidents_active: number;
  jams_active: number;
  avg_speed_kmh: number;
  avg_density_pct: number;
  user: User | null;
}

export type ViewKey = 'dashboard' | 'cameras' | 'map' | 'incidents' | 'segments' | 'routes' | 'settings';

export interface GpsState {
  lat: number | null;
  lng: number | null;
  speedKmh: number | null;
  heading: number | null;
  accuracy: number | null;
  altitude: number | null;
  status: 'off' | 'searching' | 'active' | 'simulated' | 'denied' | 'error';
  error: string | null;
  simulated: boolean;
}

export interface Toast {
  id: number;
  kind: 'success' | 'error' | 'info';
  title: string;
  message?: string;
}
