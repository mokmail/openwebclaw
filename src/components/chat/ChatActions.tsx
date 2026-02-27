// ---------------------------------------------------------------------------
// OpenWebClaw — Chat actions (Minimize Overhead + Clean)
// ---------------------------------------------------------------------------

import { useState } from 'react';
import { Minimize2, Eraser } from 'lucide-react';
import { useOrchestratorStore } from '../../stores/orchestrator-store.js';

interface Props {
  disabled: boolean;
}

export function ChatActions({ disabled }: Props) {
  const compactContext = useOrchestratorStore((s) => s.compactContext);
  const newSession = useOrchestratorStore((s) => s.newSession);
  const [confirmAction, setConfirmAction] = useState<'compact' | 'new-session' | null>(null);

  async function handleConfirm() {
    if (confirmAction === 'compact') {
      await compactContext();
    } else if (confirmAction === 'new-session') {
      await newSession();
    }
    setConfirmAction(null);
  }

  return (
    <>
      <div className="flex gap-1 max-w-3xl mx-auto px-4 py-1">
        <button
          className="btn btn-ghost btn-xs gap-1.5 text-base-content/50 hover:text-base-content"
          disabled={disabled}
          onClick={() => setConfirmAction('compact')}
        >
          <Minimize2 className="w-3.5 h-3.5" /> Minimize Overhead
        </button>
        <button
          className="btn btn-ghost btn-xs gap-1.5 text-base-content/50 hover:text-base-content"
          disabled={disabled}
          onClick={() => setConfirmAction('new-session')}
        >
          <Eraser className="w-3.5 h-3.5" /> Clean
        </button>
      </div>

      {/* Confirmation modal */}
      {confirmAction && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-sm border border-base-300 shadow-xl rounded-2xl">
            <h3 className="font-semibold text-lg">
              {confirmAction === 'compact' ? 'Minimize Overhead' : 'Clean'}
            </h3>
            <p className="py-4 text-base-content/70 text-sm">
              {confirmAction === 'compact'
                ? 'This will summarize the conversation to reduce token usage. The summary replaces the current history.'
                : 'This will clear all messages and start a fresh conversation. This cannot be undone.'}
            </p>
            <div className="modal-action">
              <button
                className="btn btn-ghost"
                onClick={() => setConfirmAction(null)}
              >
                Cancel
              </button>
              <button
                className={`btn ${
                  confirmAction === 'new-session' ? 'btn-error' : 'btn-outline'
                }`}
                onClick={handleConfirm}
              >
                {confirmAction === 'compact' ? 'Minimize' : 'Clear & Start New'}
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button onClick={() => setConfirmAction(null)}>close</button>
          </form>
        </dialog>
      )}
    </>
  );
}
