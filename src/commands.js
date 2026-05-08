import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const CUSTOM_COMMANDS_FILE = path.join(os.homedir(), '.shai', 'commands.json');

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
 * Get a summary of available system tools (context for AI).
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

  // Detect common tools
  const tools = [
    'jq', 'rg', 'fd', 'bat', 'eza', 'fzf', 'delta', 'htop',
    'docker', 'kubectl', 'git', 'curl', 'wget', 'python3', 'pip3',
    'node', 'npm', 'ffmpeg', 'tmux', 'nvim', 'code',
  ];
  const available = tools.filter(commandExists);
  if (available.length > 0) {
    parts.push('Available tools: ' + available.join(', '));
  }

  // Python packages (quick scan)
  try {
    const pipList = execSync('pip3 list --format=columns 2>/dev/null | tail -n +3 | head -20', {
      encoding: 'utf-8',
      timeout: 3000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const pkgs = pipList.split('\n').map((l) => l.split(/\s+/)[0]).filter(Boolean);
    if (pkgs.length > 0) {
      parts.push('Python packages: ' + pkgs.join(', '));
    }
  } catch { /* ignore */ }

  return parts.join('\n');
}

function shellEscape(s) {
  return "'" + s.replace(/'/g, "'\\''") + "'";
}
