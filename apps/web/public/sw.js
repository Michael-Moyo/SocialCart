// SocialCart Service Worker — handles Web Push notifications

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'SocialCart', body: event.data.text() };
  }

  const options = {
    body: payload.body ?? '',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    tag: payload.type ?? 'default',
    renotify: true,
    data: payload.data ?? {},
    actions: getActions(payload.type),
    vibrate: [100, 50, 100],
  };

  event.waitUntil(
    self.registration.showNotification(payload.title ?? 'SocialCart', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data ?? {};
  let url = '/dashboard';

  if (data.conversationId) url = '/dashboard/conversations';
  else if (data.orderId || data.orderRef) url = '/dashboard/orders';
  else if (data.campaignName) url = '/dashboard/campaigns';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      clients.openWindow(url);
    })
  );
});

function getActions(type) {
  switch (type) {
    case 'NEW_CONVERSATION':
    case 'CONVERSATION_ASSIGNED':
      return [{ action: 'view', title: 'Open conversation' }];
    case 'NEW_ORDER':
      return [{ action: 'view', title: 'View order' }];
    case 'CART_ABANDONED':
      return [{ action: 'view', title: 'View cart' }];
    default:
      return [];
  }
}
