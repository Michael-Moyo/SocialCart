export interface CartItem {
  productId: string;
  variantId?: string;
  sku: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
}

export interface FlowContext {
  tenantId: string;
  phone: string;
  conversationId: string;
  customerId?: string;
  customerName?: string;
  currentFlow: string | null;
  currentStep: string | null;
  cart: CartItem[];
  pendingAddress?: {
    firstName: string;
    lastName: string;
    address1: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  data: Record<string, unknown>;
  platform?: string;
}

export type FlowAction =
  | { type: 'send_text'; text: string }
  | {
      type: 'send_list';
      header: string;
      body: string;
      footer: string;
      button: string;
      sections: Array<{
        title?: string;
        rows: Array<{ id: string; title: string; description?: string }>;
      }>;
    }
  | {
      type: 'send_buttons';
      body: string;
      buttons: Array<{ id: string; title: string }>;
      header?: string;
      footer?: string;
    }
  | { type: 'transition'; flow: string; step: string }
  | { type: 'update_context'; updates: Partial<FlowContext> }
  | { type: 'end_flow' };

export type StepHandler = (input: string, ctx: FlowContext) => Promise<FlowAction[]>;

export interface FlowStep {
  id: string;
  handler: StepHandler;
}

export interface Flow {
  id: string;
  steps: Map<string, StepHandler>;
  onEntry?: (ctx: FlowContext) => Promise<FlowAction[]>;
}
