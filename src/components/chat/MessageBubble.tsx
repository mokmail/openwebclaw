// ---------------------------------------------------------------------------
// OpenWebClaw — Message bubble (OpenWebUI Design)
// ---------------------------------------------------------------------------

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import { FileText, Bot, User, Copy, Check, Edit2, RefreshCw, ThumbsUp, ThumbsDown } from 'lucide-react';
import type { StoredMessage } from '../../types.js';
import { getOrchestrator } from '../../stores/orchestrator-store.js';
import { useFileViewerStore } from '../../stores/file-viewer-store.js';
import { CodeBlock } from './CodeBlock.js';
import { useState } from 'react';

// Matches strings that look like file paths (with extension)
const FILE_PATH_RE = /^[\w./-]+\.\w{1,10}$/;

// Allow SVG elements and common attributes through sanitization
const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    'svg', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon',
    'ellipse', 'g', 'defs', 'use', 'text', 'tspan',
    'linearGradient', 'radialGradient', 'stop', 'clipPath', 'mask',
    'pattern', 'marker', 'foreignObject',
  ],
  attributes: {
    ...defaultSchema.attributes,
    svg: ['xmlns', 'viewBox', 'width', 'height', 'fill', 'stroke', 'class', 'style', 'role', 'aria-*'],
    path: ['d', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'opacity', 'transform', 'class'],
    circle: ['cx', 'cy', 'r', 'fill', 'stroke', 'stroke-width', 'class'],
    rect: ['x', 'y', 'width', 'height', 'rx', 'ry', 'fill', 'stroke', 'stroke-width', 'class'],
    line: ['x1', 'y1', 'x2', 'y2', 'stroke', 'stroke-width', 'class'],
    polyline: ['points', 'fill', 'stroke', 'stroke-width', 'class'],
    polygon: ['points', 'fill', 'stroke', 'stroke-width', 'class'],
    ellipse: ['cx', 'cy', 'rx', 'ry', 'fill', 'stroke', 'class'],
    g: ['transform', 'fill', 'stroke', 'class', 'opacity'],
    text: ['x', 'y', 'dx', 'dy', 'text-anchor', 'font-size', 'font-family', 'fill', 'class', 'transform'],
    tspan: ['x', 'y', 'dx', 'dy', 'fill', 'class'],
    linearGradient: ['id', 'x1', 'y1', 'x2', 'y2', 'gradientUnits', 'gradientTransform'],
    radialGradient: ['id', 'cx', 'cy', 'r', 'fx', 'fy', 'gradientUnits'],
    stop: ['offset', 'stop-color', 'stop-opacity'],
    clipPath: ['id'],
    mask: ['id'],
    defs: [],
    use: ['href', 'x', 'y', 'width', 'height'],
    marker: ['id', 'markerWidth', 'markerHeight', 'refX', 'refY', 'orient'],
    foreignObject: ['x', 'y', 'width', 'height'],
    img: ['src', 'alt', 'width', 'height', 'title', 'class'],
  },
};

