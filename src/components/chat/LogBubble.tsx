import { Wrench, ClipboardList, ChevronDown, ChevronUp, TerminalSquare, Info, Link, Zap } from 'lucide-react';
import { useState } from 'react';
import type { ThinkingLogEntry } from '../../types.js';

interface Props {
    entry: ThinkingLogEntry;
}

export function LogBubble({ entry }: Props) {
    const [isExpanded, setIsExpanded] = useState(false);

    if (entry.kind === 'info' || entry.kind === 'text') return null;

    const isTool = entry.kind === 'tool-call' || entry.kind === 'tool-result';
    const isResult = entry.kind === 'tool-result';
    const isApi = entry.kind === 'api-call';

    const iconMap = {
        'tool-call': <Wrench className="w-4 h-4" />,
        'tool-result': <ClipboardList className="w-4 h-4" />,
        'api-call': <Zap className="w-4 h-4" />,
        'info': <Info className="w-4 h-4" />,
        'text': <TerminalSquare className="w-4 h-4" />,
    };

    return (
        <div className="flex w-full py-1 bg-base-100 group animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex w-full max-w-3xl mx-auto px-4 gap-4">
                {/* Avatar align */}
                <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center opacity-30">
                    {iconMap[entry.kind]}
                </div>

                <div className="flex-1 min-w-0 flex flex-col">
                    <div className={`inline-flex flex-col gap-1 w-full max-w-2xl px-4 py-2 bg-base-200/30 rounded-2xl border border-base-300/40 text-[13px] ${isResult ? 'border-l-4 border-l-primary/40' : ''}`}>
                        <div className="flex items-center gap-2 text-base-content/40 font-medium text-[10px] uppercase tracking-wider">
                            {isApi ? <Zap className="w-3 h-3" /> : <TerminalSquare className="w-3 h-3" />}
                            <span>
                                {isApi ? 'API Call' : isResult ? 'Tool Output' : 'Tool Action'}:
                                <span className="text-base-content/70 ml-1">{entry.label}</span>
                            </span>
                        </div>

                        {entry.detail && (
                            <div className="mt-0.5">
                                <button
                                    onClick={() => setIsExpanded(!isExpanded)}
                                    className="flex items-center gap-1 text-[11px] text-primary/70 hover:text-primary transition-colors"
                                >
                                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                    {isExpanded ? 'Collapse' : `View Details`}
                                </button>

                                {isExpanded && (
                                    <div className="mt-2 rounded-xl overflow-hidden border border-base-300/50 shadow-inner">
                                        <pre className="p-3 bg-base-300/20 max-h-60 overflow-y-auto text-[11px] font-mono whitespace-pre-wrap break-all leading-relaxed text-base-content/80 scrollbar-thin">
                                            {entry.detail}
                                        </pre>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
