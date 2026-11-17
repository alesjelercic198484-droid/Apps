import seedJson from '../data/standaloneSeed.json';
import type { Camera, Incident, IncidentType, RoadSegment, SavedRoute, Severity, Stats, User } from './types';
import { LOCAL_DATA_EVENT } from './runtime';

const STORE_KEY = 'slopromet_standalone_db_v3';
const DB_VERSION = 3;

interface LocalUser extends User {
  password: string;
}

interface LocalDatabase {
  version: number;
  users: LocalUser[];
  sessionUserId: number | null;
  cameras: Camera[];
  incidents: Incident[];
  segments: RoadSegment[];
  routes: SavedRoute[];
  favorites: Record<string, number[]>;
  votes: Record<string, Record<string, 'confirm' | 'dismiss'>>;
  next: {
    user: number;
    camera: number;
    incident: number;
    segment: number;
    route: number;
  };
}

interface SeedShape {
  user: User;
  cameras: Camera[];
  incidents: Incident[];
  segments: RoadSegment[];
  routes: SavedRoute[];
}

const seed = seedJson as SeedShape;
let memoryDb: LocalDatabase | null = null;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function maxId(rows: { id: number }[]): number {
  return rows.reduce((max, row) => Math.max(max, row.id), 0);
}

function makeSeedDatabase(): LocalDatabase {
  const cameras = clone(seed.cameras);
  const favoriteIds = cameras.filter((camera) => camera.is_favorite).map((camera) => camera.id);
  cameras.forEach((camera) => {
    camera.is_favorite = false;
  });

  return {
    version: DB_VERSION,
    users: [{ ...clone(seed.user), password: 'demo1234' }],
    // Test builds open fully usable. The user can still log out and test auth.
    sessionUserId: seed.user.id,
    cameras,
    incidents: clone(seed.incidents).map((incident) => ({ ...incident, my_vote: null })),
    segments: clone(seed.segments),
    routes: clone(seed.routes),
    favorites: { [String(seed.user.id)]: favoriteIds },
    votes: { [String(seed.user.id)]: {} },
    next: {
      user: maxId([seed.user]) + 1,
      camera: maxId(cameras) + 1,
      incident: maxId(seed.incidents) + 1,
      segment: maxId(seed.segments) + 1,
      route: maxId(seed.routes) + 1,
    },
  };
}

function loadDb(): LocalDatabase {
  if (memoryDb) return memoryDb;
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LocalDatabase;
      if (parsed.version === DB_VERSION && Array.isArray(parsed.cameras) && Array.isArray(parsed.incidents)) {
        memoryDb = parsed;
        return parsed;
      }
    }
  } catch {
    // Corrupt or unavailable storage: recreate the bundled demo database.
  }
  memoryDb = makeSeedDatabase();
  saveDb(memoryDb);
  return memoryDb;
}

function saveDb(db: LocalDatabase): void {
  memoryDb = db;
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(db));
  } catch {
    // The app remains functional in memory if WebView storage is unavailable.
  }
}

export function resetStandaloneData(): void {
  memoryDb = makeSeedDatabase();
  saveDb(memoryDb);
}

function publicUser(user: LocalUser | undefined): User | null {
  if (!user) return null;
  const { password: _password, ...safe } = user;
  return clone(safe);
}

function currentLocalUser(db: LocalDatabase): LocalUser | undefined {
  return db.users.find((user) => user.id === db.sessionUserId);
}

function requireUser(db: LocalDatabase): LocalUser {
  const user = currentLocalUser(db);
  if (!user) throw new Error('Za to dejanje se morate prijaviti.');
  return user;
}

