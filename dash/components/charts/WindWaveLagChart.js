'use client';
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceArea, ReferenceLine, ResponsiveContainer, Legend,
} from 'recharts';

function dangerLevel(hs, ws) {
  if (hs >= 0.5 || ws >= 5.5) return { level: 'DANGER',  color: '#dc2626' };
  if (hs >= 0.1 || ws >= 3.3) return { level: 'CAUTION', color: '#eab308' };
  return                              { level: 'SAFE',    color: '#22c55e' };
}

function fmtTime(raw) {
  if (!raw) return '';
  try {
    const s = typeof raw === 'string' ? raw.trim().replace(/^(\d{4}-\d{2}-\d{2}) /, '$1T') : raw;
    const d = new Date(s);
    if (isNaN(d)) return String(raw).slice(11, 16);
    // Show "HH:00" so every hour label is unambiguous
    const h = d.getUTCHours().toString().padStart(2, '0');
    const m = d.getUTCMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
  } catch { return String(raw).slice(0, 5); }
}

function fmtFull(raw) {
  if (!raw) return '';
  try {
    const s = typeof raw === 'string' ? raw.trim().replace(/^(\d{4}-\d{2}-\d{2}) /, '$1T') : raw;
    const d = new Date(s);
    if (isNaN(d)) return String(raw).slice(0, 16);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
      + ' · ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  } catch { return String(raw).slice(0, 16); }
}

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const ws  = payload.find(p => p.dataKey === 'Ws')?.value;
  const hs  = payload.find(p => p.dataKey === 'Hs_shifted')?.value;
  const ts  = payload[0]?.payload?.fullTime;
  const dng = hs != null && ws != null ? dangerLevel(hs, ws) : null;
  return (
    <div style={{
      background: '#0a1628', border: '1px solid #0ea5e944',
      borderRadius: 8, padding: '10px 14px', minWidth: 180,
    }}>
      {ts && <p style={{ color: '#94a3b8', fontSize: 11, marginBottom: 6 }}>{fmtFull(ts)}</p>}
      {ws  != null && <p style={{ color: '#38bdf8', margin: '2px 0', fontSize: 12 }}>💨 Wind: <b>{ws.toFixed(2)} m/s</b></p>}
      {hs  != null && <p style={{ color: '#ea580c', margin: '2px 0', fontSize: 12 }}>🌊 Hs (t+1h): <b>{hs.toFixed(3)} m</b></p>}
      {dng && <p style={{ color: dng.color, fontWeight: 700, marginTop: 6, fontSize: 12 }}>● {dng.level}</p>}
    </div>
  );
};

export default function WindWaveLagChart({ data, highlightLabel = null }) {
  if (!data?.length) return null;

  // At chart position i: Ws[i] (wind now) paired with Hs[i+1] (wave next hour)
  // If caller already filtered to a single day (≤30 rows) use all rows; else take last 25.
  const src = data.length <= 30 ? data : data.slice(-25);
  const pts = src.slice(0, -1).map((row, i) => ({
    label:      fmtTime(row.time),
    fullTime:   row.time,
    Ws:         row.Ws,
    Hs_shifted: src[i + 1].Hs,
  }));

  const maxWs  = Math.max(...pts.map(d => d.Ws),         6)   * 1.15;
  const maxHs  = Math.max(...pts.map(d => d.Hs_shifted), 0.6) * 1.35;
  const nowLbl = pts[pts.length - 1]?.label;

  return (
    <div className="w-full" style={{ height: 310 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={pts} margin={{ top: 10, right: 60, left: 0, bottom: 28 }}>

          {/* ── Danger bands on the Hs (right) axis ── */}
          <ReferenceArea yAxisId="hs" y1={0}    y2={0.1}   fill="#22c55e" fillOpacity={0.13} />
          <ReferenceArea yAxisId="hs" y1={0.1}  y2={0.5}   fill="#eab308" fillOpacity={0.09} />
          <ReferenceArea yAxisId="hs" y1={0.5}  y2={maxHs} fill="#dc2626" fillOpacity={0.09} />

          <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f44" />

          <XAxis
            dataKey="label"
            tick={{ fill: '#94a3b8', fontSize: 10 }}
            interval={1}
            label={{ value: 'Hour (UTC)', position: 'insideBottom', offset: -14, fill: '#64748b', fontSize: 11 }}
          />

          {/* Left axis — wind */}
          <YAxis
            yAxisId="wind"
            domain={[0, maxWs]}
            tick={{ fill: '#38bdf8', fontSize: 11 }}
            label={{ value: 'Wind (m/s)', angle: -90, position: 'insideLeft', offset: 10, fill: '#38bdf8', fontSize: 11 }}
          />

          {/* Right axis — Hs */}
          <YAxis
            yAxisId="hs"
            orientation="right"
            domain={[0, maxHs]}
            tick={{ fill: '#ea580c', fontSize: 11 }}
            label={{ value: 'Hs +1h (m)', angle: 90, position: 'insideRight', offset: 14, fill: '#ea580c', fontSize: 11 }}
          />

          <Tooltip content={<CustomTooltip />} />

          {/* Hs threshold dashed lines */}
          <ReferenceLine yAxisId="hs" y={0.1} stroke="#eab308" strokeDasharray="4 4" strokeOpacity={0.6} />
          <ReferenceLine yAxisId="hs" y={0.5} stroke="#dc2626" strokeDasharray="4 4" strokeOpacity={0.6} />

          {/* "Now" vertical marker */}
          <ReferenceLine
            x={nowLbl}
            stroke="#94a3b8"
            strokeDasharray="6 3"
            strokeWidth={1.5}
            label={{ value: 'now', position: 'insideTopRight', fill: '#94a3b8', fontSize: 10 }}
          />

          {/* Selected-hour marker (from slider) */}
          {highlightLabel && highlightLabel !== nowLbl && (
            <ReferenceLine
              x={highlightLabel}
              stroke="#f59e0b"
              strokeWidth={2}
              label={{ value: '▼', position: 'top', fill: '#f59e0b', fontSize: 11 }}
            />
          )}

          <Line
            yAxisId="wind"
            type="monotone"
            dataKey="Ws"
            stroke="#38bdf8"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 5, fill: '#38bdf8', strokeWidth: 0 }}
            name="Wind speed (m/s)"
          />

          <Line
            yAxisId="hs"
            type="monotone"
            dataKey="Hs_shifted"
            stroke="#ea580c"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 5, fill: '#ea580c', strokeWidth: 0 }}
            name="Hs shifted +1h (m)"
          />

          <Legend
            verticalAlign="top"
            wrapperStyle={{ fontSize: 12, paddingBottom: 4 }}
            formatter={value => <span style={{ color: '#94a3b8' }}>{value}</span>}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
