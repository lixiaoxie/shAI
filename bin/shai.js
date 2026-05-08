#!/usr/bin/env node

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import readline from 'node:readline';
import { loadConfig, saveConfig, setupInteractive, CONFIG_FILE } from '../src/config.js';
import { getTerminalContext } from '../src/context.js';
import { streamCommand } from '../src/ai.js';
import {
  printCommand, printThinking, printError, printInstallSuggestion,
  confirmRun, editCommand, createStreamRenderer,
} from '../src/ui.js';
import {
  extractCommands, commandExists, getInstallSuggestion,
  getSystemToolsSummary, loadCustomCommands, saveCustomCommands,
  learnCommand, addBinPath, removeBinPath, loadBinPaths,
} from '../src/commands.js';
import {
  loadMemory, saveMemory, removeMemory, searchMemory, getMemorySummary, clearAllMemory,
} from '../src/memory.js';
import { setLanguage, t, getHelpText } from '../src/i18n.js';

/**
 * Read pipe input (when stdin is not a TTY).
 */
function readPipeInput() {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) return resolve(null);
    const chunks = [];
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk) => chunks.push(chunk));
    process.stdin.on('end', () => {
      const text = chunks.join('').trim();
      resolve(text || null);
    });
    // Timeout protection
    setTimeout(() => resolve(chunks.join('').trim() || null), 3000);
  });
}

const VERSION = '1.0.1';

// Mask a URL to hide the hostname, keeping only protocol and path.
function maskUrl(url) {
  try {
    const u = new URL(url);
    return `${u.protocol}//****${u.pathname}`;
  } catch {
    return '****';
  }
}

// Initialize language setting
function initLanguage() {
  const cfg = loadConfig();
  if (cfg?.lang) setLanguage(cfg.lang);
}