function bodyOf(options: RequestInit): Record<string, unknown> {
  if (!options.body) return {};
  if (typeof options.body === 'string') {
    try {
      return JSON.parse(options.body) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return {};
}

function computeStats(db: LocalDatabase): Stats {
  const active = db.incidents.filter((incident) => incident.status === 'active');
  const avg = (field: 'avg_speed_kmh' | 'density_pct') =>
    db.segments.length
      ? Math.round(db.segments.reduce((sum, segment) => sum + segment[field], 0) / db.segments.length)
      : 0;
  return {
    cameras_total: db.cameras.length,
    cameras_online: db.cameras.filter((camera) => camera.status === 'online').length,
    incidents_active: active.length,
    police_active: active.filter((incident) => incident.type === 'police').length,
    accidents_active: active.filter((incident) => incident.type === 'accident').length,
    jams_active: active.filter((incident) => incident.type === 'jam').length,
    avg_speed_kmh: avg('avg_speed_kmh'),
    avg_density_pct: avg('density_pct'),
    user: publicUser(currentLocalUser(db)),
  };
}

function emit(type: string, payload: Record<string, unknown>): void {
  window.dispatchEvent(new CustomEvent(LOCAL_DATA_EVENT, { detail: { type, ...payload } }));
}

function emitStats(db: LocalDatabase): void {
  emit('stats', { stats: computeStats(db) });
}

function cameraForUser(db: LocalDatabase, camera: Camera): Camera {
  const favoriteIds = db.sessionUserId == null ? [] : db.favorites[String(db.sessionUserId)] || [];
  return { ...clone(camera), is_favorite: favoriteIds.includes(camera.id) };
}

function incidentForUser(db: LocalDatabase, incident: Incident): Incident {
  const vote = db.sessionUserId == null
    ? null
    : db.votes[String(db.sessionUserId)]?.[String(incident.id)] || null;
  return { ...clone(incident), my_vote: vote };
}

function routeMatch(path: string, pattern: RegExp): RegExpMatchArray | null {
  return path.match(pattern);
}

export async function standaloneRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  // Keep async behavior consistent with fetch and allow React loading states to render.
  await Promise.resolve();
  const db = loadDb();
  const method = (options.method || 'GET').toUpperCase();
  const body = bodyOf(options);
  const now = new Date().toISOString();
  let match: RegExpMatchArray | null;

  // ---------- authentication ----------
  if (path === '/api/auth/me' && method === 'GET') {
    return { user: publicUser(currentLocalUser(db)) } as T;
  }

  if (path === '/api/auth/demo' && method === 'POST') {
    db.sessionUserId = seed.user.id;
    saveDb(db);
    return { user: publicUser(currentLocalUser(db)) } as T;
  }

  if (path === '/api/auth/login' && method === 'POST') {
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const user = db.users.find((candidate) => candidate.email.toLowerCase() === email && candidate.password === password);
    if (!user) throw new Error('Napačen e-poštni naslov ali geslo.');
    db.sessionUserId = user.id;
    saveDb(db);
    return { user: publicUser(user) } as T;
  }

  if (path === '/api/auth/register' && method === 'POST') {
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (name.length < 2) throw new Error('Ime mora vsebovati vsaj 2 znaka.');
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Vnesite veljaven e-poštni naslov.');
    if (password.length < 6) throw new Error('Geslo mora vsebovati vsaj 6 znakov.');
    if (db.users.some((candidate) => candidate.email.toLowerCase() === email)) {
      throw new Error('Uporabnik s tem e-poštnim naslovom že obstaja.');
    }
    const user: LocalUser = {
      id: db.next.user++,
      name,
      email,
      password,
      role: 'driver',
      vehicle_name: 'Moje vozilo',
      vehicle_plate: '',
      speed_tolerance_kmh: 5,
      home_region: 'Osrednjeslovenska',
      audio_alerts: true,
      reputation: 10,
      created_at: now,
    };
    db.users.push(user);
    db.favorites[String(user.id)] = [];
    db.votes[String(user.id)] = {};
    db.sessionUserId = user.id;
    saveDb(db);
    return { user: publicUser(user) } as T;
  }

  if (path === '/api/auth/logout' && method === 'POST') {
    db.sessionUserId = null;
    saveDb(db);
    return { ok: true } as T;
  }

  if (path === '/api/auth/profile' && method === 'PATCH') {
    const user = requireUser(db);
    const allowed: (keyof User)[] = [
      'name',
      'vehicle_name',
      'vehicle_plate',
      'speed_tolerance_kmh',
      'home_region',
      'audio_alerts',
    ];
    for (const key of allowed) {
      if (body[key] !== undefined) (user as unknown as Record<string, unknown>)[key] = body[key];
    }
    saveDb(db);
    emitStats(db);
    return { user: publicUser(user) } as T;
  }

  // ---------- cameras ----------
  if (path === '/api/cameras' && method === 'GET') {
    const cameras = db.cameras
      .map((camera) => cameraForUser(db, camera))
      .sort((a, b) => a.region.localeCompare(b.region, 'sl') || a.name.localeCompare(b.name, 'sl'));
    return { cameras } as T;
  }

  if (path === '/api/cameras' && method === 'POST') {
    const user = requireUser(db);
    const camera: Camera = {
      id: db.next.camera++,
      code: `USER-${Date.now().toString(36).toUpperCase()}`,
      name: String(body.name || 'Nova kamera'),
      road_code: String(body.road_code || ''),
      road_type: String(body.road_type || 'regional'),
      region: String(body.region || ''),
      direction: String(body.direction || ''),
      lat: Number(body.lat),
      lng: Number(body.lng),
      image_url: String(body.image_url || ''),
      source_url: String(body.image_url || ''),
      operator: String(body.operator || 'Uporabnik'),
      status: 'online',
      speed_limit_kmh: Number(body.speed_limit_kmh || 90),
      current_speed_kmh: 0,
      traffic_flow: 'smooth',
      surface: 'suho',
      temp_c: 0,
      elevation_m: 0,
      is_favorite: false,
      created_by: user.id,
      updated_at: now,
    };
    db.cameras.push(camera);
    saveDb(db);
    const result = cameraForUser(db, camera);
    emit('camera:created', { camera: result });
    emitStats(db);
    return { camera: result } as T;
  }

  match = routeMatch(path, /^\/api\/cameras\/(\d+)\/favorite$/);
  if (match && (method === 'POST' || method === 'DELETE')) {
    const user = requireUser(db);
    const id = Number(match[1]);
    if (!db.cameras.some((camera) => camera.id === id)) throw new Error('Kamera ni najdena.');
    const key = String(user.id);
    const favorites = db.favorites[key] || [];
    db.favorites[key] = method === 'POST'
      ? [...new Set([...favorites, id])]
      : favorites.filter((cameraId) => cameraId !== id);
    saveDb(db);
    return { ok: true, is_favorite: method === 'POST' } as T;
  }

  match = routeMatch(path, /^\/api\/cameras\/(\d+)$/);
  if (match && method === 'PATCH') {
    const user = requireUser(db);
    const camera = db.cameras.find((candidate) => candidate.id === Number(match![1]));
    if (!camera) throw new Error('Kamera ni najdena.');
    if (camera.created_by !== user.id) throw new Error('Urejate lahko samo svoje kamere.');
    Object.assign(camera, body, { id: camera.id, created_by: camera.created_by, updated_at: now });
    saveDb(db);
    const result = cameraForUser(db, camera);
    emit('camera:updated', { camera: result });
    return { camera: result } as T;
  }

  if (match && method === 'DELETE') {
    const user = requireUser(db);
    const id = Number(match[1]);
    const index = db.cameras.findIndex((camera) => camera.id === id);
    if (index < 0) throw new Error('Kamera ni najdena.');
    if (db.cameras[index].created_by !== user.id) throw new Error('Izbrišete lahko samo svoje kamere.');
    db.cameras.splice(index, 1);
    Object.keys(db.favorites).forEach((key) => {
      db.favorites[key] = db.favorites[key].filter((cameraId) => cameraId !== id);
    });
    saveDb(db);
    emit('camera:deleted', { id });
    emitStats(db);
    return { ok: true } as T;
  }

  // ---------- incidents ----------
  if (path === '/api/incidents' && method === 'GET') {
    const incidents = db.incidents
      .map((incident) => incidentForUser(db, incident))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    return { incidents } as T;
  }

  if (path === '/api/incidents' && method === 'POST') {
    const user = requireUser(db);
    const incident: Incident = {
      id: db.next.incident++,
      type: String(body.type || 'hazard') as IncidentType,
      severity: String(body.severity || 'medium') as Severity,
      status: 'active',
      title: String(body.title || 'Nov dogodek'),
      description: String(body.description || ''),
      road_code: String(body.road_code || ''),
      region: String(body.region || ''),
      location_name: String(body.location_name || ''),
      direction: String(body.direction || ''),
      lat: Number(body.lat),
      lng: Number(body.lng),
      delay_min: Number(body.delay_min || 0),
      queue_km: Number(body.queue_km || 0),
      speed_limit_kmh: body.speed_limit_kmh == null ? null : Number(body.speed_limit_kmh),
      measured_speed_kmh: body.measured_speed_kmh == null ? null : Number(body.measured_speed_kmh),
      confirmations: 1,
      dismissals: 0,
      reporter_id: user.id,
      reporter_name: user.name,
      my_vote: null,
      created_at: now,
      updated_at: now,
    };
    db.incidents.unshift(incident);
    db.votes[String(user.id)] ||= {};
    db.votes[String(user.id)][String(incident.id)] = 'confirm';
    saveDb(db);
    const result = incidentForUser(db, incident);
    emit('incident:created', { incident: result });
    emitStats(db);
    return { incident: result } as T;
  }

  match = routeMatch(path, /^\/api\/incidents\/(\d+)\/vote$/);
  if (match && method === 'POST') {
    const user = requireUser(db);
    const incident = db.incidents.find((candidate) => candidate.id === Number(match![1]));
    if (!incident) throw new Error('Poročilo ni najdeno.');
    const vote = String(body.vote) as 'confirm' | 'dismiss';
    if (vote !== 'confirm' && vote !== 'dismiss') throw new Error('Neveljaven glas.');
    const userVotes = (db.votes[String(user.id)] ||= {});
    const previousVote = userVotes[String(incident.id)] || null;
    if (previousVote === vote) {
      if (vote === 'confirm') incident.confirmations = Math.max(0, incident.confirmations - 1);
      else incident.dismissals = Math.max(0, incident.dismissals - 1);
      delete userVotes[String(incident.id)];
    } else {
      if (previousVote === 'confirm') incident.confirmations = Math.max(0, incident.confirmations - 1);
      if (previousVote === 'dismiss') incident.dismissals = Math.max(0, incident.dismissals - 1);
      if (vote === 'confirm') incident.confirmations += 1;
      else incident.dismissals += 1;
      userVotes[String(incident.id)] = vote;
    }
    incident.updated_at = now;
    saveDb(db);
    const result = incidentForUser(db, incident);
    emit('incident:updated', { incident: result });
    return { incident: result } as T;
  }

  match = routeMatch(path, /^\/api\/incidents\/(\d+)$/);
  if (match && method === 'PATCH') {
    const user = requireUser(db);
    const incident = db.incidents.find((candidate) => candidate.id === Number(match![1]));
    if (!incident) throw new Error('Poročilo ni najdeno.');
    if (incident.reporter_id !== user.id) throw new Error('Urejate lahko samo svoja poročila.');
    Object.assign(incident, body, {
      id: incident.id,
      reporter_id: incident.reporter_id,
      reporter_name: incident.reporter_name,
      updated_at: now,
    });
    saveDb(db);
    const result = incidentForUser(db, incident);
    emit('incident:updated', { incident: result });
    emitStats(db);
    return { incident: result } as T;
  }

  if (match && method === 'DELETE') {
    const user = requireUser(db);
    const id = Number(match[1]);
    const index = db.incidents.findIndex((incident) => incident.id === id);
    if (index < 0) throw new Error('Poročilo ni najdeno.');
    if (db.incidents[index].reporter_id !== user.id) throw new Error('Izbrišete lahko samo svoja poročila.');
    db.incidents.splice(index, 1);
    Object.values(db.votes).forEach((userVotes) => delete userVotes[String(id)]);
    saveDb(db);
    emit('incident:deleted', { id });
    emitStats(db);
    return { ok: true } as T;
  }

  // ---------- road segments ----------
  if (path === '/api/segments' && method === 'GET') {
    return { segments: clone(db.segments).sort((a, b) => a.corridor.localeCompare(b.corridor) || a.name.localeCompare(b.name, 'sl')) } as T;
  }

  if (path === '/api/segments' && method === 'POST') {
    const user = requireUser(db);
    const segment = {
      ...(body as unknown as Omit<RoadSegment, 'id' | 'updated_by' | 'updated_at'>),
      id: db.next.segment++,
      updated_by: user.id,
      updated_at: now,
    } as RoadSegment;
    db.segments.push(segment);
    saveDb(db);
    emit('segment:updated', { segment: clone(segment) });
    emitStats(db);
    return { segment: clone(segment) } as T;
  }

  match = routeMatch(path, /^\/api\/segments\/(\d+)$/);
  if (match && method === 'PATCH') {
    const user = requireUser(db);
    const segment = db.segments.find((candidate) => candidate.id === Number(match![1]));
    if (!segment) throw new Error('Odsek ni najden.');
    Object.assign(segment, body, { id: segment.id, updated_by: user.id, updated_at: now });
    saveDb(db);
    emit('segment:updated', { segment: clone(segment) });
    emitStats(db);
    return { segment: clone(segment) } as T;
  }

  if (match && method === 'DELETE') {
    requireUser(db);
    const id = Number(match[1]);
    const index = db.segments.findIndex((segment) => segment.id === id);
    if (index < 0) throw new Error('Odsek ni najden.');
    db.segments.splice(index, 1);
    saveDb(db);
    emit('segment:deleted', { id });
    emitStats(db);
    return { ok: true } as T;
  }

  // ---------- saved routes ----------
  if (path === '/api/routes' && method === 'GET') {
    const user = requireUser(db);
    const routes = db.routes
      .filter((route) => route.user_id === user.id)
      .sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned) || b.updated_at.localeCompare(a.updated_at));
    return { routes: clone(routes) } as T;
  }

  if (path === '/api/routes' && method === 'POST') {
    const user = requireUser(db);
    const route = {
      ...(body as unknown as Omit<SavedRoute, 'id' | 'user_id' | 'created_at' | 'updated_at'>),
      id: db.next.route++,
      user_id: user.id,
      created_at: now,
      updated_at: now,
    } as SavedRoute;
    db.routes.push(route);
    saveDb(db);
    return { route: clone(route) } as T;
  }

  match = routeMatch(path, /^\/api\/routes\/(\d+)$/);
  if (match && method === 'PATCH') {
    const user = requireUser(db);
    const route = db.routes.find((candidate) => candidate.id === Number(match![1]) && candidate.user_id === user.id);
    if (!route) throw new Error('Pot ni najdena.');
    Object.assign(route, body, { id: route.id, user_id: route.user_id, updated_at: now });
    saveDb(db);
    return { route: clone(route) } as T;
  }

  if (match && method === 'DELETE') {
    const user = requireUser(db);
    const id = Number(match[1]);
    const index = db.routes.findIndex((route) => route.id === id && route.user_id === user.id);
    if (index < 0) throw new Error('Pot ni najdena.');
    db.routes.splice(index, 1);
    saveDb(db);
    return { ok: true } as T;
  }

  if (path === '/api/stats' && method === 'GET') {
    return computeStats(db) as T;
  }

  throw new Error(`Funkcija ni na voljo v samostojnem načinu: ${method} ${path}`);
}
