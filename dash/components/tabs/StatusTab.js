'use client';
import { useState, useCallback, useEffect } from 'react';
import CCFChart      from '@/components/charts/CCFChart';
import OriginalChart from '@/components/OriginalChart';
import CalcSteps, { buildARXSteps } from '@/components/CalcSteps';
import { computeCCF } from '@/lib/arxModel';
import { classifyDanger, windDir, uEast } from '@/lib/dangerUtils';
import { generateMockData } from '@/lib/mockData';

const fallback = generateMockData(120);

export default function StatusTab() {
  const [status,    setStatus]  = useState(null);
  const [loading,   setLoading] = useState(false);
  const [showCCF,   setShowCCF] = useState(false);
  const [realData,  setReal]    = useState(null);   // from /api/data
  const [calcSteps, setCalc]    = useState(null);
  const [arxInfo,   setArx]     = useState({ alpha: 0.6634, beta: 0.0069, gamma: 0.0153, r2: 0.718 });

  // Load GitHub data for CCF
  useEffect(() => {
    fetch('/api/data')
      .then(r => r.json())
      .then(d => { if (d.ok) { setReal(d); setArx(d.arx); } })
      .catch(() => {});
  }, []);

  const ccfData = realData?.ccf ?? computeCCF(fallback);

  const checkNow = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ims');
      const d   = await res.json();
      if (d.ok && d.ws !== null) {
        const ws   = d.ws, wd = d.wd ?? 0;
        const ue   = uEast(ws, wd);
        const hsPrev = realData?.latest?.Hs ?? 0.12;
        const hsEst  = Math.max(0, arxInfo.alpha * hsPrev + arxInfo.beta * ue + arxInfo.gamma);
        const dang   = classifyDanger(hsEst, ws);
        setStatus({ ws, wd, ue, hsEst, dang, datetime: d.datetime, live: true });
        setCalc(buildARXSteps({ ws, wd, hsPrev, alpha: arxInfo.alpha, beta: arxInfo.beta, gamma: arxInfo.gamma }));
      } else {
        // fallback
        const last = fallback[fallback.length - 1];
        const dang = classifyDanger(last.Hs, last.Ws);
        setStatus({ ws: last.Ws, wd: last.Wd, ue: last.U_east, hsEst: last.Hs, dang, datetime: last.time, live: false });
        setCalc(buildARXSteps({ ws: last.Ws, wd: last.Wd, hsPrev: last.Hs }));
      }
    } catch {
      const last = fallback[fallback.length - 1];
      setStatus({ ws: last.Ws, wd: last.Wd, ue: last.U_east, hsEst: last.Hs, dang: classifyDanger(last.Hs, last.Ws), datetime: last.time, live: false });
      setCalc(buildARXSteps({ ws: last.Ws, wd: last.Wd, hsPrev: last.Hs }));
    }
    setLoading(false);
  }, [realData, arxInfo]);

  return (
    <div className="space-y-6">
      {/* Data source badge */}
      <div className="flex items-center gap-2 text-xs text-slate-500 rounded-lg px-3 py-2 bg-[#0a1628] border border-slate-800 w-fit">
        {realData?.ok
          ? <><span className="w-2 h-2 rounded-full bg-green-500" /> GitHub data loaded · {realData.count} merged rows</>
          : <><span className="w-2 h-2 rounded-full bg-slate-600" /> Loading GitHub data…</>}
      </div>

      <div className="flex flex-wrap gap-3">
        <button onClick={checkNow} disabled={loading}
          className="px-6 py-2.5 rounded-lg font-semibold text-white bg-gradient-to-r from-[#064e7e] to-[#0ea5e9] hover:opacity-90 disabled:opacity-50 transition-all shadow-lg shadow-sky-900/40">
          {loading ? '⏳ Fetching…' : '🌊 Check Now (IMS API)'}
        </button>
        <button onClick={() => setShowCCF(v => !v)}
          className="px-6 py-2.5 rounded-lg font-semibold text-sky-300 border border-sky-700 hover:bg-sky-900/30 transition-all">
          📊 {showCCF ? 'Hide' : 'Show'} CCF Analysis
        </button>
      </div>

      {/* Live status card */}
      {status && (
        <div className="rounded-xl p-5 border space-y-4"
          style={{ borderColor: status.dang.color + '66', background: 'linear-gradient(135deg,#0a1628,#0d1f3c)' }}>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-xs text-slate-400 mb-1">
                {status.live ? '🟢 Live · Israel Meteorological Service · Station 8' : '🔵 Simulation (IMS offline)'}
                {status.datetime && <span className="ml-2 text-slate-500">{new Date(status.datetime).toLocaleString()}</span>}
              </p>
              <h3 className="text-lg font-bold text-white">Lev Kinneret — Realtime Assessment</h3>
            </div>
            <span className={`px-4 py-1.5 rounded-full text-sm font-bold ${status.dang.badge}`}
              style={{ textShadow: `0 0 8px ${status.dang.color}` }}>
              ● {status.dang.level.toUpperCase()}
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Wind Speed',      val: status.ws.toFixed(2) + ' m/s',  color: '#38bdf8' },
              { label: 'Direction',       val: `${status.wd.toFixed(0)}° ${windDir(status.wd)}`, color: '#38bdf8' },
              { label: 'U_east',          val: status.ue.toFixed(3) + ' m/s',  color: status.ue > 0 ? '#f97316' : '#94a3b8' },
              { label: 'Hs (predicted)', val: status.hsEst.toFixed(4) + ' m', color: status.dang.color },
            ].map(item => (
              <div key={item.label} className="bg-[#060e1c]/60 rounded-lg p-3 border border-slate-800">
                <p className="text-xs text-slate-400 mb-1">{item.label}</p>
                <p className="text-xl font-bold font-mono" style={{ color: item.color }}>{item.val}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Calculation steps */}
      {calcSteps && <CalcSteps steps={calcSteps} title="🔢 ARX Calculation — Step by Step" />}

      {/* CCF section */}
      {showCCF && (
        <div className="space-y-4">
          <div className="panel">
            <h3 className="panel-title">Cross-Correlation: U_east (wind) ↔ Hs (waves) — Interactive</h3>
            <p className="text-xs text-slate-400 mb-3">
              {realData?.ok ? `Computed from ${realData.count} real GitHub data rows` : 'Computed from simulation data'}
              · Peak at lag = 1 h confirms wind drives waves with a 1-hour delay
            </p>
            <CCFChart data={ccfData} />
          </div>
          <OriginalChart
            src="/charts/chart_2.png"
            title="Cross-Correlation: U_east(wind) vs Hs(waves)"
            description="Original matplotlib output from the Python notebook. Shows correlation peaking at lag = 1 h (r ≈ 0.61)."
          />
        </div>
      )}

      {/* Original regression chart — always shown */}
      <OriginalChart
        src="/charts/chart_5.png"
        title="Time-Lagged Regression: U_east(t-1) vs Hs(t)"
        description="Scatter plot of eastward wind component (1-hour lag) vs wave height. Red line = linear fit. Data from all 5 KNW buoys merged with IMS wind station."
        defaultOpen={false}
      />

      {/* ARX model summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="panel">
          <h3 className="panel-title">ARX Model — Fitted Coefficients</h3>
          <div className="space-y-2 text-sm">
            {[
              ['Formula',          'Hs(t) = α·Hs(t-1) + β·U_east(t-1) + γ'],
              ['α (AR coeff)',     arxInfo.alpha.toFixed(4)],
              ['β (wind coupling)',arxInfo.beta.toFixed(4)],
              ['γ (intercept)',    arxInfo.gamma.toFixed(4)],
              ['R² (test set)',    arxInfo.r2.toFixed(4)],
              ['Optimal lag',      '1 hour (from CCF peak)'],
              ['Train / Test',     '80% / 20% chronological'],
              ['Source',           realData?.ok ? '✅ GitHub real data' : '⚠️ Pre-fitted constants'],
            ].map(([k,v]) => (
              <div key={k} className="flex justify-between rounded px-3 py-1.5 bg-[#060e1c]/40 border border-slate-800">
                <span className="text-slate-400">{k}</span>
                <span className="text-sky-300 font-mono text-xs">{v}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="panel">
          <h3 className="panel-title">Danger Thresholds</h3>
          <div className="space-y-2 text-sm">
            {[
              { label: '🟢 Safe',    cond: 'Hs < 0.1 m  AND  Ws < 3.3 m/s',           color: '#22c55e' },
              { label: '🟡 Caution', cond: '0.1 ≤ Hs < 0.5 m  OR  3.3 ≤ Ws < 5.5 m/s', color: '#eab308' },
              { label: '🔴 Danger',  cond: 'Hs ≥ 0.5 m  OR  Ws ≥ 5.5 m/s',            color: '#dc2626' },
            ].map(t => (
              <div key={t.label} className="flex items-start gap-3 rounded-lg p-3 bg-[#060e1c]/40 border border-slate-800">
                <span className="font-bold w-20 shrink-0" style={{ color: t.color }}>{t.label}</span>
                <span className="text-slate-400 font-mono text-xs">{t.cond}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
