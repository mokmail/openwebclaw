// ---------------------------------------------------------------------------
// OpenWebClaw — WhatsApp Business API Channel
// ---------------------------------------------------------------------------

import type { Channel, InboundMessage } from '../types.js';

type MessageCallback = (msg: InboundMessage) => void;

/**
 * WhatsApp channel using the Meta Cloud API (WhatsApp Business API).
 * Requires: WhatsApp Business Account, Phone Number ID, Access Token
 * 
 * Setup:
 * 1. Create a Meta Developer app with WhatsApp product
 * 2. Get Phone Number ID and Access Token
 * 3. Configure webhook verification
 */
export class WhatsAppChannel implements Channel {
  readonly type = 'whatsapp' as const;
  
  private phoneNumberId: string = '';
  private accessToken: string = '';
  private webhookVerifyToken: string = '';
  private registeredPhoneNumbers = new Set<string>();
  private messageCallback: MessageCallback | null = null;
  private pollingInterval: number | null = null;

  /**
   * Configure the channel with WhatsApp Business API credentials.
   */
  configure(config: {
    phoneNumberId: string;
    accessToken: string;
    webhookVerifyToken?: string;
    allowedNumbers?: string[];
  }): void {
    this.phoneNumberId = config.phoneNumberId;
    this.accessToken = config.accessToken;
    this.webhookVerifyToken = config.webhookVerifyToken || '';
    this.registeredPhoneNumbers = new Set(config.allowedNumbers || []);
  }

  /**
   * Add a phone number to the allowed list.
   */
  registerPhoneNumber(phone: string): void {
    // Normalize: remove all non-digits, keep country code
    const normalized = normalizePhone(phone);
    this.registeredPhoneNumbers.add(normalized);
  }

  /**
   * Start the channel (for webhook-based receiving).
   * Note: Webhooks need to be handled server-side. This is for polling fallback.
   */
  start(): void {
    if (!this.phoneNumberId || !this.accessToken) return;
    if (this.pollingInterval) return;
    
    // Poll every 5 seconds as fallback (webhooks preferred)
    this.pollingInterval = window.setInterval(() => {
      this.pollMessages();
    }, 5000);
  }

