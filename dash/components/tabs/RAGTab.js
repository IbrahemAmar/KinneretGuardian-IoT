'use client';
import { useState } from 'react';
import { RAG_PAPERS, RAG_QA } from '@/lib/mockData';

export default function RAGTab() {
  const [query, setQuery]       = useState('');
  const [answer, setAnswer]     = useState(null);
  const [loading, setLoading]   = useState(false);

  const search = () => {
    if (!query.trim()) return;
    setLoading(true);
    setTimeout(() => {
      const lower = query.toLowerCase();
      const match = RAG_QA.find(qa => {
        const keywords = qa.q.toLowerCase().split(' ').filter(w => w.length > 4);
        return keywords.some(kw => lower.includes(kw));
      }) ?? RAG_QA[0];
      setAnswer({ text: match.a, paperIds: match.papers, query });
      setLoading(false);
    }, 1200);
  };

  return (
    <div className="space-y-6">
      <div className="panel">
        <h3 className="panel-title">🧠 KinneretGuardian RAG Research Assistant</h3>
        <p className="text-sm text-slate-400 mb-4">
          Ask questions about Lake Kinneret hydrodynamics. The assistant retrieves context from 5 peer-reviewed papers and generates expert answers.
        </p>

        <div className="space-y-3">
          <textarea
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), search())}
            placeholder="How do wind fields dictate short-term wave adjustments in Lake Kinneret?"
            rows={3}
            className="w-full rounded-lg bg-[#060e1c] border border-slate-700 text-slate-200 placeholder-slate-600 px-4 py-3 text-sm focus:outline-none focus:border-sky-600 resize-none"
          />
          <div className="flex flex-wrap gap-2">
            {RAG_QA.map((qa, i) => (
              <button
                key={i}
                onClick={() => { setQuery(qa.q); setAnswer(null); }}
                className="text-xs px-3 py-1.5 rounded-full border border-sky-800 text-sky-400 hover:bg-sky-900/30 transition-all"
              >
                {qa.q.slice(0, 55)}…
              </button>
            ))}
          </div>
          <button
            onClick={search}
            disabled={loading || !query.trim()}
            className="px-6 py-2.5 rounded-lg font-semibold text-white bg-gradient-to-r from-[#064e7e] to-[#0ea5e9] hover:opacity-90 disabled:opacity-50 transition-all"
          >
            {loading ? '🔍 Searching papers...' : '🔍 Search Papers & Generate Answer'}
          </button>
        </div>
      </div>

      {answer && (
        <div className="panel border border-sky-900/50">
          <div className="flex items-start gap-3 mb-4">
            <span className="text-2xl">🤖</span>
            <div>
              <p className="text-xs text-slate-500 mb-1">Query: <span className="text-sky-400 italic">"{answer.query}"</span></p>
              <p className="text-sm text-slate-200 leading-relaxed">{answer.text}</p>
            </div>
          </div>
          <div>
            <p className="text-xs text-slate-500 font-semibold mb-2 uppercase tracking-wide">Sources cited</p>
            <div className="space-y-2">
              {RAG_PAPERS.filter(p => answer.paperIds.includes(p.id)).map(p => (
                <div key={p.id} className="flex items-start gap-3 rounded-lg p-3 bg-[#060e1c]/50 border border-slate-800">
                  <span className="text-sky-500 font-mono text-xs mt-0.5">[{p.id}]</span>
                  <div>
                    <p className="text-sm text-slate-200 font-medium">{p.title}</p>
                    <p className="text-xs text-slate-400">{p.authors} · <span className="italic">{p.journal}</span>, {p.year}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="panel">
        <h3 className="panel-title">📚 Knowledge Base — {RAG_PAPERS.length} Academic Papers</h3>
        <div className="space-y-2">
          {RAG_PAPERS.map(p => (
            <div key={p.id} className="flex items-start gap-3 rounded-lg p-3 bg-[#060e1c]/40 border border-slate-800 hover:border-sky-900 transition-all">
              <span className="text-sky-500 font-mono text-xs mt-0.5 w-5 shrink-0">[{p.id}]</span>
              <div>
                <p className="text-sm text-slate-200">{p.title}</p>
                <p className="text-xs text-slate-400 mt-0.5">{p.authors} · <span className="italic">{p.journal}</span> · {p.year}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
