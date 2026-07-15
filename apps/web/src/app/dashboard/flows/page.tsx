'use client';

import { Bot, ShoppingCart, Package, MessageSquare, RotateCcw, ListOrdered, CheckCircle, XCircle } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { useBotFlows, useToggleBotFlow, type BotFlow } from '@/lib/api';
import { cn } from '@/lib/utils';

const FLOW_ICONS: Record<string, React.ElementType> = {
  'main-menu':    Bot,
  'browse':       Package,
  'cart':         ShoppingCart,
  'checkout':     ListOrdered,
  'order-status': MessageSquare,
  'cart-recovery':RotateCcw,
};

const CATEGORY_LABEL: Record<string, string> = {
  core:       'Core',
  commerce:   'Commerce',
  support:    'Support',
  automation: 'Automation',
};

const CATEGORY_COLOR: Record<string, string> = {
  core:       'bg-gray-700 text-gray-300',
  commerce:   'bg-green-900 text-green-400',
  support:    'bg-blue-900 text-blue-400',
  automation: 'bg-purple-900 text-purple-400',
};

function FlowCard({ flow }: { flow: BotFlow }) {
  const toggle = useToggleBotFlow();
  const Icon = FLOW_ICONS[flow.id] ?? Bot;
  const isToggling = toggle.isPending && (toggle.variables as { flowId: string } | undefined)?.flowId === flow.id;

  return (
    <div className={cn(
      'bg-gray-900 border rounded-2xl p-5 transition-all',
      flow.enabled ? 'border-gray-800' : 'border-gray-800 opacity-60'
    )}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
            flow.enabled ? 'bg-[#25D366]/20' : 'bg-gray-800'
          )}>
            <Icon className={cn('h-5 w-5', flow.enabled ? 'text-[#25D366]' : 'text-gray-500')} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-white font-semibold text-sm">{flow.name}</h3>
              <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full', CATEGORY_COLOR[flow.category] ?? 'bg-gray-700 text-gray-400')}>
                {CATEGORY_LABEL[flow.category] ?? flow.category}
              </span>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed">{flow.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {flow.enabled ? (
            <span className="flex items-center gap-1 text-xs text-green-400 font-medium">
              <CheckCircle className="h-3.5 w-3.5" /> Active
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-gray-500 font-medium">
              <XCircle className="h-3.5 w-3.5" /> Disabled
            </span>
          )}

          {flow.canDisable ? (
            <button
              onClick={() => toggle.mutate({ flowId: flow.id, enabled: !flow.enabled })}
              disabled={isToggling}
              className={cn(
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-50',
                flow.enabled ? 'bg-[#25D366]' : 'bg-gray-700'
              )}
            >
              <span
                className={cn(
                  'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200',
                  flow.enabled ? 'translate-x-6' : 'translate-x-1'
                )}
              />
            </button>
          ) : (
            <span
              className="relative inline-flex h-6 w-11 items-center rounded-full bg-[#25D366] cursor-not-allowed"
              title="This flow cannot be disabled"
            >
              <span className="inline-block h-4 w-4 translate-x-6 transform rounded-full bg-white shadow" />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

const CATEGORY_ORDER = ['core', 'commerce', 'support', 'automation'];

export default function FlowsPage() {
  const { data: flows = [], isLoading } = useBotFlows();

  const grouped = CATEGORY_ORDER.reduce<Record<string, BotFlow[]>>((acc, cat) => {
    acc[cat] = flows.filter((f) => f.category === cat);
    return acc;
  }, {});

  const activeCount = flows.filter((f) => f.enabled).length;

  return (
    <div className="flex-1 overflow-y-auto">
      <Header
        title="Bot Flows"
        description="Manage which conversation flows your WhatsApp bot supports"
        actions={
          <span className="text-sm text-gray-400">
            <span className="text-white font-semibold">{activeCount}</span> / {flows.length} flows active
          </span>
        }
      />

      <div className="p-6 space-y-8 max-w-3xl">
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 animate-pulse">
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-xl bg-gray-800" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-800 rounded w-1/3" />
                    <div className="h-3 bg-gray-800 rounded w-3/4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          CATEGORY_ORDER.map((cat) => {
            const catFlows = grouped[cat] ?? [];
            if (catFlows.length === 0) return null;
            return (
              <div key={cat}>
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  {CATEGORY_LABEL[cat] ?? cat}
                </h2>
                <div className="space-y-3">
                  {catFlows.map((flow) => (
                    <FlowCard key={flow.id} flow={flow} />
                  ))}
                </div>
              </div>
            );
          })
        )}

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-yellow-900/50 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-sm">💡</span>
            </div>
            <div>
              <p className="text-sm font-medium text-white mb-1">About bot flows</p>
              <p className="text-sm text-gray-400 leading-relaxed">
                Flows define how your WhatsApp bot handles customer conversations. Core flows cannot be disabled as they are required for the shopping experience. Disabling optional flows removes them from the main menu — customers won't see those options.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
