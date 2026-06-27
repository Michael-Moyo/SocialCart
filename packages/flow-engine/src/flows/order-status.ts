import { Flow, FlowAction, FlowContext } from '../types';

export const orderStatusFlow: Flow = {
  id: 'order-status',
  steps: new Map([
    [
      'lookup',
      async (input: string, _ctx: FlowContext): Promise<FlowAction[]> => {
        const isPhone = /^\+?\d{7,15}$/.test(input.replace(/\s/g, ''));
        const isOrderId = /^SC[A-Z0-9]+$/i.test(input.trim());

        if (!isPhone && !isOrderId) {
          return [
            {
              type: 'send_text',
              text: 'Please enter a valid order number (e.g. SC1A2B3C) or your phone number (e.g. +2348012345678).',
            },
          ];
        }

        const mockOrder = {
          id: isOrderId ? input.trim().toUpperCase() : 'SC1A2B3C',
          status: 'In Transit',
          placedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toLocaleDateString(),
          estimatedDelivery: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toLocaleDateString(),
        };

        return [
          {
            type: 'send_text',
            text: `*Order Status*\n\nOrder #${mockOrder.id}\n\n📦 Status: *${mockOrder.status}*\n📅 Placed: ${mockOrder.placedAt}\n🚚 Est. Delivery: ${mockOrder.estimatedDelivery}\n\n*Timeline:*\n✅ Order confirmed\n✅ Payment received\n✅ Packed & shipped\n🔄 In transit — on the way!\n⬜ Delivered\n\nReply *menu* to go back or ask any questions.`,
          },
          { type: 'end_flow' },
        ];
      },
    ],
  ]),

  onEntry: async (_ctx: FlowContext): Promise<FlowAction[]> => {
    return [
      {
        type: 'send_text',
        text: 'Please share your *order number* (e.g. SC1A2B3C) or the *phone number* you used to place the order.',
      },
      { type: 'update_context', updates: { currentFlow: 'order-status', currentStep: 'lookup' } },
    ];
  },
};
