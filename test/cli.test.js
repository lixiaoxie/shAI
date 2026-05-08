import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.join(__dirname, '..', 'bin', 'shai.js');

function run(args = '', options = {}) {
  try {
    // CLI outputs to stderr via console.error; redirect stderr to stdout to capture it
    const result = execSync(`node ${CLI} ${args} 2>&1`, {
      encoding: 'utf-8',
      timeout: 10000,
      ...options,
    });
    return { output: result, exitCode: 0 };
  } catch (e) {
    return { output: e.stdout || e.stderr || '', exitCode: e.status };
  }
}

describe('CLI', () => {
  it('--version outputs version string', () => {
    const { output, exitCode } = run('--version');
    assert.ok(output.includes('shAI v'), `Expected version string, got: ${output}`);
    assert.strictEqual(exitCode, 0);
  });

  it('-v outputs version string', () => {
    const { output } = run('-v');
    assert.ok(output.includes('shAI v'));
  });

  it('--help outputs help text', () => {
    const { output, exitCode } = run('--help');
    assert.ok(output.includes('Usage:') || output.includes('用法'));
    assert.strictEqual(exitCode, 0);
  });

  it('-h outputs help text', () => {
    const { output } = run('-h');
    assert.ok(output.includes('shai'));
  });

  it('no args shows help', () => {
    const { output, exitCode } = run('');
    assert.ok(output.includes('shai'));
    assert.strictEqual(exitCode, 0);
  });

  it('--config shows config info', () => {
    const { output, exitCode } = run('--config');
    assert.ok(output.length > 0);
    assert.strictEqual(exitCode, 0);
  });
});
