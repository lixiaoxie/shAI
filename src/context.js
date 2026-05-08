import { execSync } from 'node:child_process';
import os from 'node:os';

/**
 * 尝试获取终端中最近的内容作为上下文。
 * 优先级：tmux > script 环境变量 > shell history。
 */
export function getTerminalContext(maxLines = 50) {
  // 1. tmux
  const tmuxCtx = tryTmux(maxLines);
  if (tmuxCtx) return tmuxCtx;

  // 2. shell history（兜底）
  return tryShellHistory(maxLines);
}

function tryTmux(maxLines) {
  try {
    if (!process.env.TMUX) return null;
    const buf = execSync(`tmux capture-pane -p -S -${maxLines}`, {
      encoding: 'utf-8',
      timeout: 2000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const text = buf.trim();
    return text || null;
  } catch {
    return null;
  }
}

function tryShellHistory(maxLines) {
  try {
    const shell = os.userInfo().shell || process.env.SHELL || '';
    let histFile = process.env.HISTFILE;
    if (!histFile) {
      if (shell.includes('zsh')) histFile = `${os.homedir()}/.zsh_history`;
      else histFile = `${os.homedir()}/.bash_history`;
    }
    const buf = execSync(`tail -n ${maxLines} "${histFile}"`, {
      encoding: 'utf-8',
      timeout: 2000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    // zsh history 格式清洗（去掉 : 1234:0; 前缀）
    const lines = buf
      .split('\n')
      .map((l) => l.replace(/^: \d+:\d+;/, '').trim())
      .filter(Boolean);
    return lines.join('\n') || null;
  } catch {
    return null;
  }
}
