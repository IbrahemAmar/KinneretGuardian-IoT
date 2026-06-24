// ARX: Hs(t) = α·Hs(t-1) + β·U_east(t-1) + γ  |  R² = 0.718, MAE ≈ 0.02m, lag = 1h
export const ARX_ALPHA = 0.6634;
export const ARX_BETA  = 0.0069;
export const ARX_GAMMA = 0.0153;
export const BEST_LAG  = 1;

export function arxPredict(hsPrev, uEastPrev) {
  return Math.max(0, ARX_ALPHA * hsPrev + ARX_BETA * uEastPrev + ARX_GAMMA);
}

export function arxForecast(hs0, uEast, hours = 12) {
  const out = [{ hour: 0, Hs: hs0 }];
  for (let i = 1; i <= hours; i++) {
    const hsNext = arxPredict(out[i - 1].Hs, uEast);
    out.push({ hour: i, Hs: Math.min(1.5, hsNext) });
  }
  return out;
}

// Forecast with wind that can vary per step (e.g. recovery scenario with decaying wind)
// winds[i] = wind at hour i; Hs(t) uses winds[t-1] per the lag-1 ARX formula
export function arxForecastVaryingWind(hs0, winds, hours = 12) {
  const out = [{ hour: 0, Hs: hs0, wind: winds[0] }];
  for (let i = 1; i <= hours; i++) {
    const prev = out[i - 1].Hs;
    const w    = winds[i - 1] ?? winds[winds.length - 1];
    const Hs   = Math.max(0, Math.min(1.5, ARX_ALPHA * prev + ARX_BETA * w + ARX_GAMMA));
    out.push({ hour: i, Hs, wind: winds[i] ?? winds[winds.length - 1] });
  }
  return out;
}

export function computeCCF(data, maxLag = 24) {
  const n = data.length;
  const u = data.map(d => d.U_east);
  const h = data.map(d => d.Hs);
  const mu = u.reduce((a, b) => a + b, 0) / n;
  const mh = h.reduce((a, b) => a + b, 0) / n;
  const su = Math.sqrt(u.reduce((a, v) => a + (v - mu) ** 2, 0) / n) || 1;
  const sh = Math.sqrt(h.reduce((a, v) => a + (v - mh) ** 2, 0) / n) || 1;

  return Array.from({ length: maxLag * 2 + 1 }, (_, idx) => {
    const lag = idx - maxLag;
    let sum = 0, count = 0;
    for (let i = 0; i < n; i++) {
      const j = i - lag;
      if (j >= 0 && j < n) { sum += (u[i] - mu) * (h[j] - mh); count++; }
    }
    return { lag, r: count ? sum / (count * su * sh) : 0 };
  });
}
