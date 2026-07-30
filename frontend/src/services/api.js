import axios from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api/',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Flag para evitar bucles infinitos de refresh
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });

  isRefreshing = false;
  failedQueue = [];
};

// Interceptor de peticiones
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor de respuestas CON REFRESH AUTOMÁTICO Y TOASTS
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Si es 401 y no es una petición de refresh
    if (
      error.response?.status === 401 &&
      !originalRequest.url.includes('/token/refresh/')
    ) {
      if (isRefreshing) {
        // Si ya estamos refrescando, encolar la petición
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: () => resolve(api(originalRequest)),
            reject: (err) => reject(err),
          });
        });
      }

      isRefreshing = true;
      const refreshToken = localStorage.getItem('refresh_token');

      if (!refreshToken) {
        // No hay refresh token, ir a login
        localStorage.clear();
        window.location.href = '/login';
        return Promise.reject(error);
      }

      try {
        // Intentar renovar el token
        const { data } = await axios.post(
          `${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/'}token/refresh/`,
          { refresh: refreshToken },
          { timeout: 5000 }
        );

        // Guardar el nuevo access token
        localStorage.setItem('access_token', data.access);

        // Si hay nuevo refresh token, guardarlo también
        if (data.refresh) {
          localStorage.setItem('refresh_token', data.refresh);
        }

        // Actualizar el header de la petición original
        originalRequest.headers.Authorization = `Bearer ${data.access}`;

        // Procesar la cola de peticiones fallidas
        processQueue(null, data.access);

        // Reintentar la petición original
        return api(originalRequest);
      } catch (refreshError) {
        // Error al refrescar, limpiar sesión y ir a login
        localStorage.clear();
        toast.error('Sesión expirada. Por favor ingresa de nuevo.');
        window.location.href = '/login';
        processQueue(refreshError, null);
        return Promise.reject(refreshError);
      }
    }

    // Mostrar un toast para errores 400 y 500 globalmente si no se silencian
    if (error.response) {
      if (error.response.status === 400 && !originalRequest.url.includes('/auth/pin/')) {
        const errorMsg = error.response.data?.error || 'Solicitud incorrecta';
        toast.error(errorMsg);
      } else if (error.response.status >= 500) {
        toast.error('Error interno del servidor');
      }
    } else if (error.request) {
      toast.error('No se pudo conectar al servidor');
    }

    return Promise.reject(error);
  }
);

export default api;

