'use client';
import { useState, useRef, useEffect } from 'react';
import FeatureImportance from '@/components/charts/FeatureImportance';
import ConfusionMatrix   from '@/components/charts/ConfusionMatrix';

// Each tree gets a random "dominant vote" color — purely decorative, simulates the ensemble voting
function makeTreeColors() {
  return Array.from({ length: 100 }, () => {
    const r = Math.random();
    return r < 0.55 ? 'safe' : r < 0.82 ? 'caution' : 'danger';
  });
}

const VOTE_STYLE = {
  safe:    { bg: '#052e16', border: '#16a34a', glow: '#16a34a' },
  caution: { bg: '#422006', border: '#ca8a04', glow: '#ca8a04' },
  danger:  { bg: '#450a0a', border: '#b91c1c', glow: '#b91c1c' },
};

const STAGES = [
  { from: 0,  to: 8,   icon: '📂', short: 'Parse',    label: 'Parsing file…' },
  { from: 8,  to: 20,  icon: '🏷️', short: 'Label',    label: 'Labeling rows → Safe / Caution / Danger…' },
  { from: 20, to: 92,  icon: '🌲', short: 'Train',    label: null }, // dynamic
  { from: 92, to: 101, icon: '📊', short: 'Evaluate', label: 'Computing accuracy & importances…' },
];

function getStageIdx(count) {
  for (let i = 0; i < STAGES.length; i++) {
    if (count >= STAGES[i].from && count < STAGES[i].to) return i;
  }
  return STAGES.length - 1;
}

