// ---------------------------------------------------------------------------
// OpenWebClaw — Chat input (OpenWebUI Design)
// ---------------------------------------------------------------------------

import { useState, useRef, type KeyboardEvent, useEffect } from 'react';
import { ArrowUp, Square } from 'lucide-react';

interface Props {
  onSend: (text: string) => void;
  disabled: boolean;
}

export function ChatInput({ onSend, disabled }: Props) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [text]);

  function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const hasText = text.trim().length > 0;

  return (
    <div className="w-full max-w-3xl mx-auto px-4 pb-6 pt-2">
      <div className="relative flex items-end bg-base-200 rounded-3xl border border-base-300/50 shadow-sm focus-within:ring-1 focus-within:ring-base-content/20 transition-all">
        <textarea
          ref={textareaRef}
          className="w-full bg-transparent text-base-content placeholder:text-base-content/50 resize-none outline-none py-3.5 pl-5 pr-14 min-h-[52px] max-h-[200px] overflow-y-auto"
          placeholder={disabled ? "Assistant is thinking..." : "Send a message..."}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={1}
        />

        {/* Send / Stop button */}
        <div className="absolute right-2 bottom-2">
          {disabled ? (
            <button
              className="w-9 h-9 flex items-center justify-center rounded-full bg-base-content text-base-100 hover:opacity-80 transition-opacity"
              disabled
              aria-label="Thinking"
            >
              <Square className="w-4 h-4 fill-current" />
            </button>
          ) : (
            <button
              className={`w-9 h-9 flex items-center justify-center rounded-full transition-all ${
                hasText
                  ? 'bg-base-content text-base-100 hover:opacity-80'
                  : 'bg-base-300 text-base-content/30 cursor-not-allowed'
              }`}
              onClick={handleSend}
              disabled={!hasText}
              aria-label="Send message"
            >
              <ArrowUp className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
      <div className="text-center mt-2 text-xs text-base-content/40">
        AI can make mistakes. Check important info.
      </div>
    </div>
  );
}
