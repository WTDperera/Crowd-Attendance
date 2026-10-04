const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const { qaEnvironment } = require('./environment.cjs');

const root = path.resolve(__dirname, '../..');
const qaDir = path.join(root, 'qa');
const configured = qaEnvironment();
// Firebase's debug log can include the child environment. Pass only OS/runtime
// requirements and explicit QA selectors, never ambient tokens or credentials.
const allowed = /^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|USERPROFILE|HOME|APPDATA|LOCALAPPDATA|PROGRAMDATA|JAVA_HOME|LANG|LC_ALL|QA_MODE|GCLOUD_PROJECT|GOOGLE_CLOUD_PROJECT|FIREBASE_PROJECT_ID|FIREBASE_AUTH_EMULATOR_HOST|FIRESTORE_EMULATOR_HOST|VITE_QA_MODE|VITE_QA_PROJECT_ID|VITE_QA_HOST|VITE_API_BASE_URL|FIREBASE_CLI_DISABLE_UPDATE_CHECK)$/i;
const env = Object.fromEntries(Object.entries(configured).filter(([key]) => allowed.test(key)));
// Firebase emulator downloads stay in this workspace, not a global cache.
env.FIREBASE_EMULATORS_PATH = path.join(qaDir, '.cache/emulators');
env.XDG_CONFIG_HOME = path.join(qaDir, '.cache/config'); // Isolate CLI login/preferences too.
env.CI = 'true'; // Noninteractive CLI; skip remote MOTD/update checks.
if (['emulators', 'smoke', 'security', 'access', 'rounds'].includes(process.argv[2])) {
  // Firebase requires rules inside its config root. Refresh from the actual
  // application rules on EVERY launch; never maintain permissive QA rules.
  fs.mkdirSync(path.join(qaDir, '.cache'), { recursive: true });
  fs.copyFileSync(path.join(root, 'web_app/admin-portal/firestore.rules'), path.join(qaDir, '.cache/firestore.rules'));
}
const firebaseCli = path.join(qaDir, 'node_modules/firebase-tools/lib/bin/firebase.js');
const viteCli = path.join(root, 'web_app/admin-portal/frontend/node_modules/vite/bin/vite.js');
const common = ['--config', path.join(qaDir, 'firebase.qa.json'), '--project', env.GCLOUD_PROJECT, '--only', 'auth,firestore'];
const actions = {
  emulators: { args: [firebaseCli, 'emulators:start', ...common] },
  smoke: { args: [firebaseCli, 'emulators:exec', ...common, 'node scripts/smoke.cjs'] },
  security: { args: [firebaseCli, 'emulators:exec', ...common, 'node scripts/smoke.cjs security'] },
  access: { args: [firebaseCli, 'emulators:exec', ...common, 'node scripts/smoke.cjs access'] },
  rounds: { args: [firebaseCli, 'emulators:exec', ...common, 'node scripts/smoke.cjs rounds'] },
  'round-rules': { args: ['--test', 'tests/round-security.test.cjs'] },
  seed: { args: [path.join(__dirname, 'fixtures.cjs'), 'seed'] },
  'p04-fixture': { args: [path.join(__dirname, 'p04-mobile-fixture.cjs')] },
  reset: { args: [path.join(__dirname, 'fixtures.cjs'), 'reset'] },
  api: { args: [path.join(root, 'web_app/admin-portal/server/index.js')] },
  web: { args: [viteCli, '--mode', 'qa', '--host', '127.0.0.1'], cwd: path.join(root, 'web_app/admin-portal/frontend') },
  'build-web': { args: [viteCli, 'build', '--mode', 'qa'], cwd: path.join(root, 'web_app/admin-portal/frontend') },
};
const action = actions[process.argv[2]];
if (!action) throw new Error('Expected emulators, smoke, security, access, rounds, round-rules, seed, p04-fixture, reset, api, web or build-web');
const child = spawn(process.execPath, action.args, { cwd: action.cwd || qaDir, env, stdio: 'inherit', windowsHide: true });
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
