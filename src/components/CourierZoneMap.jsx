import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const courierIcon = L.divIcon({
  className: 'custom-marker',
  html: `<div style="background-color: #10b981; width: 36px; height: 36px; display: flex; justify-content: center; align-items: center; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 15px rgba(16,185,129,0.8);"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"></circle><line x1="12" y1="2" x2="12" y2="5"></line><line x1="12" y1="19" x2="12" y2="22"></line><line x1="2" y1="12" x2="5" y2="12"></line><line x1="19" y1="12" x2="22" y2="12"></line></svg></div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18]
});

const orderIcon = L.divIcon({
  className: 'custom-marker',
  html: `<div style="background-color: #f59e0b; width: 30px; height: 30px; display: flex; justify-content: center; align-items: center; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.35);"><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-6 9 6v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"></path><path d="M9 21V12h6v9"></path></svg></div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15]
});

// Ajusta el encuadre una sola vez por zona: el círculo completo debe quedar visible.
function FitZone({ center, radiusKm }) {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
      // Convertir el radio a grados evita que el círculo quede cortado en cualquier latitud.
      const latDelta = radiusKm / 111.32;
      const lngDelta = radiusKm / (111.32 * Math.max(0.2, Math.cos((center[0] * Math.PI) / 180)));
      map.fitBounds(
        [
          [center[0] - latDelta, center[1] - lngDelta],
          [center[0] + latDelta, center[1] + lngDelta]
        ],
        { padding: [12, 12], maxZoom: 14 }
      );
    }, 120);
    return () => clearTimeout(timer);
  }, [map, center[0], center[1], radiusKm]);
  return null;
}

export default function CourierZoneMap({ location, radiusKm, orders = [] }) {
  const center = [location[0], location[1]];

  return (
    <div style={{ height: '100%', minHeight: '220px', borderRadius: '16px', overflow: 'hidden', position: 'relative' }}>
      <MapContainer
        center={center}
        zoom={12}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
        attributionControl={false}
        dragging
        scrollWheelZoom={false}
      >
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          className="leaflet-dark-tiles"
        />
        <FitZone center={center} radiusKm={radiusKm} />
        <Circle
          center={center}
          radius={radiusKm * 1000}
          pathOptions={{ color: '#10b981', weight: 2, opacity: 0.8, fillColor: '#10b981', fillOpacity: 0.12 }}
        />
        {orders
          .filter(order => Number.isFinite(order.pickupLat) && Number.isFinite(order.pickupLng))
          .map(order => (
            <Marker key={order.id} position={[order.pickupLat, order.pickupLng]} icon={orderIcon} />
          ))}
        <Marker position={center} icon={courierIcon} zIndexOffset={1000} />
      </MapContainer>
    </div>
  );
}
