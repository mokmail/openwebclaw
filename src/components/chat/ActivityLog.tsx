// ---------------------------------------------------------------------------
// OpenWebClaw — Activity log (floating panel)
// ---------------------------------------------------------------------------

import { useState, useEffect, useRef } from 'react';
import { 
  Link, Wrench, ClipboardList, MessageSquare, Info, 
  ChevronRight, X, Activity, Zap, Clock, Bot
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ThinkingLogEntry } from '../../types.js';
import { useOrchestratorStore } from '../../stores/orchestrator-store.js';

interface Props {
  entries: ThinkingLogEntry[];
}

const kindColors: Record<string, string> = {
  'api-call': 'text-info bg-info/10 border-info/30',
  'tool-call': 'text-warning bg-warning/10 border-warning/30',
  'tool-result': 'text-success bg-success/10 border-success/30',
  'text': 'text-primary bg-primary/10 border-primary/30',
  'info': 'text-base-content/60 bg-base-300/30 border-base-300/50',
};

const kindIcons: Record<string, LucideIcon> = {
  'api-call': Link,
  'tool-call': Wrench,
  'tool-result': ClipboardList,
  'text': MessageSquare,
  'info': Info,
};

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatDuration(start: number, end: number): string {
  const ms = end - start;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function ActivityLog({ entries }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedDetails, setExpandedDetails] = useState<Set<number>>(new Set());
  const [isMinimized, setIsMinimized] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to bottom when new entries
  useEffect(() => {
    if (isOpen && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries.length, isOpen]);

  // Calculate stats
  const apiCalls = entries.filter(e => e.kind === 'api-call').length;
  const toolCalls = entries.filter(e => e.kind === 'tool-call').length;

  function toggleDetail(idx: number) {
    setExpandedDetails((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  if (!isOpen) {
    // Floating toggle button
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed right-4 bottom-24 sm:bottom-28 z-50 btn btn-circle btn-lg shadow-2xl bg-base-200/90 backdrop-blur-sm border border-base-300/50 hover:scale-110 transition-transform"
        title="Activity Log"
      >
        <Activity className="w-6 h-6 text-primary" />
        {entries.length > 0 && (
          <span className="absolute -top-1 -right-1 badge badge-primary badge-sm animate-pulse">
            {entries.length}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="fixed right-4 top-14 bottom-4 w-80 sm:w-96 z-50 flex flex-col">
      {/* Panel header */}
      <div className="bg-base-100 border border-base-300 rounded-2xl shadow-2xl flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-base-300/30">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            <span className="font-semibold">Activity</span>
            <span className="badge badge-primary badge-sm">{entries.length}</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="btn btn-ghost btn-xs btn-square"
              title={isMinimized ? 'Expand' : 'Minimize'}
            >
              <ChevronRight className={`w-4 h-4 transition-transform ${isMinimized ? '' : 'rotate-90'}`} />
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="btn btn-ghost btn-xs btn-square"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Stats bar */}
        {!isMinimized && (
          <div className="flex items-center gap-3 px-3 py-2 bg-base-300/20 text-xs">
            <div className="flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-warning" />
              <span>{apiCalls} API calls</span>
            </div>
            <div className="flex items-center gap-1">
              <Wrench className="w-3.5 h-3.5 text-info" />
              <span>{toolCalls} tools</span>
            </div>
          </div>
        )}

        {/* Content */}
        {!isMinimized && (
          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-2 space-y-1.5"
          >
            {entries.length === 0 ? (
              <div className="text-center py-8 opacity-50">
                <Activity className="w-8 h-8 mx-auto mb-2" />
                <p className="text-sm">No activity yet</p>
                <p className="text-xs">Start a conversation to see logs</p>
              </div>
            ) : (
              entries.map((entry, idx) => {
                const KindIcon = kindIcons[entry.kind] || Info;
                const colorClass = kindColors[entry.kind] || kindColors.info;
                const isExpanded = expandedDetails.has(idx);
                const hasLongDetail = entry.detail && entry.detail.length > 100;
                
                return (
                  <div 
                    key={idx} 
                    className={`rounded-lg border p-2 text-xs ${colorClass}`}
                  >
                    <div className="flex items-start gap-2">
                      <KindIcon className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-medium truncate">{entry.label}</span>
                          <span className="text-[10px] opacity-50 shrink-0">
                            {formatTime(entry.timestamp)}
                          </span>
                        </div>
                        {entry.detail && (
                          <>
                            {hasLongDetail && (
                              <button
                                className="link link-primary text-[10px]"
                                onClick={() => toggleDetail(idx)}
                              >
                                {isExpanded ? 'Show less' : 'Show more'}
                              </button>
                            )}
                            <div 
                              className={`mt-0.5 break-all font-mono text-[10px] opacity-70 ${
                                hasLongDetail && !isExpanded ? 'line-clamp-2' : ''
                              }`}
                            >
                              {entry.detail}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
