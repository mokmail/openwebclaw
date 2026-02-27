// ---------------------------------------------------------------------------
// OpenWebClaw — Context / token usage bar
// ---------------------------------------------------------------------------

import type { TokenUsage } from '../../types.js';

interface Props {
  usage: TokenUsage;
}

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function ContextBar({ usage }: Props) {
  const total = usage.inputTokens + usage.outputTokens;
  const pct = Math.min((total / usage.contextLimit) * 100, 100);

  let colorClass = 'bg-success';
  if (pct >= 80) colorClass = 'bg-error';
  else if (pct >= 60) colorClass = 'bg-warning';

  const cacheInfo =
    usage.cacheReadTokens > 0
      ? ` (${formatTokens(usage.cacheReadTokens)} cached)`
      : '';

  return (
    <div className="max-w-3xl mx-auto px-4 py-1 flex items-center gap-3">
      <div className="flex-1 h-1 bg-base-300 rounded-full overflow-hidden">
        <div 
          className={`h-full ${colorClass} transition-all duration-500`} 
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] text-base-content/40 whitespace-nowrap hidden sm:inline font-mono">
        {formatTokens(total)} / {formatTokens(usage.contextLimit)} tokens{cacheInfo}
      </span>
    </div>
  );
}
