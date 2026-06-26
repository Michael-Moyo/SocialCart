import axios, { AxiosInstance } from 'axios';
import { ConnectorError } from '../../types';

export interface ERPNextCredentials {
  baseUrl: string;
  apiKey: string;
  apiSecret: string;
}

export class ERPNextClient {
  readonly http: AxiosInstance;

  constructor(private readonly creds: ERPNextCredentials) {
    this.http = axios.create({
      baseURL: creds.baseUrl.replace(/\/$/, ''),
      timeout: 30_000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `token ${creds.apiKey}:${creds.apiSecret}`,
      },
    });

    this.http.interceptors.response.use(
      (res) => res,
      (err) => {
        if (axios.isAxiosError(err)) {
          const status = err.response?.status;
          const data = err.response?.data as { exc?: string; _server_messages?: string } | undefined;
          let message = err.message;
          if (data?._server_messages) {
            try {
              const msgs = JSON.parse(data._server_messages) as string[];
              message = msgs.map((m) => JSON.parse(m) as { message: string }).map((m) => m.message).join('; ');
            } catch {
              // ignore parse errors
            }
          }
          throw new ConnectorError(message, 'ERPNEXT_API_ERROR', status, err, 'erpnext');
        }
        throw err;
      }
    );
  }

  async getList<T>(
    doctype: string,
    options: {
      fields?: string[];
      filters?: unknown[][];
      limit?: number;
      limit_start?: number;
      order_by?: string;
    } = {}
  ): Promise<T[]> {
    const params: Record<string, unknown> = {
      doctype,
      fields: JSON.stringify(options.fields ?? ['*']),
      limit_page_length: options.limit ?? 100,
      limit_start: options.limit_start ?? 0,
    };
    if (options.filters) params['filters'] = JSON.stringify(options.filters);
    if (options.order_by) params['order_by'] = options.order_by;

    const response = await this.http.get<{ data: T[] }>('/api/resource/' + doctype, { params });
    return response.data.data;
  }

  async getDoc<T>(doctype: string, name: string): Promise<T> {
    const response = await this.http.get<{ data: T }>(`/api/resource/${doctype}/${encodeURIComponent(name)}`);
    return response.data.data;
  }

  async createDoc<T>(doctype: string, data: Record<string, unknown>): Promise<T> {
    const response = await this.http.post<{ data: T }>(`/api/resource/${doctype}`, data);
    return response.data.data;
  }

  async updateDoc<T>(doctype: string, name: string, data: Record<string, unknown>): Promise<T> {
    const response = await this.http.put<{ data: T }>(`/api/resource/${doctype}/${encodeURIComponent(name)}`, data);
    return response.data.data;
  }

  async callMethod<T>(method: string, args: Record<string, unknown> = {}): Promise<T> {
    const response = await this.http.post<{ message: T }>(`/api/method/${method}`, args);
    return response.data.message;
  }
}
