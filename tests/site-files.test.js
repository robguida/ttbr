const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p));

test('robots.txt allows everyone, blocks named bots, leaks no private paths', () => {
  const txt = read('src', 'robots.txt').toString();
  const groups = txt.trim().split(/\n\s*\n/);
  assert.match(groups[0], /User-agent: \*\s+Allow: \//);
  const bots = ['GPTBot', 'ClaudeBot', 'CCBot', 'Bytespider', 'Google-Extended', 'Applebot-Extended', 'AhrefsBot', 'SemrushBot', 'MJ12bot', 'DotBot'];
  for (const b of bots) assert.ok(groups[1].includes(`User-agent: ${b}`), b);
  assert.match(groups[1], /Disallow: \/\s*$/);
  assert.ok(!/sitemap/i.test(txt));
  assert.ok(!/\/(ops|analytics|v)\b/i.test(txt));
  assert.ok(!/^\s*Disallow:\s*\/(ops|analytics|v)\b/im.test(txt));
});

test('favicon.ico has a valid ICO header and image entries', () => {
  const b = read('src', 'favicon.ico');
  assert.strictEqual(b.readUInt16LE(0), 0);
  assert.strictEqual(b.readUInt16LE(2), 1);
  const n = b.readUInt16LE(4);
  assert.ok(n >= 1);
  for (let i = 0; i < n; i++) {
    const size = b.readUInt32LE(6 + i * 16 + 8), off = b.readUInt32LE(6 + i * 16 + 12);
    assert.ok(off + size <= b.length);
    assert.strictEqual(b.subarray(off, off + 4).toString('hex'), '89504e47');
  }
});

test('index.html links the icon by absolute path', () => {
  assert.match(read('src', 'index.html').toString(), /<link rel="icon" href="\/favicon\.ico">/);
});
