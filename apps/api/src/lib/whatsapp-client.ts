import axios from 'axios';

const GRAPH_URL = 'https://graph.facebook.com/v19.0';

class WhatsAppClient {
  private get token() { return process.env['WHATSAPP_ACCESS_TOKEN'] ?? ''; }
  private get phoneId() { return process.env['WHATSAPP_PHONE_NUMBER_ID'] ?? ''; }

  /** Send OTP code using a text template message */
  async sendOtp(to: string, otp: string): Promise<boolean> {
    if (!this.token || !this.phoneId) return false;
    try {
      await axios.post(
        `${GRAPH_URL}/${this.phoneId}/messages`,
        {
          messaging_product: 'whatsapp',
          to,
          type: 'template',
          template: {
            name: 'otp_verification',
            language: { code: 'en_US' },
            components: [
              {
                type: 'body',
                parameters: [{ type: 'text', text: otp }],
              },
              {
                type: 'button',
                sub_type: 'url',
                index: '0',
                parameters: [{ type: 'text', text: otp }],
              },
            ],
          },
        },
        { headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' } }
      );
      return true;
    } catch (err: unknown) {
      // Fall back to plain text if template not approved yet
      try {
        await this.sendText(to, `Your SocialCart verification code is: *${otp}*\n\nThis code expires in 5 minutes. Do not share it with anyone.`);
        return true;
      } catch {
        return false;
      }
    }
  }

  /** Send a plain text notification to the tenant owner */
  async sendNotification(to: string, message: string): Promise<boolean> {
    if (!this.token || !this.phoneId) return false;
    try {
      await this.sendText(to, message);
      return true;
    } catch {
      return false;
    }
  }

  private async sendText(to: string, text: string) {
    await axios.post(
      `${GRAPH_URL}/${this.phoneId}/messages`,
      { messaging_product: 'whatsapp', to, type: 'text', text: { body: text } },
      { headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' } }
    );
  }
}

export const whatsappClient = new WhatsAppClient();