async function main() {
  initLanguage();
  const args = process.argv.slice(2);

  // No arguments or help
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.error(getHelpText(VERSION));
    process.exit(0);
  }

  // --version / -v
  if (args.includes('--version') || args.includes('-v')) {
    console.error(`shAI v${VERSION}`);
    process.exit(0);
  }

  // --config show current configuration
  if (args.includes('--config')) {
    const cfg = loadConfig();
    if (!cfg) {
      console.error(t('configNotFound'));
    } else {
      const masked = {
        ...cfg,
        api_url: cfg.api_url ? maskUrl(cfg.api_url) : t('configNotSet'),
        api_key: cfg.api_key ? '****' + cfg.api_key.slice(-4) : t('configNotSet'),
      };
      console.error(`${t('configFile')}: ${CONFIG_FILE}\n`);
      console.error(JSON.stringify(masked, null, 2));
    }
    process.exit(0);
  }

  // --set-url / --set-key / --set-model / --set-lang quick setters
  const setters = { '--set-url': 'api_url', '--set-key': 'api_key', '--set-model': 'model', '--set-lang': 'lang' };
  for (const [flag, field] of Object.entries(setters)) {
    const idx = args.indexOf(flag);
    if (idx !== -1) {
      const value = args[idx + 1];
      if (!value || value.startsWith('--')) {
        console.error(`Usage: shai ${flag} <value>`);
        process.exit(1);
      }
      const cfg = loadConfig() || { api_url: '', api_key: '', model: '', lang: 'en' };
      cfg[field] = field === 'lang' ? (value === 'zh' ? 'zh' : 'en') : value;
      saveConfig(cfg);
      if (field === 'lang') setLanguage(cfg.lang);
      const displayVal = field === 'api_key' ? '****' + value.slice(-4)
        : field === 'api_url' ? maskUrl(cfg[field])
        : cfg[field];
      console.error(`✅ ${field} ${t('configUpdated')}: ${displayVal}`);
      process.exit(0);
    }
  }

  // Subcommand: config
  if (args[0] === 'config') {
    await setupInteractive();
    process.exit(0);
  }

  // Subcommand: chat (general Q&A mode)
  if (args[0] === 'chat') {
    const chatQuery = args.slice(1).join(' ');
    if (!chatQuery.trim()) {
      console.error(t('chatUsage'));
      console.error(t('chatExample'));
      process.exit(0);
    }
    let config = loadConfig();
    if (!config || !config.api_key) {
      console.error(`${t('firstTimeConfig')}\n`);
      config = await setupInteractive();
    }
    const pipeInput = await readPipeInput();
    const ctx = pipeInput
      ? `Piped input (output from previous command):\n\`\`\`\n${pipeInput.slice(0, 4000)}\n\`\`\``
      : getTerminalContext();
    const toolsSummary = await getSystemToolsSummary();

    printThinking();
    await streamChat(config, chatQuery, ctx, toolsSummary);
    process.exit(0);
  }

  // Subcommand: cmd (custom command management)
  if (args[0] === 'cmd') {
    handleCmdSubcommand(args.slice(1));
    process.exit(0);
  }

  // Subcommand: mem (memory management)
  if (args[0] === 'mem') {
    handleMemSubcommand(args.slice(1));
    process.exit(0);
  }

  // Subcommand: path (custom bin path management)
  if (args[0] === 'path') {
    handlePathSubcommand(args.slice(1));
    process.exit(0);
  }

  // Load configuration
  let config = loadConfig();
  if (!config || !config.api_key) {
    console.error(`${t('firstTimeConfig')}\n`);
    config = await setupInteractive();
  }

  // Filter out flags, extract the query text
  const flags = new Set(['--no-context', '--no-check', '--save']);
  const noContext = args.includes('--no-context');
  const noCheck = args.includes('--no-check');
  const autoSave = args.includes('--save');
  const query = args.filter((a) => !flags.has(a)).join(' ');

  if (!query.trim()) {
    console.error(getHelpText(VERSION));
    process.exit(0);
  }

  // Get pipe input (if any)
  const pipeInput = await readPipeInput();

  // Get terminal context (skipped with --no-context; not read when pipe input is present)
  const ctx = noContext || pipeInput ? null : getTerminalContext();
  const toolsSummary = await getSystemToolsSummary();
  const memorySummary = getMemorySummary();

  // Merge tools summary and memory
  const fullContext = [toolsSummary, memorySummary].filter(Boolean).join('\n');

  // If pipe input exists, append to terminal context
  const effectiveCtx = pipeInput
    ? `Piped input (output from previous command):\n\`\`\`\n${pipeInput.slice(0, 4000)}\n\`\`\``
    : ctx;

  // Stream call to AI
  printThinking();
  const cmd = await streamGetCommand(config, query, effectiveCtx, fullContext);

  if (!cmd) {
    printError(t('uiNoResult'));
    process.exit(1);
  }

  // If AI returned only comments, output directly
  if (cmd.split('\n').every((l) => l.startsWith('# ') || !l.trim())) {
    console.error(cmd);
    process.exit(0);
  }

  // Check command availability (skipped with --no-check)
  if (!noCheck) {
    checkCommandAvailability(cmd);
  }

  // Confirm and execute
  let finalCmd = cmd;
  let action = await confirmRun();

  while (action === 'edit') {
    finalCmd = await editCommand(finalCmd);
    printCommand(finalCmd);
    action = await confirmRun();
  }

  if (action === 'cancel') {
    console.error(t('uiCancelled'));
    process.exit(0);
  }

  // Memory save logic:
  // 1. User presses s → save
  // 2. --save flag → save
  // 3. High command complexity → auto-save (pipes, multi-command, length > 60 chars)
  const shouldAutoSave = autoSave || isComplexCommand(finalCmd);
  if (action === 'save' || shouldAutoSave) {
    // Check if a memory with the same command already exists to avoid duplicates
    const existing = searchMemory('').find((e) => e.command === finalCmd);
    if (!existing) {
      const id = saveMemory({ query, command: finalCmd });
      console.error(`💾 ${shouldAutoSave && action !== 'save' ? t('uiAutoSaved') : t('uiSaved')}`);
    }
  }

  // Execute command
  try {
    execSync(finalCmd, { stdio: 'inherit', shell: process.env.SHELL || true });
  } catch (e) {
    process.exit(e.status ?? 1);
  }
}

