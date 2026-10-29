/* Friozo staff alerts. This worker only shows push notifications and opens the
   panel when one is tapped; it does not cache or intercept any request. */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('push', event => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'Friozo', body: event.data ? event.data.text() : '' };
  }
  const title = String(data.title || 'Friozo').slice(0, 120);
  const options = {
    body: String(data.body || '').slice(0, 240),
    tag: String(data.tag || 'friozo'),
    renotify: true,
    requireInteraction: Boolean(data.requireInteraction),
    icon: '/logo.png',
    badge: '/favicon.ico',
    vibrate: [250, 120, 250, 120, 250],
    data: { url: typeof data.url === 'string' && data.url.startsWith('/') ? data.url : '/#admin' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/#admin', self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const open = windows.find(client => new URL(client.url).origin === self.location.origin);
    if (open) {
      await open.focus();
      if ('navigate' in open && open.url !== target) await open.navigate(target).catch(() => {});
      return;
    }
    await self.clients.openWindow(target);
  })());
});
