export const apiBase = import.meta.env.VITE_API_URL?.replace(/\/$/, '') || (import.meta.env.DEV ? 'http://localhost:3000' : '');

export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'No fue posible completar la solicitud.');
  return data;
}
