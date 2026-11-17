import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Car,
  CheckCircle2,
  CircleAlert,
  Flag,
  Gauge,
  Info,
  LayoutDashboard,
  LogIn,
  LogOut,
  Map as MapIcon,
  Menu,
  Plus,
  Route as RouteIcon,
  Search,
  Settings,
  Siren,
  Video,
  X,
} from 'lucide-react';
import type { Camera, Incident, RoadSegment, SavedRoute, Stats, Toast, User, ViewKey } from './lib/types';
import { api } from './lib/api';
import { IS_STANDALONE } from './lib/runtime';
import { useGps, useLiveStream } from './hooks/useLive';
import { CameraCard, CameraDetailModal, CameraFormModal, CamerasEmpty } from './components/CameraViews';
import { IncidentCard, IncidentFormModal, IncidentsEmpty } from './components/IncidentViews';
import { MapView } from './components/MapView';
import { AuthModal, DashboardPage, IncidentTypeFilter, RoutesPage, SegmentsPage, SettingsPage } from './components/Pages';
import { EmptyState, GhostButton, PrimaryButton, SkeletonCard } from './components/ui';

const NAV: { key: ViewKey; label: string; icon: React.ReactNode }[] = [
  { key: 'dashboard', label: 'Nadzorna plošča', icon: <LayoutDashboard className="h-5 w-5" /> },
  { key: 'cameras', label: 'Kamere v živo', icon: <Video className="h-5 w-5" /> },
  { key: 'map', label: 'Zemljevid', icon: <MapIcon className="h-5 w-5" /> },
  { key: 'incidents', label: 'Poročila', icon: <Siren className="h-5 w-5" /> },
  { key: 'segments', label: 'Razmere', icon: <Gauge className="h-5 w-5" /> },
  { key: 'routes', label: 'Moje poti', icon: <RouteIcon className="h-5 w-5" /> },
  { key: 'settings', label: 'Nastavitve', icon: <Settings className="h-5 w-5" /> },
];

