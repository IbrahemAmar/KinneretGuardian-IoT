export function classifyDanger(hs, ws) {
  if (hs >= 0.5 || ws >= 5.5)  return { level: 'Danger',  color: '#dc2626', glow: '#dc2626aa', ring: 'ring-red-600',    badge: 'bg-red-900/60 text-red-300 border border-red-700' };
  if (hs >= 0.1 || ws >= 3.3)  return { level: 'Caution', color: '#eab308', glow: '#eab308aa', ring: 'ring-yellow-500', badge: 'bg-yellow-900/60 text-yellow-300 border border-yellow-600' };
  return                               { level: 'Safe',    color: '#22c55e', glow: '#22c55eaa', ring: 'ring-green-600',  badge: 'bg-green-900/60 text-green-300 border border-green-700' };
}

export function windDir(deg) {
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return dirs[Math.round(deg / 22.5) % 16];
}

export function uEast(ws, wd) {
  const r = (wd * Math.PI) / 180;
  return -(ws * Math.sin(r));
}
