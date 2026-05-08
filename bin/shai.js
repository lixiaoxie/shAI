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
  learnCommand,
} from '../src/commands.js';
import {
  loadMemory, saveMemory, removeMemory, searchMemory, getMemorySummary, clearAllMemory,
} from '../src/memory.js';
import { setLanguage, t, getHelpText } from '../src/i18n.js';

/**
 * 读取管道输入（stdin 非 TTY 时）。
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
    // 超时保护
    setTimeout(() => resolve(chunks.join('').trim() || null), 3000);
  });
}

const VERSION = '1.0.0';

// 初始化语言设置
function initLanguage() {
  const cfg = loadConfig();
  if (cfg?.lang) setLanguage(cfg.lang);
}

async function main() {
  initLanguage();
  const args = process.argv.slice(2);

  // 无参数或帮助
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.error(getHelpText(VERSION));
    process.exit(0);
  }

  // --version / -v
  if (args.includes('--version') || args.includes('-v')) {
    console.error(`shAI v${VERSION}`);
    process.exit(0);
  }

  // --config 显示当前配置
  if (args.includes('--config')) {
    const cfg = loadConfig();
    if (!cfg) {
      console.error(t('configNotFound'));
    } else {
      const masked = { ...cfg, api_key: cfg.api_key ? '****' + cfg.api_key.slice(-4) : t('configNotSet') };
      console.error(`${t('configFile')}: ${CONFIG_FILE}\n`);
      console.error(JSON.stringify(masked, null, 2));
    }
    process.exit(0);
  }

  // --set-url / --set-key / --set-model / --set-lang 快捷设置
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
      console.error(`✅ ${field} ${t('configUpdated')}: ${field === 'api_key' ? '****' + value.slice(-4) : cfg[field]}`);
      process.exit(0);
    }
  }

  // 子命令：config
  if (args[0] === 'config') {
    await setupInteractive();
    process.exit(0);
  }

  // 子命令：chat（通用问答模式）
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
    const toolsSummary = getSystemToolsSummary();

    printThinking();
    await streamChat(config, chatQuery, ctx, toolsSummary);
    process.exit(0);
  }

  // 子命令：cmd（自定义命令管理）
  if (args[0] === 'cmd') {
    handleCmdSubcommand(args.slice(1));
    process.exit(0);
  }

  // 子命令：mem（记忆管理）
  if (args[0] === 'mem') {
    handleMemSubcommand(args.slice(1));
    process.exit(0);
  }

  // 加载配置
  let config = loadConfig();
  if (!config || !config.api_key) {
    console.error(`${t('firstTimeConfig')}\n`);
    config = await setupInteractive();
  }

  // 过滤掉 flags，提取纯查询文本
  const flags = new Set(['--no-context', '--no-check', '--save']);
  const noContext = args.includes('--no-context');
  const noCheck = args.includes('--no-check');
  const autoSave = args.includes('--save');
  const query = args.filter((a) => !flags.has(a)).join(' ');

  if (!query.trim()) {
    console.error(getHelpText(VERSION));
    process.exit(0);
  }

  // 获取管道输入（如果有的话）
  const pipeInput = await readPipeInput();

  // 获取终端上下文（可通过 --no-context 跳过；管道输入时不读取终端上下文）
  const ctx = noContext || pipeInput ? null : getTerminalContext();
  const toolsSummary = getSystemToolsSummary();
  const memorySummary = getMemorySummary();

  // 合并工具摘要和记忆
  const fullContext = [toolsSummary, memorySummary].filter(Boolean).join('\n');

  // 如果有管道输入，追加到终端上下文
  const effectiveCtx = pipeInput
    ? `Piped input (output from previous command):\n\`\`\`\n${pipeInput.slice(0, 4000)}\n\`\`\``
    : ctx;

  // 流式调用 AI
  printThinking();
  const cmd = await streamGetCommand(config, query, effectiveCtx, fullContext);

  if (!cmd) {
    printError(t('uiNoResult'));
    process.exit(1);
  }

  // 如果 AI 返回的全是注释，直接输出
  if (cmd.split('\n').every((l) => l.startsWith('# ') || !l.trim())) {
    console.error(cmd);
    process.exit(0);
  }

  // 检查命令可用性（可通过 --no-check 跳过）
  if (!noCheck) {
    checkCommandAvailability(cmd);
  }

  // 确认并执行
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

  // 记忆保存逻辑：
  // 1. 用户按 s → 保存
  // 2. --save flag → 保存
  // 3. 命令复杂度高 → 自动保存（管道、多命令、长度>60字符）
  const shouldAutoSave = autoSave || isComplexCommand(finalCmd);
  if (action === 'save' || shouldAutoSave) {
    // 检查是否已存在相同命令的记忆，避免重复
    const existing = searchMemory('').find((e) => e.command === finalCmd);
    if (!existing) {
      const id = saveMemory({ query, command: finalCmd });
      console.error(`💾 ${shouldAutoSave && action !== 'save' ? t('uiAutoSaved') : t('uiSaved')}`);
    }
  }

  // 执行命令
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
 * 判断命令是否复杂（值得自动保存）。
 * 复杂标准：含管道/多命令/子shell/长度>60/多行
 */
function isComplexCommand(cmd) {
  if (cmd.length > 60) return true;
  if (cmd.includes('|')) return true;
  if (cmd.includes('&&') || cmd.includes('||')) return true;
  if (cmd.includes('$(') || cmd.includes('`')) return true;
  if (cmd.split('\n').filter((l) => l.trim()).length > 1) return true;
  // 含有复杂参数模式（正则、awk、sed 等）
  if (/\b(awk|sed|perl|xargs|find .+ -exec)\b/.test(cmd)) return true;
  return false;
}

function checkCommandAvailability(cmdString) {
  const cmds = extractCommands(cmdString);
  // shell 内建命令不需要检查
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

main().catch((e) => {
  printError(e.message);
  process.exit(1);
});

