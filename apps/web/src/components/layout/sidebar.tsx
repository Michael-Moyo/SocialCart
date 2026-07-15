'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  Plug,
  MessageSquare,
  Megaphone,
  Gift,
  Settings,
  Zap,
  UsersRound,
  BarChart2,
  CreditCard,
  Rocket,
  Bot,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSettings } from '@/lib/api';

const PLAN_LABEL: Record<string, string> = {
  FREE: 'Free',
  STARTER: 'Starter',
  PRO: 'Pro',
  ENTERPRISE: 'Enterprise',
};

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/integrations', label: 'Integrations', icon: Plug },
  { href: '/dashboard/products', label: 'Products', icon: Package },
  { href: '/dashboard/orders', label: 'Orders', icon: ShoppingCart },
  { href: '/dashboard/customers', label: 'Customers', icon: Users },
  { href: '/dashboard/conversations', label: 'Conversations', icon: MessageSquare },
  { href: '/dashboard/campaigns', label: 'Campaigns', icon: Megaphone },
  { href: '/dashboard/flows', label: 'Bot Flows', icon: Bot },
  { href: '/dashboard/loyalty', label: 'Loyalty', icon: Gift },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart2 },
  { href: '/dashboard/payments', label: 'Payments', icon: CreditCard },
  { href: '/dashboard/team', label: 'Team', icon: UsersRound },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
  { href: '/dashboard/onboarding', label: 'Setup Guide', icon: Rocket },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: tenant } = useSettings();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 w-64 bg-gray-900 flex flex-col">
      {/* Logo */}
      <div className="flex items-center gap-2 px-6 py-5 border-b border-gray-800">
        <div className="w-8 h-8 bg-whatsapp rounded-lg flex items-center justify-center">
          <Zap className="h-5 w-5 text-white" />
        </div>
        <span className="text-white font-bold text-lg">SocialCart</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-brand-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-gray-800">
        <Link href="/dashboard/settings" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-800 transition-colors">
          <div className="w-8 h-8 rounded-full bg-[#25D366] flex items-center justify-center text-white text-sm font-bold shrink-0">
            {(tenant?.name ?? 'S')[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{tenant?.name ?? 'My Store'}</p>
            <p className="text-xs text-gray-400">{PLAN_LABEL[tenant?.plan ?? ''] ?? tenant?.plan ?? 'Free'} plan</p>
          </div>
        </Link>
      </div>
    </aside>
  );
}
