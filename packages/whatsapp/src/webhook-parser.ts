import { WAEvent, WAEventType, WAWebhookPayload } from './types';

/**
 * Parse a raw WhatsApp webhook payload into normalized WAEvent objects
 */
export function parseWebhookPayload(payload: WAWebhookPayload): WAEvent[] {
  const events: WAEvent[] = [];

  if (payload.object !== 'whatsapp_business_account') return events;

  for (const entry of payload.entry) {
    for (const change of entry.changes) {
      if (change.field !== 'messages') continue;

      const value = change.value;
      const phoneNumberId = value.metadata.phone_number_id;

      // Parse incoming messages
      if (value.messages) {
        for (const message of value.messages) {
          const contact = value.contacts?.find((c) => c.wa_id === message.from);
          const timestamp = new Date(parseInt(message.timestamp, 10) * 1000);

          let type: WAEventType = `message.${message.type}` as WAEventType;
          // Normalize interactive sub-types
          if (message.type === 'interactive' && message.interactive) {
            type = 'message.interactive';
          }

          events.push({
            type,
            phoneNumberId,
            from: message.from,
            messageId: message.id,
            timestamp,
            contact,
            message,
          });
        }
      }

      // Parse delivery/read statuses
      if (value.statuses) {
        for (const status of value.statuses) {
          const timestamp = new Date(parseInt(status.timestamp, 10) * 1000);
          const type: WAEventType = `status.${status.status}` as WAEventType;

          events.push({
            type,
            phoneNumberId,
            messageId: status.id,
            from: status.recipient_id,
            timestamp,
            status,
          });
        }
      }
    }
  }

  return events;
}

/**
 * Extract text from any message type
 */
export function extractMessageText(message: WAEvent['message']): string | null {
  if (!message) return null;

  switch (message.type) {
    case 'text':
      return message.text?.body ?? null;
    case 'interactive':
      if (message.interactive?.type === 'button_reply') {
        return message.interactive.button_reply?.title ?? null;
      }
      if (message.interactive?.type === 'list_reply') {
        return message.interactive.list_reply?.title ?? null;
      }
      return null;
    case 'button':
      return message.button?.text ?? null;
    default:
      return null;
  }
}

/**
 * Extract the reply ID from an interactive message
 */
export function extractInteractiveReplyId(message: WAEvent['message']): string | null {
  if (!message || message.type !== 'interactive') return null;
  return (
    message.interactive?.button_reply?.id ??
    message.interactive?.list_reply?.id ??
    null
  );
}