function streamGetCommand(config, query, ctx, toolsSummary) {
  return new Promise((resolve, reject) => {
    const renderer = createStreamRenderer('command');

    streamCommand(config, query, ctx, toolsSummary, {
      onThinking: renderer.onThinking,
      onContent: renderer.onContent,
      onDone() {
        renderer.onDone();
        resolve(renderer.getResult());
      },
      onError(err) {
        renderer.onDone();
        printError(err.message);
        reject(err);
      },
    });
  });
}

function streamChat(config, query, ctx, toolsSummary) {
  return new Promise((resolve, reject) => {
    const renderer = createStreamRenderer('chat');

    streamCommand(config, query, ctx, toolsSummary, {
      onThinking: renderer.onThinking,
      onContent: renderer.onContent,
      onDone() {
        renderer.onDone();
        resolve(renderer.getResult());
      },
      onError(err) {
        renderer.onDone();
        printError(err.message);
        reject(err);
      },
    }, { mode: 'chat' });
  });
}

/**
 * Determine if a command is complex (worth auto-saving).
 * Complexity criteria: contains pipes/multi-commands/subshells/length > 60/multi-line
 */
function isComplexCommand(cmd) {
  if (cmd.length > 60) return true;
  if (cmd.includes('|')) return true;
  if (cmd.includes('&&') || cmd.includes('||')) return true;
  if (cmd.includes('$(') || cmd.includes('`')) return true;
  if (cmd.split('\n').filter((l) => l.trim()).length > 1) return true;
  // Contains complex argument patterns (regex, awk, sed, etc.)
  if (/\b(awk|sed|perl|xargs|find .+ -exec)\b/.test(cmd)) return true;
  return false;
}

function checkCommandAvailability(cmdString) {
  const cmds = extractCommands(cmdString);
  // Shell builtins don't need checking
  const builtins = new Set([
    'echo', 'cd', 'pwd', 'export', 'source', 'alias', 'unalias', 'type',
    'read', 'eval', 'exec', 'set', 'unset', 'shift', 'test', 'true', 'false',
    'if', 'then', 'else', 'fi', 'for', 'while', 'do', 'done', 'case', 'esac',
    'function', 'return', 'exit', 'trap', 'wait', 'jobs', 'fg', 'bg',
    'history', 'let', 'declare', 'local', 'readonly', 'typeset', 'printf',
    'command', 'builtin', 'hash', 'dirs', 'pushd', 'popd', 'compgen',
  ]);

  for (const cmd of cmds) {
    if (builtins.has(cmd)) continue;
    if (!commandExists(cmd)) {
      const suggestions = getInstallSuggestion(cmd);
      printInstallSuggestion(cmd, suggestions);
    }
  }
}

function handleCmdSubcommand(args) {
  const sub = args[0];

  if (sub === 'list' || !sub) {
    const cmds = loadCustomCommands();
    const entries = Object.entries(cmds);
    if (entries.length === 0) {
      console.error(t('uiNoCustomCmds'));
    } else {
      console.error(`${t('uiCustomCmds')}\n`);
      for (const [name, val] of entries) {
        const desc = typeof val === 'object' ? val.desc : val;
        const hasHelp = typeof val === 'object' && val.helpText;
        console.error(`  ${name}\t${desc}${hasHelp ? ' 📖' : ''}`);
      }
      console.error(`\n${t('uiHelpLearned')}`);
    }
    return;
  }

  if (sub === 'add') {
    const name = args[1];
    const desc = args.slice(2).join(' ');
    if (!name || !desc) {
      console.error(t('uiCmdUsage'));
      console.error(t('uiCmdExample'));
      return;
    }

    if (!commandExists(name)) {
      console.error(`⚠ ${t('uiCmdNotInPath', { cmd: name })}`);
      const suggestions = getInstallSuggestion(name);
      if (suggestions.length > 0) {
        console.error(`  ${t('uiInstallSuggest')} ${suggestions[0]}`);
      }
      console.error(`  ${t('uiStillAdd')}\n`);
    }

    let helpText = null;
    if (commandExists(name)) {
      console.error(t('uiLearning', { cmd: name }));
      helpText = learnCommand(name);
      if (helpText) {
        console.error(t('uiLearnedLines', { cmd: name, n: helpText.split('\n').length }));
      } else {
        console.error(`  ${t('uiLearnFailed')}`);
      }
    }

    const cmds = loadCustomCommands();
    cmds[name] = helpText ? { desc, helpText } : desc;
    saveCustomCommands(cmds);
    console.error(`${t('uiAdded')} ${name}`);
    return;
  }

  if (sub === 'rm' || sub === 'remove') {
    const name = args[1];
    if (!name) {
      console.error('Usage: shai cmd rm <name>');
      return;
    }
    const cmds = loadCustomCommands();
    if (!(name in cmds)) {
      console.error(`${t('uiNotFoundCmd')} ${name}`);
      return;
    }
    delete cmds[name];
    saveCustomCommands(cmds);
    console.error(`${t('uiRemoved')} ${name}`);
    return;
  }

  console.error(`${t('uiUnknownSub')} add, rm, list`);
}

