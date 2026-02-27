// ---------------------------------------------------------------------------
// OpenWebClaw — Typing indicator
// ---------------------------------------------------------------------------

import { Bot } from 'lucide-react';

export function TypingIndicator() {
  return (
    <div className="flex w-full py-4 bg-base-100 group">
      <div className="flex w-full max-w-3xl mx-auto px-4 gap-4">
        <div className="flex-shrink-0 mt-1">
          <div className="w-8 h-8 rounded-full flex items-center justify-center bg-base-content text-base-100">
            <Bot className="w-5 h-5" />
          </div>
        </div>
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 bg-base-content/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-base-content/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-base-content/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
