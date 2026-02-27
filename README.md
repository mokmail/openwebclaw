# OpenWebClaw

**Browser‑native personal AI assistant — zero infrastructure.**
Everything runs inside a single browser tab; there is no server process, no database to administer, and no backend to deploy.

OpenWebClaw is a fully re‑imagined, front‑end‑native cousin of [NanoClaw](https://github.com/...), built with the same "small‑enough‑to‑understand" philosophy and intended for a single user. The entire system sits in your browser (or a Progressive Web App) and uses the browser itself as the server.

---

## 🚀 Features overview

- **Built‑in chat UI** with message history, context search, and streaming responses
- **Multi‑channel support:**
  - Browser chat (default, PWA‑friendly)
  - Telegram bot (HTTPS‑only; works when tab is open)
  - WhatsApp via Twilio or similar gateway (requires browser tab open)
  - *(future: Discord, Slack, etc.)*
- **Tool‑enabled AI** – the agent can invoke:
  - `bash` shell commands inside a sandboxed WebVM
  - Arbitrary `javascript` evaluation
  - File operations (`read_file`, `write_file`, `list_files`)
  - HTTP requests (`fetch_url`)
  - Persistent memory updates (`update_memory`)
  - Recurring tasks via cron expressions (`create_task`)
- **Per‑group workspaces** using OPFS (browser file system) for isolated data
- **IndexedDB storage** for messages, settings, sessions, tasks, and more
- **Cron‑style task scheduler** with notifications and durable state
- **Memory persistence** stored in `CLAUDE.md` and re‑loaded on each conversation
- **Optional WebVM** (v86 + Alpine Linux) for running shell tools in a Linux environment
- **Encrypts sensitive data** (API keys, tokens) with AES‑256‑GCM
- **Works offline/air‑gapped** after initial load; only external request is AI provider API
- **Lightweight deployment** – build once and host static files anywhere (CDN, Pages)

> 💡 Everything you can ask a hosted AI assistant to do, you can do locally in your browser.

---

## 🛠 Quick start

```bash
cd openwebclaw
npm install
npm run dev          # start Vite dev server on :5173
```

1. Open [http://localhost:5173](http://localhost:5173) in your browser.
2. Enter your **Anthropic/Ollama/OpenWebUI API key** in Settings.
3. Start chatting – the agent responds just like a remote chatbot, but all computation happens locally.
4. (Optional) enable Telegram/other channels in Settings to receive messages from external platforms.

To build and deploy:

```bash
npm run build        # produces dist/ static bundle
npm run preview      # run production build locally
# upload `dist/` to any static host (GitHub Pages, Cloudflare, S3, etc.)
```

---

## 🧩 Architecture at a glance

```
┌──────────────────────────────────────────────────────────┐
│  Browser Tab (PWA)                                       │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌────────────────────────┐  │
│  │ Chat UI  │  │ Settings │  │ Task Manager           │  │
│  └────┬─────┘  └─────┬────┘  └───────┬────────────────┘  │
│       └──────────────┼───────────────┘                   │
│                      ▼                                   │
│              Orchestrator (main thread)                  │
│              ├── Message queue & routing                 │
│              ├── State machine (idle/thinking/responding)│
│              └── Task scheduler (cron)                   │
│                      │                                   │
│          ┌───────────┼───────────┐                       │
│          ▼           ▼           ▼                       │
│     IndexedDB      OPFS    Agent Worker                  │
│     (messages,   (group    (Claude API                   │
│      tasks,       files,    tool-use loop,               │
│      config)     memory)    WebVM sandbox)               │
│                                                          │
│  Channels:                                               │
│  ├── Browser Chat (built-in)                             │
│  ├── Telegram Bot API (optional, pure HTTPS)             │
│  └── WhatsApp via gateway (Twilio, etc.)                 │
└──────────────────────────────────────────────────────────┘
```

### Core components

- **Orchestrator** – central event loop on the main thread. Handles user input, schedules jobs, stores state, and routes messages to channels and the agent worker.
- **Agent Worker** – a Web Worker that communicates with the configured LLM provider. It implements a tool‑usage loop, feeding intermediate results back to the model until a final response emerges. If the `bash` tool is used, it may spin up the optional WebVM.
- **IndexedDB** – durable storage for everything from chats to scheduled tasks and configuration data.
- **OPFS (Origin‑Private File System)** – provides a per‑group file workspace; each chat group gets its own sandboxed file store.
- **Channels** – abstract interfaces. Built‑in browser chat is always available; Telegram (and future channels) plug in via HTTP requests and the router module.

---

## 📁 Tools explained

| Tool | Description & use cases |
|------|------------------------|
| `bash` | Runs shell commands inside a v86‑emulated Alpine Linux VM. Useful for file manipulation, package installs, quick scripts. If WebVM assets are missing, the tool returns an explanatory error. |
| `javascript` | Evaluates arbitrary JS in the worker sandbox. Faster than `bash` and ideal for data transformation, HTTP calls, or invoking `fetch_url` without CORS limitations. |
| `read_file` / `write_file` / `list_files` | Manipulate files stored in OPFS. Persistent across reloads and available to every tool. Enables the agent to maintain documents, logs, or codebases. |
| `fetch_url` | Perform network requests through the browser's `fetch` API. Respects CORS. Used for scraping, web APIs, or downloading assets. |
| `update_memory` | Append text to the group's `CLAUDE.md` memory file. Automatically loaded at the start of every conversation, providing persistent context. |
| `create_task` | Schedule a recurring task using cron syntax. Tasks run in the background (while the tab is open) and can generate messages or invoke tools. |

> 🔧 The agent can chain tools: e.g. `bash` produces a file, then `read_file` returns its contents, which the model can summarize.

---

## 📡 Channels & integration

### Built‑in browser chat

- Web‑based UI with **message streaming**, **undo/redo**, **context search**, and **copyable results**.
- Each conversation is tied to a "group"; settings and files are scoped per group.
- Persisted across sessions via IndexedDB.

### Telegram bot (optional)

1. Create a bot with [@BotFather](https://t.me/BotFather).
2. In OpenWebClaw Settings, paste the bot token and add one or more chat IDs.
3. Send `/chatid` to your bot to obtain the ID easily.
4. Messages sent to registered chats appear in the browser UI and are processed immediately when the tab is open.

> ⚠️ Tab must remain open; Telegram queues messages for up to 24 hours.

### WhatsApp integration (optional)

WhatsApp messages are supported via a gateway such as Twilio, Vonage, or any service that can POST incoming messages to a webhook.

1. Set up a WhatsApp sandbox or business account with your chosen provider.
2. Configure the webhook URL to point to `https://<your-host>/api/whatsapp` (or the equivalent in your static host, with a small serverless function if necessary).
3. In Settings, supply the API credentials and register the phone numbers or conversation IDs you want to accept.
4. Incoming messages are forwarded through the router and show up in the browser UI; replies are sent back through the same gateway.

> ⚠️ The browser tab must remain open for replies to be delivered; messages are buffered by the gateway while it is closed.

### Future channels

The router abstraction makes it straightforward to add new integrations (Discord, Slack, Matrix, etc.) by implementing the same interface used by the Telegram and WhatsApp modules.

---

## ⏰ Task scheduler

- Create repeating tasks with cron expressions (`* * * * *`, `0 9 * * 1`, etc.).
- Tasks run in the background as long as the browser tab is active.
- Use the `create_task` tool or the Settings UI to manage jobs.
- Task state and history are stored in IndexedDB, ensuring they survive reloads.
- Examples: daily stand‑up reminders, periodic web scraping, automatic backups to OPFS.

---

## 🔒 Security

OpenWebClaw aims for **practical security** suitable for a local, single‑user tool.

### What’s protected

- API keys and tokens are encrypted with AES‑256‑GCM using a non‑extractable `CryptoKey` stored in IndexedDB. JavaScript cannot export key material.
- All data (IndexedDB, OPFS) is same‑origin scoped by the browser.
- Agent logic and tools run in a Web Worker, isolating them from the UI thread.

### Known limitations

- If an attacker obtains XSS access to the origin, they can call the encryption APIs or interact with the agent.
- The `javascript` tool uses `eval()`, which has unrestricted `fetch()` access; this bypasses CORS protections and could be misused by a malicious prompt.
- Outgoing HTTP requests are not user‑confirmable; a rogue agent could exfiltrate data.
- Telegram bot tokens are stored in plaintext; anyone with access to IndexedDB can read them.

This project is a **proof of concept**. Security improvements are welcome and encouraged.

---

## 🧪 Development & contribution

```bash
npm run dev        # start development server with hot reload
npm run typecheck  # run TypeScript checker
npm run build      # production build → dist/
npm run preview    # preview production build
```

### Code structure highlights

- `src/orchestrator.ts` – heart of the system; message routing and state machine.
- `src/agent-worker.ts` – implements the tool usage loop and interfaces with LLM providers.
- `src/tools.ts` – definitions for every tool exposed to the model.
- `src/vm.ts` – WebVM loader, manages the optional Alpine Linux instance.
- `src/db.ts` / `src/storage.ts` – wrappers around IndexedDB and OPFS.
- UI components split under `src/components` for chat, settings, file management, etc.

Feel free to open issues or pull requests on the repository. Topics of particular interest:
- Additional integrations (Discord, WhatsApp, etc.)
- Security hardening (token encryption, prompt sandboxing)
- Offline/packaged deployments (Electron, Tauri)
- Language provider adapters (support other LLM vendors)

---

## 📦 Deployment

1. `npm run build` to produce a static `dist/` folder.
2. Upload `dist/` to any static file host (GitHub Pages, Netlify, Cloudflare Pages, S3, etc.).
3. Open the URL in a browser and follow the setup steps above.

> The entire app is client‑side; there’s no server component to run or monitor.

---

## 🔁 Comparison with NanoClaw

| Feature | NanoClaw | OpenWebClaw |
|---------|----------|-------------|
| Runtime | Node.js process | Browser tab (PWA)
| Storage | SQLite | IndexedDB + OPFS
| Agent sandbox | Docker/Apple Container | Web Worker + optional WebVM
| Channels | WhatsApp (primary), Telegram, Discord | Browser chat + Telegram (others planned)
| Dependencies | ~50 npm packages | 0 runtime deps; build‑time only
| Deployment | Self‑hosted server | Static files on any CDN

---

Thank you for trying OpenWebClaw! 🎉

This project is maintained with care and welcomes contributions – whether you fix a bug, add a new feature, or help document the system. Feel free to reach out via issue or PR.
# openwebclaw
