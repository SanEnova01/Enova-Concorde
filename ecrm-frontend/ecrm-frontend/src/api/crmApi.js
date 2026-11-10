import axios from 'axios';

const crmApi = axios.create({
  // Esto obliga a usar la URL del backend en producción
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// 🔒 INYECTOR MAESTRO: Adjunta el Token JWT en cada llamada de forma automática
crmApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('crm_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// CONTROL DE EXPIRACIÓN: Si el servidor dice que el token caducó (401/403), limpia y manda a Login
crmApi.interceptors.response.use(
  (response) => response,
  (error) => {
    // Solo se cierra sesión si el token falta o venció. Un 403 por falta de permiso
    // (p. ej. un cliente pidiendo datos de admin) no debe expulsar al usuario.
    const status = error.response?.status;
    const body = error.response?.data || {};
    const sesionVencida = status === 401 ||
      (status === 403 && (body.code === 'SESSION_EXPIRED' || /sesi[oó]n expirada/i.test(body.error || '')));
    if (sesionVencida) {
      localStorage.removeItem('crm_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// EL ÚNICO EXPORT QUE DEBE EXISTIR 👇
export default crmApi;