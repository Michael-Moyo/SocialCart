'use client';

import { useState } from 'react';
import Link from 'next/link';

type Currency = 'USD' | 'NGN' | 'INR' | 'KES' | 'ZAR';

const PRICES: Record<Currency, { symbol: string; growth: string; pro: string; advanced: string }> = {
  USD: { symbol: '$', growth: '59', pro: '129', advanced: '199' },
  NGN: { symbol: '₦', growth: '100,000', pro: '200,000', advanced: '300,000' },
  INR: { symbol: '₹', growth: '4,999', pro: '10,999', advanced: '16,999' },
  KES: { symbol: 'KSh', growth: '7,999', pro: '16,999', advanced: '25,999' },
  ZAR: { symbol: 'R', growth: '1,099', pro: '2,299', advanced: '3,599' },
};

const FEATURES: Array<{ name: string; growth: boolean | string; pro: boolean | string; advanced: boolean | string }> = [
  { name: 'Payment Methods', growth: true, pro: true, advanced: true },
  { name: 'One-Click In-Chat Checkout', growth: true, pro: true, advanced: true },
  { name: 'Cart Recovery Flows', growth: true, pro: true, advanced: true },
  { name: 'Order Update Notifications', growth: false, pro: true, advanced: true },
  { name: 'Post-Purchase Upsell Flows', growth: false, pro: true, advanced: true },
  { name: 'Custom Pre-/Post Purchase Flows', growth: false, pro: false, advanced: true },
  { name: 'Custom CTWA Ad Flows', growth: false, pro: false, advanced: true },
  { name: 'Fully Trained Custom AI Sales Agents', growth: false, pro: false, advanced: true },
  { name: 'AI Flows (live external data)', growth: false, pro: false, advanced: true },
  { name: 'Unlimited Broadcast Campaigns', growth: true, pro: true, advanced: true },
  { name: 'WhatsApp Website Widget', growth: false, pro: true, advanced: true },
  { name: 'Website Discount Popovers', growth: false, pro: true, advanced: true },
  { name: 'Gamification (Spin, Quizzes)', growth: false, pro: false, advanced: true },
  { name: 'AI Chat-to-Search', growth: true, pro: true, advanced: true },
  { name: 'Category Browsing on WhatsApp', growth: true, pro: true, advanced: true },
  {
    name: 'Transaction Fee',
    growth: 'Free up to $3k/mo, 1.5% after',
    pro: 'Free up to $5k/mo, 1% after',
    advanced: 'Free up to $10k/mo, 0.5% after',
  },
  { name: 'Multi-Agent Team Inbox', growth: false, pro: true, advanced: true },
  { name: 'FAQ Bot', growth: true, pro: true, advanced: true },
  { name: 'Buy for Customer', growth: true, pro: true, advanced: true },
];

