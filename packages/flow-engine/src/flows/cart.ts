import { Flow, FlowAction, FlowContext, CartItem } from '../types';

function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(price);
}

function buildCartSummary(cart: CartItem[]): string {
  if (cart.length === 0) {
    return 'Your cart is empty.';
  }

  const lines = cart.map(
    (item) => `• ${item.name} × ${item.quantity} — ${formatPrice(item.price * item.quantity)}`
  );

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  lines.push(`\n*Total: ${formatPrice(total)}*`);

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

        if (input === 'continue_shopping' || input === 'continue') {
          return [{ type: 'transition', flow: 'browse', step: 'search' }];
        }

        if (input === 'clear_cart' || input === 'clear') {
          return [
            { type: 'update_context', updates: { cart: [] } },
            { type: 'send_text', text: 'Cart cleared.' },
            { type: 'end_flow' },
          ];
        }

        const summary = buildCartSummary(ctx.cart);
        return [
          {
            type: 'send_buttons',
            body: `*Your Cart*\n\n${summary}`,
            buttons: [
              { id: 'checkout', title: 'Checkout' },
              { id: 'continue_shopping', title: 'Keep Shopping' },
              { id: 'clear_cart', title: 'Clear Cart' },
            ],
          },
          { type: 'update_context', updates: { currentStep: 'handle_action' } },
        ];
      },
    ],
  ]),

  onEntry: async (ctx: FlowContext): Promise<FlowAction[]> => {
    const summary = buildCartSummary(ctx.cart);

    return [
      {
        type: 'send_buttons',
        body: `*Your Cart*\n\n${summary}`,
        buttons: [
          { id: 'checkout', title: 'Checkout' },
          { id: 'continue_shopping', title: 'Keep Shopping' },
          { id: 'clear_cart', title: 'Clear Cart' },
        ],
      },
      { type: 'update_context', updates: { currentFlow: 'cart', currentStep: 'handle_action' } },
    ];
  },
};
