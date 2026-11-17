import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { db, inTransaction } from './db.ts';
import { seedDatabase } from './seed.ts';
import {
  attachUser,
  requireAuth,
  hashPassword,
  verifyPassword,
  setAuthCookie,
  clearAuthCookie,
  getUserById,
  type AuthedRequest,
} from './auth.ts';
import { addSseClient, broadcastEvent } from './sse.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const isProd = process.env.NODE_ENV === 'production';

seedDatabase();

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(attachUser);

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');

  // The Capacitor app is served from https://localhost and calls this API.
  // Allow only that mobile origin in production; development may use any Vite origin.
  const origin = req.headers.origin;
  const mobileOrigins = new Set(['https://localhost', 'capacitor://localhost']);
  const configuredOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const allowOrigin = origin && (!isProd || mobileOrigins.has(origin) || configuredOrigins.includes(origin));
  if (allowOrigin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  }
  if (req.method === 'OPTIONS') {
    res.sendStatus(allowOrigin ? 204 : 403);
    return;
  }
  next();
});

// ---------- helpers ----------
function formatCamera(row: Record<string, unknown>) {
  return {
    id: Number(row.id),
    code: String(row.code),
    name: String(row.name),
    road_code: String(row.road_code),
    road_type: String(row.road_type),
    region: String(row.region),
    direction: String(row.direction),
    lat: Number(row.lat),
    lng: Number(row.lng),
    image_url: String(row.image_url),
    source_url: String(row.source_url),
    operator: String(row.operator),
    status: String(row.status),
    speed_limit_kmh: Number(row.speed_limit_kmh),
    current_speed_kmh: Number(row.current_speed_kmh),
    traffic_flow: String(row.traffic_flow),
    surface: String(row.surface),
    temp_c: Number(row.temp_c),
    elevation_m: Number(row.elevation_m),
    is_favorite: Boolean(row.is_favorite),
    created_by: row.created_by == null ? null : Number(row.created_by),
    updated_at: String(row.updated_at),
  };
}

function formatIncident(row: Record<string, unknown>) {
  return {
    id: Number(row.id),
    type: String(row.type),
    severity: String(row.severity),
    status: String(row.status),
    title: String(row.title),
    description: String(row.description),
    road_code: String(row.road_code),
    region: String(row.region),
    location_name: String(row.location_name),
    direction: String(row.direction),
    lat: Number(row.lat),
    lng: Number(row.lng),
    delay_min: Number(row.delay_min),
    queue_km: Number(row.queue_km),
    speed_limit_kmh: row.speed_limit_kmh == null ? null : Number(row.speed_limit_kmh),
    measured_speed_kmh: row.measured_speed_kmh == null ? null : Number(row.measured_speed_kmh),
    confirmations: Number(row.confirmations),
    dismissals: Number(row.dismissals),
    reporter_id: row.reporter_id == null ? null : Number(row.reporter_id),
    reporter_name: String(row.reporter_name),
    my_vote: row.my_vote == null ? null : String(row.my_vote),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function formatSegment(row: Record<string, unknown>) {
  return {
    id: Number(row.id),
    code: String(row.code),
    name: String(row.name),
    corridor: String(row.corridor),
    region: String(row.region),
    road_type: String(row.road_type),
    length_km: Number(row.length_km),
    speed_limit_kmh: Number(row.speed_limit_kmh),
    avg_speed_kmh: Number(row.avg_speed_kmh),
    density_pct: Number(row.density_pct),
    flow_status: String(row.flow_status),
    surface: String(row.surface),
    temp_c: Number(row.temp_c),
    wind_kmh: Number(row.wind_kmh),
    delay_min: Number(row.delay_min),
    note: String(row.note),
    polyline_key: String(row.polyline_key),
    updated_by: row.updated_by == null ? null : Number(row.updated_by),
    updated_at: String(row.updated_at),
  };
}

function formatRoute(row: Record<string, unknown>) {
  return {
    id: Number(row.id),
    user_id: Number(row.user_id),
    name: String(row.name),
    origin_name: String(row.origin_name),
    origin_lat: Number(row.origin_lat),
    origin_lng: Number(row.origin_lng),
    dest_name: String(row.dest_name),
    dest_lat: Number(row.dest_lat),
    dest_lng: Number(row.dest_lng),
    via_roads: String(row.via_roads),
    distance_km: Number(row.distance_km),
    base_duration_min: Number(row.base_duration_min),
    preset_key: String(row.preset_key),
    notify_police: Boolean(row.notify_police),
    notify_accidents: Boolean(row.notify_accidents),
    notify_jams: Boolean(row.notify_jams),
    is_pinned: Boolean(row.is_pinned),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

const CAMERA_SELECT = `
  SELECT c.*, CASE WHEN cf.camera_id IS NOT NULL THEN 1 ELSE 0 END AS is_favorite
  FROM cameras c
  LEFT JOIN camera_favorites cf ON cf.camera_id = c.id AND cf.user_id = ?
`;

const INCIDENT_SELECT = `
  SELECT i.*, v.vote AS my_vote
  FROM incidents i
  LEFT JOIN incident_votes v ON v.incident_id = i.id AND v.user_id = ?
`;

// ---------- health ----------
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString(), version: '1.0.0' });
});

