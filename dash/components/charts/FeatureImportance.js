'use client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const COLORS = ['#38bdf8', '#f97316', '#a3e635', '#f472b6'];

export default function FeatureImportance({ data }) {
  if (!data?.length) return null;
  const sorted = [...data].sort((a, b) => b.value - a.value);
  return (
    <div className="w-full">
      <p className="text-center text-sm text-sky-400 font-semibold mb-2">RF — Feature Importance</p>
      <div className="w-full h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart layout="vertical" data={sorted} margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f44" horizontal={false} />
            <XAxis type="number" domain={[0, 0.45]} tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <YAxis dataKey="name" type="category" tick={{ fill: '#e2e8f0', fontSize: 12 }} width={60} />
            <Tooltip
              contentStyle={{ backgroundColor: '#0a1628', border: '1px solid #0ea5e944', borderRadius: 8, color: '#e2e8f0' }}
              formatter={(v) => [(v * 100).toFixed(1) + '%', 'Importance']}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {sorted.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
