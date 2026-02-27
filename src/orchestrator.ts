// ---------------------------------------------------------------------------
// OpenWebClaw — Orchestrator
// ---------------------------------------------------------------------------
//
// The orchestrator is the main thread coordinator. It manages:
// - State machine (idle → thinking → responding)
// - Message queue and routing
// - Agent worker lifecycle
// - Channel coordination
// - Task scheduling
//
// This mirrors NanoClaw's src/index.ts but adapted for browser primitives.

import type {
  InboundMessage,
  StoredMessage,
  WorkerOutbound,
  OrchestratorState,
  Task,
  ConversationMessage,
  ThinkingLogEntry,
} from './types.js';
import {
  ASSISTANT_NAME,
  CONFIG_KEYS,
  CONTEXT_WINDOW_SIZE,
  DEFAULT_GROUP_ID,
  DEFAULT_MAX_TOKENS,
  DEFAULT_MODEL,
  DEFAULT_PROVIDER,
  DEFAULT_OLLAMA_URL,
  DEFAULT_OPENWEBUI_URL,
  MEMORY_FILE,
  buildTriggerPattern,
  type Provider,
} from './config.js';
import {
  openDatabase,
  saveMessage,
  getRecentMessages,
  buildConversationMessages,
  getConfig,
  setConfig,
  saveTask,
  clearGroupMessages,
} from './db.js';
import { readGroupFile, writeGroupFile, groupFileExists } from './storage.js';
import { encryptValue, decryptValue } from './crypto.js';
import { BrowserChatChannel } from './channels/browser-chat.js';
import { TelegramChannel } from './channels/telegram.js';
import { WhatsAppChannel } from './channels/whatsapp.js';
import { Router } from './router.js';
import { TaskScheduler } from './task-scheduler.js';
import { ulid } from './ulid.js';

// ---------------------------------------------------------------------------
// Event emitter for UI updates
// ---------------------------------------------------------------------------

type EventMap = {
  'state-change': OrchestratorState;
  'message': StoredMessage;
  'typing': { groupId: string; typing: boolean };
  'tool-activity': { groupId: string; tool: string; status: string };
  'thinking-log': ThinkingLogEntry;
  'error': { groupId: string; error: string };
  'ready': void;
  'session-reset': { groupId: string };
  'context-compacted': { groupId: string; summary: string };
  'token-usage': import('./types.js').TokenUsage;
};

type EventCallback<T> = (data: T) => void;

class EventBus {
  private listeners = new Map<string, Set<EventCallback<any>>>();

