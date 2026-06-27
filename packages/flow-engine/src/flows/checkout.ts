import { Flow, FlowAction, FlowContext, CartItem } from '../types';

function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(price);
}

function buildCartSummary(cart: CartItem[]): string {
  const lines = cart.map(
    (item) => `• ${item.name} × ${item.quantity} — ${formatPrice(item.price * item.quantity)}`
  );
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  lines.push(`\n*Total: ${formatPrice(total)}*`);
  return lines.join('\n');
}

function parseAddress(text: string): FlowContext['pendingAddress'] | null {
  const parts = text.split(',').map((p) => p.trim());
  if (parts.length < 3) return null;

  const [address1, city, stateRaw] = parts;
  const stateParts = (stateRaw ?? '').split(' ').filter(Boolean);
  const state = stateParts.slice(0, -1).join(' ') || stateParts[0] || '';
  const zip = stateParts[stateParts.length - 1] ?? '';

  if (!address1 || !city || !state) return null;

  return {
    firstName: '',
    lastName: '',
    address1,
    city,
    state,
    zip,
    country: 'NG',
  };
}

function generateOrderId(): string {
  return `SC${Date.now().toString(36).toUpperCase()}`;
}

export const checkoutFlow: Flow = {
  id: 'checkout',
  steps: new Map([
    [
      'collect_address',
      async (input: string, ctx: FlowContext): Promise<FlowAction[]> => {
        if (input === 'same' && ctx.pendingAddress) {
          const addr = ctx.pendingAddress;
          return [
            {
              type: 'send_buttons',
              body: `Using saved address:\n${addr.address1}, ${addr.city}, ${addr.state} ${addr.zip}`,
              buttons: [
                { id: 'confirm_address', title: 'Confirm' },
                { id: 'edit_address', title: 'Edit' },
              ],
            },
            { type: 'update_context', updates: { currentStep: 'confirm_address' } },
          ];
        }

        const parsed = parseAddress(input);
        if (!parsed) {
          return [
            {
              type: 'send_text',
              text: 'Please enter your address in this format:\n*Street, City, State ZIP*\n\nExample: 12 Marina Street, Lagos, Lagos 100001',
            },
          ];
        }

        return [
          { type: 'update_context', updates: { pendingAddress: parsed, currentStep: 'confirm_address' } },
          {
            type: 'send_buttons',
            body: `Confirm delivery address:\n*${parsed.address1}, ${parsed.city}, ${parsed.state} ${parsed.zip}*`,
            buttons: [
              { id: 'confirm_address', title: 'Confirm' },
              { id: 'edit_address', title: 'Edit' },
            ],
          },
        ];
      },
    ],
    [
      'confirm_address',
      async (input: string, _ctx: FlowContext): Promise<FlowAction[]> => {
        if (input === 'edit_address') {
          return [
            {
              type: 'send_text',
              text: 'Please enter your new address:\n*Street, City, State ZIP*',
            },
            { type: 'update_context', updates: { currentStep: 'collect_address' } },
          ];
        }

        return [
          {
            type: 'send_list',
            header: 'Payment Method',
            body: 'How would you like to pay?',
            footer: 'Select a payment option',
            button: 'Payment Options',
            sections: [
              {
                rows: [
                  { id: 'pay_on_delivery', title: 'Pay on Delivery', description: 'Cash when your order arrives' },
                  { id: 'bank_transfer', title: 'Bank Transfer', description: 'Transfer to our bank account' },
                  { id: 'card_online', title: 'Card (Pay Online)', description: 'Secure online card payment' },
                ],
              },
            ],
          },
          { type: 'update_context', updates: { currentStep: 'select_payment' } },
        ];
      },
    ],
    [
      'select_payment',
      async (input: string, ctx: FlowContext): Promise<FlowAction[]> => {
        const paymentLabels: Record<string, string> = {
          pay_on_delivery: 'Pay on Delivery',
          bank_transfer: 'Bank Transfer',
          card_online: 'Card Payment',
        };

        const paymentLabel = paymentLabels[input] ?? input;
        const summary = buildCartSummary(ctx.cart);
        const total = ctx.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

        return [
          { type: 'update_context', updates: { data: { ...ctx.data, paymentMethod: input } } },
          {
            type: 'send_buttons',
            body: `*Order Summary*\n\n${summary}\n\n*Payment:* ${paymentLabel}\n*Delivery:* ${ctx.pendingAddress ? `${ctx.pendingAddress.address1}, ${ctx.pendingAddress.city}` : 'Address on file'}\n\n*Grand Total: ${formatPrice(total)}*`,
            buttons: [
              { id: 'place_order', title: 'Place Order' },
              { id: 'edit_cart', title: 'Edit Cart' },
            ],
          },
          { type: 'update_context', updates: { currentStep: 'place_order' } },
        ];
      },
    ],
    [
      'place_order',
      async (input: string, ctx: FlowContext): Promise<FlowAction[]> => {
        if (input === 'edit_cart') {
          return [{ type: 'transition', flow: 'cart', step: 'handle_action' }];
        }

        const orderId = generateOrderId();

        return [
          { type: 'update_context', updates: { cart: [], currentFlow: null, currentStep: null } },
          {
            type: 'send_text',
            text: `Order placed! 🎉\n\nOrder #${orderId} confirmed.\n\nWe'll send you updates as your order progresses. Thank you for shopping with us! 🛍️\n\nReply *menu* anytime to continue shopping.`,
          },
          { type: 'end_flow' },
        ];
      },
    ],
  ]),

  onEntry: async (ctx: FlowContext): Promise<FlowAction[]> => {
    if (ctx.cart.length === 0) {
      return [
        {
          type: 'send_buttons',
          body: 'Your cart is empty. Start shopping to add items!',
          buttons: [
            { id: 'browse_products', title: 'Browse Products' },
            { id: 'main_menu', title: 'Main Menu' },
          ],
        },
        { type: 'end_flow' },
      ];
    }

    const summary = buildCartSummary(ctx.cart);

    return [
      {
        type: 'send_text',
        text: `*Checkout*\n\n${summary}\n\nPlease enter your delivery address:\n*Street, City, State ZIP*\n\nOr type *same* to use your saved address.`,
      },
      { type: 'update_context', updates: { currentFlow: 'checkout', currentStep: 'collect_address' } },
    ];
  },
};
