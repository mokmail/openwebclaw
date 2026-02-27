// ---------------------------------------------------------------------------
// OpenWebClaw — App shell
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { Orchestrator } from './orchestrator.js';
import { initOrchestratorStore, useOrchestratorStore } from './stores/orchestrator-store.js';
import { useAuthStore } from './stores/auth-store.js';
import { Layout } from './components/layout/Layout.js';
import { ChatPage } from './components/chat/ChatPage.js';
import { FilesPage } from './components/files/FilesPage.js';
import { TasksPage } from './components/tasks/TasksPage.js';
import { SettingsPage } from './components/settings/SettingsPage.js';
import { LoginPage } from './components/auth/LoginPage.js';

export function App() {
  const orchRef = useRef<Orchestrator | null>(null);
  const [orchLoading, setOrchLoading] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const ready = useOrchestratorStore((s) => s.ready);
  const authPhase = useAuthStore((s) => s.phase);
  const initAuth = useAuthStore((s) => s.init);

  // Step 1: check auth on mount (only once)
  useEffect(() => {
    initAuth().catch(console.error);
  }, []);
  // Step 2: once authenticated, boot the orchestrator
  useEffect(() => {
    if (authPhase !== 'authenticated') return;
    if (orchRef.current) return; // already booted

    let cancelled = false;
    setOrchLoading(true);
    setInitError(null);

    (async () => {
      try {
        const orch = new Orchestrator();
        orchRef.current = orch;
        // hook store before initialization so we catch the 'ready' event inside init()
        await initOrchestratorStore(orch);
        await orch.init();
        if (cancelled) { orch.stopAll(); return; }
        orch.start();
      } catch (err) {
        if (!cancelled) {
          setInitError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) setOrchLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authPhase]);

  // Auth still resolving
  if (authPhase === 'loading') {
    return (
      <div className="flex items-center justify-center h-screen">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  // Not yet authenticated — show login / setup
  if (authPhase === 'setup' || authPhase === 'login') {
    return <LoginPage />;
  }

  // Authenticated but orchestrator still starting
  if (orchLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  if (initError) {
    return (
      <div className="flex items-center justify-center h-screen p-6 text-center">
        <div>
          <h1 className="text-2xl font-bold text-error mb-3">Failed to start</h1>
          <p className="text-base-content/70">{initError}</p>
          <p className="text-base-content/40 text-sm mt-2">
            Check the browser console for details.
          </p>
        </div>
      </div>
    );
  }

  const isConfigured = orchRef.current?.isConfigured() ?? false;

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route
            index
            element={<Navigate to={isConfigured ? '/chat' : '/settings'} replace />}
          />
          <Route path="chat" element={<ChatPage />} />
          <Route path="files" element={<FilesPage />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/chat" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
