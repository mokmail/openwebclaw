// ---------------------------------------------------------------------------
// OpenWebClaw — Activity log (floating panel)
// ---------------------------------------------------------------------------

import { useState, useEffect, useRef } from 'react';
import {
  Link, Wrench, ClipboardList, MessageSquare, Info,
  ChevronDown, ChevronUp, X, TerminalSquare, Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ThinkingLogEntry } from '../../types.js';

interface Props {
  entries: ThinkingLogEntry[];
}

// All entries share the same neutral styling — differentiation
// comes from the icon and the kind label, not colours.
const kindIcons: Record<string, LucideIcon> = {
  'api-call':    Link,
  'tool-call':   Wrench,
  'tool-result': ClipboardList,
  'text':        MessageSquare,
  'info':        Info,
};

const kindLabel: Record<string, string> = {
  'api-call':    'api',
  'tool-call':   'tool',
  'tool-result': 'result',
  'text':        'text',
  'info':        'info',
};

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function ActivityLog({ entries }: Props) {
  const [isOpen, setIsOpen]                   = useState(false);
  const [expandedDetails, setExpandedDetails] = useState<Set<number>>(new Set());
  const scrollRef                             = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new entries
  useEffect(() => {
    if (isOpen && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries.length, isOpen]);

  function toggleDetail(idx: number) {
    setExpandedDetails(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  }

  // ── Collapsed toggle button ──────────────────────────────────────────────
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        title="Activity log"
        className="fixed right-4 bottom-24 sm:bottom-28 z-50 w-11 h-11 rounded-xl bg-base-200 border border-base-300/60 shadow-lg flex items-center justify-center hover:bg-base-300 transition-colors"
      >
        <TerminalSquare className="w-5 h-5 text-base-content/70" />
        {entries.length > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] rounded-full bg-base-content text-base-100 text-[10px] font-semibold flex items-center justify-center px-1 leading-none">
            {entries.length}
          </span>
        )}
      </button>
    );
  }

  // ── Open panel ───────────────────────────────────────────────────────────
  const apiCalls  = entries.filter(e => e.kind === 'api-call').length;
  const toolCalls = entries.filter(e => e.kind === 'tool-call').length;

  return (
    <div className="fixed right-4 top-14 bottom-4 w-80 sm:w-96 z-50 flex flex-col">
      <div className="flex flex-col h-full rounded-2xl bg-base-100 border border-base-300/60 shadow-2xl overflow-hidden">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-base-300/40 shrink-0">
          <div className="flex items-center gap-2.5">
            <TerminalSquare className="w-4 h-4 text-base-content/70" />
            <span className="font-semibold text-sm tracking-tight">Activity log</span>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="w-6 h-6 rounded-lg flex items-center justify-center text-base-content/40 hover:text-base-content hover:bg-base-200 transition-colors"
            title="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* ── Stats strip ── */}
        <div className="flex items-center gap-4 px-4 py-2 border-b border-base-300/30 bg-base-200/40 text-[11px] text-base-content/50 shrink-0">
          <span className="flex items-center gap-1">
            <Zap className="w-3 h-3" />
            {apiCalls} API {apiCalls === 1 ? 'call' : 'calls'}
          </span>
          <span className="flex items-center gap-1">
            <Wrench className="w-3 h-3" />
            {toolCalls} {toolCalls === 1 ? 'tool' : 'tools'}
          </span>
          <span className="ml-auto">{entries.length} total</span>
        </div>

        {/* ── Log entries ── */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-3 py-2.5 space-y-1"
        >
          {entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-base-content/30 select-none">
              <TerminalSquare className="w-8 h-8" />
              <p className="text-xs">No activity yet</p>
            </div>
          ) : (
            entries.map((entry, idx) => {
              const KindIcon     = kindIcons[entry.kind] || Info;
              const label        = kindLabel[entry.kind]  || entry.kind;
              const isExpanded   = expandedDetails.has(idx);
              const hasLong      = (entry.detail?.length ?? 0) > 100;

              return (
                <div
                  key={idx}
                  className="rounded-lg bg-base-200/50 border border-base-300/30 px-2.5 py-2 text-xs"
                >
                  <div className="flex items-start gap-2">
                    {/* icon */}
                    <div className="mt-0.5 shrink-0 w-5 h-5 rounded-md bg-base-300/60 flex items-center justify-center">
                      <KindIcon className="w-3 h-3 text-base-content/60" />
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* top row: kind pill + label + timestamp */}
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="rounded px-1 py-0 bg-base-300/70 text-[9px] font-mono uppercase text-base-content/50 leading-4 shrink-0">
                          {label}
                        </span>
                        <span className="font-medium truncate text-base-content/80">{entry.label}</span>
                        <span className="ml-auto text-[10px] text-base-content/30 shrink-0">
                          {formatTime(entry.timestamp)}
                        </span>
                      </div>

                      {/* detail */}
                      {entry.detail && (
                        <div>
                          <div
                            className={`font-mono text-[10px] text-base-content/50 break-all leading-relaxed ${
                              hasLong && !isExpanded ? 'line-clamp-2' : ''
                            }`}
                          >
                            {entry.detail}
                          </div>
                          {hasLong && (
                            <button
                              className="mt-0.5 flex items-center gap-0.5 text-[10px] text-base-content/40 hover:text-base-content/70 transition-colors"
                              onClick={() => toggleDetail(idx)}
                            >
                              {isExpanded
                                ? <><ChevronUp className="w-3 h-3" /> less</>
                                : <><ChevronDown className="w-3 h-3" /> more</>}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