// ---------- auth ----------
const authSchema = z.object({
  name: z.string().trim().min(2, 'Ime mora imeti vsaj 2 znaka.').max(60).optional(),
  email: z.string().trim().email('Vnesite veljaven e-poštni naslov.').max(120),
  password: z.string().min(6, 'Geslo mora imeti vsaj 6 znakov.').max(120),
});

app.post('/api/auth/register', (req, res) => {
  const parsed = authSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Neveljavni podatki.' });
    return;
  }
  const name = parsed.data.name || parsed.data.email.split('@')[0];
  const email = parsed.data.email.toLowerCase();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as { id: number } | undefined;
  if (existing) {
    res.status(409).json({ error: 'Uporabnik s tem e-poštnim naslovom že obstaja.' });
    return;
  }
  const now = new Date().toISOString();
  const result = db
    .prepare(
      `INSERT INTO users (name, email, password_hash, role, vehicle_name, vehicle_plate, speed_tolerance_kmh, home_region, audio_alerts, reputation, created_at)
       VALUES (?, ?, ?, 'driver', 'Škoda Octavia RS', 'LJ SP-2026', 5, 'Osrednjeslovenska', 1, 120, ?)`
    )
    .run(name, email, hashPassword(parsed.data.password), now);
  const userId = Number(result.lastInsertRowid);
  setAuthCookie(req, res, userId);
  res.status(201).json({ user: getUserById(userId) });
});

app.post('/api/auth/login', (req, res) => {
  const parsed = authSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Neveljavni podatki.' });
    return;
  }
  const email = parsed.data.email.toLowerCase();
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as Record<string, unknown> | undefined;
  if (!row || !verifyPassword(parsed.data.password, String(row.password_hash))) {
    res.status(401).json({ error: 'Napačen e-poštni naslov ali geslo.' });
    return;
  }
  setAuthCookie(req, res, Number(row.id));
  res.json({ user: getUserById(Number(row.id)) });
});

