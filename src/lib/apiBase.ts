// Configurable API base URL — needed for the Android (Capacitor) build where
// the frontend is bundled locally and the backend runs on a remote server.
// Priority: localStorage override (Settings) > build-time VITE_API_BASE > relative.
const STORAGE_KEY = 'slopromet_api_base';

export function getApiBase(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return stored.replace(/\/$/, '');
  } catch {
    /* ignore */
  }
  const envBase = import.meta.env.VITE_API_BASE as string | undefined;
  if (envBase) return envBase.replace(/\/$/, '');
  return '';
}

export function setApiBase(value: string): void {
  try {
    const cleaned = value.trim().replace(/\/$/, '');
    if (cleaned) localStorage.setItem(STORAGE_KEY, cleaned);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function apiUrl(path: string): string {
  return `${getApiBase()}${path}`;
}