  on<K extends keyof EventMap>(event: K, callback: EventCallback<EventMap[K]>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off<K extends keyof EventMap>(event: K, callback: EventCallback<EventMap[K]>): void {
    this.listeners.get(event)?.delete(callback);
  }

  emit<K extends keyof EventMap>(event: K, data: EventMap[K]): void {
    this.listeners.get(event)?.forEach((cb) => cb(data));
  }
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export class Orchestrator {
  readonly events = new EventBus();
  readonly browserChat = new BrowserChatChannel();
  readonly telegram = new TelegramChannel();
  readonly whatsapp = new WhatsAppChannel();


  private router!: Router;
  private scheduler!: TaskScheduler;
  private agentWorker!: Worker;
  private state: OrchestratorState = 'idle';
  private triggerPattern!: RegExp;
  private assistantName: string = ASSISTANT_NAME;
  private apiKey: string = '';
  private model: string = DEFAULT_MODEL;
  private maxTokens: number = DEFAULT_MAX_TOKENS;
  private provider: Provider = DEFAULT_PROVIDER;
  private ollamaUrl: string = DEFAULT_OLLAMA_URL;
  private openWebUIUrl: string = DEFAULT_OPENWEBUI_URL;
  private openWebUIKey: string = '';
  private messageQueue: InboundMessage[] = [];
  private processing = false;
  private pendingScheduledTasks = new Set<string>();
  private isDestroyed = false;

  /**
   * Initialize the orchestrator. Must be called before anything else.
   */
  async init(): Promise<void> {
    // Open database
    await openDatabase();

    // Ensure memory file exists for the default group
    await this.ensureMemoryFile(DEFAULT_GROUP_ID);

    // Load config
    this.assistantName = (await getConfig(CONFIG_KEYS.ASSISTANT_NAME)) || ASSISTANT_NAME;
    this.triggerPattern = buildTriggerPattern(this.assistantName);
    const storedKey = await getConfig(CONFIG_KEYS.ANTHROPIC_API_KEY);
    if (storedKey) {
      try {
        this.apiKey = await decryptValue(storedKey);
      } catch {
        // Stored as plaintext from before encryption — clear it
        this.apiKey = '';
        await setConfig(CONFIG_KEYS.ANTHROPIC_API_KEY, '');
      }
    }
    this.model = (await getConfig(CONFIG_KEYS.MODEL)) || DEFAULT_MODEL;
    this.maxTokens = parseInt(
      (await getConfig(CONFIG_KEYS.MAX_TOKENS)) || String(DEFAULT_MAX_TOKENS),
      10,
    );
    this.provider = (await getConfig(CONFIG_KEYS.PROVIDER)) as Provider || DEFAULT_PROVIDER;
    this.ollamaUrl = (await getConfig(CONFIG_KEYS.OLLAMA_URL)) || DEFAULT_OLLAMA_URL;
    if (this.ollamaUrl === 'http://localhost:11434') {
      this.ollamaUrl = DEFAULT_OLLAMA_URL;
      await setConfig(CONFIG_KEYS.OLLAMA_URL, this.ollamaUrl);
    }
    this.openWebUIUrl = (await getConfig(CONFIG_KEYS.OPENWEBUI_URL)) || DEFAULT_OPENWEBUI_URL;
    const storedOpenWebUIKey = await getConfig(CONFIG_KEYS.OPENWEBUI_API_KEY);
    if (storedOpenWebUIKey) {
      try {
        this.openWebUIKey = await decryptValue(storedOpenWebUIKey);
      } catch {
        this.openWebUIKey = '';
      }
    }

    // Set up router
this.router = new Router(this.browserChat, this.telegram, this.whatsapp);

    // Set up channels
    this.browserChat.onMessage((msg) => this.enqueue(msg));

    // Configure Telegram if token exists
    const telegramToken = await getConfig(CONFIG_KEYS.TELEGRAM_BOT_TOKEN);
    if (telegramToken) {
      const chatIdsRaw = await getConfig(CONFIG_KEYS.TELEGRAM_CHAT_IDS);
      if (this.isDestroyed) return;
      const chatIds: string[] = chatIdsRaw ? JSON.parse(chatIdsRaw) : [];
      this.telegram.configure(telegramToken, chatIds);
      this.telegram.onMessage((msg) => this.enqueue(msg));
    }

    // Configure WhatsApp if credentials exist
    const whatsappPhoneId = await getConfig(CONFIG_KEYS.WHATSAPP_PHONE_NUMBER_ID);
    const whatsappToken = await getConfig(CONFIG_KEYS.WHATSAPP_ACCESS_TOKEN);
    if (whatsappPhoneId && whatsappToken) {
      const whatsappNumbersRaw = await getConfig(CONFIG_KEYS.WHATSAPP_ALLOWED_NUMBERS);
      const allowedNumbers: string[] = whatsappNumbersRaw ? JSON.parse(whatsappNumbersRaw) : [];
      this.whatsapp.configure({
        phoneNumberId: whatsappPhoneId,
        accessToken: whatsappToken,
        allowedNumbers,
      });
      this.whatsapp.onMessage((msg) => this.enqueue(msg));
    }


    this.agentWorker = new Worker(
      new URL('./agent-worker.ts', import.meta.url),
      { type: 'module' },
    );
    this.agentWorker.onmessage = (event: MessageEvent<WorkerOutbound>) => {
      this.handleWorkerMessage(event.data);
    };
    this.agentWorker.onerror = (err) => {
      console.error('Agent worker error:', err);
    };

    // Set up task scheduler
    this.scheduler = new TaskScheduler((groupId, prompt) =>
      this.invokeAgent(groupId, prompt),
    );

    // Wire up browser chat display callback
    this.browserChat.onDisplay((groupId, text, isFromMe) => {
      // Display handled via events.emit('message', ...)
    });

    // Ensure memory file exists for default group
    await this.ensureMemoryFile(DEFAULT_GROUP_ID);

    this.events.emit('ready', undefined);
  }

  /**
   * Ensure the memory file exists for a group.
   */
  private async ensureMemoryFile(groupId: string): Promise<void> {
    try {
      const exists = await groupFileExists(groupId, MEMORY_FILE);
      if (!exists) {
        const defaultMemory = `# Memory

This file stores persistent context that the assistant remembers across conversations.

## User Preferences
<!-- Add preferences here -->

## Notes
<!-- Add important notes here -->
`;
        await writeGroupFile(groupId, MEMORY_FILE, defaultMemory);
      }
    } catch (err) {
      console.warn('Failed to ensure memory file:', err);
    }
  }

  /**
   * Start background loops. Called exactly once by App.tsx.
   */
  start(): void {
    if (this.isDestroyed) return;
    this.telegram.start();
    this.whatsapp.start();
    this.scheduler.start();
  }

  /**
   * Get the current state.
   */
  getState(): OrchestratorState {
    return this.state;
  }

  /**
   * Check if the API key is configured (or Ollama is available).
   */
  isConfigured(): boolean {
    if (this.provider === 'ollama') return true; // Ollama needs no key
    if (this.provider === 'openwebui') return this.openWebUIKey.length > 0;
    return this.apiKey.length > 0;
  }

  /**
   * Update the API key.
   */
  async setApiKey(key: string): Promise<void> {
    this.apiKey = key;
    const encrypted = await encryptValue(key);
    await setConfig(CONFIG_KEYS.ANTHROPIC_API_KEY, encrypted);
  }

  /**
   * Get current model.
   */
  getModel(): string {
    return this.model;
  }

  /**
   * Get API key.
   */
  getApiKey(): string {
    return this.apiKey;
  }

  /**
   * Update the model.
   */
  async setModel(model: string): Promise<void> {
    this.model = model;
    await setConfig(CONFIG_KEYS.MODEL, model);
  }

  /**
   * Get provider.
   */
  getProvider(): Provider {
    return this.provider;
  }

  /**
   * Update provider.
   */
  async setProvider(provider: Provider): Promise<void> {
    this.provider = provider;
    await setConfig(CONFIG_KEYS.PROVIDER, provider);
  }

  /**
   * Get Ollama URL.
   */
  getOllamaUrl(): string {
    return this.ollamaUrl;
  }

  /**
   * Update Ollama URL.
   */
  async setOllamaUrl(url: string): Promise<void> {
    this.ollamaUrl = url;
    await setConfig(CONFIG_KEYS.OLLAMA_URL, url);
  }

  /**
   * Get OpenWebUI URL.
   */
  getOpenWebUIUrl(): string {
    return this.openWebUIUrl;
  }

  /**
   * Update OpenWebUI URL.
   */
  async setOpenWebUIUrl(url: string): Promise<void> {
    this.openWebUIUrl = url;
    await setConfig(CONFIG_KEYS.OPENWEBUI_URL, url);
  }

  /**
   * Get OpenWebUI API Key.
   */
  getOpenWebUIKey(): string {
    return this.openWebUIKey;
  }

  /**
   * Update OpenWebUI API Key.
   */
  async setOpenWebUIKey(key: string): Promise<void> {
    this.openWebUIKey = key;
    const encrypted = await encryptValue(key);
    await setConfig(CONFIG_KEYS.OPENWEBUI_API_KEY, encrypted);
  }

  /**
   * Fetch available models from OpenWebUI server.
   */
  async fetchOpenWebUIModels(): Promise<{ value: string; label: string }[]> {
    // Skip if OpenWebUI is not configured (still using default placeholder)
    if (this.openWebUIUrl === DEFAULT_OPENWEBUI_URL) {
      console.debug('OpenWebUI not configured, skipping model fetch');
      return [];
    }

    try {
      const res = await fetch(`${this.openWebUIUrl}/api/models`, {
        headers: {
          Authorization: `Bearer ${this.openWebUIKey}`
        }
      });
      if (!res.ok) {
        console.error('Failed to fetch OpenWebUI models:', res.status, res.statusText);
        return [];
      }
      const data = await res.json();
      const models = (data.data || []).map((m: { id: string, name: string }) => ({
        value: m.id,
        label: m.name || m.id,
      }));
      return models;
    } catch (err) {
      console.error('Error fetching OpenWebUI models:', err);
      return [];
    }
  }

  /**
   * Fetch available models from Ollama server.
   */
  async fetchOllamaModels(): Promise<{ value: string; label: string }[]> {
    // If the URL is empty or just the default placeholder, nothing to do.
    if (!this.ollamaUrl || this.ollamaUrl === DEFAULT_OLLAMA_URL) {
      console.debug('Ollama URL not set or still default, returning empty list');
      return [];
    }

    // Helper function: given a candidate path, do the fetch and normalize
    const tryFetch = async (path: string): Promise<{ value: string; label: string }[]> => {
      try {
        const res = await fetch(path);
        if (!res.ok) return [];
        const data = await res.json();
        if (Array.isArray(data)) return normalize(data);
        if (Array.isArray(data.models)) return normalize(data.models);
      } catch (e) {
        console.debug('Ollama fetch error', e, path);
      }
      return [];
    };

    // Helper to parse a returned array into the expected shape
    const normalize = (arr: any[]): { value: string; label: string }[] =>
      arr
        .map((m) => (typeof m === 'string' ? m : m.name || m.id || ''))
        .filter((s) => s)
        .map((s) => ({ value: s, label: s }));

    try {
      // If the provided URL already points to /api/models or /api/tags, use it directly
      if (this.ollamaUrl.match(/\/api\/(models|tags)$/)) {
        const results = await tryFetch(this.ollamaUrl);
        console.log('Fetched Ollama models (direct URL):', results);
        return results;
      }

      // Otherwise attempt common endpoints relative to the base URL.
      let results = await tryFetch(`${this.ollamaUrl.replace(/\/+$/,'')}/api/models`);
      if (results.length > 0) {
        console.log('Fetched Ollama models (/api/models):', results);
        return results;
      }
      results = await tryFetch(`${this.ollamaUrl.replace(/\/+$/,'')}/api/tags`);
      console.log('Fetched Ollama models (fallback /api/tags):', results);
      return results;
    } catch (err) {
      console.error('Error fetching Ollama models:', err);
      return [];
    }
  }

  /**
   * Get assistant name.
   */
  getAssistantName(): string {
    return this.assistantName;
  }

  /**
   * Update assistant name and trigger pattern.
   */
  async setAssistantName(name: string): Promise<void> {
    this.assistantName = name;
    this.triggerPattern = buildTriggerPattern(name);
    await setConfig(CONFIG_KEYS.ASSISTANT_NAME, name);
  }

  /**
   * Configure Telegram.
   */
  async configureTelegram(token: string, chatIds: string[]): Promise<void> {
    await setConfig(CONFIG_KEYS.TELEGRAM_BOT_TOKEN, token);
    await setConfig(CONFIG_KEYS.TELEGRAM_CHAT_IDS, JSON.stringify(chatIds));
    this.telegram.configure(token, chatIds);
    this.telegram.onMessage((msg) => this.enqueue(msg));
    this.telegram.start();
  }

  /**
   * Configure WhatsApp.
   */
  async configureWhatsApp(config: {
    phoneNumberId: string;
    accessToken: string;
    webhookVerifyToken?: string;
    allowedNumbers?: string[];
  }): Promise<void> {
    await setConfig(CONFIG_KEYS.WHATSAPP_PHONE_NUMBER_ID, config.phoneNumberId);
    await setConfig(CONFIG_KEYS.WHATSAPP_ACCESS_TOKEN, config.accessToken);
    if (config.webhookVerifyToken) {
      await setConfig(CONFIG_KEYS.WHATSAPP_WEBHOOK_TOKEN, config.webhookVerifyToken);
    }
    if (config.allowedNumbers) {
      await setConfig(CONFIG_KEYS.WHATSAPP_ALLOWED_NUMBERS, JSON.stringify(config.allowedNumbers));
    }
    this.whatsapp.configure(config);
    this.whatsapp.onMessage((msg) => this.enqueue(msg));
    this.whatsapp.start();
  }

  /**
   * Handle incoming WhatsApp webhook.
   */
  handleWhatsAppWebhook(payload: unknown): void {
    this.whatsapp.handleWebhook(payload as any);
  }

  /**
   * Test WhatsApp connection.
   */
  async testWhatsAppConnection(): Promise<{ success: boolean; error?: string }> {
    return this.whatsapp.testConnection();
  }



  /**
   * Submit a message from the browser chat UI.
   */
  submitMessage(text: string, groupId?: string): void {
    this.browserChat.submit(text, groupId);
  }

  /**
   * Start a completely new session — clears message history for the group.
   */
  async newSession(groupId: string = DEFAULT_GROUP_ID): Promise<void> {
    // Clear messages from DB
    await clearGroupMessages(groupId);
    this.events.emit('session-reset', { groupId });
  }

  /**
   * Compact (summarize) the current context to reduce token usage.
   * Asks Claude to produce a summary, then replaces the history with it.
   */
  async compactContext(groupId: string = DEFAULT_GROUP_ID): Promise<void> {
    if (!this.isConfigured()) {
      const errorMsg = 'AI Provider not configured. Cannot compact context.';
      await this.deliverResponse(groupId, `⚠️ Error: ${errorMsg}`);
      this.events.emit('error', { groupId, error: errorMsg });
      return;
    }

    if (this.state !== 'idle') {
      const errorMsg = 'Cannot compact while processing. Wait for the current response to finish.';
      await this.deliverResponse(groupId, `⚠️ Error: ${errorMsg}`);
      this.events.emit('error', { groupId, error: errorMsg });
      return;
    }

    this.setState('thinking');
    this.events.emit('typing', { groupId, typing: true });

    // Load group memory
    let memory = '';
    try {
      memory = await readGroupFile(groupId, MEMORY_FILE);
    } catch {
      // No memory file yet
    }

    const messages = await buildConversationMessages(groupId, CONTEXT_WINDOW_SIZE);
    const systemPrompt = buildSystemPrompt(this.assistantName, memory);

    this.agentWorker.postMessage({
      type: 'compact',
      payload: {
        groupId,
        messages,
        systemPrompt,
        apiKey: this.apiKey,
        model: this.model,
        maxTokens: this.maxTokens,
        provider: this.provider,
        ollamaUrl: this.ollamaUrl,
        openWebUIUrl: this.openWebUIUrl,
        openWebUIKey: this.openWebUIKey,
      },
    });
  }

  /**
   * Shut down everything.
   */
  shutdown(): void {
    this.isDestroyed = true;
    this.scheduler?.stop();
    this.telegram?.stop();
    this.agentWorker?.terminate();
  }

  /**
   * Alias for shutdown - stops all channels (called on app unmount).
   */
  stopAll(): void {
    this.shutdown();
  }

  // -----------------------------------------------------------------------
  // Private
  // -----------------------------------------------------------------------

  private setState(state: OrchestratorState): void {
    this.state = state;
    this.events.emit('state-change', state);
  }

  private async enqueue(msg: InboundMessage): Promise<void> {
    // Save to DB
    const stored: StoredMessage = {
      ...msg,
      isFromMe: false,
      isTrigger: false,
    };

    // Check trigger
    const isBrowserMain = msg.groupId === DEFAULT_GROUP_ID;
    const isTelegram = msg.channel === 'telegram';
    const hasTrigger = this.triggerPattern.test(msg.content.trim());

    // Browser main group always triggers; other groups need the trigger pattern
    if (isBrowserMain || isTelegram || hasTrigger) {
      stored.isTrigger = true;
      this.messageQueue.push(msg);
    }

    await saveMessage(stored);
    this.events.emit('message', stored);

    // Process queue
    this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.processing) return;
    if (this.messageQueue.length === 0) return;
    if (!this.isConfigured()) {
      // Can't process without config
      const msg = this.messageQueue.shift()!;
      const errorMsg = 'AI Provider not fully configured. Go to Settings to add the required API key or URL.';
      await this.deliverResponse(msg.groupId, `⚠️ Error: ${errorMsg}`);
      this.events.emit('error', { groupId: msg.groupId, error: errorMsg });
      return;
    }

    this.processing = true;
    const msg = this.messageQueue.shift()!;

    try {
      await this.invokeAgent(msg.groupId, msg.content);
    } catch (err) {
      console.error('Failed to invoke agent:', err);
    } finally {
      this.processing = false;
      // Process next in queue
      if (this.messageQueue.length > 0) {
        this.processQueue();
      }
    }
  }

  private async invokeAgent(groupId: string, triggerContent: string): Promise<void> {
    this.setState('thinking');
    this.router.setTyping(groupId, true);
    this.events.emit('typing', { groupId, typing: true });

    // If this is a scheduled task, save the prompt as a user message so
    // it appears in conversation context and in the chat UI.
    if (triggerContent.startsWith('[SCHEDULED TASK]')) {
      this.pendingScheduledTasks.add(groupId);
      const stored: StoredMessage = {
        id: ulid(),
        groupId,
        sender: 'Scheduler',
        content: triggerContent,
        timestamp: Date.now(),
        channel: groupId.startsWith('tg:') ? 'telegram' : 'browser',
        isFromMe: false,
        isTrigger: true,
      };
      await saveMessage(stored);
      this.events.emit('message', stored);
    }

    // Load group memory
    let memory = '';
    try {
      memory = await readGroupFile(groupId, MEMORY_FILE);
    } catch {
      // No memory file yet — that's fine
    }

    // Build conversation context
    const messages = await buildConversationMessages(groupId, CONTEXT_WINDOW_SIZE);

    const systemPrompt = buildSystemPrompt(this.assistantName, memory);

    // Send to agent worker
    this.agentWorker.postMessage({
      type: 'invoke',
      payload: {
        groupId,
        messages,
        systemPrompt,
        apiKey: this.apiKey,
        model: this.model,
        maxTokens: this.maxTokens,
        provider: this.provider,
        ollamaUrl: this.ollamaUrl,
        openWebUIUrl: this.openWebUIUrl,
        openWebUIKey: this.openWebUIKey,
      },
    });
  }

  private async handleWorkerMessage(msg: WorkerOutbound): Promise<void> {
    switch (msg.type) {
      case 'response': {
        const { groupId, text } = msg.payload;
        await this.deliverResponse(groupId, text);
        break;
      }

      case 'task-created': {
        const { task } = msg.payload;
        try {
          await saveTask(task);
        } catch (err) {
          console.error('Failed to save task from agent:', err);
        }
        break;
      }

      case 'error': {
        const { groupId, error } = msg.payload;
        await this.deliverResponse(groupId, `⚠️ Error: ${error}`);
        break;
      }

      case 'typing': {
        const { groupId } = msg.payload;
        this.router.setTyping(groupId, true);
        this.events.emit('typing', { groupId, typing: true });
        break;
      }

      case 'tool-activity': {
        this.events.emit('tool-activity', msg.payload);
        break;
      }

      case 'thinking-log': {
        this.events.emit('thinking-log', msg.payload);
        break;
      }

      case 'compact-done': {
        await this.handleCompactDone(msg.payload.groupId, msg.payload.summary);
        break;
      }

      case 'token-usage': {
        this.events.emit('token-usage', msg.payload);
        break;
      }
    }
  }

  private async handleCompactDone(groupId: string, summary: string): Promise<void> {
    // Clear old messages
    await clearGroupMessages(groupId);

    // Save the summary as a system-style message from the assistant
    const stored: StoredMessage = {
      id: ulid(),
      groupId,
      sender: this.assistantName,
      content: `📝 **Context Compacted**\n\n${summary}`,
      timestamp: Date.now(),
      channel: groupId.startsWith('tg:') ? 'telegram' : 'browser',
      isFromMe: true,
      isTrigger: false,
    };
    await saveMessage(stored);

    this.events.emit('context-compacted', { groupId, summary });
    this.events.emit('typing', { groupId, typing: false });
    this.setState('idle');
  }

  private async deliverResponse(groupId: string, text: string): Promise<void> {
    // Save to DB
    const stored: StoredMessage = {
      id: ulid(),
      groupId,
      sender: this.assistantName,
      content: text,
      timestamp: Date.now(),
      channel: groupId.startsWith('tg:') ? 'telegram' : 'browser',
      isFromMe: true,
      isTrigger: false,
    };
    await saveMessage(stored);

    try {
      // Route to channel
      await this.router.send(groupId, text);

      // Play notification chime for scheduled task responses
      if (this.pendingScheduledTasks.has(groupId)) {
        this.pendingScheduledTasks.delete(groupId);
        playNotificationChime();
      }
    } catch (err) {
      console.error('Failed to send response to channel:', err);
    }

    // Emit for UI
    this.events.emit('message', stored);
    this.events.emit('typing', { groupId, typing: false });

    this.setState('idle');
    this.router.setTyping(groupId, false);
  }
}

// ---------------------------------------------------------------------------
// System prompt builder
// ---------------------------------------------------------------------------

function buildSystemPrompt(assistantName: string, memory: string): string {
  const parts = [
    `You are ${assistantName}, a personal AI assistant running in the user's browser.`,
    '',
    'You have access to the following tools:',
    '- **bash**: Execute commands in a sandboxed Linux VM (Alpine). Use for scripts, text processing, package installation.',
    '- **javascript**: Execute JavaScript code. Lighter than bash — no VM boot needed. Use for calculations, data transforms.',
    '- **read_file** / **write_file** / **list_files**: Manage files in the group workspace (persisted in browser storage).',
    '- **fetch_url**: Make HTTP requests (subject to CORS).',
    '- **read_memory**: Check current memory content before updating.',
    '- **update_memory**: Persist important context to memory.md — loaded on every conversation. Use mode="append" to add or mode="replace" to overwrite.',
    '- **create_task**: Schedule recurring tasks with cron expressions.',
    '',
    'Guidelines:',
    '- Be concise and direct.',
    '- Use tools proactively when they help answer the question.',
    '- Update memory when you learn important preferences or context.',
    '- For scheduled tasks, confirm the schedule with the user.',
    '- Strip <internal> tags from your responses — they are for your internal reasoning only.',
  ];

  if (memory) {
    parts.push('', '## Persistent Memory', '', memory);
  }

  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// Notification chime (Web Audio API — no external files needed)
// ---------------------------------------------------------------------------

function playNotificationChime(): void {
  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime;

    // Two-tone chime: C5 → E5
    const frequencies = [523.25, 659.25];
    for (let i = 0; i < frequencies.length; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.value = frequencies[i];

      gain.gain.setValueAtTime(0.3, now + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + i * 0.15);
      osc.stop(now + i * 0.15 + 0.4);
    }

    // Clean up context after sounds finish
    setTimeout(() => ctx.close(), 1000);
  } catch {
    // AudioContext may not be available — fail silently
  }
}
