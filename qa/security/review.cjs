const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const secret = JSON.parse(fs.readFileSync(path.join(root, 'qa/artifacts/p10/secrets.json')));
const dependency = JSON.parse(fs.readFileSync(path.join(root, 'qa/artifacts/p10/dependencies.json')));
const dispositions = require('./dispositions.json');
if (new Date() > new Date(dispositions.reviewExpires)) throw Error('P10 dispositions require renewed review.');
if (!secret.currentFiles || dependency.packageCounts.length !== dependency.locks.length || dependency.packageCounts.some(p => p.packages === 0)) throw Error('Incomplete scan coverage');
const listed = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8', windowsHide: true });
if (listed.status !== 0) throw Error('Unable to verify source inventory');
const files = listed.stdout.split('\0').filter(Boolean);
for (const name of fs.readdirSync(path.join(root, 'docs QA'))) if (name.endsWith('.md')) files.push(`docs QA/${name}`);
const inventory = [...new Set(files)].filter(f => fs.existsSync(path.join(root, f)) && fs.statSync(path.join(root, f)).isFile()).sort();
if (JSON.stringify(inventory) !== JSON.stringify(Object.keys(secret.sourceHashes || {}))) throw Error('Source inventory changed; rerun secret scan');
for (const file of inventory) {
  const hash = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
  if (hash !== secret.sourceHashes[file]) throw Error('Source changed after scanning; rerun secret scan');
}
for (const file of dependency.locks) {
  const actual = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
  if (actual !== dependency.lockHashes[file]) throw Error('Lockfile changed after scanning; rerun scans.');
}
const unmatchedSecrets = secret.findings.filter(f => !dispositions.secrets.some(d => d.fingerprint === f.fingerprint && d.contentHash === f.contentHash));
const unmatchedDependencies = dependency.findings.flatMap(f => f.vulnerabilities.filter(v => !dispositions.dependencies.some(d =>
  d.file === f.file && d.package === f.package.name && d.version === f.package.version && d.id === v.id)).map(v => ({ file: f.file, package: f.package.name, id: v.id })));
const report = { reviewedOn: dispositions.reviewedOn, expires: dispositions.reviewExpires, secretFindings: secret.findings.length,
  vulnerablePackages: dependency.findings.length, dependencyAdvisories: dependency.findings.reduce((n,f) => n + f.vulnerabilities.length, 0),
  unmatchedSecrets: unmatchedSecrets.map(f => ({ file: f.file, rule: f.rule, line: f.line })), unmatchedDependencies };
fs.writeFileSync(path.join(root, 'qa/artifacts/p10/review.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
process.exitCode = unmatchedSecrets.length || unmatchedDependencies.length ? 1 : 0;
