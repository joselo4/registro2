// First-party sales funnel: anonymous daily counters kept in helados_sync,
// so the admin panel has conversion data without GA4 server secrets.
export const FUNNEL_EVENTS = ['visit', 'view_item', 'add_to_cart', 'begin_checkout', 'view_3d', 'repeat_order'];
export const MAX_PER_EVENT = 30; // per request, so one client cannot inflate the numbers much

export const limaDay = (date = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);

// Each day's counters are split across rows so many simultaneous visitors rarely
// compete for the same row; the report adds the rows back together.
export const FUNNEL_SHARDS = 64;
export const funnelKey = (day, shard = null) => (shard === null ? `funnel_${day}` : `funnel_${day}_${shard}`);
// Overflow rows hold a batch that could not join a shard during a burst; they never conflict.
export const funnelOverflowKey = (day, id) => `funnel_${day}_x${id}`;
export const funnelDayFromKey = key => String(key || '').match(/^funnel_(\d{4}-\d{2}-\d{2})(?:_\d{1,3}|_x[a-z0-9]{4,40})?$/)?.[1] || null;

// Keeps only known events with sane, bounded counts.
export function cleanFunnelEvents(events) {
  if (!events || typeof events !== 'object' || Array.isArray(events)) return {};
  return Object.fromEntries(FUNNEL_EVENTS
    .map(name => [name, Math.floor(Number(events[name]))])
    .filter(([, count]) => Number.isFinite(count) && count > 0)
    .map(([name, count]) => [name, Math.min(MAX_PER_EVENT, count)]));
}

export const addCounts = (current, events) => {
  const next = { ...(current && typeof current === 'object' ? current : {}) };
  for (const [name, count] of Object.entries(events)) next[name] = (Number(next[name]) || 0) + count;
  return next;
};
