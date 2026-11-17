import type { Camera, Incident, RoadSegment, SavedRoute, Stats, User } from './types';
import { apiUrl } from './apiBase';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(apiUrl(path), {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const message =
      (data as { error?: string } | null)?.error ||
      `Napaka ${res.status}: ${res.statusText}`;
    throw new Error(message);
  }
  return data as T;
}

export const api = {
  me: () => request<{ user: User | null }>('/api/auth/me'),
  register: (name: string, email: string, password: string) =>
    request<{ user: User }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    }),
  login: (email: string, password: string) =>
    request<{ user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  demo: () => request<{ user: User }>('/api/auth/demo', { method: 'POST', body: '{}' }),
  logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST', body: '{}' }),
  updateProfile: (patch: Partial<User>) =>
    request<{ user: User }>('/api/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  cameras: () => request<{ cameras: Camera[] }>('/api/cameras'),
  createCamera: (payload: Record<string, unknown>) =>
    request<{ camera: Camera }>('/api/cameras', { method: 'POST', body: JSON.stringify(payload) }),
  updateCamera: (id: number, payload: Record<string, unknown>) =>
    request<{ camera: Camera }>(`/api/cameras/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteCamera: (id: number) =>
    request<{ ok: boolean }>(`/api/cameras/${id}`, { method: 'DELETE' }),
  favoriteCamera: (id: number) =>
    request<{ ok: boolean; is_favorite: boolean }>(`/api/cameras/${id}/favorite`, { method: 'POST', body: '{}' }),
  unfavoriteCamera: (id: number) =>
    request<{ ok: boolean; is_favorite: boolean }>(`/api/cameras/${id}/favorite`, { method: 'DELETE' }),

  incidents: () => request<{ incidents: Incident[] }>('/api/incidents'),
  createIncident: (payload: Record<string, unknown>) =>
    request<{ incident: Incident }>('/api/incidents', { method: 'POST', body: JSON.stringify(payload) }),
  updateIncident: (id: number, payload: Record<string, unknown>) =>
    request<{ incident: Incident }>(`/api/incidents/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteIncident: (id: number) =>
    request<{ ok: boolean }>(`/api/incidents/${id}`, { method: 'DELETE' }),
  voteIncident: (id: number, vote: 'confirm' | 'dismiss') =>
    request<{ incident: Incident }>(`/api/incidents/${id}/vote`, {
      method: 'POST',
      body: JSON.stringify({ vote }),
    }),

  segments: () => request<{ segments: RoadSegment[] }>('/api/segments'),
  createSegment: (payload: Record<string, unknown>) =>
    request<{ segment: RoadSegment }>('/api/segments', { method: 'POST', body: JSON.stringify(payload) }),
  updateSegment: (id: number, payload: Record<string, unknown>) =>
    request<{ segment: RoadSegment }>(`/api/segments/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteSegment: (id: number) =>
    request<{ ok: boolean }>(`/api/segments/${id}`, { method: 'DELETE' }),

  routes: () => request<{ routes: SavedRoute[] }>('/api/routes'),
  createRoute: (payload: Record<string, unknown>) =>
    request<{ route: SavedRoute }>('/api/routes', { method: 'POST', body: JSON.stringify(payload) }),
  updateRoute: (id: number, payload: Record<string, unknown>) =>
    request<{ route: SavedRoute }>(`/api/routes/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteRoute: (id: number) =>
    request<{ ok: boolean }>(`/api/routes/${id}`, { method: 'DELETE' }),

  stats: () => request<Stats>('/api/stats'),
};
