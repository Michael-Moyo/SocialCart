import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import {
  WAInteractiveMessage,
  WAMediaMessage,
  WASendResult,
  WATemplate,
  WATextMessage,
} from './types';

export interface WhatsAppClientConfig {
  accessToken: string;
  phoneNumberId: string;
  apiVersion?: string; // default: v19.0
  businessAccountId?: string;
}

export class WhatsAppClient {
  private readonly http: AxiosInstance;
  private readonly phoneNumberId: string;
  private readonly apiVersion: string;

  constructor(config: WhatsAppClientConfig) {
    this.phoneNumberId = config.phoneNumberId;
    this.apiVersion = config.apiVersion ?? 'v19.0';

    this.http = axios.create({
      baseURL: `https://graph.facebook.com/${this.apiVersion}`,
      timeout: 30_000,
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
    });
  }

  private get messagesUrl(): string {
    return `/${this.phoneNumberId}/messages`;
  }

  /**
   * Send a plain text message
   */
  async sendTextMessage(to: string, text: string, previewUrl = false): Promise<WASendResult> {
    const body: WATextMessage = { body: text, preview_url: previewUrl };
    const response = await this.http.post<WASendResult>(this.messagesUrl, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: body,
    });
    return response.data;
  }

  /**
   * Send a template message
   */
  async sendTemplate(
    to: string,
    templateName: string,
    languageCode: string,
    components?: WATemplate['components']
  ): Promise<WASendResult> {
    const template: WATemplate = {
      name: templateName,
      language: { code: languageCode },
      components,
    };
    const response = await this.http.post<WASendResult>(this.messagesUrl, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'template',
      template,
    });
    return response.data;
  }

  /**
   * Send an interactive list message (for product menus, etc.)
   */
  async sendInteractiveList(
    to: string,
    header: string,
    body: string,
    footer: string,
    buttonText: string,
    sections: WAInteractiveMessage['action']['sections']
  ): Promise<WASendResult> {
    const interactive: WAInteractiveMessage = {
      type: 'list',
      header: { type: 'text', text: header },
      body: { text: body },
      footer: { text: footer },
      action: { button: buttonText, sections },
    };
    const response = await this.http.post<WASendResult>(this.messagesUrl, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive,
    });
    return response.data;
  }

  /**
   * Send an interactive reply button message (up to 3 buttons)
   */
  async sendInteractiveButtons(
    to: string,
    body: string,
    buttons: { id: string; title: string }[],
    header?: string,
    footer?: string
  ): Promise<WASendResult> {
    const interactive: WAInteractiveMessage = {
      type: 'button',
      body: { text: body },
      footer: footer ? { text: footer } : undefined,
      header: header ? { type: 'text', text: header } : undefined,
      action: {
        buttons: buttons.map((b) => ({ type: 'reply', reply: { id: b.id, title: b.title } })),
      },
    };
    const response = await this.http.post<WASendResult>(this.messagesUrl, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive,
    });
    return response.data;
  }

  /**
   * Send a media message (image, video, document, audio)
   */
  async sendMediaMessage(
    to: string,
    type: 'image' | 'video' | 'document' | 'audio' | 'sticker',
    url: string,
    caption?: string,
    filename?: string
  ): Promise<WASendResult> {
    const media: WAMediaMessage = { link: url, caption, filename };
    const response = await this.http.post<WASendResult>(this.messagesUrl, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type,
      [type]: media,
    });
    return response.data;
  }

  /**
   * Send a location message
   */
  async sendLocation(
    to: string,
    latitude: number,
    longitude: number,
    name?: string,
    address?: string
  ): Promise<WASendResult> {
    const response = await this.http.post<WASendResult>(this.messagesUrl, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'location',
      location: { latitude, longitude, name, address },
    });
    return response.data;
  }

  /**
   * Mark a message as read
   */
  async markAsRead(messageId: string): Promise<void> {
    await this.http.post(this.messagesUrl, {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    });
  }

  /**
   * Get a media URL from a media ID
   */
  async getMediaUrl(mediaId: string): Promise<string> {
    const response = await this.http.get<{ url: string; mime_type: string; file_size: number; id: string }>(
      `/${mediaId}`
    );
    return response.data.url;
  }

  /**
   * Download media content from a media URL
   * (requires Authorization header on download request)
   */
  async downloadMedia(mediaUrl: string): Promise<Buffer> {
    const response = await this.http.get<ArrayBuffer>(mediaUrl, { responseType: 'arraybuffer' });
    return Buffer.from(response.data);
  }

  /**
   * Verify WhatsApp webhook signature
   * Header: X-Hub-Signature-256 = sha256=<hmac>
   */
  verifyWebhookSignature(payload: Buffer, signature: string, appSecret: string): boolean {
    const expected = `sha256=${crypto.createHmac('sha256', appSecret).update(payload).digest('hex')}`;
    try {
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    } catch {
      return false;
    }
  }

  /**
   * Get phone number details
   */
  async getPhoneNumberInfo(): Promise<{ id: string; display_phone_number: string; verified_name: string }> {
    const response = await this.http.get<{ id: string; display_phone_number: string; verified_name: string }>(
      `/${this.phoneNumberId}`
    );
    return response.data;
  }

  /**
   * Upload media to WhatsApp servers
   */
  async uploadMedia(fileBuffer: Buffer, mimeType: string): Promise<{ id: string }> {
    const FormData = (await import('form-data')).default;
    const form = new FormData();
    form.append('messaging_product', 'whatsapp');
    form.append('file', fileBuffer, { contentType: mimeType, filename: 'upload' });

    const response = await this.http.post<{ id: string }>(
      `/${this.phoneNumberId}/media`,
      form,
      { headers: form.getHeaders() }
    );
    return response.data;
  }
}
