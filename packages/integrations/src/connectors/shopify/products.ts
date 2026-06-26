import { AxiosInstance } from 'axios';
import {
  GetProductsOptions,
  ProductImage,
  UnifiedProduct,
  UnifiedVariant,
} from '../../types';

// ─── Shopify Raw Types ────────────────────────────────────────────────────────

interface ShopifyVariant {
  id: number;
  product_id: number;
  title: string;
  sku: string;
  price: string;
  compare_at_price: string | null;
  inventory_quantity: number;
  option1: string | null;
  option2: string | null;
  option3: string | null;
}

interface ShopifyImage {
  id: number;
  src: string;
  alt: string | null;
  position: number;
}

interface ShopifyProduct {
  id: number;
  title: string;
  body_html: string;
  vendor: string;
  product_type: string;
  status: string;
  tags: string;
  variants: ShopifyVariant[];
  images: ShopifyImage[];
  options: { name: string; values: string[] }[];
  created_at: string;
  updated_at: string;
}

interface ShopifyProductsResponse {
  products: ShopifyProduct[];
}

interface ShopifyProductResponse {
  product: ShopifyProduct;
}

// ─── Mapper ───────────────────────────────────────────────────────────────────

export function mapShopifyProduct(p: ShopifyProduct): UnifiedProduct {
  const optionNames = p.options.map((o) => o.name);

  const variants: UnifiedVariant[] = p.variants.map((v) => {
    const attributes: Record<string, string> = {};
    if (v.option1 && optionNames[0]) attributes[optionNames[0]] = v.option1;
    if (v.option2 && optionNames[1]) attributes[optionNames[1]] = v.option2;
    if (v.option3 && optionNames[2]) attributes[optionNames[2]] = v.option3;

    return {
      id: String(v.id),
      externalId: String(v.id),
      sku: v.sku || `${p.id}-${v.id}`,
      name: v.title,
      price: parseFloat(v.price),
      compareAtPrice: v.compare_at_price ? parseFloat(v.compare_at_price) : undefined,
      inventory: v.inventory_quantity,
      attributes,
    };
  });

  const images: ProductImage[] = p.images.map((img) => ({
    url: img.src,
    alt: img.alt ?? undefined,
    position: img.position,
  }));

  // Use first variant price as product price
  const firstVariant = p.variants[0];
  const price = firstVariant ? parseFloat(firstVariant.price) : 0;
  const compareAtPrice = firstVariant?.compare_at_price
    ? parseFloat(firstVariant.compare_at_price)
    : undefined;

  const totalInventory = p.variants.reduce((sum, v) => sum + Math.max(0, v.inventory_quantity), 0);

  const categories = p.product_type ? [p.product_type] : [];
  const tags = p.tags ? p.tags.split(', ').filter(Boolean) : [];

  let status: 'active' | 'inactive' | 'draft' = 'active';
  if (p.status === 'archived') status = 'inactive';
  else if (p.status === 'draft') status = 'draft';

  // Determine primary SKU from first variant
  const primarySku = firstVariant?.sku || String(p.id);

  return {
    id: String(p.id),
    externalId: String(p.id),
    platform: 'shopify',
    sku: primarySku,
    name: p.title,
    description: p.body_html.replace(/<[^>]*>/g, ''), // strip HTML
    price,
    compareAtPrice,
    currency: 'USD', // Shopify currency comes from shop settings; default USD
    inventory: totalInventory,
    images,
    variants,
    categories,
    tags,
    status,
    metadata: { vendor: p.vendor },
    createdAt: new Date(p.created_at),
    updatedAt: new Date(p.updated_at),
  };
}

// ─── Shopify Products Client ──────────────────────────────────────────────────

export class ShopifyProductsClient {
  constructor(
    private readonly http: AxiosInstance,
    private readonly baseUrl: string,
    private readonly apiVersion: string
  ) {}

  async listProducts(options: GetProductsOptions = {}): Promise<UnifiedProduct[]> {
    const params: Record<string, string | number> = {
      limit: options.limit ?? 250,
    };
    if (options.status && options.status !== 'all') {
      params['status'] = options.status === 'active' ? 'active' : 'archived';
    }
    if (options.sinceId) params['since_id'] = options.sinceId;
    if (options.updatedAfter) params['updated_at_min'] = options.updatedAfter.toISOString();
    if (options.ids?.length) params['ids'] = options.ids.join(',');

    const products: UnifiedProduct[] = [];
    let pageInfo: string | null = null;
    let firstPage = true;

    while (firstPage || pageInfo) {
      firstPage = false;
      const queryParams = pageInfo
        ? { limit: params['limit'], page_info: pageInfo }
        : params;

      const url = `${this.baseUrl}/admin/api/${this.apiVersion}/products.json`;
      const response = await this.http.get<ShopifyProductsResponse>(url, { params: queryParams });
      const data = response.data;

      for (const p of data.products) {
        products.push(mapShopifyProduct(p));
      }

      // Parse Link header for cursor pagination
      const linkHeader = response.headers['link'] as string | undefined;
      pageInfo = null;
      if (linkHeader) {
        const nextMatch = linkHeader.match(/<[^>]*page_info=([^>&"]+)[^>]*>;\s*rel="next"/);
        if (nextMatch?.[1]) {
          pageInfo = nextMatch[1];
        }
      }
    }

    return products;
  }

  async getProduct(id: string): Promise<UnifiedProduct> {
    const url = `${this.baseUrl}/admin/api/${this.apiVersion}/products/${id}.json`;
    const response = await this.http.get<ShopifyProductResponse>(url);
    return mapShopifyProduct(response.data.product);
  }

  async getInventoryLevel(inventoryItemId: string, locationId?: string): Promise<number> {
    const params: Record<string, string> = { inventory_item_ids: inventoryItemId };
    if (locationId) params['location_ids'] = locationId;
    const url = `${this.baseUrl}/admin/api/${this.apiVersion}/inventory_levels.json`;
    const response = await this.http.get<{ inventory_levels: { available: number }[] }>(url, { params });
    return response.data.inventory_levels.reduce((sum, l) => sum + l.available, 0);
  }
}
