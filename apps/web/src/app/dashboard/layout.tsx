'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { TopBar } from '@/components/layout/topbar';
import { Suspense } from 'react';

function ImpersonationHandler() {
  const params = useSearchParams();

  useEffect(() => {
    const token = params.get('impersonate');
    if (token) {
      localStorage.setItem('sc_token', token);
      // Remove the param from URL without triggering a full reload
      const url = new URL(window.location.href);
      url.searchParams.delete('impersonate');
      window.history.replaceState({}, '', url.toString());
    }
  }, [params]);

  return null;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Suspense>
        <ImpersonationHandler />
      </Suspense>
      <Sidebar />
      <div className="flex-1 ml-64 flex flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-hidden flex flex-col">
          {children}
        </main>
      </div>
    </div>
  );
}
