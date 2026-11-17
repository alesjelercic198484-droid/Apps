import assert from 'node:assert/strict';

const store = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  get length() { return store.size; },
  clear: () => store.clear(),
  getItem: (key: string) => store.get(key) ?? null,
  key: (index: number) => [...store.keys()][index] ?? null,
  removeItem: (key: string) => { store.delete(key); },
  setItem: (key: string, value: string) => { store.set(key, value); },
};
(globalThis as unknown as { window: { dispatchEvent: () => boolean } }).window = { dispatchEvent: () => true };
(globalThis as unknown as { CustomEvent: typeof CustomEvent }).CustomEvent = class MockCustomEvent {
  detail: unknown;
  constructor(_name: string, init: { detail: unknown }) { this.detail = init.detail; }
} as unknown as typeof CustomEvent;

async function run() {
  const { standaloneRequest: request } = await import('../src/lib/standaloneApi.ts');

  const me = await request<{ user: { email: string } | null }>('/api/auth/me');
  assert.equal(me.user?.email, 'demo@slopromet.si');

  const { cameras } = await request<{ cameras: { id: number }[] }>('/api/cameras');
  const { incidents } = await request<{ incidents: { id: number }[] }>('/api/incidents');
  const { segments } = await request<{ segments: { id: number }[] }>('/api/segments');
  const { routes } = await request<{ routes: { id: number }[] }>('/api/routes');
  assert.deepEqual([cameras.length, incidents.length, segments.length, routes.length], [53, 12, 12, 3]);

  const createdCamera = await request<{ camera: { id: number; name: string } }>('/api/cameras', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Test kamera', road_code: 'A1', road_type: 'motorway', region: 'Test', direction: 'Ljubljana',
      lat: 46.05, lng: 14.5, image_url: 'https://example.com/camera.jpg', operator: 'Test', speed_limit_kmh: 130,
    }),
  });
  await request(`/api/cameras/${createdCamera.camera.id}`, { method: 'PATCH', body: JSON.stringify({ name: 'Posodobljena kamera' }) });
  await request(`/api/cameras/${createdCamera.camera.id}/favorite`, { method: 'POST', body: '{}' });
  await request(`/api/cameras/${createdCamera.camera.id}`, { method: 'DELETE' });

  const createdIncident = await request<{ incident: { id: number } }>('/api/incidents', {
    method: 'POST',
    body: JSON.stringify({
      type: 'police', severity: 'medium', title: 'Test kontrola', description: 'Test', road_code: 'A1',
      region: 'Ljubljana', location_name: 'Test', direction: 'LJ', lat: 46.05, lng: 14.5,
      delay_min: 0, queue_km: 0, speed_limit_kmh: 130, measured_speed_kmh: 140,
    }),
  });
  await request(`/api/incidents/${createdIncident.incident.id}/vote`, { method: 'POST', body: JSON.stringify({ vote: 'dismiss' }) });
  await request(`/api/incidents/${createdIncident.incident.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'resolved' }) });
  await request(`/api/incidents/${createdIncident.incident.id}`, { method: 'DELETE' });

  const createdSegment = await request<{ segment: { id: number } }>('/api/segments', {
    method: 'POST',
    body: JSON.stringify({
      code: 'TEST', name: 'Testni odsek', corridor: 'A1', region: 'Test', road_type: 'motorway', length_km: 10,
      speed_limit_kmh: 130, avg_speed_kmh: 100, density_pct: 40, flow_status: 'smooth', surface: 'suho',
      temp_c: 10, wind_kmh: 5, delay_min: 0, note: '', polyline_key: 'test',
    }),
  });
  await request(`/api/segments/${createdSegment.segment.id}`, { method: 'PATCH', body: JSON.stringify({ density_pct: 50 }) });
  await request(`/api/segments/${createdSegment.segment.id}`, { method: 'DELETE' });

  const createdRoute = await request<{ route: { id: number } }>('/api/routes', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Test pot', origin_name: 'Ljubljana', origin_lat: 46.05, origin_lng: 14.5,
      dest_name: 'Kranj', dest_lat: 46.24, dest_lng: 14.36, via_roads: 'A2', distance_km: 30,
      base_duration_min: 25, preset_key: 'custom', notify_police: true, notify_accidents: true,
      notify_jams: true, is_pinned: false,
    }),
  });
  await request(`/api/routes/${createdRoute.route.id}`, { method: 'PATCH', body: JSON.stringify({ is_pinned: true }) });
  await request(`/api/routes/${createdRoute.route.id}`, { method: 'DELETE' });

  await request('/api/auth/profile', { method: 'PATCH', body: JSON.stringify({ vehicle_plate: 'TEST-1' }) });
  await request('/api/auth/logout', { method: 'POST', body: '{}' });
  await assert.rejects(() => request('/api/routes'), /prijaviti/);
  const login = await request<{ user: { vehicle_plate: string } }>('/api/auth/login', {
    method: 'POST', body: JSON.stringify({ email: 'demo@slopromet.si', password: 'demo1234' }),
  });
  assert.equal(login.user.vehicle_plate, 'TEST-1');

  const stats = await request<{ cameras_total: number; incidents_active: number }>('/api/stats');
  assert.equal(stats.cameras_total, 53);
  assert.equal(stats.incidents_active, 12);
  assert.ok((store.get('slopromet_standalone_db_v3')?.length || 0) > 30_000);

  console.log('Standalone API test: OK (auth + cameras + incidents + segments + routes + persistence)');
}

void run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
