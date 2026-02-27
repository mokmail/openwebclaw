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
// the orchestrator has been initialized. The original approach mutated
// the imported binding, which violates ES module semantics and breaks
// esbuild. Instead we expose a setter in the store module.
import { getOrchestrator, setGetOrchestrator } from './stores/orchestrator-store.js';
import { DEFAULT_MODEL, DEFAULT_PROVIDER, DEFAULT_OLLAMA_URL, DEFAULT_OPENWEBUI_URL } from './config.js';

{
  const orig = getOrchestrator;
  setGetOrchestrator(() => {
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
        getOpenWebUIUrl: () => DEFAULT_OPENWEBUI_URL,
        fetchOllamaModels: async () => [],
      };
      return stub as ReturnType<typeof orig>;
    }
  });
}

const root = document.getElementById('app');
if (!root) throw new Error('Missing #app element');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
