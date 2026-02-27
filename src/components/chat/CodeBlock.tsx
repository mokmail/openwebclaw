// ---------------------------------------------------------------------------
// OpenWebClaw — Code block with copy button (OpenWebUI Design)
// ---------------------------------------------------------------------------

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface Props {
  language: string;
  code: string;
}

export function CodeBlock({ language, code }: Props) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="my-4 rounded-xl overflow-hidden border border-base-300/50 bg-[#1e1e2e] dark:bg-[#161622]">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-white/5">
        <span className="text-xs text-white/50 font-mono uppercase tracking-wider">{language}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white/80 transition-colors"
        >
          {copied ? (
            <><Check className="w-3.5 h-3.5 text-green-400" /><span className="text-green-400">Copied!</span></>
          ) : (
            <><Copy className="w-3.5 h-3.5" />Copy</>
          )}
        </button>
      </div>
      {/* Code body */}
      <pre className="p-4 overflow-x-auto text-sm text-white/90 font-mono leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}
