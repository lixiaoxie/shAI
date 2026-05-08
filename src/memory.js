import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const MEMORY_FILE = path.join(os.homedir(), '.shai', 'memory.json');

/**
 * 记忆条目格式：
 * { id, query, command, tags, note, createdAt, usageCount }
 */

export function loadMemory() {
  try {
    if (!fs.existsSync(MEMORY_FILE)) return [];
    return JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function saveMemoryData(entries) {
  const dir = path.dirname(MEMORY_FILE);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(entries, null, 2) + '\n', 'utf-8');
}

export function clearAllMemory() {
  saveMemoryData([]);
}

/**
 * 保存一条记忆（用户主动保存或执行后自动记录）。
 */
export function saveMemory({ query, command, tags = [], note = '' }) {
  const entries = loadMemory();
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  entries.push({
    id,
    query,
    command,
    tags,
    note,
    createdAt: new Date().toISOString(),
    usageCount: 1,
  });
  saveMemoryData(entries);
  return id;
}

/**
 * 增加使用次数。
 */
export function bumpUsage(id) {
  const entries = loadMemory();
  const entry = entries.find((e) => e.id === id);
  if (entry) {
    entry.usageCount = (entry.usageCount || 0) + 1;
    saveMemoryData(entries);
  }
}

/**
 * 删除记忆。
 */
export function removeMemory(idOrIndex) {
  const entries = loadMemory();
  let idx = parseInt(idOrIndex, 10);
  if (isNaN(idx)) {
    idx = entries.findIndex((e) => e.id === idOrIndex);
  } else {
    idx -= 1; // 用户输入从 1 开始
  }
  if (idx < 0 || idx >= entries.length) return false;
  entries.splice(idx, 1);
  saveMemoryData(entries);
  return true;
}

/**
 * 搜索记忆（简单关键词匹配）。
 */
export function searchMemory(keyword) {
  const entries = loadMemory();
  if (!keyword) return entries;
  const kw = keyword.toLowerCase();
  return entries.filter(
    (e) =>
      e.query.toLowerCase().includes(kw) ||
      e.command.toLowerCase().includes(kw) ||
      (e.note && e.note.toLowerCase().includes(kw)) ||
      (e.tags && e.tags.some((t) => t.toLowerCase().includes(kw)))
  );
}

/**
 * 获取记忆摘要（传给 AI 作为上下文）。
 * 优先返回使用频率高和最近使用的条目。
 */
export function getMemorySummary(maxEntries = 15) {
  const entries = loadMemory();
  if (entries.length === 0) return null;

  // 按使用次数降序，再按创建时间降序
  const sorted = [...entries].sort((a, b) => {
    if (b.usageCount !== a.usageCount) return b.usageCount - a.usageCount;
    return b.createdAt.localeCompare(a.createdAt);
  });

  const top = sorted.slice(0, maxEntries);
  const lines = top.map((e) => {
    let line = `  "${e.query}" → ${e.command}`;
    if (e.note) line += ` (${e.note})`;
    return line;
  });

  return 'Saved recipes (user\'s preferred commands):\n' + lines.join('\n');
}
