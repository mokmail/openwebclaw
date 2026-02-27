// ---------------------------------------------------------------------------
// OpenWebClaw — Orchestrator Store (Zustand)
// ---------------------------------------------------------------------------

import { create } from 'zustand';
import type {
  StoredMessage,
  OrchestratorState,
  TokenUsage,
  ThinkingLogEntry,
} from '../types.js';
import type { Orchestrator } from '../orchestrator.js';
import { DEFAULT_GROUP_ID, DEFAULT_MODEL, DEFAULT_PROVIDER, DEFAULT_OLLAMA_URL } from '../config.js';
import { getRecentMessages } from '../db.js';

interface OrchestratorStoreState {
  // --- reactive state ---
  messages: StoredMessage[];
  isTyping: boolean;
  toolActivity: { tool: string; status: string } | null;
  activityLog: ThinkingLogEntry[];
  state: OrchestratorState;
  tokenUsage: TokenUsage | null;
  error: string | null;
  activeGroupId: string;
  ready: boolean;

  // --- actions ---
  sendMessage: (text: string) => void;
  newSession: () => Promise<void>;
  compactContext: () => Promise<void>;
  clearError: () => void;
  loadHistory: () => Promise<void>;
}

let orchestratorInstance: Orchestrator | null = null;

// `getOrchestrator` is exported as a `let` so that it can be
// replaced at runtime via `setGetOrchestrator`. Consumers should
// never mutate the import directly (that's illegal under ES modules).
export let getOrchestrator: () => Orchestrator = () => {
  if (!orchestratorInstance) {
    // return a minimal stub that satisfies callers but does nothing.
    // This prevents hard errors when components request the orchestrator
    // before initialization (e.g. during auth/setup). Methods are no-ops
    // but typed as any since we only call a few of them early.
    const stub: Partial<Orchestrator> = {
      submitMessage: () => {},
      newSession: async () => {},
      compactContext: async () => {},
      getAssistantName: () => '',
      isConfigured: () => false,
      getModel: () => DEFAULT_MODEL,
      getProvider: () => DEFAULT_PROVIDER,
      getOllamaUrl: () => DEFAULT_OLLAMA_URL,
      fetchOllamaModels: async () => [],
    };
    return stub as Orchestrator;
  }
  return orchestratorInstance as Orchestrator;
};

// Allows other modules to wrap or replace the getter without mutating
// the import binding directly.
export function setGetOrchestrator(fn: typeof getOrchestrator) {
  getOrchestrator = fn;
}

export const useOrchestratorStore = create<OrchestratorStoreState>((set, get) => ({
  messages: [],
  isTyping: false,
  toolActivity: null,
  activityLog: [],
  state: 'idle',
  tokenUsage: null,
  error: null,
  activeGroupId: DEFAULT_GROUP_ID,
  ready: false,

  sendMessage: (text) => {
    try {
      const orch = getOrchestrator();
      orch.submitMessage(text, get().activeGroupId);
    } catch {
      console.warn('sendMessage called before Orchestrator ready');
    }
  },

  newSession: async () => {
    try {
      const orch = getOrchestrator();
      await orch.newSession(get().activeGroupId);
    } catch {
      console.warn('newSession called before Orchestrator ready');
    }
  },

  compactContext: async () => {
    try {
      const orch = getOrchestrator();
      await orch.compactContext(get().activeGroupId);
    } catch {
      console.warn('compactContext called before Orchestrator ready');
    }
  },

  clearError: () => set({ error: null }),

  loadHistory: async () => {
    try {
      const msgs = await getRecentMessages(get().activeGroupId, 200);
      set({ messages: msgs });
    } catch (err) {
      console.warn('loadHistory error', err);
    }
  },
}));

/**
 * Initialize the store with an Orchestrator instance.
 * Subscribes to all EventBus events and bridges them to Zustand state.
 */
export async function initOrchestratorStore(orch: Orchestrator): Promise<void> {
  orchestratorInstance = orch;
  const store = useOrchestratorStore;

  // Subscribe to events
  orch.events.on('message', (msg) => {
    store.setState((s) => ({ messages: [...s.messages, msg] }));
  });

  orch.events.on('typing', ({ typing }) => {
    store.setState({ isTyping: typing });
  });

  orch.events.on('tool-activity', ({ tool, status }) => {
    store.setState({
      toolActivity: status === 'running' ? { tool, status } : null,
    });
  });

  orch.events.on('thinking-log', (entry) => {
    store.setState((s) => {
      // Reset log when a new invocation starts
      if (entry.kind === 'info' && entry.label === 'Starting') {
        return { activityLog: [entry] };
      }
      return { activityLog: [...s.activityLog, entry] };
    });
  });

  orch.events.on('state-change', (state) => {
    store.setState({ state });
    if (state === 'idle') {
      store.setState({ toolActivity: null });
    }
  });

  orch.events.on('error', ({ error }) => {
    store.setState({ error });
  });

  orch.events.on('session-reset', () => {
    store.setState({
      messages: [],
      activityLog: [],
      tokenUsage: null,
      toolActivity: null,
      isTyping: false,
    });
  });

  orch.events.on('context-compacted', () => {
    // Reload history after compaction
    store.getState().loadHistory();
  });

  orch.events.on('token-usage', (usage) => {
    store.setState({ tokenUsage: usage });
  });

  orch.events.on('ready', () => {
    store.setState({ ready: true });
  });

  // Load initial history
  await store.getState().loadHistory();
}
