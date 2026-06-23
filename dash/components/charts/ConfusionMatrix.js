'use client';
const LABELS = ['Safe', 'Caution', 'Danger'];
const BASE_COLORS = ['#14532d', '#713f12', '#7f1d1d'];

export default function ConfusionMatrix({ matrix, accuracy }) {
  if (!matrix?.length) return null;
  const maxVal = Math.max(...matrix.flat());

  return (
    <div className="w-full">
      <p className="text-center text-sm text-sky-400 font-semibold mb-1">
        Confusion Matrix — Accuracy: <span className="text-green-400">{accuracy?.toFixed(1)}%</span>
      </p>
      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center gap-1 ml-16">
          {LABELS.map(l => (
            <div key={l} className="w-16 text-center text-xs text-slate-400 font-medium">{l}</div>
          ))}
        </div>
        {matrix.map((row, i) => (
          <div key={i} className="flex items-center gap-1">
            <div className="w-14 text-right text-xs text-slate-400 font-medium pr-2">{LABELS[i]}</div>
            {row.map((val, j) => {
              const intensity = maxVal > 0 ? val / maxVal : 0;
              return (
                <div
                  key={j}
                  className="w-16 h-14 flex items-center justify-center rounded text-sm font-bold transition-all"
                  style={{
                    backgroundColor: `${BASE_COLORS[i]}${Math.round(intensity * 200 + 55).toString(16).padStart(2,'0')}`,
                    border: i === j ? '2px solid #38bdf8' : '1px solid #1e3a5f',
                    color: intensity > 0.5 ? '#fff' : '#94a3b8',
                  }}
                >
                  {val}
                </div>
              );
            })}
          </div>
        ))}
        <p className="text-xs text-slate-500 mt-1">Actual (rows) vs Predicted (cols)</p>
      </div>
    </div>
  );
}
