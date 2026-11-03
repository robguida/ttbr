const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { parseJsonData, assertNoLeaks } = require('../src/ops/analytics/extract.js');

const root = path.resolve(__dirname, '..');
const script = path.join(root, 'src', 'ops', 'analytics', 'extract.js');
const fx = n => path.join(__dirname, 'fixtures', n);

function tmpDir(t) {
  const base = path.join(root, 'analytics', 'test-tmp');
  fs.mkdirSync(base, { recursive: true });
  const dir = fs.mkdtempSync(path.join(base, 'ttbr-readers-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

// withExtras: true = both extra reports; false = none; or an array of [readersPath, appjsPath] (null = skip).
function run(t, withExtras, main = fx('fake-main-report.html')) {
  const out = tmpDir(t);
  const args = [script, main, out];
  if (withExtras === true) args.push(fx('fake-readers-report.html'), fx('fake-appjs-report.html'));
  else if (Array.isArray(withExtras)) args.push(withExtras[0] || '/no/such/readers.html', withExtras[1] || '/no/such/appjs.html');
  execFileSync('node', args);
  return { out, read: n => JSON.parse(fs.readFileSync(path.join(out, n), 'utf8')) };
}

// A main report copy with extra crafted items added to the named panels.
function craftedMain(t, add) {
  const data = parseJsonData(fs.readFileSync(fx('fake-main-report.html'), 'utf8'));
  for (const [panel, items] of Object.entries(add)) data[panel].data.push(...items);
  const f = path.join(tmpDir(t), 'ttbr-visits-crafted.html');
  fs.writeFileSync(f, '<html><script>var json_data=' + JSON.stringify(data) + ';</script></html>');
  return f;
}

test('readers: pings from 2026-11-02, backfill before, with the range', t => {
  const { read } = run(t, true);
  assert.deepStrictEqual(read('readers-by-day.json'), [
    { day: '2026-10-31', low: 7, high: 7, source: 'backfill' },
    { day: '2026-11-01', low: 4, high: 4, source: 'backfill' },
    { day: '2026-11-02', low: 4, high: 5, source: 'ping' },
    { day: '2026-11-03', low: 6, high: 6, source: 'ping' }
  ]);
  const s = read('summary.json');
  assert.deepStrictEqual(s.readers, { low: 21, high: 22 });
  assert.strictEqual(s.visitorDays, 33);
  assert.deepStrictEqual(s.window, { from: '2026-10-31', to: '2026-11-03' });
});

test('range is null without the extra reports; old files still written', t => {
  const { read } = run(t, false);
  assert.strictEqual(read('summary.json').readers, null);
  assert.strictEqual(read('visits-by-day.json').length, 4);
});

test('sources are grouped, merged, and add up to visitor-days', t => {
  const { read } = run(t, true);
  const rows = read('sources.json');
  const get = s => rows.find(r => r.source === s);
  assert.deepStrictEqual(get('Google'), { group: 'Search', source: 'Google', visitors: 9 });
  assert.deepStrictEqual(get('Facebook'), { group: 'Social', source: 'Facebook', visitors: 6 });
  assert.strictEqual(get('example.org').group, 'Other sites');
  assert.deepStrictEqual(get('Other app'), { group: 'Other sites', source: 'Other app', visitors: 5 });
  assert.strictEqual(get('No source shown (direct / bookmark / app)').visitors, 10);
  assert.strictEqual(rows.reduce((n, r) => n + r.visitors, 0), 33);
  assert.ok(!rows.some(r => /travelthebackroads|chatapp|350685531728|junk/.test(r.source)));
});

test('missing files: our own by path, every other 404 is one bot-probe count', t => {
  const { read } = run(t, true);
  const nf = read('not-found.json');
  assert.deepStrictEqual(nf.filter(f => f.kind === "file").map(f => [f.path, f.hits]), [
    ['/favicon.ico', 137], ['/sitemap.xml', 5], ['/assets/missing.jpg', 4], ['/robots.txt', 3],
    ['/apple-touch-icon.png', 2], ['/v/gone.gif', 1]
  ]);
  assert.deepStrictEqual(nf[nf.length - 1], { path: "Robot probes (all other missing files)", hits: 12, kind: "probes" });
});

test('leak check: no IPs, tags, URLs or probe paths in any output file', t => {
  const { out } = run(t, true);
  const names = fs.readdirSync(out);
  for (const n of ['readers-by-day.json', 'sources.json', 'not-found.json', 'summary.json']) assert.ok(names.includes(n), n);
  for (const n of names) {
    const body = fs.readFileSync(path.join(out, n), 'utf8');
    assert.ok(!/\b\d{1,3}(\.\d{1,3}){3}\b|:\/\/|<|\.pem|wp-login|passwd|FakeBrowser/.test(body), n);
  }
});

test('readers report missing but app.js present: ping days are null, not 0', t => {
  const { read } = run(t, [null, fx('fake-appjs-report.html')]);
  const rows = read('readers-by-day.json');
  assert.deepStrictEqual(rows.slice(0, 2).map(r => [r.low, r.high]), [[7, 7], [4, 4]]);
  for (const r of rows.slice(2)) assert.deepStrictEqual([r.low, r.high, r.source], [null, null, 'none']);
});

test('crafted 404 paths and referrers cannot block the refresh; they land in probes / Other app', t => {
  const main = craftedMain(t, {
    not_found: [{ data: '/assets/wp-login.php', hits: { count: 3 } }, { data: '/v/x.pem', hits: { count: 2 } },
      { data: '/assets/.env', hits: { count: 4 } }, { data: '/assets/203.0.113.9.png', hits: { count: 1 } }],
    referring_sites: [{ data: '203.0.113.9.example.com', visitors: { count: 3 } }, { data: 'wp-login.example.com', visitors: { count: 2 } }],
    browsers: [{ data: 'Evil<script>', visitors: { count: 1 } }]
  });
  const { read, out } = run(t, true, main);
  const nf = read('not-found.json');
  assert.deepStrictEqual(nf[nf.length - 1], { path: 'Robot probes (all other missing files)', hits: 12 + 3 + 2 + 4 + 1, kind: 'probes' });
  assert.ok(!nf.some(f => /env|pem|wp-login|203/.test(f.path)));
  assert.deepStrictEqual(read('sources.json').find(r => r.source === 'Other app'), { group: 'Other sites', source: 'Other app', visitors: 5 + 3 + 2 });
  assert.ok(!read('referring-sites.json').some(r => /203|wp-login/.test(r.site)));
  assert.ok(!read('browsers.json').some(r => /script/.test(r.name)));
  assert.ok(fs.existsSync(path.join(out, 'summary.json')));
});

test('assertNoLeaks is still the backstop: it throws on a bad value', () => {
  for (const bad of ['10.1.2.3', 'http://x.example', '<b>', 'k.pem', '/wp-login.php'])
    assert.throws(() => assertNoLeaks({ 'x.json': [{ v: bad }] }), /leak check/, bad);
  assert.doesNotThrow(() => assertNoLeaks({ 'x.json': [{ v: 'fine' }] }));
});

test('own missing files list only real asset extensions', t => {
  const main = craftedMain(t, { not_found: [{ data: '/assets/notes.php', hits: { count: 2 } }, { data: '/assets/.env', hits: { count: 1 } }, { data: '/assets/site.webmanifest', hits: { count: 1 } }] });
  const nf = run(t, true, main).read('not-found.json');
  assert.ok(nf.some(f => f.path === '/assets/site.webmanifest'));
  assert.ok(!nf.some(f => /php|env/.test(f.path)));
  assert.strictEqual(nf[nf.length - 1].hits, 12 + 3);
});

test('a corrupt extra report is skipped, noted in failures, and the main outputs are still written', t => {
  const bad = path.join(tmpDir(t), 'corrupt.html');
  fs.writeFileSync(bad, '<html>not a report');
  const { read, out } = run(t, [bad, fx('fake-appjs-report.html')]);
  assert.ok(read('summary.json').failures.includes('readers report could not be read'));
  assert.strictEqual(read('visits-by-day.json').length, 4);
  for (const n of ['sources.json', 'not-found.json', 'readers-by-day.json']) assert.ok(fs.existsSync(path.join(out, n)), n);
  assert.strictEqual(read('readers-by-day.json')[3].low, null);
});
