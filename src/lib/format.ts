export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;
  const mins = Math.max(0, Math.floor(diffMs / 60000));
  if (mins < 1) return 'pravkar';
  if (mins < 60) return `pred ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `pred ${hours} h`;
  const days = Math.floor(hours / 24);
  return `pred ${days} d`;
}

export function formatDuration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export function formatClock(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' });
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('sl-SI', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function cameraImageUrl(camera: { image_url: string }, bust = true): string {
  if (!bust) return camera.image_url;
  const sep = camera.image_url.includes('?') ? '&' : '?';
  return `${camera.image_url}${sep}dt=${Date.now()}`;
}

export const INCIDENT_META: Record<
  string,
  { label: string; color: string; bg: string; border: string }
> = {
  police: { label: 'Policija', color: 'text-sky-300', bg: 'bg-sky-500/15', border: 'border-sky-500/30' },
  accident: { label: 'Nesreča', color: 'text-red-300', bg: 'bg-red-500/15', border: 'border-red-500/30' },
  jam: { label: 'Zastoj', color: 'text-amber-300', bg: 'bg-amber-500/15', border: 'border-amber-500/30' },
  roadwork: { label: 'Dela na cesti', color: 'text-orange-300', bg: 'bg-orange-500/15', border: 'border-orange-500/30' },
  hazard: { label: 'Nevarnost', color: 'text-violet-300', bg: 'bg-violet-500/15', border: 'border-violet-500/30' },
};

export const SEVERITY_META: Record<string, { label: string; color: string; bg: string }> = {
  low: { label: 'Nizka', color: 'text-emerald-300', bg: 'bg-emerald-500/15' },
  medium: { label: 'Srednja', color: 'text-amber-300', bg: 'bg-amber-500/15' },
  high: { label: 'Visoka', color: 'text-red-300', bg: 'bg-red-500/15' },
};

export const FLOW_META: Record<string, { label: string; color: string; bg: string }> = {
  smooth: { label: 'Prost pretok', color: 'text-emerald-300', bg: 'bg-emerald-500/15' },
  busy: { label: 'Gost promet', color: 'text-amber-300', bg: 'bg-amber-500/15' },
  congested: { label: 'Zastoj', color: 'text-red-300', bg: 'bg-red-500/15' },
};

export const SURFACE_LABEL: Record<string, string> = {
  suho: 'Suho',
  mokro: 'Mokro',
  sneg: 'Sneg',
  led: 'Led',
  megla: 'Megla',
};

export const ROAD_TYPE_LABEL: Record<string, string> = {
  motorway: 'Avtocesta',
  expressway: 'Hitra cesta',
  regional: 'Regionalna cesta',
  urban: 'Mestna cesta',
};

export const SLOVENIA_CENTER = { lat: 46.1512, lng: 14.9955, zoom: 8 };

export const ROUTE_PRESETS: {
  key: string;
  name: string;
  origin_name: string;
  origin_lat: number;
  origin_lng: number;
  dest_name: string;
  dest_lat: number;
  dest_lng: number;
  via_roads: string;
  distance_km: number;
  base_duration_min: number;
}[] = [
  { key: 'lj-mb', name: 'Ljubljana → Maribor', origin_name: 'Ljubljana — center', origin_lat: 46.0569, origin_lng: 14.5058, dest_name: 'Maribor — center', dest_lat: 46.5547, dest_lng: 15.645, via_roads: 'A1', distance_km: 127, base_duration_min: 95 },
  { key: 'lj-kp', name: 'Ljubljana → Koper', origin_name: 'Ljubljana — center', origin_lat: 46.0569, origin_lng: 14.5058, dest_name: 'Koper — pristanišče', dest_lat: 45.545, dest_lng: 13.73, via_roads: 'A1', distance_km: 105, base_duration_min: 85 },
  { key: 'lj-bled', name: 'Ljubljana → Bled', origin_name: 'Ljubljana — center', origin_lat: 46.0569, origin_lng: 14.5058, dest_name: 'Bled — jezero', dest_lat: 46.361, dest_lng: 14.094, via_roads: 'A2, G2', distance_km: 55, base_duration_min: 50 },
  { key: 'lj-nm', name: 'Ljubljana → Novo mesto', origin_name: 'Ljubljana — center', origin_lat: 46.0569, origin_lng: 14.5058, dest_name: 'Novo mesto — center', dest_lat: 45.798, dest_lng: 15.168, via_roads: 'A2', distance_km: 72, base_duration_min: 55 },
  { key: 'lj-kr', name: 'Ljubljana → Kranj', origin_name: 'Ljubljana — center', origin_lat: 46.0569, origin_lng: 14.5058, dest_name: 'Kranj — center', dest_lat: 46.2389, dest_lng: 14.3556, via_roads: 'A2', distance_km: 28, base_duration_min: 28 },
  { key: 'mb-lj', name: 'Maribor → Ljubljana', origin_name: 'Maribor — center', origin_lat: 46.5547, origin_lng: 15.645, dest_name: 'Ljubljana — center', dest_lat: 46.0569, dest_lng: 14.5058, via_roads: 'A1', distance_km: 127, base_duration_min: 95 },
  { key: 'lj-ng', name: 'Ljubljana → Nova Gorica', origin_name: 'Ljubljana — center', origin_lat: 46.0569, origin_lng: 14.5058, dest_name: 'Nova Gorica — center', dest_lat: 45.958, dest_lng: 13.637, via_roads: 'A1, H4', distance_km: 95, base_duration_min: 80 },
  { key: 'lj-celje', name: 'Ljubljana → Celje', origin_name: 'Ljubljana — center', origin_lat: 46.0569, origin_lng: 14.5058, dest_name: 'Celje — center', dest_lat: 46.2394, dest_lng: 15.2677, via_roads: 'A1', distance_km: 85, base_duration_min: 65 },
];
