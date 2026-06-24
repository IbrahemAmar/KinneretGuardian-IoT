'use client';

export default function CalcSteps({ steps, title = '🔢 Step-by-Step Calculations' }) {
  if (!steps?.length) return null;
  return (
    <div className="panel">
      <p className="panel-title">{title}</p>
      <div className="space-y-3">
        {steps.map((step, i) => (
          <div key={i} className="rounded-lg border border-slate-800 bg-[#060e1c]/70 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-800 bg-[#0a1628]">
              <span className="w-5 h-5 rounded-full bg-sky-900 border border-sky-700 flex items-center justify-center text-xs text-sky-300 font-bold shrink-0">{i+1}</span>
              <span className="text-sm font-bold text-sky-300">{step.title}</span>
            </div>
            <div className="px-4 py-3 font-mono text-sm space-y-1">
              {step.lines.map((line, j) => {
                const isResult  = line.startsWith('⟹') || line.startsWith('=');
                const isLabel   = line.startsWith('//');
                const isWarning = line.startsWith('!');
                return (
                  <div key={j} className={
                    isResult  ? 'text-emerald-400 font-bold pl-4' :
                    isLabel   ? 'text-slate-500 text-xs' :
                    isWarning ? 'text-yellow-400' :
                    'text-slate-300 pl-2'
                  }>
                    {line}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function buildARXSteps({ ws, wd, hsPrev, alpha = 0.6634, beta = 0.0069, gamma = 0.0153 }) {
  const wdRad   = (wd * Math.PI) / 180;
  const uWind   = ws * Math.sin(wdRad);
  const uEast   = -uWind;
  const term1   = alpha * hsPrev;
  const term2   = beta  * uEast;
  const hsNext  = Math.max(0, term1 + term2 + gamma);
  const danger  = hsNext >= 0.5 ? 'DANGER 🔴' : hsNext >= 0.1 ? 'CAUTION 🟡' : 'SAFE 🟢';

  return [
    {
      title: 'IMS API → Wind Components',
      lines: [
        `Ws  = ${ws.toFixed(2)} m/s   (wind speed from Station 8)`,
        `Wd  = ${wd.toFixed(1)}°      (wind direction)`,
        `Wd_rad = ${wd.toFixed(1)} × π/180 = ${wdRad.toFixed(4)} rad`,
        `U_wind = Ws × sin(Wd_rad) = ${ws.toFixed(2)} × ${Math.sin(wdRad).toFixed(4)} = ${uWind.toFixed(3)} m/s`,
        `⟹ U_east = −U_wind = ${uEast.toFixed(3)} m/s   (eastward driving component)`,
      ],
    },
    {
      title: 'ARX Model Prediction  [R² = 0.718, lag = 1 h]',
      lines: [
        `// Formula: Hs(t) = α·Hs(t-1) + β·U_east(t-1) + γ`,
        `α = ${alpha}  (autoregressive coefficient)`,
        `β = ${beta}   (wind-wave coupling)`,
        `γ = ${gamma}  (intercept)`,
        ``,
        `Hs(t) = ${alpha} × ${hsPrev.toFixed(3)}  +  ${beta} × ${uEast.toFixed(3)}  +  ${gamma}`,
        `      = ${term1.toFixed(4)}  +  ${term2.toFixed(4)}  +  ${gamma}`,
        `⟹ Hs(t) = ${hsNext.toFixed(4)} m`,
      ],
    },
    {
      title: 'Danger Classification',
      lines: [
        `Hs = ${hsNext.toFixed(3)} m   |   Ws = ${ws.toFixed(1)} m/s`,
        `Danger if  Hs ≥ 0.5 m  OR  Ws ≥ 5.5 m/s`,
        `Caution if 0.1 ≤ Hs < 0.5  OR  3.3 ≤ Ws < 5.5`,
        `Safe    if Hs < 0.1  AND  Ws < 3.3`,
        `⟹ ${danger}`,
      ],
    },
  ];
}
