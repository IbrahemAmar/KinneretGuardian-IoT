'use client';
import { useState, useEffect } from 'react';
import ForecastChart   from '@/components/charts/ForecastChart';
import ScreePlot       from '@/components/charts/ScreePlot';
import FeatureImportance from '@/components/charts/FeatureImportance';
import ConfusionMatrix from '@/components/charts/ConfusionMatrix';
import OriginalChart   from '@/components/OriginalChart';
import CalcSteps       from '@/components/CalcSteps';
import { arxForecast } from '@/lib/arxModel';
import { generateMockData, RF_CONFUSION, RF_ACCURACY, FEATURE_IMPORTANCE } from '@/lib/mockData';
import { classifyDanger } from '@/lib/dangerUtils';

// Real PCA values from chart_0
const PCA_SCREE = [
  { pc: 'PC1', variance: 65.1, cumulative: 65.1 },
  { pc: 'PC2', variance: 17.5, cumulative: 82.6 },
  { pc: 'PC3', variance: 11.6, cumulative: 94.2 },
  { pc: 'PC4', variance:  5.3, cumulative: 99.5 },
  { pc: 'PC5', variance:  0.5, cumulative: 100.0 },
];

const fallback = generateMockData(120);
const last = fallback[fallback.length - 1];

const SCENARIOS = {
  base:     { label: '🟢 Base Scenario',     color: '#22c55e', desc: 'Current observed conditions' },
  storm:    { label: '🌪️ Storm Scenario',    color: '#dc2626', desc: 'Storm: U_east = 4.5 m/s' },
  recovery: { label: '🌤️ Recovery Scenario', color: '#38bdf8', desc: 'Recovery: U_east decaying to 40%' },
};

function forecastFor(scenario, latest, arx) {
  const { alpha = 0.68, beta = 0.12, gamma = 0.045 } = arx ?? {};
  const hs0 = latest?.Hs ?? last.Hs;
  const ue  = latest?.U_east ?? last.U_east;
  const uScenario = scenario === 'storm' ? 4.5 : scenario === 'recovery' ? Math.max(0, ue * 0.4) : ue;

  const pts = [{ hour: 0, Hs: hs0 }];
  for (let i = 1; i <= 12; i++) {
    const prev = pts[i-1].Hs;
    pts.push({ hour: i, Hs: Math.max(0, Math.min(1.5, alpha * prev + beta * uScenario + gamma)) });
  }
  return { pts, uEast: uScenario, hs0 };
}

function buildForecastCalc(sc, alpha, beta, gamma, hs0, uEast) {
  const t1 = alpha * hs0;
  const t2 = beta  * uEast;
  const hs1 = Math.max(0, t1 + t2 + gamma);
  return [
    {
      title: `Scenario Setup — ${SCENARIOS[sc].desc}`,
      lines: [
        `Hs₀       = ${hs0.toFixed(4)} m   (current wave height)`,
        `U_east    = ${uEast.toFixed(4)} m/s   (eastward wind component)`,
        `α = ${alpha},  β = ${beta},  γ = ${gamma}`,
      ],
    },
    {
      title: 'ARX Step t+1',
      lines: [
        `Hs(t+1) = α·Hs₀ + β·U_east + γ`,
        `        = ${alpha} × ${hs0.toFixed(4)} + ${beta} × ${uEast.toFixed(4)} + ${gamma}`,
        `        = ${t1.toFixed(4)} + ${t2.toFixed(4)} + ${gamma}`,
        `⟹ Hs(t+1) = ${hs1.toFixed(4)} m`,
      ],
    },
    {
      title: 'Iterated 12-Hour Forecast',
      lines: [
        `Each step: Hs(t+k) = α·Hs(t+k-1) + β·U_east + γ`,
        `U_east held constant throughout forecast window`,
        `⟹ Forecast converges to equilibrium: Hs* = (β·U_east + γ) / (1 - α)`,
        `⟹ Hs* = (${beta}×${uEast.toFixed(3)} + ${gamma}) / ${(1-alpha).toFixed(2)} = ${((beta*uEast+gamma)/(1-alpha)).toFixed(4)} m`,
      ],
    },
  ];
}

