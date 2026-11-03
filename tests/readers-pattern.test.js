const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const script = fs.readFileSync(path.join(root, 'src', 'ops', 'analytics', 'pull-report.sh'), 'utf8');
// Take the exact filter text that pull-report.sh sends to the box.
const re = name => new RegExp(new RegExp(`^${name}='(.*)'$`, 'm').exec(script)[1]);
const lines = fs.readFileSync(path.join(__dirname, 'fixtures', 'fake-access.log'), 'utf8').split('\n').filter(Boolean);

test('readers filter keeps pings answered 200 or 304 (not the 301, not .gif.php lookalikes)', () => {
  const hit = lines.filter(l => re('READERS_RE').test(l));
  assert.strictEqual(hit.length, 3);
  assert.ok(hit.every(l => /"GET \/v\/(home|norway)\.gif(\?\S*)? HTTP/.test(l) && / (200|304) /.test(l)));
  assert.ok(hit.some(l => / 304 /.test(l)));
  assert.ok(!hit.some(l => /\.gif\.php/.test(l)));
});

test('app.js filter keeps only app.js answered 200', () => {
  const hit = lines.filter(l => re('APPJS_RE').test(l));
  assert.strictEqual(hit.length, 2);
});

test('pull-report keeps the main file name, adds the new flags, holds no IPs', () => {
  assert.ok(script.includes('ttbr-$1-$DAY.html'));
  assert.ok(script.includes('pull visits '));
  assert.ok(/--ignore-status=301/.test(script) && /--unknowns-as-crawlers/.test(script));
  assert.ok(!/\b\d{1,3}(\.\d{1,3}){3}\b/.test(script));
});
