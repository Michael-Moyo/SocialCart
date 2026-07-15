'use client';

import { NotificationBell } from '@/components/notifications/notification-bell';
import { PushNotificationManager } from '@/components/notifications/push-manager';

export function TopBar() {
  return (
    <header className="flex-shrink-0 h-14 bg-gray-900 border-b border-gray-800 flex items-center justify-end px-6 gap-2">
      <PushNotificationManager />
      <NotificationBell />
    </header>
  );
}
