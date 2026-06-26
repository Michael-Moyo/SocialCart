import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from 'axios';
import { sleep } from '@socialcart/shared';
import {
  ConnectorConfig,
  ConnectorError,
  CreateCustomerInput,
  CreateOrderInput,
  GetProductsOptions,
  PlatformType,
  UnifiedCustomer,
  UnifiedInventory,
  UnifiedOrder,
  UnifiedProduct,
} from './types';

// ─── Rate Limiter (Token Bucket) ──────────────────────────────────────────────

class TokenBucket {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private readonly capacity: number,
    private readonly refillRate: number, // tokens per ms
  ) {
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  async consume(tokens = 1): Promise<void> {
    this.refill();
    if (this.tokens < tokens) {
      const waitMs = Math.ceil((tokens - this.tokens) / this.refillRate);
      await sleep(waitMs);
      this.refill();
    }
    this.tokens -= tokens;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }
}

// ─── Abstract BaseConnector ───────────────────────────────────────────────────

export abstract class BaseConnector {
  protected readonly config: ConnectorConfig;
  protected readonly http: AxiosInstance;
  protected readonly platform: PlatformType;
  private readonly rateLimiter: TokenBucket;

  constructor(config: ConnectorConfig) {
    this.config = config;
    this.platform = config.type;

    // Default rate limit: 2 req/s unless overridden
    const rl = config.rateLimit ?? { requests: 2, windowMs: 1000 };
    const refillRate = rl.requests / rl.windowMs; // tokens/ms
    this.rateLimiter = new TokenBucket(rl.requests, refillRate);

    this.http = axios.create({
      timeout: 30_000,
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    this.http.interceptors.response.use(
      (res) => res,
      (err: AxiosError) => {
        throw this.normalizeError(err);
      }
    );
  }

  // ─── Retry with Exponential Backoff ────────────────────────────────────────

  protected async withRetry<T>(
    fn: () => Promise<T>,
    maxRetries = 3,
    baseDelayMs = 1000
  ): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err;
        if (err instanceof ConnectorError) {
          // Don't retry client errors (4xx except 429)
          if (err.statusCode && err.statusCode >= 400 && err.statusCode < 500 && err.statusCode !== 429) {
            throw err;
          }
        }
        if (attempt < maxRetries) {
          const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 500;
          await sleep(delay);
        }
      }
    }
    throw lastError;
  }

  // ─── Rate-Limited Request ──────────────────────────────────────────────────

  protected async rateLimitedRequest<T>(fn: () => Promise<T>): Promise<T> {
    await this.rateLimiter.consume();
    return fn();
  }

  // ─── Rate-Limited + Retried Request ───────────────────────────────────────

  protected async request<T>(fn: () => Promise<T>): Promise<T> {
    return this.withRetry(() => this.rateLimitedRequest(fn));
  }

  // ─── HTTP Helpers ──────────────────────────────────────────────────────────

  protected async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.request(async () => {
      const res = await this.http.get<T>(url, config);
      return res.data;
    });
  }

  protected async post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return this.request(async () => {
      const res = await this.http.post<T>(url, data, config);
      return res.data;
    });
  }

  protected async put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return this.request(async () => {
      const res = await this.http.put<T>(url, data, config);
      return res.data;
    });
  }

  protected async patch<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return this.request(async () => {
      const res = await this.http.patch<T>(url, data, config);
      return res.data;
    });
  }

  protected async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.request(async () => {
      const res = await this.http.delete<T>(url, config);
      return res.data;
    });
  }

  // ─── Error Normalization ───────────────────────────────────────────────────

  protected normalizeError(err: unknown): ConnectorError {
    if (err instanceof ConnectorError) return err;

    if (axios.isAxiosError(err)) {
      const status = err.response?.status;
      const responseData = err.response?.data as Record<string, unknown> | undefined;
      const message =
        (responseData?.['error'] as string) ??
        (responseData?.['message'] as string) ??
        (responseData?.['errors'] as string) ??
        err.message ??
        'Unknown API error';

      let code = 'API_ERROR';
      if (status === 401) code = 'UNAUTHORIZED';
      else if (status === 403) code = 'FORBIDDEN';
      else if (status === 404) code = 'NOT_FOUND';
      else if (status === 422) code = 'VALIDATION_ERROR';
      else if (status === 429) code = 'RATE_LIMITED';
      else if (status && status >= 500) code = 'SERVER_ERROR';

      return new ConnectorError(String(message), code, status, err, this.platform);
    }

    if (err instanceof Error) {
      return new ConnectorError(err.message, 'UNKNOWN_ERROR', undefined, err, this.platform);
    }

    return new ConnectorError('An unknown error occurred', 'UNKNOWN_ERROR', undefined, err, this.platform);
  }

  // ─── Abstract Interface ────────────────────────────────────────────────────

  abstract getProducts(options?: GetProductsOptions): Promise<UnifiedProduct[]>;
  abstract getProduct(id: string): Promise<UnifiedProduct>;
  abstract createOrder(order: CreateOrderInput): Promise<UnifiedOrder>;
  abstract getOrder(id: string): Promise<UnifiedOrder>;
  abstract updateOrderStatus(id: string, status: string): Promise<UnifiedOrder>;
  abstract getCustomer(id: string): Promise<UnifiedCustomer>;
  abstract findCustomerByPhone(phone: string): Promise<UnifiedCustomer | null>;
  abstract createCustomer(customer: CreateCustomerInput): Promise<UnifiedCustomer>;
  abstract checkInventory(productId: string, variantId?: string): Promise<UnifiedInventory>;
  abstract verifyWebhook(payload: Buffer, signature: string): boolean;
  abstract handleWebhook(event: string, payload: unknown): Promise<void>;

  // ─── Test Connection ───────────────────────────────────────────────────────
  abstract testConnection(): Promise<boolean>;
}
