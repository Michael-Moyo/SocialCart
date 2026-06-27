'use client';

import { useState, useEffect } from 'react';
import {
  User,
  MessageSquare,
  Lock,
  Bot,
  CreditCard,
  CheckCircle,
  AlertCircle,
  Eye,
  EyeOff,
  Copy,
  ExternalLink,
  Clock,
} from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  useSettings,
  useUpdateProfile,
  useUpdatePassword,
  useUpdateWhatsApp,
  useUpdateBotSettings,
  type TenantSettings,
} from '@/lib/api';
import { cn } from '@/lib/utils';

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        <p className="text-sm text-gray-500 mt-0.5">{description}</p>
      </div>
      <div className="px-6 py-5 space-y-4">{children}</div>
    </div>
  );
}

// ─── Form field ───────────────────────────────────────────────────────────────

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 items-start">
      <div className="sm:pt-2">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
      </div>
      <div className="sm:col-span-2">{children}</div>
    </div>
  );
}

function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 focus:border-[#25D366] disabled:bg-gray-50 disabled:text-gray-400',
        className
      )}
      {...props}
    />
  );
}

function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      rows={3}
      className={cn(
        'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 focus:border-[#25D366] resize-none',
        className
      )}
      {...props}
    />
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <div
        onClick={() => onChange(!checked)}
        className={cn(
          'relative w-10 h-5.5 rounded-full transition-colors duration-200',
          checked ? 'bg-[#25D366]' : 'bg-gray-200'
        )}
        style={{ height: '22px' }}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200',
            checked && 'translate-x-[18px]'
          )}
        />
      </div>
      {label && <span className="text-sm text-gray-700">{label}</span>}
    </label>
  );
}

function Toast({ message, type }: { message: string; type: 'success' | 'error' }) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 text-sm px-4 py-2 rounded-lg',
        type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
      )}
    >
      {type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
      {message}
    </div>
  );
}

// ─── Tab nav ─────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
  { id: 'bot', label: 'Bot Config', icon: Bot },
  { id: 'security', label: 'Security', icon: Lock },
  { id: 'plan', label: 'Plan & Billing', icon: CreditCard },
] as const;

type TabId = (typeof TABS)[number]['id'];

// ─── Profile section ─────────────────────────────────────────────────────────

function ProfileSection() {
  const { data } = useSettings();
  const update = useUpdateProfile();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (data) {
      setName(data.name);
      setEmail(data.email ?? '');
    }
  }, [data]);

  async function save() {
    try {
      await update.mutateAsync({ name, email: email || null });
      setToast({ message: 'Profile updated', type: 'success' });
    } catch {
      setToast({ message: 'Failed to update profile', type: 'error' });
    }
    setTimeout(() => setToast(null), 3000);
  }

  return (
    <Section title="Business Profile" description="Update your store name and contact details">
      <Field label="Store name">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="My Store" />
      </Field>
      <Field label="Phone number" hint="Used to log in — cannot be changed">
        <Input value={data?.phone ?? ''} disabled />
      </Field>
      <Field label="Email address">
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </Field>
      <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
        <Button onClick={save} loading={update.isPending}>
          Save changes
        </Button>
        {toast && <Toast {...toast} />}
      </div>
    </Section>
  );
}

// ─── WhatsApp section ─────────────────────────────────────────────────────────

