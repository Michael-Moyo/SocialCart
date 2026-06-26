import { AxiosInstance } from 'axios';
import { Address, CreateCustomerInput, UnifiedCustomer } from '../../types';

interface WCAddress {
  first_name: string;
  last_name: string;
  company: string;
  address_1: string;
  address_2: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
  phone?: string;
}

export interface WCCustomer {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  username: string;
  billing: WCAddress & { email: string; phone: string };
  shipping: WCAddress;
  is_paying_customer: boolean;
  orders_count: number;
  total_spent: string;
  avatar_url: string;
  date_created: string;
  date_modified: string;
  meta_data: { key: string; value: unknown }[];
}

export function mapWCCustomer(c: WCCustomer): UnifiedCustomer {
  let defaultAddress: Address | undefined;
  if (c.billing.address_1) {
    defaultAddress = {
      firstName: c.billing.first_name,
      lastName: c.billing.last_name,
      address1: c.billing.address_1,
      address2: c.billing.address_2 || undefined,
      city: c.billing.city,
      state: c.billing.state,
      zip: c.billing.postcode,
      country: c.billing.country,
      phone: c.billing.phone,
    };
  }

  return {
    id: String(c.id),
    externalId: String(c.id),
    platform: 'woocommerce',
    phone: c.billing.phone || '',
    email: c.email,
    firstName: c.first_name,
    lastName: c.last_name,
    name: `${c.first_name} ${c.last_name}`.trim(),
    tags: [],
    totalOrders: c.orders_count,
    totalSpent: parseFloat(c.total_spent),
    currency: 'USD',
    defaultAddress,
    createdAt: new Date(c.date_created),
    updatedAt: new Date(c.date_modified),
  };
}

export class WooCommerceCustomersClient {
  constructor(
    private readonly http: AxiosInstance,
    private readonly baseUrl: string
  ) {}

  async getCustomer(id: string): Promise<UnifiedCustomer> {
    const response = await this.http.get<WCCustomer>(`${this.baseUrl}/wp-json/wc/v3/customers/${id}`);
    return mapWCCustomer(response.data);
  }

  async findByPhone(phone: string): Promise<UnifiedCustomer | null> {
    // WooCommerce doesn't have a phone search endpoint — search by billing phone via metadata
    const normalizedPhone = phone.replace(/\D/g, '');

    const response = await this.http.get<WCCustomer[]>(`${this.baseUrl}/wp-json/wc/v3/customers`, {
      params: { per_page: 100, orderby: 'registered_date', order: 'desc' },
    });

    const match = response.data.find((c) => {
      const cPhone = c.billing.phone?.replace(/\D/g, '') ?? '';
      return cPhone === normalizedPhone || cPhone === phone;
    });

    return match ? mapWCCustomer(match) : null;
  }

  async createCustomer(input: CreateCustomerInput): Promise<UnifiedCustomer> {
    const billing: Record<string, string> = {
      first_name: input.firstName,
      last_name: input.lastName,
      email: input.email ?? '',
      phone: input.phone,
    };

    if (input.address) {
      billing['address_1'] = input.address.address1;
      billing['address_2'] = input.address.address2 ?? '';
      billing['city'] = input.address.city;
      billing['state'] = input.address.state;
      billing['postcode'] = input.address.zip;
      billing['country'] = input.address.country;
    }

    const body = {
      email: input.email ?? `${input.phone.replace(/\D/g, '')}@whatsapp.socialcart.local`,
      first_name: input.firstName,
      last_name: input.lastName,
      username: `wa_${input.phone.replace(/\D/g, '')}`,
      billing,
      shipping: billing,
    };

    const response = await this.http.post<WCCustomer>(`${this.baseUrl}/wp-json/wc/v3/customers`, body);
    return mapWCCustomer(response.data);
  }
}
