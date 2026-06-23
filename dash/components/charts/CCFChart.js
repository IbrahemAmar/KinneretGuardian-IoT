'use client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Cell } from 'recharts';

export default function CCFChart({ data }) {
  if (!data?.length) return null;
  const maxR = Math.max(...data.map(d => Math.abs(d.r)));

  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f44" />
          <XAxis dataKey="lag" tick={{ fill: '#94a3b8', fontSize: 11 }} label={{ value: 'Lag (hours)', position: 'insideBottom', offset: -5, fill: '#64748b', fontSize: 12 }} />
          <YAxis domain={[-maxR * 1.2, maxR * 1.2]} tick={{ fill: '#94a3b8', fontSize: 11 }} label={{ value: 'r', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 12 }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#0a1628', border: '1px solid #0ea5e944', borderRadius: 8, color: '#e2e8f0' }}
            formatter={(v) => [v.toFixed(3), 'Correlation']}
          />
          <ReferenceLine y={0} stroke="#334155" />
          <ReferenceLine x={1} stroke="#ea580c" strokeDasharray="4 4" label={{ value: 'lag=1', fill: '#ea580c', fontSize: 11 }} />
          <Bar dataKey="r" radius={[2, 2, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.r >= 0 ? '#0ea5e9' : '#ef4444'} opacity={0.6 + 0.4 * (Math.abs(d.r) / maxR)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
