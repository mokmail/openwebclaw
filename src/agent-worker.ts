// ---------------------------------------------------------------------------
// OpenWebClaw — Agent Worker
// ---------------------------------------------------------------------------
//
// Runs in a dedicated Web Worker. Owns the Claude API tool-use loop.
// Communicates with the main thread via postMessage.
//
// This is the browser equivalent of NanoClaw's container agent runner.
// Instead of Claude Agent SDK in a Linux container, we use raw Anthropic
// API calls with a tool-use loop.

import type { WorkerInbound, WorkerOutbound, InvokePayload, CompactPayload, ConversationMessage, ThinkingLogEntry, TokenUsage } from './types.js';
import { TOOL_DEFINITIONS } from './tools.js';
import { ANTHROPIC_API_URL, ANTHROPIC_API_VERSION, FETCH_MAX_RESPONSE, MEMORY_FILE } from './config.js';
import { readGroupFile, writeGroupFile, listGroupFiles } from './storage.js';
import { executeShell } from './shell.js';
import { ulid } from './ulid.js';

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

self.onmessage = async (event: MessageEvent<WorkerInbound>) => {
  const { type, payload } = event.data;

  switch (type) {
    case 'invoke':
      await handleInvoke(payload as InvokePayload);
      break;
    case 'compact':
      await handleCompact(payload as CompactPayload);
      break;
    case 'cancel':
      // TODO: AbortController-based cancellation
      break;
  }
};

// Shell emulator needs no boot — it's pure JS over OPFS

// ---------------------------------------------------------------------------
// Agent invocation — tool-use loop
// ---------------------------------------------------------------------------

async function handleInvoke(payload: InvokePayload): Promise<void> {
  const { groupId, messages, systemPrompt, apiKey, model, maxTokens, provider, ollamaUrl, openWebUIUrl, openWebUIKey } = payload;

  post({ type: 'typing', payload: { groupId } });
  log(groupId, 'info', 'Starting', `Provider: ${provider} · Model: ${model} · Max tokens: ${maxTokens}`);

  if (provider === 'openwebui') {
    await handleOpenWebUIInvoke(groupId, messages, systemPrompt, model, maxTokens, openWebUIUrl || '/api/openwebui', openWebUIKey || '');
    return;
  }

  if (provider === 'ollama') {
    await handleOllamaInvoke(groupId, messages, systemPrompt, model, maxTokens, ollamaUrl || '/api/ollama');
    return;
  }

  // Default: Anthropic
  await handleAnthropicInvoke(groupId, messages, systemPrompt, apiKey, model, maxTokens);
}

