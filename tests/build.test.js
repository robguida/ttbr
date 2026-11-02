const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');

test('build leaves src/ops out of dist and still builds index.html', () => {
  execFileSync('node', [path.join(root, 'scripts', 'build.mjs')], { cwd: root });
  assert.ok(fs.existsSync(path.join(root, 'dist', 'index.html')));
  assert.ok(!fs.existsSync(path.join(root, 'dist', 'ops')));
  assert.ok(fs.existsSync(path.join(root, 'src', 'ops', 'analytics', 'extract.js')));
});
