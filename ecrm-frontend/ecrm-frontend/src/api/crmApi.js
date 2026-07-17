import axios from 'axios';

const crmApi = axios.create({
  // Lee la variable de Railway en producción, o usa /api en local
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
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      localStorage.removeItem('crm_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default crmApi;