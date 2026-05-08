import https from 'node:https';
import http from 'node:http';
import { URL } from 'node:url';
import { getLanguage } from './i18n.js';

const SYSTEM_PROMPT = `You are shAI, a command-line assistant. The user describes a task in natural language; you reply with ONLY the shell command(s) that accomplish it. Rules:
- Output exactly the command(s) the user should run, one per line if multiple.
- Target the current OS (provided in the user message).
- ONLY use commands that are available on the user's system (see "Available tools" in context).
- If a required tool is not available, output a comment line starting with "# " explaining which tool is needed, followed by the install command, then the actual task command. Example:
  # Need to install jq first
  brew install jq
  cat data.json | jq '.name'
- If the request is ambiguous, prefer the safest interpretation.
- For destructive operations (rm, kill, etc.), prefer safer variants (e.g., rm -i, kill with specific PID).
- If the user mentions a custom shortcut name (from "User-defined shortcuts"), you MUST output the actual command from its description — NOT the shortcut name. For example, if "db-migrate" maps to "python3 manage.py migrate", output "python3 manage.py migrate".
- Never wrap output in code fences or quotes.
- Comment lines (starting with #) MUST be written in the user's language (see Language field).
- If you truly cannot produce a command, reply with a single line starting with "# " explaining why, in the user's language.
- If the user asks about configuring or using shAI itself, output the correct shai command. shAI's own commands:
  shai --set-lang <zh|en>     Set language
  shai --set-url <url>        Set API URL
  shai --set-key <key>        Set API key
  shai --set-model <model>    Set model
  shai config                 Interactive configuration
  shai cmd add <name> <desc>  Add custom command
  shai cmd rm <name>          Remove custom command
  shai cmd list               List custom commands
  shai mem list [keyword]     Search/list saved memories
  shai mem save <desc> <cmd>  Save a command to memory
  shai mem rm <id>            Delete a memory
  shai mem clear              Clear all memories
  shai path add <dir>         Add custom bin directory
  shai path rm <dir>          Remove custom bin directory
  shai path list              List custom bin directories
  shai chat <question>        General Q&A mode`;

const CHAT_SYSTEM_PROMPT = `You are shAI, a helpful command-line AI assistant. The user asks questions about terminal/shell/programming topics. Provide clear, concise answers. Rules:
- ALWAYS respond in the user's language (see Language field in the message).
- When relevant, include example commands or code snippets.
- If piped input is provided, analyze it in the context of the user's question.
- Keep answers concise but thorough — aim for practical, actionable information.
- Use markdown formatting for readability (headers, lists, code blocks).
- For error messages: explain what went wrong, why, and how to fix it.`;

/**
 * Stream call to OpenAI-compatible API.
 * @param {object} config - { api_url, api_key, model }
 * @param {string} query - user's natural language request
 * @param {string|null} terminalContext - terminal context
 * @param {string|null} toolsSummary - system tools summary
 * @param {object} callbacks - { onThinking(text), onContent(text), onDone(), onError(err) }
 * @param {object} [options] - { mode: 'command' | 'chat' }
 */
export function streamCommand(config, query, terminalContext, toolsSummary, callbacks, options = {}) {
  const mode = options.mode || 'command';
  const systemPrompt = mode === 'chat' ? CHAT_SYSTEM_PROMPT : SYSTEM_PROMPT;

  const osInfo = `${process.platform} ${process.arch}`;
  const shell = process.env.SHELL || 'sh';
  const cwd = process.cwd();

  let userContent = `OS: ${osInfo} | Shell: ${shell} | CWD: ${cwd} | Language: ${getLanguage() === 'zh' ? 'Chinese' : 'English'}\n`;
  if (toolsSummary) {
    userContent += `\n${toolsSummary}\n`;
  }
  if (terminalContext) {
    userContent += `\nRecent terminal context:\n\`\`\`\n${terminalContext}\n\`\`\`\n`;
  }
  userContent += `\n${mode === 'chat' ? 'Question' : 'Task'}: ${query}`;

  const body = JSON.stringify({
    model: config.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
    temperature: 0,
    max_tokens: mode === 'chat' ? 2048 : 1024,
    stream: true,
  });

  const url = new URL(config.api_url);
  const isHttps = url.protocol === 'https:';
  const reqOptions = {
    hostname: url.hostname,
    port: url.port || (isHttps ? 443 : 80),
    path: url.pathname + url.search,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.api_key}`,
      'Content-Length': Buffer.byteLength(body),
    },
  };

  const transport = isHttps ? https : http;
  const req = transport.request(reqOptions, (res) => {
    if (res.statusCode !== 200) {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        callbacks.onError(new Error(`API 请求失败 (${res.statusCode}): ${Buffer.concat(chunks).toString().slice(0, 300)}`));
      });
      return;
    }

    let buffer = '';
    res.setEncoding('utf-8');
    res.on('data', (chunk) => {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        if (data === '[DONE]') {
          callbacks.onDone();
          return;
        }
        try {
          const json = JSON.parse(data);
          const delta = json.choices?.[0]?.delta;
          if (!delta) continue;

          // Support thinking/reasoning content (DeepSeek, OpenAI o-series, etc.)
          const thinking = delta.reasoning_content || delta.thinking;
          if (thinking) {
            callbacks.onThinking(thinking);
          }

          const content = delta.content;
          if (content) {
            callbacks.onContent(content);
          }
        } catch {
          // Ignore lines that fail to parse
        }
      }
    });
    res.on('end', () => {
      // Process remaining buffer
      if (buffer.trim()) {
        const trimmed = buffer.trim();
        if (trimmed.startsWith('data: ') && trimmed.slice(6) !== '[DONE]') {
          try {
            const json = JSON.parse(trimmed.slice(6));
            const content = json.choices?.[0]?.delta?.content;
            if (content) callbacks.onContent(content);
          } catch { /* ignore */ }
        }
      }
      callbacks.onDone();
    });
  });

  req.on('error', (e) => callbacks.onError(e));
  req.setTimeout(30000, () => {
    req.destroy();
    callbacks.onError(new Error('API 请求超时 (30s)'));
  });
  req.write(body);
  req.end();

  return req;
}

/**
 * Non-streaming call (kept as fallback).
 */
export async function getCommand(config, query, terminalContext, toolsSummary) {
  return new Promise((resolve, reject) => {
    let result = '';
    streamCommand(config, query, terminalContext, toolsSummary, {
      onThinking() {},
      onContent(text) { result += text; },
      onDone() { resolve(result.trim()); },
      onError(err) { reject(err); },
    });
  });
}

