// Service worker for ThinkBiz web push notifications.
//
// Receives push payloads from lib/notifications/push-server.ts (JSON with
// title/body/url/tag) and renders them; clicking focuses an existing tab or
// opens the deep link.

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: 'ThinkBiz', body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'ThinkBiz Solutions';
  const options = {
    body: payload.body || '',
    icon: '/icon-192.png',
    badge: '/badge.png',
    tag: payload.tag,
    data: { url: payload.url || '/dashboard' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/dashboard';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus an existing tab on the same origin if one is open.
      for (const client of clientList) {
        if ('focus' in client) {
          try {
            const url = new URL(client.url);
            const target = new URL(targetUrl, self.location.origin);
            if (url.origin === target.origin) {
              client.navigate(target.href);
              return client.focus();
            }
          } catch {
            // fall through to openWindow
          }
        }
      }
      return self.clients.openWindow(targetUrl);
    }),
  );
});
