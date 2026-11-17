import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Car,
  CheckCircle2,
  Clock,
  Construction,
  Flag,
  MapPin,
  Pencil,
  Shield,
  Siren,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  XCircle,
} from 'lucide-react';
import type { Incident, IncidentType, Severity } from '../lib/types';
import { INCIDENT_META, SEVERITY_META, timeAgo } from '../lib/format';
import { Badge, Card, EmptyState, Field, GhostButton, Modal, PrimaryButton, inputClass } from './ui';

export function IncidentIcon({ type, className = 'h-5 w-5' }: { type: IncidentType; className?: string }) {
  switch (type) {
    case 'police':
      return <Shield className={className} />;
    case 'accident':
      return <Siren className={className} />;
    case 'jam':
      return <Car className={className} />;
    case 'roadwork':
      return <Construction className={className} />;
    default:
      return <AlertTriangle className={className} />;
  }
}

export function IncidentCard({
  incident,
  currentUserId,
  onVote,
  onEdit,
  onDelete,
  onResolve,
  onFocus,
}: {
  incident: Incident;
  currentUserId: number | null;
  onVote: (incident: Incident, vote: 'confirm' | 'dismiss') => void;
  onEdit: (incident: Incident) => void;
  onDelete: (incident: Incident) => void;
  onResolve: (incident: Incident) => void;
  onFocus: (incident: Incident) => void;
}) {
  const meta = INCIDENT_META[incident.type];
  const sev = SEVERITY_META[incident.severity] || SEVERITY_META.medium;
  const isMine = currentUserId != null && incident.reporter_id === currentUserId;
  const resolved = incident.status === 'resolved';
  return (
    <Card className={`p-4 ${resolved ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-3">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${meta.bg} ${meta.color} ${meta.border}`}>
          <IncidentIcon type={incident.type} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge className={`${meta.bg} ${meta.color} border-transparent`}>{meta.label}</Badge>
            <Badge className={`${sev.bg} ${sev.color} border-transparent`}>{sev.label}</Badge>
            <Badge className="border-slate-700 bg-slate-800/60 text-slate-300">{incident.road_code}</Badge>
            {resolved && (
              <Badge className="border-emerald-500/30 bg-emerald-500/15 text-emerald-300">
                <CheckCircle2 className="h-3 w-3" /> Razrešeno
              </Badge>
            )}
          </div>
          <h3 className="mt-2 text-sm font-bold text-slate-100">{incident.title}</h3>
          <p className="mt-1 line-clamp-3 text-sm text-slate-400">{incident.description}</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" /> {incident.location_name}
              {incident.direction ? ` · ${incident.direction}` : ''}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" /> {timeAgo(incident.created_at)} · {incident.reporter_name}
            </span>
            {incident.delay_min > 0 && <span>Zamuda: {incident.delay_min} min</span>}
            {incident.queue_km > 0 && <span>Kolona: {incident.queue_km} km</span>}
            {incident.speed_limit_kmh && incident.measured_speed_kmh && (
              <span>
                Merjena hitrost: {incident.measured_speed_kmh} km/h (omejitev {incident.speed_limit_kmh})
              </span>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              onClick={() => onVote(incident, 'confirm')}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition ${
                incident.my_vote === 'confirm'
                  ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
                  : 'border-slate-700 text-slate-300 hover:border-emerald-500/40 hover:text-emerald-300'
              }`}
            >
              <ThumbsUp className="h-3.5 w-3.5" /> Potrjujem ({incident.confirmations})
            </button>
            <button
              onClick={() => onVote(incident, 'dismiss')}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition ${
                incident.my_vote === 'dismiss'
                  ? 'border-red-500/50 bg-red-500/15 text-red-300'
                  : 'border-slate-700 text-slate-300 hover:border-red-500/40 hover:text-red-300'
              }`}
            >
              <ThumbsDown className="h-3.5 w-3.5" /> Ni več ({incident.dismissals})
            </button>
            <button
              onClick={() => onFocus(incident)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs font-bold text-slate-300 transition hover:border-slate-500 hover:text-white"
            >
              <MapPin className="h-3.5 w-3.5" /> Na zemljevidu
            </button>
            {isMine && !resolved && (
              <button
                onClick={() => onResolve(incident)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-bold text-emerald-300 transition hover:bg-emerald-500/20"
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Označi razrešeno
              </button>
            )}
            {isMine && (
              <div className="ml-auto flex gap-1">
                <button
                  onClick={() => onEdit(incident)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white"
                  aria-label="Uredi poročilo"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => onDelete(incident)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-500/15 hover:text-red-400"
                  aria-label="Izbriši poročilo"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

export function IncidentFormModal({
  open,
  initial,
  gps,
  onClose,
  onSubmit,
  saving,
}: {
  open: boolean;
  initial: Incident | null;
  gps: { lat: number | null; lng: number | null };
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState({
    type: 'police' as IncidentType,
    severity: 'medium' as Severity,
    title: '',
    description: '',
    road_code: '',
    region: '',
    location_name: '',
    direction: '',
    lat: '',
    lng: '',
    delay_min: '0',
    queue_km: '0',
    speed_limit_kmh: '',
    measured_speed_kmh: '',
  });

  useEffect(() => {
    if (open) {
      if (initial) {
        setForm({
          type: initial.type,
          severity: initial.severity,
          title: initial.title,
          description: initial.description,
          road_code: initial.road_code,
          region: initial.region,
          location_name: initial.location_name,
          direction: initial.direction,
          lat: String(initial.lat),
          lng: String(initial.lng),
          delay_min: String(initial.delay_min),
          queue_km: String(initial.queue_km),
          speed_limit_kmh: initial.speed_limit_kmh ? String(initial.speed_limit_kmh) : '',
          measured_speed_kmh: initial.measured_speed_kmh ? String(initial.measured_speed_kmh) : '',
        });
      } else {
        setForm({
          type: 'police',
          severity: 'medium',
          title: '',
          description: '',
          road_code: '',
          region: '',
          location_name: '',
          direction: '',
          lat: gps.lat != null ? String(gps.lat) : '',
          lng: gps.lng != null ? String(gps.lng) : '',
          delay_min: '0',
          queue_km: '0',
          speed_limit_kmh: '',
          measured_speed_kmh: '',
        });
      }
    }
  }, [open, initial, gps.lat, gps.lng]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      type: form.type,
      severity: form.severity,
      title: form.title.trim(),
      description: form.description.trim(),
      road_code: form.road_code.trim(),
      region: form.region.trim(),
      location_name: form.location_name.trim(),
      direction: form.direction.trim(),
      lat: Number(form.lat),
      lng: Number(form.lng),
      delay_min: Number(form.delay_min || 0),
      queue_km: Number(form.queue_km || 0),
      speed_limit_kmh: form.speed_limit_kmh ? Number(form.speed_limit_kmh) : null,
      measured_speed_kmh: form.measured_speed_kmh ? Number(form.measured_speed_kmh) : null,
    });
  };

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Uredi poročilo' : 'Prijavi dogodek'} wide>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Vrsta dogodka">
          <select className={inputClass} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as IncidentType })}>
            <option value="police">🚔 Policija / policijska kontrola</option>
            <option value="accident">💥 Prometna nesreča</option>
            <option value="jam">🚗 Zastoj</option>
            <option value="roadwork">🚧 Dela na cesti</option>
            <option value="hazard">⚠️ Nevarnost</option>
          </select>
        </Field>
        <Field label="Resnost">
          <select className={inputClass} value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value as Severity })}>
            <option value="low">Nizka</option>
            <option value="medium">Srednja</option>
            <option value="high">Visoka</option>
          </select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Naslov">
            <input className={inputClass} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="npr. Policijska kontrola — merjenje hitrosti" required />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Opis">
            <textarea className={`${inputClass} min-h-24`} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Opišite dogodek, smer vožnje, dolžino kolone …" required />
          </Field>
        </div>
        <Field label="Oznaka ceste">
          <input className={inputClass} value={form.road_code} onChange={(e) => setForm({ ...form, road_code: e.target.value })} placeholder="A1, A2, G2 …" required />
        </Field>
        <Field label="Regija">
          <input className={inputClass} value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} placeholder="Osrednjeslovenska" required />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Lokacija">
            <input className={inputClass} value={form.location_name} onChange={(e) => setForm({ ...form, location_name: e.target.value })} placeholder="npr. Brezovica — avtocesta A1" required />
          </Field>
        </div>
        <Field label="Smer">
          <input className={inputClass} value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value })} placeholder="smer Ljubljana" />
        </Field>
        <Field label="Zamuda (min)">
          <input className={inputClass} type="number" min={0} max={240} value={form.delay_min} onChange={(e) => setForm({ ...form, delay_min: e.target.value })} />
        </Field>
        <Field label="Zemljepisna širina (lat)" hint={gps.lat != null ? 'Samodejno iz GPS.' : 'Vnesite ročno.'}>
          <input className={inputClass} type="number" step="any" value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} placeholder="46.0569" required />
        </Field>
        <Field label="Zemljepisna dolžina (lng)">
          <input className={inputClass} type="number" step="any" value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} placeholder="14.5058" required />
        </Field>
        <Field label="Dolžina kolone (km)">
          <input className={inputClass} type="number" step="any" min={0} max={50} value={form.queue_km} onChange={(e) => setForm({ ...form, queue_km: e.target.value })} />
        </Field>
        <Field label="Omejitev hitrosti (km/h)">
          <input className={inputClass} type="number" min={20} max={160} value={form.speed_limit_kmh} onChange={(e) => setForm({ ...form, speed_limit_kmh: e.target.value })} placeholder="90" />
        </Field>
        <Field label="Izmerjena hitrost (km/h)">
          <input className={inputClass} type="number" min={20} max={300} value={form.measured_speed_kmh} onChange={(e) => setForm({ ...form, measured_speed_kmh: e.target.value })} placeholder="112" />
        </Field>
        <div className="flex gap-2 sm:col-span-2">
          <PrimaryButton type="submit" disabled={saving} className="flex-1">
            {saving ? 'Pošiljam …' : initial ? 'Shrani spremembe' : 'Objavi poročilo'}
          </PrimaryButton>
          <GhostButton onClick={onClose}>Prekliči</GhostButton>
        </div>
      </form>
    </Modal>
  );
}

export function IncidentsEmpty({ onReport }: { onReport: () => void }) {
  return (
    <EmptyState
      icon={<Flag className="h-7 w-7" />}
      title="Ni aktivnih poročil"
      message="Trenutno ni prijavljenih dogodkov za izbrani filter. Bodite prvi, ki poroča o policiji, nesreči ali zastoju."
      action={
        <PrimaryButton onClick={onReport}>
          <Flag className="h-4 w-4" /> Prijavi dogodek
        </PrimaryButton>
      }
    />
  );
}

export function ResolvedBadge() {
  return (
    <Badge className="border-emerald-500/30 bg-emerald-500/15 text-emerald-300">
      <XCircle className="h-3 w-3" /> Razrešeno
    </Badge>
  );
}
