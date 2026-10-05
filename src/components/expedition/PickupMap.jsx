import { useEffect } from 'react';
import {
  MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { isValidPoint } from '../../services/routingService';
import { TILE_URL, TILE_ATTRIBUTION } from '../../utils/mapTiles';

// Carte de l'enlèvement à domicile : l'agence de départ (fixe) et le point
// d'enlèvement, que le client place d'un tap ou en déplaçant le marqueur.
// L'itinéraire routier (calculé par le parent) est tracé entre les deux.

const pin = (bg, label) => L.divIcon({
  className: '',
  html: `<div style="width:30px;height:30px;border-radius:9999px;background:${bg};color:#fff;display:flex;align-items:center;justify-content:center;font:700 12px/1 system-ui,sans-serif;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)">${label}</div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
  popupAnchor: [0, -15],
});
const AGENCY_ICON = pin('#1e3a8a', 'Ag');
const PICKUP_ICON = pin('#16a34a', 'A');

// Abidjan, si on n'a ni agence géolocalisée ni point d'enlèvement.
const DEFAULT_CENTER = [5.345, -4.024];

function ClickToPlace({ onPlace }) {
  useMapEvents({ click: (e) => onPlace(e.latlng.lat, e.latlng.lng) });
  return null;
}

// Recadre sur l'agence et le point quand `focusKey` change (choix d'agence,
// position GPS) — pas pendant que le client déplace le marqueur à la main.
function Frame({ points, focusKey }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 1) map.setView(points[0], 15);
    else if (points.length > 1) map.fitBounds(points, { padding: [36, 36], maxZoom: 16 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, focusKey]);
  return null;
}

export default function PickupMap({ agence, point, onPlace, route, focusKey }) {
  const agencyOk = isValidPoint(agence);
  const pointOk = isValidPoint(point);
  const points = [agencyOk && [agence.lat, agence.lng], pointOk && [point.lat, point.lng]].filter(Boolean);
  const center = points[0] || DEFAULT_CENTER;

  return (
    <div className="overflow-hidden rounded-xl border border-surface-200">
      <div className="h-56 w-full">
        <MapContainer center={center} zoom={13} zoomControl={false} className="h-full w-full">
          <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} maxZoom={19} />
          <ClickToPlace onPlace={onPlace} />
          <Frame points={points} focusKey={focusKey} />
          {route && (
            <Polyline positions={route.coords} pathOptions={{ color: '#16a34a', weight: 5, opacity: 0.85, dashArray: route.approx ? '6 8' : undefined }} />
          )}
          {agencyOk && (
            <Marker position={[agence.lat, agence.lng]} icon={AGENCY_ICON}>
              <Popup>Agence : {agence.nom}</Popup>
            </Marker>
          )}
          {pointOk && (
            <Marker
              position={[point.lat, point.lng]}
              icon={PICKUP_ICON}
              draggable
              eventHandlers={{ dragend: (e) => { const ll = e.target.getLatLng(); onPlace(ll.lat, ll.lng); } }}
            >
              <Popup>Point d'enlèvement</Popup>
            </Marker>
          )}
        </MapContainer>
      </div>
    </div>
  );
}
