import readline from 'node:readline';
import fs from 'node:fs';
import { t } from './i18n.js';

const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const YELLOW = '\x1b[33m';
const GRAY = '\x1b[90m';

export function printCommand(cmd) {
  console.error('');
  console.error(`${BOLD}${GREEN}$ ${cmd}${RESET}`);
  console.error('');
}

export function printThinking() {
  process.stderr.write(`${DIM}${t('uiThinking')}${RESET}`);
}

export function clearThinking() {
  process.stderr.write('\r\x1b[K');
}

export function printError(msg) {
  console.error(`${YELLOW}⚠ ${msg}${RESET}`);
}

export function printInstallSuggestion(cmd, suggestions) {
  console.error(`${YELLOW}⚠ ${t('uiCmdNotFound', { cmd })}${RESET}`);
  console.error(`${DIM}${t('uiInstallSuggest')}${RESET}`);
  for (const s of suggestions) {
    console.error(`  ${CYAN}${s}${RESET}`);
  }
  console.error('');
}

/**
 * Streaming output renderer.
 * @param {string} mode - 'command' | 'chat'
 * Returns an object { onThinking, onContent, onDone, getResult }
 */
export function createStreamRenderer(mode = 'command') {
  let thinkingStarted = false;
  let contentStarted = false;
  let result = '';

  return {
    onThinking(text) {
      if (!thinkingStarted) {
        clearThinking();
        process.stderr.write(`\n${GRAY}💭 `);
        thinkingStarted = true;
      }
      process.stderr.write(`${GRAY}${text}`);
    },

    onContent(text) {
      if (!contentStarted) {
        if (thinkingStarted) {
          process.stderr.write(`${RESET}\n\n`);
        } else {
          clearThinking();
          process.stderr.write('\n');
        }
        if (mode === 'command') {
          process.stderr.write(`${BOLD}${GREEN}$ `);
        }
        contentStarted = true;
      }
      if (mode === 'command') {
        process.stderr.write(`${GREEN}${text}`);
      } else {
        process.stderr.write(`${RESET}${text}`);
      }
      result += text;
    },

    onDone() {
      if (contentStarted) {
        process.stderr.write(`${RESET}\n\n`);
      } else if (thinkingStarted) {
        process.stderr.write(`${RESET}\n\n`);
      } else {
        clearThinking();
      }
    },

    getResult() {
      return result.trim();
    },
  };
}

/**
 * Get input stream for interactive use.
 * When stdin is a pipe, reads user input from /dev/tty.
 */
function getTTYInput() {
  if (process.stdin.isTTY) return process.stdin;
  try {
    const fd = fs.openSync('/dev/tty', 'r');
    return fs.createReadStream('', { fd });
  } catch {
    return process.stdin;
  }
}

/**
 * Ask the user whether to execute the command.
 * Returns 'run' | 'save' | 'edit' | 'cancel'
 */
export function confirmRun() {
  return new Promise((resolve) => {
    const input = getTTYInput();
    const rl = readline.createInterface({ input, output: process.stderr });
    const hint = `${DIM}${t('uiConfirm')}${RESET}`;
    rl.question(hint, (answer) => {
      rl.close();
      const a = answer.trim().toLowerCase();
      if (a === 'n' || a === 'no') return resolve('cancel');
      if (a === 'e' || a === 'edit') return resolve('edit');
      if (a === 's' || a === 'save') return resolve('save');
      resolve('run');
    });
  });
}

/**
 * Let the user edit the command.
 */
export function editCommand(cmd) {
  return new Promise((resolve) => {
    const input = getTTYInput();
    const rl = readline.createInterface({
      input,
      output: process.stderr,
      prompt: `${DIM}$ ${RESET}`,
    });
    rl.write(cmd);
    rl.prompt();
    rl.on('line', (line) => {
      rl.close();
      resolve(line.trim());
    });
  });
}
