// Rutas vehiculares para Colombia con OSRM público (OpenStreetMap, sin API key).
// Se cachean por tramo y se serializan para no saturar el servidor de demostración.
const cache = new Map();
const CACHE_LIMIT = 500;
const CACHE_TTL_MS = 5 * 60 * 1000;
const MIN_INTERVAL_MS = 250;
const TIMEOUT_MS = 6000;

// Si el servidor principal falla se intenta el espejo de FOSSGIS (también sin API key).
const BASE_URLS = process.env.ROUTING_BASE_URL
  ? [process.env.ROUTING_BASE_URL.replace(/\/$/, '')]
  : ['https://router.project-osrm.org', 'https://routing.openstreetmap.de/routed-car'];
const ENABLED = process.env.NODE_ENV !== 'test';

let chain = Promise.resolve();
let lastRequestAt = 0;

const round = value => value.toFixed(4);
const cacheKey = (from, to, profile) => `${profile}:${round(from[0])},${round(from[1])};${round(to[0])},${round(to[1])}`;

function remember(key, value) {
  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value);
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}

function recall(key) {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return entry.value;
}

function schedule(task) {
  const run = async () => {
    const wait = Math.max(0, MIN_INTERVAL_MS - (Date.now() - lastRequestAt));
    if (wait) await new Promise(resolve => setTimeout(resolve, wait));
    lastRequestAt = Date.now();
    return task();
  };
  chain = chain.then(run, run);
  return chain;
}

async function requestFromBase(baseUrl, from, to, profile) {
  const url = `${baseUrl}/route/v1/${profile}/${from[1]},${from[0]};${to[1]},${to[0]}`
    + '?overview=full&geometries=geojson&alternatives=false&steps=false';

  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  if (!response.ok) return null;

  const body = await response.json();
  const route = Array.isArray(body?.routes) ? body.routes[0] : null;
  const geometry = Array.isArray(route?.geometry?.coordinates) ? route.geometry.coordinates : [];
  if (!route || geometry.length < 2) return null;

  return {
    // OSRM entrega [lng, lat]; el mapa usa [lat, lng].
    coordinates: geometry
      .filter(point => Array.isArray(point) && point.length >= 2)
      .map(point => [Number(point[1]), Number(point[0])]),
    distance: Number(route.distance) || 0,
    duration: Number(route.duration) || 0
  };
}

async function requestRoute(from, to, profile) {
  for (const baseUrl of BASE_URLS) {
    try {
      const route = await requestFromBase(baseUrl, from, to, profile);
      if (route) return route;
    } catch {
      // Se intenta el siguiente servidor.
    }
  }
  return null;
}

async function drivingRoute(from, to, profile = 'driving') {
  if (!ENABLED) return null;
  if (!Array.isArray(from) || !Array.isArray(to) || from.length < 2 || to.length < 2) return null;

  const key = cacheKey(from, to, profile);
  const cached = recall(key);
  if (cached !== undefined) return cached;

  try {
    const route = await schedule(() => requestRoute(from, to, profile));
    return remember(key, route);
  } catch {
    return remember(key, null);
  }
}

module.exports = { drivingRoute };
