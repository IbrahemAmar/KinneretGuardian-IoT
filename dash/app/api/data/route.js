import * as XLSX from 'xlsx';

const GITHUB = 'https://raw.githubusercontent.com/IbrahemAmar/KinneretGuardian-IoT/main/';
const WIND_FILE  = 'data_202606172157.xlsx';
const WAVE_FILES = ['KNW08_Waves.xlsx','KNW09_Waves.xlsx','KNW10_Waves.xlsx','KNW11_Waves.xlsx','KNW12_Waves.xlsx'];
const ARX_ALPHA = 0.6634, ARX_BETA = 0.0069, ARX_GAMMA = 0.0153;

let _fullMerged = null;   // full dataset, kept in memory
let _meta       = null;   // arx, ccf, latest, availableDates
let _cacheTs    = 0;
const CACHE_TTL = 10 * 60 * 1000;

async function loadExcel(name) {
  const res = await fetch(GITHUB + name, { cache: 'no-store' });
  if (!res.ok) throw new Error(`GitHub fetch failed: ${name} (${res.status})`);
  const buf = await res.arrayBuffer();
  const wb  = XLSX.read(new Uint8Array(buf), { type: 'array', cellDates: true });
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null }); // raw:true (default) → dates come as JS Date objects
}

function parseWind(rows) {
  return rows.flatMap(row => {
    const vals = Object.values(row);
    // Excel layout: A=station name (skip), B=datetime DD/MM/YYYY HH:MM, C=Ws, D=Wd
    const ws = parseFloat(vals[2]);
    const wd = parseFloat(vals[3]);
    if (isNaN(ws) || isNaN(wd) || ws <= 0 || ws > 40) return [];
    const r     = (wd * Math.PI) / 180;
    const uWind = ws * Math.sin(r);
    const vWind = ws * Math.cos(r);
    const uEast = -uWind;
    const raw1  = vals[1]; // Column B — DD/MM/YYYY HH:MM
    let timeStr = '';
    const p = n => String(n).padStart(2, '0');
    if (raw1 instanceof Date) {
      // Wind file is Israel local time (UTC+3); subtract 3h → UTC, then floor to hour.
      const utc = new Date(raw1.getFullYear(), raw1.getMonth(), raw1.getDate(), raw1.getHours() - 3, 0);
      timeStr = `${utc.getFullYear()}-${p(utc.getMonth()+1)}-${p(utc.getDate())}T${p(utc.getHours())}:00:00`;
    } else if (raw1 != null) {
      const s = String(raw1).trim();
      // Parse DD/MM/YYYY HH:MM (Israel day-first format) then subtract 3h → UTC, floor to hour
      const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})[T\s](\d{1,2}):(\d{2})/);
      if (m) {
        const utc = new Date(+m[3], +m[2]-1, +m[1], +m[4]-3, 0);
        timeStr = `${utc.getFullYear()}-${p(utc.getMonth()+1)}-${p(utc.getDate())}T${p(utc.getHours())}:00:00`;
      }
    }
    return [{ time: timeStr, Ws: ws, Wd: wd, U_wind: uWind, V_wind: vWind, U_east: uEast }];
  });
}

function parseWaves(rows) {
  if (!rows.length) return [];
  const keys  = Object.keys(rows[0]);
  const tKey  = keys.find(k => /date|time/i.test(k)) ?? keys[0];
  const hKey  = keys.find(k => /^Hs/i.test(k))       ?? keys[1];
  return rows.flatMap(r => {
    const hs = parseFloat(r[hKey]);
    if (isNaN(hs) || hs < 0 || hs > 1.2) return [];
    const rawT = r[tKey];
    // Use local time components (same convention as parseWind) so timestamps are joinable
    let timeStr = '';
    if (rawT instanceof Date) {
      const p = n => String(n).padStart(2, '0');
      // Floor to hour so :59-minute wave timestamps match :00 wind timestamps
      timeStr = `${rawT.getFullYear()}-${p(rawT.getMonth()+1)}-${p(rawT.getDate())}T${p(rawT.getHours())}:00:00`;
    } else if (rawT != null) {
      timeStr = String(rawT).slice(0, 13).replace(' ', 'T') + ':00:00';
    }
    return [{ time: timeStr, Hs: hs }];
  });
}