app.post('/api/auth/demo', (req, res) => {
  const email = 'demo@slopromet.si';
  let row = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as Record<string, unknown> | undefined;
  if (!row) {
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO users (name, email, password_hash, role, vehicle_name, vehicle_plate, speed_tolerance_kmh, home_region, audio_alerts, reputation, created_at)
       VALUES (?, ?, ?, 'driver', 'Škoda Octavia RS', 'LJ SP-2026', 5, 'Osrednjeslovenska', 1, 120, ?)`
    ).run('Demo voznik', email, hashPassword('demo1234'), now);
    row = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as Record<string, unknown> | undefined;
  }
  setAuthCookie(req, res, Number((row as Record<string, unknown>).id));
  res.json({ user: getUserById(Number((row as Record<string, unknown>).id)) });
});

app.post('/api/auth/logout', (req, res) => {
  clearAuthCookie(req, res);
  res.json({ ok: true });
});

app.get('/api/auth/me', (req: AuthedRequest, res) => {
  res.json({ user: req.user || null });
});

const profileSchema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  vehicle_name: z.string().trim().min(2).max(80).optional(),
  vehicle_plate: z.string().trim().min(2).max(20).optional(),
  speed_tolerance_kmh: z.number().int().min(0).max(30).optional(),
  home_region: z.string().trim().min(2).max(60).optional(),
  audio_alerts: z.boolean().optional(),
});

app.patch('/api/auth/profile', requireAuth, (req: AuthedRequest, res) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Neveljavni podatki.' });
    return;
  }
  const data = parsed.data;
  const sets: string[] = [];
  const values: (string | number | null)[] = [];
  if (data.name !== undefined) { sets.push('name = ?'); values.push(data.name); }
  if (data.vehicle_name !== undefined) { sets.push('vehicle_name = ?'); values.push(data.vehicle_name); }
  if (data.vehicle_plate !== undefined) { sets.push('vehicle_plate = ?'); values.push(data.vehicle_plate); }
  if (data.speed_tolerance_kmh !== undefined) { sets.push('speed_tolerance_kmh = ?'); values.push(data.speed_tolerance_kmh); }
  if (data.home_region !== undefined) { sets.push('home_region = ?'); values.push(data.home_region); }
  if (data.audio_alerts !== undefined) { sets.push('audio_alerts = ?'); values.push(data.audio_alerts ? 1 : 0); }
  if (sets.length === 0) {
    res.json({ user: req.user });
    return;
  }
  values.push(req.user!.id);
  db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  res.json({ user: getUserById(req.user!.id) });
});

// ---------- cameras ----------
app.get('/api/cameras', (req: AuthedRequest, res) => {
  const userId = req.user?.id ?? -1;
  const rows = db.prepare(`${CAMERA_SELECT} ORDER BY region, name`).all(userId) as Record<string, unknown>[];
  res.json({ cameras: rows.map(formatCamera) });
});

app.get('/api/cameras/:id', (req: AuthedRequest, res) => {
  const userId = req.user?.id ?? -1;
  const row = db.prepare(`${CAMERA_SELECT} WHERE c.id = ?`).get(userId, Number(req.params.id)) as Record<string, unknown> | undefined;
  if (!row) {
    res.status(404).json({ error: 'Kamera ni najdena.' });
    return;
  }
  res.json({ camera: formatCamera(row) });
});

const cameraSchema = z.object({
  name: z.string().trim().min(3, 'Ime kamere je prekratko.').max(120),
  road_code: z.string().trim().min(1).max(10),
  road_type: z.enum(['motorway', 'expressway', 'regional', 'urban']).default('regional'),
  region: z.string().trim().min(2).max(60),
  direction: z.string().trim().max(120).default(''),
  lat: z.number().min(44).max(47.5),
  lng: z.number().min(12.5).max(17),
  image_url: z.string().url('Vnesite veljaven URL slike.').max(500),
  operator: z.string().trim().max(60).default('DARS / DRSI'),
  speed_limit_kmh: z.number().int().min(20).max(160).default(90),
});

app.post('/api/cameras', requireAuth, (req: AuthedRequest, res) => {
  const parsed = cameraSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Neveljavni podatki.' });
    return;
  }
  const d = parsed.data;
  const code = `USER-${Date.now().toString(36).toUpperCase()}`;
  const now = new Date().toISOString();
  const result = db
    .prepare(
      `INSERT INTO cameras (code, name, road_code, road_type, region, direction, lat, lng, image_url, source_url, operator, status, speed_limit_kmh, current_speed_kmh, traffic_flow, surface, temp_c, elevation_m, created_by, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'online', ?, 0, 'smooth', 'suho', 8.0, 300, ?, ?)`
    )
    .run(code, d.name, d.road_code, d.road_type, d.region, d.direction, d.lat, d.lng, d.image_url, 'https://www.promet.si/sl/kamere', d.operator, d.speed_limit_kmh, req.user!.id, now);
  const id = Number(result.lastInsertRowid);
  const row = db.prepare(`${CAMERA_SELECT} WHERE c.id = ?`).get(req.user!.id, id) as Record<string, unknown>;
  const camera = formatCamera(row);
  broadcastEvent('camera:created', { camera });
  res.status(201).json({ camera });
});

app.patch('/api/cameras/:id', requireAuth, (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const row = db.prepare('SELECT * FROM cameras WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!row) {
    res.status(404).json({ error: 'Kamera ni najdena.' });
    return;
  }
  if (Number(row.created_by) !== req.user!.id) {
    res.status(403).json({ error: 'Lahko urejate le svoje kamere.' });
    return;
  }
  const partial = cameraSchema.partial();
  const parsed = partial.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Neveljavni podatki.' });
    return;
  }
  const sets: string[] = [];
  const values: (string | number | null)[] = [];
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value !== undefined) {
      sets.push(`${key} = ?`);
      values.push(value);
    }
  }
  if (sets.length === 0) {
    res.json({ camera: formatCamera(row) });
    return;
  }
  sets.push('updated_at = ?');
  values.push(new Date().toISOString(), id);
  db.prepare(`UPDATE cameras SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  const updated = db.prepare(`${CAMERA_SELECT} WHERE c.id = ?`).get(req.user!.id, id) as Record<string, unknown>;
  const camera = formatCamera(updated);
  broadcastEvent('camera:updated', { camera });
  res.json({ camera });
});

app.delete('/api/cameras/:id', requireAuth, (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const row = db.prepare('SELECT * FROM cameras WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!row) {
    res.status(404).json({ error: 'Kamera ni najdena.' });
    return;
  }
  if (Number(row.created_by) !== req.user!.id) {
    res.status(403).json({ error: 'Lahko brišete le svoje kamere.' });
    return;
  }
  db.prepare('DELETE FROM cameras WHERE id = ?').run(id);
  broadcastEvent('camera:deleted', { id });
  res.json({ ok: true });
});

app.post('/api/cameras/:id/favorite', requireAuth, (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const cam = db.prepare('SELECT id FROM cameras WHERE id = ?').get(id) as { id: number } | undefined;
  if (!cam) {
    res.status(404).json({ error: 'Kamera ni najdena.' });
    return;
  }
  db.prepare('INSERT OR IGNORE INTO camera_favorites (user_id, camera_id) VALUES (?, ?)').run(req.user!.id, id);
  res.json({ ok: true, is_favorite: true });
});

app.delete('/api/cameras/:id/favorite', requireAuth, (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  db.prepare('DELETE FROM camera_favorites WHERE user_id = ? AND camera_id = ?').run(req.user!.id, id);
  res.json({ ok: true, is_favorite: false });
});

// ---------- incidents ----------
const incidentSchema = z.object({
  type: z.enum(['police', 'accident', 'jam', 'roadwork', 'hazard']),
  severity: z.enum(['low', 'medium', 'high']).default('medium'),
  title: z.string().trim().min(5, 'Naslov je prekratko.').max(160),
  description: z.string().trim().min(10, 'Opis je prekratko.').max(2000),
  road_code: z.string().trim().min(1).max(10),
  region: z.string().trim().min(2).max(60),
  location_name: z.string().trim().min(3).max(160),
  direction: z.string().trim().max(120).default(''),
  lat: z.number().min(44).max(47.5),
  lng: z.number().min(12.5).max(17),
  delay_min: z.number().int().min(0).max(240).default(0),
  queue_km: z.number().min(0).max(50).default(0),
  speed_limit_kmh: z.number().int().min(20).max(160).nullable().optional(),
  measured_speed_kmh: z.number().int().min(20).max(300).nullable().optional(),
});

app.get('/api/incidents', (req: AuthedRequest, res) => {
  const userId = req.user?.id ?? -1;
  const rows = db.prepare(`${INCIDENT_SELECT} ORDER BY created_at DESC LIMIT 200`).all(userId) as Record<string, unknown>[];
  res.json({ incidents: rows.map(formatIncident) });
});

app.get('/api/incidents/:id', (req: AuthedRequest, res) => {
  const userId = req.user?.id ?? -1;
  const row = db.prepare(`${INCIDENT_SELECT} WHERE i.id = ?`).get(userId, Number(req.params.id)) as Record<string, unknown> | undefined;
  if (!row) {
    res.status(404).json({ error: 'Poročilo ni najdeno.' });
    return;
  }
  res.json({ incident: formatIncident(row) });
});

app.post('/api/incidents', requireAuth, (req: AuthedRequest, res) => {
  const parsed = incidentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Neveljavni podatki.' });
    return;
  }
  const d = parsed.data;
  const now = new Date().toISOString();
  const result = db
    .prepare(
      `INSERT INTO incidents (type, severity, status, title, description, road_code, region, location_name, direction, lat, lng, delay_min, queue_km, speed_limit_kmh, measured_speed_kmh, confirmations, dismissals, reporter_id, reporter_name, created_at, updated_at)
       VALUES (?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?, ?, ?)`
    )
    .run(
      d.type, d.severity, d.title, d.description, d.road_code, d.region, d.location_name, d.direction,
      d.lat, d.lng, d.delay_min, d.queue_km, d.speed_limit_kmh ?? null, d.measured_speed_kmh ?? null,
      req.user!.id, req.user!.name, now, now
    );
  const id = Number(result.lastInsertRowid);
  db.prepare('INSERT OR IGNORE INTO incident_votes (user_id, incident_id, vote, created_at) VALUES (?, ?, ?, ?)')
    .run(req.user!.id, id, 'confirm', now);
  const row = db.prepare(`${INCIDENT_SELECT} WHERE i.id = ?`).get(req.user!.id, id) as Record<string, unknown>;
  const incident = formatIncident(row);
  broadcastEvent('incident:created', { incident });
  res.status(201).json({ incident });
});

