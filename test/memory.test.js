import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const MEMORY_FILE = path.join(os.homedir(), '.shai', 'memory.json');
let backup = null;

// Dynamic import to ensure backup is done first
let loadMemory, saveMemory, removeMemory, searchMemory, getMemorySummary, clearAllMemory, bumpUsage;

describe('memory', () => {
  before(async () => {
    // Backup existing memory file
    if (fs.existsSync(MEMORY_FILE)) {
      backup = fs.readFileSync(MEMORY_FILE, 'utf-8');
    }
    // Start with empty memory
    const dir = path.dirname(MEMORY_FILE);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(MEMORY_FILE, '[]', 'utf-8');

    const mod = await import('../src/memory.js');
    loadMemory = mod.loadMemory;
    saveMemory = mod.saveMemory;
    removeMemory = mod.removeMemory;
    searchMemory = mod.searchMemory;
    getMemorySummary = mod.getMemorySummary;
    clearAllMemory = mod.clearAllMemory;
    bumpUsage = mod.bumpUsage;
  });

  after(() => {
    // Restore original memory file
    if (backup !== null) {
      fs.writeFileSync(MEMORY_FILE, backup, 'utf-8');
    } else if (fs.existsSync(MEMORY_FILE)) {
      // If there was no file before, write empty array
      fs.writeFileSync(MEMORY_FILE, '[]', 'utf-8');
    }
  });

  it('loadMemory returns empty array initially', () => {
    clearAllMemory();
    const entries = loadMemory();
    assert.ok(Array.isArray(entries));
    assert.strictEqual(entries.length, 0);
  });

  it('saveMemory creates an entry with correct fields', () => {
    clearAllMemory();
    const id = saveMemory({ query: 'list files', command: 'ls -la' });
    assert.ok(typeof id === 'string');
    assert.ok(id.length > 0);
    const entries = loadMemory();
    assert.strictEqual(entries.length, 1);
    assert.strictEqual(entries[0].query, 'list files');
    assert.strictEqual(entries[0].command, 'ls -la');
    assert.strictEqual(entries[0].usageCount, 1);
    assert.ok(entries[0].createdAt);
  });

  it('saveMemory preserves tags and note', () => {
    clearAllMemory();
    saveMemory({ query: 'test', command: 'echo hi', tags: ['util'], note: 'a note' });
    const entries = loadMemory();
    assert.deepStrictEqual(entries[0].tags, ['util']);
    assert.strictEqual(entries[0].note, 'a note');
  });

  it('searchMemory returns all entries for empty keyword', () => {
    clearAllMemory();
    saveMemory({ query: 'foo', command: 'bar' });
    saveMemory({ query: 'baz', command: 'qux' });
    const results = searchMemory('');
    assert.strictEqual(results.length, 2);
  });

  it('searchMemory filters by keyword in query', () => {
    clearAllMemory();
    saveMemory({ query: 'find large files', command: 'find / -size +100M' });
    saveMemory({ query: 'list processes', command: 'ps aux' });
    const results = searchMemory('large');
    assert.strictEqual(results.length, 1);
    assert.ok(results[0].query.includes('large'));
  });

  it('searchMemory filters by keyword in command', () => {
    clearAllMemory();
    saveMemory({ query: 'disk usage', command: 'du -sh *' });
    saveMemory({ query: 'network', command: 'ifconfig' });
    const results = searchMemory('du');
    assert.strictEqual(results.length, 1);
  });

  it('removeMemory by 1-based index', () => {
    clearAllMemory();
    saveMemory({ query: 'a', command: 'cmd_a' });
    saveMemory({ query: 'b', command: 'cmd_b' });
    const removed = removeMemory('1');
    assert.strictEqual(removed, true);
    const entries = loadMemory();
    assert.strictEqual(entries.length, 1);
    assert.strictEqual(entries[0].query, 'b');
  });

  it('removeMemory by id', () => {
    clearAllMemory();
    const id = saveMemory({ query: 'x', command: 'cmd_x' });
    const removed = removeMemory(id);
    assert.strictEqual(removed, true);
    assert.strictEqual(loadMemory().length, 0);
  });

  it('removeMemory returns false for invalid index', () => {
    clearAllMemory();
    assert.strictEqual(removeMemory('99'), false);
  });

  it('bumpUsage increments usage count', () => {
    clearAllMemory();
    const id = saveMemory({ query: 'test', command: 'echo test' });
    bumpUsage(id);
    const entries = loadMemory();
    assert.strictEqual(entries[0].usageCount, 2);
  });

  it('getMemorySummary returns null for empty memory', () => {
    clearAllMemory();
    assert.strictEqual(getMemorySummary(), null);
  });

  it('getMemorySummary returns string with entries', () => {
    clearAllMemory();
    saveMemory({ query: 'disk check', command: 'df -h' });
    const summary = getMemorySummary();
    assert.ok(typeof summary === 'string');
    assert.ok(summary.includes('disk check'));
    assert.ok(summary.includes('df -h'));
  });

  it('clearAllMemory empties all entries', () => {
    saveMemory({ query: 'a', command: 'b' });
    saveMemory({ query: 'c', command: 'd' });
    clearAllMemory();
    assert.strictEqual(loadMemory().length, 0);
  });
});
