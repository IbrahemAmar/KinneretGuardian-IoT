'use client';
import { useState, useEffect, useCallback } from 'react';
import WindWaveLagChart from '@/components/charts/WindWaveLagChart';
import { generateMockData } from '@/lib/mockData';
import { classifyDanger } from '@/lib/dangerUtils';

const FALLBACK  = generateMockData(120);
const STATIONS  = ['KNW08', 'KNW09', 'KNW10', 'KNW11', 'KNW12'];

function hasWsHs(merged) {
  if (!merged?.length) return false;
  return merged[0].Ws !== undefined && merged[0].Hs !== undefined;
}

function fmtHour(timeStr) {
  if (!timeStr) return '--:--';
  try {
    const d = new Date(timeStr.trim().replace(/^(\d{4}-\d{2}-\d{2}) /, '$1T'));
    if (isNaN(d)) return '--:--';
    return d.getUTCHours().toString().padStart(2, '0') + ':00';
  } catch { return '--:--'; }
}

// ─── Realtime sub-component ──────────────────────────────────────────────────
function RealtimeView() {
  const [merged,  setMerged]  = useState(null);
  const [apiOk,   setApiOk]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/data')
      .then(r => r.json())
      .then(d => {
        const ok = d.ok && hasWsHs(d.merged);
        setApiOk(ok);
        setMerged(ok ? d.merged : FALLBACK);
        setLoading(false);
      })
      .catch(() => { setMerged(FALLBACK); setApiOk(false); setLoading(false); });
  }, []);

  const last   = merged?.[merged.length - 1];
  const danger = last ? classifyDanger(last.Hs, last.Ws) : null;

  return (
    <div className="space-y-4">
      {!loading && (
        apiOk
          ? <span className="text-xs text-green-400 px-2 py-1 rounded bg-green-900/20 border border-green-800/40">
              ✅ Live API · Ws + Hs confirmed
            </span>
          : <span className="text-xs text-yellow-400 px-2 py-1 rounded bg-yellow-900/20 border border-yellow-800/40">
              ⚠️ API unavailable — simulation data
            </span>
      )}

      <div className="panel">
        <h3 className="panel-title mb-4">Last 24 Hours · Wind Speed vs Hs shifted +1 h</h3>
        {loading
          ? <div className="h-64 flex items-center justify-center text-slate-400">⏳ Loading…</div>
          : <WindWaveLagChart data={merged} />
        }
      </div>

      {last && danger && (
        <div className="rounded-xl p-4 border flex items-center gap-4"
          style={{ borderColor: danger.color + '55', background: danger.color + '0d' }}>
          <span className="text-3xl font-black" style={{ color: danger.color }}>●</span>
          <div>
            <p className="font-bold text-sm" style={{ color: danger.color }}>Latest · {danger.level}</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Hs = {last.Hs?.toFixed(3)} m · Wind = {last.Ws?.toFixed(2)} m/s
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Historical sub-component ─────────────────────────────────────────────────
function HistoricalView() {
  const [station,  setStation]  = useState('KNW08');
  const [date,     setDate]     = useState('');
  const [merged,   setMerged]   = useState(null);
  const [dates,    setDates]    = useState([]);   // all available dates for current station
  const [loading,  setLoading]  = useState(false);
  const [sliderIdx, setSlider]  = useState(0);
  const [error,    setError]    = useState('');

  // Load station → get available dates, then load most recent day
  const loadStation = useCallback(async (st) => {
    setLoading(true);
    setError('');
    setMerged(null);
    try {
      const meta = await fetch(`/api/history?station=${st}`).then(r => r.json());
      if (!meta.ok) throw new Error(meta.error || 'API error');
      const avail = meta.availableDates || [];
      setDates(avail);
      const latestDate = avail[avail.length - 1] || '';
      setDate(latestDate);
      if (latestDate) {
        const day = await fetch(`/api/history?station=${st}&date=${latestDate}`).then(r => r.json());
        if (day.ok && day.merged?.length) {
          setMerged(day.merged);
          setSlider(Math.max(0, day.merged.length - 2));
        } else {
          setError('No data for this date.');
        }
      }
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, []);

  // Load specific date for current station
  const loadDate = useCallback(async (st, dt) => {
    if (!dt) return;
    setLoading(true);
    setError('');
    try {
      const d = await fetch(`/api/history?station=${st}&date=${dt}`).then(r => r.json());
      if (d.ok && d.merged?.length) {
        setMerged(d.merged);
        setSlider(Math.max(0, d.merged.length - 2));
        if (d.availableDates?.length) setDates(d.availableDates);
      } else {
        setMerged(null);
        setError(`No data found for ${dt} on ${st}.`);
      }
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, []);

  // On mount: load default station
  useEffect(() => { loadStation('KNW08'); }, [loadStation]);

  function handleStation(st) {
    setStation(st);
    loadStation(st);
  }

  function handleDate(e) {
    const dt = e.target.value;
    setDate(dt);
    loadDate(station, dt);
  }

  // Slider maps 0…merged.length-2 (we need i+1 for Hs_shifted)
  const maxSlider  = Math.max(0, (merged?.length ?? 2) - 2);
  const safeIdx    = Math.min(sliderIdx, maxSlider);
  const row        = merged?.[safeIdx];
  const rowNext    = merged?.[safeIdx + 1];
  const sliderTime = fmtHour(row?.time);
  const danger     = row && rowNext ? classifyDanger(rowNext.Hs, row.Ws) : null;

  // Highlight label passed to chart: the formatted time label at sliderIdx
  // (matches what fmtTime() in the chart produces — UTC HH:MM)
  const highlightLabel = row ? (() => {
    try {
      const d = new Date(row.time.trim().replace(/^(\d{4}-\d{2}-\d{2}) /, '$1T'));
      const h = d.getUTCHours().toString().padStart(2, '0');
      const m = d.getUTCMinutes().toString().padStart(2, '0');
      return `${h}:${m}`;
    } catch { return null; }
  })() : null;

  const minDate = dates[0]              || '';
  const maxDate = dates[dates.length-1] || '';

  return (
    <div className="space-y-5">
      {/* ── Station picker ── */}
      <div>
        <p className="text-xs text-slate-500 mb-2 uppercase tracking-wide">Station</p>
        <div className="flex flex-wrap gap-2">
          {STATIONS.map(st => (
            <button
              key={st}
              onClick={() => handleStation(st)}
              disabled={loading}
              className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-all disabled:opacity-40 ${
                station === st
                  ? 'bg-orange-500/20 border-orange-500 text-orange-300 shadow-[0_0_10px_#f9731655]'
                  : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-300'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* ── Date picker ── */}
      <div>
        <p className="text-xs text-slate-500 mb-2 uppercase tracking-wide">Date</p>
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="date"
            value={date}
            min={minDate}
            max={maxDate}
            onChange={handleDate}
            disabled={loading || !dates.length}
            className="bg-[#0a1628] border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2
                       focus:outline-none focus:border-orange-500 disabled:opacity-40
                       [color-scheme:dark]"
          />
          {dates.length > 0 && (
            <span className="text-xs text-slate-500">
              {dates.length} dates available · {minDate} → {maxDate}
            </span>
          )}
        </div>
      </div>

      {/* ── Hour slider ── */}
      {merged && !loading && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Hour</p>
            <span className="text-sm font-mono font-bold text-orange-300">
              {sliderTime}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={maxSlider}
            value={safeIdx}
            onChange={e => setSlider(+e.target.value)}
            className="w-full accent-orange-400 cursor-pointer"
          />
          <div className="flex justify-between text-xs text-slate-600 mt-1 select-none">
            <span>{fmtHour(merged[0]?.time)}</span>
            <span>{fmtHour(merged[Math.floor(merged.length / 2)]?.time)}</span>
            <span>{fmtHour(merged[merged.length - 1]?.time)}</span>
          </div>
        </div>
      )}

      {/* ── Error / loading ── */}
      {error && (
        <div className="text-sm text-red-400 px-3 py-2 rounded-lg bg-red-900/20 border border-red-800/40">
          ⚠️ {error}
        </div>
      )}

      {/* ── Chart ── */}
      <div className="panel">
        <h3 className="panel-title mb-1">
          {station} · {date || '…'} · Wind vs Hs +1 h
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Drag the hour slider to move the marker · orange vertical line = selected hour
        </p>
        {loading
          ? <div className="h-64 flex flex-col items-center justify-center gap-2 text-slate-400">
              <span className="animate-spin text-2xl">⏳</span>
              <span className="text-sm">Loading {station} data from GitHub…</span>
            </div>
          : merged
            ? <WindWaveLagChart data={merged} highlightLabel={highlightLabel} />
            : <div className="h-64 flex items-center justify-center text-slate-500">No data</div>
        }
      </div>

      {/* ── Stats box at selected hour ── */}
      {row && rowNext && !loading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-xl p-3 border border-slate-800 bg-[#0a1628]">
            <p className="text-xs text-slate-500 mb-1">Hour</p>
            <p className="text-lg font-mono font-bold text-sky-300">{sliderTime}</p>
          </div>
          <div className="rounded-xl p-3 border border-slate-800 bg-[#0a1628]">
            <p className="text-xs text-slate-500 mb-1">💨 Wind</p>
            <p className="text-lg font-mono font-bold text-sky-300">{row.Ws?.toFixed(2)} m/s</p>
          </div>
          <div className="rounded-xl p-3 border border-slate-800 bg-[#0a1628]">
            <p className="text-xs text-slate-500 mb-1">🌊 Hs (+1 h)</p>
            <p className="text-lg font-mono font-bold text-orange-400">{rowNext.Hs?.toFixed(3)} m</p>
          </div>
          <div className="rounded-xl p-3 border flex items-center gap-2"
            style={{ borderColor: (danger?.color ?? '#334155') + '55', background: (danger?.color ?? '#334155') + '0d' }}>
            <span style={{ color: danger?.color ?? '#94a3b8' }} className="text-xl">●</span>
            <div>
              <p className="text-xs text-slate-500">Status</p>
              <p className="font-bold text-sm" style={{ color: danger?.color ?? '#94a3b8' }}>
                {danger?.level ?? '—'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main tab ────────────────────────────────────────────────────────────────
export default function WindWaveLagTab() {
  const [mode, setMode] = useState('realtime');

  return (
    <div className="space-y-6">

      {/* Explanation */}
      <div className="panel">
        <h2 className="text-base font-bold text-sky-300 mb-2">
          Why does wind NOW cause waves in 1 hour?
        </h2>
        <p className="text-sm text-slate-400 leading-relaxed">
          The <span className="text-sky-300 font-semibold">blue line</span> shows wind speed.
          The <span className="text-orange-400 font-semibold">orange line</span> is Hs shifted +1 h —
          at each x-tick you see the wind that <em>caused</em> the wave one hour later.
          Aligned curves confirm the 1-hour lag encoded in{' '}
          <span className="font-mono text-orange-400">β = 0.0069</span>.
        </p>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-3">
        <button
          onClick={() => setMode('realtime')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
            mode === 'realtime'
              ? 'bg-sky-500/20 border-sky-500 text-sky-300 shadow-[0_0_12px_#0ea5e955]'
              : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-300'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${mode === 'realtime' ? 'bg-sky-400 animate-pulse' : 'bg-slate-600'}`} />
          📡 Realtime
        </button>
        <button
          onClick={() => setMode('historical')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
            mode === 'historical'
              ? 'bg-orange-500/20 border-orange-500 text-orange-300 shadow-[0_0_12px_#f9731655]'
              : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-300'
          }`}
        >
          📅 Historical
        </button>
      </div>

      {/* Content */}
      {mode === 'realtime'   && <RealtimeView />}
      {mode === 'historical' && <HistoricalView />}

      {/* Insight cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { icon: '🌬️', title: 'Wind drives waves', sub: 'β = 0.0069',
            desc: 'U_east at time t predicts Hs at t+1. Even a small β compounds over a 12-hour forecast.' },
          { icon: '⏱️', title: '1-hour lag',         sub: 'CCF peak at lag = 1 h',
            desc: 'Cross-correlation peaks at exactly 1 h. Shifting Hs +1 h on the chart aligns it with the wind curve.' },
          { icon: '🌊', title: 'Wave inertia',       sub: 'α = 0.6634',
            desc: "Waves don't vanish when wind drops. α carries 66% of current Hs into the next hour regardless of wind." },
        ].map(c => (
          <div key={c.title} className="rounded-xl p-4 border border-slate-800 bg-[#0a1628]">
            <p className="text-2xl mb-2">{c.icon}</p>
            <p className="font-bold text-sky-300 text-sm">{c.title}</p>
            <p className="font-mono text-orange-400 text-xs mb-2">{c.sub}</p>
            <p className="text-xs text-slate-400 leading-relaxed">{c.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
