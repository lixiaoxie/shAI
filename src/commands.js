import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const CUSTOM_COMMANDS_FILE = path.join(os.homedir(), '.shai', 'commands.json');
const TOOLS_CACHE_FILE = path.join(os.homedir(), '.shai', 'tools-cache.json');

// Curated list of common CLI tools worth tracking
const KNOWN_TOOLS = [
  // Core Unix
  'git', 'curl', 'wget', 'rsync', 'ssh', 'scp', 'tar', 'zip', 'unzip',
  // Modern CLI replacements
  'jq', 'yq', 'rg', 'fd', 'bat', 'eza', 'exa', 'fzf', 'delta', 'sd', 'dust', 'duf', 'procs', 'hyperfine',
  // System monitoring
  'htop', 'btop', 'top', 'lsof', 'nmap', 'ss', 'netstat', 'watch',
  // Container / cloud
  'docker', 'podman', 'kubectl', 'helm', 'terraform', 'aws', 'gcloud', 'az',
  // Languages & runtimes
  'python3', 'pip3', 'node', 'npm', 'npx', 'go', 'cargo', 'rustc', 'java', 'mvn', 'gradle',
  // Media / data
  'ffmpeg', 'imagemagick', 'convert', 'pandoc', 'sqlite3',
  // Editors & tools
  'tmux', 'nvim', 'vim', 'code', 'make', 'cmake', 'gcc', 'clang',
  // Network
  'nc', 'dig', 'traceroute', 'mtr', 'ab', 'wrk',
];

/**
 * Load user-defined custom commands.
 * Format: { "commandName": { desc, helpText? } | "description string" }
 */
