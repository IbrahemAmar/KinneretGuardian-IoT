export const STATIONS = [
  { key: 'Lev_Kinneret', name: 'Lev Kinneret', lat: 32.822, lon: 35.591, scale: 1.00 },
  { key: 'Bteha',        name: 'Bteha',         lat: 32.887, lon: 35.624, scale: 1.05 },
  { key: 'Ginosar',      name: 'Ginosar',        lat: 32.861, lon: 35.520, scale: 0.70 },
  { key: 'Zemah',        name: 'Zemah',          lat: 32.706, lon: 35.577, scale: 0.90 },
  { key: 'Ein_Gev',      name: 'Ein Gev',        lat: 32.777, lon: 35.646, scale: 1.20 },
];

export const KINNERET_POLYGON = [
  [32.924, 35.541],[32.907, 35.573],[32.891, 35.641],[32.865, 35.661],
  [32.839, 35.663],[32.810, 35.658],[32.793, 35.660],[32.760, 35.640],
  [32.730, 35.620],[32.710, 35.592],[32.695, 35.578],[32.700, 35.548],
  [32.710, 35.528],[32.730, 35.509],[32.760, 35.501],[32.780, 35.501],
  [32.810, 35.508],[32.840, 35.508],[32.851, 35.513],[32.875, 35.522],
  [32.898, 35.530],[32.924, 35.541],
];

export function generateMockData(n = 120) {
  const data = [];
  let hs = 0.12, ws = 3.2, wd = 215;
  for (let i = 0; i < n; i++) {
    ws += (3.5 - ws) * 0.1 + (Math.random() - 0.5) * 0.6;
    ws = Math.max(0.1, Math.min(9, ws));
    wd += (Math.random() - 0.5) * 25;
    wd = ((wd % 360) + 360) % 360;
    const r = (wd * Math.PI) / 180;
    const uWind = ws * Math.sin(r);
    const vWind = ws * Math.cos(r);
    const uEast = -uWind;
    hs = 0.68 * hs + 0.12 * Math.max(0, uEast) + 0.045 + (Math.random() - 0.5) * 0.04;
    hs = Math.max(0, Math.min(1.2, hs));
    const t = new Date(Date.now() - (n - i) * 3600000);
    data.push({ time: t.toISOString(), Ws: ws, Wd: wd, U_wind: uWind, V_wind: vWind, U_east: uEast, Hs: hs });
  }
  return data;
}

export const PCA_SCREE = [
  { pc: 'PC1', variance: 44.2, cumulative: 44.2 },
  { pc: 'PC2', variance: 28.5, cumulative: 72.7 },
  { pc: 'PC3', variance: 15.1, cumulative: 87.8 },
  { pc: 'PC4', variance: 8.3,  cumulative: 96.1 },
  { pc: 'PC5', variance: 3.9,  cumulative: 100.0 },
];

export const RF_CONFUSION = [[18,2,0],[1,25,3],[0,2,12]];
export const RF_ACCURACY  = 87.3;

export const FEATURE_IMPORTANCE = [
  { name: 'U_east', value: 0.381 },
  { name: 'Ws',     value: 0.287 },
  { name: 'U_wind', value: 0.195 },
  { name: 'V_wind', value: 0.137 },
];

export const RAG_PAPERS = [
  { id: 1, title: 'Effect of wind variability on topographic waves', authors: 'Shilo et al.', journal: 'JGR: Oceans', year: 2006 },
  { id: 2, title: 'Summer Circulation and Temperature Structure of Lake Kinneret', authors: 'Laval et al.', journal: 'JPO', year: 2003 },
  { id: 3, title: 'Wind, currents and temperature in Lake Kinneret', authors: 'Serruya, S.', journal: 'Verhandlungen', year: 1975 },
  { id: 4, title: 'Seiche-induced resuspension in Lake Kinneret', authors: 'Nishri et al.', journal: 'Water, Air & Soil Pollution', year: 1997 },
  { id: 5, title: 'Physical controls on spatial evolution of dinoflagellate bloom', authors: 'Ng et al.', journal: 'Limnology & Oceanography', year: 2011 },
];

export const RAG_QA = [
  {
    q: 'How do wind fields dictate short-term wave adjustments in Lake Kinneret?',
    a: 'Wind fields exert the dominant control on short-term wave dynamics in Lake Kinneret. The eastward wind component (U_east) shows the strongest cross-correlation with wave height at a 1-hour lag (r ≈ 0.72), indicating that changes in the wind field manifest in wave energy within 60 minutes. Shilo et al. (2006) demonstrated that topographic steering channels the prevailing south-westerly winds, amplifying U_east near Station Ein Gev by up to 20% relative to the central lake. Serruya (1975) further showed that sustained U_east > 3 m/s reliably triggers seiching motions, compounding surface wave heights through resonant basin effects.',
    papers: [1, 3],
  },
  {
    q: 'How does an increase in wind speed affect wave height?',
    a: 'Wave height (Hs) scales non-linearly with wind speed. Our ARX model shows Hs(t) = 0.68·Hs(t-1) + 0.12·U_east(t-1) + 0.045, where the 0.12 coefficient on the eastward component captures direct wind-wave coupling. A sustained wind increase of 1 m/s in U_east increases equilibrium Hs by ≈ 0.375 m over 3–6 hours. Laval et al. (2003) found that summer thermocline depth modulates this relationship — stronger stratification reduces mixing, concentrating wind energy in the surface layer and amplifying wave response by 15–25%.',
    papers: [2, 4],
  },
  {
    q: 'How does wind direction affect drift velocity fields near Station F?',
    a: 'Wind direction determines circulation patterns through Ekman drift and lake-scale gyres. South-westerly winds (215–235°) generate a clockwise surface gyre that accelerates currents near the eastern stations (Bteha, Ein Gev) by 30–40%. Ng et al. (2011) documented how this directional forcing controls the spatial aggregation of phytoplankton blooms near the northern basin. Seiche nodes identified by Nishri et al. (1997) are sensitive to wind direction shifts > 45°, which can reverse drift velocities at mid-lake stations within 2–3 hours.',
    papers: [4, 5],
  },
];
