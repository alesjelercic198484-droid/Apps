import { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  BellOff,
  Car,
  Clock,
  Gauge,
  LayoutDashboard,
  LogIn,
  LogOut,
  MapPin,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Route as RouteIcon,
  Shield,
  Siren,
  Thermometer,
  Trash2,
  UserPlus,
  Video,
  Wind,
} from 'lucide-react';
import type { Camera, Incident, RoadSegment, SavedRoute, Stats, User, ViewKey } from '../lib/types';
import { FLOW_META, formatDuration, ROUTE_PRESETS, SURFACE_LABEL, timeAgo } from '../lib/format';
import { api } from '../lib/api';
import { getApiBase, setApiBase } from '../lib/apiBase';
import { Badge, Card, EmptyState, Field, GhostButton, Modal, PrimaryButton, Spinner, StatCard, inputClass } from './ui';
import { CameraCard, LiveImage } from './CameraViews';
import { IncidentCard, IncidentIcon } from './IncidentViews';
import { GpsPanel } from './GpsPanel';
import { MapView } from './MapView';
import type { GpsState } from '../lib/types';

// ---------- Dashboard ----------
export function DashboardPage({
  stats,
  cameras,
  incidents,
  segments,
  gps,
  onStartGps,
  onStopGps,
  onSimulateGps,
  onGo,
  onOpenCamera,
  onToggleFavorite,
  onVote,
  onFocusIncident,
  refreshKey,
  loading,
}: {
  stats: Stats | null;
  cameras: Camera[];
  incidents: Incident[];
  segments: RoadSegment[];
  gps: GpsState;
  onStartGps: () => void;
  onStopGps: () => void;
  onSimulateGps: () => void;
  onGo: (view: ViewKey) => void;
  onOpenCamera: (camera: Camera) => void;
  onToggleFavorite: (camera: Camera) => void;
  onVote: (incident: Incident, vote: 'confirm' | 'dismiss') => void;
  onFocusIncident: (incident: Incident) => void;
  refreshKey: number;
  loading: boolean;
}) {
  const active = incidents.filter((i) => i.status === 'active');
  const featured = cameras.filter((c) => c.is_favorite).slice(0, 3);
  const featuredList = featured.length ? featured : cameras.slice(0, 3);
  const worst = [...segments].sort((a, b) => b.delay_min - a.delay_min).slice(0, 4);

  if (loading && !stats) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-28 rounded-2xl" />
          ))}
        </div>
        <div className="skeleton h-80 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<Video className="h-5 w-5" />}
          label="Kamere v živo"
          value={stats?.cameras_online ?? cameras.length}
          sub={`od ${stats?.cameras_total ?? cameras.length} kamer · DARS / DRSI`}
        />
        <StatCard
          icon={<Siren className="h-5 w-5" />}
          label="Aktivni dogodki"
          value={stats?.incidents_active ?? active.length}
          sub={`${stats?.accidents_active ?? 0} nesreč · ${stats?.jams_active ?? 0} zastojev`}
          accent="text-red-400 bg-red-500/10 border-red-500/20"
        />
        <StatCard
          icon={<Shield className="h-5 w-5" />}
          label="Policija na cesti"
          value={stats?.police_active ?? 0}
          sub="kontrol in radarjev"
          accent="text-sky-400 bg-sky-500/10 border-sky-500/20"
        />
        <StatCard
          icon={<Gauge className="h-5 w-5" />}
          label="Povp. hitrost"
          value={`${stats?.avg_speed_kmh ?? '—'} km/h`}
          sub={`gostota ${stats?.avg_density_pct ?? '—'} %`}
          accent="text-amber-400 bg-amber-500/10 border-amber-500/20"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-100">
              <LayoutDashboard className="h-4 w-4 text-emerald-400" /> Zemljevid Slovenije
            </h2>
            <GhostButton onClick={() => onGo('map')} className="!px-3 !py-1.5 text-xs">
              Cel zaslon
            </GhostButton>
          </div>
          <MapView
            cameras={cameras}
            incidents={incidents}
            gps={gps}
            selectedCamera={null}
            onSelectCamera={onOpenCamera}
            onSelectIncident={onFocusIncident}
            heightClass="h-[420px]"
          />
        </div>
        <div>
          <GpsPanel
            gps={gps}
            speedLimit={130}
            tolerance={5}
            onStart={onStartGps}
            onStop={onStopGps}
            onSimulate={onSimulateGps}
          />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-100">
              <Video className="h-4 w-4 text-emerald-400" /> Kamere v živo
            </h2>
            <GhostButton onClick={() => onGo('cameras')} className="!px-3 !py-1.5 text-xs">
              Vse kamere
            </GhostButton>
          </div>
          <div className="space-y-4">
            {featuredList.map((cam) => (
              <CameraCard
                key={cam.id}
                camera={cam}
                refreshKey={refreshKey}
                onOpen={onOpenCamera}
                onToggleFavorite={onToggleFavorite}
                onEdit={() => {}}
                onDelete={() => {}}
                canManage={false}
              />
            ))}
          </div>
        </div>
        <div className="space-y-6">
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-bold text-slate-100">
                <Siren className="h-4 w-4 text-red-400" /> Zadnji dogodki
              </h2>
              <GhostButton onClick={() => onGo('incidents')} className="!px-3 !py-1.5 text-xs">
                Vsa poročila
              </GhostButton>
            </div>
            <div className="space-y-3">
              {active.slice(0, 3).map((inc) => (
                <IncidentCard
                  key={inc.id}
                  incident={inc}
                  currentUserId={null}
                  onVote={onVote}
                  onEdit={() => {}}
                  onDelete={() => {}}
                  onResolve={() => {}}
                  onFocus={onFocusIncident}
                />
              ))}
              {active.length === 0 && (
                <EmptyState icon={<Siren className="h-7 w-7" />} title="Ni dogodkov" message="Trenutno ni aktivnih poročil." />
              )}
            </div>
          </div>
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-bold text-slate-100">
                <Gauge className="h-4 w-4 text-amber-400" /> Razmere na cestah
              </h2>
              <GhostButton onClick={() => onGo('segments')} className="!px-3 !py-1.5 text-xs">
                Vsi odseki
              </GhostButton>
            </div>
            <div className="space-y-2">
              {worst.map((seg) => {
                const flow = FLOW_META[seg.flow_status] || FLOW_META.smooth;
                return (
                  <Card key={seg.id} className="flex items-center justify-between gap-3 p-3.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-100">{seg.name}</p>
                      <p className="text-xs text-slate-400">
                        {seg.avg_speed_kmh} km/h · gostota {seg.density_pct} % · {SURFACE_LABEL[seg.surface] || seg.surface}
                      </p>
                    </div>
                    <Badge className={`${flow.bg} ${flow.color} border-transparent shrink-0`}>
                      {seg.delay_min > 0 ? `+${seg.delay_min} min` : flow.label}
                    </Badge>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Segments ----------
export function SegmentsPage({
  segments,
  user,
  onChanged,
  onError,
  onRequireAuth,
}: {
  segments: RoadSegment[];
  user: User | null;
  onChanged: (segment: RoadSegment) => void;
  onError: (msg: string) => void;
  onRequireAuth: () => void;
}) {
  const [editing, setEditing] = useState<RoadSegment | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    code: '',
    name: '',
    corridor: '',
    region: '',
    road_type: 'motorway',
    length_km: '',
    speed_limit_kmh: '130',
    avg_speed_kmh: '110',
    density_pct: '40',
    flow_status: 'smooth',
    surface: 'suho',
    temp_c: '8',
    wind_kmh: '10',
    delay_min: '0',
    note: '',
  });

  const openEdit = (seg: RoadSegment) => {
    setEditing(seg);
    setForm({
      code: seg.code,
      name: seg.name,
      corridor: seg.corridor,
      region: seg.region,
      road_type: seg.road_type,
      length_km: String(seg.length_km),
      speed_limit_kmh: String(seg.speed_limit_kmh),
      avg_speed_kmh: String(seg.avg_speed_kmh),
      density_pct: String(seg.density_pct),
      flow_status: seg.flow_status,
      surface: seg.surface,
      temp_c: String(seg.temp_c),
      wind_kmh: String(seg.wind_kmh),
      delay_min: String(seg.delay_min),
      note: seg.note,
    });
  };

  const openCreate = () => {
    if (!user) return onRequireAuth();
    setEditing(null);
    setCreating(true);
    setForm({
      code: '', name: '', corridor: '', region: '', road_type: 'motorway', length_km: '',
      speed_limit_kmh: '130', avg_speed_kmh: '110', density_pct: '40', flow_status: 'smooth',
      surface: 'suho', temp_c: '8', wind_kmh: '10', delay_min: '0', note: '',
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        code: form.code.trim(),
        name: form.name.trim(),
        corridor: form.corridor.trim(),
        region: form.region.trim(),
        road_type: form.road_type,
        length_km: Number(form.length_km),
        speed_limit_kmh: Number(form.speed_limit_kmh),
        avg_speed_kmh: Number(form.avg_speed_kmh),
        density_pct: Number(form.density_pct),
        flow_status: form.flow_status,
        surface: form.surface,
        temp_c: Number(form.temp_c),
        wind_kmh: Number(form.wind_kmh),
        delay_min: Number(form.delay_min),
        note: form.note.trim(),
        polyline_key: editing?.polyline_key || form.code.trim().toLowerCase(),
      };
      if (editing) {
        const { segment } = await api.updateSegment(editing.id, payload);
        onChanged(segment);
      } else {
        const { segment } = await api.createSegment(payload);
        onChanged(segment);
      }
      setEditing(null);
      setCreating(false);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Shranjevanje ni uspelo.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (seg: RoadSegment) => {
    if (!window.confirm(`Resnično želite izbrisati odsek ${seg.name}?`)) return;
    try {
      await api.deleteSegment(seg.id);
      onChanged(seg);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Brisanje ni uspelo.');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-white">Razmere na cestah</h2>
          <p className="text-sm text-slate-400">Hitrost, gostota in stanje vozišča po koridorjih. Posodobite stanje, ko ga opazite na terenu.</p>
        </div>
        <PrimaryButton onClick={openCreate}>
          <Plus className="h-4 w-4" /> Nov odsek
        </PrimaryButton>
      </div>

      {segments.length === 0 ? (
        <EmptyState icon={<Gauge className="h-7 w-7" />} title="Ni odsekov" message="Dodajte prvi cestni odsek." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {segments.map((seg) => {
            const flow = FLOW_META[seg.flow_status] || FLOW_META.smooth;
            return (
              <Card key={seg.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-100">{seg.name}</h3>
                    <p className="text-xs text-slate-400">
                      {seg.corridor} · {seg.region} · {seg.length_km} km
                    </p>
                  </div>
                  <Badge className={`${flow.bg} ${flow.color} border-transparent`}>{flow.label}</Badge>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-[#0b0f14] p-2.5">
                    <p className="font-mono text-lg font-extrabold text-white">{seg.avg_speed_kmh}</p>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">km/h</p>
                  </div>
                  <div className="rounded-xl bg-[#0b0f14] p-2.5">
                    <p className="font-mono text-lg font-extrabold text-white">{seg.density_pct}%</p>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">gostota</p>
                  </div>
                  <div className="rounded-xl bg-[#0b0f14] p-2.5">
                    <p className="font-mono text-lg font-extrabold text-white">{seg.delay_min}m</p>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">zamuda</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5 text-xs text-slate-400">
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-800/60 px-2 py-1">
                    <Thermometer className="h-3 w-3" /> {seg.temp_c}°C
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-800/60 px-2 py-1">
                    <Wind className="h-3 w-3" /> {seg.wind_kmh} km/h
                  </span>
                  <span className="rounded-full bg-slate-800/60 px-2 py-1">{SURFACE_LABEL[seg.surface] || seg.surface}</span>
                  <span className="rounded-full bg-slate-800/60 px-2 py-1">omejitev {seg.speed_limit_kmh} km/h</span>
                </div>
                {seg.note && <p className="mt-2 text-xs text-slate-400">{seg.note}</p>}
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">Posodobljeno {timeAgo(seg.updated_at)}</span>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(seg)} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Uredi odsek">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => remove(seg)} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-500/15 hover:text-red-400" aria-label="Izbriši odsek">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={creating || !!editing} onClose={() => { setCreating(false); setEditing(null); }} title={editing ? 'Uredi odsek' : 'Nov cestni odsek'} wide>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <Field label="Oznaka (code)">
            <input className={inputClass} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="A1-LJ-MB" required />
          </Field>
          <Field label="Ime odseka">
            <input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="A1 Ljubljana – Maribor" required />
          </Field>
          <Field label="Koridor">
            <input className={inputClass} value={form.corridor} onChange={(e) => setForm({ ...form, corridor: e.target.value })} placeholder="A1" required />
          </Field>
          <Field label="Regija">
            <input className={inputClass} value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} placeholder="Osrednjeslovenska" required />
          </Field>
          <Field label="Vrsta ceste">
            <select className={inputClass} value={form.road_type} onChange={(e) => setForm({ ...form, road_type: e.target.value })}>
              <option value="motorway">Avtocesta</option>
              <option value="expressway">Hitra cesta</option>
              <option value="regional">Regionalna cesta</option>
              <option value="urban">Mestna cesta</option>
            </select>
          </Field>
          <Field label="Dolžina (km)">
            <input className={inputClass} type="number" step="any" min={1} value={form.length_km} onChange={(e) => setForm({ ...form, length_km: e.target.value })} required />
          </Field>
          <Field label="Omejitev (km/h)">
            <input className={inputClass} type="number" min={20} max={160} value={form.speed_limit_kmh} onChange={(e) => setForm({ ...form, speed_limit_kmh: e.target.value })} required />
          </Field>
          <Field label="Povp. hitrost (km/h)">
            <input className={inputClass} type="number" min={0} max={160} value={form.avg_speed_kmh} onChange={(e) => setForm({ ...form, avg_speed_kmh: e.target.value })} required />
          </Field>
          <Field label="Gostota (%)">
            <input className={inputClass} type="number" min={0} max={100} value={form.density_pct} onChange={(e) => setForm({ ...form, density_pct: e.target.value })} required />
          </Field>
          <Field label="Stanje prometa">
            <select className={inputClass} value={form.flow_status} onChange={(e) => setForm({ ...form, flow_status: e.target.value })}>
              <option value="smooth">Prost pretok</option>
              <option value="busy">Gost promet</option>
              <option value="congested">Zastoj</option>
            </select>
          </Field>
          <Field label="Vozišče">
            <select className={inputClass} value={form.surface} onChange={(e) => setForm({ ...form, surface: e.target.value })}>
              <option value="suho">Suho</option>
              <option value="mokro">Mokro</option>
              <option value="sneg">Sneg</option>
              <option value="led">Led</option>
              <option value="megla">Megla</option>
            </select>
          </Field>
          <Field label="Temperatura (°C)">
            <input className={inputClass} type="number" step="any" value={form.temp_c} onChange={(e) => setForm({ ...form, temp_c: e.target.value })} required />
          </Field>
          <Field label="Veter (km/h)">
            <input className={inputClass} type="number" min={0} value={form.wind_kmh} onChange={(e) => setForm({ ...form, wind_kmh: e.target.value })} required />
          </Field>
          <Field label="Zamuda (min)">
            <input className={inputClass} type="number" min={0} value={form.delay_min} onChange={(e) => setForm({ ...form, delay_min: e.target.value })} required />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Opomba">
              <input className={inputClass} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="npr. Povečana gostota pri Razdrtem." />
            </Field>
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <PrimaryButton type="submit" disabled={saving} className="flex-1">
              {saving ? 'Shranjujem …' : editing ? 'Shrani spremembe' : 'Dodaj odsek'}
            </PrimaryButton>
            <GhostButton onClick={() => { setCreating(false); setEditing(null); }}>Prekliči</GhostButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ---------- Routes ----------
export function RoutesPage({
  routes,
  user,
  onChanged,
  onError,
  onRequireAuth,
  onFocusRoute,
}: {
  routes: SavedRoute[];
  user: User | null;
  onChanged: (route: SavedRoute) => void;
  onError: (msg: string) => void;
  onRequireAuth: () => void;
  onFocusRoute: (route: SavedRoute) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<SavedRoute | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    origin_name: '',
    origin_lat: '',
    origin_lng: '',
    dest_name: '',
    dest_lat: '',
    dest_lng: '',
    via_roads: '',
    distance_km: '',
    base_duration_min: '',
    notify_police: true,
    notify_accidents: true,
    notify_jams: true,
    is_pinned: false,
  });

  const applyPreset = (key: string) => {
    const preset = ROUTE_PRESETS.find((p) => p.key === key);
    if (!preset) return;
    setForm({
      name: preset.name,
      origin_name: preset.origin_name,
      origin_lat: String(preset.origin_lat),
      origin_lng: String(preset.origin_lng),
      dest_name: preset.dest_name,
      dest_lat: String(preset.dest_lat),
      dest_lng: String(preset.dest_lng),
      via_roads: preset.via_roads,
      distance_km: String(preset.distance_km),
      base_duration_min: String(preset.base_duration_min),
      notify_police: true,
      notify_accidents: true,
      notify_jams: true,
      is_pinned: false,
    });
  };

  const openCreate = () => {
    if (!user) return onRequireAuth();
    setEditing(null);
    setCreating(true);
    setForm({
      name: '', origin_name: '', origin_lat: '', origin_lng: '', dest_name: '', dest_lat: '', dest_lng: '',
      via_roads: '', distance_km: '', base_duration_min: '', notify_police: true, notify_accidents: true, notify_jams: true, is_pinned: false,
    });
  };

  const openEdit = (route: SavedRoute) => {
    setEditing(route);
    setCreating(true);
    setForm({
      name: route.name,
      origin_name: route.origin_name,
      origin_lat: String(route.origin_lat),
      origin_lng: String(route.origin_lng),
      dest_name: route.dest_name,
      dest_lat: String(route.dest_lat),
      dest_lng: String(route.dest_lng),
      via_roads: route.via_roads,
      distance_km: String(route.distance_km),
      base_duration_min: String(route.base_duration_min),
      notify_police: route.notify_police,
      notify_accidents: route.notify_accidents,
      notify_jams: route.notify_jams,
      is_pinned: route.is_pinned,
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        origin_name: form.origin_name.trim(),
        origin_lat: Number(form.origin_lat),
        origin_lng: Number(form.origin_lng),
        dest_name: form.dest_name.trim(),
        dest_lat: Number(form.dest_lat),
        dest_lng: Number(form.dest_lng),
        via_roads: form.via_roads.trim(),
        distance_km: Number(form.distance_km),
        base_duration_min: Number(form.base_duration_min),
        preset_key: editing?.preset_key || 'custom',
        notify_police: form.notify_police,
        notify_accidents: form.notify_accidents,
        notify_jams: form.notify_jams,
        is_pinned: form.is_pinned,
      };
      if (editing) {
        const { route } = await api.updateRoute(editing.id, payload);
        onChanged(route);
      } else {
        const { route } = await api.createRoute(payload);
        onChanged(route);
      }
      setCreating(false);
      setEditing(null);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Shranjevanje ni uspelo.');
    } finally {
      setSaving(false);
    }
  };

  const togglePin = async (route: SavedRoute) => {
    try {
      const { route: updated } = await api.updateRoute(route.id, { is_pinned: !route.is_pinned });
      onChanged(updated);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Posodobitev ni uspela.');
    }
  };

  const remove = async (route: SavedRoute) => {
    if (!window.confirm(`Resnično želite izbrisati pot ${route.name}?`)) return;
    try {
      await api.deleteRoute(route.id);
      onChanged(route);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Brisanje ni uspelo.');
    }
  };

  if (!user) {
    return (
      <EmptyState
        icon={<RouteIcon className="h-7 w-7" />}
        title="Prijavite se za shranjene poti"
        message="Shranjene poti, obvestila o policiji in priljubljene kamere so povezane z vašim računom."
        action={
          <PrimaryButton onClick={onRequireAuth}>
            <LogIn className="h-4 w-4" /> Prijava
          </PrimaryButton>
        }
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-white">Moje poti</h2>
          <p className="text-sm text-slate-400">Shranjene relacije z obvestili o policiji, nesrečah in zastojih.</p>
        </div>
        <PrimaryButton onClick={openCreate}>
          <Plus className="h-4 w-4" /> Nova pot
        </PrimaryButton>
      </div>

      {routes.length === 0 ? (
        <EmptyState
          icon={<RouteIcon className="h-7 w-7" />}
          title="Ni shranjenih poti"
          message="Dodajte prvo pot — izberite prednastavitev ali vnesite svojo relacijo."
          action={
            <PrimaryButton onClick={openCreate}>
              <Plus className="h-4 w-4" /> Dodaj pot
            </PrimaryButton>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {routes.map((route) => (
            <Card key={route.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-100">{route.name}</h3>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {route.origin_name} → {route.dest_name}
                  </p>
                </div>
                <button
                  onClick={() => togglePin(route)}
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition ${
                    route.is_pinned ? 'border-amber-500/40 bg-amber-500/15 text-amber-300' : 'border-slate-700 text-slate-400 hover:text-amber-300'
                  }`}
                  aria-label={route.is_pinned ? 'Odpeni' : 'Pripni'}
                >
                  {route.is_pinned ? <Pin className="h-4 w-4 fill-current" /> : <PinOff className="h-4 w-4" />}
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-800/60 px-2 py-1 text-slate-300">
                  <RouteIcon className="h-3 w-3" /> {route.distance_km} km
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-800/60 px-2 py-1 text-slate-300">
                  <Clock className="h-3 w-3" /> {formatDuration(route.base_duration_min)}
                </span>
                {route.via_roads && <span className="rounded-full bg-slate-800/60 px-2 py-1 text-slate-300">prek {route.via_roads}</span>}
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] font-semibold">
                {route.notify_police && <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/15 px-2 py-1 text-sky-300"><Shield className="h-3 w-3" /> Policija</span>}
                {route.notify_accidents && <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-1 text-red-300"><Siren className="h-3 w-3" /> Nesreče</span>}
                {route.notify_jams && <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-1 text-amber-300"><Car className="h-3 w-3" /> Zastoji</span>}
              </div>
              <div className="mt-4 flex items-center justify-between">
                <button onClick={() => onFocusRoute(route)} className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400 hover:text-emerald-300">
                  <MapPin className="h-3.5 w-3.5" /> Prikaži na zemljevidu
                </button>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(route)} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Uredi pot">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => remove(route)} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-500/15 hover:text-red-400" aria-label="Izbriši pot">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={creating} onClose={() => { setCreating(false); setEditing(null); }} title={editing ? 'Uredi pot' : 'Nova pot'} wide>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          {!editing && (
            <div className="sm:col-span-2">
              <Field label="Hitra izbira prednastavitve">
                <select className={inputClass} defaultValue="" onChange={(e) => e.target.value && applyPreset(e.target.value)}>
                  <option value="">— izberite prednastavitev —</option>
                  {ROUTE_PRESETS.map((p) => (
                    <option key={p.key} value={p.key}>{p.name} ({p.distance_km} km)</option>
                  ))}
                </select>
              </Field>
            </div>
          )}
          <div className="sm:col-span-2">
            <Field label="Ime poti">
              <input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ljubljana → Maribor" required />
            </Field>
          </div>
          <Field label="Izhodišče">
            <input className={inputClass} value={form.origin_name} onChange={(e) => setForm({ ...form, origin_name: e.target.value })} placeholder="Ljubljana — center" required />
          </Field>
          <Field label="Cilj">
            <input className={inputClass} value={form.dest_name} onChange={(e) => setForm({ ...form, dest_name: e.target.value })} placeholder="Maribor — center" required />
          </Field>
          <Field label="Izhodišče lat">
            <input className={inputClass} type="number" step="any" value={form.origin_lat} onChange={(e) => setForm({ ...form, origin_lat: e.target.value })} required />
          </Field>
          <Field label="Izhodišče lng">
            <input className={inputClass} type="number" step="any" value={form.origin_lng} onChange={(e) => setForm({ ...form, origin_lng: e.target.value })} required />
          </Field>
          <Field label="Cilj lat">
            <input className={inputClass} type="number" step="any" value={form.dest_lat} onChange={(e) => setForm({ ...form, dest_lat: e.target.value })} required />
          </Field>
          <Field label="Cilj lng">
            <input className={inputClass} type="number" step="any" value={form.dest_lng} onChange={(e) => setForm({ ...form, dest_lng: e.target.value })} required />
          </Field>
          <Field label="Ceste (via)">
            <input className={inputClass} value={form.via_roads} onChange={(e) => setForm({ ...form, via_roads: e.target.value })} placeholder="A1" />
          </Field>
          <Field label="Razdalja (km)">
            <input className={inputClass} type="number" step="any" min={1} value={form.distance_km} onChange={(e) => setForm({ ...form, distance_km: e.target.value })} required />
          </Field>
          <Field label="Trajanje (min)">
            <input className={inputClass} type="number" min={1} value={form.base_duration_min} onChange={(e) => setForm({ ...form, base_duration_min: e.target.value })} required />
          </Field>
          <div className="flex flex-wrap gap-4 sm:col-span-2">
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={form.notify_police} onChange={(e) => setForm({ ...form, notify_police: e.target.checked })} className="h-4 w-4 accent-emerald-500" />
              Obvestila o policiji
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={form.notify_accidents} onChange={(e) => setForm({ ...form, notify_accidents: e.target.checked })} className="h-4 w-4 accent-emerald-500" />
              Obvestila o nesrečah
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={form.notify_jams} onChange={(e) => setForm({ ...form, notify_jams: e.target.checked })} className="h-4 w-4 accent-emerald-500" />
              Obvestila o zastojih
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={form.is_pinned} onChange={(e) => setForm({ ...form, is_pinned: e.target.checked })} className="h-4 w-4 accent-emerald-500" />
              Pripni na vrh
            </label>
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <PrimaryButton type="submit" disabled={saving} className="flex-1">
              {saving ? 'Shranjujem …' : editing ? 'Shrani spremembe' : 'Shrani pot'}
            </PrimaryButton>
            <GhostButton onClick={() => { setCreating(false); setEditing(null); }}>Prekliči</GhostButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ---------- Settings ----------
export function SettingsPage({
  user,
  onUpdated,
  onError,
  onRequireAuth,
  onLogout,
}: {
  user: User | null;
  onUpdated: (user: User) => void;
  onError: (msg: string) => void;
  onRequireAuth: () => void;
  onLogout: () => void;
}) {
  const [form, setForm] = useState({
    name: '',
    vehicle_name: '',
    vehicle_plate: '',
    speed_tolerance_kmh: '5',
    home_region: '',
    audio_alerts: true,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [apiBase, setApiBaseState] = useState(getApiBase());

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name,
        vehicle_name: user.vehicle_name,
        vehicle_plate: user.vehicle_plate,
        speed_tolerance_kmh: String(user.speed_tolerance_kmh),
        home_region: user.home_region,
        audio_alerts: user.audio_alerts,
      });
    }
  }, [user]);

  if (!user) {
    return (
      <EmptyState
        icon={<UserPlus className="h-7 w-7" />}
        title="Prijavite se za nastavitve"
        message="Nastavitve vozila, tolerance hitrosti in obvestil so povezane z vašim računom."
        action={
          <PrimaryButton onClick={onRequireAuth}>
            <LogIn className="h-4 w-4" /> Prijava
          </PrimaryButton>
        }
      />
    );
  }

  const pushSaved = () => {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      const { user: updated } = await api.updateProfile({
        name: form.name.trim(),
        vehicle_name: form.vehicle_name.trim(),
        vehicle_plate: form.vehicle_plate.trim(),
        speed_tolerance_kmh: Number(form.speed_tolerance_kmh),
        home_region: form.home_region.trim(),
        audio_alerts: form.audio_alerts,
      } as Partial<User>);
      onUpdated(updated);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Shranjevanje ni uspelo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h2 className="text-lg font-extrabold text-white">Nastavitve</h2>
        <p className="text-sm text-slate-400">Vozilo, toleranca hitrosti in obvestila za GPS merilnik.</p>
      </div>
      <Card className="p-5">
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <Field label="Ime in priimek">
            <input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </Field>
          <Field label="E-pošta">
            <input className={`${inputClass} opacity-60`} value={user.email} disabled />
          </Field>
          <Field label="Vozilo">
            <input className={inputClass} value={form.vehicle_name} onChange={(e) => setForm({ ...form, vehicle_name: e.target.value })} placeholder="Škoda Octavia RS" required />
          </Field>
          <Field label="Registrska oznaka">
            <input className={inputClass} value={form.vehicle_plate} onChange={(e) => setForm({ ...form, vehicle_plate: e.target.value })} placeholder="LJ SP-2026" required />
          </Field>
          <Field label="Toleranca hitrosti (km/h)" hint="Opozorilo se oglasi šele čez to vrednost nad omejitvijo.">
            <input className={inputClass} type="number" min={0} max={30} value={form.speed_tolerance_kmh} onChange={(e) => setForm({ ...form, speed_tolerance_kmh: e.target.value })} required />
          </Field>
          <Field label="Domača regija">
            <input className={inputClass} value={form.home_region} onChange={(e) => setForm({ ...form, home_region: e.target.value })} placeholder="Osrednjeslovenska" required />
          </Field>
          <label className="flex items-center gap-2 text-sm text-slate-300 sm:col-span-2">
            <input type="checkbox" checked={form.audio_alerts} onChange={(e) => setForm({ ...form, audio_alerts: e.target.checked })} className="h-4 w-4 accent-emerald-500" />
            {form.audio_alerts ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
            Zvočna opozorila pri prekoračitvi hitrosti
          </label>
          <div className="flex items-center gap-3 sm:col-span-2">
            <PrimaryButton type="submit" disabled={saving}>
              {saving ? <Spinner className="h-4 w-4" /> : 'Shrani nastavitve'}
            </PrimaryButton>
            {saved && <span className="text-sm font-semibold text-emerald-400">Shranjeno ✓</span>}
          </div>
        </form>
      </Card>
      <Card className="p-5">
        <h3 className="text-sm font-bold text-slate-100">Strežnik (za mobilno aplikacijo)</h3>
        <p className="mt-1 text-sm text-slate-400">
          V mobilni aplikaciji vnesite URL strežnika, kjer teče SloPromet backend (npr. predogledni URL).
          V brskalniku pustite prazno.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            className={inputClass}
            value={apiBase}
            onChange={(e) => setApiBaseState(e.target.value)}
            placeholder="https://3000-xxxx.e2b.app"
          />
          <GhostButton
            onClick={() => {
              setApiBase(apiBase);
              pushSaved();
            }}
          >
            Shrani URL
          </GhostButton>
        </div>
      </Card>
      <Card className="p-5">
        <h3 className="text-sm font-bold text-slate-100">Račun</h3>
        <p className="mt-1 text-sm text-slate-400">
          Prijavljeni ste kot <b className="text-slate-200">{user.name}</b> ({user.email}) · ugled {user.reputation} točk
        </p>
        <GhostButton onClick={onLogout} className="mt-4">
          <LogOut className="h-4 w-4" /> Odjava
        </GhostButton>
      </Card>
    </div>
  );
}

// ---------- Auth modal ----------
export function AuthModal({
  open,
  onClose,
  onSuccess,
  onError,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: (user: User) => void;
  onError: (msg: string) => void;
}) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('demo@slopromet.si');
  const [password, setPassword] = useState('demo1234');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = mode === 'login' ? await api.login(email, password) : await api.register(name, email, password);
      onSuccess(res.user);
      onClose();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Prijava ni uspela.');
    } finally {
      setBusy(false);
    }
  };

  const demo = async () => {
    setBusy(true);
    try {
      const res = await api.demo();
      onSuccess(res.user);
      onClose();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Demo prijava ni uspela.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={mode === 'login' ? 'Prijava' : 'Registracija'}>
      <form onSubmit={submit} className="space-y-4">
        {mode === 'register' && (
          <Field label="Ime in priimek">
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Janez Novak" required />
          </Field>
        )}
        <Field label="E-pošta">
          <input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="demo@slopromet.si" required />
        </Field>
        <Field label="Geslo" hint={mode === 'register' ? 'Vsaj 6 znakov.' : 'Demo geslo: demo1234'}>
          <input className={inputClass} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        <PrimaryButton type="submit" disabled={busy} className="w-full">
          {busy ? <Spinner className="h-4 w-4" /> : mode === 'login' ? <><LogIn className="h-4 w-4" /> Prijavi se</> : <><UserPlus className="h-4 w-4" /> Ustvari račun</>}
        </PrimaryButton>
        <GhostButton onClick={demo} className="w-full">
          {busy ? <Spinner className="h-4 w-4" /> : 'Vstopi kot demo uporabnik'}
        </GhostButton>
        <p className="text-center text-sm text-slate-400">
          {mode === 'login' ? 'Še nimate računa? ' : 'Že imate račun? '}
          <button type="button" onClick={() => setMode(mode === 'login' ? 'register' : 'login')} className="font-bold text-emerald-400 hover:text-emerald-300">
            {mode === 'login' ? 'Registrirajte se' : 'Prijavite se'}
          </button>
        </p>
      </form>
    </Modal>
  );
}

export function IncidentTypeFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const options = [
    { key: 'all', label: 'Vsa' },
    { key: 'police', label: '🚔 Policija' },
    { key: 'accident', label: '💥 Nesreče' },
    { key: 'jam', label: '🚗 Zastoji' },
    { key: 'roadwork', label: '🚧 Dela' },
    { key: 'hazard', label: '⚠️ Nevarnosti' },
  ];
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt.key}
          onClick={() => onChange(opt.key)}
          className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
            value === opt.key
              ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
              : 'border-slate-700 bg-[#131a22] text-slate-300 hover:border-slate-600'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function useMemoSegments(segments: RoadSegment[]) {
  return useMemo(() => segments, [segments]);
}
