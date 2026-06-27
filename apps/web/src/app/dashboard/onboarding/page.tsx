'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  Circle,
  ArrowRight,
  MessageSquare,
  ShoppingBag,
  Bot,
  CreditCard,
  Users,
  User,
  ChevronRight,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface OnboardingStatus {
  steps: {
    profile: boolean;
    whatsapp: boolean;
    integration: boolean;
    products: boolean;
    payments: boolean;
    team: boolean;
  };
  completed: number;
  total: number;
  pct: number;
}

// ─── Step definitions ─────────────────────────────────────────────────────────

const STEPS = [
  {
    key: 'profile' as const,
    icon: User,
    title: 'Complete your profile',
    description: 'Add your store name and business email so customers know who they\'re chatting with.',
    action: '/dashboard/settings',
    actionLabel: 'Go to Settings',
  },
  {
    key: 'whatsapp' as const,
    icon: MessageSquare,
    title: 'Connect WhatsApp Business',
    description: 'Link your WhatsApp Business API credentials so the bot can send and receive messages.',
    action: '/dashboard/settings',
    actionLabel: 'Configure WhatsApp',
    tip: 'You\'ll need your WhatsApp Business Account ID, Phone Number ID, and a permanent access token from Meta Business Manager.',
  },
  {
    key: 'integration' as const,
    icon: ShoppingBag,
    title: 'Connect your store',
    description: 'Integrate your Shopify, WooCommerce, or other platform so the bot can look up products and orders.',
    action: '/dashboard/integrations',
    actionLabel: 'Add Integration',
    tip: 'SocialCart supports Shopify, WooCommerce, and custom integrations via webhooks.',
  },
  {
    key: 'products' as const,
    icon: ShoppingBag,
    title: 'Add your products',
    description: 'Make sure at least one product is synced so customers can browse and buy.',
    action: '/dashboard/products',
    actionLabel: 'View Products',
  },
  {
    key: 'payments' as const,
    icon: CreditCard,
    title: 'Set up payments',
    description: 'Configure Paystack, Flutterwave, or manual payment collection so the bot can send checkout links.',
    action: '/dashboard/settings',
    actionLabel: 'Configure Payments',
    tip: 'Your API keys are stored encrypted and never exposed to customers.',
  },
  {
    key: 'team' as const,
    icon: Users,
    title: 'Invite your team',
    description: 'Add agents and managers so conversations can be assigned and handled by the right person.',
    action: '/dashboard/team',
    actionLabel: 'Manage Team',
  },
] as const;

// ─── Step Card ────────────────────────────────────────────────────────────────

function StepCard({
  step,
  done,
  active,
  index,
  onClick,
}: {
  step: (typeof STEPS)[number];
  done: boolean;
  active: boolean;
  index: number;
  onClick: () => void;
}) {
  const Icon = step.icon;

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left p-4 rounded-xl border transition-all',
        done
          ? 'border-green-200 bg-green-50'
          : active
          ? 'border-[#25D366] bg-white shadow-md'
          : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold',
            done
              ? 'bg-green-500 text-white'
              : active
              ? 'bg-[#25D366] text-white'
              : 'bg-gray-100 text-gray-500'
          )}
        >
          {done ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <p className={cn('text-sm font-semibold', done ? 'text-green-700 line-through opacity-70' : 'text-gray-900')}>
            {step.title}
          </p>
          <p className="text-xs text-gray-500 truncate mt-0.5">{step.description}</p>
        </div>
        <ChevronRight className={cn('h-4 w-4 flex-shrink-0', active ? 'text-[#25D366]' : 'text-gray-300')} />
      </div>
    </button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [activeStep, setActiveStep] = useState(0);

  const { data, isLoading } = useQuery<OnboardingStatus>({
    queryKey: ['onboarding'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: OnboardingStatus }>('/settings/onboarding');
      return res.data.data;
    },
    refetchInterval: 10_000,
  });

  const completeMutation = useMutation({
    mutationFn: () => api.patch('/settings/onboarding/complete'),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['onboarding'] });
      router.push('/dashboard');
    },
  });

  const steps = data?.steps;
  const pct = data?.pct ?? 0;
  const allDone = pct === 100;

  const currentStep = STEPS[activeStep];
  const isDone = steps ? steps[currentStep?.key ?? 'profile'] : false;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Set up SocialCart</h1>
        <p className="text-gray-500 mt-1">Complete these steps to start selling on WhatsApp</p>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">{data?.completed ?? 0} of {data?.total ?? 6} steps complete</span>
            <span className="text-sm font-bold text-[#25D366]">{pct}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#25D366] rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: step list */}
        <div className="lg:col-span-2 space-y-2">
          {STEPS.map((step, i) => (
            <StepCard
              key={step.key}
              step={step}
              done={steps?.[step.key] ?? false}
              active={activeStep === i}
              index={i}
              onClick={() => setActiveStep(i)}
            />
          ))}
        </div>

        {/* Right: detail panel */}
        <div className="lg:col-span-3">
          {currentStep && (
            <div className="bg-white border border-gray-200 rounded-xl p-6 sticky top-6">
              <div className="flex items-center gap-3 mb-4">
                <div className={cn(
                  'w-10 h-10 rounded-xl flex items-center justify-center',
                  isDone ? 'bg-green-100' : 'bg-[#25D366]/10'
                )}>
                  <currentStep.icon className={cn('h-5 w-5', isDone ? 'text-green-600' : 'text-[#25D366]')} />
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900">{currentStep.title}</h2>
                  {isDone && (
                    <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Complete
                    </span>
                  )}
                </div>
              </div>

              <p className="text-sm text-gray-600 mb-4 leading-relaxed">{currentStep.description}</p>

              {'tip' in currentStep && currentStep.tip && (
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-4">
                  <p className="text-xs text-blue-700 leading-relaxed">
                    <span className="font-semibold">Tip: </span>{currentStep.tip}
                  </p>
                </div>
              )}

              <div className="flex items-center gap-3 mt-6">
                <Button
                  onClick={() => router.push(currentStep.action)}
                  className="flex items-center gap-2"
                >
                  {currentStep.actionLabel}
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>

                {activeStep < STEPS.length - 1 && (
                  <Button
                    variant="outline"
                    onClick={() => setActiveStep((s) => s + 1)}
                    className="flex items-center gap-2"
                  >
                    Next step
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Finish banner */}
          {allDone && (
            <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-6 text-center">
              <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto mb-3" />
              <h3 className="font-bold text-gray-900 text-lg mb-1">You&apos;re all set! 🎉</h3>
              <p className="text-sm text-gray-600 mb-4">
                SocialCart is fully configured. Your WhatsApp bot is ready to take orders.
              </p>
              <Button
                onClick={() => completeMutation.mutate()}
                disabled={completeMutation.isPending}
                className="flex items-center gap-2 mx-auto"
              >
                {completeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
                Go to Dashboard
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
