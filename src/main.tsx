// ---------------------------------------------------------------------------
// OpenWebClaw — React entry point
// ---------------------------------------------------------------------------

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import './app.css';

// Unregister any existing service worker to avoid stale caches (both dev & prod).
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister();
    }
  });
}

// Monkey-patch getOrchestrator to avoid crashes when called before
// the orchestrator has been initialized. Even if an old bundle with a
// throwing implementation is cached, this wrapper will catch the error
// and supply a harmless stub.
import * as orchStore from './stores/orchestrator-store.js';
import { DEFAULT_MODEL, DEFAULT_PROVIDER, DEFAULT_OLLAMA_URL } from './config.js';

{
  const orig = orchStore.getOrchestrator;
  (orchStore as any).getOrchestrator = () => {
    try {
      return orig();
    } catch (err) {
      console.warn('getOrchestrator called before init, using stub', err);
      const stub: Partial<ReturnType<typeof orig>> = {
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
      return stub as ReturnType<typeof orig>;
    }
  };
}

const root = document.getElementById('app');
if (!root) throw new Error('Missing #app element');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