async function handleAnthropicInvoke(
  groupId: string,
  messages: ConversationMessage[],
  systemPrompt: string,
  apiKey: string,
  model: string,
  maxTokens: number
): Promise<void> {

  try {
    let currentMessages: ConversationMessage[] = [...messages];
    let iterations = 0;
    const maxIterations = 25; // Safety limit to prevent infinite loops

    while (iterations < maxIterations) {
      iterations++;

      const body = {
        model,
        max_tokens: maxTokens,
        cache_control: { type: 'ephemeral' },
        system: systemPrompt,
        messages: currentMessages,
        tools: TOOL_DEFINITIONS,
      };

      log(groupId, 'api-call', `API call #${iterations}`, `${currentMessages.length} messages in context`);

      const res = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': ANTHROPIC_API_VERSION,
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`Anthropic API error ${res.status}: ${errBody}`);
      }

      const result = await res.json();

      // Emit token usage
      if (result.usage) {
        post({
          type: 'token-usage',
          payload: {
            groupId,
            inputTokens: result.usage.input_tokens || 0,
            outputTokens: result.usage.output_tokens || 0,
            cacheReadTokens: result.usage.cache_read_input_tokens || 0,
            cacheCreationTokens: result.usage.cache_creation_input_tokens || 0,
            contextLimit: getContextLimit(model),
          },
        });
      }

      // Log any text blocks in the response (intermediate reasoning)
      for (const block of result.content) {
        if (block.type === 'text' && block.text) {
          const preview = block.text.length > 200 ? block.text.slice(0, 200) + '…' : block.text;
          log(groupId, 'text', 'Response text', preview);
        }
      }

      if (result.stop_reason === 'tool_use') {
        // Execute all tool calls
        const toolResults = [];
        for (const block of result.content) {
          if (block.type === 'tool_use') {
            const inputPreview = JSON.stringify(block.input);
            const inputShort = inputPreview.length > 300 ? inputPreview.slice(0, 300) + '…' : inputPreview;
            log(groupId, 'tool-call', `Tool: ${block.name}`, inputShort);

            post({
              type: 'tool-activity',
              payload: { groupId, tool: block.name, status: 'running' },
            });

            const output = await executeTool(block.name, block.input, groupId);

            const outputStr = typeof output === 'string' ? output : JSON.stringify(output);
            const outputShort = outputStr.length > 500 ? outputStr.slice(0, 500) + '…' : outputStr;
            log(groupId, 'tool-result', `Result: ${block.name}`, outputShort);

            post({
              type: 'tool-activity',
              payload: { groupId, tool: block.name, status: 'done' },
            });

            toolResults.push({
              type: 'tool_result' as const,
              tool_use_id: block.id,
              content: typeof output === 'string'
                ? output.slice(0, 100_000)
                : JSON.stringify(output).slice(0, 100_000),
            });
          }
        }

        // Continue the conversation with tool results
        currentMessages.push({ role: 'assistant', content: result.content });
        currentMessages.push({ role: 'user', content: toolResults as any });

        // Re-signal typing between tool iterations
        post({ type: 'typing', payload: { groupId } });
      } else {
        // Final response — extract text
        const text = result.content
          .filter((b: { type: string }) => b.type === 'text')
          .map((b: { text: string }) => b.text)
          .join('');

        // Strip internal tags (matching NanoClaw pattern)
        const cleaned = text.replace(/<internal>[\s\S]*?<\/internal>/g, '').trim();

        post({ type: 'response', payload: { groupId, text: cleaned || '(no response)' } });

        // look for manual minimax:tool_call markers and auto-execute
        const manual = cleaned.match(/minimax:tool_call\s+(https?:\/\/\S+)/i);
        if (manual) {
          const url = manual[1];
          try {
            const r = await fetch(url);
            const txt = await r.text();
            let extra = txt;
            try {
              const obj = JSON.parse(txt);
              if (obj && Array.isArray(obj.prices)) {
                const vals: number[] = obj.prices
                  .map((p: any) => (Array.isArray(p) ? Number(p[1]) : NaN))
                  .filter((n: number) => !isNaN(n));
                if (vals.length) extra += '\n\nSparkline: ' + makeSparkline(vals);
              }
            } catch {}
            post({ type: 'response', payload: { groupId, text: `[Tool fetch result from ${url}]:\n${extra}` } });
          } catch (err) {
            post({ type: 'response', payload: { groupId, text: `[Tool fetch error]: ${err}` } });
          }
        }

        return;
      }
    }

    // If we hit max iterations
    post({
      type: 'response',
      payload: {
        groupId,
        text: '⚠️ Reached maximum tool-use iterations (25). Stopping to avoid excessive API usage.',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    post({ type: 'error', payload: { groupId, error: message } });
  }
}

// ---------------------------------------------------------------------------
// Context compaction — ask Claude to summarize the conversation
// ---------------------------------------------------------------------------

async function handleCompact(payload: CompactPayload): Promise<void> {
  const { groupId, messages, systemPrompt, apiKey, model, maxTokens, provider, ollamaUrl, openWebUIUrl, openWebUIKey } = payload;

  post({ type: 'typing', payload: { groupId } });
  log(groupId, 'info', 'Compacting context', `Summarizing ${messages.length} messages (${provider})`);

  // For Ollama and OpenWebUI, just return the messages as-is (no compaction for now)
  if (provider === 'ollama' || provider === 'openwebui') {
    post({ type: 'compact-done', payload: { groupId, summary: `Compaction not yet supported for ${provider}` } });
    return;
  }

  // Anthropic compaction
  await compactAnthropic(groupId, messages, systemPrompt, apiKey, model, maxTokens);
}

async function compactAnthropic(
  groupId: string,
  messages: ConversationMessage[],
  systemPrompt: string,
  apiKey: string,
  model: string,
  maxTokens: number
): Promise<void> {
  try {
    const compactSystemPrompt = [
      systemPrompt,
      '',
      '## COMPACTION TASK',
      '',
      'The conversation context is getting large. Produce a concise summary of the conversation so far.',
      'Include key facts, decisions, user preferences, and any important context.',
      'The summary will replace the full conversation history to stay within token limits.',
      'Be thorough but concise — aim for the essential information only.',
    ].join('\n');

    const compactMessages: ConversationMessage[] = [
      ...messages,
      {
        role: 'user' as const,
        content: 'Please provide a concise summary of our entire conversation so far. Include all key facts, decisions, code discussed, and important context. This summary will replace the full history.',
      },
    ];

    const body = {
      model,
      max_tokens: Math.min(maxTokens, 4096),
      cache_control: { type: 'ephemeral' },
      system: compactSystemPrompt,
      messages: compactMessages,
    };

    const res = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_API_VERSION,
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Anthropic API error ${res.status}: ${errBody}`);
    }

    const result = await res.json();
    const summary = result.content
      .filter((b: { type: string }) => b.type === 'text')
      .map((b: { text: string }) => b.text)
      .join('');

    log(groupId, 'info', 'Compaction complete', `Summary: ${summary.length} chars`);
    post({ type: 'compact-done', payload: { groupId, summary } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    post({ type: 'error', payload: { groupId, error: `Compaction failed: ${message}` } });
  }
}

// ---------------------------------------------------------------------------
// Tool execution
// ---------------------------------------------------------------------------

async function executeTool(
  name: string,
  input: Record<string, unknown>,
  groupId: string,
): Promise<string> {
  try {
    switch (name) {
      case 'bash': {
        const result = await executeShell(
          input.command as string,
          groupId,
          {},
          Math.min((input.timeout as number) || 30, 120),
        );
        let output = result.stdout;
        if (result.stderr) output += (output ? '\n' : '') + result.stderr;
        if (result.exitCode !== 0 && !result.stderr) {
          output += `\n[exit code: ${result.exitCode}]`;
        }
        return output || '(no output)';
      }

      case 'read_file':
        return await readGroupFile(groupId, input.path as string);

      case 'write_file':
        await writeGroupFile(groupId, input.path as string, input.content as string);
        return `Written ${(input.content as string).length} bytes to ${input.path}`;

      case 'list_files': {
        const entries = await listGroupFiles(groupId, (input.path as string) || '.');
        return entries.length > 0 ? entries.join('\n') : '(empty directory)';
      }

      case 'fetch_url': {
        const fetchRes = await fetch(input.url as string, {
          method: (input.method as string) || 'GET',
          headers: input.headers as Record<string, string> | undefined,
          body: input.body as string | undefined,
        });
        const rawText = await fetchRes.text();
        const contentType = fetchRes.headers.get('content-type') || '';
        const status = `[HTTP ${fetchRes.status}]\n`;

        // Strip HTML to reduce token usage
        let body = rawText;
        if (contentType.includes('html') || rawText.trimStart().startsWith('<')) {
          body = stripHtml(rawText);
        }

        // If the response looks like JSON with a `prices` array, generate a sparkline
        let extra = '';
        try {
          const obj = JSON.parse(rawText);
          if (obj && Array.isArray(obj.prices)) {
            const values: number[] = obj.prices
              .map((p: any) => (Array.isArray(p) ? Number(p[1]) : NaN))
              .filter((n: number) => !isNaN(n));
            if (values.length > 0) {
              const spark = makeSparkline(values);
              extra = "\n\nSparkline: " + spark;
            }
          }
        } catch {
          // ignore parse errors
        }

        return status + body.slice(0, FETCH_MAX_RESPONSE) + extra;
      }

      case 'read_memory': {
        try {
          const content = await readGroupFile(groupId, MEMORY_FILE);
          return content || '(Memory file is empty)';
        } catch {
          return '(No memory file exists yet. Use update_memory to create one.)';
        }
      }

      case 'update_memory': {
        const mode = (input.mode as string) || 'replace';
        const newContent = input.content as string;

        if (mode === 'append') {
          let existing = '';
          try {
            existing = await readGroupFile(groupId, MEMORY_FILE);
          } catch {
            // No existing file
          }
          const separator = existing ? '\n\n' : '';
          await writeGroupFile(groupId, MEMORY_FILE, existing + separator + newContent);
        } else {
          await writeGroupFile(groupId, MEMORY_FILE, newContent);
        }
        return 'Memory updated successfully.';
      }

      case 'create_task': {
        // Post a dedicated message to the main thread to persist the task
        const taskData = {
          id: ulid(),
          groupId,
          schedule: input.schedule as string,
          prompt: input.prompt as string,
          enabled: true,
          lastRun: null,
          createdAt: Date.now(),
        };
        post({ type: 'task-created', payload: { task: taskData } });
        return `Task created successfully.\nSchedule: ${taskData.schedule}\nPrompt: ${taskData.prompt}`;
      }

      case 'javascript': {
        try {
          // Indirect eval: (0, eval)(...) runs in global scope and
          // naturally returns the value of the last expression —
          // no explicit `return` needed.
          const code = input.code as string;
          const result = (0, eval)(`"use strict";\n${code}`);
          if (result === undefined) return '(no return value)';
          if (result === null) return 'null';
          if (typeof result === 'object') {
            try { return JSON.stringify(result, null, 2); } catch { /* fall through */ }
          }
          return String(result);
        } catch (err: unknown) {
          return `JavaScript error: ${err instanceof Error ? err.message : String(err)}`;
        }
      }

      default:
        return `Unknown tool: ${name}`;
    }
  } catch (err: unknown) {
    return `Tool error (${name}): ${err instanceof Error ? err.message : String(err)}`;
  }
}

// ---------------------------------------------------------------------------
// Convert Anthropic tools to OpenAI-compatible format for Ollama/OpenWebUI
// ---------------------------------------------------------------------------

function toOpenAITools(): { type: 'function'; function: { name: string; description: string; parameters: object } }[] {
  return TOOL_DEFINITIONS.map(tool => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema,
    },
  }));
}

// ---------------------------------------------------------------------------
// Open WebUI provider handler
// ---------------------------------------------------------------------------

async function handleOpenWebUIInvoke(
  groupId: string,
  messages: ConversationMessage[],
  systemPrompt: string,
  model: string,
  maxTokens: number,
  openWebUIUrl: string,
  apiKey: string
): Promise<void> {
  try {
    type OpenAIMessage = { role: string; content: string | null; tool_calls?: { id: string; type: string; function: { name: string; arguments: string } }[] };
    const openAIMessages: OpenAIMessage[] = [
      { role: 'system', content: systemPrompt },
      ...messages.map((m) => ({
        role: m.role,
        content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
      })),
    ];

    const tools = toOpenAITools();
    let iterations = 0;
    const maxIterations = 25;

    while (iterations < maxIterations) {
      iterations++;

      log(groupId, 'api-call', `OpenWebUI call #${iterations}`, `${openAIMessages.length} messages`);

      const res = await fetch(`${openWebUIUrl}/api/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: openAIMessages,
          max_tokens: maxTokens,
          tools,
        }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`OpenWebUI API error ${res.status}: ${errBody}`);
      }

      const result = await res.json();
      const message = result.choices?.[0]?.message;

      if (!message) {
        throw new Error('No message in response');
      }

      // Emit token usage if available
      if (result.usage) {
        post({
          type: 'token-usage',
          payload: {
            groupId,
            inputTokens: result.usage.prompt_tokens || 0,
            outputTokens: result.usage.completion_tokens || 0,
            cacheReadTokens: 0,
            cacheCreationTokens: 0,
            contextLimit: getContextLimit(model),
          },
        });
      }

      const toolCalls = message.tool_calls;

      if (toolCalls && toolCalls.length > 0) {
        // Execute tool calls
        const toolResults: { tool_call_id: string; role: string; content: string }[] = [];

        for (const tc of toolCalls) {
          const toolName = tc.function.name;
          // Arguments can be a string or already an object
          const toolArgs = typeof tc.function.arguments === 'string'
            ? JSON.parse(tc.function.arguments)
            : tc.function.arguments;

          const inputPreview = JSON.stringify(toolArgs);
          const inputShort = inputPreview.length > 300 ? inputPreview.slice(0, 300) + '…' : inputPreview;
          log(groupId, 'tool-call', `Tool: ${toolName}`, inputShort);

          post({
            type: 'tool-activity',
            payload: { groupId, tool: toolName, status: 'running' },
          });

          const output = await executeTool(toolName, toolArgs, groupId);

          const outputStr = typeof output === 'string' ? output : JSON.stringify(output);
          const outputShort = outputStr.length > 500 ? outputStr.slice(0, 500) + '…' : outputStr;
          log(groupId, 'tool-result', `Result: ${toolName}`, outputShort);

          post({
            type: 'tool-activity',
            payload: { groupId, tool: toolName, status: 'done' },
          });

          toolResults.push({
            tool_call_id: tc.id,
            role: 'tool',
            content: outputStr.slice(0, 100_000),
          });
        }

        // Add assistant message with tool_calls and tool results to conversation
        openAIMessages.push({
          role: 'assistant',
          content: message.content || null,
          tool_calls: toolCalls,
        });

        for (const tr of toolResults) {
          openAIMessages.push(tr as OpenAIMessage);
        }

        // Re-signal typing between tool iterations
        post({ type: 'typing', payload: { groupId } });
      } else {
        // No tool calls - return final response
        const responseText = message.content || '';
        const preview = responseText.length > 200 ? responseText.slice(0, 200) + '…' : responseText;
        log(groupId, 'text', 'Response', preview);

        post({ type: 'response', payload: { groupId, text: responseText || '(no response)' } });
        return;
      }
    }

    // Max iterations reached
    post({
      type: 'response',
      payload: {
        groupId,
        text: '⚠️ Reached maximum tool-use iterations (25). Stopping to avoid excessive API usage.',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    post({ type: 'error', payload: { groupId, error: message } });
  }
}

// ---------------------------------------------------------------------------
// Ollama provider handler
// ---------------------------------------------------------------------------

async function handleOllamaInvoke(
  groupId: string,
  messages: ConversationMessage[],
  systemPrompt: string,
  model: string,
  maxTokens: number,
  ollamaUrl: string
): Promise<void> {
  try {
    type OllamaMessage = { role: string; content: string; tool_calls?: { id: string; function: { name: string; arguments: string } }[] };
    // Convert messages to Ollama format
    const ollamaMessages: OllamaMessage[] = [
      { role: 'system', content: systemPrompt },
      ...messages.map(m => ({
        role: m.role,
        content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
      })),
    ];

    // Clean up ollamaUrl in case the user provided /api/tags or /api/models
    const baseUrl = ollamaUrl.replace(/\/api\/(tags|models)\/?$/, '').replace(/\/+$/, '');
    const tools = toOpenAITools();

    let iterations = 0;
    const maxIterations = 25;

    while (iterations < maxIterations) {
      iterations++;

      log(groupId, 'api-call', `Ollama call #${iterations}`, `${ollamaMessages.length} messages`);

      const res = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: ollamaMessages,
          stream: false,
          tools,
          options: { num_predict: maxTokens },
        }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`Ollama API error ${res.status}: ${errBody}`);
      }

      const result = await res.json();
      const message = result.message;

      if (!message) {
        throw new Error('No message in response');
      }

      // Emit token usage if available
      if (typeof result.prompt_eval_count === 'number') {
        post({
          type: 'token-usage',
          payload: {
            groupId,
            inputTokens: result.prompt_eval_count || 0,
            outputTokens: result.eval_count || 0,
            cacheReadTokens: 0,
            cacheCreationTokens: 0,
            contextLimit: getContextLimit(model),
          },
        });
      }

      const toolCalls = message.tool_calls;

      if (toolCalls && toolCalls.length > 0) {
        // Execute tool calls
        const toolResults: { role: string; content: string }[] = [];

        for (const tc of toolCalls) {
          const toolName = tc.function.name;
          // Arguments can be a string or already an object
          const toolArgs = typeof tc.function.arguments === 'string'
            ? JSON.parse(tc.function.arguments)
            : tc.function.arguments;

          const inputPreview = JSON.stringify(toolArgs);
          const inputShort = inputPreview.length > 300 ? inputPreview.slice(0, 300) + '…' : inputPreview;
          log(groupId, 'tool-call', `Tool: ${toolName}`, inputShort);

          post({
            type: 'tool-activity',
            payload: { groupId, tool: toolName, status: 'running' },
          });

          const output = await executeTool(toolName, toolArgs, groupId);

          const outputStr = typeof output === 'string' ? output : JSON.stringify(output);
          const outputShort = outputStr.length > 500 ? outputStr.slice(0, 500) + '…' : outputStr;
          log(groupId, 'tool-result', `Result: ${toolName}`, outputShort);

          post({
            type: 'tool-activity',
            payload: { groupId, tool: toolName, status: 'done' },
          });

          toolResults.push({
            role: 'tool',
            content: outputStr.slice(0, 100_000),
          });
        }

        // Add assistant message with tool_calls and tool results to conversation
        ollamaMessages.push({
          role: 'assistant',
          content: message.content || '',
          tool_calls: toolCalls,
        });

        for (const tr of toolResults) {
          ollamaMessages.push(tr);
        }

        // Re-signal typing between tool iterations
        post({ type: 'typing', payload: { groupId } });
      } else {
        // No tool calls - return final response
        const responseText = message.content || '';

        // Log the response
        const preview = responseText.length > 200 ? responseText.slice(0, 200) + '…' : responseText;
        log(groupId, 'text', 'Response', preview);

        post({ type: 'response', payload: { groupId, text: responseText || '(no response)' } });
        return;
      }
    }

    // Max iterations reached
    post({
      type: 'response',
      payload: {
        groupId,
        text: '⚠️ Reached maximum tool-use iterations (25). Stopping to avoid excessive API usage.',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    post({ type: 'error', payload: { groupId, error: message } });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function post(message: WorkerOutbound): void {
  (self as unknown as Worker).postMessage(message);
}

/**
 * Extract readable text from HTML, stripping tags, scripts, styles, and
 * collapsing whitespace.  Runs in the worker (no DOM), so we use regex.
 */
/**
 * Generate a simple unicode sparkline for an array of numbers.
 * Uses the eight-block characters ▁▂▃▄▅▆▇█ to represent relative heights.
 */
function makeSparkline(values: number[]): string {
  if (values.length === 0) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const blocks = ['▁','▂','▃','▄','▅','▆','▇','█'];
  return values
    .map((v) => {
      const idx = Math.floor(((v - min) / range) * (blocks.length - 1));
      return blocks[idx];
    })
    .join('');
}

function stripHtml(html: string): string {
  let text = html;
  // Remove script/style/noscript blocks entirely
  text = text.replace(/<(script|style|noscript|svg|head)[^>]*>[\s\S]*?<\/\1>/gi, '');
  // Remove HTML comments
  text = text.replace(/<!--[\s\S]*?-->/g, '');
  // Remove all tags
  text = text.replace(/<[^>]+>/g, ' ');
  // Decode common HTML entities
  text = text.replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#\d+;/g, '');
  // Collapse whitespace
  text = text.replace(/[ \t]+/g, ' ').replace(/\n\s*\n/g, '\n').trim();
  return text;
}

/** Map model names to their context window limits (tokens). */
function getContextLimit(_model: string): number {
  // The actual session context window — 200k tokens for Claude Sonnet/Opus.
  return 200_000;
}

function log(
  groupId: string,
  kind: ThinkingLogEntry['kind'],
  label: string,
  detail?: string,
): void {
  post({
    type: 'thinking-log',
    payload: { groupId, kind, timestamp: Date.now(), label, detail },
  });
}