function handleMemSubcommand(args) {
  const sub = args[0];

  if (sub === 'list' || sub === 'search' || !sub) {
    const keyword = args.slice(1).join(' ') || '';
    const entries = searchMemory(keyword);
    if (entries.length === 0) {
      console.error(keyword ? t('memNoMatch', { kw: keyword }) : t('memEmpty'));
      return;
    }
    console.error(`${t('memSavedList')}${keyword ? ` (${t('memSearch')}: ${keyword})` : ''}:\n`);
    entries.forEach((e, i) => {
      const tags = e.tags?.length ? ` [${e.tags.join(', ')}]` : '';
      const note = e.note ? ` — ${e.note}` : '';
      console.error(`  ${i + 1}. ${e.query}`);
      console.error(`     $ ${e.command}${tags}${note}`);
      console.error(`     (${t('memUsage', { n: e.usageCount })}, ${e.createdAt.slice(0, 10)})`);
      console.error('');
    });
    return;
  }

  if (sub === 'save') {
    const query = args[1];
    const command = args.slice(2).join(' ');
    if (!query || !command) {
      console.error(t('memSaveUsage'));
      console.error(t('memSaveExample'));
      console.error(`\n${t('memSaveTip')}`);
      return;
    }
    const id = saveMemory({ query, command });
    console.error(`💾 ${t('uiSaved')} (${id})`);
    return;
  }

  if (sub === 'rm' || sub === 'remove') {
    const target = args[1];
    if (!target) {
      console.error('Usage: shai mem rm <id>');
      return;
    }
    if (removeMemory(target)) {
      console.error(t('memDeleted'));
    } else {
      console.error(t('memNotFound'));
    }
    return;
  }

  if (sub === 'clear') {
    const entries = loadMemory();
    if (entries.length === 0) {
      console.error(t('memIsEmpty'));
      return;
    }
    clearAllMemory();
    console.error(t('memCleared', { n: entries.length }));
    return;
  }

  console.error(`${t('uiUnknownSub')} list, search, save, rm, clear`);
}

function handlePathSubcommand(args) {
  const sub = args[0];

  if (sub === 'add') {
    const dirPath = args.slice(1).join(' ');
    if (!dirPath) {
      console.error(t('pathAddUsage'));
      return;
    }
    const result = addBinPath(dirPath);
    console.error(result.ok ? `✅ ${result.message}` : `❌ ${result.message}`);
    return;
  }

  if (sub === 'rm' || sub === 'remove') {
    const dirPath = args.slice(1).join(' ');
    if (!dirPath) {
      console.error(t('pathRmUsage'));
      return;
    }
    const result = removeBinPath(dirPath);
    console.error(result.ok ? `✅ ${result.message}` : `❌ ${result.message}`);
    return;
  }

  if (sub === 'list' || !sub) {
    const paths = loadBinPaths();
    if (paths.length === 0) {
      console.error(t('pathEmpty'));
    } else {
      console.error(t('pathListTitle'));
      paths.forEach((p, i) => {
        const exists = fs.existsSync(p);
        console.error(`  ${i + 1}. ${p} ${exists ? '✅' : '❌ (not found)'}`);
      });
    }
    return;
  }

  console.error(`${t('uiUnknownSub')} add, rm, list`);
}

main().catch((e) => {
  printError(e.message);
  process.exit(1);
});

