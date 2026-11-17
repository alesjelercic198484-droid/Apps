import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './db.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SECRET_FILE = path.resolve(__dirname, '..', 'data', '.jwt_secret');

function loadOrCreateSecret(): string {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  try {
    if (fs.existsSync(SECRET_FILE)) {
      const existing = fs.readFileSync(SECRET_FILE, 'utf-8').trim();
      if (existing.length >= 32) return existing;
    }
    const generated = crypto.randomBytes(48).toString('hex');
    fs.writeFileSync(SECRET_FILE, generated, { mode: 0o600 });
    return generated;
  } catch {
    return 'slopromet-gps-fallback-secret-key-2026-ljubljana';
  }
}

const JWT_SECRET = loadOrCreateSecret();
export const COOKIE_NAME = 'slopromet_session';

export interface AuthUser {
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

export interface AuthedRequest extends Request {
  user?: AuthUser;
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

export function formatUser(row: Record<string, unknown>): AuthUser {
  return {
    id: Number(row.id),
    name: String(row.name),
    email: String(row.email),
    role: String(row.role),
    vehicle_name: String(row.vehicle_name),
    vehicle_plate: String(row.vehicle_plate),
    speed_tolerance_kmh: Number(row.speed_tolerance_kmh),
    home_region: String(row.home_region),
    audio_alerts: Boolean(row.audio_alerts),
    reputation: Number(row.reputation),
    created_at: String(row.created_at),
  };
}

export function getUserById(id: number): AuthUser | undefined {
  const row = db
    .prepare(
      `SELECT id, name, email, role, vehicle_name, vehicle_plate, speed_tolerance_kmh, home_region, audio_alerts, reputation, created_at
       FROM users WHERE id = ?`
    )
    .get(id) as Record<string, unknown> | undefined;
  return row ? formatUser(row) : undefined;
}

export function setAuthCookie(req: Request, res: Response, userId: number): string {
  const token = jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: '14d' });
  const isSecure =
    req.secure ||
    req.headers['x-forwarded-proto'] === 'https';

  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: isSecure ? 'none' : 'lax',
    maxAge: 14 * 24 * 60 * 60 * 1000,
    path: '/',
  });
  return token;
}

export function clearAuthCookie(req: Request, res: Response): void {
  const isSecure =
    req.secure ||
    req.headers['x-forwarded-proto'] === 'https';
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: isSecure,
    sameSite: isSecure ? 'none' : 'lax',
    path: '/',
  });
}

export function attachUser(req: AuthedRequest, _res: Response, next: NextFunction): void {
  const cookieToken = req.cookies?.[COOKIE_NAME];
  const headerAuth = req.headers.authorization;
  const bearerToken = headerAuth?.startsWith('Bearer ') ? headerAuth.slice(7) : undefined;
  const token = cookieToken || bearerToken;

  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET) as { sub?: number | string };
      const userId = Number(payload.sub);
      if (Number.isInteger(userId) && userId > 0) {
        req.user = getUserById(userId);
      }
    } catch {
      // Invalid or expired token; treat as anonymous
    }
  }
  next();
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Za to dejanje se morate prijaviti.' });
    return;
  }
  next();
}
