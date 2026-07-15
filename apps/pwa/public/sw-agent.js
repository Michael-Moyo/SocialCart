// SocialCart Agent Service Worker — push notifications for new customer messages

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload;
  try { payload = event.data.json(); } catch { payload = { title: 'New message', body: '' }; }

  event.waitUntil(
    self.registration.showNotification(payload.title ?? 'SocialCart Agent', {
      body: payload.body ?? '',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      tag: payload.conversationId ?? 'default',
      renotify: true,
      data: payload,
      vibrate: [200, 100, 200],
      actions: [{ action: 'open', title: 'Open chat' }],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const conversationId = event.notification.data?.conversationId;
  const url = conversationId ? `/agent/conversation/${conversationId}` : '/agent';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(self.location.origin)) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      clients.openWindow(url);
    })
  );
});