// OLS for Hs(t) = alpha*Hs_prev(t-1) + beta*U_east_lag(t-1) + gamma
// Uses the pre-computed Hs_prev and U_east_lag fields from the timestamp-joined merged data.
function fitARX(data) {
  const pairs = data.filter(r => r.Hs_prev != null && r.U_east_lag != null && r.Hs != null);
  const n = pairs.length;
  if (n < 500) return { alpha: 0.6634, beta: 0.006860, gamma: 0.015317, r2: 0.3338 };

  // X = [Hs_prev, U_east_lag, 1], y = Hs
  const sXX = [0,0,0,0,0,0,0,0,0]; // 3x3 flattened
  const sXy = [0,0,0];
  for (const p of pairs) {
    const x = [p.Hs_prev, p.U_east_lag, 1];
    for (let i = 0; i < 3; i++) { for (let j = 0; j < 3; j++) sXX[i*3+j] += x[i]*x[j]; }
    for (let i = 0; i < 3; i++) sXy[i] += x[i] * p.Hs;
  }
  // 3x3 inverse via cofactor
  const m = sXX;
  const det = m[0]*(m[4]*m[8]-m[5]*m[7]) - m[1]*(m[3]*m[8]-m[5]*m[6]) + m[2]*(m[3]*m[7]-m[4]*m[6]);
  if (Math.abs(det) < 1e-12) return { alpha: 0.6634, beta: 0.006860, gamma: 0.015317, r2: 0.3338 };
  const inv = [
    (m[4]*m[8]-m[5]*m[7])/det, (m[2]*m[7]-m[1]*m[8])/det, (m[1]*m[5]-m[2]*m[4])/det,
    (m[5]*m[6]-m[3]*m[8])/det, (m[0]*m[8]-m[2]*m[6])/det, (m[2]*m[3]-m[0]*m[5])/det,
    (m[3]*m[7]-m[4]*m[6])/det, (m[1]*m[6]-m[0]*m[7])/det, (m[0]*m[4]-m[1]*m[3])/det,
  ];
  const beta = [0,0,0];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) beta[i] += inv[i*3+j] * sXy[j];

  const yMean = pairs.reduce((s,p) => s+p.Hs, 0) / n;
  let ssTot = 0, ssRes = 0;
  for (const p of pairs) {
    const pred = beta[0]*p.Hs_prev + beta[1]*p.U_east_lag + beta[2];
    ssRes += (p.Hs - pred)**2;
    ssTot += (p.Hs - yMean)**2;
  }
  const r2 = 1 - ssRes / ssTot;
  return { alpha: beta[0], beta: beta[1], gamma: beta[2], r2: Math.max(0, r2) };
}

function computeCCF(data, maxLag = 24) {
  const u = data.map(d => d.U_east);
  const h = data.map(d => d.Hs);
  const n = u.length;
  if (n < 10) return [];
  const mu = u.reduce((a,b)=>a+b,0)/n, mh = h.reduce((a,b)=>a+b,0)/n;
  const su = Math.sqrt(u.reduce((a,v)=>a+(v-mu)**2,0)/n)||1;
  const sh = Math.sqrt(h.reduce((a,v)=>a+(v-mh)**2,0)/n)||1;
  return Array.from({length: maxLag+1}, (_, lag) => {
    let sum=0, cnt=0;
    for (let i=lag; i<n; i++) { sum+=(u[i-lag]-mu)*(h[i]-mh); cnt++; }
    return { lag, r: cnt ? sum/(cnt*su*sh) : 0 };
  });
}

