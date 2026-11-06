// Geocodificación para direcciones en Colombia usando Nominatim (OpenStreetMap).
// Se serializa a 1 solicitud por segundo para respetar la política de uso.
const cache = new Map();
const CACHE_LIMIT = 500;
const MIN_INTERVAL_MS = 1100;
const TIMEOUT_MS = 6000;

const USER_AGENT = process.env.GEOCODING_USER_AGENT || 'RutaColombia/1.0';
const ENABLED = process.env.NODE_ENV !== 'test';

let chain = Promise.resolve();
let lastRequestAt = 0;

function remember(key, value) {
  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value);
  cache.set(key, value);
  return value;
}

async function requestCoordinates(address) {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', address);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '1');
  url.searchParams.set('countrycodes', 'co');
  url.searchParams.set('accept-language', 'es');

  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  if (!response.ok) return null;

  const results = await response.json();
  const found = Array.isArray(results) ? results[0] : null;
  if (!found) return null;

  const lat = Number(found.lat);
  const lng = Number(found.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
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

async function geocodeAddress(address) {
  if (!ENABLED || typeof address !== 'string' || !address.trim()) return null;
  const key = address.trim().toLowerCase();
  if (cache.has(key)) return cache.get(key);

  try {
    const coordinates = await schedule(() => requestCoordinates(address));
    return remember(key, coordinates);
  } catch {
    return null;
  }
}

module.exports = { geocodeAddress };
