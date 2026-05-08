import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractCommands, commandExists, getInstallSuggestion } from '../src/commands.js';

describe('extractCommands', () => {
  it('extracts a single command', () => {
    assert.deepStrictEqual(extractCommands('ls -la'), ['ls']);
  });

  it('extracts commands from pipe chain', () => {
    const cmds = extractCommands('cat file.txt | grep foo | sort -u');
    assert.deepStrictEqual(cmds, ['cat', 'grep', 'sort']);
  });

  it('extracts commands from logical operators', () => {
    const cmds = extractCommands('mkdir -p dir && cd dir && touch file');
    assert.ok(cmds.includes('mkdir'));
    assert.ok(cmds.includes('cd'));
    assert.ok(cmds.includes('touch'));
  });

  it('skips sudo prefix', () => {
    assert.deepStrictEqual(extractCommands('sudo apt install vim'), ['apt']);
  });

  it('skips env prefix', () => {
    assert.deepStrictEqual(extractCommands('env NODE_ENV=production node app.js'), ['node']);
  });

  it('skips nohup and time prefixes', () => {
    const cmds = extractCommands('nohup node server.js');
    assert.deepStrictEqual(cmds, ['node']);
    const cmds2 = extractCommands('time make -j8');
    assert.deepStrictEqual(cmds2, ['make']);
  });

  it('skips environment variable assignments', () => {
    const cmds = extractCommands('LANG=C sort file.txt');
    assert.deepStrictEqual(cmds, ['sort']);
  });

  it('skips multiple env var assignments with prefix', () => {
    const cmds = extractCommands('sudo ENV=prod DEBUG=1 node index.js');
    assert.deepStrictEqual(cmds, ['node']);
  });

  it('ignores comment lines', () => {
    const cmds = extractCommands('# this is a comment\nls -la');
    assert.deepStrictEqual(cmds, ['ls']);
  });

  it('ignores path-style commands (absolute)', () => {
    const cmds = extractCommands('/usr/bin/python3 script.py');
    assert.deepStrictEqual(cmds, []);
  });

  it('ignores relative path commands', () => {
    const cmds = extractCommands('./build.sh');
    assert.deepStrictEqual(cmds, []);
  });

  it('ignores $-prefixed commands', () => {
    const cmds = extractCommands('$EDITOR file.txt');
    assert.deepStrictEqual(cmds, []);
  });

  it('deduplicates commands', () => {
    const cmds = extractCommands('echo hello | echo world');
    assert.deepStrictEqual(cmds, ['echo']);
  });

  it('handles multi-line commands', () => {
    const cmds = extractCommands('git add .\ngit commit -m "msg"\ngit push');
    assert.deepStrictEqual(cmds, ['git']);
  });

  it('handles semicolon-separated commands', () => {
    const cmds = extractCommands('cd /tmp; ls -la; pwd');
    assert.ok(cmds.includes('cd'));
    assert.ok(cmds.includes('ls'));
    assert.ok(cmds.includes('pwd'));
  });

  it('returns empty for empty string', () => {
    assert.deepStrictEqual(extractCommands(''), []);
  });

  it('returns empty for only comments', () => {
    assert.deepStrictEqual(extractCommands('# comment\n# another'), []);
  });
});

describe('commandExists', () => {
  it('returns true for known command (node)', () => {
    assert.strictEqual(commandExists('node'), true);
  });

  it('returns true for ls', () => {
    assert.strictEqual(commandExists('ls'), true);
  });

  it('returns false for nonexistent command', () => {
    assert.strictEqual(commandExists('this_command_does_not_exist_xyz_999'), false);
  });
});

describe('getInstallSuggestion', () => {
  it('returns brew/apt suggestion for known tools', () => {
    const suggestions = getInstallSuggestion('jq');
    assert.ok(suggestions.length > 0);
    assert.ok(suggestions[0].includes('jq'));
  });

  it('returns pip suggestion for python packages', () => {
    const suggestions = getInstallSuggestion('pytest');
    assert.ok(suggestions.some((s) => s.includes('pip install pytest')));
  });

  it('returns npm suggestion for node packages', () => {
    const suggestions = getInstallSuggestion('prettier');
    assert.ok(suggestions.some((s) => s.includes('npm install -g prettier')));
  });

  it('returns fallback search suggestion for unknown command', () => {
    const suggestions = getInstallSuggestion('totally_unknown_cmd');
    assert.ok(suggestions.length > 0);
    assert.ok(suggestions[0].includes('search'));
  });

  it('maps ripgrep correctly for rg', () => {
    const suggestions = getInstallSuggestion('rg');
    assert.ok(suggestions.some((s) => s.includes('ripgrep')));
  });

  it('maps neovim correctly for nvim', () => {
    const suggestions = getInstallSuggestion('nvim');
    assert.ok(suggestions.some((s) => s.includes('neovim')));
  });
});
