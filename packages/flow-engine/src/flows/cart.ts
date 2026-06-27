import { Flow, FlowAction, FlowContext, CartItem } from '../types';

function formatPrice(price: number, currency = 'NGN'): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: currency === 'USD' ? 'USD' : 'NGN',
    minimumFractionDigits: 0,
  }).format(price);
}

function detectCurrency(cart: CartItem[]): string {
  return cart.find((i) => i.currency)?.currency ?? 'NGN';
}

function buildCartSummary(cart: CartItem[]): string {
  if (cart.length === 0) return 'Your cart is empty.';
  const currency = detectCurrency(cart);
  const lines = cart.map(
    (item) => `• ${item.name} × ${item.quantity} — ${formatPrice(item.price * item.quantity, currency)}`
  );
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  lines.push(`\n*Total: ${formatPrice(total, currency)}*`);
  return lines.join('\n');
}

export const cartFlow: Flow = {
  id: 'cart',
  steps: new Map([
    [
      'handle_action',
      async (input: string, ctx: FlowContext): Promise<FlowAction[]> => {
        if (input === 'checkout') {
          return [{ type: 'transition', flow: 'checkout', step: 'collect_address' }];
        }
        if (input === 'continue_shopping' || input === 'continue' || input === 'browse_all') {
          return [{ type: 'transition', flow: 'browse', step: 'search' }];
        }
        if (input === 'clear_cart' || input === 'clear') {
          return [
            { type: 'update_context', updates: { cart: [] } },
            {
              type: 'send_buttons',
              body: '🗑️ Cart cleared! Ready to browse again?',
              buttons: [
                { id: 'browse_all', title: 'Browse Products' },
                { id: 'main_menu', title: 'Main Menu' },
              ],
            },
            { type: 'end_flow' },
          ];
        }
        if (input === 'main_menu') {
          return [{ type: 'transition', flow: 'main-menu', step: 'handle_selection' }];
        }

        const summary = buildCartSummary(ctx.cart);
        const buttons: Array<{ id: string; title: string }> = ctx.cart.length > 0
          ? [
              { id: 'checkout', title: 'Checkout' },
              { id: 'continue_shopping', title: 'Keep Shopping' },
              { id: 'clear_cart', title: 'Clear Cart' },
            ]
          : [
              { id: 'browse_all', title: 'Browse Products' },
              { id: 'main_menu', title: 'Main Menu' },
            ];

        return [
          {
            type: 'send_buttons',
            body: `🛒 *Your Cart*\n\n${summary}`,
            buttons,
          },
          { type: 'update_context', updates: { currentStep: 'handle_action' } },
        ];
      },
    ],
  ]),

  onEntry: async (ctx: FlowContext): Promise<FlowAction[]> => {
    const summary = buildCartSummary(ctx.cart);
    const buttons: Array<{ id: string; title: string }> = ctx.cart.length > 0
      ? [
          { id: 'checkout', title: 'Checkout' },
          { id: 'continue_shopping', title: 'Keep Shopping' },
          { id: 'clear_cart', title: 'Clear Cart' },
        ]
      : [
          { id: 'browse_all', title: 'Browse Products' },
          { id: 'main_menu', title: 'Main Menu' },
        ];

    return [
      {
        type: 'send_buttons',
        body: `🛒 *Your Cart*\n\n${summary}`,
        buttons,
      },
      { type: 'update_context', updates: { currentFlow: 'cart', currentStep: 'handle_action' } },
    ];
  },
};
