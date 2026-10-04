const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
test('P10 pinned secret scanner detects a generated synthetic canary and redacts its report', () => {
  const dir = fs.mkdtempSync(path.join(root, 'qa/.cache/p10-canary-'));
  const value = 'ghp_' + crypto.randomBytes(20).toString('hex');
  try {
    fs.writeFileSync(path.join(dir, 'synthetic.txt'), `token = "${value}"`);
    const report = path.join(dir, 'report.json');
    const result = spawnSync(path.join(root, 'qa/.cache/security-tools/gitleaks/gitleaks.exe'), ['dir', dir,
      '--redact=100', '--no-banner', `--config=${path.join(__dirname, 'gitleaks.toml')}`, '--report-format=json', `--report-path=${report}`], { encoding: 'utf8', windowsHide: true });
    assert.equal(result.status, 1);
    const raw = fs.readFileSync(report, 'utf8'); assert.equal(raw.includes(value), false);
    assert.equal(JSON.parse(raw).some(f => f.RuleID === 'github-pat'), true);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
test('P10 load rejects conflicting remote selectors and extra parameters before contacting services', () => {
  for (const [args, env] of [[[], { GCLOUD_PROJECT: 'live-project' }], [['http://example.com'], {}], [[], { FIRESTORE_EMULATOR_HOST: 'example.com:8080' }], [[], { QA_MODE: '' }]]) {
    const result = spawnSync(process.execPath, [path.join(root, 'qa/load/run.cjs'), ...args], { cwd: root, encoding: 'utf8', windowsHide: true, env: { ...process.env, ...env } });
    assert.notEqual(result.status, 0); assert.match(result.stderr, /Refusing conflicting|accepts no arguments|Explicit QA environment required/);
  }
});
test('P10 reviewed dispositions cover explicit findings and unchanged lockfiles', () => {
  const result = spawnSync(process.execPath, [path.join(__dirname, 'review.cjs')], { cwd: root, encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 0); const report = JSON.parse(result.stdout);
  assert.equal(report.unmatchedSecrets.length, 0); assert.equal(report.unmatchedDependencies.length, 0);
  assert.ok(report.dependencyAdvisories > 0);
});
test('P10 disposition review fails on a new secret finding instead of silently accepting it', () => {
  const file = path.join(root, 'qa/artifacts/p10/secrets.json'); const original = fs.readFileSync(file);
  try {
    const report = JSON.parse(original); report.findings.push({ fingerprint: 'synthetic-unreviewed', contentHash: 'synthetic', file: 'canary', rule: 'synthetic', line: 1 });
    fs.writeFileSync(file, JSON.stringify(report));
    const result = spawnSync(process.execPath, [path.join(__dirname, 'review.cjs')], { cwd: root, encoding: 'utf8', windowsHide: true });
    assert.equal(result.status, 1); assert.equal(JSON.parse(result.stdout).unmatchedSecrets.length, 1);
  } finally { fs.writeFileSync(file, original); }
});