export function loadCustomCommands() {
  try {
    if (!fs.existsSync(CUSTOM_COMMANDS_FILE)) return {};
    return JSON.parse(fs.readFileSync(CUSTOM_COMMANDS_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

export function saveCustomCommands(cmds) {
  const dir = path.dirname(CUSTOM_COMMANDS_FILE);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CUSTOM_COMMANDS_FILE, JSON.stringify(cmds, null, 2) + '\n', 'utf-8');
}

/**
 * Try to learn command usage (via --help or man).
 * Returns a help text summary (first 80 lines), or null.
 */
export function learnCommand(cmd) {
  const attempts = [`${cmd} --help`, `${cmd} -h`, `man ${cmd} 2>/dev/null | col -bx | head -80`];
  for (const attempt of attempts) {
    try {
      const output = execSync(attempt, {
        encoding: 'utf-8',
        timeout: 5000,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: process.env.SHELL || true,
      });
      const text = output.trim();
      if (text.length > 20) {
        // Truncate to first 80 lines to avoid excessive length
        const lines = text.split('\n').slice(0, 80);
        return lines.join('\n');
      }
    } catch {
      // Some commands return help text with a non-zero exit code
      try {
        const output = execSync(`${attempt} 2>&1`, {
          encoding: 'utf-8',
          timeout: 5000,
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: process.env.SHELL || true,
        });
        const text = output.trim();
        if (text.length > 20) {
          return text.split('\n').slice(0, 80).join('\n');
        }
      } catch { /* ignore */ }
    }
  }
  return null;
}

/**
 * Check if a command exists in the system PATH.
 */
export function commandExists(cmd) {
  try {
    execSync(`command -v ${shellEscape(cmd)}`, {
      encoding: 'utf-8',
      timeout: 2000,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: process.env.SHELL || true,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Extract the main command name from a command string (first token, skipping sudo/env prefixes).
 */
export function extractCommands(cmdString) {
  const cmds = new Set();
  const lines = cmdString.split('\n').filter((l) => l.trim() && !l.trim().startsWith('#'));

  for (const line of lines) {
    // Split by pipe and logical operators
    const parts = line.split(/[|;&]/).map((s) => s.trim()).filter(Boolean);
    for (const part of parts) {
      const tokens = part.split(/\s+/);
      let i = 0;
      // Skip prefixes
      const prefixes = new Set(['sudo', 'env', 'nohup', 'time', 'nice', 'ionice', 'strace', 'xargs']);
      while (i < tokens.length && prefixes.has(tokens[i])) i++;
      // Skip environment variable assignments (VAR=val)
      while (i < tokens.length && /^\w+=/.test(tokens[i])) i++;
      if (i < tokens.length) {
        const cmd = tokens[i];
        // Exclude shell builtins and path-style commands
        if (!cmd.startsWith('/') && !cmd.startsWith('./') && !cmd.startsWith('$')) {
          cmds.add(cmd);
        }
      }
    }
  }
  return [...cmds];
}

/**
 * Generate install suggestions for missing commands.
 */
export function getInstallSuggestion(cmd) {
  const isMac = process.platform === 'darwin';
  const suggestions = [];

  // Common package manager mappings
  const brewMap = {
    jq: 'jq', rg: 'ripgrep', fd: 'fd', bat: 'bat', exa: 'exa', eza: 'eza',
    htop: 'htop', tree: 'tree', wget: 'wget', httpie: 'httpie', http: 'httpie',
    fzf: 'fzf', ag: 'the_silver_searcher', delta: 'git-delta', dust: 'dust',
    duf: 'duf', procs: 'procs', sd: 'sd', hyperfine: 'hyperfine', tokei: 'tokei',
    ffmpeg: 'ffmpeg', imagemagick: 'imagemagick', convert: 'imagemagick',
    nvim: 'neovim', tmux: 'tmux', nmap: 'nmap', watch: 'watch',
  };

  const pipPackages = new Set([
    'black', 'ruff', 'mypy', 'pytest', 'flask', 'django', 'fastapi', 'uvicorn',
    'httpx', 'requests', 'scrapy', 'ansible', 'cookiecutter', 'pipenv', 'poetry',
    'ipython', 'jupyter', 'notebook', 'pandas', 'numpy', 'matplotlib',
  ]);

  if (isMac && brewMap[cmd]) {
    suggestions.push(`brew install ${brewMap[cmd]}`);
  } else if (!isMac && brewMap[cmd]) {
    suggestions.push(`apt install ${brewMap[cmd]}  # 或 yum install ${brewMap[cmd]}`);
  }

  if (pipPackages.has(cmd)) {
    suggestions.push(`pip install ${cmd}`);
  }

  // npm global tools
  const npmPackages = new Set([
    'tldr', 'serve', 'nodemon', 'pm2', 'prettier', 'eslint', 'ts-node', 'tsx',
    'npx', 'create-react-app', 'vercel', 'netlify-cli',
  ]);
  if (npmPackages.has(cmd)) {
    suggestions.push(`npm install -g ${cmd}`);
  }

  if (suggestions.length === 0) {
    if (isMac) suggestions.push(`brew search ${cmd}`);
    else suggestions.push(`apt search ${cmd}`);
  }

  return suggestions;
}

/**
 * Count total executable files across all PATH directories.
 */
function countPathExecutables() {
  const pathDirs = (process.env.PATH || '').split(':').filter(Boolean);
  let count = 0;
  for (const dir of pathDirs) {
    try {
      const entries = fs.readdirSync(dir);
      count += entries.length;
    } catch { /* dir doesn't exist or not readable */ }
  }
  return count;
}

/**
 * Load tools cache from disk.
 */
function loadToolsCache() {
  try {
    if (!fs.existsSync(TOOLS_CACHE_FILE)) return null;
    return JSON.parse(fs.readFileSync(TOOLS_CACHE_FILE, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * Save tools cache to disk.
 */
function saveToolsCache(cache) {
  const dir = path.dirname(TOOLS_CACHE_FILE);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(TOOLS_CACHE_FILE, JSON.stringify(cache, null, 2) + '\n', 'utf-8');
}

/**
 * Learn help text for a tool (truncated to 20 lines for cache efficiency).
 */
function learnToolHelp(cmd) {
  const attempts = [`${cmd} --help`, `${cmd} -h`];
  for (const attempt of attempts) {
    try {
      const output = execSync(attempt, {
        encoding: 'utf-8',
        timeout: 3000,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: process.env.SHELL || true,
      });
      const text = output.trim();
      if (text.length > 20) {
        return text.split('\n').slice(0, 20).join('\n');
      }
    } catch {
      try {
        const output = execSync(`${attempt} 2>&1`, {
          encoding: 'utf-8',
          timeout: 3000,
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: process.env.SHELL || true,
        });
        const text = output.trim();
        if (text.length > 20) {
          return text.split('\n').slice(0, 20).join('\n');
        }
      } catch { /* ignore */ }
    }
  }
  return null;
}

/**
 * Scan system tools and update cache if PATH has changed.
 * Returns cached data if PATH executable count is unchanged.
 */
function refreshToolsCache() {
  const currentCount = countPathExecutables();
  const cache = loadToolsCache();

  if (cache && cache.pathCommandCount === currentCount) {
    return cache;
  }

  // PATH changed or no cache — re-scan
  const tools = {};
  for (const cmd of KNOWN_TOOLS) {
    const exists = commandExists(cmd);
    if (exists) {
      // Reuse cached help if tool was already known
      const cachedHelp = cache?.tools?.[cmd]?.help || null;
      const help = cachedHelp || learnToolHelp(cmd);
      tools[cmd] = { exists: true, help };
    }
  }

  // Python packages
  let pythonPackages = [];
  try {
    const pipList = execSync('pip3 list --format=columns 2>/dev/null | tail -n +3 | head -30', {
      encoding: 'utf-8',
      timeout: 3000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    pythonPackages = pipList.split('\n').map((l) => l.split(/\s+/)[0]).filter(Boolean);
  } catch { /* ignore */ }

  const newCache = {
    pathCommandCount: currentCount,
    tools,
    pythonPackages,
    lastScan: new Date().toISOString(),
  };

  saveToolsCache(newCache);
  return newCache;
}

/**
 * Get a summary of available system tools (context for AI).
 * Uses cached data with automatic refresh when PATH changes.
 */
export function getSystemToolsSummary() {
  const parts = [];

  // Custom commands
  const custom = loadCustomCommands();
  const customEntries = Object.entries(custom);
  if (customEntries.length > 0) {
    const lines = customEntries.map(([k, v]) => {
      const desc = typeof v === 'object' ? v.desc : v;
      const help = typeof v === 'object' && v.helpText ? `\n    Help: ${v.helpText.split('\n').slice(0, 5).join(' | ')}` : '';
      return `  ${k}: ${desc}${help}`;
    });
    parts.push('User-defined shortcuts (name → actual command/description):\n' + lines.join('\n'));
  }

  // Cached system tools
  const cache = refreshToolsCache();
  const availableTools = Object.keys(cache.tools);
  if (availableTools.length > 0) {
    const toolLines = availableTools.map((cmd) => {
      const info = cache.tools[cmd];
      const helpSnippet = info.help ? info.help.split('\n')[0] : '';
      return helpSnippet ? `  ${cmd} — ${helpSnippet}` : `  ${cmd}`;
    });
    parts.push('Available tools:\n' + toolLines.join('\n'));
  }

  // Python packages
  if (cache.pythonPackages?.length > 0) {
    parts.push('Python packages: ' + cache.pythonPackages.join(', '));
  }

  return parts.join('\n');
}

function shellEscape(s) {
  return "'" + s.replace(/'/g, "'\\''") + "'";
}
