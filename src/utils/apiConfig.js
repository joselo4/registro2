export const getApiUrl = (endpoint) => {
  // En producción móvil (APK Capacitor), las rutas relativas fallan porque el origen es http://localhost.
  // Por lo tanto, necesitamos prependizar el dominio del backend web desplegado.
  const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
  return `${baseUrl}${endpoint}`;
};
