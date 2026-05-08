import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const CONFIG_FILE = path.join(os.homedir(), '.shai', 'config.json');
let backup = null;

let loadConfig, saveConfig, CONFIG_DIR;

describe('config', () => {
  before(async () => {
    if (fs.existsSync(CONFIG_FILE)) {
      backup = fs.readFileSync(CONFIG_FILE, 'utf-8');
    }
    const mod = await import('../src/config.js');
    loadConfig = mod.loadConfig;
    saveConfig = mod.saveConfig;
    CONFIG_DIR = mod.CONFIG_DIR;
  });

  after(() => {
    if (backup !== null) {
      fs.writeFileSync(CONFIG_FILE, backup, 'utf-8');
    }
  });

  it('saveConfig creates config file', () => {
    const cfg = { api_url: 'http://test', api_key: 'key123', model: 'gpt-4', lang: 'en' };
    saveConfig(cfg);
    assert.ok(fs.existsSync(CONFIG_FILE));
  });

  it('loadConfig reads saved config', () => {
    const cfg = { api_url: 'http://example.com', api_key: 'abc', model: 'test-model', lang: 'zh' };
    saveConfig(cfg);
    const loaded = loadConfig();
    assert.strictEqual(loaded.api_url, 'http://example.com');
    assert.strictEqual(loaded.api_key, 'abc');
    assert.strictEqual(loaded.model, 'test-model');
    assert.strictEqual(loaded.lang, 'zh');
  });

  it('loadConfig returns null for missing file', () => {
    if (fs.existsSync(CONFIG_FILE)) fs.unlinkSync(CONFIG_FILE);
    const loaded = loadConfig();
    assert.strictEqual(loaded, null);
    // Restore for subsequent tests
    if (backup !== null) fs.writeFileSync(CONFIG_FILE, backup, 'utf-8');
  });

  it('loadConfig merges with defaults', () => {
    saveConfig({ api_key: 'mykey' });
    const loaded = loadConfig();
    // Should have default api_url even though we only saved api_key
    assert.ok(loaded.api_url);
    assert.strictEqual(loaded.api_key, 'mykey');
  });

  it('CONFIG_DIR points to ~/.shai', () => {
    assert.strictEqual(CONFIG_DIR, path.join(os.homedir(), '.shai'));
  });
});