app.patch('/api/incidents/:id', requireAuth, (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const row = db.prepare('SELECT * FROM incidents WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!row) {
    res.status(404).json({ error: 'Poročilo ni najdeno.' });
    return;
  }
  if (Number(row.reporter_id) !== req.user!.id) {
    res.status(403).json({ error: 'Lahko urejate le svoja poročila.' });
    return;
  }
  const parsed = incidentSchema.partial().extend({
    status: z.enum(['active', 'resolved']).optional(),
  }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Neveljavni podatki.' });
    return;
  }
  const sets: string[] = [];
  const values: (string | number | null)[] = [];
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value !== undefined) {
      sets.push(`${key} = ?`);
      values.push(value);
    }
  }
  if (sets.length === 0) {
    res.json({ incident: formatIncident(row) });
    return;
  }
  sets.push('updated_at = ?');
  values.push(new Date().toISOString(), id);
  db.prepare(`UPDATE incidents SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  const updated = db.prepare(`${INCIDENT_SELECT} WHERE i.id = ?`).get(req.user!.id, id) as Record<string, unknown>;
  const incident = formatIncident(updated);
  broadcastEvent('incident:updated', { incident });
  res.json({ incident });
});

app.delete('/api/incidents/:id', requireAuth, (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const row = db.prepare('SELECT * FROM incidents WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!row) {
    res.status(404).json({ error: 'Poročilo ni najdeno.' });
    return;
  }
  if (Number(row.reporter_id) !== req.user!.id) {
    res.status(403).json({ error: 'Lahko brišete le svoja poročila.' });
    return;
  }
  db.prepare('DELETE FROM incidents WHERE id = ?').run(id);
  broadcastEvent('incident:deleted', { id });
  res.json({ ok: true });
});

app.post('/api/incidents/:id/vote', requireAuth, (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const voteSchema = z.object({ vote: z.enum(['confirm', 'dismiss']) });
  const parsed = voteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Neveljaven glas.' });
    return;
  }
  const row = db.prepare('SELECT * FROM incidents WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!row) {
    res.status(404).json({ error: 'Poročilo ni najdeno.' });
    return;
  }
  const now = new Date().toISOString();
  const existing = db.prepare('SELECT vote FROM incident_votes WHERE user_id = ? AND incident_id = ?')
    .get(req.user!.id, id) as { vote: string } | undefined;

  inTransaction(() => {
    if (existing) {
      if (existing.vote === parsed.data.vote) {
        // toggle off
        db.prepare('DELETE FROM incident_votes WHERE user_id = ? AND incident_id = ?').run(req.user!.id, id);
        if (parsed.data.vote === 'confirm') {
          db.prepare('UPDATE incidents SET confirmations = MAX(0, confirmations - 1) WHERE id = ?').run(id);
        } else {
          db.prepare('UPDATE incidents SET dismissals = MAX(0, dismissals - 1) WHERE id = ?').run(id);
        }
      } else {
        db.prepare('UPDATE incident_votes SET vote = ? WHERE user_id = ? AND incident_id = ?')
          .run(parsed.data.vote, req.user!.id, id);
        if (existing.vote === 'confirm') {
          db.prepare('UPDATE incidents SET confirmations = MAX(0, confirmations - 1) WHERE id = ?').run(id);
        } else {
          db.prepare('UPDATE incidents SET dismissals = MAX(0, dismissals - 1) WHERE id = ?').run(id);
        }
        if (parsed.data.vote === 'confirm') {
          db.prepare('UPDATE incidents SET confirmations = confirmations + 1 WHERE id = ?').run(id);
        } else {
          db.prepare('UPDATE incidents SET dismissals = dismissals + 1 WHERE id = ?').run(id);
        }
      }
    } else {
      db.prepare('INSERT INTO incident_votes (user_id, incident_id, vote, created_at) VALUES (?, ?, ?, ?)')
        .run(req.user!.id, id, parsed.data.vote, now);
      if (parsed.data.vote === 'confirm') {
        db.prepare('UPDATE incidents SET confirmations = confirmations + 1 WHERE id = ?').run(id);
      } else {
        db.prepare('UPDATE incidents SET dismissals = dismissals + 1 WHERE id = ?').run(id);
      }
    }
  });

  const updated = db.prepare(`${INCIDENT_SELECT} WHERE i.id = ?`).get(req.user!.id, id) as Record<string, unknown>;
  const incident = formatIncident(updated);
  broadcastEvent('incident:updated', { incident });
  res.json({ incident });
});

// ---------- road segments ----------
const segmentSchema = z.object({
  code: z.string().trim().min(2).max(20),
  name: z.string().trim().min(3).max(160),
  corridor: z.string().trim().min(1).max(10),
  region: z.string().trim().min(2).max(60),
  road_type: z.enum(['motorway', 'expressway', 'regional', 'urban']).default('motorway'),
  length_km: z.number().min(1).max(500),
  speed_limit_kmh: z.number().int().min(20).max(160),
  avg_speed_kmh: z.number().int().min(0).max(160),
  density_pct: z.number().int().min(0).max(100),
  flow_status: z.enum(['smooth', 'busy', 'congested']).default('smooth'),
  surface: z.enum(['suho', 'mokro', 'sneg', 'led', 'megla']).default('suho'),
  temp_c: z.number().min(-30).max(45).default(8),
  wind_kmh: z.number().int().min(0).max(150).default(10),
  delay_min: z.number().int().min(0).max(240).default(0),
  note: z.string().trim().max(500).default(''),
  polyline_key: z.string().trim().max(40).default(''),
});

app.get('/api/segments', (_req, res) => {
  const rows = db.prepare('SELECT * FROM road_segments ORDER BY corridor, name').all() as Record<string, unknown>[];
  res.json({ segments: rows.map(formatSegment) });
});

app.get('/api/segments/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM road_segments WHERE id = ?').get(Number(req.params.id)) as Record<string, unknown> | undefined;
  if (!row) {
    res.status(404).json({ error: 'Odsek ni najden.' });
    return;
  }
  res.json({ segment: formatSegment(row) });
});

app.post('/api/segments', requireAuth, (req: AuthedRequest, res) => {
  const parsed = segmentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Neveljavni podatki.' });
    return;
  }
  const d = parsed.data;
  const now = new Date().toISOString();
  const result = db
    .prepare(
      `INSERT INTO road_segments (code, name, corridor, region, road_type, length_km, speed_limit_kmh, avg_speed_kmh, density_pct, flow_status, surface, temp_c, wind_kmh, delay_min, note, polyline_key, updated_by, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(d.code, d.name, d.corridor, d.region, d.road_type, d.length_km, d.speed_limit_kmh, d.avg_speed_kmh, d.density_pct, d.flow_status, d.surface, d.temp_c, d.wind_kmh, d.delay_min, d.note, d.polyline_key, req.user!.id, now);
  const id = Number(result.lastInsertRowid);
  const row = db.prepare('SELECT * FROM road_segments WHERE id = ?').get(id) as Record<string, unknown>;
  const segment = formatSegment(row);
  broadcastEvent('segment:updated', { segment });
  res.status(201).json({ segment });
});

