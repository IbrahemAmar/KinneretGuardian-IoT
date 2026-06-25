import * as XLSX from 'xlsx';
import { RandomForestClassifier } from 'ml-random-forest';

const FEATURE_NAMES = ['Ws', 'U_wind', 'V_wind', 'U_east'];

function labelRow(hs) {
  if (hs >= 0.5) return 2;
  if (hs >= 0.1) return 1;
  return 0;
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map(line => {
    const vals = line.split(',');
    return Object.fromEntries(headers.map((h, i) => [h, vals[i]?.trim().replace(/^"|"$/g, '')]));
  }).filter(r => Object.values(r).some(v => v !== ''));
}

function findCol(row, ...candidates) {
  for (const c of candidates) {
    const key = Object.keys(row).find(k => k.trim().toLowerCase() === c.toLowerCase());
    if (key !== undefined) return key;
  }
  return null;
}

function extractFeatures(rows) {
  if (!rows.length) return { X: [], y: [] };

  const wsKey = findCol(rows[0], 'Ws', 'ws', 'wind_speed', 'WindSpeed', 'speed');
  const wdKey = findCol(rows[0], 'Wd', 'wd', 'wind_dir', 'WindDir', 'direction', 'dir');
  const hsKey = findCol(rows[0], 'Hs', 'hs', 'wave_height', 'WaveHeight', 'height');

  if (!wsKey || !wdKey || !hsKey) {
    throw new Error(
      `Cannot find required columns. Need Ws/Wd/Hs (wind speed, wind direction, wave height). ` +
      `Found columns: ${Object.keys(rows[0]).join(', ')}`
    );
  }

  const X = [], y = [];
  for (const row of rows) {
    const ws = parseFloat(row[wsKey]);
    const wd = parseFloat(row[wdKey]);
    const hs = parseFloat(row[hsKey]);
    if (isNaN(ws) || isNaN(wd) || isNaN(hs)) continue;
    if (ws < 0 || ws > 40 || hs < 0 || hs > 5) continue;

    const r     = (wd * Math.PI) / 180;
    const uWind = ws * Math.sin(r);
    const vWind = ws * Math.cos(r);
    const uEast = -uWind;

    X.push([ws, uWind, vWind, uEast]);
    y.push(labelRow(hs));
  }
  return { X, y };
}

// Replaces sklearn class_weight='balanced' by oversampling minority classes
function oversample(X, y) {
  const byClass = [[], [], []];
  y.forEach((label, i) => byClass[label].push(i));
  const maxCount = Math.max(...byClass.map(c => c.length));

  const newX = [...X], newY = [...y];
  for (let cls = 0; cls < 3; cls++) {
    const indices = byClass[cls];
    if (!indices.length) continue;
    let needed = maxCount - indices.length;
    let ptr = 0;
    while (needed-- > 0) {
      newX.push(X[indices[ptr % indices.length]]);
      newY.push(cls);
      ptr++;
    }
  }
  return { X: newX, y: newY };
}

// Seeded Fisher-Yates shuffle (LCG)
function seededShuffle(X, y, seed = 42) {
  let s = seed >>> 0;
  const lcg = () => { s = Math.imul(1664525, s) + 1013904223; return (s >>> 0) / 4294967295; };
  const idx = Array.from({ length: X.length }, (_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(lcg() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return { X: idx.map(i => X[i]), y: idx.map(i => y[i]) };
}

function confusionMatrix(yTrue, yPred) {
  const cm = [[0,0,0],[0,0,0],[0,0,0]];
  for (let i = 0; i < yTrue.length; i++) cm[yTrue[i]][yPred[i]]++;
  return cm;
}

// Permutation importance: drop in accuracy when each feature column is shuffled
function permutationImportance(clf, X_test, y_test, baseAccuracy) {
  const importances = FEATURE_NAMES.map((name, fi) => {
    const Xshuf = X_test.map(row => [...row]);
    const col   = Xshuf.map(row => row[fi]);
    for (let i = col.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [col[i], col[j]] = [col[j], col[i]];
    }
    Xshuf.forEach((row, i) => { row[fi] = col[i]; });

    const preds = clf.predict(Xshuf);
    const acc   = preds.filter((p, i) => p === y_test[i]).length / y_test.length;
    return { name, raw: Math.max(0, baseAccuracy - acc) };
  });

  const total = importances.reduce((s, f) => s + f.raw, 0) || 1;
  return importances.map(f => ({ name: f.name, value: +(f.raw / total).toFixed(3) }));
}

export async function POST(req) {
  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!file) return Response.json({ ok: false, error: 'No file attached' }, { status: 400 });

    const name = file.name.toLowerCase();
    const buf  = await file.arrayBuffer();
    let rows;

    if (name.endsWith('.csv')) {
      rows = parseCSV(new TextDecoder().decode(buf));
    } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      const wb = XLSX.read(new Uint8Array(buf), { type: 'array', cellDates: true });
      rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null });
    } else {
      return Response.json({ ok: false, error: 'Only .csv, .xlsx, and .xls files are supported' }, { status: 400 });
    }

    const { X, y } = extractFeatures(rows);
    if (X.length < 20) {
      return Response.json(
        { ok: false, error: `Too few valid rows (${X.length}). Need at least 20 rows with Ws, Wd, Hs columns.` },
        { status: 400 }
      );
    }

    const shuffled = seededShuffle(X, y, 42);
    const split    = Math.floor(shuffled.X.length * 0.8);
    const X_train  = shuffled.X.slice(0, split);
    const y_train  = shuffled.y.slice(0, split);
    const X_test   = shuffled.X.slice(split);
    const y_test   = shuffled.y.slice(split);

    const balanced = oversample(X_train, y_train);

    const clf = new RandomForestClassifier({
      nEstimators:      100,
      maxDepth:         5,
      useSampleBagging: true,
      seed:             42,
    });
    clf.train(balanced.X, balanced.y);

    const preds    = clf.predict(X_test);
    const correct  = preds.filter((p, i) => p === y_test[i]).length;
    const accuracy = (correct / preds.length) * 100;

    const confusion        = confusionMatrix(y_test, preds);
    const featureImportance = permutationImportance(clf, X_test, y_test, accuracy / 100);

    const classCounts = { safe: 0, caution: 0, danger: 0 };
    for (const label of y) {
      if (label === 0) classCounts.safe++;
      else if (label === 1) classCounts.caution++;
      else classCounts.danger++;
    }

    return Response.json({
      ok: true,
      accuracy:        +accuracy.toFixed(1),
      confusion,
      featureImportance,
      trainSize:       X_train.length,
      testSize:        X_test.length,
      totalRows:       X.length,
      classCounts,
      fileName:        file.name,
    });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
