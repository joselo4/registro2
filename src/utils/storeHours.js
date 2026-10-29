// All customers and the server use the store's clock, including overnight shifts.
export function isShopOpenCurrently(config, now = new Date()) {
  if (typeof config === 'boolean') return config;
  if (!config || config.open === false) return false;
  if (!config.useHours) return true;
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Lima', weekday: 'long', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now).map(part => [part.type, part.value]));
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const day = days.indexOf(parts.weekday.toLowerCase());
  const time = `${parts.hour}:${parts.minute}`;
  const valid = hours => hours?.enabled && /^\d{2}:\d{2}$/.test(hours.open) && /^\d{2}:\d{2}$/.test(hours.close);
  const today = config.hours?.[days[day]];
  const previous = config.hours?.[days[(day + 6) % 7]];
  if (valid(previous) && previous.open > previous.close && time < previous.close) return true;
  if (!valid(today)) return false;
  return today.open > today.close ? time >= today.open : time >= today.open && time < today.close;
}

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

const limaClock = (now) => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Lima', weekday: 'long', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now).map(part => [part.type, part.value]));
  return { day: DAYS.indexOf(parts.weekday.toLowerCase()), time: `${parts.hour}:${parts.minute}` };
};

// "15:00" → "3:00 p. m.", the way customers in Peru read the time.
export const formatHour = (hhmm) => {
  const [h, m] = String(hhmm).split(':').map(Number);
  const suffix = h < 12 ? 'a. m.' : 'p. m.';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, '0')} ${suffix}`;
};

/**
 * What a customer needs to know before ordering: open or closed, and until or
 * from when. Mirrors isShopOpenCurrently, including shifts past midnight.
 */
export function storeStatus(config, now = new Date()) {
  if (typeof config === 'boolean') return { open: config, label: config ? 'Abierto ahora' : 'Cerrado por ahora' };
  if (!config || config.open === false) return { open: false, label: 'Cerrado por ahora' };
  if (!config.useHours) return { open: true, label: 'Abierto ahora' };
  const valid = hours => hours?.enabled && /^\d{2}:\d{2}$/.test(hours.open) && /^\d{2}:\d{2}$/.test(hours.close);
  const { day, time } = limaClock(now);
  const today = config.hours?.[DAYS[day]];
  const previous = config.hours?.[DAYS[(day + 6) % 7]];
  if (isShopOpenCurrently(config, now)) {
    // Still inside last night's shift, or inside today's.
    const shift = valid(previous) && previous.open > previous.close && time < previous.close ? previous : today;
    return { open: true, label: `Abierto · cierra a las ${formatHour(shift.close)}` };
  }
  if (valid(today) && time < today.open) return { open: false, label: `Cerrado · abre hoy a las ${formatHour(today.open)}` };
  for (let ahead = 1; ahead <= 7; ahead++) {
    const next = config.hours?.[DAYS[(day + ahead) % 7]];
    if (!valid(next)) continue;
    const when = ahead === 1 ? 'mañana' : `el ${DAY_NAMES[(day + ahead) % 7]}`;
    return { open: false, label: `Cerrado · abre ${when} a las ${formatHour(next.open)}` };
  }
  return { open: false, label: 'Cerrado por ahora' };
}
