import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'slopromet.db');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export const db = new DatabaseSync(DB_PATH);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  PRAGMA synchronous = NORMAL;

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'driver',
    vehicle_name TEXT NOT NULL DEFAULT 'Škoda Octavia RS',
    vehicle_plate TEXT NOT NULL DEFAULT 'LJ SP-2026',
    speed_tolerance_kmh INTEGER NOT NULL DEFAULT 5,
    home_region TEXT NOT NULL DEFAULT 'Osrednjeslovenska',
    audio_alerts INTEGER NOT NULL DEFAULT 1,
    reputation INTEGER NOT NULL DEFAULT 120,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS cameras (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    road_code TEXT NOT NULL,
    road_type TEXT NOT NULL DEFAULT 'motorway',
    region TEXT NOT NULL,
    direction TEXT NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    image_url TEXT NOT NULL,
    source_url TEXT NOT NULL DEFAULT 'https://www.promet.si/sl/kamere',
    operator TEXT NOT NULL DEFAULT 'DARS / DRSI',
    status TEXT NOT NULL DEFAULT 'online',
    speed_limit_kmh INTEGER NOT NULL DEFAULT 130,
    current_speed_kmh INTEGER NOT NULL DEFAULT 118,
    traffic_flow TEXT NOT NULL DEFAULT 'smooth',
    surface TEXT NOT NULL DEFAULT 'suho',
    temp_c REAL NOT NULL DEFAULT 8.0,
    elevation_m INTEGER NOT NULL DEFAULT 300,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS camera_favorites (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    camera_id INTEGER NOT NULL REFERENCES cameras(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, camera_id)
  );

  CREATE TABLE IF NOT EXISTS incidents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'medium',
    status TEXT NOT NULL DEFAULT 'active',
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    road_code TEXT NOT NULL,
    region TEXT NOT NULL,
    location_name TEXT NOT NULL,
    direction TEXT NOT NULL DEFAULT '',
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    delay_min INTEGER NOT NULL DEFAULT 0,
    queue_km REAL NOT NULL DEFAULT 0,
    speed_limit_kmh INTEGER,
    measured_speed_kmh INTEGER,
    confirmations INTEGER NOT NULL DEFAULT 1,
    dismissals INTEGER NOT NULL DEFAULT 0,
    reporter_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    reporter_name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS incident_votes (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    incident_id INTEGER NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    vote TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (user_id, incident_id)
  );

  CREATE TABLE IF NOT EXISTS road_segments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    corridor TEXT NOT NULL,
    region TEXT NOT NULL,
    road_type TEXT NOT NULL DEFAULT 'motorway',
    length_km REAL NOT NULL,
    speed_limit_kmh INTEGER NOT NULL,
    avg_speed_kmh INTEGER NOT NULL,
    density_pct INTEGER NOT NULL,
    flow_status TEXT NOT NULL DEFAULT 'smooth',
    surface TEXT NOT NULL DEFAULT 'suho',
    temp_c REAL NOT NULL DEFAULT 8.0,
    wind_kmh INTEGER NOT NULL DEFAULT 10,
    delay_min INTEGER NOT NULL DEFAULT 0,
    note TEXT NOT NULL DEFAULT '',
    polyline_key TEXT NOT NULL DEFAULT '',
    updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS saved_routes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    origin_name TEXT NOT NULL,
    origin_lat REAL NOT NULL,
    origin_lng REAL NOT NULL,
    dest_name TEXT NOT NULL,
    dest_lat REAL NOT NULL,
    dest_lng REAL NOT NULL,
    via_roads TEXT NOT NULL,
    distance_km REAL NOT NULL,
    base_duration_min INTEGER NOT NULL,
    preset_key TEXT NOT NULL DEFAULT 'custom',
    notify_police INTEGER NOT NULL DEFAULT 1,
    notify_accidents INTEGER NOT NULL DEFAULT 1,
    notify_jams INTEGER NOT NULL DEFAULT 1,
    is_pinned INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_cameras_region ON cameras(region);
  CREATE INDEX IF NOT EXISTS idx_cameras_road ON cameras(road_code);
  CREATE INDEX IF NOT EXISTS idx_incidents_type ON incidents(type);
  CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
  CREATE INDEX IF NOT EXISTS idx_incidents_created ON incidents(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_routes_user ON saved_routes(user_id);
`);

export function inTransaction<T>(fn: () => T): T {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
