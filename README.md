# SocialCart — WhatsApp-First Commerce Platform

SocialCart turns WhatsApp into a full commerce channel. Customers browse products, build carts, check out, and track orders entirely inside a WhatsApp conversation. Merchants manage everything — integrations, campaigns, loyalty, and their sales team — from a single dashboard.

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
                        └──┬──────────┬────────────────┘
                           │          │
              ┌────────────▼──┐  ┌───▼─────────────────┐
              │  PostgreSQL   │  │  Integration Layer   │
              │   (Prisma)    │  │  Shopify · WooCommerce│
              └───────────────┘  │  Odoo · ERPNext       │
                                 │  RetailMan            │
                                 └──────────────────────┘
        ┌──────────────────────────────────────────────────┐
        │                  Frontends                        │
        │  apps/web (port 3000) — Merchant dashboard        │
        │  apps/pwa (port 3003) — Customer chat PWA         │
        │  apps/superadmin (port 3002) — Platform admin     │
        └──────────────────────────────────────────────────┘
```

**Message flow:**
1. Customer sends a WhatsApp message
2. Meta delivers it to `POST /api/v1/whatsapp/webhook`
3. `ConversationService` loads the conversation context from PostgreSQL
4. `FlowEngine` (pure state machine) processes the input and returns `FlowAction[]`
5. Actions are executed: WhatsApp messages sent, cart updated, order placed
6. Updated context is persisted back to the database

---

## Monorepo Structure

```
SocialCart/
├── apps/
│   ├── api/              — Express REST API + WebSocket webhooks
│   ├── web/              — Merchant dashboard (Next.js 14)
│   ├── pwa/              — Customer WhatsApp-style chat PWA (Next.js 14)
│   └── superadmin/       — SocialCart platform admin (Next.js 14)
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

| Route prefix | Description |
|---|---|
| `POST /api/v1/auth/*` | Tenant register / login |
| `GET/POST /api/v1/whatsapp/webhook` | WhatsApp challenge + inbound messages |
| `POST /api/v1/webhooks/:tenantId/:platform` | ERP/eCommerce webhook receiver |
| `/api/v1/integrations` | Connect, sync, remove platforms |
| `/api/v1/products` | Synced product catalogue |
| `/api/v1/orders` | Orders across all platforms |
| `/api/v1/customers` | Customer profiles |
| `/api/v1/conversations` | WhatsApp conversation CRUD |
| `/api/v1/campaigns` | Broadcast + automated campaigns |
| `/api/v1/loyalty` | Points, tiers, award/redeem |
| `/api/v1/team` | Team members + org hierarchy |
| `/api/v1/settings/*` | Profile, WhatsApp, bot config, password |
| `/api/v1/superadmin/*` | Platform admin (separate auth) |

### `apps/web` — Merchant Dashboard (port 3000)

Built with Next.js 14 App Router, React Query, and Tailwind CSS.

| Page | Description |
|---|---|
| `/` | Marketing landing page with multi-currency pricing |
| `/dashboard` | Overview stats + recent orders + integrations |
| `/dashboard/integrations` | Connect Shopify, WooCommerce, Odoo, ERPNext, RetailMan |
| `/dashboard/products` | Product catalogue with sync status |
| `/dashboard/orders` | All orders, filterable by status |
| `/dashboard/customers` | Customer list with spend/order history |
| `/dashboard/conversations` | Two-pane WhatsApp thread view, 8s auto-refresh |
| `/dashboard/campaigns` | Create and manage broadcast campaigns |
| `/dashboard/loyalty` | Points leaderboard, tier breakdown, award modal |
| `/dashboard/team` | Invite members, list view + org chart |
| `/dashboard/settings` | Profile, WhatsApp credentials, bot config, security, plan |

### `apps/pwa` — Customer Chat PWA (port 3003)

A Progressive Web App customers can install and use to chat with any SocialCart store. No app store required.

