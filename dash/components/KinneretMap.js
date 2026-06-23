'use client';
import { MapContainer, TileLayer, Polygon, CircleMarker, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { KINNERET_POLYGON, STATIONS } from '@/lib/mockData';
import { classifyDanger } from '@/lib/dangerUtils';

export default function KinneretMap({ stationData = {} }) {

  return (
    <MapContainer
      center={[32.81, 35.59]}
      zoom={11}
      style={{ height: '420px', width: '100%', borderRadius: '12px', background: '#060e1c' }}
      className="z-0"
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
      />
      <Polygon
        positions={KINNERET_POLYGON}
        pathOptions={{ color: '#38bdf8', weight: 2, fillColor: '#0ea5e9', fillOpacity: 0.15 }}
      />
      {STATIONS.map(st => {
        const sd = stationData[st.key] ?? {};
        const hs = sd.hs ?? 0.12;
        const ws = sd.ws ?? 3.2;
        const danger = classifyDanger(hs, ws);
        return (
          <CircleMarker
            key={st.key}
            center={[st.lat, st.lon]}
            radius={16}
            pathOptions={{ color: danger.color, weight: 3, fillColor: danger.color, fillOpacity: 0.3 }}
          >
            <Tooltip permanent direction="top" offset={[0, -14]} className="kinneret-tooltip">
              <div style={{ background: '#0a1628', border: `1px solid ${danger.color}`, borderRadius: 6, padding: '4px 8px', color: '#e2e8f0', fontSize: 12, lineHeight: 1.4, minWidth: 80, textAlign: 'center' }}>
                <strong style={{ color: '#38bdf8' }}>{st.name}</strong><br />
                <span style={{ color: danger.color }}>{danger.level}</span><br />
                <span style={{ color: '#94a3b8' }}>Hs {hs.toFixed(2)}m · {ws.toFixed(1)}m/s</span>
              </div>
            </Tooltip>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