export default function App() {
  const [view, setView] = useState<ViewKey>('dashboard');
  const [user, setUser] = useState<User | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [cameras, setCameras] = useState<Camera[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [segments, setSegments] = useState<RoadSegment[]>([]);
  const [routes, setRoutes] = useState<SavedRoute[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [cameraQuery, setCameraQuery] = useState('');
  const [cameraRegion, setCameraRegion] = useState('all');
  const [cameraRoad, setCameraRoad] = useState('all');
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null);
  const [cameraFormOpen, setCameraFormOpen] = useState(false);
  const [editingCamera, setEditingCamera] = useState<Camera | null>(null);
  const [savingCamera, setSavingCamera] = useState(false);

  const [incidentType, setIncidentType] = useState('all');
  const [incidentQuery, setIncidentQuery] = useState('');
  const [showResolved, setShowResolved] = useState(false);
  const [incidentFormOpen, setIncidentFormOpen] = useState(false);
  const [editingIncident, setEditingIncident] = useState<Incident | null>(null);
  const [savingIncident, setSavingIncident] = useState(false);
  const [focusedIncident, setFocusedIncident] = useState<Incident | null>(null);

  const [toasts, setToasts] = useState<Toast[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const toastId = useRef(0);

  const { gps, start: startGps, stop: stopGps, startSimulated } = useGps();
  const { connected } = useLiveStream({
    onCamera: (camera) => {
      setCameras((prev) => {
        const idx = prev.findIndex((c) => c.id === camera.id);
        if (idx === -1) return [...prev, camera];
        const next = [...prev];
        next[idx] = { ...next[idx], ...camera, is_favorite: next[idx].is_favorite };
        return next;
      });
    },
    onCameraDeleted: (id) => setCameras((prev) => prev.filter((c) => c.id !== id)),
    onIncident: (incident) => {
      setIncidents((prev) => {
        const idx = prev.findIndex((i) => i.id === incident.id);
        if (idx === -1) return [incident, ...prev];
        const next = [...prev];
        next[idx] = incident;
        return next;
      });
    },
    onIncidentDeleted: (id) => setIncidents((prev) => prev.filter((i) => i.id !== id)),
    onSegment: (segment) => {
      setSegments((prev) => {
        const idx = prev.findIndex((s) => s.id === segment.id);
        if (idx === -1) return [...prev, segment];
        const next = [...prev];
        next[idx] = segment;
        return next;
      });
    },
    onSegmentDeleted: (id) => setSegments((prev) => prev.filter((s) => s.id !== id)),
    onStats: (s) => setStats(s),
  });

  const pushToast = useCallback((kind: Toast['kind'], title: string, message?: string) => {
    const id = ++toastId.current;
    setToasts((prev) => [...prev.slice(-3), { id, kind, title, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const loadAll = useCallback(async () => {
    try {
      const [camRes, incRes, segRes, statsRes] = await Promise.all([
        api.cameras(),
        api.incidents(),
        api.segments(),
        api.stats(),
      ]);
      setCameras(camRes.cameras);
      setIncidents(incRes.incidents);
      setSegments(segRes.segments);
      setStats(statsRes);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Nalaganje podatkov ni uspelo.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRoutes = useCallback(async () => {
    try {
      const res = await api.routes();
      setRoutes(res.routes);
    } catch {
      setRoutes([]);
    }
  }, []);

  useEffect(() => {
    void loadAll();
    void api.me().then((res) => {
      setUser(res.user);
      if (res.user) void loadRoutes();
    }).catch(() => setUser(null));
  }, [loadAll, loadRoutes]);

  // Refresh camera snapshots every 60s (upstream updates every minute)
  useEffect(() => {
    const timer = window.setInterval(() => setRefreshKey((k) => k + 1), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const requireAuth = useCallback(() => {
    if (!user) {
      setAuthOpen(true);
      return true;
    }
    return false;
  }, [user]);

  const handleAuthSuccess = useCallback(
    (u: User) => {
      setUser(u);
      void loadRoutes();
      void loadAll();
      pushToast('success', 'Prijava uspešna', `Dobrodošli, ${u.name}!`);
    },
    [loadAll, loadRoutes, pushToast]
  );

  const handleLogout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      /* ignore */
    }
    setUser(null);
    setRoutes([]);
    void loadAll();
    pushToast('info', 'Odjava uspešna');
  }, [loadAll, pushToast]);

  const handleToggleFavorite = useCallback(
    async (camera: Camera) => {
      if (requireAuth()) return;
      const prev = camera.is_favorite;
      setCameras((list) => list.map((c) => (c.id === camera.id ? { ...c, is_favorite: !prev } : c)));
      setSelectedCamera((sel) => (sel && sel.id === camera.id ? { ...sel, is_favorite: !prev } : sel));
      try {
        if (prev) await api.unfavoriteCamera(camera.id);
        else await api.favoriteCamera(camera.id);
        pushToast('success', prev ? 'Odstranjeno iz priljubljenih' : 'Dodano med priljubljene', camera.name);
      } catch (err) {
        setCameras((list) => list.map((c) => (c.id === camera.id ? { ...c, is_favorite: prev } : c)));
        pushToast('error', 'Posodobitev ni uspela', err instanceof Error ? err.message : undefined);
      }
    },
    [requireAuth, pushToast]
  );

  const handleVote = useCallback(
    async (incident: Incident, vote: 'confirm' | 'dismiss') => {
      if (requireAuth()) return;
      try {
        const { incident: updated } = await api.voteIncident(incident.id, vote);
        setIncidents((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
        pushToast('success', vote === 'confirm' ? 'Poročilo potrjeno' : 'Glas zabeležen');
      } catch (err) {
        pushToast('error', 'Glasovanje ni uspelo', err instanceof Error ? err.message : undefined);
      }
    },
    [requireAuth, pushToast]
  );

  const handleSubmitIncident = useCallback(
    async (payload: Record<string, unknown>) => {
      setSavingIncident(true);
      try {
        if (editingIncident) {
          const { incident } = await api.updateIncident(editingIncident.id, payload);
          setIncidents((prev) => prev.map((i) => (i.id === incident.id ? incident : i)));
          pushToast('success', 'Poročilo posodobljeno');
        } else {
          const { incident } = await api.createIncident(payload);
          setIncidents((prev) => [incident, ...prev.filter((item) => item.id !== incident.id)]);
          pushToast('success', 'Poročilo objavljeno', 'Hvala! Poročilo je vidno vsem voznikom.');
        }
        setIncidentFormOpen(false);
        setEditingIncident(null);
      } catch (err) {
        pushToast('error', 'Objava ni uspela', err instanceof Error ? err.message : undefined);
      } finally {
        setSavingIncident(false);
      }
    },
    [editingIncident, pushToast]
  );

  const handleDeleteIncident = useCallback(
    async (incident: Incident) => {
      if (!window.confirm(`Resnično želite izbrisati poročilo »${incident.title}«?`)) return;
      try {
        await api.deleteIncident(incident.id);
        setIncidents((prev) => prev.filter((i) => i.id !== incident.id));
        pushToast('success', 'Poročilo izbrisano');
      } catch (err) {
        pushToast('error', 'Brisanje ni uspelo', err instanceof Error ? err.message : undefined);
      }
    },
    [pushToast]
  );

  const handleResolveIncident = useCallback(
    async (incident: Incident) => {
      try {
        const { incident: updated } = await api.updateIncident(incident.id, { status: 'resolved' });
        setIncidents((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
        pushToast('success', 'Označeno kot razrešeno');
      } catch (err) {
        pushToast('error', 'Posodobitev ni uspela', err instanceof Error ? err.message : undefined);
      }
    },
    [pushToast]
  );

  const handleSubmitCamera = useCallback(
    async (payload: Record<string, unknown>) => {
      setSavingCamera(true);
      try {
        if (editingCamera) {
          const { camera } = await api.updateCamera(editingCamera.id, payload);
          setCameras((prev) => prev.map((c) => (c.id === camera.id ? camera : c)));
          pushToast('success', 'Kamera posodobljena');
        } else {
          const { camera } = await api.createCamera(payload);
          setCameras((prev) => [...prev.filter((item) => item.id !== camera.id), camera]);
          pushToast('success', 'Kamera dodana', camera.name);
        }
        setCameraFormOpen(false);
        setEditingCamera(null);
      } catch (err) {
        pushToast('error', 'Shranjevanje ni uspelo', err instanceof Error ? err.message : undefined);
      } finally {
        setSavingCamera(false);
      }
    },
    [editingCamera, pushToast]
  );

  const handleDeleteCamera = useCallback(
    async (camera: Camera) => {
      if (!window.confirm(`Resnično želite izbrisati kamero »${camera.name}«?`)) return;
      try {
        await api.deleteCamera(camera.id);
        setCameras((prev) => prev.filter((c) => c.id !== camera.id));
        setSelectedCamera((sel) => (sel && sel.id === camera.id ? null : sel));
        pushToast('success', 'Kamera izbrisana');
      } catch (err) {
        pushToast('error', 'Brisanje ni uspelo', err instanceof Error ? err.message : undefined);
      }
    },
    [pushToast]
  );

  const focusIncident = useCallback((incident: Incident) => {
    setFocusedIncident(incident);
    setView('map');
    pushToast('info', incident.title, `${incident.location_name} · ${incident.road_code}`);
  }, [pushToast]);

  const focusRoute = useCallback((route: SavedRoute) => {
    setView('map');
    pushToast('info', route.name, `${route.origin_name} → ${route.dest_name} · ${route.distance_km} km`);
  }, [pushToast]);

  const regions = useMemo(() => [...new Set(cameras.map((c) => c.region))].sort(), [cameras]);
  const roads = useMemo(() => [...new Set(cameras.map((c) => c.road_code))].sort(), [cameras]);

  const filteredCameras = useMemo(() => {
    const q = cameraQuery.trim().toLowerCase();
    return cameras.filter((c) => {
      if (onlyFavorites && !c.is_favorite) return false;
      if (cameraRegion !== 'all' && c.region !== cameraRegion) return false;
      if (cameraRoad !== 'all' && c.road_code !== cameraRoad) return false;
      if (q && !`${c.name} ${c.road_code} ${c.region} ${c.direction}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [cameras, cameraQuery, cameraRegion, cameraRoad, onlyFavorites]);

  const filteredIncidents = useMemo(() => {
    const q = incidentQuery.trim().toLowerCase();
    return incidents.filter((i) => {
      if (!showResolved && i.status === 'resolved') return false;
      if (incidentType !== 'all' && i.type !== incidentType) return false;
      if (q && !`${i.title} ${i.description} ${i.road_code} ${i.region} ${i.location_name}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [incidents, incidentType, incidentQuery, showResolved]);

  const canManageCamera = useCallback(
    (camera: Camera) => user != null && camera.created_by === user.id,
    [user]
  );

  return (
    <div className="flex min-h-screen bg-[#090c10] text-slate-100">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-800 bg-[#0b0f14] transition-transform lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center gap-3 border-b border-slate-800 px-5 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-emerald-950">
            <Car className="h-6 w-6" />
          </div>
          <div>
            <p className="text-base font-extrabold leading-tight text-white">SloPromet GPS</p>
            <p className="text-[11px] font-semibold text-slate-400">Slovenske kamere · promet</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="ml-auto rounded-lg p-2 text-slate-400 hover:bg-slate-800 lg:hidden" aria-label="Zapri meni">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {NAV.map((item) => (
            <button
              key={item.key}
              onClick={() => {
                setView(item.key);
                setSidebarOpen(false);
              }}
              className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${
                view === item.key
                  ? 'bg-emerald-500/15 text-emerald-300'
                  : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
              }`}
            >
              {item.icon}
              {item.label}
              {item.key === 'incidents' && incidents.filter((i) => i.status === 'active').length > 0 && (
                <span className="ml-auto rounded-full bg-red-500/20 px-2 py-0.5 text-[11px] font-bold text-red-300">
                  {incidents.filter((i) => i.status === 'active').length}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="border-t border-slate-800 px-4 py-4">
          <div className="mb-3 flex items-center gap-2 text-xs text-slate-400">
            <span className={`h-2 w-2 rounded-full ${connected ? 'live-dot bg-emerald-400' : 'bg-slate-500'}`} />
            {IS_STANDALONE ? 'Samostojni način · lokalno' : connected ? 'V živo povezano' : 'Povezovanje …'}
          </div>
          {user ? (
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/20 text-sm font-extrabold text-emerald-300">
                  {user.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-white">{user.name}</p>
                  <p className="truncate text-xs text-slate-400">{user.vehicle_plate}</p>
                </div>
              </div>
              <GhostButton onClick={handleLogout} className="w-full">
                <LogOut className="h-4 w-4" /> Odjava
              </GhostButton>
            </div>
          ) : (
            <PrimaryButton onClick={() => setAuthOpen(true)} className="w-full">
              <LogIn className="h-4 w-4" /> Prijava / registracija
            </PrimaryButton>
          )}
        </div>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-slate-800 bg-[#090c10]/90 backdrop-blur">
          <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
            <button onClick={() => setSidebarOpen(true)} className="rounded-lg p-2 text-slate-300 hover:bg-slate-800 lg:hidden" aria-label="Odpri meni">
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-extrabold text-white sm:text-xl">
                {NAV.find((n) => n.key === view)?.label}
              </h1>
              <p className="hidden text-xs text-slate-400 sm:block">
                {gps.status === 'active' || gps.status === 'simulated'
                  ? `GPS: ${gps.speedKmh ?? '—'} km/h · ${gps.lat?.toFixed(4)}, ${gps.lng?.toFixed(4)}`
                  : 'Slovenske prometne kamere v živo · DARS / DRSI prek promet.si'}
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className={`hidden items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold sm:inline-flex ${connected ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-slate-700 text-slate-400'}`}>
                <span className={`h-2 w-2 rounded-full ${connected ? 'live-dot bg-emerald-400' : 'bg-slate-500'}`} />
                {IS_STANDALONE ? 'LOKALNO' : connected ? 'V ŽIVO' : 'OFFLINE'}
              </span>
              <PrimaryButton
                onClick={() => {
                  if (requireAuth()) return;
                  setEditingIncident(null);
                  setIncidentFormOpen(true);
                }}
                className="!px-3.5 !py-2 text-xs sm:text-sm"
              >
                <Flag className="h-4 w-4" /> <span className="hidden sm:inline">Prijavi dogodek</span>
              </PrimaryButton>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
          {loadError && (
            <div className="mb-5 flex items-center gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              <CircleAlert className="h-5 w-5 shrink-0" />
              <span className="flex-1">{loadError}</span>
              <GhostButton onClick={() => void loadAll()} className="!px-3 !py-1.5 text-xs">Poskusi znova</GhostButton>
            </div>
          )}

          {view === 'dashboard' && (
            <DashboardPage
              stats={stats}
              cameras={cameras}
              incidents={incidents}
              segments={segments}
              gps={gps}
              onStartGps={startGps}
              onStopGps={stopGps}
              onSimulateGps={startSimulated}
              onGo={setView}
              onOpenCamera={setSelectedCamera}
              onToggleFavorite={handleToggleFavorite}
              onVote={handleVote}
              onFocusIncident={focusIncident}
              refreshKey={refreshKey}
              loading={loading}
            />
          )}

          {view === 'cameras' && (
            <div className="space-y-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    className="w-full rounded-xl border border-slate-700/70 bg-[#0b0f14] py-2.5 pl-10 pr-4 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20"
                    placeholder="Išči kamero, cesto ali regijo …"
                    value={cameraQuery}
                    onChange={(e) => setCameraQuery(e.target.value)}
                  />
                </div>
                <select className="rounded-xl border border-slate-700/70 bg-[#0b0f14] px-3.5 py-2.5 text-sm text-slate-100 outline-none focus:border-emerald-500/60" value={cameraRegion} onChange={(e) => setCameraRegion(e.target.value)}>
                  <option value="all">Vse regije</option>
                  {regions.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                <select className="rounded-xl border border-slate-700/70 bg-[#0b0f14] px-3.5 py-2.5 text-sm text-slate-100 outline-none focus:border-emerald-500/60" value={cameraRoad} onChange={(e) => setCameraRoad(e.target.value)}>
                  <option value="all">Vse ceste</option>
                  {roads.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                <button
                  onClick={() => setOnlyFavorites((v) => !v)}
                  className={`rounded-xl border px-4 py-2.5 text-sm font-bold transition ${onlyFavorites ? 'border-rose-500/50 bg-rose-500/15 text-rose-300' : 'border-slate-700 bg-[#131a22] text-slate-300 hover:border-slate-600'}`}
                >
                  ♥ Priljubljene
                </button>
                <PrimaryButton
                  onClick={() => {
                    if (requireAuth()) return;
                    setEditingCamera(null);
                    setCameraFormOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4" /> Dodaj kamero
                </PrimaryButton>
              </div>

              <p className="text-sm text-slate-400">
                Prikazanih <b className="text-slate-200">{filteredCameras.length}</b> od {cameras.length} kamer · posnetki se osvežijo vsako minuto
              </p>

              {loading && cameras.length === 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <SkeletonCard key={i} />
                  ))}
                </div>
              ) : filteredCameras.length === 0 ? (
                <CamerasEmpty
                  onAdd={() => {
                    if (requireAuth()) return;
                    setEditingCamera(null);
                    setCameraFormOpen(true);
                  }}
                />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {filteredCameras.map((cam) => (
                    <CameraCard
                      key={cam.id}
                      camera={cam}
                      refreshKey={refreshKey}
                      onOpen={setSelectedCamera}
                      onToggleFavorite={handleToggleFavorite}
                      onEdit={(c) => {
                        setEditingCamera(c);
                        setCameraFormOpen(true);
                      }}
                      onDelete={handleDeleteCamera}
                      canManage={canManageCamera(cam)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {view === 'map' && (
            <div className="space-y-5">
              <MapView
                cameras={cameras}
                incidents={incidents}
                gps={gps}
                selectedCamera={selectedCamera}
                onSelectCamera={setSelectedCamera}
                onSelectIncident={focusIncident}
                heightClass="h-[calc(100vh-220px)] min-h-[480px]"
              />
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {incidents.filter((i) => i.status === 'active').slice(0, 6).map((inc) => (
                  <IncidentCard
                    key={inc.id}
                    incident={inc}
                    currentUserId={user?.id ?? null}
                    onVote={handleVote}
                    onEdit={(i) => {
                      setEditingIncident(i);
                      setIncidentFormOpen(true);
                    }}
                    onDelete={handleDeleteIncident}
                    onResolve={handleResolveIncident}
                    onFocus={focusIncident}
                  />
                ))}
              </div>
            </div>
          )}

          {view === 'incidents' && (
            <div className="space-y-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <IncidentTypeFilter value={incidentType} onChange={setIncidentType} />
                <div className="relative flex-1 lg:max-w-sm">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    className="w-full rounded-xl border border-slate-700/70 bg-[#0b0f14] py-2.5 pl-10 pr-4 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20"
                    placeholder="Išči poročila …"
                    value={incidentQuery}
                    onChange={(e) => setIncidentQuery(e.target.value)}
                  />
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} className="h-4 w-4 accent-emerald-500" />
                  Prikaži razrešena
                </label>
                <PrimaryButton
                  onClick={() => {
                    if (requireAuth()) return;
                    setEditingIncident(null);
                    setIncidentFormOpen(true);
                  }}
                >
                  <Flag className="h-4 w-4" /> Prijavi dogodek
                </PrimaryButton>
              </div>

              {loading && incidents.length === 0 ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="skeleton h-32 rounded-2xl" />
                  ))}
                </div>
              ) : filteredIncidents.length === 0 ? (
                <IncidentsEmpty
                  onReport={() => {
                    if (requireAuth()) return;
                    setEditingIncident(null);
                    setIncidentFormOpen(true);
                  }}
                />
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  {filteredIncidents.map((inc) => (
                    <IncidentCard
                      key={inc.id}
                      incident={inc}
                      currentUserId={user?.id ?? null}
                      onVote={handleVote}
                      onEdit={(i) => {
                        setEditingIncident(i);
                        setIncidentFormOpen(true);
                      }}
                      onDelete={handleDeleteIncident}
                      onResolve={handleResolveIncident}
                      onFocus={focusIncident}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {view === 'segments' && (
            <SegmentsPage
              segments={segments}
              user={user}
              onChanged={(seg) => {
                setSegments((prev) => {
                  const idx = prev.findIndex((s) => s.id === seg.id);
                  if (idx === -1) return [...prev, seg];
                  const next = [...prev];
                  next[idx] = seg;
                  return next;
                });
                pushToast('success', 'Odsek shranjen');
              }}
              onDeleted={(id) => {
                setSegments((prev) => prev.filter((segment) => segment.id !== id));
                pushToast('success', 'Odsek izbrisan');
              }}
              onError={(msg) => pushToast('error', 'Napaka', msg)}
              onRequireAuth={() => setAuthOpen(true)}
            />
          )}

          {view === 'routes' && (
            <RoutesPage
              routes={routes}
              user={user}
              onChanged={(route) => {
                setRoutes((prev) => {
                  const idx = prev.findIndex((r) => r.id === route.id);
                  if (idx === -1) return [route, ...prev];
                  const next = [...prev];
                  next[idx] = route;
                  return next.sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned));
                });
                pushToast('success', 'Pot shranjena');
              }}
              onDeleted={(id) => {
                setRoutes((prev) => prev.filter((route) => route.id !== id));
                pushToast('success', 'Pot izbrisana');
              }}
              onError={(msg) => pushToast('error', 'Napaka', msg)}
              onRequireAuth={() => setAuthOpen(true)}
              onFocusRoute={focusRoute}
            />
          )}

          {view === 'settings' && (
            <SettingsPage
              user={user}
              onUpdated={(u) => {
                setUser(u);
                pushToast('success', 'Nastavitve shranjene');
              }}
              onError={(msg) => pushToast('error', 'Napaka', msg)}
              onRequireAuth={() => setAuthOpen(true)}
              onLogout={handleLogout}
            />
          )}

          <footer className="mt-10 border-t border-slate-800 pt-5 text-center text-xs text-slate-500">
            SloPromet GPS · Kamere: DARS / DRSI prek promet.si · Zemljevid: OpenStreetMap · Podatki o dogodkih: skupnost voznikov
          </footer>
        </main>
      </div>

      {/* Modals */}
      <CameraDetailModal
        camera={selectedCamera}
        refreshKey={refreshKey}
        onClose={() => setSelectedCamera(null)}
        onToggleFavorite={handleToggleFavorite}
        onEdit={(c) => {
          setEditingCamera(c);
          setCameraFormOpen(true);
        }}
        onDelete={handleDeleteCamera}
        canManage={selectedCamera ? canManageCamera(selectedCamera) : false}
      />
      <CameraFormModal
        open={cameraFormOpen}
        initial={editingCamera}
        onClose={() => {
          setCameraFormOpen(false);
          setEditingCamera(null);
        }}
        onSubmit={handleSubmitCamera}
        saving={savingCamera}
      />
      <IncidentFormModal
        open={incidentFormOpen}
        initial={editingIncident}
        gps={gps}
        onClose={() => {
          setIncidentFormOpen(false);
          setEditingIncident(null);
        }}
        onSubmit={handleSubmitIncident}
        saving={savingIncident}
      />
      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onSuccess={handleAuthSuccess}
        onError={(msg) => pushToast('error', 'Prijava ni uspela', msg)}
      />

      {/* Toasts */}
      <div className="fixed bottom-4 right-4 z-[110] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`animate-toast-in flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur ${
              toast.kind === 'success'
                ? 'border-emerald-500/40 bg-[#0d1a14]/95'
                : toast.kind === 'error'
                  ? 'border-red-500/40 bg-[#1a0d0d]/95'
                  : 'border-slate-700 bg-[#11161d]/95'
            }`}
          >
            {toast.kind === 'success' ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
            ) : toast.kind === 'error' ? (
              <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
            ) : (
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-sky-400" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-white">{toast.title}</p>
              {toast.message && <p className="mt-0.5 text-xs text-slate-400">{toast.message}</p>}
            </div>
            <button onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))} className="text-slate-500 hover:text-white" aria-label="Zapri obvestilo">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