function Check() {
  return (
    <svg className="w-5 h-5 text-[#25D366] mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function Cross() {
  return <span className="text-slate-300 block text-center">—</span>;
}

function FeatureCell({ value }: { value: boolean | string }) {
  if (typeof value === 'string') {
    return <span className="text-xs text-slate-500 block text-center leading-tight">{value}</span>;
  }
  return value ? <Check /> : <Cross />;
}

const WA_LOGO = (
  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

export default function HomePage() {
  const [currency, setCurrency] = useState<Currency>('USD');
  const p = PRICES[currency];

  return (
    <div className="min-h-screen bg-white text-[#0F172A]">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#25D366] rounded-lg flex items-center justify-center">
              {WA_LOGO}
            </div>
            <span className="font-bold text-lg text-[#0F172A]">SocialCart</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#features" className="hover:text-[#25D366] transition-colors">Features</a>
            <a href="#pricing" className="hover:text-[#25D366] transition-colors">Pricing</a>
            <Link href="/dashboard" className="hover:text-[#25D366] transition-colors">Login</Link>
          </div>
          <Link
            href="/dashboard"
            className="bg-[#25D366] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#1ebe5d] transition-colors"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-[#25D366]/10 text-[#25D366] text-sm font-medium px-3 py-1.5 rounded-full mb-6">
              <span className="w-2 h-2 bg-[#25D366] rounded-full animate-pulse"></span>
              WhatsApp-First Commerce Platform
            </div>
            <h1 className="text-5xl sm:text-6xl font-extrabold leading-tight text-[#0F172A] mb-6">
              Sell More on{' '}
              <span className="text-[#25D366]">WhatsApp.</span>
              <br />No App Required.
            </h1>
            <p className="text-xl text-slate-500 mb-8 leading-relaxed">
              Turn WhatsApp into your highest-converting sales channel. Accept orders, recover carts, and run campaigns — all inside WhatsApp chat.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/dashboard"
                className="bg-[#25D366] text-white px-8 py-4 rounded-xl text-base font-bold hover:bg-[#1ebe5d] transition-all shadow-lg shadow-[#25D366]/30 text-center"
              >
                Start Free Trial
              </Link>
              <button className="border-2 border-slate-200 text-[#0F172A] px-8 py-4 rounded-xl text-base font-semibold hover:border-[#25D366] transition-colors text-center">
                Book a Demo
              </button>
            </div>
            <p className="mt-4 text-sm text-slate-400">No credit card required · Setup in 5 minutes</p>
          </div>

          {/* Mock phone */}
          <div className="flex justify-center lg:justify-end">
            <div className="relative">
              <div className="w-72 h-[580px] bg-[#0F172A] rounded-[3rem] shadow-2xl p-3 flex flex-col">
                <div className="bg-[#075E54] rounded-t-[2.5rem] px-4 py-3 flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#25D366] rounded-full flex items-center justify-center text-lg">🛒</div>
                  <div>
                    <div className="text-white font-semibold text-sm">Fashion Store</div>
                    <div className="text-[#25D366] text-xs">Online</div>
                  </div>
                </div>
                <div className="flex-1 bg-[#ECE5DD] rounded-b-[2.5rem] p-3 flex flex-col gap-2 overflow-hidden">
                  <div className="bg-white rounded-2xl rounded-tl-sm p-3 max-w-[85%] shadow-sm">
                    <p className="text-xs text-[#0F172A]">Hi! Welcome to Fashion Store 👋 What would you like to do?</p>
                    <div className="mt-2 space-y-1">
                      {['🛍️ Browse Products', '🛒 View Cart', '📦 Track Order'].map((item) => (
                        <div key={item} className="border border-[#25D366] text-[#25D366] text-xs rounded-lg px-2 py-1 text-center">{item}</div>
                      ))}
                    </div>
                  </div>
                  <div className="self-end bg-[#DCF8C6] rounded-2xl rounded-tr-sm p-3 max-w-[85%] shadow-sm">
                    <p className="text-xs text-[#0F172A]">Browse Products</p>
                  </div>
                  <div className="bg-white rounded-2xl rounded-tl-sm p-3 max-w-[85%] shadow-sm">
                    <p className="text-xs text-[#0F172A] font-medium">Trending Now 🔥</p>
                    <p className="text-xs text-slate-500 mt-1">Classic White Sneakers · $49.99</p>
                    <div className="mt-2 bg-[#25D366] text-white text-xs rounded-lg px-2 py-1 text-center">Add to Cart</div>
                  </div>
                  <div className="self-end bg-[#DCF8C6] rounded-2xl rounded-tr-sm p-3 max-w-[85%] shadow-sm">
                    <p className="text-xs text-[#0F172A]">Add to Cart</p>
                  </div>
                  <div className="bg-white rounded-2xl rounded-tl-sm p-3 max-w-[85%] shadow-sm">
                    <p className="text-xs text-[#0F172A]">Added to cart! Ready to checkout? 🎉</p>
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-4 -right-4 w-20 h-20 bg-[#25D366]/20 rounded-full blur-xl"></div>
              <div className="absolute -top-4 -left-4 w-16 h-16 bg-[#0F172A]/10 rounded-full blur-xl"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-[#0F172A] py-6">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-16 text-center">
          {['Unlimited contacts', 'No per-message fees', 'No growth tax'].map((stat) => (
            <div key={stat} className="flex items-center gap-2 text-white">
              <span className="text-[#25D366]">✓</span>
              <span className="font-medium">{stat}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-extrabold text-[#0F172A] mb-4">Everything you need to sell on WhatsApp</h2>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto">From product discovery to checkout confirmation — all inside WhatsApp.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { icon: '🛒', title: 'One-Click In-Chat Checkout', desc: 'Customers browse and buy without ever leaving WhatsApp. Zero friction, maximum conversion.' },
            { icon: '🔄', title: 'AI Powered Cart Recovery', desc: 'Automatically re-engage customers who abandoned their cart with personalized WhatsApp messages.' },
            { icon: '📣', title: 'Smart Broadcast Campaigns', desc: 'Send targeted promotions, flash sales, and announcements to segmented customer lists.' },
            { icon: '🔗', title: 'Multi-Platform Sync', desc: 'Sync your catalogue and orders with Shopify, WooCommerce, ERPs, and more — in real time.' },
            { icon: '🤖', title: 'AI Sales Agent', desc: 'Deploy a trained AI that handles product questions, recommends items, and closes sales 24/7.' },
            { icon: '⚡', title: 'WhatsApp Flows Builder', desc: 'Build custom conversational flows for onboarding, upsells, surveys, and loyalty programs.' },
          ].map((f) => (
            <div key={f.title} className="bg-slate-50 rounded-2xl p-6 hover:shadow-md hover:bg-white transition-all border border-slate-100">
              <div className="text-3xl mb-4">{f.icon}</div>
              <h3 className="font-bold text-lg text-[#0F172A] mb-2">{f.title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 bg-slate-50 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-extrabold text-[#0F172A] mb-4">Simple, transparent pricing</h2>
            <p className="text-lg text-slate-500 mb-8">No hidden fees. No per-message charges. Cancel anytime.</p>
            <div className="inline-flex items-center gap-1 bg-white rounded-xl border border-slate-200 p-1">
              {(['USD', 'NGN', 'INR', 'KES', 'ZAR'] as Currency[]).map((c) => (
                <button
                  key={c}
                  onClick={() => setCurrency(c)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    currency === c ? 'bg-[#25D366] text-white' : 'text-slate-600 hover:text-[#0F172A]'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
            {[
              {
                name: 'Growth',
                price: `${p.symbol}${p.growth}`,
                highlight: false,
                badge: '',
                features: ['Cart Recovery', 'FAQ Bot', 'Broadcasts', '1.5% tx fee after $3k'],
              },
              {
                name: 'Pro',
                price: `${p.symbol}${p.pro}`,
                highlight: true,
                badge: 'Most Popular',
                features: ['Everything in Growth', 'Team Inbox', 'Order Notifications', '1% tx fee after $5k'],
              },
              {
                name: 'Advanced',
                price: `${p.symbol}${p.advanced}`,
                highlight: false,
                badge: '',
                features: ['Everything in Pro', 'Custom AI Agent', 'CTWA Ad Flows', '0.5% tx fee after $10k'],
              },
              {
                name: 'Enterprise',
                price: 'Custom',
                highlight: false,
                badge: '',
                features: ['Dedicated account manager', 'Custom integrations', 'SLA guarantee', 'Volume pricing'],
              },
            ].map((plan) => (
              <div
                key={plan.name}
                className={`bg-white rounded-2xl border-2 p-6 flex flex-col relative ${plan.highlight ? 'border-[#25D366]' : 'border-slate-200'}`}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#25D366] text-white text-xs font-bold px-3 py-1 rounded-full">
                    {plan.badge}
                  </div>
                )}
                <div className="mb-4">
                  <h3 className="font-bold text-lg text-[#0F172A]">{plan.name}</h3>
                  <div className="text-3xl font-extrabold text-[#0F172A] mt-1">{plan.price}</div>
                  <div className="text-xs text-slate-400 mt-1">{plan.name === 'Enterprise' ? 'Contact us' : '/month'}</div>
                </div>
                <ul className="space-y-2 flex-1 mb-6">
                  {plan.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2 text-sm text-slate-600">
                      <span className="text-[#25D366] mt-0.5 shrink-0">✓</span>
                      {feat}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/dashboard"
                  className={`w-full py-2.5 rounded-lg text-sm font-bold text-center transition-colors block ${
                    plan.highlight
                      ? 'bg-[#25D366] text-white hover:bg-[#1ebe5d]'
                      : 'border border-slate-200 text-[#0F172A] hover:border-[#25D366] hover:text-[#25D366]'
                  }`}
                >
                  {plan.name === 'Enterprise' ? 'Contact Sales' : 'Get Started'}
                </Link>
              </div>
            ))}
          </div>

          {/* Feature comparison */}
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            <div className="grid grid-cols-4 bg-slate-50 border-b border-slate-100">
              <div className="p-4 font-semibold text-slate-600 text-sm">Feature</div>
              {['Growth', 'Pro', 'Advanced'].map((h) => (
                <div key={h} className="p-4 text-center font-bold text-sm text-[#0F172A]">{h}</div>
              ))}
            </div>
            {FEATURES.map((row, i) => (
              <div
                key={row.name}
                className={`grid grid-cols-4 border-b border-slate-50 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}
              >
                <div className="p-3 text-sm text-slate-700">{row.name}</div>
                <div className="p-3"><FeatureCell value={row.growth} /></div>
                <div className="p-3"><FeatureCell value={row.pro} /></div>
                <div className="p-3"><FeatureCell value={row.advanced} /></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PWA callout */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="bg-[#0F172A] rounded-3xl p-12 lg:p-16 flex flex-col lg:flex-row items-center gap-12">
          <div className="flex-1 text-center lg:text-left">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">
              Works in any browser.{' '}
              <span className="text-[#25D366]">No app download required.</span>
            </h2>
            <p className="text-slate-400 text-lg mb-8">
              Your customers shop through WhatsApp. Your team manages everything from a progressive web app — fast, offline-capable, and installable on any device.
            </p>
            <Link
              href="/dashboard"
              className="inline-block bg-[#25D366] text-white px-8 py-4 rounded-xl font-bold hover:bg-[#1ebe5d] transition-colors"
            >
              Open the App
            </Link>
          </div>
          <div className="relative shrink-0">
            <div className="w-48 h-80 bg-[#1e293b] rounded-[2.5rem] border-2 border-slate-700 flex flex-col overflow-hidden shadow-2xl">
              <div className="h-6 bg-[#075E54] flex items-center px-3 gap-1.5">
                <div className="w-2 h-2 bg-[#25D366] rounded-full"></div>
                <span className="text-white text-[8px] font-medium">SocialCart Dashboard</span>
              </div>
              <div className="flex-1 p-2 space-y-2">
                {['Orders ↑32%', 'Revenue ↑18%', 'Cart Recovery 47%'].map((s) => (
                  <div key={s} className="bg-slate-700 rounded-lg p-2">
                    <div className="text-[#25D366] text-[9px] font-bold">{s}</div>
                  </div>
                ))}
                <div className="bg-[#25D366]/20 rounded-lg p-2">
                  <div className="text-[#25D366] text-[9px]">3 new orders</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-[#25D366] rounded-lg flex items-center justify-center">
              {WA_LOGO}
            </div>
            <span className="font-bold text-[#0F172A]">SocialCart</span>
          </div>
          <div className="flex flex-wrap justify-center gap-6 text-sm text-slate-500">
            <a href="#features" className="hover:text-[#25D366] transition-colors">Features</a>
            <a href="#pricing" className="hover:text-[#25D366] transition-colors">Pricing</a>
            <Link href="/dashboard" className="hover:text-[#25D366] transition-colors">Dashboard</Link>
            <a href="mailto:hello@socialcart.io" className="hover:text-[#25D366] transition-colors">Contact</a>
            <a href="#" className="hover:text-[#25D366] transition-colors">Privacy</a>
            <a href="#" className="hover:text-[#25D366] transition-colors">Terms</a>
          </div>
          <p className="text-sm text-slate-400">© 2026 SocialCart. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
