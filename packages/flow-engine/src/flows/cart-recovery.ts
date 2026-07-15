import { Flow, FlowAction, FlowContext, CartItem } from '../types';

function detectCurrency(cart: CartItem[]): string {
  return cart.find((i) => i.currency)?.currency ?? 'NGN';
}

function formatPrice(price: number, currency = 'NGN'): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: currency === 'USD' ? 'USD' : 'NGN',
    minimumFractionDigits: 0,
  }).format(price);
}

export const cartRecoveryFlow: Flow = {
  id: 'cart-recovery',
  steps: new Map([
    [
      'handle_response',
      async (input: string, _ctx: FlowContext): Promise<FlowAction[]> => {
        if (input === 'yes_checkout') {
          return [{ type: 'transition', flow: 'checkout', step: 'collect_address' }];
        }
        if (input === 'show_cart') {
          return [{ type: 'transition', flow: 'cart', step: 'handle_action' }];
        }
        return [
          {
            type: 'send_text',
            text: "No worries! Your cart is saved. Reply *cart* anytime to pick up where you left off. Happy shopping! 🛍️",
          },
          { type: 'end_flow' },
        ];
      },
    ],
  ]),

  onEntry: async (ctx: FlowContext): Promise<FlowAction[]> => {
    const name = ctx.customerName ? ctx.customerName.split(' ')[0] : 'there';
    const currency = detectCurrency(ctx.cart);
    const itemCount = ctx.cart.reduce((sum, item) => sum + item.quantity, 0);
    const total = ctx.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const itemList = ctx.cart.slice(0, 3).map((i) => `• ${i.name} × ${i.quantity}`).join('\n');
    const moreItems = ctx.cart.length > 3 ? `\n+ ${ctx.cart.length - 3} more` : '';

    return [
      {
        type: 'send_buttons',
        body: `Hey ${name}! 👋\n\nYou left ${itemCount} item${itemCount !== 1 ? 's' : ''} in your cart:\n${itemList}${moreItems}\n\n💰 Total: *${formatPrice(total, currency)}*\n\nReady to complete your purchase?`,
        buttons: [
          { id: 'yes_checkout', title: 'Yes, Checkout!' },
          { id: 'show_cart', title: 'Show My Cart' },
          { id: 'no_thanks', title: 'Not Right Now' },
        ],
      },
      { type: 'update_context', updates: { currentFlow: 'cart-recovery', currentStep: 'handle_response' } },
    ];
  },
};
