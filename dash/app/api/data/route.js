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
    if (raw1 instanceof Date) {
      // XLSX parsed as Date — use local components to avoid UTC shift
      const p = n => String(n).padStart(2, '0');
      timeStr = `${raw1.getFullYear()}-${p(raw1.getMonth()+1)}-${p(raw1.getDate())}T${p(raw1.getHours())}:${p(raw1.getMinutes())}:00`;
    } else if (raw1 != null) {
      const s = String(raw1).trim();
      // Parse DD/MM/YYYY HH:MM (Israel day-first format)
      const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})[T\s](\d{1,2}):(\d{2})/);
      if (m) {
        timeStr = `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}T${m[4].padStart(2,'0')}:${m[5]}:00`;
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
    const timeStr = (rawT instanceof Date) ? rawT.toISOString() : (rawT != null ? String(rawT) : '');
    return [{ time: timeStr, Hs: hs }];
  });
}

// simple OLS for Hs = alpha*Hs_prev + beta*U_east + gamma
function fitARX(data) {
  const rows = data.filter((_, i) => i > 0 && data[i-1] !== undefined);
  const pairs = rows.map((r, i) => ({ hs: r.Hs, hsPrev: data[i].Hs, uEast: data[i].U_east }));
  const n = pairs.length;
  if (n < 10) return { alpha: ARX_ALPHA, beta: ARX_BETA, gamma: ARX_GAMMA, r2: 0.718 };

  // X = [hsPrev, uEast, 1], y = hs
  const sXX = [0,0,0,0,0,0,0,0,0]; // 3x3 flattened
  const sXy = [0,0,0];
  for (const p of pairs) {
    const x = [p.hsPrev, p.uEast, 1];
    for (let i = 0; i < 3; i++) { for (let j = 0; j < 3; j++) sXX[i*3+j] += x[i]*x[j]; }
    for (let i = 0; i < 3; i++) sXy[i] += x[i] * p.hs;
  }
  // 3x3 inverse via cofactor (brute force)
  const m = sXX;
  const det = m[0]*(m[4]*m[8]-m[5]*m[7]) - m[1]*(m[3]*m[8]-m[5]*m[6]) + m[2]*(m[3]*m[7]-m[4]*m[6]);
  if (Math.abs(det) < 1e-12) return { alpha: ARX_ALPHA, beta: ARX_BETA, gamma: ARX_GAMMA, r2: 0.718 };
  const inv = [
    (m[4]*m[8]-m[5]*m[7])/det, (m[2]*m[7]-m[1]*m[8])/det, (m[1]*m[5]-m[2]*m[4])/det,
    (m[5]*m[6]-m[3]*m[8])/det, (m[0]*m[8]-m[2]*m[6])/det, (m[2]*m[3]-m[0]*m[5])/det,
    (m[3]*m[7]-m[4]*m[6])/det, (m[1]*m[6]-m[0]*m[7])/det, (m[0]*m[4]-m[1]*m[3])/det,
  ];
  const beta = [0,0,0];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) beta[i] += inv[i*3+j] * sXy[j];

  const yMean = pairs.reduce((s,p) => s+p.hs, 0) / n;
  let ssTot = 0, ssRes = 0;
  for (const p of pairs) {
    const pred = beta[0]*p.hsPrev + beta[1]*p.uEast + beta[2];
    ssRes += (p.hs - pred)**2;
    ssTot += (p.hs - yMean)**2;
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

      // 3. Merge wind + wave by row index (shared time grid)
      const len    = Math.min(wind.length, wavesAll.length);
      const merged = [];
      for (let i = 1; i < len; i++) {
        const w = wind[i], wv = wavesAll[i], wPrev = wind[i-1];
        if (!w || !wv) continue;
        merged.push({
          idx:        i,
          time:       w.time,
          Ws:         +w.Ws.toFixed(3),
          Wd:         +w.Wd.toFixed(1),
          U_wind:     +w.U_wind.toFixed(3),
          V_wind:     +w.V_wind.toFixed(3),
          U_east:     +w.U_east.toFixed(3),
          U_east_lag: +wPrev.U_east.toFixed(3),
          Hs_prev:    +wavesAll[i-1].Hs.toFixed(3),
          Hs:         +wv.Hs.toFixed(3),
        });
      }

      const arx  = fitARX(merged);
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