export async function GET(req) {
  // Rebuild cache if expired
  if (!_fullMerged || Date.now() - _cacheTs >= CACHE_TTL) {
    try {
      // 1. Wind data
      const windRaw = await loadExcel(WIND_FILE);
      const wind    = parseWind(windRaw);

      // 2. Wave data (all 5 buoys merged)
      const wavesAll = [];
      for (const f of WAVE_FILES) {
        try {
          const rows = await loadExcel(f);
          wavesAll.push(...parseWaves(rows));
        } catch { /* skip missing buoy */ }
      }

      // 3. Merge wind + waves by timestamp (inner join).
      //    Wind is 10-min data (6 readings/hour); average into hourly buckets to match wave cadence.
      const windAccum = new Map();
      for (const w of wind) {
        if (!w.time) continue;
        if (!windAccum.has(w.time)) windAccum.set(w.time, { Ws: 0, Wd: 0, U_wind: 0, V_wind: 0, U_east: 0, cnt: 0 });
        const e = windAccum.get(w.time);
        e.Ws += w.Ws; e.Wd += w.Wd; e.U_wind += w.U_wind; e.V_wind += w.V_wind; e.U_east += w.U_east; e.cnt++;
      }
      const windMap = new Map();
      for (const [t, e] of windAccum) {
        windMap.set(t, {
          Ws:     +(e.Ws     / e.cnt).toFixed(3),
          Wd:     +(e.Wd     / e.cnt).toFixed(1),
          U_wind: +(e.U_wind / e.cnt).toFixed(3),
          V_wind: +(e.V_wind / e.cnt).toFixed(3),
          U_east: +(e.U_east / e.cnt).toFixed(3),
        });
      }

      // Average Hs across all buoys that reported at the same hour
      const waveMap = new Map();
      for (const wv of wavesAll) {
        if (!wv.time) continue;
        if (!waveMap.has(wv.time)) waveMap.set(wv.time, { sum: 0, cnt: 0 });
        const e = waveMap.get(wv.time);
        e.sum += wv.Hs; e.cnt++;
      }

      // Find common timestamps, sort chronologically
      const commonTimes = [...windMap.keys()].filter(t => waveMap.has(t)).sort();

      const merged = [];
      for (let i = 1; i < commonTimes.length; i++) {
        const t      = commonTimes[i];
        const tPrev  = commonTimes[i - 1];
        const w      = windMap.get(t);
        const wPrev  = windMap.get(tPrev);
        const wve    = waveMap.get(t);
        const wvePrev = waveMap.get(tPrev);
        if (!w || !wPrev || !wve || !wvePrev) continue;
        const hs     = +(wve.sum    / wve.cnt).toFixed(3);
        const hsPrev = +(wvePrev.sum / wvePrev.cnt).toFixed(3);
        merged.push({
          idx:        i,
          time:       t,
          Ws:         +w.Ws.toFixed(3),
          Wd:         +w.Wd.toFixed(1),
          U_wind:     +w.U_wind.toFixed(3),
          V_wind:     +w.V_wind.toFixed(3),
          U_east:     +w.U_east.toFixed(3),
          U_east_lag: +wPrev.U_east.toFixed(3),
          Hs_prev:    hsPrev,
          Hs:         hs,
        });
      }

      console.log('[MERGED TOTAL]', merged.length);
      const arx  = fitARX(merged);
      console.log('[ARX]', JSON.stringify(arx));
      const ccf  = computeCCF(merged.slice(-500));
      const last = merged[merged.length - 1] ?? {};

      // Unique UTC dates available across the full dataset
      const availableDates = [...new Set(merged.map(r => r.time.slice(0, 10)))].sort();

      _fullMerged = merged;
      _meta       = {
        arx:    { alpha: +arx.alpha.toFixed(4), beta: +arx.beta.toFixed(4), gamma: +arx.gamma.toFixed(4), r2: +arx.r2.toFixed(4) },
        ccf,
        latest: last,
        availableDates,
      };
      _cacheTs = Date.now();

    } catch (err) {
      return Response.json({ ok: false, error: err.message, source: 'mock' }, { status: 200 });
    }
  }

  // Apply optional date filter: ?date=YYYY-MM-DD returns that day's rows
  const { searchParams } = new URL(req.url);
  const dateFilter = searchParams.get('date');

  const allRows = searchParams.get('all') === '1';
  const rows = dateFilter
    ? _fullMerged.filter(r => r.time.startsWith(dateFilter))
    : allRows
    ? _fullMerged
    : _fullMerged.slice(-200);

  return Response.json({
    ok:     true,
    source: 'github',
    count:  rows.length,
    merged: rows,
    ..._meta,
  });
}
