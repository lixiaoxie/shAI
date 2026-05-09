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

// Preset AI providers with OpenAI-compatible endpoints
const PROVIDERS = [
  { name: 'OpenAI',       url: 'https://api.openai.com/v1/chat/completions',                         model: 'gpt-4o-mini' },
  { name: 'DeepSeek',     url: 'https://api.deepseek.com/v1/chat/completions',                       model: 'deepseek-chat' },
  { name: 'Qwen (阿里通义)', url: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', model: 'qwen-max' },
  { name: 'Zhipu (智谱GLM)', url: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',             model: 'glm-4' },
  { name: 'Moonshot (Kimi)', url: 'https://api.moonshot.cn/v1/chat/completions',                       model: 'moonshot-v1-8k' },
  { name: 'MiniMax',      url: 'https://api.minimax.chat/v1/chat/completions',                       model: 'abab5.5-chat' },
  { name: 'MiMo (小米)',   url: 'https://api.xiaomimimo.com/v1/chat/completions',                     model: 'mimo-v2-pro' },
  { name: 'Groq',         url: 'https://api.groq.com/openai/v1/chat/completions',                    model: 'llama-3.3-70b-versatile' },
  { name: 'Together AI',  url: 'https://api.together.xyz/v1/chat/completions',                       model: 'meta-llama/Llama-3-70b-chat-hf' },
  { name: 'Mistral',      url: 'https://api.mistral.ai/v1/chat/completions',                         model: 'mistral-large-latest' },
  { name: 'Ollama (本地)',  url: 'http://localhost:11434/v1/chat/completions',                          model: 'llama3' },
];

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

  // Show provider list
  console.error(t('configSelectProvider'));
  PROVIDERS.forEach((p, i) => {
    console.error(`  ${i + 1}. ${p.name}  (${p.model})`);
  });
  console.error(`  0. ${t('configCustomProvider')}\n`);

  const choice = await ask(rl, `${t('configProviderPrompt')} [0]: `, '0');
  const idx = parseInt(choice, 10);

  let api_url, model;
  if (idx >= 1 && idx <= PROVIDERS.length) {
    const provider = PROVIDERS[idx - 1];
    api_url = provider.url;
    model = provider.model;
    console.error(`\n✅ ${provider.name}: ${api_url}`);
    const customModel = await ask(rl, `${t('configModel')} [${model}]: `, model);
    model = customModel;
  } else {
    const maskedUrl = existing.api_url ? maskConfigUrl(existing.api_url) : t('configNotSet');
    api_url = await ask(rl, `${t('configApiUrl')} [${maskedUrl}]: `, existing.api_url);
    model = await ask(rl, `${t('configModel')} [${existing.model}]: `, existing.model);
  }

  const maskedKey = existing.api_key ? '****' + existing.api_key.slice(-4) : t('configNotSet');
  const api_key = await ask(rl, `${t('configApiKey')} [${maskedKey}]: `, existing.api_key);
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
