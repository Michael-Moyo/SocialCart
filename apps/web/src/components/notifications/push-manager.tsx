'use client';

import { useEffect, useRef } from 'react';
import { api } from '@/lib/api';

export function PushNotificationManager() {
  const registered = useRef(false);

  useEffect(() => {
    if (registered.current) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    registered.current = true;

    (async () => {
      try {
        // Get VAPID public key
        const { data } = await api.get<{ success: boolean; data: { publicKey: string } }>(
          '/api/v1/notifications/push/vapid-key'
        );
        const publicKey = data.data.publicKey;
        if (!publicKey) return;

        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;

        const registration = await navigator.serviceWorker.ready;
        let sub = await registration.pushManager.getSubscription();

        if (!sub) {
          sub = await registration.pushManager.subscribe({
            userAgent: navigator.userAgent,
            applicationServerKey: urlBase64ToUint8Array(publicKey),
          });
        }

        const json = sub.toJSON();
        await api.post('/api/v1/notifications/push/subscribe', {
          endpoint: sub.endpoint,
          keys: { p256dh: json.keys?.['p256dh'], auth: json.keys?.['auth'] },
          userAgent: navigator.userAgent,
        });
      } catch {
        // Push subscription is best-effort — ignore errors silently
      }
    })();
  }, []);

  return null;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}
