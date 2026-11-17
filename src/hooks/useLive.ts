import { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import type { Camera, Incident, RoadSegment, Stats } from '../lib/types';
import { apiUrl } from '../lib/apiBase';
import { IS_STANDALONE, LOCAL_DATA_EVENT } from '../lib/runtime';

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
    if (IS_STANDALONE) {
      const onLocalData = (event: Event) => {
        const detail = (event as CustomEvent<Record<string, unknown>>).detail;
        switch (detail.type) {
          case 'camera:created':
          case 'camera:updated':
            handlersRef.current.onCamera?.(detail.camera as Camera);
            break;
          case 'camera:deleted':
            handlersRef.current.onCameraDeleted?.(Number(detail.id));
            break;
          case 'incident:created':
          case 'incident:updated':
            handlersRef.current.onIncident?.(detail.incident as Incident);
            break;
          case 'incident:deleted':
            handlersRef.current.onIncidentDeleted?.(Number(detail.id));
            break;
          case 'segment:updated':
            handlersRef.current.onSegment?.(detail.segment as RoadSegment);
            break;
          case 'segment:deleted':
            handlersRef.current.onSegmentDeleted?.(Number(detail.id));
            break;
          case 'stats':
            handlersRef.current.onStats?.(detail.stats as Stats);
            break;
        }
      };
      setConnected(true);
      handlersRef.current.onConnected?.();
      window.addEventListener(LOCAL_DATA_EVENT, onLocalData);
      return () => {
        window.removeEventListener(LOCAL_DATA_EVENT, onLocalData);
      };
    }

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

  const webWatchIdRef = useRef<number | null>(null);
  const nativeWatchIdRef = useRef<string | null>(null);
  const simTimerRef = useRef<number | null>(null);
  const generationRef = useRef(0);
  const simStateRef = useRef({ lat: 46.0569, lng: 14.5058, speed: 0, heading: 90 });

  const clearActiveWatches = () => {
    generationRef.current += 1;
    if (webWatchIdRef.current !== null) {
      navigator.geolocation.clearWatch(webWatchIdRef.current);
      webWatchIdRef.current = null;
    }
    if (nativeWatchIdRef.current !== null) {
      void Geolocation.clearWatch({ id: nativeWatchIdRef.current });
      nativeWatchIdRef.current = null;
    }
    if (simTimerRef.current !== null) {
      window.clearInterval(simTimerRef.current);
      simTimerRef.current = null;
    }
  };

  const stop = () => {
    clearActiveWatches();
    setGps((state) => ({ ...state, status: 'off', error: null, simulated: false }));
  };

  const updatePosition = (coords: {
    latitude: number;
    longitude: number;
    speed: number | null;
    heading: number | null;
    accuracy: number;
    altitude: number | null;
  }) => {
    setGps({
      lat: coords.latitude,
      lng: coords.longitude,
      speedKmh: coords.speed != null && coords.speed >= 0 ? Math.round(coords.speed * 3.6) : null,
      heading: coords.heading != null && coords.heading >= 0 ? Math.round(coords.heading) : null,
      accuracy: Math.round(coords.accuracy),
      altitude: coords.altitude != null ? Math.round(coords.altitude) : null,
      status: 'active',
      error: null,
      simulated: false,
    });
  };

  const startSimulated = () => {
    clearActiveWatches();
    simStateRef.current = { lat: 46.0569, lng: 14.5058, speed: 0, heading: 90 };
    setGps((state) => ({ ...state, status: 'simulated', simulated: true, error: null }));
    simTimerRef.current = window.setInterval(() => {
      const state = simStateRef.current;
      // Demo drive: accelerate to motorway speed and move north-east from Ljubljana.
      const target = 110;
      state.speed += (target - state.speed) * 0.08 + (Math.random() - 0.5) * 6;
      state.speed = Math.max(0, Math.min(135, state.speed));
      state.heading = 55 + Math.sin(Date.now() / 9000) * 35;
      const radians = (state.heading * Math.PI) / 180;
      const distanceKm = state.speed / 3600;
      state.lat += (distanceKm * Math.cos(radians)) / 111;
      state.lng += (distanceKm * Math.sin(radians)) / (111 * Math.cos((state.lat * Math.PI) / 180));
      if (state.lat > 46.7) state.lat = 46.05;
      if (state.lng > 15.7) state.lng = 14.5;
      setGps((current) => ({
        ...current,
        lat: state.lat,
        lng: state.lng,
        speedKmh: Math.round(state.speed),
        heading: Math.round(state.heading),
        accuracy: 8,
        altitude: 300 + Math.round(Math.sin(Date.now() / 20000) * 40),
        status: 'simulated',
        error: null,
        simulated: true,
      }));
    }, 1000);
  };

  const startNative = async (generation: number) => {
    try {
      let permission = await Geolocation.checkPermissions();
      if (permission.location !== 'granted') {
        permission = await Geolocation.requestPermissions({ permissions: ['location'] });
      }
      if (permission.location !== 'granted') {
        setGps((state) => ({
          ...state,
          status: 'denied',
          error: 'Dostop do lokacije je zavrnjen. V nastavitvah Androida omogočite lokacijo ali uporabite demo vožnjo.',
        }));
        return;
      }

      const id = await Geolocation.watchPosition(
        { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000, minimumUpdateInterval: 1000 },
        (position, error) => {
          if (generationRef.current !== generation) return;
          if (error || !position) {
            setGps((state) => ({
              ...state,
              status: 'error',
              error: error?.message || 'GPS signala ni mogoče pridobiti. Preverite, ali je lokacija vključena.',
            }));
            return;
          }
          updatePosition(position.coords);
        }
      );
      if (generationRef.current !== generation) {
        void Geolocation.clearWatch({ id });
      } else {
        nativeWatchIdRef.current = id;
      }
    } catch (error) {
      if (generationRef.current !== generation) return;
      setGps((state) => ({
        ...state,
        status: 'error',
        error: error instanceof Error ? error.message : 'GPS ni na voljo. Vključite lokacijo ali uporabite demo vožnjo.',
      }));
    }
  };

  const start = () => {
    clearActiveWatches();
    setGps((state) => ({ ...state, status: 'searching', error: null, simulated: false }));
    const generation = generationRef.current;

    if (Capacitor.isNativePlatform()) {
      void startNative(generation);
      return;
    }

    if (!('geolocation' in navigator)) {
      setGps((state) => ({ ...state, status: 'error', error: 'GPS ni podprt v tem brskalniku.' }));
      return;
    }

    webWatchIdRef.current = navigator.geolocation.watchPosition(
      (position) => updatePosition(position.coords),
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setGps((state) => ({
            ...state,
            status: 'denied',
            error: 'Dostop do lokacije je zavrnjen. Omogočite GPS ali zaženite demo vožnjo.',
          }));
        } else {
          setGps((state) => ({ ...state, status: 'error', error: error.message || 'GPS napaka.' }));
        }
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 }
    );
  };

  useEffect(() => {
    return () => {
      generationRef.current += 1;
      if (webWatchIdRef.current !== null) navigator.geolocation.clearWatch(webWatchIdRef.current);
      if (nativeWatchIdRef.current !== null) void Geolocation.clearWatch({ id: nativeWatchIdRef.current });
      if (simTimerRef.current !== null) window.clearInterval(simTimerRef.current);
    };
  }, []);

  return { gps, start, stop, startSimulated };
}
