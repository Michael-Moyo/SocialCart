import { AxiosInstance } from 'axios';
import { GetProductsOptions, ProductImage, UnifiedProduct, UnifiedVariant } from '../../types';

interface WCAttribute {
  id: number;
  name: string;
  options: string[];
}

interface WCVariation {
  id: number;
  sku: string;
  price: string;
  regular_price: string;
  stock_quantity: number | null;
  manage_stock: boolean;
  attributes: { name: string; option: string }[];
  status: string;
}

interface WCImage {
  id: number;
  src: string;
  alt: string;
}

interface WCCategory {
  id: number;
  name: string;
  slug: string;
}

export interface WCProduct {
  id: number;
  name: string;
  slug: string;
  description: string;
  short_description: string;
  sku: string;
  price: string;
  regular_price: string;
  sale_price: string;
  stock_quantity: number | null;
  manage_stock: boolean;
  stock_status: string;
  status: string;
  catalog_visibility: string;
  images: WCImage[];
  categories: WCCategory[];
  tags: { id: number; name: string }[];
  attributes: WCAttribute[];
  type: 'simple' | 'variable' | 'grouped' | 'external';
  variations: number[];
  date_created: string;
  date_modified: string;
}

export function mapWCProduct(p: WCProduct, variations: WCVariation[] = []): UnifiedProduct {
  const images: ProductImage[] = p.images.map((img, i) => ({
    url: img.src,
    alt: img.alt || undefined,
    position: i + 1,
  }));

  const mappedVariants: UnifiedVariant[] = variations.map((v) => {
    const attributes: Record<string, string> = {};
    v.attributes.forEach((a) => { attributes[a.name] = a.option; });
    return {
      id: String(v.id),
      externalId: String(v.id),
      sku: v.sku || `${p.id}-${v.id}`,
      name: Object.values(attributes).join(' / ') || `Variation ${v.id}`,
      price: parseFloat(v.price) || parseFloat(p.price),
      compareAtPrice: v.regular_price && v.price !== v.regular_price
        ? parseFloat(v.regular_price)
        : undefined,
      inventory: v.stock_quantity ?? 0,
      attributes,
    };
  });

  const categories = p.categories.map((c) => c.name);
  const tags = p.tags.map((t) => t.name);

  let status: 'active' | 'inactive' | 'draft' = 'active';
  if (p.status === 'trash' || p.status === 'private') status = 'inactive';
  else if (p.status === 'draft') status = 'draft';

  const inventory =
    p.manage_stock && p.stock_quantity !== null
      ? p.stock_quantity
      : p.stock_status === 'instock'
      ? 999
      : 0;

  const compareAtPrice =
    p.regular_price && p.sale_price && p.sale_price !== p.regular_price
      ? parseFloat(p.regular_price)
      : undefined;

  return {
    id: String(p.id),
    externalId: String(p.id),
    platform: 'woocommerce',
    sku: p.sku || String(p.id),
    name: p.name,
    description: p.description.replace(/<[^>]*>/g, ''),
    price: parseFloat(p.price) || 0,
    compareAtPrice,
    currency: 'USD',
    inventory,
    images,
    variants: mappedVariants,
    categories,
    tags,
    status,
    createdAt: new Date(p.date_created),
    updatedAt: new Date(p.date_modified),
  };
}

export class WooCommerceProductsClient {
  constructor(
    private readonly http: AxiosInstance,
    private readonly baseUrl: string
  ) {}

  async listProducts(options: GetProductsOptions = {}): Promise<UnifiedProduct[]> {
    const params: Record<string, string | number> = {
      per_page: options.limit ?? 100,
      page: options.page ?? 1,
    };
    if (options.status && options.status !== 'all') {
      params['status'] = options.status === 'active' ? 'publish' : 'draft';
    } else {
      params['status'] = 'any';
    }
    if (options.search) params['search'] = options.search;
    if (options.updatedAfter) params['modified_after'] = options.updatedAfter.toISOString();

    const response = await this.http.get<WCProduct[]>(`${this.baseUrl}/wp-json/wc/v3/products`, { params });
    const products = response.data;

    // Fetch variations for variable products in parallel (batched)
    const result: UnifiedProduct[] = [];
    for (const p of products) {
      if (p.type === 'variable' && p.variations.length > 0) {
        const variationsResponse = await this.http.get<WCVariation[]>(
          `${this.baseUrl}/wp-json/wc/v3/products/${p.id}/variations`,
          { params: { per_page: 100 } }
        );
        result.push(mapWCProduct(p, variationsResponse.data));
      } else {
        result.push(mapWCProduct(p));
      }
    }
    return result;
  }

  async getProduct(id: string): Promise<UnifiedProduct> {
    const response = await this.http.get<WCProduct>(`${this.baseUrl}/wp-json/wc/v3/products/${id}`);
    const p = response.data;
    if (p.type === 'variable' && p.variations.length > 0) {
      const variationsResponse = await this.http.get<WCVariation[]>(
        `${this.baseUrl}/wp-json/wc/v3/products/${id}/variations`,
        { params: { per_page: 100 } }
      );
      return mapWCProduct(p, variationsResponse.data);
    }
    return mapWCProduct(p);
  }
}
