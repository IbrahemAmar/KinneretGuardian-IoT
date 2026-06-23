'use client';
import { useState, useMemo, useEffect } from 'react';
import dynamic from 'next/dynamic';
import OriginalChart from '@/components/OriginalChart';
import { generateMockData, STATIONS } from '@/lib/mockData';
import { classifyDanger } from '@/lib/dangerUtils';

const KinneretMap = dynamic(() => import('@/components/KinneretMap'), { ssr: false });
const fallback = generateMockData(120);

function buildStationData(row) {
  const result = {};
  STATIONS.forEach(st => {
    const ws  = (row?.Ws      ?? 3.5) * st.scale;
    const ue  = (row?.U_east  ?? 0.8) * st.scale;
    const hs  = Math.max(0, (row?.Hs ?? 0.12) * st.scale + (Math.random() - 0.5) * 0.005);
    result[st.key] = { ws, ue, hs };
  });
  return result;
}

export default function SpatialTab() {
  const [timeIdx,  setTimeIdx]  = useState(fallback.length - 1);
  const [viewMode, setViewMode] = useState('danger');
  const [realData, setReal]     = useState(null);

  useEffect(() => {
    fetch('/api/data').then(r=>r.json()).then(d => { if (d.ok) setReal(d); }).catch(()=>{});
  }, []);

  const dataset    = realData?.merged ?? fallback;
  const totalRows  = dataset.length;
  const safeIdx    = Math.min(timeIdx, totalRows - 1);
  const currentRow = dataset[safeIdx];

  const stationData = useMemo(() => buildStationData(currentRow), [safeIdx, realData]);

  const timeLabel = currentRow?.time
    ? (realData?.ok ? String(currentRow.time) : new Date(currentRow.time).toLocaleString())
    : '';

  return (
    <div className="space-y-6">
      {realData?.ok && (
        <div className="text-xs text-green-400 rounded-lg px-3 py-2 bg-green-900/20 border border-green-800/40 w-fit">
          ✅ Real GitHub data · {totalRows} rows · Scroll the slider to replay history
        </div>
      )}

      <div className="flex flex-wrap gap-6 items-center">
        <div className="flex-1 min-w-[220px]">
          <label className="text-xs text-slate-400 block mb-1">
            Time — <span className="text-sky-400 font-mono">{timeLabel}</span>
          </label>
          <input type="range" min={0} max={totalRows - 1} value={safeIdx}
            onChange={e => setTimeIdx(+e.target.value)}
            className="w-full accent-sky-500" />
          <div className="flex justify-between text-xs text-slate-600 mt-1">
            <span>Oldest</span><span>Latest</span>
          </div>
        </div>
        <div className="flex gap-2">
          {[{ key:'danger', label:'🔴 Danger Index'}, {key:'wind', label:'💨 Wind Field'}].map(opt => (
            <button key={opt.key} onClick={() => setViewMode(opt.key)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                viewMode === opt.key
                  ? 'bg-sky-600 text-white shadow-lg shadow-sky-900/40'
                  : 'border border-slate-700 text-slate-400 hover:border-sky-700 hover:text-sky-300'
              }`}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Leaflet map */}
      <div className="rounded-xl overflow-hidden border border-sky-900/40 shadow-xl shadow-sky-950/50">
        <KinneretMap stationData={stationData} />
      </div>

      {/* Station cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        {STATIONS.map(st => {
          const sd   = stationData[st.key] ?? {};
          const dang = classifyDanger(sd.hs ?? 0, sd.ws ?? 0);
          return (
            <div key={st.key} className="rounded-xl p-4 border transition-all"
              style={{ borderColor: dang.color+'55', background: 'linear-gradient(135deg,#0a1628,#0d1f3c)' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-300 font-semibold">{st.name}</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ color: dang.color, border:`1px solid ${dang.color}66` }}>
                  {dang.level}
                </span>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Hs</span>
                  <span className="font-mono font-bold" style={{color:dang.color}}>{(sd.hs??0).toFixed(3)} m</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Wind</span>
                  <span className="font-mono text-sky-400">{(sd.ws??0).toFixed(2)} m/s</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Scale ×{st.scale}</span>
                  <span className="font-mono text-slate-500">U_east {(sd.ue??0).toFixed(2)}</span>
                </div>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div className="h-full rounded-full transition-all"
                  style={{ width:`${Math.min(100,(sd.hs??0)/1.2*100)}%`, backgroundColor:dang.color }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Original Kriging map */}
      <OriginalChart
        src="/charts/chart_4.png"
        title="Spatial Interpolation Map (Ordinary Kriging)"
        description="Original Python/matplotlib + pykrige output. U_east wind component interpolated over Lake Kinneret using UTM coordinates (EPSG:32636). Viridis colormap. Station locations shown as red dots."
        defaultOpen={false}
      />
    </div>
  );
}
