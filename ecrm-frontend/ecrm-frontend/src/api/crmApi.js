import axios from 'axios';

// Detecta automáticamente el entorno de ejecución
const API_BASE_URL = import.meta.env.DEV 
  ? 'http://ecrm.alwaysdata.net/api'  // Desarrollo local: Apunta a tu API en AlwaysData
  : '/api';                           // Producción: Usa rutas relativas

const crmApi = axios.create({
  baseURL: API_BASE_URL,
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