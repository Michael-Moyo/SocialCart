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

function cartButtons(cart: CartItem[]): Array<{ id: string; title: string }> {
  return cart.length > 0
    ? [
        { id: 'checkout', title: 'Checkout' },
        { id: 'remove_item', title: 'Remove Item' },
        { id: 'clear_cart', title: 'Clear Cart' },
      ]
    : [
        { id: 'browse_all', title: 'Browse Products' },
        { id: 'main_menu', title: 'Main Menu' },
      ];
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
        if (input === 'remove_item') {
          if (ctx.cart.length === 0) {
            return [
              { type: 'send_text', text: 'Your cart is already empty.' },
              { type: 'transition', flow: 'main-menu', step: 'handle_selection' },
            ];
          }
          const currency = detectCurrency(ctx.cart);
          const rows = ctx.cart.map((item, idx) => ({
            id: `remove:${idx}`,
            title: item.name,
            description: `${item.quantity} × ${formatPrice(item.price, currency)}`,
          }));
          return [
            {
              type: 'send_list',
              header: 'Remove Item',
              body: 'Which item would you like to remove from your cart?',
              footer: 'Tap an item to remove it',
              button: 'Select Item',
              sections: [{ title: 'Cart Items', rows }],
            },
            { type: 'update_context', updates: { currentStep: 'confirm_remove' } },
          ];
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

        return [
          {
            type: 'send_buttons',
            body: `🛒 *Your Cart*\n\n${summary}`,
            buttons: cartButtons(ctx.cart),
          },
          { type: 'update_context', updates: { currentStep: 'handle_action' } },
        ];
      },
    ],
    [
      'confirm_remove',
      async (input: string, ctx: FlowContext): Promise<FlowAction[]> => {
        if (input.startsWith('remove:')) {
          const idx = parseInt(input.replace('remove:', ''), 10);
          if (!isNaN(idx) && idx >= 0 && idx < ctx.cart.length) {
            const removed = ctx.cart[idx]!;
            const newCart = ctx.cart.filter((_, i) => i !== idx);
            const summary = buildCartSummary(newCart);
            return [
              { type: 'update_context', updates: { cart: newCart, currentStep: 'handle_action' } },
              {
                type: 'send_buttons',
                body: `✅ *${removed.name}* removed.\n\n🛒 *Your Cart*\n\n${summary}`,
                buttons: cartButtons(newCart),
              },
            ];
          }
        }
        // Unrecognised input — show cart again
        return [{ type: 'update_context', updates: { currentStep: 'handle_action' } },
          { type: 'transition', flow: 'cart', step: 'handle_action' }];
      },
    ],
  ]),

  onEntry: async (ctx: FlowContext): Promise<FlowAction[]> => {
    const summary = buildCartSummary(ctx.cart);

    return [
      {
        type: 'send_buttons',
        body: `🛒 *Your Cart*\n\n${summary}`,
        buttons: cartButtons(ctx.cart),
      },
      { type: 'update_context', updates: { currentFlow: 'cart', currentStep: 'handle_action' } },
    ];
  },
};