- Route: `/{storeSlug}` — WhatsApp-style chat UI
- `#25D366` green theme with PWA manifest
- Proxies messages to the main API's WhatsApp webhook
- Persists phone number in `localStorage`

### `apps/superadmin` — Platform Admin (port 3002)

Dark-themed portal for SocialCart operators.

| Page | Description |
|---|---|
| `/login` | Email + password (12-hour JWT, separate from tenant tokens) |
| `/dashboard` | Platform stats + plan distribution chart |
| `/dashboard/tenants` | All tenants: search, filter by plan, upgrade/downgrade, suspend, impersonate |

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
| `cart-recovery` | Cron trigger | Re-engagement for abandoned carts |

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
await client.sendMediaMessage(to, type, mediaId, caption?);
```

### `packages/shared`

`normalizePhone()`, `formatCurrency()`, `buildPaginatedResponse()`, `sleep()`, `chunk()`, and other shared utilities.

---

## Key Features

### WhatsApp Commerce
- **In-chat checkout** — complete purchase without leaving WhatsApp
- **Interactive messages** — lists (up to 10 rows) and buttons (up to 3) for guided flows
- **AI cart generation** — natural language → cart items
- **Abandoned cart recovery** — automatic re-engagement cron (every 15 minutes, 30-minute idle threshold)
- **Smart broadcasts** — segmented campaigns with `{{name}}` personalisation
- **Order tracking** — customers check order status in-chat

### Integrations
- Credentials encrypted at rest with AES-256-GCM
- Background sync with configurable intervals
- Webhook signature verification per platform
- Unified canonical types (`UnifiedProduct`, `UnifiedOrder`, `UnifiedCustomer`)

### Loyalty Program
- Points awarded on every purchase
- Four tiers: Bronze → Silver (500 pts) → Gold (2,000 pts) → Platinum (5,000 pts)
- Tier auto-upgrades on award, auto-downgrades on redeem
- Full point history per customer

### Team & Sales Hierarchy
- **OWNER** — full access (account creator)
- **MANAGER** — invites/manages their own team, sees team conversations
- **AGENT** — handles assigned customer support conversations
- **SALES_REP** — manages their own lead pipeline

Managers see only their team's data. Sales reps see only their own assigned conversations.

---

## Tech Stack

| Layer | Technology |
|---|---|
| API runtime | Node.js 20 + TypeScript |
| API framework | Express 4 |
| ORM | Prisma 5 + PostgreSQL |
| Auth | JWT (jsonwebtoken) + bcryptjs |
| Validation | Zod |
| Encryption | AES-256-GCM (Node.js crypto) |
| Monorepo | pnpm workspaces + Turborepo |
| Frontend | Next.js 14 (App Router) |
| State management | TanStack Query v5 |
| Styling | Tailwind CSS 3 |
| PWA | next-pwa |
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
```

