import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Camera, Incident, GpsState } from '../lib/types';
import { INCIDENT_META } from '../lib/format';

// Fix default icon paths for Vite builds
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: string })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function cameraIcon(camera: Camera): L.DivIcon {
  const isFav = camera.is_favorite;
  const color = camera.traffic_flow === 'congested' ? '#f87171' : camera.traffic_flow === 'busy' ? '#fbbf24' : '#34d399';
  return L.divIcon({
    className: '',
    html: `<div style="display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:9999px;background:#0b0f14;border:2px solid ${color};box-shadow:0 4px 14px rgba(0,0,0,.55);font-size:14px;">${isFav ? '⭐' : '📷'}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

function incidentIcon(type: string): L.DivIcon {
  const emoji =
    type === 'police' ? '🚔' : type === 'accident' ? '💥' : type === 'jam' ? '🚗' : type === 'roadwork' ? '🚧' : '⚠️';
  const color =
    type === 'police' ? '#38bdf8' : type === 'accident' ? '#f87171' : type === 'jam' ? '#fbbf24' : type === 'roadwork' ? '#fb923c' : '#a78bfa';
  return L.divIcon({
    className: '',
    html: `<div style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:9999px;background:#0b0f14;border:2px solid ${color};box-shadow:0 4px 14px rgba(0,0,0,.55);font-size:15px;">${emoji}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

function userIcon(): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="position:relative;width:22px;height:22px;"><div style="position:absolute;inset:0;border-radius:9999px;background:rgba(59,130,246,.35);border:2px solid #60a5fa;"></div><div style="position:absolute;inset:6px;border-radius:9999px;background:#3b82f6;border:2px solid white;"></div></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

export function MapView({
  cameras,
  incidents,
  gps,
  selectedCamera,
  onSelectCamera,
  onSelectIncident,
  heightClass = 'h-[520px]',
}: {
  cameras: Camera[];
  incidents: Incident[];
  gps: GpsState;
  selectedCamera: Camera | null;
  onSelectCamera: (camera: Camera) => void;
  onSelectIncident: (incident: Incident) => void;
  heightClass?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const cameraLayerRef = useRef<L.LayerGroup | null>(null);
  const incidentLayerRef = useRef<L.LayerGroup | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: [46.1512, 14.9955],
      zoom: 8,
      zoomControl: true,
    });
    mapRef.current = map;
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> prispevki',
      maxZoom: 19,
    }).addTo(map);

    cameraLayerRef.current = L.layerGroup().addTo(map);
    incidentLayerRef.current = L.layerGroup().addTo(map);

    // Fit to Slovenia bounds
    map.fitBounds([
      [45.42, 13.37],
      [46.88, 16.6],
    ]);
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Camera markers
  useEffect(() => {
    const layer = cameraLayerRef.current;
    const map = mapRef.current;
    if (!layer || !map) return;
    layer.clearLayers();
    for (const cam of cameras) {
      const marker = L.marker([cam.lat, cam.lng], { icon: cameraIcon(cam) });
      marker.bindPopup(
        `<div style="min-width:180px;">
          <div style="font-weight:700;font-size:14px;margin-bottom:2px;">${cam.name}</div>
          <div style="color:#94a3b8;font-size:12px;">${cam.road_code} · ${cam.region}</div>
          <div style="margin-top:6px;font-size:12px;">Hitrost: <b>${cam.current_speed_kmh} km/h</b> / ${cam.speed_limit_kmh} km/h</div>
          <div style="font-size:12px;">Vir: ${cam.operator} · promet.si</div>
        </div>`
      );
      marker.on('click', () => onSelectCamera(cam));
      marker.addTo(layer);
    }
  }, [cameras, onSelectCamera]);

  // Incident markers
  useEffect(() => {
    const layer = incidentLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    for (const inc of incidents.filter((i) => i.status === 'active')) {
      const marker = L.marker([inc.lat, inc.lng], { icon: incidentIcon(inc.type) });
      const meta = INCIDENT_META[inc.type];
      marker.bindPopup(
        `<div style="min-width:200px;">
          <div style="font-weight:700;font-size:14px;margin-bottom:2px;">${inc.title}</div>
          <div style="color:#94a3b8;font-size:12px;">${meta.label} · ${inc.road_code} · ${inc.location_name}</div>
          <div style="margin-top:6px;font-size:12px;">${inc.description.slice(0, 140)}${inc.description.length > 140 ? '…' : ''}</div>
        </div>`
      );
      marker.on('click', () => onSelectIncident(inc));
      marker.addTo(layer);
    }
  }, [incidents, onSelectIncident]);

  // User GPS marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (gps.lat == null || gps.lng == null) {
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }
      return;
    }
    if (!userMarkerRef.current) {
      userMarkerRef.current = L.marker([gps.lat, gps.lng], { icon: userIcon() }).addTo(map);
    } else {
      userMarkerRef.current.setLatLng([gps.lat, gps.lng]);
    }
    userMarkerRef.current.bindPopup(
      `<div><b>Vaša lokacija (GPS)</b><br/>${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)}<br/>Hitrost: ${gps.speedKmh ?? '—'} km/h${gps.simulated ? '<br/><i>Demo vožnja</i>' : ''}</div>`
    );
  }, [gps.lat, gps.lng, gps.speedKmh, gps.simulated]);

  // Fly to selected camera
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedCamera) return;
    map.flyTo([selectedCamera.lat, selectedCamera.lng], Math.max(map.getZoom(), 11), { duration: 1.2 });
  }, [selectedCamera]);

  const counts = useMemo(
    () => ({
      cameras: cameras.length,
      incidents: incidents.filter((i) => i.status === 'active').length,
    }),
    [cameras, incidents]
  );

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-800">
      <div ref={containerRef} className={`w-full ${heightClass}`} />
      <div className="pointer-events-none absolute left-3 top-3 z-[500] flex flex-wrap gap-2">
        <span className="rounded-full border border-slate-700/70 bg-[#0b0f14]/90 px-3 py-1 text-xs font-semibold text-slate-200 backdrop-blur">
          📷 {counts.cameras} kamer
        </span>
        <span className="rounded-full border border-slate-700/70 bg-[#0b0f14]/90 px-3 py-1 text-xs font-semibold text-slate-200 backdrop-blur">
          🚨 {counts.incidents} aktivnih poročil
        </span>
        {gps.lat != null && (
          <span className="rounded-full border border-blue-500/40 bg-blue-500/15 px-3 py-1 text-xs font-semibold text-blue-200 backdrop-blur">
            📍 GPS: {gps.lat.toFixed(4)}, {gps.lng?.toFixed(4)}
          </span>
        )}
      </div>
      <div className="pointer-events-none absolute bottom-3 left-3 z-[500] rounded-xl border border-slate-700/70 bg-[#0b0f14]/90 px-3 py-2 text-[11px] text-slate-400 backdrop-blur">
        Zemljevid: OpenStreetMap · Kamere: DARS / DRSI prek promet.si
      </div>
    </div>
  );
}
