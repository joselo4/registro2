// ESTANDARIZACIÓN DE FECHA Y HORA (PERÚ UTC-5)

// 1. Obtener la Fecha Actual exacta de Perú para la Base de Datos
// Retorna formato ISO con offset explícito: "2026-01-17T21:30:05.000-05:00"
export const getPeruDate = (): string => {
  const now = new Date();
  
  // Extraemos las partes exactas de la hora en Lima
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Lima',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
    fractionalSecondDigits: 3
  });

  const parts = formatter.formatToParts(now);
  const getPart = (type: string) => parts.find(p => p.type === type)?.value || '00';

  const year = getPart('year');
  const month = getPart('month');
  const day = getPart('day');
  const hour = getPart('hour');
  const minute = getPart('minute');
  const second = getPart('second');
  const fractional = getPart('fractionalSecond'); // milisegundos

  // Reconstruimos manualmente con la etiqueta -05:00 para que Supabase sepa que es Perú
  return `${year}-${month}-${day}T${hour}:${minute}:${second}.${fractional}-05:00`;
};

// 2. Mostrar la fecha en pantalla (Convierte cualquier fecha guardada a Hora Perú)
// Entrada: "2026-01-18T02:00:00Z" -> Salida: "17/01 21:00"
export const formatPeruDate = (isoString: string) => {
  if (!isoString) return '-';
  const date = new Date(isoString);
  
  return new Intl.DateTimeFormat('es-PE', { 
    timeZone: 'America/Lima', 
    day: '2-digit', 
    month: '2-digit', 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false
  }).format(date);
};

// 3. Helper para inputs de fecha (Retorna solo YYYY-MM-DD de Perú)
export const getPeruDateString = () => {
    return getPeruDate().split('T')[0];
}