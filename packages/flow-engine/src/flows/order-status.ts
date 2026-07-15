import { Flow, FlowAction, FlowContext } from '../types';

export interface OrderResult {
  id: string;
  externalId: string | null;
  status: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  total: string;
  currency: string;
  createdAt: string;
  shippingAddress: Record<string, unknown> | null;
  items: Array<{ name: string; qty?: number; quantity?: number; price: number }>;
}

type FetchOrders = (query: string, tenantId: string, phone: string) => Promise<OrderResult[]>;

function statusEmoji(status: string): string {
  switch (status.toLowerCase()) {
    case 'pending': return '⏳';
    case 'confirmed': return '✅';
    case 'processing': return '⚙️';
    case 'shipped': return '🚚';
    case 'delivered': return '🎁';
    case 'cancelled': return '❌';
    case 'refunded': return '💸';
    default: return '📦';
  }
}

function buildTimeline(status: string): string {
  const steps = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'];
  const idx = steps.indexOf(status.toLowerCase());
  return steps.map((s, i) => {
    const emoji = i < idx ? '✅' : i === idx ? statusEmoji(status) : '⬜';
    return `${emoji} ${s.charAt(0).toUpperCase() + s.slice(1)}`;
  }).join('\n');
}

export const orderStatusFlow: Flow = {
  id: 'order-status',
  steps: new Map([
    [
      'lookup',
      async (input: string, ctx: FlowContext): Promise<FlowAction[]> => {
        const trimmed = input.trim();
        const fetchOrders = ctx.data['fetchOrders'] as FetchOrders | undefined;

        if (!fetchOrders) {
          return [
            { type: 'send_text', text: '😔 Order lookup is currently unavailable. Please contact our support team.' },
            { type: 'end_flow' },
          ];
        }

        let orders: OrderResult[] = [];
        try {
          orders = await fetchOrders(trimmed, ctx.tenantId, ctx.phone);
        } catch {
          return [
            { type: 'send_text', text: '😔 Unable to fetch orders right now. Please try again shortly.' },
            { type: 'end_flow' },
          ];
        }

        if (orders.length === 0) {
          return [
            {
              type: 'send_buttons',
              body: `😕 No orders found for *${trimmed}*.\n\nPlease check your order number or try searching by your phone number.`,
              buttons: [
                { id: 'retry_lookup', title: 'Try Again' },
                { id: 'main_menu', title: 'Main Menu' },
              ],
            },
            { type: 'update_context', updates: { currentStep: 'retry' } },
          ];
        }

        if (orders.length === 1) {
          const order = orders[0]!;
          const ref = order.externalId ?? order.id.slice(0, 8).toUpperCase();
          const tracking = order.shippingAddress?.['trackingNumber'] as string | undefined;
          const itemSummary = order.items.slice(0, 3).map((i) => `• ${i.name}`).join('\n');
          const moreItems = order.items.length > 3 ? `\n+ ${order.items.length - 3} more item(s)` : '';

          return [
            {
              type: 'send_text',
              text: `*Order #${ref}*\n\n${statusEmoji(order.status)} Status: *${order.status.toUpperCase()}*\n💳 Payment: ${order.paymentStatus}\n💰 Total: ${order.currency} ${Number(order.total).toLocaleString()}${tracking ? `\n🔍 Tracking: ${tracking}` : ''}\n\n*Items:*\n${itemSummary}${moreItems}\n\n*Progress:*\n${buildTimeline(order.status)}\n\nReply *menu* to go back or ask us anything!`,
            },
            { type: 'end_flow' },
          ];
        }

        // Multiple orders — show list
        const rows = orders.slice(0, 5).map((o) => {
          const ref = o.externalId ?? o.id.slice(0, 8).toUpperCase();
          return {
            id: o.id,
            title: `Order #${ref}`,
            description: `${statusEmoji(o.status)} ${o.status} · ${o.currency} ${Number(o.total).toLocaleString()}`,
          };
        });

        return [
          {
            type: 'send_list',
            header: 'Your Orders',
            body: `Found ${orders.length} order${orders.length !== 1 ? 's' : ''}. Select one to see details:`,
            footer: 'Tap to view',
            button: 'View Orders',
            sections: [{ title: 'Recent Orders', rows }],
          },
          {
            type: 'update_context',
            updates: {
              currentStep: 'show_order',
              data: {
                orderMap: Object.fromEntries(orders.map((o) => [o.id, o])),
              },
            },
          },
        ];
      },
    ],
    [
      'retry',
      async (input: string, ctx: FlowContext): Promise<FlowAction[]> => {
        if (input === 'main_menu') {
          return [{ type: 'transition', flow: 'main-menu', step: 'handle_selection' }];
        }
        return [
          {
            type: 'send_text',
            text: 'Please share your *order number* or the *phone number* you used to place the order.',
          },
          { type: 'update_context', updates: { currentStep: 'lookup' } },
        ];
      },
    ],
    [
      'show_order',
      async (input: string, ctx: FlowContext): Promise<FlowAction[]> => {
        const orderMap = (ctx.data['orderMap'] as Record<string, OrderResult> | undefined) ?? {};
        const order = orderMap[input];

        if (!order) {
          return [{ type: 'transition', flow: 'main-menu', step: 'handle_selection' }];
        }

        const ref = order.externalId ?? order.id.slice(0, 8).toUpperCase();
        const tracking = order.shippingAddress?.['trackingNumber'] as string | undefined;
        const itemSummary = order.items.slice(0, 3).map((i) => `• ${i.name}`).join('\n');
        const moreItems = order.items.length > 3 ? `\n+ ${order.items.length - 3} more` : '';

        return [
          {
            type: 'send_text',
            text: `*Order #${ref}*\n\n${statusEmoji(order.status)} Status: *${order.status.toUpperCase()}*\n💳 Payment: ${order.paymentStatus}\n💰 Total: ${order.currency} ${Number(order.total).toLocaleString()}${tracking ? `\n🔍 Tracking: ${tracking}` : ''}\n\n*Items:*\n${itemSummary}${moreItems}\n\n*Progress:*\n${buildTimeline(order.status)}\n\nReply *menu* to go back!`,
          },
          { type: 'end_flow' },
        ];
      },
    ],
  ]),

  onEntry: async (ctx: FlowContext): Promise<FlowAction[]> => {
    // If the customer has a known phone, offer to look up their orders automatically
    if (ctx.phone && ctx.customerId) {
      const fetchOrders = ctx.data['fetchOrders'] as FetchOrders | undefined;
      if (fetchOrders) {
        try {
          const orders = await fetchOrders('', ctx.tenantId, ctx.phone);
          if (orders.length > 0) {
            const rows = orders.slice(0, 5).map((o) => {
              const ref = o.externalId ?? o.id.slice(0, 8).toUpperCase();
              return {
                id: o.id,
                title: `Order #${ref}`,
                description: `${statusEmoji(o.status)} ${o.status} · ${o.currency} ${Number(o.total).toLocaleString()}`,
              };
            });
            return [
              {
                type: 'send_list',
                header: 'Your Orders',
                body: `Hi ${ctx.customerName ?? 'there'}! Here are your recent orders:`,
                footer: 'Tap to see details',
                button: 'My Orders',
                sections: [{ title: 'Recent Orders', rows }],
              },
              {
                type: 'update_context',
                updates: {
                  currentFlow: 'order-status',
                  currentStep: 'show_order',
                  data: {
                    orderMap: Object.fromEntries(orders.map((o) => [o.id, o])),
                  },
                },
              },
            ];
          }
        } catch {}
      }
    }

    return [
      {
        type: 'send_text',
        text: 'Please share your *order number* (e.g. SC1A2B3C) or the *phone number* you used to place the order.',
      },
      { type: 'update_context', updates: { currentFlow: 'order-status', currentStep: 'lookup' } },
    ];
  },
};
