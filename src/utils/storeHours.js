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
