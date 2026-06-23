'use client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ReferenceArea, ResponsiveContainer, Legend } from 'recharts';

export default function ForecastChart({ data, title = '12-Hour Wave Forecast' }) {
  if (!data?.length) return null;
  const maxHs = Math.max(...data.map(d => d.Hs), 0.8);

  return (
    <div className="w-full">
      <p className="text-center text-sm text-sky-400 font-semibold mb-2">{title}</p>
      <div className="w-full h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
            <ReferenceArea y1={0}    y2={0.1}  fill="#22c55e" fillOpacity={0.1} />
            <ReferenceArea y1={0.1}  y2={0.5}  fill="#eab308" fillOpacity={0.1} />
            <ReferenceArea y1={0.5}  y2={maxHs * 1.3} fill="#dc2626" fillOpacity={0.1} />
            <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f44" />
            <XAxis dataKey="hour" tick={{ fill: '#94a3b8', fontSize: 11 }} label={{ value: 'Hours ahead', position: 'insideBottom', offset: -5, fill: '#64748b', fontSize: 12 }} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} label={{ value: 'Hs (m)', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 12 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#0a1628', border: '1px solid #0ea5e944', borderRadius: 8, color: '#e2e8f0' }}
              formatter={(v) => [v.toFixed(3) + ' m', 'Hs']}
            />
            <ReferenceLine y={0.1} stroke="#eab308" strokeDasharray="4 4" strokeOpacity={0.5} />
            <ReferenceLine y={0.5} stroke="#dc2626" strokeDasharray="4 4" strokeOpacity={0.5} />
            <Line type="monotone" dataKey="Hs" stroke="#ea580c" strokeWidth={3} dot={{ fill: '#ea580c', r: 4 }} activeDot={{ r: 6 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