Edit the `.env` files (see [Environment Variables](#environment-variables)).

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

# WhatsApp (Meta Cloud API)
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_WEBHOOK_VERIFY_TOKEN=

# App
PORT=3001
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Optional: default tenant for single-tenant deployments
DEFAULT_TENANT_ID=
```

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

> **Generate ENCRYPTION_KEY:**
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```

---

## Database

### Schema overview

| Model | Purpose |
|---|---|
| `Tenant` | Store/merchant account |
| `SuperAdmin` | SocialCart platform operators |
| `TeamMember` | Agents, managers, and sales reps within a tenant |
| `Integration` | Connected ERP/eCommerce platform (credentials AES-encrypted) |
| `Product` | Synced product catalogue |
| `Customer` | WhatsApp customers |
| `Order` | Orders from all sources |
| `Cart` | Active and abandoned carts |
| `Conversation` | WhatsApp conversation threads |
| `Message` | Individual messages within a conversation |
| `Campaign` | Broadcast and automated campaigns |
| `LoyaltyAccount` | Points, tier, and history per customer |

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

1. Create a Meta Business account at [business.facebook.com](https://business.facebook.com)
2. Create an app in the [Meta Developer Portal](https://developers.facebook.com/apps)
3. Add the WhatsApp product to your app
4. Note your **Phone Number ID** and **WhatsApp Business Account ID**
5. Generate a **Permanent System User Token**
6. In the developer portal, configure the webhook:
   - **URL:** `https://your-api-domain.com/api/v1/whatsapp/webhook`
   - **Verify token:** match the value in `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
   - **Subscribe to:** `messages`
7. Enter all values in the Settings → WhatsApp tab of the merchant dashboard

---

## Team & Roles

| Role | Invite team | See all convos | See team convos | See own convos | Manage settings |
|---|---|---|---|---|---|
| OWNER | ✓ | ✓ | ✓ | ✓ | ✓ |
| MANAGER | ✓ (own team) | — | ✓ | ✓ | — |
| AGENT | — | — | — | ✓ | — |
| SALES_REP | — | — | — | ✓ | — |

### Team member login

Team members log in via:

```http
POST /api/v1/team/login
{ "tenantId": "<uuid>", "email": "jane@store.com", "password": "..." }
```

The returned JWT carries `{ tenantId, memberId, role }` — the same dashboard at `apps/web` is used; data is scoped to their role automatically.

---

## Super Admin

The super admin portal (`apps/superadmin`) runs on port 3002 and is completely separate from tenant JWTs.

| Action | Endpoint |
|---|---|
| First-time setup | `POST /api/v1/superadmin/setup` |
| Login | `POST /api/v1/superadmin/login` |
| Platform stats | `GET /api/v1/superadmin/stats` |
| List tenants | `GET /api/v1/superadmin/tenants` |
| Update plan / suspend | `PATCH /api/v1/superadmin/tenants/:id` |
| Impersonate tenant | `POST /api/v1/superadmin/tenants/:id/impersonate` |

Impersonation returns a short-lived tenant JWT — useful for support troubleshooting without resetting passwords.

---

## Pricing Plans

| | Growth | Pro | Advanced | Enterprise |
|---|---|---|---|---|
| **NGN** | ₦100,000/mo | ₦200,000/mo | ₦300,000/mo | Custom |
| **USD** | $59/mo | $129/mo | $199/mo | Custom |
| **INR** | ₹4,999/mo | ₹10,999/mo | ₹16,999/mo | Custom |
| **KES** | KSh 7,999/mo | KSh 16,999/mo | KSh 25,999/mo | Custom |
| **ZAR** | R1,099/mo | R2,299/mo | R3,599/mo | Custom |
| Conversations/mo | 5,000 | 25,000 | Unlimited | Unlimited |
| WhatsApp numbers | 1 | 3 | Unlimited | Unlimited |
| Integrations | 3 | All | All | All |
| Abandoned cart | ✓ | ✓ | ✓ | ✓ |
| Broadcasts | — | ✓ | ✓ | ✓ |
| Loyalty program | — | ✓ | ✓ | ✓ |
| Team members | 3 | 10 | Unlimited | Unlimited |
| AI features | — | — | ✓ | ✓ |
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
- [ ] Use a strong random `JWT_SECRET` (256-bit)
- [ ] Generate a fresh `ENCRYPTION_KEY` (`openssl rand -hex 32`)
- [ ] Run `npx prisma migrate deploy` before first start
- [ ] Seed the super admin via `/api/v1/superadmin/setup`
- [ ] Configure WhatsApp webhook URL in Meta Developer Portal
- [ ] Set CORS `NEXT_PUBLIC_APP_URL` to your production web domain
- [ ] Enable SSL/TLS (Meta requires HTTPS for webhooks)

---

## Contributing

1. Fork the repo and create a feature branch off `main`
2. Follow the existing file/folder conventions
3. Run `pnpm lint` and `pnpm build` before opening a PR
4. Open a pull request against `main` with a clear description

---

## License

MIT © SocialCart
