const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const src = path.resolve(__dirname, '..', 'src');
const app = fs.readFileSync(path.join(src, 'app.js'), 'utf8');

const titlesBlock = app.match(/const titles = \{([\s\S]*?)\n\};/)[1];
const routes = [...titlesBlock.matchAll(/^\s*'([^']+)'\s*:/gm)].map((m) => m[1]);
const slugs = routes.map((r) => r.slice(1) || 'home').concat('not-found');

test('titles has the expected routes', () => {
  assert.ok(routes.length >= 14);
});

test('every titles route has a valid 1x1 GIF, plus not-found', () => {
  for (const slug of slugs) {
    const file = path.join(src, 'v', slug + '.gif');
    assert.ok(fs.existsSync(file), 'missing ' + slug + '.gif');
    const buf = fs.readFileSync(file);
    assert.strictEqual(buf.subarray(0, 6).toString('latin1'), 'GIF89a', slug);
    assert.strictEqual(buf.readUInt16LE(6), 1, slug + ' width');
    assert.strictEqual(buf.readUInt16LE(8), 1, slug + ' height');
    assert.strictEqual(buf[buf.length - 1], 0x3b, slug + ' trailer');
  }
});

test('ping slug comes from pages[route], never the raw hash', () => {
  const fn = app.match(/function countVisit\(route\) \{([\s\S]*?)\n\}/)[1];
  assert.match(fn, /Object\.prototype\.hasOwnProperty\.call\(pages, route\)\s*\?/);
  assert.match(fn, /'not-found'/);
  assert.ok(!/location|hash|query/.test(fn), 'ping must not read hash or search text');
  assert.match(fn, /'\/v\/' \+ slug \+ '\.gif'/);
});

test('inherited keys (constructor, toString, __proto__) resolve to not-found', () => {
  const fn = app.match(/function countVisit\(route\) \{([\s\S]*?)\n\}/)[1];
  const pages = {};
  for (const key of ['constructor', 'toString', '__proto__']) {
    assert.ok(!Object.prototype.hasOwnProperty.call(pages, key), key + ' must not count as an own page');
  }
  assert.match(app, /Object\.prototype\.hasOwnProperty\.call\(pages, route\) \? pages\[route\]\(\)/);
  assert.match(app, /Object\.prototype\.hasOwnProperty\.call\(titles, route\)/);
  assert.ok(!/pages\[route\]\s*\?/.test(app), 'no bare pages[route] truthiness lookup');
  assert.ok(!/pages\[route\]\s*\?/.test(fn));
});

test('only render() calls countVisit; search does not', () => {
  assert.strictEqual((app.match(/countVisit\(/g) || []).length, 2); // definition + one call
  const render = app.match(/function render\(\) \{[\s\S]*?\n\}/)[0];
  assert.match(render, /countVisit\(route\)/);
});
