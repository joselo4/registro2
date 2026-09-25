/**
 * Utilidades de seguridad, sanitización defensiva y almacenamiento web seguro.
 */

/**
 * Sanitiza texto eliminando bloques <script>, <style> y todas las etiquetas HTML para prevenir ataques XSS.
 * Seguro ante valores null, undefined, numéricos u objetos.
 * @param {any} text 
 * @returns {string} Texto limpio sin scripts ni etiquetas HTML
 */
export const sanitizeHTML = (text) => {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]*>/g, '')
    .trim();
};

/**
 * Sanitiza texto eliminando scripts, etiquetas HTML y caracteres de control no imprimibles,
 * recortando espacios y limitando la longitud máxima.
 * @param {any} text 
 * @param {number} [maxLength=1000] 
 * @returns {string} Texto seguro
 */
export const sanitizeText = (text, maxLength = 1000) => {
  if (text === null || text === undefined) return '';
  const sanitized = sanitizeHTML(text)
    // Elimina caracteres de control no imprimibles (excepto espacio, salto de línea y tabulación)
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim();
  return maxLength && sanitized.length > maxLength ? sanitized.slice(0, maxLength) : sanitized;
};

/**
 * Normaliza un número telefónico removiendo caracteres no permitidos.
 * Conserva dígitos y prefijo '+' opcional.
 * @param {any} phone 
 * @returns {string} Teléfono limpio
 */
export const sanitizePhone = (phone) => {
  if (phone === null || phone === undefined) return '';
  return String(phone).replace(/[^\d+]/g, '').trim();
};

/**
 * Valida y asegura que una URL pertenezca a los protocolos seguros http o https.
 * Bloquea esquemas peligrosos como javascript:, data:, vbscript: o URLs con barra relativa '//'.
 * @param {string} url 
 * @returns {string} URL segura o cadena vacía si es inválida
 */
export const sanitizeUrlToHTTPS = (url) => {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (/^(javascript:|data:|vbscript:|\/\/)/i.test(trimmed)) {
    return '';
  }
  try {
    const parsed = new URL(trimmed, 'https://localhost');
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return trimmed;
    }
  } catch {
    return '';
  }
  return '';
};

const isPlainObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * Envoltorio defensivo para Web Storage (localStorage).
 * Protege contra errores de cuota, modo incógnito restringido o cookies bloqueadas.
 */
export const safeStorage = {
  getItem: (key, fallback = null) => {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return fallback;
      const val = window.localStorage.getItem(key);
      return val !== null ? val : fallback;
    } catch {
      return fallback;
    }
  },
  setItem: (key, value) => {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return false;
      window.localStorage.setItem(key, String(value));
      return true;
    } catch {
      return false;
    }
  },
  removeItem: (key) => {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return false;
      window.localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  },
  getJSON: (key, fallback = null) => {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return fallback;
      const val = window.localStorage.getItem(key);
      if (!val) return fallback;
      const parsed = JSON.parse(val);
      // A corrupted or legacy value must not replace a list or settings object.
      if (Array.isArray(fallback) && !Array.isArray(parsed)) return fallback;
      if (isPlainObject(fallback) && !isPlainObject(parsed)) return fallback;
      if (typeof fallback === 'boolean' && typeof parsed !== 'boolean') return fallback;
      return parsed ?? fallback;
    } catch {
      return fallback;
    }
  },
  setJSON: (key, value) => {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return false;
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }
};
