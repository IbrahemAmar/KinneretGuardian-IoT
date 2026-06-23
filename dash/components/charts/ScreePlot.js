'use client';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function ScreePlot({ data }) {
  if (!data?.length) return null;
  return (
    <div className="w-full">
      <p className="text-center text-sm text-sky-400 font-semibold mb-2">PCA — Scree Plot (Explained Variance)</p>
      <div className="w-full h-56">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f44" />
            <XAxis dataKey="pc" tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <YAxis yAxisId="left" domain={[0, 50]} tick={{ fill: '#94a3b8', fontSize: 11 }} label={{ value: '% Var', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 11 }} />
            <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 11 }} label={{ value: 'Cumulative %', angle: 90, position: 'insideRight', fill: '#64748b', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#0a1628', border: '1px solid #0ea5e944', borderRadius: 8, color: '#e2e8f0' }}
              formatter={(v, n) => [v.toFixed(1) + '%', n === 'variance' ? 'Variance' : 'Cumulative']}
            />
            <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 12 }} />
            <Bar yAxisId="left" dataKey="variance" fill="#4e9fd4" radius={[3, 3, 0, 0]} name="Variance %" />
            <Line yAxisId="right" type="monotone" dataKey="cumulative" stroke="#f97316" strokeWidth={2} dot={{ fill: '#f97316', r: 4 }} name="Cumulative %" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