function WhatsAppSection() {
  const { data } = useSettings();
  const update = useUpdateWhatsApp();
  const [businessId, setBusinessId] = useState('');
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [verifyToken, setVerifyToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (data) {
      setBusinessId(data.whatsappBusinessId ?? '');
      setPhoneNumberId(data.whatsappPhoneNumberId ?? '');
      setVerifyToken(data.settings.webhookVerifyToken ?? '');
    }
  }, [data]);

  const webhookUrl =
    typeof window !== 'undefined'
      ? `${window.location.protocol}//${window.location.host}/api/v1/whatsapp/webhook`
      : '/api/v1/whatsapp/webhook';

  async function save() {
    try {
      await update.mutateAsync({
        whatsappBusinessId: businessId,
        whatsappPhoneNumberId: phoneNumberId,
        ...(accessToken && { whatsappAccessToken: accessToken }),
        webhookVerifyToken: verifyToken,
      });
      setAccessToken('');
      setToast({ message: 'WhatsApp settings saved', type: 'success' });
    } catch {
      setToast({ message: 'Failed to save settings', type: 'error' });
    }
    setTimeout(() => setToast(null), 3000);
  }

  function copyWebhookUrl() {
    void navigator.clipboard.writeText(webhookUrl);
  }

  return (
    <Section
      title="WhatsApp Business API"
      description="Connect your Meta WhatsApp Business account to enable in-chat commerce"
    >
      {/* Webhook URL (read-only) */}
      <div className="bg-gray-50 rounded-lg p-4 space-y-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Webhook URL — paste this in your Meta App settings
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-xs text-gray-700 font-mono break-all">{webhookUrl}</code>
          <button
            onClick={copyWebhookUrl}
            className="p-1.5 rounded hover:bg-gray-200 text-gray-500 hover:text-gray-700"
            title="Copy webhook URL"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          <a
            href="https://developers.facebook.com/apps"
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded hover:bg-gray-200 text-gray-500 hover:text-gray-700"
            title="Open Meta Developer Portal"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      <Field label="WhatsApp Business ID" hint="From Meta Business Manager">
        <Input
          value={businessId}
          onChange={(e) => setBusinessId(e.target.value)}
          placeholder="123456789012345"
        />
      </Field>
      <Field label="Phone Number ID" hint="From your WhatsApp Business account">
        <Input
          value={phoneNumberId}
          onChange={(e) => setPhoneNumberId(e.target.value)}
          placeholder="123456789012345"
        />
      </Field>
      <Field label="Access Token" hint="Permanent system user token — stored encrypted">
        <div className="relative">
          <Input
            type={showToken ? 'text' : 'password'}
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            placeholder={data?.settings.whatsappAccessToken ? '••••••••••••••••' : 'Paste token here'}
            className="pr-10"
          />
          <button
            onClick={() => setShowToken((v) => !v)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {data?.settings.whatsappAccessToken && (
          <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
            <CheckCircle className="h-3 w-3" /> Token configured — leave blank to keep existing
          </p>
        )}
      </Field>
      <Field label="Webhook Verify Token" hint="Must match the token set in Meta Developer Portal">
        <Input
          value={verifyToken}
          onChange={(e) => setVerifyToken(e.target.value)}
          placeholder="my-secret-verify-token"
        />
      </Field>
      <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
        <Button onClick={save} loading={update.isPending}>
          Save WhatsApp settings
        </Button>
        {toast && <Toast {...toast} />}
      </div>
    </Section>
  );
}

// ─── Bot Config section ───────────────────────────────────────────────────────

const TIMEZONES = [
  'Africa/Lagos',
  'Africa/Nairobi',
  'Africa/Johannesburg',
  'Asia/Kolkata',
  'America/New_York',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
];

const CURRENCIES = ['NGN', 'USD', 'KES', 'ZAR', 'INR', 'GBP', 'EUR', 'GHS'];

