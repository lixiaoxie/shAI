import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setLanguage, getLanguage, t, getHelpText } from '../src/i18n.js';

describe('setLanguage / getLanguage', () => {
  beforeEach(() => setLanguage('en'));

  it('defaults to en', () => {
    assert.strictEqual(getLanguage(), 'en');
  });

  it('switches to zh', () => {
    setLanguage('zh');
    assert.strictEqual(getLanguage(), 'zh');
  });

  it('switches back to en', () => {
    setLanguage('zh');
    setLanguage('en');
    assert.strictEqual(getLanguage(), 'en');
  });

  it('falls back to en for invalid language', () => {
    setLanguage('fr');
    assert.strictEqual(getLanguage(), 'en');
  });

  it('falls back to en for null', () => {
    setLanguage(null);
    assert.strictEqual(getLanguage(), 'en');
  });
});

describe('t() translation', () => {
  beforeEach(() => setLanguage('en'));

  it('returns English text for known key', () => {
    assert.strictEqual(t('uiCancelled'), 'Cancelled.');
  });

  it('returns Chinese text when lang is zh', () => {
    setLanguage('zh');
    assert.strictEqual(t('uiCancelled'), '已取消。');
  });

  it('substitutes template variables', () => {
    const result = t('uiCmdNotFound', { cmd: 'jq' });
    assert.ok(result.includes('jq'));
    assert.ok(!result.includes('{cmd}'));
  });

  it('substitutes multiple variables', () => {
    const result = t('memCleared', { n: 5 });
    assert.ok(result.includes('5'));
  });

  it('returns the key itself for missing key', () => {
    assert.strictEqual(t('nonExistentKey'), 'nonExistentKey');
  });

  it('handles empty vars gracefully', () => {
    const result = t('uiCancelled', {});
    assert.strictEqual(result, 'Cancelled.');
  });
});

describe('getHelpText', () => {
  beforeEach(() => setLanguage('en'));

  it('returns a string', () => {
    const help = getHelpText('1.0.0');
    assert.strictEqual(typeof help, 'string');
  });

  it('includes version number', () => {
    const help = getHelpText('1.2.3');
    assert.ok(help.includes('1.2.3'));
  });

  it('includes usage section', () => {
    const help = getHelpText('1.0.0');
    assert.ok(help.includes('Usage:'));
  });

  it('includes examples section', () => {
    const help = getHelpText('1.0.0');
    assert.ok(help.includes('Examples:'));
  });

  it('includes options section', () => {
    const help = getHelpText('1.0.0');
    assert.ok(help.includes('Options:'));
  });

  it('returns Chinese help when lang is zh', () => {
    setLanguage('zh');
    const help = getHelpText('1.0.0');
    assert.ok(help.includes('用法：'));
    assert.ok(help.includes('示例：'));
  });
});