  /**
   * Stop polling.
   */
  stop(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  /**
   * Send a message to a WhatsApp user.
   */
  async send(groupId: string, text: string): Promise<void> {
    const phone = groupId.replace(/^wa:/, '');
    
    // WhatsApp API has a 4096 char limit, but recommended is ~1024 for templates
    // For regular messages, we can use ~1600 chars
    const chunks = splitText(text, 1600);
    
    for (const chunk of chunks) {
      try {
        await this.apiCall('messages', {
          messaging_product: 'whatsapp',
          to: phone,
          type: 'text',
          text: { body: chunk },
        });
      } catch (err) {
        console.error('WhatsApp send error:', err);
        throw err;
      }
    }
  }

  /**
   * Send a typing indicator.
   */
  setTyping(groupId: string, typing: boolean): void {
    const phone = groupId.replace(/^wa:/, '');
    
    this.apiCall('messages', {
      messaging_product: 'whatsapp',
      to: phone,
      type: 'typing',
      typing: typing ? 'true' : 'false',
    }).catch(() => { });
  }

  /**
   * Register callback for inbound messages.
   */
  onMessage(callback: MessageCallback): void {
    this.messageCallback = callback;
  }

  /**
   * Check if the channel is configured.
   */
  isConfigured(): boolean {
    return this.phoneNumberId.length > 0 && this.accessToken.length > 0;
  }

  /**
   * Test the WhatsApp configuration by making a test API call.
   * Returns true if the configuration is valid.
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    if (!this.isConfigured()) {
      return { success: false, error: 'WhatsApp not configured. Please set Phone Number ID and Access Token.' };
    }

    try {
      // Try to get phone number info as a test
      const version = 'v21.0';
      const url = `https://graph.facebook.com/${version}/${this.phoneNumberId}?access_token=${this.accessToken}`;

      const res = await fetch(url);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const errorMsg = errorData.error?.message || `HTTP ${res.status}`;
        return { success: false, error: `WhatsApp API Error: ${errorMsg}` };
      }

      const data = await res.json();
      console.log('WhatsApp connection test successful:', data);
      return { success: true };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Connection failed: ${errorMsg}` };
    }
  }

  /**
   * Handle incoming webhook payload (call this from your webhook endpoint).
   */
  handleWebhook(payload: WhatsAppWebhookPayload): void {
    if (!payload.entry) return;

    for (const entry of payload.entry) {
      if (!entry.changes) continue;
      
      for (const change of entry.changes) {
        if (!change.value?.messages) continue;
        
        for (const msg of change.value.messages) {
          this.handleInboundMessage(msg, change.value.metadata);
        }
      }
    }
  }

  /**
   * Verify webhook token (for initial webhook setup).
   */
  verifyWebhook(mode: string, token: string, challenge: string): string | null {
    if (mode === 'subscribe' && token === this.webhookVerifyToken) {
      return challenge; // Return challenge to complete verification
    }
    return null;
  }

  // -----------------------------------------------------------------------
  // Private
  // -----------------------------------------------------------------------

  private async pollMessages(): Promise<void> {
    // Note: The WhatsApp API doesn't support polling for messages.
    // This is a placeholder for future functionality or use with a proxy.
    // Webhooks are the recommended approach.
  }

  private handleInboundMessage(msg: WhatsAppMessage, metadata: WhatsAppMetadata): void {
    const phone = msg.from;
    
    // Check whitelist if configured
    if (this.registeredPhoneNumbers.size > 0 && 
        !this.registeredPhoneNumbers.has(phone)) {
      console.log('Ignoring message from unregistered number:', phone);
      return;
    }

    // Extract message content
    let content = '';
    switch (msg.type) {
      case 'text':
        content = msg.text?.body || '';
        break;
      case 'image':
        content = msg.image?.caption || '[Image]';
        break;
      case 'video':
        content = msg.video?.caption || '[Video]';
        break;
      case 'audio':
        content = '[Audio]';
        break;
      case 'voice':
        content = '[Voice message]';
        break;
      case 'document':
        content = msg.document?.filename 
          ? `[Document: ${msg.document.filename}]` 
          : '[Document]';
        break;
      case 'location':
        content = msg.location?.latitude && msg.location?.longitude
          ? `[Location: ${msg.location.latitude}, ${msg.location.longitude}]`
          : '[Location]';
        break;
      case 'contacts':
        content = msg.contacts 
          ? `[${msg.contacts.length} contact(s)]`
          : '[Contacts]';
        break;
      case 'button':
        content = msg.button?.text || '[Button click]';
        break;
      case 'interactive':
        if (msg.interactive?.type === 'button_reply') {
          content = msg.interactive.button_reply?.title || '[Button reply]';
        } else if (msg.interactive?.type === 'list_reply') {
          content = msg.interactive.list_reply?.title || '[List reply]';
        }
        break;
      default:
        content = `[${msg.type || 'Unknown'} message]`;
    }

    const senderName = msg.from; // WhatsApp uses phone numbers as sender ID

    this.messageCallback?.({
      id: msg.id || String(Date.now()),
      groupId: `wa:${phone}`,
      sender: senderName,
      content,
      timestamp: (msg.timestamp as number) * 1000,
      channel: 'whatsapp',
    });
  }

  private async apiCall(endpoint: string, body: Record<string, unknown>): Promise<unknown> {
    const version = 'v21.0'; // WhatsApp API version
    const url = `https://graph.facebook.com/${version}/${this.phoneNumberId}/${endpoint}`;
    
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`WhatsApp API ${endpoint} failed: ${res.status} ${text}`);
    }
    
    return res.json();
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizePhone(phone: string): string {
  // Remove all non-digits
  return phone.replace(/\D/g, '');
}

function splitText(text: string, max: number): string[] {
  if (text.length <= max) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= max) {
      chunks.push(remaining);
      break;
    }
    // Try to split at a newline boundary
    let end = max;
    const lastNewline = remaining.lastIndexOf('\n', max);
    if (lastNewline > max * 0.5) end = lastNewline;
    chunks.push(remaining.slice(0, end));
    remaining = remaining.slice(end);
  }
  return chunks;
}

// ---------------------------------------------------------------------------
// WhatsApp API types
// ---------------------------------------------------------------------------

interface WhatsAppWebhookPayload {
  object: string;
  entry?: WhatsAppEntry[];
}

interface WhatsAppEntry {
  id: string;
  changes: WhatsAppChange[];
}

interface WhatsAppChange {
  value: {
    messaging_product: string;
    metadata: WhatsAppMetadata;
    messages?: WhatsAppMessage[];
  };
  field: string;
}

interface WhatsAppMetadata {
  display_phone_number: string;
  phone_number_id: string;
}

interface WhatsAppMessage {
  id: string;
  from: string;
  type: string;
  timestamp: string | number;
  text?: { body: string };
  image?: { id?: string; caption?: string; mime_type?: string };
  video?: { id?: string; caption?: string; mime_type?: string };
  audio?: { id?: string; mime_type?: string };
  voice?: { id?: string; mime_type?: string };
  document?: { id?: string; filename?: string; mime_type?: string };
  location?: { latitude: number; longitude: number };
  contacts?: unknown[];
  button?: { payload: string; text: string };
  interactive?: {
    type: string;
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string; description?: string };
  };
}
