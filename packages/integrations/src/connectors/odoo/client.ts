import axios, { AxiosInstance } from 'axios';
import { ConnectorError } from '../../types';

interface JsonRpcRequest {
  jsonrpc: '2.0';
  method: 'call';
  id: number;
  params: {
    service: string;
    method: string;
    args: unknown[];
  };
}

interface JsonRpcResponse<T = unknown> {
  jsonrpc: '2.0';
  id: number;
  result?: T;
  error?: {
    code: number;
    message: string;
    data: { name: string; message: string };
  };
}

export interface OdooCredentials {
  baseUrl: string;
  database: string;
  username: string;
  password: string;
}

export class OdooClient {
  private uid: number | null = null;
  private requestId = 1;
  private readonly http: AxiosInstance;

  constructor(private readonly creds: OdooCredentials) {
    this.http = axios.create({
      baseURL: creds.baseUrl.replace(/\/$/, ''),
      timeout: 30_000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  private async jsonRpc<T>(endpoint: string, service: string, method: string, args: unknown[]): Promise<T> {
    const body: JsonRpcRequest = {
      jsonrpc: '2.0',
      method: 'call',
      id: this.requestId++,
      params: { service, method, args },
    };

    const response = await this.http.post<JsonRpcResponse<T>>(endpoint, body);
    const data = response.data;

    if (data.error) {
      throw new ConnectorError(
        data.error.data?.message ?? data.error.message,
        'ODOO_RPC_ERROR',
        undefined,
        data.error,
        'odoo'
      );
    }

    return data.result as T;
  }

  async authenticate(): Promise<number> {
    if (this.uid !== null) return this.uid;

    const uid = await this.jsonRpc<number>(
      '/web/dataset/call_kw',
      'common',
      'authenticate',
      [this.creds.database, this.creds.username, this.creds.password, {}]
    );

    if (!uid || uid === false) {
      throw new ConnectorError('Odoo authentication failed', 'UNAUTHORIZED', 401, undefined, 'odoo');
    }

    this.uid = uid;
    return uid;
  }

  async call<T>(model: string, method: string, args: unknown[], kwargs: Record<string, unknown> = {}): Promise<T> {
    const uid = await this.authenticate();
    return this.jsonRpc<T>('/web/dataset/call_kw', 'object', 'execute_kw', [
      this.creds.database,
      uid,
      this.creds.password,
      model,
      method,
      args,
      kwargs,
    ]);
  }

  async searchRead<T>(
    model: string,
    domain: unknown[][],
    fields: string[],
    options: { limit?: number; offset?: number; order?: string } = {}
  ): Promise<T[]> {
    return this.call<T[]>(model, 'search_read', [domain], {
      fields,
      limit: options.limit ?? 100,
      offset: options.offset ?? 0,
      order: options.order ?? 'id asc',
    });
  }

  async read<T>(model: string, ids: number[], fields: string[]): Promise<T[]> {
    return this.call<T[]>(model, 'read', [ids], { fields });
  }

  async create(model: string, values: Record<string, unknown>): Promise<number> {
    return this.call<number>(model, 'create', [values]);
  }

  async write(model: string, ids: number[], values: Record<string, unknown>): Promise<boolean> {
    return this.call<boolean>(model, 'write', [ids, values]);
  }

  async search(model: string, domain: unknown[][]): Promise<number[]> {
    return this.call<number[]>(model, 'search', [domain]);
  }
}