function BotSection() {
  const { data } = useSettings();
  const update = useUpdateBotSettings();
  const [form, setForm] = useState<TenantSettings>({
    botEnabled: true,
    greetingMessage: '',
    currency: 'USD',
    timezone: 'Africa/Lagos',
    workingHoursEnabled: false,
    workingHoursStart: '09:00',
    workingHoursEnd: '18:00',
    offlineMessage: '',
  });
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (data?.settings) {
      setForm((prev) => ({ ...prev, ...data.settings }));
    }
  }, [data]);

  function set<K extends keyof TenantSettings>(key: K, value: TenantSettings[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    try {
      await update.mutateAsync(form);
      setToast({ message: 'Bot settings saved', type: 'success' });
    } catch {
      setToast({ message: 'Failed to save settings', type: 'error' });
    }
    setTimeout(() => setToast(null), 3000);
  }

  return (
    <Section title="Bot Configuration" description="Control how the WhatsApp bot greets and serves your customers">
      <Field label="Bot enabled" hint="Toggle the AI conversation bot on or off">
        <Toggle
          checked={form.botEnabled ?? true}
          onChange={(v) => set('botEnabled', v)}
          label={form.botEnabled ? 'Bot is active' : 'Bot is disabled'}
        />
      </Field>

      <Field label="Greeting message" hint="Sent when a new customer messages for the first time">
        <Textarea
          value={form.greetingMessage ?? ''}
          onChange={(e) => set('greetingMessage', e.target.value)}
          placeholder="Hi! Welcome to our store 👋 How can we help you today?"
        />
      </Field>

      <Field label="Default currency">
        <select
          value={form.currency ?? 'USD'}
          onChange={(e) => set('currency', e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 focus:border-[#25D366]"
        >
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </Field>

      <Field label="Timezone">
        <select
          value={form.timezone ?? 'Africa/Lagos'}
          onChange={(e) => set('timezone', e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 focus:border-[#25D366]"
        >
          {TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>{tz}</option>
          ))}
        </select>
      </Field>

      <div className="border-t border-gray-100 pt-4 space-y-4">
        <Field label="Working hours" hint="Bot replies outside hours with an offline message">
          <Toggle
            checked={form.workingHoursEnabled ?? false}
            onChange={(v) => set('workingHoursEnabled', v)}
            label={form.workingHoursEnabled ? 'Enabled' : 'Always available'}
          />
        </Field>

        {form.workingHoursEnabled && (
          <>
            <Field label="Hours">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 flex-1">
                  <Clock className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <Input
                    type="time"
                    value={form.workingHoursStart ?? '09:00'}
                    onChange={(e) => set('workingHoursStart', e.target.value)}
                  />
                </div>
                <span className="text-gray-400 text-sm">to</span>
                <div className="flex items-center gap-2 flex-1">
                  <Clock className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <Input
                    type="time"
                    value={form.workingHoursEnd ?? '18:00'}
                    onChange={(e) => set('workingHoursEnd', e.target.value)}
                  />
                </div>
              </div>
            </Field>

            <Field label="Offline message">
              <Textarea
                value={form.offlineMessage ?? ''}
                onChange={(e) => set('offlineMessage', e.target.value)}
                placeholder="We're currently offline. We'll reply during business hours. Thank you!"
              />
            </Field>
          </>
        )}
      </div>

      <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
        <Button onClick={save} loading={update.isPending}>
          Save bot settings
        </Button>
        {toast && <Toast {...toast} />}
      </div>
    </Section>
  );
}

// ─── Security section ─────────────────────────────────────────────────────────

function SecuritySection() {
  const update = useUpdatePassword();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  async function save() {
    if (next !== confirm) {
      setToast({ message: 'New passwords do not match', type: 'error' });
      setTimeout(() => setToast(null), 3000);
      return;
    }
    if (next.length < 8) {
      setToast({ message: 'Password must be at least 8 characters', type: 'error' });
      setTimeout(() => setToast(null), 3000);
      return;
    }
    try {
      await update.mutateAsync({ currentPassword: current, newPassword: next });
      setCurrent('');
      setNext('');
      setConfirm('');
      setToast({ message: 'Password updated successfully', type: 'success' });
    } catch {
      setToast({ message: 'Current password is incorrect', type: 'error' });
    }
    setTimeout(() => setToast(null), 4000);
  }

  return (
    <Section title="Security" description="Update your account password">
      <Field label="Current password">
        <Input
          type="password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          placeholder="••••••••"
          autoComplete="current-password"
        />
      </Field>
      <Field label="New password" hint="At least 8 characters">
        <Input
          type="password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          placeholder="••••••••"
          autoComplete="new-password"
        />
      </Field>
      <Field label="Confirm new password">
        <Input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="••••••••"
          autoComplete="new-password"
        />
      </Field>
      {next && confirm && next !== confirm && (
        <p className="text-xs text-red-500 flex items-center gap-1">
          <AlertCircle className="h-3.5 w-3.5" /> Passwords do not match
        </p>
      )}
      <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
        <Button onClick={save} loading={update.isPending} disabled={!current || !next || !confirm}>
          Update password
        </Button>
        {toast && <Toast {...toast} />}
      </div>
    </Section>
  );
}

// ─── Plan section ─────────────────────────────────────────────────────────────

const PLAN_FEATURES: Record<string, { label: string; color: string; features: string[] }> = {
  FREE: {
    label: 'Free',
    color: 'text-gray-700 bg-gray-100',
    features: ['500 conversations/month', '1 WhatsApp number', '1 integration', 'Basic analytics'],
  },
  STARTER: {
    label: 'Growth',
    color: 'text-blue-700 bg-blue-100',
    features: ['5,000 conversations/month', '1 WhatsApp number', '3 integrations', 'Abandoned cart recovery', 'Analytics dashboard'],
  },
  PRO: {
    label: 'Pro',
    color: 'text-purple-700 bg-purple-100',
    features: ['25,000 conversations/month', '3 WhatsApp numbers', 'All integrations', 'Smart broadcasts', 'Loyalty program', 'Priority support'],
  },
  ENTERPRISE: {
    label: 'Enterprise',
    color: 'text-orange-700 bg-orange-100',
    features: ['Unlimited conversations', 'Unlimited numbers', 'All integrations', 'Custom AI training', 'Dedicated manager', 'SLA guarantee'],
  },
};

function PlanSection() {
  const { data } = useSettings();
  const plan = data?.plan ?? 'FREE';
  const planInfo = PLAN_FEATURES[plan] ?? PLAN_FEATURES['FREE']!;

  return (
    <Section title="Plan & Billing" description="Your current subscription and usage">
      <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn('text-sm font-semibold px-2.5 py-0.5 rounded-full', planInfo.color)}>
              {planInfo.label}
            </span>
            <Badge status="ACTIVE" />
          </div>
          <p className="text-sm text-gray-600 mt-2 mb-3">Your plan includes:</p>
          <ul className="space-y-1.5">
            {planInfo.features.map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm text-gray-700">
                <CheckCircle className="h-3.5 w-3.5 text-[#25D366] flex-shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </div>
        {plan !== 'ENTERPRISE' && (
          <div className="text-right">
            <Button variant="outline" size="sm">
              Upgrade plan
            </Button>
          </div>
        )}
      </div>

      {plan === 'FREE' && (
        <div className="bg-gradient-to-r from-[#25D366]/10 to-blue-50 rounded-xl p-4 border border-[#25D366]/20">
          <p className="text-sm font-semibold text-gray-900 mb-1">Unlock the full platform</p>
          <p className="text-sm text-gray-600 mb-3">
            Upgrade to Growth to unlock abandoned cart recovery, analytics, and up to 5,000 conversations per month.
          </p>
          <Button size="sm">
            View pricing
          </Button>
        </div>
      )}

      <div className="border-t border-gray-100 pt-4">
        <p className="text-xs text-gray-400">
          Member since{' '}
          {data?.createdAt
            ? new Date(data.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
            : '—'}
        </p>
      </div>
    </Section>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [tab, setTab] = useState<TabId>('profile');

  return (
    <div className="flex-1 overflow-y-auto">
      <Header title="Settings" description="Manage your account, WhatsApp connection, and bot behaviour" />

      <div className="p-6 max-w-3xl">
        {/* Tab bar */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6 overflow-x-auto">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex-1 justify-center',
                tab === id
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'profile' && <ProfileSection />}
        {tab === 'whatsapp' && <WhatsAppSection />}
        {tab === 'bot' && <BotSection />}
        {tab === 'security' && <SecuritySection />}
        {tab === 'plan' && <PlanSection />}
      </div>
    </div>
  );
}
