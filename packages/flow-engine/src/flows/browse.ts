import { Flow, FlowAction, FlowContext } from '../types';

function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(price);
}

export const browseFlow: Flow = {
  id: 'browse',
  steps: new Map([
    [
      'search',
      async (input: string, _ctx: FlowContext): Promise<FlowAction[]> => {
        const lower = input.toLowerCase().trim();
        if (lower === 'categories') {
          return [
            {
              type: 'send_list',
              header: 'Browse Categories',
              body: 'Select a category to explore:',
              footer: 'Tap a category',
              button: 'Categories',
              sections: [
                {
                  rows: [
                    { id: 'cat_electronics', title: 'Electronics', description: 'Phones, laptops, gadgets' },
                    { id: 'cat_fashion', title: 'Fashion', description: 'Clothing, shoes, accessories' },
                    { id: 'cat_home', title: 'Home & Living', description: 'Furniture, decor, kitchen' },
                    { id: 'cat_beauty', title: 'Beauty & Health', description: 'Skincare, wellness' },
                    { id: 'cat_food', title: 'Food & Groceries', description: 'Fresh and packaged goods' },
                  ],
                },
              ],
            },
            { type: 'update_context', updates: { currentStep: 'results', data: { searchQuery: 'categories' } } },
          ];
        }

        return [
          {
            type: 'update_context',
            updates: {
              currentStep: 'results',
              data: { searchQuery: input },
            },
          },
          { type: 'transition', flow: 'browse', step: 'results' },
        ];
      },
    ],
    [
      'results',
      async (input: string, ctx: FlowContext): Promise<FlowAction[]> => {
        const query = (ctx.data['searchQuery'] as string | undefined) ?? input;

        const mockProducts = [
          { productId: 'prod_001', name: `${query} - Premium Edition`, price: 49.99, sku: 'SKU001' },
          { productId: 'prod_002', name: `${query} - Standard`, price: 29.99, sku: 'SKU002' },
          { productId: 'prod_003', name: `${query} - Basic`, price: 14.99, sku: 'SKU003' },
        ];

        const rows = mockProducts.slice(0, 8).map((p) => ({
          id: p.productId,
          title: p.name,
          description: formatPrice(p.price),
        }));

        return [
          {
            type: 'send_list',
            header: `Results for "${query}"`,
            body: 'Here are the products we found:',
            footer: 'Tap to add to cart',
            button: 'View Products',
            sections: [{ title: 'Products', rows }],
          },
          { type: 'update_context', updates: { currentStep: 'select_product' } },
        ];
      },
    ],
    [
      'select_product',
      async (input: string, _ctx: FlowContext): Promise<FlowAction[]> => {
        return [
          {
            type: 'send_buttons',
            header: 'Selected Product',
            body: `You selected product *${input}*.\n\nWhat would you like to do?`,
            footer: 'Choose an option',
            buttons: [
              { id: `add_to_cart:${input}`, title: 'Add to Cart' },
              { id: `view_details:${input}`, title: 'View Details' },
              { id: 'main_menu', title: 'Back to Menu' },
            ],
          },
          { type: 'update_context', updates: { currentStep: 'confirm_add', data: { selectedProductId: input } } },
        ];
      },
    ],
    [
      'confirm_add',
      async (input: string, ctx: FlowContext): Promise<FlowAction[]> => {
        if (input.startsWith('view_details:')) {
          return [
            {
              type: 'send_text',
              text: `*Product Details*\n\nThis product is available in multiple variants. Reply with the size or variant you need, or tap "Add to Cart" to add the default.`,
            },
          ];
        }

        if (input === 'main_menu') {
          return [{ type: 'transition', flow: 'main-menu', step: 'handle_selection' }];
        }

        const productId = input.startsWith('add_to_cart:') ? input.replace('add_to_cart:', '') : (ctx.data['selectedProductId'] as string | undefined) ?? input;

        const newCart = [
          ...ctx.cart,
          {
            productId,
            sku: `SKU-${productId}`,
            name: `Product ${productId}`,
            price: 29.99,
            quantity: 1,
          },
        ];

        const totalItems = newCart.reduce((sum, item) => sum + item.quantity, 0);

        return [
          { type: 'update_context', updates: { cart: newCart } },
          {
            type: 'send_buttons',
            body: `Added to cart! You have ${totalItems} item${totalItems !== 1 ? 's' : ''} in your cart.`,
            buttons: [
              { id: 'view_cart', title: 'View Cart' },
              { id: 'continue_shopping', title: 'Keep Shopping' },
              { id: 'checkout', title: 'Checkout' },
            ],
          },
          { type: 'update_context', updates: { currentStep: 'post_add' } },
        ];
      },
    ],
    [
      'post_add',
      async (input: string, _ctx: FlowContext): Promise<FlowAction[]> => {
        if (input === 'view_cart') {
          return [{ type: 'transition', flow: 'cart', step: 'handle_action' }];
        }
        if (input === 'checkout') {
          return [{ type: 'transition', flow: 'checkout', step: 'collect_address' }];
        }
        return [{ type: 'transition', flow: 'browse', step: 'search' }];
      },
    ],
  ]),

  onEntry: async (_ctx: FlowContext): Promise<FlowAction[]> => {
    return [
      {
        type: 'send_text',
        text: "What are you looking for? 🔍\n\nType a product name to search, or type *categories* to browse by category.",
      },
      { type: 'update_context', updates: { currentFlow: 'browse', currentStep: 'search' } },
    ];
  },
};
