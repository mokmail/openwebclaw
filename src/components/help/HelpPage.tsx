// ---------------------------------------------------------------------------
// OpenWebClaw — Help & Documentation page
// ---------------------------------------------------------------------------

import { useState } from 'react';
import {
  ChevronDown,
  MessageSquare,
  Wrench,
  Layers,
  ShieldCheck,
  CalendarClock,
  FolderOpen,
  Send,
  Zap,
  Terminal,
  Globe,
  BookOpen,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Accordion section
// ---------------------------------------------------------------------------
function Section({
  icon: Icon,
  title,
  children,
  defaultOpen = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-base-300 rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-5 py-4 bg-base-200/50 hover:bg-base-200 transition-colors text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <Icon className="w-4 h-4 shrink-0 text-base-content/60" />
        <span className="font-semibold text-sm flex-1">{title}</span>
        <ChevronDown
          className={`w-4 h-4 text-base-content/40 transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>
      {open && (
        <div className="px-5 py-4 text-sm text-base-content/80 space-y-3 bg-base-100">
          {children}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small helper: code badge
// ---------------------------------------------------------------------------
function Code({ children }: { children: string }) {
  return (
    <code className="bg-base-200 border border-base-300 rounded px-1.5 py-0.5 font-mono text-xs">
      {children}
    </code>
  );
}

// ---------------------------------------------------------------------------
// Row inside a feature table
// ---------------------------------------------------------------------------
function Row({ label, desc }: { label: string; desc: string }) {
  return (
    <tr className="border-b border-base-300/50 last:border-0">
      <td className="py-2 pr-4 font-mono text-xs text-base-content/70 whitespace-nowrap align-top">
        {label}
      </td>
      <td className="py-2 text-sm text-base-content/80">{desc}</td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export function HelpPage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-base-200 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-base-content/60" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Help &amp; Documentation</h1>
            <p className="text-sm text-base-content/50">
              Everything you need to know about OpenWebClaw
            </p>
          </div>
        </div>

        {/* What is OpenWebClaw */}
        <Section icon={Zap} title="What is OpenWebClaw?" defaultOpen>
          <p>
            OpenWebClaw is a <strong>browser-native personal AI assistant</strong>. Everything runs
            inside a single browser tab — there is no server to deploy, no database to manage, and no
            cloud account required beyond your AI provider credentials.
          </p>
          <p>
            The app stores all data (messages, files, settings) locally using{' '}
            <strong>IndexedDB</strong> and the <strong>Origin Private File System (OPFS)</strong>.
            Your data never leaves your device unless the AI model API call itself crosses the
            network.
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>Works offline for everything except AI inference</li>
            <li>Installable as a Progressive Web App (PWA)</li>
            <li>Single-user, end-to-end private</li>
          </ul>
        </Section>

        {/* Getting started */}
        <Section icon={MessageSquare} title="Getting Started">
          <ol className="list-decimal list-inside space-y-2">
            <li>
              Open <strong>Settings</strong> and choose your AI provider (Anthropic, Ollama, or
              OpenWebUI).
            </li>
            <li>Paste your API key or base URL for the chosen provider.</li>
            <li>Pick a model from the dropdown (or type one manually).</li>
            <li>
              Head to <strong>Chat</strong> and start talking to the assistant.
            </li>
          </ol>
          <p className="mt-2 text-base-content/60 text-xs">
            Tip: if you haven&apos;t configured a provider yet the app redirects you to Settings
            automatically.
          </p>
        </Section>

        {/* Chat features */}
        <Section icon={MessageSquare} title="Chat Features">
          <table className="w-full text-left">
            <tbody>
              <Row label="Streaming" desc="Responses appear word-by-word as the model generates them." />
              <Row label="Minimize Overhead" desc="Summarizes the current conversation to reduce token usage while preserving context." />
              <Row label="Clean" desc="Clears all messages and starts a fresh session." />
              <Row label="Activity Panel" desc="Shows real-time agent thinking, tool calls, and API events. Click the terminal icon (bottom-right)." />
              <Row label="Markdown" desc="All assistant messages are rendered as rich Markdown including code blocks with syntax highlighting." />
              <Row label="Context Bar" desc="Displays the current session context such as active model and group." />
            </tbody>
          </table>
        </Section>

        {/* Tools */}
        <Section icon={Wrench} title="Built-in Agent Tools">
          <p>
            The assistant is <strong>tool-enabled</strong> — it can take real actions on your behalf,
            not just answer questions.
          </p>
          <table className="w-full text-left mt-2">
            <tbody>
              <Row
                label="bash"
                desc="Runs shell commands inside a sandboxed WebVM (v86 x86 Linux emulator). The VM lives entirely in the browser — no root access to your machine."
              />
              <Row
                label="javascript"
                desc="Evaluates arbitrary JS in a sandboxed iframe context for quick computations, data transformations, or browser API access."
              />
              <Row
                label="read_file"
                desc="Reads a file from the OPFS workspace by path."
              />
              <Row
                label="write_file"
                desc="Writes or overwrites a file in the OPFS workspace."
              />
              <Row
                label="list_files"
                desc="Lists files and directories inside the workspace."
              />
              <Row
                label="search_files"
                desc="Searches file contents with a text or regex pattern."
              />
              <Row
                label="http_request"
                desc="Fetches a URL and returns the response body (subject to CORS)."
              />
            </tbody>
          </table>
          <p className="text-xs text-base-content/50 mt-2">
            The agent decides which tools to invoke automatically based on your request. You can see
            every tool call in the Activity panel.
          </p>
        </Section>

        {/* Workspace / Files */}
        <Section icon={FolderOpen} title="Workspace & Files">
          <p>
            The <strong>Workspace</strong> page gives you a file manager backed by the browser&apos;s
            Origin Private File System (OPFS). Files here are persistent across sessions and
            accessible to the agent via its file tools.
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>Upload files via drag-and-drop or the upload button</li>
            <li>Click any file to preview text, code, or images</li>
            <li>The agent can create, read, edit, and search these files</li>
            <li>All data is stored locally — nothing is uploaded to a server</li>
          </ul>
        </Section>

        {/* Task Scheduler */}
        <Section icon={CalendarClock} title="Task Scheduler">
          <p>
            The <strong>Tasks</strong> page lets you schedule recurring or one-shot prompts that run
            automatically while the tab is open.
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>Create tasks with a name, prompt, and cron-style schedule</li>
            <li>Tasks fire the configured prompt at the scheduled time</li>
            <li>Results appear in the Chat history like normal messages</li>
            <li>Tasks only run while the browser tab is active</li>
          </ul>
          <p className="text-xs text-base-content/50 mt-1">
            Example: schedule a daily morning briefing or a periodic file-system summary.
          </p>
        </Section>

        {/* Channels */}
        <Section icon={Send} title="Messaging Channels">
          <p>
            Beyond the built-in browser chat, OpenWebClaw can receive and respond to messages from
            external services — as long as the tab is open.
          </p>
          <table className="w-full text-left mt-2">
            <tbody>
              <Row
                label="Browser Chat"
                desc="The default channel. Chat directly inside the app in any browser."
              />
              <Row
                label="Telegram"
                desc="Connect a Telegram bot token in Settings. The app polls the Telegram Bot API so no webhook or public server is needed."
              />
              <Row
                label="WhatsApp"
                desc="Requires a WhatsApp Business API gateway (e.g. Twilio). Configure the webhook URL and credentials in Settings."
              />
            </tbody>
          </table>
        </Section>

        {/* AI Providers */}
        <Section icon={Globe} title="AI Providers">
          <table className="w-full text-left">
            <tbody>
              <Row
                label="Anthropic"
                desc="Claude models (claude-3-5-sonnet, claude-opus-4, etc.). Requires an Anthropic API key."
              />
              <Row
                label="Ollama"
                desc="Locally-running models via Ollama. Point the base URL to your Ollama instance (e.g. http://localhost:11434)."
              />
              <Row
                label="OpenWebUI"
                desc="Any OpenAI-compatible endpoint. Useful for self-hosted deployments or proxies."
              />
            </tbody>
          </table>
          <p className="text-xs text-base-content/50 mt-2">
            Switch providers at any time in Settings. Credentials are stored encrypted in IndexedDB.
          </p>
        </Section>

        {/* Security */}
        <Section icon={ShieldCheck} title="Security & Privacy">
          <ul className="list-disc list-inside space-y-1.5">
            <li>
              All sensitive settings (API keys, tokens) are encrypted with AES-GCM using a key
              derived from your passphrase via PBKDF2.
            </li>
            <li>The encryption key never leaves your device.</li>
            <li>
              Data is stored in <Code>IndexedDB</Code> and <Code>OPFS</Code> — both scoped to the
              app&apos;s origin and inaccessible to other sites.
            </li>
            <li>No analytics, no telemetry, no third-party scripts.</li>
            <li>
              Clearing your browser&apos;s site data for this origin permanently deletes all stored
              information.
            </li>
          </ul>
        </Section>

        {/* Advanced */}
        <Section icon={Terminal} title="Tips & Advanced Usage">
          <ul className="list-disc list-inside space-y-2">
            <li>
              <strong>PWA Install:</strong> Use your browser&apos;s &ldquo;Add to Home Screen&rdquo;
              or &ldquo;Install App&rdquo; option to run OpenWebClaw as a standalone app with its own
              window.
            </li>
            <li>
              <strong>Model switching:</strong> Change the active model mid-conversation in Settings
              without losing chat history.
            </li>
            <li>
              <strong>System prompt:</strong> Set a custom system prompt in Settings to give the
              assistant a persistent persona or set of instructions.
            </li>
            <li>
              <strong>Multiple channels:</strong> You can have the Telegram bot and the browser chat
              active simultaneously — they share the same agent and message history.
            </li>
            <li>
              <strong>Activity log:</strong> Click the terminal icon in the bottom-right corner of
              the chat to watch every API call, tool invocation, and result in real time.
            </li>
          </ul>
        </Section>

        {/* Shortcuts */}
        <Section icon={Layers} title="Keyboard Shortcuts">
          <table className="w-full text-left">
            <tbody>
              <Row label="Enter" desc="Send message" />
              <Row label="Shift + Enter" desc="New line in message input" />
              <Row label="Escape" desc="Close modals and dialogs" />
            </tbody>
          </table>
        </Section>

        {/* Footer */}
        <p className="text-center text-xs text-base-content/30 pt-4 pb-8">
          OpenWebClaw — browser-native personal AI, zero infrastructure.
        </p>
      </div>
    </div>
  );
}
