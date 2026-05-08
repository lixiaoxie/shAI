import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getTerminalContext } from '../src/context.js';

describe('context', () => {
  it('getTerminalContext returns string or null', () => {
    const ctx = getTerminalContext();
    assert.ok(ctx === null || typeof ctx === 'string');
  });

  it('getTerminalContext accepts maxLines parameter', () => {
    // Should not throw
    const ctx = getTerminalContext(10);
    assert.ok(ctx === null || typeof ctx === 'string');
  });

  it('getTerminalContext with 0 lines returns string or null', () => {
    const ctx = getTerminalContext(0);
    assert.ok(ctx === null || typeof ctx === 'string');
  });
});