// ── Forest Grid ─────────────────────────────────────────────────────────────
function ForestGrid({ treeCount, treeColors }) {
  const si    = getStageIdx(treeCount);
  const stage = STAGES[si];
  const label = si === 2
    ? `Growing forest… tree ${Math.min(treeCount, 100)} / 100`
    : stage.label;

  const safeCnt    = treeColors.slice(0, treeCount).filter(c => c === 'safe').length;
  const cautionCnt = treeColors.slice(0, treeCount).filter(c => c === 'caution').length;
  const dangerCnt  = treeColors.slice(0, treeCount).filter(c => c === 'danger').length;

  return (
    <div className="space-y-4">

      {/* Stage label + progress bar */}
      <div className="flex items-center gap-3 rounded-xl p-4 border border-slate-700/60 bg-[#060e1c]/80">
        <span className="text-xl shrink-0">{stage.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-sky-300 truncate">{label}</p>
          <div className="h-1.5 mt-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${treeCount}%`,
                background: 'linear-gradient(90deg,#0ea5e9,#38bdf8)',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        </div>
        {/* Animated pulse dots */}
        <div className="flex gap-1 shrink-0">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse"
              style={{ animationDelay: `${i * 0.28}s` }}
            />
          ))}
        </div>
      </div>

      {/* 10×10 tree grid */}
      <div className="rounded-xl border border-slate-800 bg-[#030b18] p-5">
        <p className="text-xs text-slate-500 mb-4 text-center tracking-widest uppercase">
          Random Forest — 100 Decision Trees
        </p>
        <div
          className="mx-auto"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 30px)', gap: '5px', width: 'fit-content' }}
        >
          {treeColors.map((vote, i) => {
            const grown = i < treeCount;
            const s     = VOTE_STYLE[vote];
            return (
              <div
                key={i}
                title={grown ? `Tree ${i + 1} · votes ${vote}` : `Tree ${i + 1} · not grown yet`}
                style={{
                  width:      '30px',
                  height:     '30px',
                  borderRadius: '6px',
                  display:    'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize:   '16px',
                  background:  grown ? s.bg   : '#0a1628',
                  border:     `1px solid ${grown ? s.border : '#1e293b'}`,
                  boxShadow:  grown ? `0 0 8px ${s.glow}44` : 'none',
                  opacity:    grown ? 1 : 0.2,
                  transform:  grown ? 'scale(1)' : 'scale(0.7)',
                  // Spring bounce easing makes each tree "pop" in
                  transition: 'all 0.35s cubic-bezier(0.34,1.56,0.64,1)',
                  transitionDelay: `${(i % 8) * 18}ms`,
                }}
              >
                🌲
              </div>
            );
          })}
        </div>

        {/* Live vote tally */}
        <div className="flex justify-center gap-6 mt-4">
          {[
            ['safe',    '#4ade80', safeCnt,    'Safe'],
            ['caution', '#fbbf24', cautionCnt, 'Caution'],
            ['danger',  '#f87171', dangerCnt,  'Danger'],
          ].map(([key, color, count, label]) => (
            <div key={key} className="text-center">
              <p className="text-base font-black" style={{ color }}>{count}</p>
              <p className="text-xs text-slate-500">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Stage pipeline */}
      <div className="grid grid-cols-4 gap-2">
        {STAGES.map((s, i) => {
          const done   = si > i;
          const active = si === i;
          return (
            <div
              key={i}
              className={`rounded-lg p-2.5 text-center text-xs border transition-all duration-500 ${
                done   ? 'border-sky-700/50 bg-sky-900/20 text-sky-300' :
                active ? 'border-sky-500/60 bg-sky-900/30 text-sky-200' :
                         'border-slate-800   bg-[#060e1c]/40 text-slate-600'
              }`}
            >
              <p className="text-lg">{done ? '✅' : s.icon}</p>
              <p className="mt-1 font-semibold">{s.short}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function TrainTab({ onModelTrained }) {
  const [file,       setFile]       = useState(null);
  const [dragging,   setDragging]   = useState(false);
  const [status,     setStatus]     = useState('idle');   // idle | training | done | error
  const [result,     setResult]     = useState(null);
  const [error,      setError]      = useState('');
  const [treeCount,  setTreeCount]  = useState(0);
  const [treeColors, setTreeColors] = useState(makeTreeColors);
  const [dlStation,  setDlStation]  = useState('KNW09');
  const [dlBusy,     setDlBusy]     = useState(false);
  const inputRef    = useRef(null);
  const intervalRef = useRef(null);

  useEffect(() => () => clearInterval(intervalRef.current), []);

  function handleFileDrop(e) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer?.files?.[0] ?? e.target?.files?.[0];
    if (f) { setFile(f); setResult(null); setStatus('idle'); setError(''); }
  }

  async function downloadCSV() {
    setDlBusy(true);
    try {
      const endpoint = dlStation === 'all'
        ? '/api/data?all=1'
        : `/api/history?station=${dlStation}&all=1`;
      const res      = await fetch(endpoint);
      const data     = await res.json();
      if (!data.ok || !data.merged?.length) throw new Error('No data returned');

      const header = 'Ws,Wd,Hs';
      const lines  = data.merged.map(r => `${r.Ws},${r.Wd},${r.Hs}`);
      const csv    = [header, ...lines].join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `kinneret_${dlStation}_training.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Download failed: ' + e.message);
    } finally {
      setDlBusy(false);
    }
  }

  async function train() {
    if (!file) return;

    setTreeColors(makeTreeColors());  // fresh random forest colors each run
    setTreeCount(0);
    setStatus('training');
    setError('');
    setResult(null);

    // Animate 0→92 over ~8.3 s. The gap 92→100 is "snapped" after the API responds.
    intervalRef.current = setInterval(() => {
      setTreeCount(c => (c < 92 ? c + 1 : c));
    }, 90);

    const form = new FormData();
    form.append('file', file);

    try {
      const [data] = await Promise.all([
        fetch('/api/train', { method: 'POST', body: form }).then(r => r.json()),
        new Promise(r => setTimeout(r, 4000)),  // show animation for at least 4 s
      ]);

      clearInterval(intervalRef.current);
      if (!data.ok) throw new Error(data.error);

      // Snap to 100 then pause so user sees the complete forest before results appear
      setTreeCount(100);
      await new Promise(r => setTimeout(r, 900));

      setResult(data);
      setStatus('done');
      onModelTrained?.(data);
    } catch (e) {
      clearInterval(intervalRef.current);
      setError(e.message);
      setStatus('error');
    }
  }

  function reset() {
    setFile(null);
    setResult(null);
    setStatus('idle');
    setError('');
    setTreeCount(0);
  }

  return (
    <div className="space-y-6">

      {/* ── Upload panel ── */}
      <div className="panel">
        <h3 className="panel-title">🤖 Train Random Forest — Upload Dataset</h3>
        <p className="text-xs text-slate-400 mb-4">
          Needs a file with <span className="font-mono text-sky-400">Ws</span> (wind speed m/s),{' '}
          <span className="font-mono text-sky-400">Wd</span> (wind direction °), and{' '}
          <span className="font-mono text-sky-400">Hs</span> (wave height m).
          Use the export button below to download merged sensor data.
        </p>

        {/* Download helper */}
        <div className="flex flex-wrap items-center gap-2 mb-4 p-3 rounded-lg border border-slate-800 bg-[#060e1c]/60">
          <span className="text-xs text-slate-400">📥 Export training data:</span>
          <select
            value={dlStation}
            onChange={e => setDlStation(e.target.value)}
            className="text-xs rounded px-2 py-1.5 bg-slate-800 border border-slate-700 text-slate-200 cursor-pointer"
          >
            <option value="all">All stations — full dataset</option>
            {['KNW08','KNW09','KNW10','KNW11','KNW12'].map(s => (
              <option key={s} value={s}>{s} — full dataset</option>
            ))}
          </select>
          <button
            onClick={downloadCSV}
            disabled={dlBusy}
            className="text-xs px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 transition-all disabled:opacity-50"
          >
            {dlBusy ? '⏳ Fetching…' : '⬇ Export CSV'}
          </button>
          <span className="text-xs text-slate-600 ml-auto hidden sm:block">
            ℹ KNW09 = north-of-center buoy, good wind exposure
          </span>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleFileDrop}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
            dragging ? 'border-sky-400 bg-sky-900/20' :
            file     ? 'border-green-600 bg-green-900/10' :
                       'border-slate-700 hover:border-slate-500 bg-[#060e1c]/40'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={handleFileDrop}
          />
          {file ? (
            <div>
              <p className="text-2xl mb-1">📄</p>
              <p className="font-semibold text-green-400">{file.name}</p>
              <p className="text-xs text-slate-500 mt-1">
                {(file.size / 1024).toFixed(1)} KB · click to replace
              </p>
            </div>
          ) : (
            <div>
              <p className="text-3xl mb-2">📂</p>
              <p className="text-slate-300 font-medium">Drop file here or click to browse</p>
              <p className="text-xs text-slate-500 mt-1">Accepts .csv · .xlsx · .xls</p>
            </div>
          )}
        </div>

        <button
          onClick={train}
          disabled={!file || status === 'training'}
          className="mt-4 w-full py-3 rounded-xl font-bold text-white text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: status === 'training'
              ? '#1e293b'
              : 'linear-gradient(135deg,#0ea5e9,#38bdf8)',
          }}
        >
          {status === 'training' ? '🌲 Growing forest…' : '▶ Train Model'}
        </button>

        {status === 'error' && (
          <div className="mt-3 rounded-lg p-3 bg-red-900/20 border border-red-700/40 text-red-300 text-sm">
            ⚠ {error}
          </div>
        )}
      </div>

      {/* ── RF config ── */}
      <div className="panel">
        <h3 className="panel-title">RF Configuration</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            ['Trees',       '100'],
            ['Max Depth',   '5'],
            ['Split',       '80 / 20'],
            ['Balancing',   'Oversample'],
            ['Features',    'Ws · U_wind · V_wind · U_east'],
            ['Labels',      'Safe / Caution / Danger'],
            ['Seed',        '42'],
            ['Importance',  'Permutation'],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg p-3 bg-[#060e1c]/50 border border-slate-800">
              <p className="text-xs text-slate-400">{k}</p>
              <p className="text-sky-300 font-mono font-bold text-xs mt-0.5">{v}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Forest animation ── */}
      {status === 'training' && (
        <div className="panel">
          <ForestGrid treeCount={treeCount} treeColors={treeColors} />
        </div>
      )}

      {/* ── Results ── */}
      {status === 'done' && result && (
        <div className="space-y-4">
          <div className="rounded-lg p-3 bg-green-900/20 border border-green-700/40 text-sm text-green-300">
            ✅ Model trained on <strong>{result.fileName}</strong> ·{' '}
            {result.totalRows} valid rows · train {result.trainSize} · test {result.testSize} ·{' '}
            accuracy <strong>{result.accuracy}%</strong>
          </div>

          {/* Class distribution */}
          <div className="panel">
            <h3 className="panel-title">Dataset Class Distribution</h3>
            <div className="grid grid-cols-3 gap-3">
              {[
                ['Safe',    result.classCounts.safe,    '#22c55e'],
                ['Caution', result.classCounts.caution, '#eab308'],
                ['Danger',  result.classCounts.danger,  '#dc2626'],
              ].map(([label, count, color]) => (
                <div key={label} className="rounded-lg p-4 text-center border border-slate-800 bg-[#060e1c]/50">
                  <p className="text-3xl font-black" style={{ color }}>{count}</p>
                  <p className="text-xs text-slate-400 mt-1">{label}</p>
                  <p className="text-xs text-slate-500">
                    {result.totalRows ? ((count / result.totalRows) * 100).toFixed(1) : 0}%
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="panel">
              <FeatureImportance data={result.featureImportance} />
            </div>
            <div className="panel">
              <ConfusionMatrix matrix={result.confusion} accuracy={result.accuracy} />
            </div>
          </div>

          {/* Per-class recall */}
          <div className="panel">
            <h3 className="panel-title">Per-Class Recall</h3>
            <div className="grid grid-cols-3 gap-3">
              {result.confusion.map((row, i) => {
                const total  = row.reduce((a, b) => a + b, 0);
                const recall = total > 0 ? ((row[i] / total) * 100).toFixed(1) : '—';
                const colors = ['#22c55e', '#eab308', '#dc2626'];
                const labels = ['Safe', 'Caution', 'Danger'];
                return (
                  <div key={i} className="rounded-lg p-4 text-center border border-slate-800 bg-[#060e1c]/50">
                    <p className="text-2xl font-black" style={{ color: colors[i] }}>{recall}%</p>
                    <p className="text-xs text-slate-400 mt-1">{labels[i]}</p>
                    <p className="text-xs text-slate-500">{row[i]} / {total} correct</p>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            onClick={reset}
            className="w-full py-2 rounded-lg text-sm text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-600 transition-all"
          >
            Train with a different dataset
          </button>
        </div>
      )}
    </div>
  );
}
