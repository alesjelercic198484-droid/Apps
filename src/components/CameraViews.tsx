import { useEffect, useState } from 'react';
import {
  Camera as CameraIcon,
  ExternalLink,
  Gauge,
  Heart,
  HeartOff,
  MapPin,
  Pencil,
  RefreshCw,
  Thermometer,
  Trash2,
  Video,
  VideoOff,
  Wind,
} from 'lucide-react';
import type { Camera } from '../lib/types';
import { cameraImageUrl, FLOW_META, ROAD_TYPE_LABEL, SURFACE_LABEL } from '../lib/format';
import { Badge, Card, EmptyState, GhostButton, Modal, PrimaryButton, inputClass, Field } from './ui';

export function LiveImage({
  camera,
  refreshKey,
  className = 'aspect-video w-full object-cover',
  onError,
}: {
  camera: Camera;
  refreshKey: number;
  className?: string;
  onError?: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setFailed(false);
    setLoaded(false);
  }, [camera.image_url, refreshKey]);

  if (failed) {
    return (
      <div className={`flex flex-col items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900 text-slate-400 ${className}`}>
        <VideoOff className="mb-2 h-10 w-10" />
        <p className="px-4 text-center text-sm font-semibold">Slika kamere trenutno ni na voljo</p>
        <p className="mt-1 px-4 text-center text-xs text-slate-500">
          Posnetek se osveži vsako minuto na promet.si — poskusite znova čez nekaj sekund.
        </p>
        <a
          href={camera.image_url}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800"
        >
          Odpri neposredno <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    );
  }

  return (
    <div className="relative bg-slate-900">
      {!loaded && <div className="skeleton absolute inset-0" />}
      <img
        src={cameraImageUrl(camera, true)}
        alt={camera.name}
        loading="lazy"
        referrerPolicy="no-referrer"
        className={`${className} ${loaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}
        onLoad={() => setLoaded(true)}
        onError={() => {
          setFailed(true);
          onError?.();
        }}
      />
      <div className="pointer-events-none absolute left-2 top-2 flex items-center gap-1.5 rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-bold text-red-400 backdrop-blur">
        <span className="live-dot h-2 w-2 rounded-full bg-red-500" />
        V ŽIVO
      </div>
      <div className="pointer-events-none absolute bottom-2 right-2 rounded-md bg-black/70 px-2 py-1 font-mono text-[11px] font-semibold text-slate-200 backdrop-blur">
        {camera.road_code} · {camera.current_speed_kmh} km/h
      </div>
    </div>
  );
}

export function CameraCard({
  camera,
  refreshKey,
  onOpen,
  onToggleFavorite,
  onEdit,
  onDelete,
  canManage,
}: {
  camera: Camera;
  refreshKey: number;
  onOpen: (camera: Camera) => void;
  onToggleFavorite: (camera: Camera) => void;
  onEdit: (camera: Camera) => void;
  onDelete: (camera: Camera) => void;
  canManage: boolean;
}) {
  const flow = FLOW_META[camera.traffic_flow] || FLOW_META.smooth;
  return (
    <Card className="group overflow-hidden">
      <button onClick={() => onOpen(camera)} className="block w-full text-left">
        <LiveImage camera={camera} refreshKey={refreshKey} />
      </button>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold text-slate-100">{camera.name}</h3>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">
                {camera.road_code} · {camera.region} · {camera.direction}
              </span>
            </p>
          </div>
          <button
            onClick={() => onToggleFavorite(camera)}
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition ${
              camera.is_favorite
                ? 'border-rose-500/40 bg-rose-500/15 text-rose-400'
                : 'border-slate-700 text-slate-400 hover:border-rose-500/40 hover:text-rose-400'
            }`}
            aria-label={camera.is_favorite ? 'Odstrani iz priljubljenih' : 'Dodaj med priljubljene'}
            title={camera.is_favorite ? 'Odstrani iz priljubljenih' : 'Dodaj med priljubljene'}
          >
            {camera.is_favorite ? <Heart className="h-4 w-4 fill-current" /> : <Heart className="h-4 w-4" />}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Badge className={`${flow.bg} ${flow.color} border-transparent`}>{flow.label}</Badge>
          <Badge className="border-slate-700 bg-slate-800/60 text-slate-300">
            <Gauge className="h-3 w-3" /> {camera.current_speed_kmh}/{camera.speed_limit_kmh} km/h
          </Badge>
          <Badge className="border-slate-700 bg-slate-800/60 text-slate-300">
            <Thermometer className="h-3 w-3" /> {camera.temp_c}°C
          </Badge>
          <Badge className="border-slate-700 bg-slate-800/60 text-slate-300">{ROAD_TYPE_LABEL[camera.road_type] || camera.road_type}</Badge>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">Vir: {camera.operator} · promet.si</span>
          {canManage && (
            <div className="flex gap-1">
              <button
                onClick={() => onEdit(camera)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white"
                aria-label="Uredi kamero"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={() => onDelete(camera)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-red-500/15 hover:text-red-400"
                aria-label="Izbriši kamero"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

export function CameraDetailModal({
  camera,
  refreshKey,
  onClose,
  onToggleFavorite,
  onEdit,
  onDelete,
  canManage,
}: {
  camera: Camera | null;
  refreshKey: number;
  onClose: () => void;
  onToggleFavorite: (camera: Camera) => void;
  onEdit: (camera: Camera) => void;
  onDelete: (camera: Camera) => void;
  canManage: boolean;
}) {
  const [manualRefresh, setManualRefresh] = useState(0);
  if (!camera) return null;
  const flow = FLOW_META[camera.traffic_flow] || FLOW_META.smooth;
  return (
    <Modal open={!!camera} onClose={onClose} title={camera.name} wide>
      <div className="space-y-4">
        <div className="overflow-hidden rounded-2xl border border-slate-800">
          <LiveImage camera={camera} refreshKey={refreshKey + manualRefresh} />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-800 bg-[#0b0f14] p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Hitrost</p>
            <p className="mt-1 font-mono text-xl font-extrabold text-white">
              {camera.current_speed_kmh} <span className="text-xs font-semibold text-slate-400">/ {camera.speed_limit_kmh} km/h</span>
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-[#0b0f14] p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Promet</p>
            <p className={`mt-1 text-sm font-bold ${flow.color}`}>{flow.label}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-[#0b0f14] p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Vozišče</p>
            <p className="mt-1 text-sm font-bold text-slate-100">{SURFACE_LABEL[camera.surface] || camera.surface}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-[#0b0f14] p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Temperatura</p>
            <p className="mt-1 font-mono text-xl font-extrabold text-white">{camera.temp_c}°C</p>
          </div>
        </div>
        <div className="grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
          <p><span className="text-slate-500">Cesta:</span> {camera.road_code} ({ROAD_TYPE_LABEL[camera.road_type] || camera.road_type})</p>
          <p><span className="text-slate-500">Regija:</span> {camera.region}</p>
          <p><span className="text-slate-500">Smer:</span> {camera.direction || '—'}</p>
          <p><span className="text-slate-500">Nadmorska višina:</span> {camera.elevation_m} m</p>
          <p><span className="text-slate-500">Koordinate:</span> {camera.lat.toFixed(4)}, {camera.lng.toFixed(4)}</p>
          <p><span className="text-slate-500">Upravljavec:</span> {camera.operator}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <GhostButton onClick={() => setManualRefresh((v) => v + 1)}>
            <RefreshCw className="h-4 w-4" /> Osveži sliko
          </GhostButton>
          <button
            onClick={() => onToggleFavorite(camera)}
            className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
              camera.is_favorite
                ? 'border-rose-500/40 bg-rose-500/15 text-rose-300'
                : 'border-slate-700 bg-[#131a22] text-slate-200 hover:border-rose-500/40 hover:text-rose-300'
            }`}
          >
            {camera.is_favorite ? <HeartOff className="h-4 w-4" /> : <Heart className="h-4 w-4" />}
            {camera.is_favorite ? 'Odstrani iz priljubljenih' : 'Dodaj med priljubljene'}
          </button>
          <a
            href={camera.image_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-[#131a22] px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-slate-600"
          >
            <ExternalLink className="h-4 w-4" /> Original na promet.si
          </a>
          {canManage && (
            <>
              <GhostButton onClick={() => onEdit(camera)}>
                <Pencil className="h-4 w-4" /> Uredi
              </GhostButton>
              <button
                onClick={() => onDelete(camera)}
                className="inline-flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-300 transition hover:bg-red-500/20"
              >
                <Trash2 className="h-4 w-4" /> Izbriši
              </button>
            </>
          )}
        </div>
        <p className="text-xs text-slate-500">
          Slike so uradni posnetki DARS / DRSI, posodobljeni vsako minuto prek portala promet.si. Avtorske pravice: promet.si.
        </p>
      </div>
    </Modal>
  );
}

export function CameraFormModal({
  open,
  initial,
  onClose,
  onSubmit,
  saving,
}: {
  open: boolean;
  initial: Camera | null;
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState({
    name: '',
    road_code: '',
    road_type: 'regional',
    region: '',
    direction: '',
    lat: '',
    lng: '',
    image_url: '',
    operator: 'DARS / DRSI',
    speed_limit_kmh: '90',
  });

  useEffect(() => {
    if (open) {
      setForm({
        name: initial?.name || '',
        road_code: initial?.road_code || '',
        road_type: initial?.road_type || 'regional',
        region: initial?.region || '',
        direction: initial?.direction || '',
        lat: initial ? String(initial.lat) : '',
        lng: initial ? String(initial.lng) : '',
        image_url: initial?.image_url || '',
        operator: initial?.operator || 'DARS / DRSI',
        speed_limit_kmh: initial ? String(initial.speed_limit_kmh) : '90',
      });
    }
  }, [open, initial]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name: form.name.trim(),
      road_code: form.road_code.trim(),
      road_type: form.road_type,
      region: form.region.trim(),
      direction: form.direction.trim(),
      lat: Number(form.lat),
      lng: Number(form.lng),
      image_url: form.image_url.trim(),
      operator: form.operator.trim(),
      speed_limit_kmh: Number(form.speed_limit_kmh),
    });
  };

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Uredi kamero' : 'Dodaj kamero'} wide>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Ime kamere">
            <input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="npr. Ljubljana — Brezovica" required />
          </Field>
        </div>
        <Field label="Oznaka ceste">
          <input className={inputClass} value={form.road_code} onChange={(e) => setForm({ ...form, road_code: e.target.value })} placeholder="A1, A2, G2 …" required />
        </Field>
        <Field label="Vrsta ceste">
          <select className={inputClass} value={form.road_type} onChange={(e) => setForm({ ...form, road_type: e.target.value })}>
            <option value="motorway">Avtocesta</option>
            <option value="expressway">Hitra cesta</option>
            <option value="regional">Regionalna cesta</option>
            <option value="urban">Mestna cesta</option>
          </select>
        </Field>
        <Field label="Regija">
          <input className={inputClass} value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} placeholder="Osrednjeslovenska" required />
        </Field>
        <Field label="Smer">
          <input className={inputClass} value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value })} placeholder="smer Ljubljana" />
        </Field>
        <Field label="Zemljepisna širina (lat)">
          <input className={inputClass} type="number" step="any" value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} placeholder="46.0569" required />
        </Field>
        <Field label="Zemljepisna dolžina (lng)">
          <input className={inputClass} type="number" step="any" value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} placeholder="14.5058" required />
        </Field>
        <div className="sm:col-span-2">
          <Field label="URL slike (JPG)" hint="Neposredna povezava do posnetka kamere, npr. https://www.drsc.si/kamere/…">
            <input className={inputClass} type="url" value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://www.drsc.si/kamere/…" required />
          </Field>
        </div>
        <Field label="Upravljavec">
          <input className={inputClass} value={form.operator} onChange={(e) => setForm({ ...form, operator: e.target.value })} placeholder="DARS / DRSI" />
        </Field>
        <Field label="Omejitev hitrosti (km/h)">
          <input className={inputClass} type="number" min={20} max={160} value={form.speed_limit_kmh} onChange={(e) => setForm({ ...form, speed_limit_kmh: e.target.value })} required />
        </Field>
        <div className="flex gap-2 sm:col-span-2">
          <PrimaryButton type="submit" disabled={saving} className="flex-1">
            {saving ? 'Shranjujem …' : initial ? 'Shrani spremembe' : 'Dodaj kamero'}
          </PrimaryButton>
          <GhostButton onClick={onClose}>Prekliči</GhostButton>
        </div>
      </form>
    </Modal>
  );
}

export function CamerasEmpty({ onAdd }: { onAdd: () => void }) {
  return (
    <EmptyState
      icon={<Video className="h-7 w-7" />}
      title="Ni kamer za prikaz"
      message="Za izbrana filtra ni najdenih kamer. Poskusite spremeniti iskanje ali dodajte svojo kamero."
      action={
        <PrimaryButton onClick={onAdd}>
          <CameraIcon className="h-4 w-4" /> Dodaj kamero
        </PrimaryButton>
      }
    />
  );
}

export function WindIcon() {
  return <Wind className="h-4 w-4" />;
}
