import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const CUSTOM_COMMANDS_FILE = path.join(os.homedir(), '.shai', 'commands.json');

/**
 * 加载用户自定义命令列表。
 * 格式: { "命令名": { desc, helpText? } | "说明字符串" }
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
 * 尝试学习命令的用法（通过 --help 或 man）。
 * 返回帮助文本摘要（截取前 80 行），或 null。
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
        // 截取前 80 行，避免过长
        const lines = text.split('\n').slice(0, 80);
        return lines.join('\n');
      }
    } catch {
      // --help 某些命令会以非零退出码返回帮助文本
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
 * 检查命令是否在系统 PATH 中存在。
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
 * 从命令字符串中提取主命令名（第一个 token，跳过 sudo/env 等前缀）。
 */
export function extractCommands(cmdString) {
  const cmds = new Set();
  const lines = cmdString.split('\n').filter((l) => l.trim() && !l.trim().startsWith('#'));

  for (const line of lines) {
    // 按管道和逻辑操作符拆分
    const parts = line.split(/[|;&]/).map((s) => s.trim()).filter(Boolean);
    for (const part of parts) {
      const tokens = part.split(/\s+/);
      let i = 0;
      // 跳过前缀
      const prefixes = new Set(['sudo', 'env', 'nohup', 'time', 'nice', 'ionice', 'strace', 'xargs']);
      while (i < tokens.length && prefixes.has(tokens[i])) i++;
      // 跳过环境变量赋值 (VAR=val)
      while (i < tokens.length && /^\w+=/.test(tokens[i])) i++;
      if (i < tokens.length) {
        const cmd = tokens[i];
        // 排除 shell 内建和路径形式
        if (!cmd.startsWith('/') && !cmd.startsWith('./') && !cmd.startsWith('$')) {
          cmds.add(cmd);
        }
      }
    }
  }
  return [...cmds];
}

/**
 * 为不存在的命令生成安装建议。
 */
export function getInstallSuggestion(cmd) {
  const isMac = process.platform === 'darwin';
  const suggestions = [];

  // 常见包管理器映射
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

  // npm 全局工具
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
 * 获取系统可用工具摘要（传给 AI 的上下文）。
 */
export function getSystemToolsSummary() {
  const parts = [];

  // 自定义命令
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

  // 检测常用工具
  const tools = [
    'jq', 'rg', 'fd', 'bat', 'eza', 'fzf', 'delta', 'htop',
    'docker', 'kubectl', 'git', 'curl', 'wget', 'python3', 'pip3',
    'node', 'npm', 'ffmpeg', 'tmux', 'nvim', 'code',
  ];
  const available = tools.filter(commandExists);
  if (available.length > 0) {
    parts.push('Available tools: ' + available.join(', '));
  }

  // Python 包（快速扫描）
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
