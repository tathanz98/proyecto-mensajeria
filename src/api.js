// En Vercel, las reglas de vercel.json encaminan /api al backend del mismo sitio.
// Para desarrollo local o Capacitor, define VITE_API_URL con la URL pública de la API.
const configuredApiUrl = import.meta.env.VITE_API_URL?.trim() || (import.meta.env.DEV ? 'http://localhost:3000' : '');

export const apiUrl = (path) => {
  const baseUrl = configuredApiUrl?.replace(/\/$/, '') || '';
  return `${baseUrl}${path}`;
};

export const realtimeApiUrl = configuredApiUrl || null;
