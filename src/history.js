import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const CACHE_FILE = path.join(os.homedir(), '.shai', 'history-cache.json');

// Commands too trivial to learn
const SKIP_COMMANDS = new Set([
  'cd', 'ls', 'pwd', 'echo', 'cat', 'clear', 'exit', 'logout', 'whoami',
  'date', 'cal', 'true', 'false', 'yes', 'no', 'history', 'which', 'type',
  'alias', 'unalias', 'export', 'source', '.', 'fg', 'bg', 'jobs',
  'pushd', 'popd', 'dirs', 'set', 'unset', 'env', 'printenv',
]);

// Patterns that indicate a "complex" or valuable command
const COMPLEX_PATTERNS = [
  /\|/,            // pipes
  /[><]/,          // redirects
  /&&|\|\|/,       // chaining
  /\bxargs\b/,
  /\bawk\b/,
  /\bsed\b/,
  /\bfind\b.*-/,
  /\bgrep\b.*-/,
  /\bcurl\b/,
  /\bwget\b/,
  /\bdocker\b/,
  /\bkubectl\b/,
  /\bgit\b.*\b(rebase|cherry-pick|bisect|stash|log.*--)/,
  /\btar\b/,
  /\brsync\b/,
  /\bssh\b.*-/,
  /\bffmpeg\b/,
  /\bjq\b/,
  /\bsort\b.*\|/,
  /\buniq\b/,
  /\bfor\b.*\bdo\b/,
  /\bwhile\b.*\bdo\b/,
];

/**
 * Detect the shell history file path.
 */
function getHistoryFile() {
  if (process.env.HISTFILE) return process.env.HISTFILE;
  const shell = os.userInfo().shell || process.env.SHELL || '';
  if (shell.includes('zsh')) return path.join(os.homedir(), '.zsh_history');
  return path.join(os.homedir(), '.bash_history');
}

/**
 * Parse shell history file into an array of command strings.
 */
function parseHistoryFile(filePath, limit = 5000) {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, { encoding: 'utf-8', flag: 'r' });
  const lines = content.split('\n');

  // Take last N lines for performance
  const recent = lines.slice(-limit);

  const commands = [];
  let multiline = '';

  for (const line of recent) {
    // zsh extended history format: `: timestamp:0;command`
    const cleaned = line.replace(/^: \d+:\d+;/, '').trim();
    if (!cleaned) continue;

    // Handle zsh multiline (lines ending with \)
    if (cleaned.endsWith('\\')) {
      multiline += cleaned.slice(0, -1) + ' ';
      continue;
    }
    if (multiline) {
      commands.push(multiline + cleaned);
      multiline = '';
    } else {
      commands.push(cleaned);
    }
  }
  return commands;
}

/**
 * Check if a command is worth learning.
 */
function isValuable(cmd) {
  if (!cmd || cmd.length < 5 || cmd.length > 500) return false;
  if (cmd.startsWith('#')) return false;
  if (cmd.startsWith('shai ')) return false;

  // Get the base command (first word)
  const base = cmd.split(/\s+/)[0].replace(/^sudo$/, '');
  const actualBase = base === '' ? cmd.split(/\s+/)[1] : base;
  if (SKIP_COMMANDS.has(actualBase)) return false;

  // Must have at least 2 tokens (command + arg)
  const tokens = cmd.split(/\s+/);
  if (tokens.length < 2) return false;

  // Check if it matches complex patterns
  if (COMPLEX_PATTERNS.some((p) => p.test(cmd))) return true;

  // Commands with 3+ arguments are considered non-trivial
  if (tokens.length >= 4) return true;

  // Commands with flags are usually worth learning
  if (tokens.some((t, i) => i > 0 && t.startsWith('-') && t.length > 1)) return true;

  return false;
}

/**
 * Normalize a command for deduplication.
 * Replaces file paths and numbers with placeholders to group similar commands.
 */
function normalizeForDedup(cmd) {
  return cmd
    .replace(/\/[\w./-]+/g, '<path>')    // file paths
    .replace(/\b\d{2,}\b/g, '<num>')     // numbers (2+ digits)
    .replace(/"[^"]*"/g, '"<str>"')      // quoted strings
    .replace(/'[^']*'/g, "'<str>'");
}

/**
 * Load cached history.
 */
export function loadHistoryCache() {
  try {
    if (!fs.existsSync(CACHE_FILE)) return { commands: [], lastMtime: 0 };
    return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
  } catch {
    return { commands: [], lastMtime: 0 };
  }
}

/**
 * Save history cache.
 */
function saveHistoryCache(data) {
  const dir = path.dirname(CACHE_FILE);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

/**
 * Learn from shell history. Returns the number of new commands learned.
 */
export function learnFromHistory(force = false) {
  const histFile = getHistoryFile();
  if (!fs.existsSync(histFile)) return { learned: 0, total: 0, histFile };

  const cache = loadHistoryCache();
  const stat = fs.statSync(histFile);
  const currentMtime = stat.mtimeMs;

  // Skip if history file hasn't changed (unless forced)
  if (!force && cache.lastMtime >= currentMtime && cache.commands.length > 0) {
    return { learned: 0, total: cache.commands.length, histFile, cached: true };
  }

  // Parse and filter
  const allCommands = parseHistoryFile(histFile);
  const valuable = allCommands.filter(isValuable);

  // Deduplicate: keep the last occurrence of each normalized pattern
  const seen = new Map();
  for (const cmd of valuable) {
    const key = normalizeForDedup(cmd);
    seen.set(key, cmd);
  }
  const unique = [...seen.values()];

  // Keep the most recent 200 commands
  const maxCache = 200;
  const trimmed = unique.slice(-maxCache);

  const newCount = trimmed.length - cache.commands.length;
  saveHistoryCache({ commands: trimmed, lastMtime: currentMtime });

  return { learned: Math.max(0, newCount), total: trimmed.length, histFile };
}

/**
 * Get relevant history commands for a given query (keyword matching).
 */
export function getRelevantHistory(query, maxResults = 10) {
  const cache = loadHistoryCache();
  if (!cache.commands || cache.commands.length === 0) return null;

  // Extract keywords from query (both Chinese and English)
  const keywords = query
    .toLowerCase()
    .split(/[\s,.\u3001\u3002\uff0c]+/)
    .filter((w) => w.length >= 2);

  if (keywords.length === 0) return null;

  // Score each command by keyword matches
  const scored = cache.commands.map((cmd) => {
    const lower = cmd.toLowerCase();
    let score = 0;
    for (const kw of keywords) {
      if (lower.includes(kw)) score += 1;
    }
    return { cmd, score };
  });

  // Return top matches with score > 0
  const matches = scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map((s) => s.cmd);

  if (matches.length === 0) return null;
  return "User's shell history (relevant patterns):\n" + matches.map((c) => `  $ ${c}`).join('\n');
}

/**
 * Clear the history cache.
 */
export function clearHistoryCache() {
  saveHistoryCache({ commands: [], lastMtime: 0 });
}

/**
 * Get cache status info.
 */
export function getHistoryCacheStatus() {
  const cache = loadHistoryCache();
  const histFile = getHistoryFile();
  return {
    cacheFile: CACHE_FILE,
    histFile,
    commandCount: cache.commands?.length || 0,
    lastUpdated: cache.lastMtime ? new Date(cache.lastMtime).toLocaleString() : null,
  };
}