export default function ForecastTab() {
  const [active,   setActive]  = useState('base');
  const [forecast, setForecast] = useState(null);
  const [running,  setRunning]  = useState(false);
  const [section,  setSection]  = useState('forecast');
  const [realData, setReal]     = useState(null);

  useEffect(() => {
    fetch('/api/data').then(r=>r.json()).then(d => { if (d.ok) setReal(d); }).catch(()=>{});
  }, []);

  const arx    = realData?.arx ?? { alpha: 0.68, beta: 0.12, gamma: 0.045, r2: 0.718 };
  const latest = realData?.latest ?? null;
  const sc     = SCENARIOS[active];

  const runForecast = () => {
    setRunning(true);
    setTimeout(() => {
      const fc = forecastFor(active, latest, arx);
      const calc = buildForecastCalc(active, arx.alpha, arx.beta, arx.gamma, fc.hs0, fc.uEast);
      setForecast({ pts: fc.pts, scenario: active, uEast: fc.uEast, hs0: fc.hs0, calc });
      setRunning(false);
    }, 500);
  };

  const fcDanger = forecast ? classifyDanger(forecast.pts[forecast.pts.length-1].Hs, 0) : null;

  const SECTIONS = [
    { key: 'forecast', label: '📈 Forecast' },
    { key: 'pca',      label: '🔬 PCA' },
    { key: 'rf',       label: '🤖 Random Forest' },
  ];

  return (
    <div className="space-y-6">
      {realData?.ok && (
        <div className="text-xs text-green-400 rounded-lg px-3 py-2 bg-green-900/20 border border-green-800/40 w-fit">
          ✅ Real GitHub data loaded · {realData.count} rows · ARX R² = {arx.r2.toFixed(3)}
        </div>
      )}

      <div className="flex gap-2 border-b border-slate-800 pb-1">
        {SECTIONS.map(s => (
          <button key={s.key} onClick={() => setSection(s.key)}
            className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition-all ${
              section === s.key ? 'bg-sky-900/40 text-sky-300 border-b-2 border-sky-500' : 'text-slate-400 hover:text-slate-200'
            }`}>
            {s.label}
          </button>
        ))}
      </div>

      {/* ── FORECAST ── */}
      {section === 'forecast' && (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            {Object.entries(SCENARIOS).map(([k,s]) => (
              <button key={k} onClick={() => { setActive(k); setForecast(null); }}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  active === k ? 'text-white' : 'border border-slate-700 text-slate-400 hover:border-slate-500'
                }`}
                style={active===k ? { background: s.color+'33', border:`1px solid ${s.color}88` } : {}}>
                {s.label}
              </button>
            ))}
          </div>

          <div className="panel">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
              <p className="text-sm text-slate-400">{sc.desc} · Using {realData?.ok ? 'real GitHub' : 'simulation'} data</p>
              <button onClick={runForecast} disabled={running}
                className="px-5 py-2 rounded-lg text-sm font-bold text-white transition-all disabled:opacity-50"
                style={{ background: running ? '#374151' : `linear-gradient(135deg,${sc.color}88,${sc.color})` }}>
                {running ? '⏳ Running…' : '▶ Run Forecast'}
              </button>
            </div>

            {forecast?.scenario === active && (
              <div className="space-y-4">
                {fcDanger && (
                  <div className="flex items-center gap-3 rounded-lg p-3 border"
                    style={{ borderColor: fcDanger.color+'55', background: fcDanger.color+'11' }}>
                    <span className="text-2xl font-black" style={{ color: fcDanger.color }}>●</span>
                    <div>
                      <p className="font-bold" style={{ color: fcDanger.color }}>{fcDanger.level} in 12 hours</p>
                      <p className="text-xs text-slate-400">Hs(t+12) = {forecast.pts[12].Hs.toFixed(4)} m</p>
                    </div>
                    <div className="ml-auto text-xs font-mono text-slate-400 text-right hidden md:block">
                      α={arx.alpha.toFixed(3)} · β={arx.beta.toFixed(3)} · γ={arx.gamma.toFixed(3)} · R²={arx.r2.toFixed(3)}
                    </div>
                  </div>
                )}
                {/* Interactive forecast chart */}
                <ForecastChart data={forecast.pts} title={`${SCENARIOS[forecast.scenario].label} — 12-Hour Forecast (Interactive)`} />
                {/* Calculation steps */}
                {forecast.calc && <CalcSteps steps={forecast.calc} title="🔢 Forecast Calculations" />}
              </div>
            )}
          </div>

          {/* Original Python forecast chart */}
          <OriginalChart
            src="/charts/chart_3.png"
            title="12-Hour Wave Forecast"
            description="Original Python/matplotlib output. ARX model forecast with Safe / Caution / Danger zone bands. Forecast starts from actual data point."
            defaultOpen={true}
          />
        </div>
      )}

      {/* ── PCA ── */}
      {section === 'pca' && (
        <div className="space-y-4">
          <div className="panel">
            <h3 className="panel-title">PCA — Variables: Ws, U_wind, V_wind, U_east, Hs</h3>
            <div className="grid grid-cols-5 gap-2 mb-4">
              {PCA_SCREE.map(p => (
                <div key={p.pc} className="text-center rounded-lg p-2 bg-[#060e1c]/50 border border-slate-800">
                  <p className="text-xs text-slate-400">{p.pc}</p>
                  <p className="text-lg font-bold text-sky-400">{p.variance}%</p>
                  <p className="text-xs text-slate-500">↑{p.cumulative}%</p>
                </div>
              ))}
            </div>
            <ScreePlot data={PCA_SCREE} />
          </div>

          {/* Original scree plot */}
          <OriginalChart
            src="/charts/chart_0.png"
            title="Scree Plot (Explained Variance)"
            description="PC1 explains 65.1% of variance — dominated by U_east and U_wind. PC2 adds 17.5% (V_wind component). Together they capture 82.6% of the variability in the wind-wave system."
          />

          {/* Original PCA biplot */}
          <OriginalChart
            src="/charts/chart_1.png"
            title="PCA Biplot — PC1 (65.1%) vs PC2 (17.5%)"
            description="Red arrows = variable loadings. U_east and Hs point in the same direction along PC1 — confirming that eastward wind drives wave height. U_wind and V_wind are nearly orthogonal (perpendicular)."
          />

          <div className="panel">
            <h3 className="panel-title">PCA Interpretation</h3>
            <div className="space-y-2 text-sm">
              {[
                ['PC1 (65.1%)', 'Dominated by U_east and Hs — the wind-wave coupling axis. High PC1 = high eastward wind AND high wave height.'],
                ['PC2 (17.5%)', 'Captures V_wind (north-south component) independently. Represents cross-lake wind patterns.'],
                ['PC3 (11.6%)', 'Residual variance — local gusts, measurement noise, seiche effects.'],
                ['Biplot arrows','U_east → Hs alignment confirms the 1-hour lag relationship used in the ARX model.'],
              ].map(([k,v]) => (
                <div key={k} className="rounded-lg p-3 bg-[#060e1c]/40 border border-slate-800">
                  <span className="font-bold text-sky-300">{k}: </span>
                  <span className="text-slate-300">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── RANDOM FOREST ── */}
      {section === 'rf' && (
        <div className="space-y-4">
          <div className="panel">
            <h3 className="panel-title">RF Config · 100 trees · max_depth=5 · balanced weights</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              {[['Trees','100'],['Max Depth','5'],['Features','Ws, U_wind, V_wind, U_east'],['Classes','0=Safe, 1=Caution, 2=Danger'],
                ['Split','80% / 20%'],['Class weights','balanced'],['Accuracy',`${RF_ACCURACY}%`],['ARX R²',arx.r2.toFixed(3)]
              ].map(([k,v]) => (
                <div key={k} className="rounded-lg p-3 bg-[#060e1c]/50 border border-slate-800">
                  <p className="text-xs text-slate-400">{k}</p>
                  <p className="text-sky-300 font-mono font-bold text-sm">{v}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="panel"><FeatureImportance data={FEATURE_IMPORTANCE} /></div>
            <div className="panel"><ConfusionMatrix matrix={RF_CONFUSION} accuracy={RF_ACCURACY} /></div>
          </div>
        </div>
      )}
    </div>
  );
}
