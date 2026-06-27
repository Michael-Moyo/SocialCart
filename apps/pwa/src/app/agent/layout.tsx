'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { isLoggedIn } from '@/lib/agent-api';

export default function AgentLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!isLoggedIn() && pathname !== '/agent/login') {
      router.replace('/agent/login');
    } else {
      setChecked(true);
    }
  }, [pathname, router]);

  if (!checked && pathname !== '/agent/login') return null;

  const isConversation = pathname.startsWith('/agent/conversation/');

  return (
    <div className="flex flex-col h-screen bg-white overflow-hidden">
      <main className="flex-1 overflow-hidden">{children}</main>

      {/* Bottom nav — hidden when in thread view (full-screen) */}
      {!isConversation && (
        <nav className="flex-shrink-0 flex border-t border-gray-100 bg-white">
          <NavItem href="/agent" label="Chats" active={pathname === '/agent'}>
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
            </svg>
          </NavItem>
          <NavItem href="/agent/search" label="Search" active={pathname === '/agent/search'}>
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
            </svg>
          </NavItem>
          <NavItem href="/agent/profile" label="Profile" active={pathname === '/agent/profile'}>
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
          </NavItem>
        </nav>
      )}
    </div>
  );
}

function NavItem({ href, label, active, children }: { href: string; label: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} className={`flex-1 flex flex-col items-center gap-0.5 py-3 text-[10px] font-medium transition-colors ${active ? 'text-[#25D366]' : 'text-gray-400'}`}>
      {children}
      {label}
    </Link>
  );
}
