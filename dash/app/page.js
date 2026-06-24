'use client';
import { useState } from 'react';
import StatusTab      from '@/components/tabs/StatusTab';
import ForecastTab    from '@/components/tabs/ForecastTab';
import RAGTab         from '@/components/tabs/RAGTab';
import RealtimeTab    from '@/components/tabs/RealtimeTab';
import WindWaveLagTab from '@/components/tabs/WindWaveLagTab';

const TABS = [
  { key: 'status',   icon: '🏠', label: 'Current Status' },
  { key: 'forecast', icon: '📈', label: 'Forecasts' },
  { key: 'rag',      icon: '🧠', label: 'RAG Assistant' },
  { key: 'realtime', icon: '🔴', label: 'Realtime' },
  { key: 'lag',      icon: '⏱️', label: 'Wind-Wave Lag' },
];

export default function Home() {
  const [tab, setTab] = useState('status');

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 border-b" style={{ background: '#060e1c', borderColor: 'rgba(14,165,233,0.15)' }}>
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black tracking-tight" style={{ color: '#38bdf8', textShadow: '0 0 20px #0ea5e988' }}>
              🌊 KinneretGuardian
            </h1>
            <p className="text-xs text-slate-500 leading-none mt-0.5">
              Hydrodynamic Control Center · Wave Forecasting · ARX Analysis · Artificial Intelligence
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs text-green-400 font-medium">IMS Station 8</span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500">
              <span>R² = 0.718</span>
              <span className="text-slate-700">·</span>
              <span>lag = 1h</span>
              <span className="text-slate-700">·</span>
              <span>RF 87.3%</span>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 flex gap-1 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-all border-b-2 ${
                tab === t.key
                  ? 'border-sky-500 text-sky-300'
                  : 'border-transparent text-slate-500 hover:text-slate-300 hover:border-slate-600'
              }`}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        {tab === 'status'   && <StatusTab />}
        {tab === 'forecast' && <ForecastTab />}
        {tab === 'rag'      && <RAGTab />}
        {tab === 'realtime' && <RealtimeTab />}
        {tab === 'lag'      && <WindWaveLagTab />}
      </main>

      <footer className="border-t py-3 px-4 text-center text-xs text-slate-600" style={{ borderColor: 'rgba(14,165,233,0.1)' }}>
        KinneretGuardian · Lake Kinneret, Israel · ARX + Random Forest + Kriging Spatial Analysis
      </footer>
    </div>
  );
}