app.patch('/api/segments/:id', requireAuth, (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const row = db.prepare('SELECT * FROM road_segments WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!row) {
    res.status(404).json({ error: 'Odsek ni najden.' });
    return;
  }
  const parsed = segmentSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Neveljavni podatki.' });
    return;
  }
  const sets: string[] = [];
  const values: (string | number | null)[] = [];
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value !== undefined) {
      sets.push(`${key} = ?`);
      values.push(value);
    }
  }
  if (sets.length === 0) {
    res.json({ segment: formatSegment(row) });
    return;
  }
  sets.push('updated_by = ?');
  values.push(req.user!.id);
  sets.push('updated_at = ?');
  values.push(new Date().toISOString(), id);
  db.prepare(`UPDATE road_segments SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  const updated = db.prepare('SELECT * FROM road_segments WHERE id = ?').get(id) as Record<string, unknown>;
  const segment = formatSegment(updated);
  broadcastEvent('segment:updated', { segment });
  res.json({ segment });
});

app.delete('/api/segments/:id', requireAuth, (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const row = db.prepare('SELECT * FROM road_segments WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!row) {
    res.status(404).json({ error: 'Odsek ni najden.' });
    return;
  }
  db.prepare('DELETE FROM road_segments WHERE id = ?').run(id);
  broadcastEvent('segment:deleted', { id });
  res.json({ ok: true });
});

// ---------- saved routes ----------
const routeSchema = z.object({
  name: z.string().trim().min(3).max(120),
  origin_name: z.string().trim().min(2).max(120),
  origin_lat: z.number().min(44).max(47.5),
  origin_lng: z.number().min(12.5).max(17),
  dest_name: z.string().trim().min(2).max(120),
  dest_lat: z.number().min(44).max(47.5),
  dest_lng: z.number().min(12.5).max(17),
  via_roads: z.string().trim().max(120).default(''),
  distance_km: z.number().min(1).max(1000),
  base_duration_min: z.number().int().min(1).max(1440),
  preset_key: z.string().trim().max(40).default('custom'),
  notify_police: z.boolean().default(true),
  notify_accidents: z.boolean().default(true),
  notify_jams: z.boolean().default(true),
  is_pinned: z.boolean().default(false),
});

app.get('/api/routes', requireAuth, (req: AuthedRequest, res) => {
  const rows = db.prepare('SELECT * FROM saved_routes WHERE user_id = ? ORDER BY is_pinned DESC, updated_at DESC')
    .all(req.user!.id) as Record<string, unknown>[];
  res.json({ routes: rows.map(formatRoute) });
});

app.get('/api/routes/:id', requireAuth, (req: AuthedRequest, res) => {
  const row = db.prepare('SELECT * FROM saved_routes WHERE id = ? AND user_id = ?')
    .get(Number(req.params.id), req.user!.id) as Record<string, unknown> | undefined;
  if (!row) {
    res.status(404).json({ error: 'Pot ni najdena.' });
    return;
  }
  res.json({ route: formatRoute(row) });
});

app.post('/api/routes', requireAuth, (req: AuthedRequest, res) => {
  const parsed = routeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Neveljavni podatki.' });
    return;
  }
  const d = parsed.data;
  const now = new Date().toISOString();
  const result = db
    .prepare(
      `INSERT INTO saved_routes (user_id, name, origin_name, origin_lat, origin_lng, dest_name, dest_lat, dest_lng, via_roads, distance_km, base_duration_min, preset_key, notify_police, notify_accidents, notify_jams, is_pinned, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      req.user!.id, d.name, d.origin_name, d.origin_lat, d.origin_lng, d.dest_name, d.dest_lat, d.dest_lng,
      d.via_roads, d.distance_km, d.base_duration_min, d.preset_key,
      d.notify_police ? 1 : 0, d.notify_accidents ? 1 : 0, d.notify_jams ? 1 : 0, d.is_pinned ? 1 : 0,
      now, now
    );
  const id = Number(result.lastInsertRowid);
  const row = db.prepare('SELECT * FROM saved_routes WHERE id = ?').get(id) as Record<string, unknown>;
  res.status(201).json({ route: formatRoute(row) });
});

