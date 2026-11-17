import { useEffect, useRef, useState } from 'react';
import type { Camera, Incident, RoadSegment, Stats } from '../lib/types';
import { apiUrl } from '../lib/apiBase';

interface LiveHandlers {
  onCamera?: (camera: Camera) => void;
  onCameraDeleted?: (id: number) => void;
  onIncident?: (incident: Incident) => void;
  onIncidentDeleted?: (id: number) => void;
  onSegment?: (segment: RoadSegment) => void;
  onSegmentDeleted?: (id: number) => void;
  onStats?: (stats: Stats) => void;
  onConnected?: () => void;
}

export function useLiveStream(handlers: LiveHandlers) {
  const [connected, setConnected] = useState(false);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    let source: EventSource | null = null;
    let retryTimer: number | null = null;
    let closed = false;

    const connect = () => {
      if (closed) return;
      source = new EventSource(apiUrl('/api/stream'), { withCredentials: true });

      source.addEventListener('connected', () => {
        setConnected(true);
        handlersRef.current.onConnected?.();
      });
      source.addEventListener('heartbeat', () => setConnected(true));
      source.addEventListener('camera:created', (e) => {
        try {
          const data = JSON.parse((e as MessageEvent).data);
          handlersRef.current.onCamera?.(data.camera);
        } catch { /* ignore */ }
      });
      source.addEventListener('camera:updated', (e) => {
        try {
          const data = JSON.parse((e as MessageEvent).data);
          handlersRef.current.onCamera?.(data.camera);
        } catch { /* ignore */ }
      });
      source.addEventListener('camera:deleted', (e) => {
        try {
          const data = JSON.parse((e as MessageEvent).data);
          handlersRef.current.onCameraDeleted?.(data.id);
        } catch { /* ignore */ }
      });
      source.addEventListener('incident:created', (e) => {
        try {
          const data = JSON.parse((e as MessageEvent).data);
          handlersRef.current.onIncident?.(data.incident);
        } catch { /* ignore */ }
      });
      source.addEventListener('incident:updated', (e) => {
        try {
          const data = JSON.parse((e as MessageEvent).data);
          handlersRef.current.onIncident?.(data.incident);
        } catch { /* ignore */ }
      });
      source.addEventListener('incident:deleted', (e) => {
        try {
          const data = JSON.parse((e as MessageEvent).data);
          handlersRef.current.onIncidentDeleted?.(data.id);
        } catch { /* ignore */ }
      });
      source.addEventListener('segment:updated', (e) => {
        try {
          const data = JSON.parse((e as MessageEvent).data);
          handlersRef.current.onSegment?.(data.segment);
        } catch { /* ignore */ }
      });
      source.addEventListener('segment:deleted', (e) => {
        try {
          const data = JSON.parse((e as MessageEvent).data);
          handlersRef.current.onSegmentDeleted?.(data.id);
        } catch { /* ignore */ }
      });

      source.onerror = () => {
        setConnected(false);
        source?.close();
        if (!closed) {
          retryTimer = window.setTimeout(connect, 3000);
        }
      };
    };

    connect();
    return () => {
      closed = true;
      if (retryTimer) window.clearTimeout(retryTimer);
      source?.close();
    };
  }, []);

  return { connected };
}

export function useGps() {
  const [gps, setGps] = useState<{
    lat: number | null;
    lng: number | null;
    speedKmh: number | null;
    heading: number | null;
    accuracy: number | null;
    altitude: number | null;
    status: 'off' | 'searching' | 'active' | 'simulated' | 'denied' | 'error';
    error: string | null;
    simulated: boolean;
  }>({
    lat: null,
    lng: null,
    speedKmh: null,
    heading: null,
    accuracy: null,
    altitude: null,
    status: 'off',
    error: null,
    simulated: false,
  });

  const watchIdRef = useRef<number | null>(null);
  const simTimerRef = useRef<number | null>(null);
  const simStateRef = useRef({ lat: 46.0569, lng: 14.5058, speed: 0, heading: 90 });

  const stop = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (simTimerRef.current !== null) {
      window.clearInterval(simTimerRef.current);
      simTimerRef.current = null;
    }
    setGps((g) => ({ ...g, status: 'off', simulated: false }));
  };

  const startSimulated = () => {
    stop();
    simStateRef.current = { lat: 46.0569, lng: 14.5058, speed: 0, heading: 90 };
    setGps((g) => ({ ...g, status: 'simulated', simulated: true, error: null }));
    simTimerRef.current = window.setInterval(() => {
      const s = simStateRef.current;
      // Simple drive simulation: accelerate to ~110 km/h, head north-east along A1 corridor
      const target = 110;
      s.speed += (target - s.speed) * 0.08 + (Math.random() - 0.5) * 6;
      s.speed = Math.max(0, Math.min(135, s.speed));
      s.heading = 55 + Math.sin(Date.now() / 9000) * 35;
      const rad = (s.heading * Math.PI) / 180;
      const distKm = s.speed / 3600;
      const dLat = (distKm * Math.cos(rad)) / 111;
      const dLng = (distKm * Math.sin(rad)) / (111 * Math.cos((s.lat * Math.PI) / 180));
      s.lat += dLat;
      s.lng += dLng;
      // Keep inside Slovenia bounds
      if (s.lat > 46.7) s.lat = 46.05;
      if (s.lng > 15.7) s.lng = 14.5;
      setGps((g) => ({
        ...g,
        lat: s.lat,
        lng: s.lng,
        speedKmh: Math.round(s.speed),
        heading: Math.round(s.heading),
        accuracy: 8,
        altitude: 300 + Math.round(Math.sin(Date.now() / 20000) * 40),
        status: 'simulated',
        simulated: true,
      }));
    }, 1000);
  };

  const start = () => {
    if (!('geolocation' in navigator)) {
      setGps((g) => ({ ...g, status: 'error', error: 'GPS ni podprt v tem brskalniku.' }));
      return;
    }
    stop();
    setGps((g) => ({ ...g, status: 'searching', error: null, simulated: false }));
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, speed, heading, accuracy, altitude } = pos.coords;
        setGps({
          lat: latitude,
          lng: longitude,
          speedKmh: speed != null && speed >= 0 ? Math.round(speed * 3.6) : null,
          heading: heading != null && heading >= 0 ? Math.round(heading) : null,
          accuracy: Math.round(accuracy),
          altitude: altitude != null ? Math.round(altitude) : null,
          status: 'active',
          error: null,
          simulated: false,
        });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setGps((g) => ({
            ...g,
            status: 'denied',
            error: 'Dostop do lokacije je zavrnjen. Omogočite GPS ali zaženite demo vožnjo.',
          }));
        } else {
          setGps((g) => ({ ...g, status: 'error', error: err.message || 'GPS napaka.' }));
        }
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 }
    );
  };

  return { gps, start, stop, startSimulated };
}
