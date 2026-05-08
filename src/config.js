import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import readline from 'node:readline';
import { t } from './i18n.js';

export const CONFIG_DIR = path.join(os.homedir(), '.shai');
export const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

const DEFAULT_CONFIG = {
  api_url: 'https://api.openai.com/v1/chat/completions',
  api_key: '',
  model: 'gpt-4o-mini',
  lang: 'en',
};

export function loadConfig() {
  if (!fs.existsSync(CONFIG_FILE)) return null;
  try {
    return { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8')) };
  } catch {
    return null;
  }
}

export function saveConfig(cfg) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2) + '\n', 'utf-8');
}

function ask(rl, question, fallback = '') {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim() || fallback));
  });
}

export async function setupInteractive() {
  const existing = loadConfig() || DEFAULT_CONFIG;
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr });

  console.error(`\n${t('configTitle')}\n`);

  const maskedUrl = existing.api_url ? maskConfigUrl(existing.api_url) : t('configNotSet');
  const maskedKey = existing.api_key ? '****' + existing.api_key.slice(-4) : t('configNotSet');
  const api_url = await ask(rl, `${t('configApiUrl')} [${maskedUrl}]: `, existing.api_url);
  const api_key = await ask(rl, `${t('configApiKey')} [${maskedKey}]: `, existing.api_key);
  const model = await ask(rl, `${t('configModel')} [${existing.model}]: `, existing.model);
  const lang = await ask(rl, `${t('configLang')} (zh/en) [${existing.lang}]: `, existing.lang);

  rl.close();

  const cfg = { api_url, api_key, model, lang: lang === 'zh' ? 'zh' : 'en' };
  saveConfig(cfg);
  console.error(`\n${t('configSaved')} ${CONFIG_FILE}\n`);
  return cfg;
}

function maskConfigUrl(url) {
  try {
    const u = new URL(url);
    return `${u.protocol}//****${u.pathname}`;
  } catch {
    return '****';
  }
}