app.patch('/api/routes/:id', requireAuth, (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const row = db.prepare('SELECT * FROM saved_routes WHERE id = ? AND user_id = ?')
    .get(id, req.user!.id) as Record<string, unknown> | undefined;
  if (!row) {
    res.status(404).json({ error: 'Pot ni najdena.' });
    return;
  }
  const parsed = routeSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Neveljavni podatki.' });
    return;
  }
  const sets: string[] = [];
  const values: (string | number | null)[] = [];
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value !== undefined) {
      sets.push(`${key} = ?`);
      values.push(typeof value === 'boolean' ? (value ? 1 : 0) : (value as string | number | null));
    }
  }
  if (sets.length === 0) {
    res.json({ route: formatRoute(row) });
    return;
  }
  sets.push('updated_at = ?');
  values.push(new Date().toISOString(), id);
  db.prepare(`UPDATE saved_routes SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  const updated = db.prepare('SELECT * FROM saved_routes WHERE id = ?').get(id) as Record<string, unknown>;
  res.json({ route: formatRoute(updated) });
});

app.delete('/api/routes/:id', requireAuth, (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const row = db.prepare('SELECT * FROM saved_routes WHERE id = ? AND user_id = ?')
    .get(id, req.user!.id) as Record<string, unknown> | undefined;
  if (!row) {
    res.status(404).json({ error: 'Pot ni najdena.' });
    return;
  }
  db.prepare('DELETE FROM saved_routes WHERE id = ?').run(id);
  res.json({ ok: true });
});

// ---------- dashboard stats ----------
app.get('/api/stats', (req: AuthedRequest, res) => {
  const camCount = db.prepare('SELECT COUNT(*) AS c FROM cameras').get() as { c: number };
  const onlineCount = db.prepare("SELECT COUNT(*) AS c FROM cameras WHERE status = 'online'").get() as { c: number };
  const activeInc = db.prepare("SELECT COUNT(*) AS c FROM incidents WHERE status = 'active'").get() as { c: number };
  const policeCount = db.prepare("SELECT COUNT(*) AS c FROM incidents WHERE status = 'active' AND type = 'police'").get() as { c: number };
  const accidentCount = db.prepare("SELECT COUNT(*) AS c FROM incidents WHERE status = 'active' AND type = 'accident'").get() as { c: number };
  const jamCount = db.prepare("SELECT COUNT(*) AS c FROM incidents WHERE status = 'active' AND type = 'jam'").get() as { c: number };
  const segRows = db.prepare('SELECT avg_speed_kmh, density_pct FROM road_segments').all() as { avg_speed_kmh: number; density_pct: number }[];
  const avgSpeed = segRows.length ? Math.round(segRows.reduce((s, r) => s + r.avg_speed_kmh, 0) / segRows.length) : 0;
  const avgDensity = segRows.length ? Math.round(segRows.reduce((s, r) => s + r.density_pct, 0) / segRows.length) : 0;
  res.json({
    cameras_total: camCount.c,
    cameras_online: onlineCount.c,
    incidents_active: activeInc.c,
    police_active: policeCount.c,
    accidents_active: accidentCount.c,
    jams_active: jamCount.c,
    avg_speed_kmh: avgSpeed,
    avg_density_pct: avgDensity,
    user: req.user || null,
  });
});

// ---------- SSE live stream ----------
app.get('/api/stream', (req, res) => {
  addSseClient(res);
});

// ---------- static / dev ----------
if (isProd) {
  const clientDir = path.resolve(__dirname, '..', 'dist', 'client');
  if (fs.existsSync(clientDir)) {
    app.use(express.static(clientDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(clientDir, 'index.html'));
    });
  } else {
    app.get('*', (_req, res) => {
      res.status(503).send('Client build not found. Run npm run build first.');
    });
  }
} else {
  // Vite dev middleware
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    root: path.resolve(__dirname, '..'),
    server: { middlewareMode: true, hmr: false, allowedHosts: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`SloPromet GPS server listening on http://0.0.0.0:${PORT} (${isProd ? 'production' : 'development'})`);
});
