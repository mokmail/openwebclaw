// ---------------------------------------------------------------------------
// OpenWebClaw — Chat page (OpenWebUI Design)
// ---------------------------------------------------------------------------

import { useEffect, useRef } from 'react';
import { X, MessageSquare, Globe, MapPin, GitBranch, Cpu, Wrench, RefreshCw, Send } from 'lucide-react';
import { useOrchestratorStore } from '../../stores/orchestrator-store.js';
import { MessageList } from './MessageList.js';
import { ChatInput } from './ChatInput.js';
import { TypingIndicator } from './TypingIndicator.js';
import { ToolActivity } from './ToolActivity.js';
import { ActivityLog } from './ActivityLog.js';
import { ContextBar } from './ContextBar.js';
import { ChatActions } from './ChatActions.js';
import { LogBubble } from './LogBubble.js';

const LineGraphIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M3 3v18h18" />
    <path d="m7 15 4-4 3 3 5-7" />
  </svg>
);

const PROMPT_STARTERS = [
  {
    icon: Globe,
    title: 'Latest news',
    prompt: 'Get me the top trending posts from HackerNews.',
  },
  {
    icon: LineGraphIcon,
    title: 'Generate a report',
    prompt: 'Show me a graph with the Ethereum price over the last 6 months.',
  },
  {
    icon: MapPin,
    title: 'Vienna Navigator',
    prompt: 'Generate an interactive map viewer with the top locations to visit in Vienna / Austria. use tailwind styling , make the app design flatt and fancy',
  },
];

const PIPELINE_STEPS = [
  {
    icon: MessageSquare,
    step: 1,
    title: 'Send a message',
    desc: 'Type in the browser chat or send a message via your Telegram bot.',
  },
  {
    icon: GitBranch,
    step: 2,
    title: 'Orchestrator routes it',
    desc: 'Checks trigger patterns, saves to IndexedDB, and queues for processing.',
  },
  {
    icon: Cpu,
    step: 3,
    title: 'Agent Worker takes over',
    desc: 'A Web Worker sends your message plus conversation history to the Claude API.',
  },
  {
    icon: Wrench,
    step: 4,
    title: 'Claude uses tools',
    desc: 'Claude may invoke tools — bash commands, file I/O, JavaScript, HTTP fetches.',
  },
  {
    icon: RefreshCw,
    step: 5,
    title: 'Tool loop resolves',
    desc: 'Tool results are fed back to Claude in a loop until a final response is produced.',
  },
  {
    icon: Send,
    step: 6,
    title: 'Response delivered',
    desc: 'The response is routed back to the originating channel — browser chat or Telegram.',
  },
];

export function ChatPage() {
  const messages = useOrchestratorStore((s) => s.messages);
  const isTyping = useOrchestratorStore((s) => s.isTyping);
  const toolActivity = useOrchestratorStore((s) => s.toolActivity);
  const activityLog = useOrchestratorStore((s) => s.activityLog);
  const orchState = useOrchestratorStore((s) => s.state);
  const tokenUsage = useOrchestratorStore((s) => s.tokenUsage);
  const error = useOrchestratorStore((s) => s.error);
  const sendMessage = useOrchestratorStore((s) => s.sendMessage);
  const loadHistory = useOrchestratorStore((s) => s.loadHistory);

  const bottomRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Load history on mount
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  return (
    <div className="flex flex-col h-full relative bg-base-100">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1 scroll-smooth">
        {messages.length === 0 && !isTyping && (
          <div className="flex flex-col items-center justify-center min-h-full max-w-3xl mx-auto px-4">
            {/* Logo */}
            <div className="w-16 h-16 rounded-full bg-base-content text-base-100 flex items-center justify-center mb-6 shadow-sm">
              <MessageSquare className="w-8 h-8" />
            </div>

            {/* Title */}
            <h2 className="text-3xl font-semibold mb-8 text-base-content">
              How can I help you today?
            </h2>

            {/* Prompt Starters Grid */}
            <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-3 w-full">
              {PROMPT_STARTERS.map(({ icon: Icon, title, prompt }, idx) => (
                <button
                  key={title}
                  className="flex flex-col items-start p-4 rounded-2xl border border-base-300/50 bg-base-200/50 hover:bg-base-200 transition-colors text-left group"
                  onClick={() => sendMessage(prompt)}
                >
                  <div className="flex items-center gap-2 mb-2 text-base-content/80 group-hover:text-base-content transition-colors">
                    <Icon className="w-5 h-5" />
                    <span className="font-medium text-sm">{title}</span>
                  </div>
                  <div className="text-xs text-base-content/50 line-clamp-2">{prompt}</div>
                </button>
              ))}
            </div>

            {/* Pipeline explainer */}
            <div className="w-full mt-12 mb-4">
              <div className="text-center mb-6">
                <p className="text-xs font-semibold uppercase tracking-widest text-base-content/30 mb-1">Under the hood</p>
                <h3 className="text-lg font-semibold text-base-content/70">From message to magic</h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {PIPELINE_STEPS.map(({ icon: Icon, step, title, desc }) => (
                  <div
                    key={step}
                    className="relative flex flex-col gap-2 p-4 rounded-2xl border border-base-300/40 bg-base-200/30 hover:bg-base-200/60 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-base-300/60 flex items-center justify-center shrink-0">
                        <Icon className="w-3.5 h-3.5 text-base-content/60" />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-base-content/30">Step {step}</span>
                    </div>
                    <p className="text-sm font-semibold text-base-content/80 leading-snug">{title}</p>
                    <p className="text-xs text-base-content/45 leading-relaxed">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="max-w-3xl mx-auto w-full">
          <MessageList messages={messages} />

          {activityLog
            .filter((e) => e.kind === 'tool-call' || e.kind === 'tool-result' || e.kind === 'api-call')
            .map((entry, idx) => (
              <LogBubble key={`${idx}-${entry.timestamp}`} entry={entry} />
            ))}

          {isTyping && <TypingIndicator />}
          {toolActivity && (
            <ToolActivity tool={toolActivity.tool} status={toolActivity.status} />
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Bottom bar */}
      <div className="bg-base-100 relative z-20">
        {/* Context / token usage bar */}
        {tokenUsage && <ContextBar usage={tokenUsage} />}

        {/* Compact / New Session actions */}
        <ChatActions disabled={orchState !== 'idle'} />

        {/* Error display */}
        {error && (
          <div className="max-w-3xl mx-auto px-4 mb-2">
            <div className="alert alert-error shadow-sm rounded-xl py-2 text-sm flex items-center justify-between">
              <span>{error}</span>
              <button
                className="btn btn-ghost btn-xs btn-circle"
                onClick={() => useOrchestratorStore.getState().clearError()}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Input */}
        <ChatInput
          onSend={sendMessage}
          disabled={orchState !== 'idle'}
        />
      </div>

      {/* Floating Activity Panel */}
      <ActivityLog entries={activityLog} />
    </div>
  );
}