interface Props {
  message: StoredMessage;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function MessageBubble({ message }: Props) {
  const isAssistant = message.isFromMe;
  const senderName = isAssistant ? getSenderName(message) : 'You';
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore copy errors
    }
  };

  return (
    <div className={`flex w-full py-4 ${isAssistant ? 'bg-base-100' : 'bg-base-100'} group`}>
      <div className="flex w-full max-w-3xl mx-auto px-4 gap-4">
        {/* Avatar */}
        <div className="flex-shrink-0 mt-1">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            isAssistant
              ? 'bg-base-content text-base-100'
              : 'bg-base-300 text-base-content'
          }`}>
            {isAssistant ? (
              <Bot className="w-5 h-5" />
            ) : (
              <User className="w-5 h-5" />
            )}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Header */}
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-sm text-base-content">{senderName}</span>
          </div>

          {/* Message Content */}
          <div className="text-base-content prose prose-sm max-w-none prose-p:leading-relaxed prose-pre:p-0 prose-pre:bg-transparent">
            {isAssistant ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema]]}
                components={{
                  code({ className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || '');
                    const codeStr = String(children).replace(/\n$/, '');
                    if (match) {
                      return <CodeBlock language={match[1]} code={codeStr} />;
                    }
                    // Detect inline file paths and make them clickable
                    if (FILE_PATH_RE.test(codeStr)) {
                      return <FileLink path={codeStr} />;
                    }
                    return (
                      <code className="bg-base-200 px-1.5 py-0.5 rounded-md text-sm font-mono text-base-content" {...props}>
                        {children}
                      </code>
                    );
                  },
                  pre({ children }) {
                    return <>{children}</>;
                  },
                  blockquote({ children }) {
                    return (
                      <blockquote className="border-l-4 border-base-300 pl-4 my-2 text-base-content/80 italic">
                        {children}
                      </blockquote>
                    );
                  },
                  table({ children }) {
                    return (
                      <div className="overflow-x-auto my-4 rounded-lg border border-base-300">
                        <table className="table table-sm w-full">{children}</table>
                      </div>
                    );
                  },
                  p({ children }) {
                    return <p className="my-2">{children}</p>;
                  },
                  ul({ children }) {
                    return <ul className="my-2 pl-5 list-disc space-y-1">{children}</ul>;
                  },
                  ol({ children }) {
                    return <ol className="my-2 pl-5 list-decimal space-y-1">{children}</ol>;
                  },
                  li({ children }) {
                    return <li className="pl-1">{children}</li>;
                  },
                  a({ href, children }) {
                    return (
                      <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline underline-offset-2">
                        {children}
                      </a>
                    );
                  },
                  h1({ children }) {
                    return <h1 className="text-2xl font-bold mt-6 mb-4">{children}</h1>;
                  },
                  h2({ children }) {
                    return <h2 className="text-xl font-bold mt-5 mb-3">{children}</h2>;
                  },
                  h3({ children }) {
                    return <h3 className="text-lg font-bold mt-4 mb-2">{children}</h3>;
                  },
                  hr() {
                    return <hr className="my-6 border-base-300" />;
                  },
                  img({ src, alt }) {
                    return (
                      <img
                        src={src}
                        alt={alt || ''}
                        className="max-w-full rounded-lg my-4 border border-base-300"
                        loading="lazy"
                      />
                    );
                  },
                }}
              >
                {message.content}
              </ReactMarkdown>
            ) : (
              <div className="whitespace-pre-wrap">{message.content}</div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
            {isAssistant ? (
              <>
                <button
                  onClick={handleCopy}
                  className="p-1.5 text-base-content/50 hover:text-base-content hover:bg-base-200 rounded-md transition-colors"
                  title="Copy"
                >
                  {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                </button>
                <button className="p-1.5 text-base-content/50 hover:text-base-content hover:bg-base-200 rounded-md transition-colors" title="Regenerate">
                  <RefreshCw className="w-4 h-4" />
                </button>
                <button className="p-1.5 text-base-content/50 hover:text-base-content hover:bg-base-200 rounded-md transition-colors" title="Good response">
                  <ThumbsUp className="w-4 h-4" />
                </button>
                <button className="p-1.5 text-base-content/50 hover:text-base-content hover:bg-base-200 rounded-md transition-colors" title="Bad response">
                  <ThumbsDown className="w-4 h-4" />
                </button>
              </>
            ) : (
              <button className="p-1.5 text-base-content/50 hover:text-base-content hover:bg-base-200 rounded-md transition-colors" title="Edit">
                <Edit2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Clickable inline file link that opens the global file viewer
function FileLink({ path }: { path: string }) {
  const openFile = useFileViewerStore((s) => s.openFile);
  return (
    <button
      type="button"
      onClick={() => openFile(path)}
      className="inline-flex items-center gap-1 bg-base-300/40 px-1.5 py-0.5 rounded text-sm font-mono cursor-pointer hover:bg-primary/20 hover:text-primary transition-all duration-200"
      title={`Open ${path}`}
    >
      <FileText className="w-3.5 h-3.5 shrink-0" />
      {path}
    </button>
  );
}

function getSenderName(msg: StoredMessage): string {
  try {
    return getOrchestrator().getAssistantName();
  } catch {
    return msg.sender || 'Assistant';
  }
}
