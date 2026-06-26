import { AxiosInstance } from 'axios';
import { Address, CreateCustomerInput, UnifiedCustomer } from '../../types';

// ─── Shopify Raw Customer Type ────────────────────────────────────────────────

export interface ShopifyCustomer {
  id: number;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  orders_count: number;
  total_spent: string;
  tags: string;
  accepts_marketing: boolean;
  default_address: {
    first_name: string;
    last_name: string;
    company: string | null;
    address1: string;
    address2: string | null;
    city: string;
    province: string;
    zip: string;
    country: string;
    country_code: string;
    phone: string | null;
  } | null;
  created_at: string;
  updated_at: string;
}

interface ShopifyCustomersResponse {
  customers: ShopifyCustomer[];
}

interface ShopifyCustomerResponse {
  customer: ShopifyCustomer;
}

// ─── Mapper ───────────────────────────────────────────────────────────────────

export function mapShopifyCustomer(c: ShopifyCustomer): UnifiedCustomer {
  let defaultAddress: Address | undefined;
  if (c.default_address) {
    const a = c.default_address;
    defaultAddress = {
      firstName: a.first_name,
      lastName: a.last_name,
      company: a.company ?? undefined,
      address1: a.address1,
      address2: a.address2 ?? undefined,
      city: a.city,
      state: a.province,
      zip: a.zip,
      country: a.country,
      countryCode: a.country_code,
      phone: a.phone ?? undefined,
    };
  }

  return {
    id: String(c.id),
    externalId: String(c.id),
    platform: 'shopify',
    phone: c.phone ?? '',
    email: c.email ?? undefined,
    firstName: c.first_name,
    lastName: c.last_name,
    name: `${c.first_name} ${c.last_name}`.trim(),
    tags: c.tags ? c.tags.split(', ').filter(Boolean) : [],
    totalOrders: c.orders_count,
    totalSpent: parseFloat(c.total_spent),
    currency: 'USD',
    defaultAddress,
    acceptsMarketing: c.accepts_marketing,
    createdAt: new Date(c.created_at),
    updatedAt: new Date(c.updated_at),
  };
}

// ─── Shopify Customers Client ─────────────────────────────────────────────────

export class ShopifyCustomersClient {
  constructor(
    private readonly http: AxiosInstance,
    private readonly baseUrl: string,
    private readonly apiVersion: string
  ) {}

  async getCustomer(id: string): Promise<UnifiedCustomer> {
    const url = `${this.baseUrl}/admin/api/${this.apiVersion}/customers/${id}.json`;
    const response = await this.http.get<ShopifyCustomerResponse>(url);
    return mapShopifyCustomer(response.data.customer);
  }

  async findByPhone(phone: string): Promise<UnifiedCustomer | null> {
    const url = `${this.baseUrl}/admin/api/${this.apiVersion}/customers/search.json`;
    const response = await this.http.get<ShopifyCustomersResponse>(url, {
      params: { query: `phone:${phone}`, limit: 5 },
    });
    const customers = response.data.customers;
    if (!customers.length) return null;

    // Find exact match
    const exact = customers.find(
      (c) => c.phone === phone || c.phone?.replace(/\D/g, '') === phone.replace(/\D/g, '')
    );
    return exact ? mapShopifyCustomer(exact) : mapShopifyCustomer(customers[0]!);
  }

  async createCustomer(input: CreateCustomerInput): Promise<UnifiedCustomer> {
    const body: Record<string, unknown> = {
      customer: {
        first_name: input.firstName,
        last_name: input.lastName,
        email: input.email,
        phone: input.phone,
        tags: input.tags?.join(', '),
        accepts_marketing: input.acceptsMarketing ?? false,
      },
    };

    if (input.address) {
      (body['customer'] as Record<string, unknown>)['addresses'] = [
        {
          first_name: input.address.firstName,
          last_name: input.address.lastName,
          address1: input.address.address1,
          address2: input.address.address2,
          city: input.address.city,
          province: input.address.state,
          zip: input.address.zip,
          country: input.address.country,
          phone: input.address.phone,
          default: true,
        },
      ];
    }

    const url = `${this.baseUrl}/admin/api/${this.apiVersion}/customers.json`;
    const response = await this.http.post<ShopifyCustomerResponse>(url, body);
    return mapShopifyCustomer(response.data.customer);
  }

  async listCustomers(options: { limit?: number; sinceId?: string } = {}): Promise<UnifiedCustomer[]> {
    const params: Record<string, string | number> = { limit: options.limit ?? 250 };
    if (options.sinceId) params['since_id'] = options.sinceId;

    const url = `${this.baseUrl}/admin/api/${this.apiVersion}/customers.json`;
    const response = await this.http.get<ShopifyCustomersResponse>(url, { params });
    return response.data.customers.map(mapShopifyCustomer);
  }
}
