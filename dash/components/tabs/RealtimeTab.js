'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { classifyDanger, windDir, uEast as computeUEast } from '@/lib/dangerUtils';
import { generateMockData, STATIONS } from '@/lib/mockData';

const KinneretMap = dynamic(() => import('@/components/KinneretMap'), { ssr: false });

const FALLBACK = generateMockData(200);

function buildStations(ws, ue, baseHs) {
  const res = {};
  STATIONS.forEach(st => {
    res[st.key] = {
      ws:  ws  * st.scale,
      ue:  ue  * st.scale,
      hs:  Math.max(0, baseHs * st.scale + (Math.random() - 0.5) * 0.008),
    };
  });
  return res;
}

// Parse a time string (Excel export or ISO) into a display-friendly { date, hour, iso }
function parseRowTime(raw) {
  if (!raw) return { date: '—', hour: '—', iso: '—', obj: null };
  try {
    let d;
    const num = Number(raw);
    // Excel serial date: a plain number in the range covering years ~2009-2070
    if (!isNaN(num) && num > 40000 && num < 62000) {
      d = new Date((num - 25569) * 86400000);
    } else {
      // Normalize "YYYY-MM-DD HH:MM:SS" (space separator) to ISO "T" separator
      const normalized = typeof raw === 'string' ? raw.trim().replace(/^(\d{4}-\d{2}-\d{2}) /, '$1T') : raw;
      d = new Date(normalized);
    }
    if (isNaN(d.getTime())) return { date: String(raw), hour: '—', iso: String(raw), obj: null };
    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const pad  = n => String(n).padStart(2, '0');
    const date = `${pad(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    const hour = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    const iso  = d.toISOString();
    return { date, hour, iso, obj: d };
  } catch {
    return { date: String(raw), hour: '—', iso: String(raw), obj: null };
  }
}

export default function RealtimeTab() {
  const [source,    setSource]   = useState('historical');
  const [speed,     setSpeed]    = useState(1);
  const [playing,   setPlaying]  = useState(false);
  const [histIdx,   setHistIdx]  = useState(0);
  const [realRows,  setRealRows] = useState([]);
  const [data,      setData]     = useState(null);
  const [stations,  setStations] = useState({});
  const [arxInfo,   setArx]      = useState({ alpha: 0.6634, beta: 0.0069, gamma: 0.0153, r2: 0.718 });
  const [apiStatus, setApiSt]    = useState('idle');      // idle | ok | error | loading
  const [lastTick,  setLastTick] = useState(null);        // wall-clock time of last tick
  const [imsDatetime, setImsDatetime] = useState(null);   // datetime from IMS API response
  const timerRef  = useRef(null);
  const prevHsRef = useRef(0.12);

  // Load real GitHub data on mount
  useEffect(() => {
    fetch('/api/data').then(r => r.json()).then(d => {
      if (d.ok && d.merged?.length) {
        setRealRows(d.merged);
        setHistIdx(d.merged.length - 1); // start at the most recent row
        setArx(d.arx);
      }
    }).catch(() => {});
  }, []);

  const dataset  = realRows.length > 0 ? realRows : FALLBACK;
  const totalRows = dataset.length;

  // Step through history manually
  const goNext = useCallback(() => {
    setHistIdx(i => Math.min(i + 1, totalRows - 1));
  }, [totalRows]);

  const goPrev = useCallback(() => {
    setHistIdx(i => Math.max(i - 1, 0));
  }, []);

  // Compute display data whenever histIdx changes (historical mode)
  useEffect(() => {
    if (source !== 'historical') return;
    const row = dataset[histIdx];
    if (!row) return;
    const { alpha, beta, gamma } = arxInfo;
    const hs   = row.Hs   ?? 0.12;
    const ws   = row.Ws   ?? 3.2;
    const ue   = row.U_east ?? 0;
    const wd   = row.Wd   ?? 0;
    const hsFc = Math.max(0, alpha * hs + beta * ue + gamma);
    const dang  = classifyDanger(hs, ws);
    setData({ ws, wd, ue, hs, hsFc, dang, rawTime: row.time, live: false });
    setStations(buildStations(ws, ue, hs));
  }, [histIdx, source, dataset, arxInfo]);

  // Auto-play tick
  const tick = useCallback(async () => {
    const now = new Date();
    setLastTick(now);
    const { alpha, beta, gamma } = arxInfo;

    if (source === 'live') {
      setApiSt('loading');
      try {
        const res = await fetch('/api/ims');
        const d   = await res.json();
        if (d.ok && d.ws !== null) {
          const ws  = d.ws, wd = d.wd ?? 0;
          const ue  = computeUEast(ws, wd);
          const hs  = Math.max(0, alpha * prevHsRef.current + beta * ue + gamma);
          const hsFc= Math.max(0, alpha * hs + beta * ue + gamma);
          prevHsRef.current = hs;
          const dang = classifyDanger(hs, ws);
          setImsDatetime(d.datetime ?? null);
          setData({ ws, wd, ue, hs, hsFc, dang, rawTime: d.datetime, live: true });
          setStations(buildStations(ws, ue, hs));
          setApiSt('ok');
          return;
        }
      } catch { /* fall through to fallback */ }
      setApiSt('error');
      // fall through to historical as backup
    }

    // Historical auto-advance
    setHistIdx(i => (i + speed) % totalRows);
  }, [source, speed, arxInfo, totalRows]);

  // Timer management
  useEffect(() => {
    if (playing) {
      timerRef.current = setInterval(tick, 2000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [playing, tick]);

  const dang = data?.dang;
  const rawTimeForDisplay = data?.rawTime ?? dataset[histIdx]?.time;
  const ts   = parseRowTime(rawTimeForDisplay);
  const lastTickTs = lastTick ? lastTick.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit', second:'2-digit' }) : '—';

  // Computed DIRECTLY from the dataset row — never null, doesn't wait for data state
  const sliderTs   = parseRowTime(dataset[histIdx]?.time);
  const firstRowTs = parseRowTime(dataset[0]?.time);
  const midRowTs   = parseRowTime(dataset[Math.floor((totalRows - 1) / 2)]?.time);
  const lastRowTs  = parseRowTime(dataset[totalRows - 1]?.time);

  return (
    <div className="space-y-5">

      {/* ── BIG TIMESTAMP DISPLAY ── */}
      <div className={`rounded-xl border px-5 py-4 transition-all ${
        source === 'live' && data?.live
          ? 'border-red-700/50 bg-red-950/20'
          : 'border-sky-900/40 bg-[#0a1628]'
      }`}>
        <div className="flex flex-wrap items-center justify-between gap-4">

          {/* Date + Hour */}
          <div className="flex items-center gap-6">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">
                {source === 'live' ? '🟢 IMS Measurement Time' : `🔵 Historical Record ${histIdx + 1} / ${totalRows}`}
              </p>
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">📅</span>
                  <span className="text-xl font-bold text-white font-mono">{ts.date}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🕐</span>
                  <span className="text-3xl font-black font-mono" style={{ color: '#38bdf8', textShadow: '0 0 16px #0ea5e988' }}>
                    {ts.hour}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Status + last tick */}
          <div className="text-right space-y-1">
            <div className="flex items-center gap-2 justify-end">
              <span className={`w-2.5 h-2.5 rounded-full ${playing ? 'bg-red-500 animate-pulse' : 'bg-slate-600'}`} />
              <span className="text-sm font-bold" style={{ color: playing ? '#f87171' : '#64748b' }}>
                {playing ? (source === 'live' ? 'LIVE' : 'PLAYING') : 'PAUSED'}
              </span>
              {source === 'live' && apiStatus === 'ok'    && <span className="text-xs text-green-400 border border-green-800 rounded px-1.5 py-0.5">IMS OK</span>}
              {source === 'live' && apiStatus === 'error' && <span className="text-xs text-red-400 border border-red-800 rounded px-1.5 py-0.5">IMS ERR</span>}
            </div>
            {lastTick && (
              <p className="text-xs text-slate-500 font-mono">
                Last tick: <span className="text-slate-300">{lastTickTs}</span>
              </p>
            )}
            {source === 'live' && imsDatetime && (
              <p className="text-xs text-slate-500 font-mono">
                IMS datetime: <span className="text-green-400">{parseRowTime(imsDatetime).hour}</span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── CONTROLS ── */}
      <div className="flex flex-wrap gap-3 items-center">

        {/* Source toggle */}
        <div className="flex rounded-lg overflow-hidden border border-slate-700">
          {[{ key:'historical', label:'🔵 Historical'}, {key:'live', label:'🟢 Live IMS'}].map(opt => (
            <button key={opt.key}
              onClick={() => { setSource(opt.key); setData(null); setApiSt('idle'); setLastTick(null); setImsDatetime(null); setPlaying(false); }}
              className={`px-4 py-2 text-xs font-semibold transition-all ${
                source === opt.key ? 'bg-sky-900 text-sky-200' : 'text-slate-400 hover:bg-slate-800'
              }`}>
              {opt.label}
            </button>
          ))}
        </div>

        {/* Play / Stop */}
        <button onClick={() => { setPlaying(v => !v); if (!playing) tick(); }}
          className={`px-5 py-2 rounded-lg font-bold text-sm transition-all ${
            playing
              ? 'bg-gradient-to-r from-red-900 to-red-700 text-white'
              : 'bg-gradient-to-r from-[#064e7e] to-[#0ea5e9] text-white'
          }`}>
          {playing ? '⏹ Stop' : '▶ Play'}
        </button>

        {/* Manual tick */}
        <button onClick={tick}
          className="px-4 py-2 rounded-lg text-sm font-semibold border border-slate-700 text-slate-300 hover:border-sky-700">
          🔄 Tick
        </button>

        {/* Prev / Next — only in historical */}
        {source === 'historical' && (
          <div className="flex items-center gap-1 rounded-lg border border-slate-700 overflow-hidden">
            <button onClick={goPrev} disabled={histIdx <= 0}
              className="px-4 py-2 text-sm font-bold text-slate-300 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
              ← Prev
            </button>
            <span className="px-3 py-2 text-xs font-mono text-slate-500 border-x border-slate-700 bg-[#060e1c]/60">
              {histIdx + 1}/{totalRows}
            </span>
            <button onClick={goNext} disabled={histIdx >= totalRows - 1}
              className="px-4 py-2 text-sm font-bold text-slate-300 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
              Next →
            </button>
          </div>
        )}

        {/* Speed (auto-play only) */}
        {source === 'historical' && (
          <div className="flex items-center gap-3 ml-auto">
            <span className="text-xs text-slate-400 shrink-0">Auto speed ×{speed}</span>
            <input type="range" min={1} max={20} value={speed}
              onChange={e => setSpeed(+e.target.value)}
              className="w-28 accent-sky-500" />
          </div>
        )}
      </div>

      {/* ── t-AXIS TIMELINE SLIDER ── */}
      {source === 'historical' && totalRows > 0 && (
        <div className="rounded-xl border border-sky-900/40 bg-[#0a1628] px-5 py-5 space-y-5">

          {/* ── Current date + time — BIG, from the data file directly ── */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 border-b border-slate-800 pb-5">
            <div className="flex-1">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-3">
                📍 You are viewing this historical record
              </p>
              <div className="flex items-center gap-6 flex-wrap">
                {/* DATE */}
                <div>
                  <p className="text-[10px] text-slate-500 uppercase mb-1">Date</p>
                  <p className="text-2xl font-bold text-white leading-none">{sliderTs.date}</p>
                </div>
                {/* divider */}
                <div className="hidden sm:block w-px h-10 bg-slate-700" />
                {/* TIME */}
                <div>
                  <p className="text-[10px] text-slate-500 uppercase mb-1">Time</p>
                  <p
                    className="text-5xl font-black font-mono leading-none"
                    style={{ color: '#38bdf8', textShadow: '0 0 20px #0ea5e966' }}
                  >
                    {sliderTs.hour}
                  </p>
                </div>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[10px] text-slate-500 uppercase mb-1">Record</p>
              <p className="font-mono text-slate-300 text-sm">
                {histIdx + 1} <span className="text-slate-600">of</span> {totalRows}
              </p>
            </div>
          </div>

          {/* ── Slider with floating badge ── */}
          <div className="relative pt-11">
            {/* Floating badge that tracks the thumb */}
            <div
              className="absolute top-0 pointer-events-none"
              style={{
                left: `${(histIdx / Math.max(totalRows - 1, 1)) * 100}%`,
                transform: 'translateX(-50%)',
              }}
            >
              <div
                className="rounded-lg text-center px-3 py-1.5 shadow-xl whitespace-nowrap"
                style={{ background: '#0c1f3a', border: '1px solid #0ea5e9aa' }}
              >
                <p className="text-sky-300 font-mono font-bold text-sm leading-none">
                  {sliderTs.hour}
                </p>
                <p className="text-slate-400 text-[10px] mt-0.5 leading-none">
                  {sliderTs.date}
                </p>
                <div
                  className="absolute left-1/2 -translate-x-1/2 -bottom-[7px]"
                  style={{
                    width: 0, height: 0,
                    borderLeft:  '6px solid transparent',
                    borderRight: '6px solid transparent',
                    borderTop:   '7px solid #0ea5e9aa',
                  }}
                />
              </div>
            </div>

            <input
              type="range"
              min={0}
              max={totalRows - 1}
              value={histIdx}
              onChange={e => {
                setHistIdx(+e.target.value);
                setPlaying(false);
              }}
              className="w-full accent-sky-500 cursor-pointer"
            />
          </div>

          {/* ── Timeline axis anchors ── */}
          <div className="flex justify-between pt-1">
            {[
              [firstRowTs, 'text-left'],
              [midRowTs,   'text-center hidden sm:block'],
              [lastRowTs,  'text-right'],
            ].map(([t, align], i) => (
              <div key={i} className={align}>
                <p className="text-[10px] text-slate-500 leading-snug">{t.date}</p>
                <p className="text-[10px] text-sky-700 font-mono font-semibold leading-snug">{t.hour}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ARX info bar */}
      <div className="text-xs font-mono text-slate-500 rounded-lg px-4 py-2 bg-[#060e1c]/60 border border-slate-800 flex flex-wrap gap-4">
        <span className="text-sky-400 font-bold">ARX</span>
        <span>α={arxInfo.alpha.toFixed(4)}</span>
        <span>β={arxInfo.beta.toFixed(4)}</span>
        <span>γ={arxInfo.gamma.toFixed(4)}</span>
        <span>R²={arxInfo.r2.toFixed(4)}</span>
        <span className="text-slate-700">|</span>
        <span className="text-green-600">IMS key from .env.local ✓</span>
        <span className="text-slate-700">|</span>
        <span>{realRows.length > 0 ? `GitHub data: ${totalRows} rows` : 'Simulation data'}</span>
      </div>

      {/* ── MAIN GRID: Map + Metrics ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Map */}
        <div className="lg:col-span-2 rounded-xl overflow-hidden border border-sky-900/40">
          <KinneretMap stationData={stations} />
        </div>

        {/* Metrics */}
        <div className="space-y-3">
          {data ? (
            <>
              {/* Danger + metrics card */}
              <div className="rounded-xl p-4 border"
                style={{ borderColor: dang?.color+'66', background:'linear-gradient(135deg,#0a1628,#0d1f3c)' }}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="text-xs text-slate-400 block">{data.live ? '🟢 Live · Station 8' : '🔵 Historical'}</span>
                    <span className="text-xs font-mono text-slate-500">{ts.date}</span>
                  </div>
                  <span className="font-black text-2xl" style={{ color: dang?.color, textShadow:`0 0 16px ${dang?.color}` }}>
                    {dang?.level}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label:'Hs (now)',    val: data.hs.toFixed(4)+' m',   c: dang?.color },
                    { label:'Hs (t+1)',    val: data.hsFc.toFixed(4)+' m', c: '#f97316' },
                    { label:'Wind speed',  val: data.ws.toFixed(2)+' m/s', c: '#38bdf8' },
                    { label:'U_east',      val: data.ue.toFixed(3)+' m/s', c: data.ue>0?'#f97316':'#94a3b8' },
                    { label:'Direction',   val: `${data.wd.toFixed(0)}° ${windDir(data.wd)}`, c: '#94a3b8' },
                    { label:'Hour',        val: ts.hour, c: '#38bdf8' },
                  ].map(m => (
                    <div key={m.label} className="rounded-lg p-2 bg-[#060e1c]/60 border border-slate-800">
                      <p className="text-xs text-slate-500">{m.label}</p>
                      <p className="font-mono font-bold text-sm" style={{ color: m.c }}>{m.val}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Live ARX box */}
              <div className="rounded-lg p-4 bg-[#060e1c]/70 border border-sky-900/40 font-mono text-xs space-y-1">
                <p className="text-sky-400 font-bold text-sm mb-2">⚡ ARX — {ts.date} {ts.hour}</p>
                <p className="text-slate-400">Hs(t+1) = {arxInfo.alpha} × {data.hs.toFixed(4)}</p>
                <p className="text-slate-400 pl-12">+ {arxInfo.beta} × {data.ue.toFixed(4)}</p>
                <p className="text-slate-400 pl-12">+ {arxInfo.gamma}</p>
                <div className="border-t border-slate-700 mt-2 pt-2 space-y-0.5">
                  <p className="text-slate-500">= {(arxInfo.alpha * data.hs).toFixed(4)}</p>
                  <p className="text-slate-500">+ {(arxInfo.beta  * data.ue).toFixed(4)}</p>
                  <p className="text-slate-500">+ {arxInfo.gamma}</p>
                  <p className="text-emerald-400 font-bold text-sm mt-1">= {data.hsFc.toFixed(4)} m</p>
                </div>
                <div className="border-t border-slate-700 mt-2 pt-2">
                  <p style={{ color: dang?.color }} className="font-bold">→ {dang?.level}</p>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-xl p-8 border border-slate-800 bg-[#060e1c]/40 flex flex-col items-center justify-center gap-4 h-full min-h-[320px]">
              <div className="w-16 h-16 rounded-full border-2 border-sky-800 flex items-center justify-center text-3xl">🌊</div>
              <p className="text-sm text-slate-400 text-center">Press ▶ Play or use ← → to navigate</p>
              <p className="text-xs text-slate-600 text-center">{realRows.length > 0 ? `${totalRows} real rows loaded from GitHub` : 'Loading GitHub data…'}</p>
            </div>
          )}
        </div>
      </div>

      {/* Station mini-cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {STATIONS.map(st => {
          const sd = stations[st.key] ?? {};
          const d  = classifyDanger(sd.hs??0, sd.ws??0);
          return (
            <div key={st.key} className="rounded-lg p-3 border transition-all"
              style={{ borderColor: d.color+'44', background:'#0a162888' }}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-slate-300 font-medium">{st.name}</span>
                <span className="text-xs font-bold" style={{color:d.color}}>●</span>
              </div>
              <p className="font-mono text-sm font-bold" style={{color:d.color}}>{(sd.hs??0).toFixed(3)} m</p>
              <p className="font-mono text-xs text-sky-400">{(sd.ws??0).toFixed(2)} m/s</p>
              <p className="font-mono text-xs text-slate-600">×{st.scale}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
