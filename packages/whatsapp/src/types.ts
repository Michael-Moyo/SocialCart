// ─── WhatsApp Message Types ───────────────────────────────────────────────────

export type WAMessageType = 'text' | 'image' | 'audio' | 'video' | 'document' | 'sticker' | 'location' | 'contacts' | 'interactive' | 'template' | 'reaction' | 'order' | 'button';

export interface WATextMessage {
  body: string;
  preview_url?: boolean;
}

export interface WAMediaMessage {
  id?: string;
  link?: string;
  caption?: string;
  filename?: string;
}

export interface WALocationMessage {
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}

export interface WAButtonReply {
  id: string;
  title: string;
}

export interface WAListReply {
  id: string;
  title: string;
  description?: string;
}

export interface WAInteractiveButton {
  type: 'reply';
  reply: WAButtonReply;
}

export interface WAInteractiveRow {
  id: string;
  title: string;
  description?: string;
}

export interface WAInteractiveSection {
  title?: string;
  rows: WAInteractiveRow[];
}

export interface WAInteractiveHeader {
  type: 'text' | 'image' | 'video' | 'document';
  text?: string;
  image?: { link: string };
  video?: { link: string };
  document?: { link: string; filename?: string };
}

export interface WAInteractiveBody {
  text: string;
}

export interface WAInteractiveFooter {
  text: string;
}

export interface WAInteractiveAction {
  button?: string;
  buttons?: WAInteractiveButton[];
  sections?: WAInteractiveSection[];
}

export interface WAInteractiveMessage {
  type: 'button' | 'list' | 'product' | 'product_list';
  header?: WAInteractiveHeader;
  body: WAInteractiveBody;
  footer?: WAInteractiveFooter;
  action: WAInteractiveAction;
}

// ─── Template Types ───────────────────────────────────────────────────────────

export interface WATemplateLanguage {
  code: string;
  policy?: 'deterministic';
}

export type WATemplateComponentType = 'header' | 'body' | 'footer' | 'button';
export type WATemplateParameterType = 'text' | 'currency' | 'date_time' | 'image' | 'document' | 'video';

export interface WATemplateParameter {
  type: WATemplateParameterType;
  text?: string;
  currency?: { fallback_value: string; code: string; amount_1000: number };
  date_time?: { fallback_value: string };
  image?: { link: string };
  document?: { link: string; filename?: string };
}

export interface WATemplateComponent {
  type: WATemplateComponentType;
  sub_type?: 'quick_reply' | 'url' | 'call_to_action';
  index?: number;
  parameters?: WATemplateParameter[];
}

export interface WATemplate {
  name: string;
  language: WATemplateLanguage;
  components?: WATemplateComponent[];
}

// ─── Webhook Payload Types ────────────────────────────────────────────────────

export interface WAContact {
  profile: { name: string };
  wa_id: string;
}

export interface WAIncomingMessage {
  id: string;
  from: string;
  timestamp: string;
  type: WAMessageType;
  text?: { body: string };
  image?: WAMediaMessage & { mime_type: string; sha256: string };
  audio?: WAMediaMessage & { mime_type: string; sha256: string; voice: boolean };
  video?: WAMediaMessage & { mime_type: string; sha256: string };
  document?: WAMediaMessage & { mime_type: string; sha256: string };
  sticker?: WAMediaMessage & { mime_type: string; sha256: string; animated: boolean };
  location?: WALocationMessage;
  interactive?: {
    type: 'button_reply' | 'list_reply';
    button_reply?: WAButtonReply;
    list_reply?: WAListReply;
  };
  button?: { text: string; payload: string };
  order?: {
    catalog_id: string;
    product_items: { product_retailer_id: string; quantity: number; item_price: number; currency: string }[];
  };
  reaction?: { message_id: string; emoji: string };
  referral?: { source_url: string; source_id: string; source_type: string };
  context?: { from: string; id: string };
}

export interface WAMessageStatus {
  id: string;
  recipient_id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  errors?: { code: number; title: string; message: string; error_data: { details: string } }[];
}

export interface WAWebhookEntry {
  id: string;
  changes: {
    value: {
      messaging_product: 'whatsapp';
      metadata: { display_phone_number: string; phone_number_id: string };
      contacts?: WAContact[];
      messages?: WAIncomingMessage[];
      statuses?: WAMessageStatus[];
      errors?: { code: number; title: string; message: string }[];
    };
    field: 'messages';
  }[];
}

export interface WAWebhookPayload {
  object: 'whatsapp_business_account';
  entry: WAWebhookEntry[];
}

// ─── Parsed Event ─────────────────────────────────────────────────────────────

export type WAEventType =
  | 'message.text'
  | 'message.image'
  | 'message.audio'
  | 'message.video'
  | 'message.document'
  | 'message.location'
  | 'message.interactive'
  | 'message.button'
  | 'message.order'
  | 'message.sticker'
  | 'status.sent'
  | 'status.delivered'
  | 'status.read'
  | 'status.failed';

export interface WAEvent {
  type: WAEventType;
  phoneNumberId: string;
  from?: string;
  messageId?: string;
  timestamp: Date;
  contact?: WAContact;
  message?: WAIncomingMessage;
  status?: WAMessageStatus;
}

// ─── Outgoing Message Result ──────────────────────────────────────────────────

export interface WASendResult {
  messaging_product: 'whatsapp';
  contacts: { input: string; wa_id: string }[];
  messages: { id: string }[];
}
