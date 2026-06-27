'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Zap, Phone, MessageSquare, Loader2, ArrowRight, CheckCircle } from 'lucide-react';
import axios from 'axios';

const api = axios.create({ baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001' });

type Step = 'phone' | 'otp';

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [isNew, setIsNew] = useState(false);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  async function requestOtp(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post<{ success: boolean; data: { isNew: boolean } }>('/api/v1/auth/otp/request', {
        phone,
        ...(name ? { name } : {}),
      });
      setIsNew(res.data.data.isNew);
      setStep('otp');
      startResendCooldown();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post<{ success: boolean; data: { token: string; tenant: { name: string } } }>(
        '/api/v1/auth/otp/verify',
        { phone, code: otp, ...(name ? { name } : {}) }
      );
      localStorage.setItem('sc_token', res.data.data.token);
      router.push('/dashboard');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'Invalid code. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function startResendCooldown() {
    setResendCooldown(60);
    const interval = setInterval(() => {
      setResendCooldown((c) => {
        if (c <= 1) { clearInterval(interval); return 0; }
        return c - 1;
      });
    }, 1000);
  }

  async function resend() {
    if (resendCooldown > 0) return;
    setError('');
    setLoading(true);
    try {
      await api.post('/api/v1/auth/otp/request', { phone, ...(name ? { name } : {}) });
      startResendCooldown();
    } catch {
      setError('Failed to resend. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 bg-[#25D366] rounded-xl flex items-center justify-center">
            <Zap className="h-6 w-6 text-white" />
          </div>
          <span className="text-white font-bold text-2xl">SocialCart</span>
        </div>

        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-8">
          {step === 'phone' ? (
            <>
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-[#25D366]/10 rounded-full mb-3">
                  <MessageSquare className="h-6 w-6 text-[#25D366]" />
                </div>
                <h1 className="text-xl font-bold text-white">Sign in with WhatsApp</h1>
                <p className="text-gray-400 text-sm mt-1">We'll send a code to your WhatsApp number</p>
              </div>

              <form onSubmit={requestOtp} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">WhatsApp Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+1 234 567 8900"
                      required
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#25D366] text-sm"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Include country code (e.g. +234 for Nigeria)</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">
                    Store Name <span className="text-gray-500">(new accounts only)</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="My Awesome Store"
                    className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#25D366] text-sm"
                  />
                </div>

                {error && <p className="text-sm text-red-400 bg-red-400/10 px-3 py-2 rounded-lg">{error}</p>}

                <button
                  type="submit"
                  disabled={loading || !phone}
                  className="w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1ea855] text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Send Code <ArrowRight className="h-4 w-4" /></>}
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-[#25D366]/10 rounded-full mb-3">
                  <CheckCircle className="h-6 w-6 text-[#25D366]" />
                </div>
                <h1 className="text-xl font-bold text-white">Enter your code</h1>
                <p className="text-gray-400 text-sm mt-1">
                  Sent to <span className="text-white font-medium">{phone}</span> via WhatsApp
                </p>
              </div>

              <form onSubmit={verifyOtp} className="space-y-4">
                {isNew && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">Store Name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="My Awesome Store"
                      required
                      className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#25D366] text-sm"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">6-digit code</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    required
                    autoFocus
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#25D366] text-2xl tracking-[0.5em] text-center font-mono"
                  />
                  <p className="text-xs text-gray-500 mt-1 text-center">Code expires in 5 minutes</p>
                </div>

                {error && <p className="text-sm text-red-400 bg-red-400/10 px-3 py-2 rounded-lg">{error}</p>}

                <button
                  type="submit"
                  disabled={loading || otp.length < 6}
                  className="w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1ea855] text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify & Sign In'}
                </button>

                <div className="flex items-center justify-between text-sm">
                  <button
                    type="button"
                    onClick={() => { setStep('phone'); setOtp(''); setError(''); }}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    Change number
                  </button>
                  <button
                    type="button"
                    onClick={resend}
                    disabled={resendCooldown > 0 || loading}
                    className="text-[#25D366] hover:text-[#1ea855] transition-colors disabled:opacity-50"
                  >
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-xs text-gray-600 mt-6">
          By signing in you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}
