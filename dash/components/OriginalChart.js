'use client';
import { useState } from 'react';

export default function OriginalChart({ src, title, description, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-slate-700/60 overflow-hidden" style={{ background: 'linear-gradient(135deg,#0a1628,#0d1f3c)' }}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-all"
      >
        <div className="flex items-center gap-2">
          <span className="text-amber-400 text-sm">🐍</span>
          <span className="text-sm font-bold text-amber-300">Original Python / matplotlib Output</span>
          {title && <span className="text-xs text-slate-500 hidden sm:block">· {title}</span>}
        </div>
        <span className="text-slate-400 text-xs">{open ? '▲ hide' : '▼ show'}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-2">
          {description && <p className="text-xs text-slate-400">{description}</p>}
          <div className="rounded-lg overflow-hidden border border-slate-600/50">
            <img src={src} alt={title} className="w-full" style={{ background: '#ffffff', display: 'block' }} />
          </div>
          <p className="text-xs text-slate-600 text-center">{title} · Generated with matplotlib / sklearn · Lake Kinneret data</p>
        </div>
      )}
    </div>
  );
}
