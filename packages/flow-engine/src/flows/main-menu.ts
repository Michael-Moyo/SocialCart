import { Flow, FlowAction, FlowContext } from '../types';

export const mainMenuFlow: Flow = {
  id: 'main-menu',
  steps: new Map([
    [
      'handle_selection',
      async (input: string, _ctx: FlowContext): Promise<FlowAction[]> => {
        const selectionMap: Record<string, { flow: string; step: string }> = {
          browse_products: { flow: 'browse', step: 'search' },
          search_product: { flow: 'browse', step: 'search' },
          view_cart: { flow: 'cart', step: 'handle_action' },
          track_order: { flow: 'order-status', step: 'lookup' },
          order_history: { flow: 'order-status', step: 'lookup' },
          talk_to_human: { flow: 'main-menu', step: 'handle_selection' },
          faq: { flow: 'main-menu', step: 'handle_selection' },
        };

        const target = selectionMap[input];

        if (target) {
          return [{ type: 'transition', flow: target.flow, step: target.step }];
        }

        const lower = input.toLowerCase().trim();
        if (lower === 'cart') {
          return [{ type: 'transition', flow: 'cart', step: 'handle_action' }];
        }
        if (lower === 'checkout') {
          return [{ type: 'transition', flow: 'checkout', step: 'collect_address' }];
        }
        if (lower === 'orders' || lower === 'track') {
          return [{ type: 'transition', flow: 'order-status', step: 'lookup' }];
        }

        if (lower === 'talk_to_human' || lower === 'human' || lower === 'agent') {
          return [
            {
              type: 'send_text',
              text: 'Connecting you to a support agent. Please wait a moment... 🙋',
            },
            { type: 'end_flow' },
          ];
        }

        if (lower === 'faq') {
          return [
            {
              type: 'send_text',
              text: `*Frequently Asked Questions*\n\n• *How do I track my order?* — Reply "track" anytime\n• *Can I change my order?* — Contact us within 1 hour of placing\n• *What payment methods are accepted?* — Pay on delivery, bank transfer, or card\n• *How long is delivery?* — 2–5 business days depending on location\n\nReply with your question or type "menu" to go back.`,
            },
            { type: 'end_flow' },
          ];
        }

        return [
          {
            type: 'send_text',
            text: "I didn't understand that. Type 'menu' to see options.",
          },
        ];
      },
    ],
  ]),

  onEntry: async (_ctx: FlowContext): Promise<FlowAction[]> => {
    return [
      {
        type: 'send_list',
        header: 'Welcome to SocialCart 🛒',
        body: 'What would you like to do today?',
        footer: 'Tap an option below',
        button: 'View Menu',
        sections: [
          {
            title: 'Shop',
            rows: [
              { id: 'browse_products', title: 'Browse Products', description: 'Explore our catalogue' },
              { id: 'search_product', title: 'Search Product', description: 'Find something specific' },
              { id: 'view_cart', title: 'View Cart', description: 'See items in your cart' },
            ],
          },
          {
            title: 'Orders',
            rows: [
              { id: 'track_order', title: 'Track Order', description: 'Check your order status' },
              { id: 'order_history', title: 'Order History', description: 'View past orders' },
            ],
          },
          {
            title: 'Help',
            rows: [
              { id: 'talk_to_human', title: 'Talk to Agent', description: 'Chat with a human' },
              { id: 'faq', title: 'FAQs', description: 'Common questions answered' },
            ],
          },
        ],
      },
      {
        type: 'update_context',
        updates: { currentFlow: 'main-menu', currentStep: 'handle_selection' },
      },
    ];
  },
};
