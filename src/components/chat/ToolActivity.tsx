// ---------------------------------------------------------------------------
// OpenWebClaw — Tool activity indicator (OpenWebUI Design)
// ---------------------------------------------------------------------------

import { Wrench, Loader2 } from 'lucide-react';

interface Props {
  tool: string;
  status: string;
}

export function ToolActivity({ tool }: Props) {
  return (
    <div className="flex w-full py-2 bg-base-100 group">
      <div className="flex w-full max-w-3xl mx-auto px-4 gap-4">
        <div className="flex-shrink-0 mt-1 w-8 h-8 flex items-center justify-center" />
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-base-200/50 rounded-lg border border-base-300/50 text-sm text-base-content/70 w-fit">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Using <span className="font-medium text-base-content">{tool}</span>...</span>
          </div>
        </div>
      </div>
    </div>
  );
}
