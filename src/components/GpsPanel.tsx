import { useEffect, useRef, useState } from 'react';
import { Compass, Gauge, Navigation, Play, Square, TriangleAlert } from 'lucide-react';
import type { GpsState } from '../lib/types';
import { Card, GhostButton, PrimaryButton } from './ui';

function SpeedDial({ speed, limit }: { speed: number | null; limit: number }) {
  const value = speed ?? 0;
  const max = 180;
  const pct = Math.min(100, (value / max) * 100);
  const over = speed != null && speed > limit;
  const color = over ? '#f87171' : value > limit * 0.85 ? '#fbbf24' : '#34d399';
  return (
    <div className="relative mx-auto h-44 w-44">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r="52" fill="none" stroke="#1e293b" strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r="52"
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * 326.7} 326.7`}
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-5xl font-extrabold leading-none text-white">{value}</span>
        <span className="mt-1 text-xs font-semibold uppercase tracking-widest text-slate-400">km/h</span>
        <span className={`mt-2 rounded-full px-2 py-0.5 text-[11px] font-bold ${over ? 'bg-red-500/15 text-red-300' : 'bg-slate-800 text-slate-300'}`}>
          Omejitev {limit} km/h
        </span>
      </div>
    </div>
  );
}

export function GpsPanel({
  gps,
  speedLimit,
  tolerance,
  onStart,
  onStop,
  onSimulate,
  compact = false,
}: {
  gps: GpsState;
  speedLimit: number;
  tolerance: number;
  onStart: () => void;
  onStop: () => void;
  onSimulate: () => void;
  compact?: boolean;
}) {
  const [lastAlertAt, setLastAlertAt] = useState(0);
  const audioRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (gps.speedKmh == null) return;
    if (gps.speedKmh > speedLimit + tolerance && Date.now() - lastAlertAt > 8000) {
      setLastAlertAt(Date.now());
      try {
        if (!audioRef.current) {
          audioRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        }
        const ctx = audioRef.current;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      } catch {
        /* audio not available */
      }
    }
  }, [gps.speedKmh, speedLimit, tolerance, lastAlertAt]);

  const over = gps.speedKmh != null && gps.speedKmh > speedLimit + tolerance;

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold text-slate-100">
          <Navigation className="h-4 w-4 text-blue-400" /> GPS merilnik hitrosti
        </h3>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${
            gps.status === 'active'
              ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
              : gps.status === 'simulated'
                ? 'border-amber-500/40 bg-amber-500/15 text-amber-300'
                : gps.status === 'searching'
                  ? 'border-blue-500/40 bg-blue-500/15 text-blue-300'
                  : 'border-slate-700 bg-slate-800/60 text-slate-400'
          }`}
        >
          <span className={`h-2 w-2 rounded-full ${gps.status === 'active' ? 'live-dot bg-emerald-400' : gps.status === 'simulated' ? 'bg-amber-400' : gps.status === 'searching' ? 'live-dot bg-blue-400' : 'bg-slate-500'}`} />
          {gps.status === 'active' && 'GPS aktiven'}
          {gps.status === 'simulated' && 'Demo vožnja'}
          {gps.status === 'searching' && 'Iščenje GPS …'}
          {gps.status === 'denied' && 'GPS zavrnjen'}
          {gps.status === 'error' && 'GPS napaka'}
          {gps.status === 'off' && 'GPS izklopljen'}
        </span>
      </div>

      <div className={`mt-4 ${compact ? '' : 'sm:flex sm:items-center sm:gap-6'}`}>
        <SpeedDial speed={gps.speedKmh} limit={speedLimit} />
        <div className="mt-4 grid grid-cols-2 gap-2 text-sm sm:mt-0 sm:flex-1">
          <div className="rounded-xl border border-slate-800 bg-[#0b0f14] p-3">
            <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <Gauge className="h-3.5 w-3.5" /> Hitrost
            </p>
            <p className="mt-1 font-mono text-lg font-extrabold text-white">{gps.speedKmh ?? '—'} km/h</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-[#0b0f14] p-3">
            <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <Compass className="h-3.5 w-3.5" /> Smer
            </p>
            <p className="mt-1 font-mono text-lg font-extrabold text-white">{gps.heading != null ? `${gps.heading}°` : '—'}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-[#0b0f14] p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Koordinate</p>
            <p className="mt-1 font-mono text-xs font-bold text-slate-100">
              {gps.lat != null ? `${gps.lat.toFixed(5)}, ${gps.lng?.toFixed(5)}` : '—'}
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-[#0b0f14] p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Natančnost</p>
            <p className="mt-1 font-mono text-lg font-extrabold text-white">{gps.accuracy != null ? `±${gps.accuracy} m` : '—'}</p>
          </div>
        </div>
      </div>

      {over && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2.5 text-sm font-semibold text-red-300">
          <TriangleAlert className="h-4 w-4 shrink-0" />
          Prekoračitev hitrosti! Vozite počasneje (omejitev {speedLimit} km/h + toleranca {tolerance} km/h).
        </div>
      )}

      {gps.error && (
        <p className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-200">{gps.error}</p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {gps.status === 'active' || gps.status === 'simulated' || gps.status === 'searching' ? (
          <GhostButton onClick={onStop}>
            <Square className="h-4 w-4" /> Ugasni GPS
          </GhostButton>
        ) : (
          <PrimaryButton onClick={onStart}>
            <Play className="h-4 w-4" /> Vklopi GPS
          </PrimaryButton>
        )}
        <GhostButton onClick={onSimulate}>
          <Play className="h-4 w-4" /> Demo vožnja
        </GhostButton>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        GPS uporablja lokacijo brskalnika (Geolocation API). Če dostop ni dovoljen, lahko zaženete demo vožnjo po avtocesti A1.
      </p>
    </Card>
  );
}
