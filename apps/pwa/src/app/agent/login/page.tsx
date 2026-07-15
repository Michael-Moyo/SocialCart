'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

const api = axios.create({ baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001' });

type Tab = 'email' | 'otp';

export default function AgentLoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('email');

  // Email+password state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // OTP state
  const [phone, setPhone] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function startCooldown() {
    setResendCooldown(60);
    const iv = setInterval(() => setResendCooldown((c) => { if (c <= 1) { clearInterval(iv); return 0; } return c - 1; }), 1000);
  }

  async function loginEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await api.post<{ success: boolean; data: { token: string; member: { id: string; name: string; email: string | null; phone: string | null; role: string; tenantId: string } } }>(
        '/api/v1/team/login',
        { email, password }
      );
      localStorage.setItem('agent_token', res.data.data.token);
      localStorage.setItem('agent_profile', JSON.stringify(res.data.data.member));
      router.push('/agent');
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  }

  async function requestOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await api.post('/api/v1/team/otp/request', { phone });
      setOtpSent(true);
      startCooldown();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await api.post<{
        success: boolean;
        data: {
          token: string;
          member: { id: string; name: string; email: string | null; phone: string | null; role: string; tenantId: string };
        };
      }>('/api/v1/team/otp/verify', { phone, code: otp });
      localStorage.setItem('agent_token', res.data.data.token);
      localStorage.setItem('agent_profile', JSON.stringify(res.data.data.member));
      router.push('/agent');
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#075E54] flex flex-col items-center justify-center px-6">
      <div className="text-center mb-8">
        <div className="text-5xl mb-3">💬</div>
        <h1 className="text-white text-2xl font-bold">SocialCart Agent</h1>
        <p className="text-[#25D366] text-sm mt-1">Sign in to handle customer conversations</p>
      </div>

      <div className="w-full max-w-sm bg-white rounded-2xl overflow-hidden shadow-2xl">
        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          {(['email', 'otp'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(''); setOtpSent(false); }}
              className={`flex-1 py-3.5 text-sm font-semibold transition-colors ${
                tab === t ? 'text-[#075E54] border-b-2 border-[#25D366]' : 'text-gray-400'
              }`}
            >
              {t === 'email' ? 'Email & Password' : 'WhatsApp OTP'}
            </button>
          ))}
        </div>

        <div className="p-6">
          {tab === 'email' ? (
            <form onSubmit={loginEmail} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="agent@store.com"
                  required
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#25D366] focus:ring-1 focus:ring-[#25D366]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#25D366] focus:ring-1 focus:ring-[#25D366]"
                />
              </div>
              {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#25D366] text-white font-semibold py-3 rounded-xl text-sm disabled:opacity-50 active:scale-95 transition-transform"
              >
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
            </form>
          ) : (
            <form onSubmit={otpSent ? verifyOtp : requestOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">WhatsApp Number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 234 567 8900"
                  required
                  disabled={otpSent}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#25D366] focus:ring-1 focus:ring-[#25D366] disabled:bg-gray-50"
                />
              </div>
              {otpSent && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">6-digit code</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    required
                    autoFocus
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-2xl text-center tracking-[0.5em] font-mono text-gray-900 focus:outline-none focus:border-[#25D366] focus:ring-1 focus:ring-[#25D366]"
                  />
                </div>
              )}
              {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
              <button
                type="submit"
                disabled={loading || (otpSent && otp.length < 6)}
                className="w-full bg-[#25D366] text-white font-semibold py-3 rounded-xl text-sm disabled:opacity-50 active:scale-95 transition-transform"
              >
                {loading ? '…' : otpSent ? 'Verify Code' : 'Send OTP'}
              </button>
              {otpSent && (
                <div className="flex justify-between text-xs text-gray-400">
                  <button type="button" onClick={() => { setOtpSent(false); setOtp(''); setError(''); }}>
                    Change number
                  </button>
                  <button
                    type="button"
                    disabled={resendCooldown > 0}
                    onClick={async () => {
                      setLoading(true);
                      try { await api.post('/api/v1/team/otp/request', { phone }); startCooldown(); } catch {}
                      setLoading(false);
                    }}
                    className="text-[#25D366] disabled:opacity-50"
                  >
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend'}
                  </button>
                </div>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
