# SocialCart — WhatsApp-First Commerce Platform

SocialCart turns WhatsApp into a full commerce channel. Customers browse products, build carts, check out, and track orders entirely inside a WhatsApp conversation. Merchants manage everything — integrations, campaigns, loyalty, their sales team, and payments — from a single dashboard.

---

## Table of Contents

- [Architecture](#architecture)
- [Monorepo Structure](#monorepo-structure)
- [Apps](#apps)
- [Packages](#packages)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Database](#database)
- [WhatsApp Setup](#whatsapp-setup)
- [Notifications & Push](#notifications--push)
- [Team & Roles](#team--roles)
- [Super Admin](#super-admin)
- [Pricing Plans](#pricing-plans)
- [API Reference](#api-reference)
- [Deployment](#deployment)

---

## Architecture

```
                        ┌─────────────────────────────┐
                        │   Meta WhatsApp Cloud API    │
                        └──────────────┬──────────────┘
                                       │ webhooks / send
                        ┌──────────────▼──────────────┐
                        │       SocialCart API          │   Node.js / Express
                        │   apps/api  (port 3001)       │   TypeScript / Prisma
                        └──┬────────┬────────┬─────────┘
                           │        │        │
              ┌────────────▼─┐ ┌───▼───┐ ┌──▼──────────────────┐
              │  PostgreSQL  │ │  SSE  │ │  Integration Layer   │
              │   (Prisma)   │ │stream │ │  Shopify · WooCommerce│
              └──────────────┘ └───────┘ │  Odoo · ERPNext       │
                                         │  RetailMan            │
                                         └──────────────────────┘
        ┌──────────────────────────────────────────────────────────┐
        │                      Frontends                            │
        │  apps/web (3000) — Merchant dashboard (dark theme)        │
        │  apps/pwa (3003) — Customer chat PWA + Agent PWA          │
        │  apps/superadmin (3002) — Platform admin portal           │
        └──────────────────────────────────────────────────────────┘
```

**Message flow (real WhatsApp):**
1. Customer sends a WhatsApp message
2. Meta delivers it to `POST /api/v1/webhooks/whatsapp/webhook`
3. Tenant is identified from the incoming `phoneNumberId` (per-tenant routing)
4. `ConversationService` loads the conversation context from PostgreSQL
5. `FlowEngine` (pure state machine) processes the input → `FlowAction[]`
6. Actions are executed: WhatsApp messages sent via per-tenant credentials, cart updated, order placed
7. Updated context is persisted back to the database
8. SSE event pushed to any connected dashboard clients

**Message flow (web PWA simulator):**
1. Customer types in the PWA chat UI at `/{tenantId}`
2. PWA Next.js API route calls `POST /api/v1/simulator/message`
3. Same `FlowEngine` processes it and returns the bot reply synchronously
4. Both inbound and outbound messages are persisted so agents see them in the dashboard

---

## Monorepo Structure

```
SocialCart/
├── apps/
│   ├── api/              — Express REST API (port 3001)
│   ├── web/              — Merchant dashboard (Next.js 14, port 3000)
│   ├── pwa/              — Customer chat PWA + Agent PWA (Next.js 14, port 3003)
│   └── superadmin/       — SocialCart platform admin (Next.js 14, port 3002)
├── packages/
│   ├── flow-engine/      — WhatsApp conversation state machine
│   ├── integrations/     — ERP/eCommerce connectors
│   ├── whatsapp/         — WhatsApp Cloud API client
│   └── shared/           — Shared utilities and types
├── turbo.json
└── pnpm-workspace.yaml
```

---

## Apps

### `apps/api` — REST API (port 3001)

| Route prefix | Auth | Description |
|---|---|---|
| `POST /api/v1/auth/*` | Public | Tenant register / WhatsApp OTP login |
| `GET/POST /api/v1/webhooks/whatsapp/webhook` | Public | WhatsApp Cloud API webhook |
| `POST /api/v1/webhooks/:tenantId/:platform` | Public | ERP/eCommerce webhook receiver |
| `GET /api/v1/public/stores/:tenantId` | Public | Store name, logo, branding for PWA |
| `POST /api/v1/simulator/message` | Public | Web store chat simulator (returns bot reply) |
| `/api/v1/sse` | Bearer | Server-Sent Events stream (real-time dashboard) |
| `/api/v1/integrations` | Bearer | Connect, sync, remove eCommerce platforms |
| `/api/v1/products` | Bearer | Product catalogue (CRUD + sync) |
| `/api/v1/orders` | Bearer | Orders from all sources (CRUD + status updates) |
| `/api/v1/customers` | Bearer | Customer profiles + loyalty data |
| `/api/v1/conversations` | Bearer | WhatsApp threads, replies, assign, resolve |
| `/api/v1/campaigns` | Bearer | Broadcast + automated campaigns (launch, pause, delete) |
| `/api/v1/loyalty` | Bearer | Points, tiers, award/redeem, stats |
| `/api/v1/team` | Bearer | Team members, org hierarchy, login |
| `/api/v1/settings/*` | Bearer | Profile/branding, WhatsApp, bot config, payments, onboarding |
| `/api/v1/payments/*` | Mixed | Payment links, Paystack/Flutterwave webhooks |
| `/api/v1/analytics/*` | Bearer | Revenue chart, conversion funnel, top products, payment stats |
| `/api/v1/notifications` | Bearer | In-app notifications, read/dismiss, web push subscribe |
| `/api/v1/superadmin/*` | SA Bearer | Platform admin (separate JWT) |

### `apps/web` — Merchant Dashboard (port 3000)

Built with Next.js 14 App Router, React Query, TailwindCSS (dark theme). Real-time via SSE.

| Page | Description |
|---|---|
| `/` | Marketing landing page with multi-currency pricing |
| `/dashboard` | KPI cards + recent orders + onboarding banner + live SSE stats |
| `/dashboard/integrations` | Connect Shopify, WooCommerce, Odoo, ERPNext, RetailMan |
| `/dashboard/products` | Product catalogue with CRUD (add/edit/delete), status filter |
| `/dashboard/orders` | All orders, status filter, live SSE refresh |
| `/dashboard/orders/[id]` | Order detail: line items, totals, status dropdown, tracking |
| `/dashboard/customers` | Customer list with spend, orders, loyalty tier |
| `/dashboard/customers/[id]` | Customer profile: stats, order history, loyalty account |
| `/dashboard/conversations` | Two-pane WhatsApp thread view, assign dropdown, live SSE |
| `/dashboard/campaigns` | Create/launch/pause broadcast & abandoned-cart campaigns |
| `/dashboard/loyalty` | Points leaderboard, tier breakdown, manual award modal |
| `/dashboard/team` | Invite members, list view + org hierarchy chart |
| `/dashboard/payments` | Payment links, create link modal, status tracking |
| `/dashboard/analytics` | Revenue chart, conversion funnel, top products, payment stats |
| `/dashboard/settings` | Profile/branding, WhatsApp creds, bot config, payments, plan |
| `/dashboard/onboarding` | 6-step setup wizard with live progress |
| `/payment/success` | Post-payment success page (Paystack + Flutterwave) |
| `/payment/failed` | Post-payment failure page with retry and support link |

### `apps/pwa` — Customer Chat PWA + Agent App (port 3003)

A Progressive Web App with two distinct user faces:

**Customer chat** (`/{tenantId}`)
- WhatsApp-style chat UI — customers interact with the store bot
- Loads store name, logo, tagline, and brand color from `GET /public/stores/:id`
- Calls `POST /api/v1/simulator/message` and renders bot replies (text / buttons / list)
- Phone persisted in `localStorage`; conversation stored in DB
- Not-found / loading states handled gracefully

**Agent app** (`/agent/*`)
- `/agent/login` — Email+password or WhatsApp OTP login
- `/agent` — Conversation list with filter chips (all / mine / open / bot)
- `/agent/conversation/[id]` — Full thread view with inline reply box
- `/agent/search` — Customer/conversation search
- `/agent/profile` — Profile view with logout
- Native web push notifications (via `sw-agent.js` service worker)
- SSE for real-time message delivery (30s polling fallback)

### `apps/superadmin` — Platform Admin (port 3002)

Dark-themed portal for SocialCart operators.

| Page | Description |
|---|---|
| `/login` | Email + password (12-hour JWT, separate from tenant tokens) |
| `/dashboard` | Platform stats, plan distribution chart, recent signups, recent orders |
| `/dashboard/tenants` | All tenants: search, filter by plan, upgrade/downgrade, suspend, impersonate |
| `/dashboard/tenants/[id]` | Tenant detail: stats, plan management, WhatsApp info, impersonate |

---

## Packages

### `packages/flow-engine`

Pure conversation state machine — no side effects, fully testable.

```typescript
const { actions, newCtx } = await engine.process(messageText, ctx);
// actions: FlowAction[] — send_text | send_list | send_buttons | transition | update_context | end_flow
// newCtx:  FlowContext  — persisted back to DB
```

Built-in flows:

| Flow | Trigger | Description |
|---|---|---|
| `main-menu` | Any new conversation | Interactive list: Shop / My Orders / Help |
| `browse` | "Shop" selection | Product search → results list → add to cart |
| `cart` | "View cart" | Cart summary → Checkout / Keep Shopping / Clear |
| `checkout` | "Checkout" | Address → confirm → payment method → order |
| `order-status` | "My Orders" | Lookup by order ID or phone |
| `cart-recovery` | Cron trigger (15 min) | Re-engagement buttons for abandoned carts |

### `packages/integrations`

Abstract `BaseConnector` with token-bucket rate limiting and exponential-backoff retry.

| Connector | Products | Orders | Customers | Webhooks |
|---|---|---|---|---|
| Shopify | ✓ (cursor pagination) | ✓ | ✓ | ✓ |
| WooCommerce | ✓ (with variations) | ✓ | ✓ | ✓ |
| Odoo | ✓ (JSON-RPC 2.0) | ✓ | ✓ | — |
| ERPNext | ✓ (Frappe REST) | ✓ | ✓ | — |
| RetailMan | ✓ | ✓ | ✓ | — |

### `packages/whatsapp`

WhatsApp Cloud API client wrapping Meta Graph API v19.0.

```typescript
await client.sendTextMessage(to, text);
await client.sendInteractiveList(to, header, body, footer, buttonText, sections);
await client.sendInteractiveButtons(to, body, buttons, header?, footer?);
await client.sendTemplate(to, templateName, languageCode, components?);
await client.sendMediaMessage(to, type, url, caption?);
```

### `packages/shared`

`normalizePhone()`, `formatCurrency()`, `buildPaginatedResponse()`, `sleep()`, `chunk()`, and other shared utilities.

---

## Key Features

### WhatsApp Commerce
- **In-chat checkout** — complete purchase without leaving WhatsApp
- **Interactive messages** — lists (up to 10 rows) and buttons (up to 3) for guided flows
- **Abandoned cart recovery** — automatic re-engagement cron every 15 minutes (30-minute idle threshold)
- **Web store simulator** — PWA chat UI for stores without WhatsApp API approval; full bot parity
- **Order tracking** — customers check order status in-chat

### Per-Tenant WhatsApp Credentials
Each tenant stores their own WhatsApp Business API credentials (Access Token + Phone Number ID). Credentials are AES-256-GCM encrypted at rest. Inbound webhook messages are routed to the correct tenant by matching the incoming `phoneNumberId` against the database.

### Payments
- **Paystack** and **Flutterwave** supported; **Manual** mode for cash-on-delivery
- Payment links created via API and shared in WhatsApp
- HMAC-SHA512 webhook verification for both providers
- Per-tenant keys encrypted at rest in `tenant.settings`
- Post-payment redirect to `/payment/success` or `/payment/failed`

### Campaigns
- Types: `BROADCAST`, `DRIP`, `ABANDONED_CART`, `LOYALTY`, `REORDER`
- Audience targeting by loyalty tier, order count range, or all customers
- Launch → resolves audience from DB → sends WhatsApp messages with 200ms throttle → marks `COMPLETED` → notifies owner
- Scheduled campaigns run automatically via a 60-second server-side cron

### Real-Time (SSE)
Server-Sent Events at `GET /api/v1/sse?token=...` push events to connected dashboard clients:

| Event | Payload | Consumers |
|---|---|---|
| `conversation:message` | `{ conversationId, message }` | Conversations page, Agent PWA |
| `conversation:status` | `{ conversationId, status }` | Conversations page |
| `conversation:assigned` | `{ conversationId, agentId, agentName }` | Agent PWA |
| `order:created` | `{ orderId, total, currency }` | Orders page, Dashboard home |
| `notification` | Full notification payload | Notification bell |

### Notifications
Three-channel delivery system:
1. **In-app** — persisted to DB, shown in the notification bell (updates via SSE)
2. **Web Push** — VAPID-based push to browser/PWA service workers; auto-cleans expired subscriptions
3. **WhatsApp** — owner receives high-priority alerts (new orders, campaign complete) via WhatsApp

Notification types: `NEW_ORDER`, `NEW_CONVERSATION`, `CONVERSATION_ASSIGNED`, `CART_ABANDONED`, `CAMPAIGN_COMPLETE`, `LOYALTY_TIER_UP`, `TEAM_INVITE`, `SYSTEM`

### Loyalty Program
- Points awarded on every purchase (configurable per-tier multipliers)
- Four tiers: Bronze → Silver (500 pts) → Gold (2,000 pts) → Platinum (5,000 pts)
- Tier auto-upgrades on award; full point history per customer
- Manual point award by managers from the Loyalty dashboard

### Store Branding
Merchants set logo URL, tagline, and brand colour in Settings → Profile. The public PWA chat UI (`/{tenantId}`) renders these automatically — no code changes needed per store.

### Integrations
- Credentials encrypted at rest with AES-256-GCM
- Background sync with configurable intervals
- Webhook signature verification per platform
- Unified canonical types (`UnifiedProduct`, `UnifiedOrder`, `UnifiedCustomer`)

### Analytics
- Revenue, orders, conversations, new customers — with period-over-period `% change`
- Revenue area chart (7/30/90 day)
- Conversion funnel (conversations → carts → orders → paid)
- Top products by revenue
- Payment stats by provider

### Onboarding Wizard
A 6-step checklist (profile, WhatsApp, integration, products, payments, team) with live completion tracking. An onboarding banner on the dashboard home auto-hides when all steps are complete.

---

## Tech Stack

| Layer | Technology |
|---|---|
| API runtime | Node.js 20 + TypeScript |
| API framework | Express 4 |
| ORM | Prisma 5 + PostgreSQL |
| Auth | JWT (jsonwebtoken) + bcryptjs |
| Validation | Zod |
| Encryption | AES-256-GCM (Node.js `crypto`) |
| Web Push | `web-push` (VAPID) |
| Monorepo | pnpm workspaces + Turborepo |
| Frontend | Next.js 14 (App Router) |
| State management | TanStack Query v5 |
| Styling | Tailwind CSS 3 |
| Charts | Recharts |
| WhatsApp | Meta Cloud API v19.0 |

---

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 8+
- PostgreSQL 14+

### Install

```bash
git clone https://github.com/michael-moyo/SocialCart.git
cd SocialCart
pnpm install
```

### Configure environment

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
cp apps/pwa/.env.example apps/pwa/.env.local
cp apps/superadmin/.env.example apps/superadmin/.env.local
```

Edit each file — see [Environment Variables](#environment-variables).

### Database

```bash
cd apps/api
npx prisma migrate dev --name init
npx prisma generate
```

### Seed super admin

```bash
curl -X POST http://localhost:3001/api/v1/superadmin/setup \
  -H "Content-Type: application/json" \
  -d '{"name":"Admin","email":"admin@yourcompany.com","password":"changeme123"}'
```

> This endpoint is permanently disabled once the first super admin exists.

### Run in development

```bash
# From repo root — starts all apps in parallel
pnpm dev

# Or individually
pnpm --filter @socialcart/api dev        # port 3001
pnpm --filter @socialcart/web dev        # port 3000
pnpm --filter @socialcart/pwa dev        # port 3003
pnpm --filter @socialcart/superadmin dev # port 3002
```

---

## Environment Variables

### `apps/api/.env`

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/socialcart

# Auth
JWT_SECRET=your-256-bit-secret-here
JWT_EXPIRES_IN=7d

# Encryption (32-byte hex string for AES-256-GCM)
ENCRYPTION_KEY=0000000000000000000000000000000000000000000000000000000000000000

# WhatsApp (Meta Cloud API) — fallback for tenants without own credentials
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_WEBHOOK_VERIFY_TOKEN=

# Web Push (VAPID) — generate with: npx web-push generate-vapid-keys
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_CONTACT_EMAIL=admin@yourcompany.com

# Payments (global fallback; tenants can override in Settings → Payments)
PAYSTACK_SECRET_KEY=
FLUTTERWAVE_SECRET_KEY=

# App
PORT=3001
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Optional: default tenant for single-tenant / dev deployments
DEFAULT_TENANT_ID=
```

> **Generate ENCRYPTION_KEY:**
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```
>
> **Generate VAPID keys:**
> ```bash
> npx web-push generate-vapid-keys
> ```

### `apps/web/.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### `apps/pwa/.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### `apps/superadmin/.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WEB_URL=http://localhost:3000
```

---

## Database

### Schema overview

| Model | Purpose |
|---|---|
| `Tenant` | Store/merchant account (credentials, branding, settings JSON) |
| `SuperAdmin` | SocialCart platform operators |
| `TeamMember` | Agents, managers, and sales reps within a tenant |
| `Integration` | Connected ERP/eCommerce platform (credentials AES-encrypted) |
| `Product` | Synced and manually created product catalogue |
| `Customer` | WhatsApp customers |
| `Order` | Orders from all sources with status, tracking, line items |
| `Cart` | Active and abandoned carts |
| `Conversation` | WhatsApp conversation threads with flow context |
| `Message` | Individual messages (inbound + outbound) |
| `Campaign` | Broadcast and automated campaigns with stats |
| `LoyaltyAccount` | Points, tier, and transaction history per customer |
| `Notification` | In-app notification inbox per tenant/member |
| `PushSubscription` | Web Push VAPID subscriptions (browser/PWA) |
| `PaymentLink` | Generated payment links with provider reference |

### Migrations

```bash
# Create and apply a new migration
cd apps/api && npx prisma migrate dev --name <description>

# Apply migrations in production
npx prisma migrate deploy

# Open Prisma Studio
npx prisma studio
```

---

## WhatsApp Setup

### Per-tenant credentials (recommended)

1. Create a Meta Business account at [business.facebook.com](https://business.facebook.com)
2. Create an app in the [Meta Developer Portal](https://developers.facebook.com/apps)
3. Add the WhatsApp product and note your **Phone Number ID** and **Business Account ID**
4. Generate a **Permanent System User Token**
5. Configure the webhook:
   - **URL:** `https://your-api-domain.com/api/v1/webhooks/whatsapp/webhook`
   - **Verify token:** any secret string (entered in Settings → WhatsApp)
   - **Subscribe to:** `messages`
6. In the merchant dashboard → Settings → WhatsApp, enter all values

Inbound messages are routed to the correct tenant by matching the incoming `phoneNumberId` from the webhook payload against `tenant.whatsappPhoneNumberId` in the database.

### Shared credentials (development)

Set `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, and `DEFAULT_TENANT_ID` in `apps/api/.env`. All inbound messages will route to that tenant.

---

## Notifications & Push

### Web Push setup

1. Generate VAPID keys: `npx web-push generate-vapid-keys`
2. Set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_CONTACT_EMAIL` in `apps/api/.env`
3. The merchant dashboard (`apps/web`) auto-requests notification permission on load and registers subscriptions via `POST /api/v1/notifications/push/subscribe`
4. The agent PWA (`apps/pwa`) does the same via `sw-agent.js` service worker

### Notification channels

| Channel | Who receives | Trigger |
|---|---|---|
| In-app bell | Owner + assigned member | All events |
| Web Push | Owner + assigned member | All events |
| WhatsApp | Owner only | New order, campaign complete |

---

## Team & Roles

| Role | Invite team | See all convos | See team convos | See own convos | Manage settings |
|---|---|---|---|---|---|
| OWNER | ✓ | ✓ | ✓ | ✓ | ✓ |
| MANAGER | ✓ (own team) | — | ✓ | ✓ | — |
| AGENT | — | — | — | ✓ | — |
| SALES_REP | — | — | — | ✓ | — |

### Team member login

```http
POST /api/v1/team/login
{ "email": "jane@store.com", "password": "..." }
```

`tenantId` is optional — if omitted the member is found by email across all tenants. The returned JWT carries `{ tenantId, memberId, role }`.

Agents also log in via the PWA at `/agent/login` using the same endpoint (both email+password and WhatsApp OTP supported).

### Conversation assignment

Owners and managers can assign any open conversation to an agent from the conversation thread header. The assigned agent immediately receives:
- An in-app notification
- A web push notification (if subscribed)
- A `conversation:assigned` SSE event (refreshes their queue in real-time)

---

## Super Admin

The super admin portal (`apps/superadmin`) runs on port 3002 and is completely separate from tenant JWTs.

| Action | Endpoint |
|---|---|
| First-time setup | `POST /api/v1/superadmin/setup` |
| Login | `POST /api/v1/superadmin/login` |
| Platform stats | `GET /api/v1/superadmin/stats` |
| Recent activity | `GET /api/v1/superadmin/activity` |
| List tenants | `GET /api/v1/superadmin/tenants` |
| Tenant detail | `GET /api/v1/superadmin/tenants/:id` |
| Update plan / suspend | `PATCH /api/v1/superadmin/tenants/:id` |
| Impersonate tenant | `POST /api/v1/superadmin/tenants/:id/impersonate` |

Impersonation returns a short-lived tenant JWT. The merchant dashboard reads `?impersonate=TOKEN` from the URL, stores it as the active session token, and removes the parameter from the URL — transparent to the operator.

---

## Pricing Plans

| | FREE | STARTER | PRO | ENTERPRISE |
|---|---|---|---|---|
| Conversations/mo | 500 | 5,000 | 25,000 | Unlimited |
| WhatsApp numbers | 1 | 1 | 3 | Unlimited |
| Integrations | 1 | 3 | All | All |
| Abandoned cart | — | ✓ | ✓ | ✓ |
| Broadcasts | — | — | ✓ | ✓ |
| Loyalty program | — | — | ✓ | ✓ |
| Team members | 1 | 3 | 10 | Unlimited |
| Analytics | — | Basic | Full | Full |
| Dedicated manager | — | — | — | ✓ |

---

## API Reference

All authenticated endpoints require:

```
Authorization: Bearer <jwt>
```

Responses follow:

```json
{ "success": true, "data": { ... } }
{ "success": false, "error": "Human-readable message" }
```

Paginated responses include:

```json
{
  "success": true,
  "data": [...],
  "meta": { "total": 100, "page": 1, "limit": 20, "totalPages": 5 }
}
```

### Key endpoint groups

**Auth**
```
POST /api/v1/auth/otp/request     — send WhatsApp OTP
POST /api/v1/auth/otp/verify      — verify OTP → returns JWT
```

**Products**
```
GET    /api/v1/products           — list with search/filter
POST   /api/v1/products           — create manual product
PATCH  /api/v1/products/:id       — update product
DELETE /api/v1/products/:id       — delete product
```

**Orders**
```
GET   /api/v1/orders              — list with status/customer filter
GET   /api/v1/orders/:id          — detail with line items
PATCH /api/v1/orders/:id          — update status, payment, tracking, notes
```

**Conversations**
```
GET  /api/v1/conversations        — list (filter: status, assignedToMe)
GET  /api/v1/conversations/:id    — full thread with messages
POST /api/v1/conversations/:id/reply    — agent sends WhatsApp message
POST /api/v1/conversations/:id/assign   — assign to team member
POST /api/v1/conversations/:id/resolve  — close conversation
```

**Campaigns**
```
POST /api/v1/campaigns            — create (DRAFT or SCHEDULED)
POST /api/v1/campaigns/:id/launch — start sending immediately
POST /api/v1/campaigns/:id/pause  — pause a running campaign
```

**Settings**
```
GET   /api/v1/settings                  — full tenant config
PATCH /api/v1/settings/profile          — name, email, logoUrl, tagline, primaryColor
PATCH /api/v1/settings/whatsapp         — credentials + verify token
PATCH /api/v1/settings/bot              — bot config JSON
PATCH /api/v1/settings/payments         — provider, keys, currency
GET   /api/v1/settings/onboarding       — step completion status
PATCH /api/v1/settings/onboarding/complete — mark onboarding done
```

**Notifications**
```
GET    /api/v1/notifications            — inbox (unread filter, limit)
PATCH  /api/v1/notifications/:id/read   — mark read
POST   /api/v1/notifications/read-all   — mark all read
DELETE /api/v1/notifications/:id        — dismiss
GET    /api/v1/notifications/push/vapid-key   — VAPID public key
POST   /api/v1/notifications/push/subscribe   — register push endpoint
DELETE /api/v1/notifications/push/unsubscribe — remove push endpoint
```

---

## Deployment

### Docker (recommended)

```dockerfile
# API
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm install -g pnpm && pnpm install --frozen-lockfile
RUN pnpm --filter @socialcart/api build
CMD ["node", "apps/api/dist/index.js"]
```

### Railway / Render

Each app can be deployed as a separate service pointing to the same PostgreSQL instance:

| Service | Root directory | Build command | Start command |
|---|---|---|---|
| api | `apps/api` | `pnpm build` | `node dist/index.js` |
| web | `apps/web` | `pnpm build` | `pnpm start` |
| pwa | `apps/pwa` | `pnpm build` | `pnpm start` |
| superadmin | `apps/superadmin` | `pnpm build` | `pnpm start` |

### Production checklist

- [ ] Set `NODE_ENV=production`
- [ ] Use a strong random `JWT_SECRET` (`openssl rand -hex 32`)
- [ ] Generate a fresh `ENCRYPTION_KEY` (`openssl rand -hex 32`)
- [ ] Generate VAPID keys (`npx web-push generate-vapid-keys`)
- [ ] Run `npx prisma migrate deploy` before first start
- [ ] Seed the super admin via `POST /api/v1/superadmin/setup`
- [ ] Configure WhatsApp webhook URL in Meta Developer Portal
- [ ] Point each tenant's webhook verify token to match `settings.webhookVerifyToken`
- [ ] Set CORS `NEXT_PUBLIC_APP_URL` to your production web domain
- [ ] Enable SSL/TLS (Meta requires HTTPS for webhooks; also required for Web Push)
- [ ] Set `VAPID_CONTACT_EMAIL` to a real monitored address

---

## Contributing

1. Fork the repo and create a feature branch off `main`
2. Follow the existing file/folder conventions
3. Run `pnpm lint` and `pnpm build` before opening a PR
4. Open a pull request against `main` with a clear description

---

## License

MIT © SocialCart
