const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const script = path.join(root, 'src', 'ops', 'analytics', 'extract.js');
const fixture = path.join(__dirname, 'fixtures', 'fake-report.html');

test('extract keeps only exact /v/<slug>.gif hits and survives bad items', t => {
  const out = (fs.mkdirSync(path.join(root, 'analytics', 'test-tmp'), { recursive: true }), fs.mkdtempSync(path.join(root, 'analytics', 'test-tmp', 'ttbr-extract-')));
  t.after(() => fs.rmSync(out, { recursive: true, force: true }));
  execFileSync('node', [script, fixture, out]);
  const read = n => JSON.parse(fs.readFileSync(path.join(out, n), 'utf8'));
  const pages = read('top-pages.json');
  assert.deepStrictEqual(pages.map(p => p.page), ['Norway: fjords, Oslo, Bergen, and Nigardsbreen', 'Home', 'Blog']);
  assert.strictEqual(pages[0].views, 4);
  assert.deepStrictEqual(read('referring-sites.json'), [{ site: 'www.google.com', visitors: 4 }]);
  assert.deepStrictEqual(read('visits-by-day.json').map(d => d.day), ['2026-10-31', '2026-11-01']);
  assert.strictEqual(read('browsers.json')[0].name, 'Chrome');
  assert.strictEqual(read('operating-systems.json')[0].name, 'Windows');
  const s = read('summary.json');
  assert.strictEqual(s.start, '20261025');
  assert.ok(s.failures.length >= 2);
  const all = fs.readdirSync(out).map(f => fs.readFileSync(path.join(out, f), 'utf8')).join('');
  assert.ok(!/wp-login|\b\d{1,3}(\.\d{1,3}){3}\b|\.pem|<script|:\/\//.test(all));
  for (const n of ['readers-by-day.json', 'sources.json', 'not-found.json']) assert.ok(fs.existsSync(path.join(out, n)), n);
});
