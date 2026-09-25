import { apiUrl } from './apiClient';

// Anonymous funnel counts for the store's own conversion report: no personal
// data, only how many times each step happened. Events are batched and sent
// every few seconds, or when the page is hidden.
const FUNNEL = { visit: 'visit', ViewProduct: 'view_item', AddToCart: 'add_to_cart', InitiateCheckout: 'begin_checkout' };
const pending = {};
let timer = null;
let listening = false;

function flush(useBeacon = false) {
  if (timer) { clearTimeout(timer); timer = null; }
  const events = { ...pending };
  Object.keys(pending).forEach(key => { delete pending[key]; });
  if (!Object.keys(events).length) return;
  const body = JSON.stringify({ events });
  try {
    if (useBeacon && typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon(apiUrl('/api/track'), new Blob([body], { type: 'application/json' }));
      return;
    }
    fetch(apiUrl('/api/track'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
  } catch {
    // Analytics must never affect shopping.
  }
}

export function recordFunnelEvent(name) {
  const event = FUNNEL[name];
  if (!event || typeof window === 'undefined') return;
  pending[event] = (pending[event] || 0) + 1;
  if (!listening) {
    listening = true;
    document.addEventListener('visibilitychange', () => { if (document.hidden) flush(true); });
    window.addEventListener('pagehide', () => flush(true));
  }
  if (!timer) timer = setTimeout(() => flush(false), 8000);
}

// One visit per browser tab session.
export function recordVisit() {
  try {
    if (sessionStorage.getItem('friozo_visit_counted')) return;
    sessionStorage.setItem('friozo_visit_counted', '1');
  } catch {
    // Without session storage a visit may be counted again; acceptable.
  }
  recordFunnelEvent('visit');
}
