const EARTH_RADIUS_KM = 6371;

// Distancia en kilómetros entre dos coordenadas [lat, lng].
export function distanceKm(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return null;
  const [lat1, lng1] = a;
  const [lat2, lng2] = b;
  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return null;

  const toRadians = degrees => (degrees * Math.PI) / 180;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export const formatKm = value => (value >= 10 ? `${Math.round(value)} km` : `${value.toFixed(1)} km`);
