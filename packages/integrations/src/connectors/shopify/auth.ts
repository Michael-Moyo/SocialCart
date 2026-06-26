import crypto from 'crypto';

export interface ShopifyAuthConfig {
  shopDomain: string;
  apiKey: string;
  apiSecret: string;
  scopes: string[];
  redirectUri: string;
}

/**
 * Build the OAuth authorization URL for Shopify
 */
export function buildAuthUrl(config: ShopifyAuthConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: config.apiKey,
    scope: config.scopes.join(','),
    redirect_uri: config.redirectUri,
    state,
    'grant_options[]': 'per-user',
  });
  return `https://${config.shopDomain}/admin/oauth/authorize?${params.toString()}`;
}

/**
 * Verify the HMAC signature on OAuth callback query params
 */
export function verifyOAuthHmac(query: Record<string, string>, apiSecret: string): boolean {
  const { hmac, ...rest } = query;
  if (!hmac) return false;
  const message = Object.keys(rest)
    .sort()
    .map((k) => `${k}=${rest[k] ?? ''}`)
    .join('&');
  const digest = crypto.createHmac('sha256', apiSecret).update(message).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmac));
}

/**
 * Exchange authorization code for a permanent access token
 */
export async function exchangeCode(
  shopDomain: string,
  apiKey: string,
  apiSecret: string,
  code: string
): Promise<string> {
  const url = `https://${shopDomain}/admin/oauth/access_token`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: apiKey, client_secret: apiSecret, code }),
  });
  if (!response.ok) {
    throw new Error(`Failed to exchange code: ${response.statusText}`);
  }
  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}

/**
 * Verify Shopify webhook HMAC-SHA256 signature
 */
export function verifyWebhookHmac(payload: Buffer, signature: string, secret: string): boolean {
  const digest = crypto.createHmac('sha256', secret).update(payload).digest('base64');
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
  } catch {
    return false;
  }
}
