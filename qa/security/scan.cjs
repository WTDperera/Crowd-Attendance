const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const cache = path.join(root, 'qa/.cache');
const artifacts = path.join(root, 'qa/artifacts/p10');
fs.mkdirSync(artifacts, { recursive: true });
const pins = require('./tools.json');
const mode = process.argv[2];
function run(binary, args) {
  const env = { ...process.env };
  delete env.GITLEAKS_CONFIG; delete env.GITLEAKS_CONFIG_TOML;
  const result = spawnSync(binary, args, { cwd: root, env, encoding: 'utf8', windowsHide: true, timeout: 300000, maxBuffer: 30 * 1024 * 1024 });
  // Never print scanner stdout/stderr or raw matches (even on failures).
  if (result.error || ![0, 1].includes(result.status)) {
    fs.writeFileSync(path.join(cache, 'p10-scanner-error.log'), result.stderr || String(result.error || result.status));
    throw Error('Scanner incomplete; inspect local ignored diagnostics.');
  }
  return result;
}
function verify(file, expected) {
  if (crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') !== expected) throw Error('Scanner checksum mismatch; run security/install.ps1');
}
const stamp = () => ({ observedAt: new Date().toISOString(), baseline: run('git', ['rev-parse', 'HEAD']).stdout.trim(), tools: pins });
if (mode === 'secrets') {
  verify(path.join(cache, 'security-tools/gitleaks.zip'), pins.gitleaks.sha256);
  const binary = path.join(cache, 'security-tools/gitleaks/gitleaks.exe');
  verify(binary, pins.gitleaks.binarySha256);
  const flags = ['--redact=100', '--no-banner', '--report-format=json', `--config=${path.join(__dirname, 'gitleaks.toml')}`, '--ignore-gitleaks-allow'];
  const inventory = run('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z']).stdout.split('\0').filter(Boolean);
  // Scan reviewable current files, including ignored local phase documents,
  // without traversing generated dependencies/builds/caches or ambient secrets.
  for (const name of fs.readdirSync(path.join(root, 'docs QA'))) if (name.endsWith('.md')) inventory.push(`docs QA/${name}`);
  const stage = fs.mkdtempSync(path.join(cache, 'p10-source-'));
  let current;
  try {
    for (const file of new Set(inventory)) {
      const source = path.resolve(root, file);
      if (!source.startsWith(root + path.sep) || !fs.existsSync(source) || !fs.statSync(source).isFile()) continue;
      const target = path.join(stage, file); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.copyFileSync(source, target);
    }
    const report = path.join(cache, 'p10-secrets-current.json');
    run(binary, ['dir', stage, ...flags, `--report-path=${report}`]);
    current = JSON.parse(fs.readFileSync(report));
  } finally { fs.rmSync(stage, { recursive: true, force: true }); }
  const historyFile = path.join(cache, 'p10-secrets-history.json');
  run(binary, ['git', root, '--log-opts=--all', ...flags, `--report-path=${historyFile}`]);
  const trim = (findings, source) => findings.map(f => {
    const file = source === 'current' ? path.relative(stage, f.File).replaceAll('\\', '/') : f.File;
    const content = source === 'current' ? fs.readFileSync(path.join(root, file), 'utf8') : run('git', ['show', `${f.Commit}:${file}`]).stdout;
    const line = content.split(/\r?\n/)[f.StartLine - 1] || '';
    // Hash the original finding line in memory; never emit the original value.
    return { source, rule: f.RuleID, file, line: f.StartLine, commit: f.Commit || null,
      contentHash: crypto.createHash('sha256').update(line.trim()).digest('hex'),
      fingerprint: `${f.Commit || 'current'}:${file}:${f.RuleID}:${f.StartLine}` };
  });
  const sourceHashes = Object.fromEntries([...new Set(inventory)].sort().filter(f => fs.existsSync(path.join(root, f)) && fs.statSync(path.join(root, f)).isFile())
    .map(f => [f, crypto.createHash('sha256').update(fs.readFileSync(path.join(root, f))).digest('hex')]));
  const report = { ...stamp(), currentFiles: Object.keys(sourceHashes).length, sourceHashes, findings: [...trim(current, 'current'), ...trim(JSON.parse(fs.readFileSync(historyFile)), 'history')] };
  fs.writeFileSync(path.join(artifacts, 'secrets.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ currentFiles: report.currentFiles, currentFindings: current.length, historyFindings: report.findings.length - current.length }));
  process.exitCode = report.findings.length ? 1 : 0;
} else if (mode === 'dependencies') {
  const binary = path.join(cache, 'security-tools/osv-scanner.exe'); verify(binary, pins.osv.sha256);
  const locks = ['qa/package-lock.json', 'web_app/admin-portal/server/package-lock.json', 'web_app/admin-portal/frontend/package-lock.json',
    'student_app/pubspec.lock', 'lecturer_app/pubspec.lock', 'web_app/pubspec.lock'];
  const raw = path.join(cache, 'p10-osv.json');
  run(binary, ['scan', 'source', ...locks.map(f => `--lockfile=${f}`), '--format=json', `--output-file=${raw}`, '--verbosity=error', '--all-packages']);
  const data = JSON.parse(fs.readFileSync(raw));
  const findings = (data.results || []).flatMap(r => (r.packages || []).filter(p => p.vulnerabilities?.length).map(p => ({ file: path.relative(root, r.source.path).replaceAll('\\', '/'),
    package: p.package, vulnerabilities: (p.vulnerabilities || []).map(v => ({ id: v.id, aliases: v.aliases, summary: v.summary,
      severity: v.severity, database_specific: v.database_specific, affected: v.affected?.map(a => ({ package: a.package, ranges: a.ranges })), references: v.references })) })));
  const report = { ...stamp(), locks, lockHashes: Object.fromEntries(locks.map(f => [f, crypto.createHash('sha256').update(fs.readFileSync(path.join(root, f))).digest('hex')])),
    packageCounts: (data.results || []).map(r => ({ file: path.relative(root, r.source.path).replaceAll('\\', '/'), packages: r.packages?.length || 0 })), findings };
  fs.writeFileSync(path.join(artifacts, 'dependencies.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ lockfiles: locks.length, vulnerablePackages: findings.length }));
  process.exitCode = findings.length ? 1 : 0;
} else throw Error('Expected secrets or dependencies');
