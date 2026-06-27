import { Flow, FlowAction, FlowContext } from '../types';

export interface ProductResult {
  productId: string;
  sku: string;
  name: string;
  price: number;
  currency: string;
  inventory: number;
  imageUrl?: string;
  description?: string;
  categories?: string[];
}

type FetchProducts = (query: string, tenantId: string) => Promise<ProductResult[]>;

function formatPrice(price: number, currency = 'NGN'): string {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: currency === 'USD' ? 'USD' : 'NGN', minimumFractionDigits: 0 }).format(price);
}

function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export const browseFlow: Flow = {
  id: 'browse',
  steps: new Map([
    [
      'search',
      async (input: string, _ctx: FlowContext): Promise<FlowAction[]> => {
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
        const fetchProducts = ctx.data['fetchProducts'] as FetchProducts | undefined;

        let products: ProductResult[] = [];
        if (fetchProducts) {
          try {
            products = await fetchProducts(query, ctx.tenantId);
          } catch {
            products = [];
          }
        }

        if (products.length === 0) {
          return [
            {
              type: 'send_buttons',
              body: `😕 No products found matching *${query}*.\n\nTry a different search term or browse all products.`,
              buttons: [
                { id: 'browse_all', title: 'Browse All' },
                { id: 'main_menu', title: 'Back to Menu' },
              ],
            },
            { type: 'update_context', updates: { currentStep: 'post_empty' } },
          ];
        }

        // Store product map in context for later lookup
        const productMap: Record<string, ProductResult> = {};
        products.forEach((p) => { productMap[p.productId] = p; });

        const rows = products.slice(0, 10).map((p) => ({
          id: p.productId,
          title: truncate(p.name, 24),
          description: `${formatPrice(p.price, p.currency)}${p.inventory <= 5 && p.inventory > 0 ? ' · Only ' + p.inventory + ' left' : p.inventory === 0 ? ' · Out of stock' : ''}`,
        }));

        return [
          {
            type: 'send_list',
            header: query === 'browse_all' ? 'All Products' : `Results for "${query}"`,
            body: `Found ${products.length} product${products.length !== 1 ? 's' : ''}. Tap to view details:`,
            footer: 'Tap to select a product',
            button: 'View Products',
            sections: [{ title: 'Products', rows }],
          },
          {
            type: 'update_context',
            updates: {
              currentStep: 'select_product',
              data: { productMap },
            },
          },
        ];
      },
    ],
    [
      'post_empty',
      async (input: string, ctx: FlowContext): Promise<FlowAction[]> => {
        if (input === 'browse_all') {
          const data = { ...ctx.data, searchQuery: 'browse_all' };
          return [
            { type: 'update_context', updates: { currentStep: 'results', data } },
            { type: 'transition', flow: 'browse', step: 'results' },
          ];
        }
        return [{ type: 'transition', flow: 'main-menu', step: 'handle_selection' }];
      },
    ],
    [
      'select_product',
      async (input: string, ctx: FlowContext): Promise<FlowAction[]> => {
        if (input === 'main_menu') {
          return [{ type: 'transition', flow: 'main-menu', step: 'handle_selection' }];
        }

        const productMap = (ctx.data['productMap'] as Record<string, ProductResult> | undefined) ?? {};
        const product = productMap[input];

        if (!product) {
          return [
            {
              type: 'send_buttons',
              body: 'Sorry, that product is no longer available. Would you like to search again?',
              buttons: [
                { id: 'browse_all', title: 'Browse All' },
                { id: 'main_menu', title: 'Back to Menu' },
              ],
            },
            { type: 'update_context', updates: { currentStep: 'post_empty' } },
          ];
        }

        if (product.inventory === 0) {
          return [
            {
              type: 'send_buttons',
              body: `😔 *${product.name}* is currently out of stock.\n\nWould you like to browse other products?`,
              buttons: [
                { id: 'browse_all', title: 'Browse All' },
                { id: 'main_menu', title: 'Main Menu' },
              ],
            },
            { type: 'update_context', updates: { currentStep: 'post_empty' } },
          ];
        }

        const priceText = formatPrice(product.price, product.currency);
        const descLine = product.description ? `\n\n${truncate(product.description, 120)}` : '';
        const stockLine = product.inventory <= 5 ? `\n⚠️ Only ${product.inventory} left in stock!` : '';

        return [
          {
            type: 'send_buttons',
            header: product.name,
            body: `*${product.name}*\n💰 Price: *${priceText}*${descLine}${stockLine}\n\nWhat would you like to do?`,
            footer: `SKU: ${product.sku}`,
            buttons: [
              { id: `add_to_cart:${product.productId}`, title: 'Add to Cart' },
              { id: 'browse_all', title: 'Keep Browsing' },
              { id: 'main_menu', title: 'Main Menu' },
            ],
          },
          {
            type: 'update_context',
            updates: {
              currentStep: 'confirm_add',
              data: { selectedProductId: product.productId },
            },
          },
        ];
      },
    ],
    [
      'confirm_add',
      async (input: string, ctx: FlowContext): Promise<FlowAction[]> => {
        if (input === 'main_menu') {
          return [{ type: 'transition', flow: 'main-menu', step: 'handle_selection' }];
        }
        if (input === 'browse_all') {
          const data = { ...ctx.data, searchQuery: 'browse_all' };
          return [
            { type: 'update_context', updates: { currentStep: 'results', data } },
            { type: 'transition', flow: 'browse', step: 'results' },
          ];
        }

        const productMap = (ctx.data['productMap'] as Record<string, ProductResult> | undefined) ?? {};
        const productId = input.startsWith('add_to_cart:') ? input.replace('add_to_cart:', '') : (ctx.data['selectedProductId'] as string | undefined) ?? input;
        const product = productMap[productId];

        const cartItem = {
          productId,
          sku: product?.sku ?? `SKU-${productId}`,
          name: product?.name ?? `Product ${productId}`,
          price: product?.price ?? 0,
          quantity: 1,
          ...(product?.imageUrl ? { imageUrl: product.imageUrl } : {}),
        };

        const newCart = [...ctx.cart];
        const existingIdx = newCart.findIndex((i) => i.productId === productId);
        if (existingIdx >= 0) {
          newCart[existingIdx] = { ...newCart[existingIdx]!, quantity: newCart[existingIdx]!.quantity + 1 };
        } else {
          newCart.push(cartItem);
        }

        const totalItems = newCart.reduce((sum, item) => sum + item.quantity, 0);
        const cartTotal = newCart.reduce((sum, item) => sum + item.price * item.quantity, 0);

        return [
          { type: 'update_context', updates: { cart: newCart } },
          {
            type: 'send_buttons',
            body: `✅ *${cartItem.name}* added to cart!\n\n🛒 Cart: ${totalItems} item${totalItems !== 1 ? 's' : ''} · Total: ${formatPrice(cartTotal, product?.currency ?? 'NGN')}`,
            buttons: [
              { id: 'view_cart', title: 'View Cart' },
              { id: 'checkout', title: 'Checkout' },
              { id: 'browse_all', title: 'Keep Shopping' },
            ],
          },
          { type: 'update_context', updates: { currentStep: 'post_add' } },
        ];
      },
    ],
    [
      'post_add',
      async (input: string, ctx: FlowContext): Promise<FlowAction[]> => {
        if (input === 'view_cart') {
          return [{ type: 'transition', flow: 'cart', step: 'handle_action' }];
        }
        if (input === 'checkout') {
          return [{ type: 'transition', flow: 'checkout', step: 'collect_address' }];
        }
        // browse_all or continue_shopping
        const data = { ...ctx.data, searchQuery: 'browse_all' };
        return [
          { type: 'update_context', updates: { currentStep: 'results', data } },
          { type: 'transition', flow: 'browse', step: 'results' },
        ];
      },
    ],
  ]),

  onEntry: async (_ctx: FlowContext): Promise<FlowAction[]> => {
    return [
      {
        type: 'send_text',
        text: "What are you looking for? 🔍\n\nType a product name to search, or type *all* to see everything we have.",
      },
      { type: 'update_context', updates: { currentFlow: 'browse', currentStep: 'search' } },
    ];
  },
};
