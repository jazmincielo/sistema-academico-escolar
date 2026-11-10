import axios from 'axios';

const TOKEN_KEY = 'sae_token';
export const tokenStore = {
  get: () => sessionStorage.getItem(TOKEN_KEY),     // sessionStorage: se borra al cerrar la pestaña (UC-01 postcondición)
  set: (t) => sessionStorage.setItem(TOKEN_KEY, t),
  clear: () => sessionStorage.removeItem(TOKEN_KEY),
};

export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api', timeout: 15000 });

// Adjunta el JWT en cada petición: Authorization: Bearer <token>
api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Sesión vencida o token inválido → cerrar sesión
api.interceptors.response.use(
  (r) => r,
  (error) => {
    const url = error.config?.url || '';
    if (error.response?.status === 401 && !url.startsWith('/auth/')) {
      tokenStore.clear();
      window.dispatchEvent(new Event('sae:unauthorized'));
    }
    return Promise.reject(error);
  }
);

/** Mensaje legible para el usuario a partir de un error de Axios (incluye errores de red). */
export function errorMessage(error) {
  if (!error.response) return 'No se pudo conectar con el servidor. Revise su conexión e intente de nuevo.';
  const { message, details } = error.response.data || {};
  const extra = Array.isArray(details) ? ` (${details.map((d) => d.message).filter(Boolean).join('; ')})` : '';
  return (message || 'Ocurrió un error inesperado') + extra;
}

export async function downloadFile(url, filename) {
  const res = await api.get(url, { responseType: 'blob' });
  const href = URL.createObjectURL(res.data);
  const a = Object.assign(document.createElement('a'), { href, download: filename });
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(href);
}
