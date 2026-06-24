import * as XLSX from 'xlsx';

const GITHUB    = 'https://raw.githubusercontent.com/IbrahemAmar/KinneretGuardian-IoT/main/';
const WIND_FILE = 'data_202606172157.xlsx';

export const STATION_FILES = {
  KNW08: 'KNW08_Waves.xlsx',
  KNW09: 'KNW09_Waves.xlsx',
  KNW10: 'KNW10_Waves.xlsx',
  KNW11: 'KNW11_Waves.xlsx',
  KNW12: 'KNW12_Waves.xlsx',
};

const CACHE_TTL = 30 * 60 * 1000;        // 30 min — historical data changes rarely
const _cache    = new Map();              // station → { merged, availableDates, ts }
let   _windMemo = null;                   // shared wind dataset — same file for all stations
let   _windTs   = 0;

async function loadExcel(name) {
  const res = await fetch(GITHUB + name, { cache: 'no-store' });
  if (!res.ok) throw new Error(`GitHub fetch failed: ${name} (${res.status})`);
  const buf = await res.arrayBuffer();
  const wb  = XLSX.read(new Uint8Array(buf), { type: 'array', cellDates: true });
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null });
}

function parseWind(rows) {
  return rows.flatMap(row => {
    const vals = Object.values(row);
    const ws   = parseFloat(vals[1]);
    const wd   = parseFloat(vals[2]);
    if (isNaN(ws) || isNaN(wd) || ws <= 0 || ws > 40) return [];
    const rad   = (wd * Math.PI) / 180;
    const uEast = -(ws * Math.sin(rad));
    const raw0  = vals[0];
    const time  = raw0 instanceof Date
      ? raw0.toISOString()
      : raw0 != null ? String(raw0).trim().replace(/^(\d{4}-\d{2}-\d{2}) /, '$1T') : '';
    return [{ time, Ws: ws, Wd: wd, U_east: uEast }];
  });
}

function parseWaves(rows) {
  if (!rows.length) return [];
  const keys = Object.keys(rows[0]);
  const tKey = keys.find(k => /date|time/i.test(k)) ?? keys[0];
  const hKey = keys.find(k => /^Hs/i.test(k))       ?? keys[1];
  return rows.flatMap(r => {
    const hs = parseFloat(r[hKey]);
    if (isNaN(hs) || hs < 0 || hs > 1.2) return [];
    const rawT = r[tKey];
    const time = rawT instanceof Date ? rawT.toISOString() : rawT != null ? String(rawT) : '';
    return [{ time, Hs: hs }];
  });
}

function mergeData(wind, waves) {
  const len    = Math.min(wind.length, waves.length);
  const result = [];
  for (let i = 1; i < len; i++) {
    const w  = wind[i];
    const wv = waves[i];
    if (!w || !wv || !w.time) continue;
    result.push({
      idx:     i,
      time:    w.time,
      Ws:      +w.Ws.toFixed(3),
      Wd:      +w.Wd.toFixed(1),
      U_east:  +w.U_east.toFixed(3),
      Hs_prev: +waves[i - 1].Hs.toFixed(3),
      Hs:      +wv.Hs.toFixed(3),
    });
  }
  return result;
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const station = (searchParams.get('station') || 'KNW08').toUpperCase();
  const date    = searchParams.get('date') || '';

  if (!STATION_FILES[station]) {
    return Response.json({ ok: false, error: `Unknown station: ${station}` }, { status: 400 });
  }

  // Refresh per-station cache if stale
  let cached = _cache.get(station);
  if (!cached || Date.now() - cached.ts >= CACHE_TTL) {
    try {
      // Re-use wind data if recently fetched (shared across stations)
      if (!_windMemo || Date.now() - _windTs >= CACHE_TTL) {
        const windRaw = await loadExcel(WIND_FILE);
        _windMemo = parseWind(windRaw);
        _windTs   = Date.now();
      }

      const waveRaw = await loadExcel(STATION_FILES[station]);
      const waves   = parseWaves(waveRaw);
      const merged  = mergeData(_windMemo, waves);

      const availableDates = [...new Set(
        merged.map(r => r.time.slice(0, 10)).filter(Boolean)
      )].sort();

      cached = { merged, availableDates, ts: Date.now() };
      _cache.set(station, cached);
    } catch (err) {
      return Response.json({ ok: false, error: err.message }, { status: 200 });
    }
  }

  const rows = date
    ? cached.merged.filter(r => r.time.startsWith(date))
    : cached.merged.slice(-48);   // last 48 h when no date specified

  return Response.json({
    ok:             true,
    station,
    count:          rows.length,
    merged:         rows,
    availableDates: cached.availableDates,
  });
}
