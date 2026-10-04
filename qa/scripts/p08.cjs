const { spawnSync } = require('node:child_process');
const { assertEmulators } = require('./environment.cjs');

(async () => {
  // A freshly started Firestore process can report its port before the first
  // rules-backed read is ready. Retry only transient probe failures, with the
  // same guarded, read-only checks and no writes until both probes succeed.
  for (let attempt = 0; ; attempt++) {
    try { await assertEmulators(); break; }
    catch (error) {
      const transient = error.name === 'TimeoutError' || (error instanceof TypeError && error.message === 'fetch failed');
      if (!transient || attempt === 4) throw error;
      console.log(`Waiting for local emulator readiness (${attempt + 1}/4)`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  // Keep fixture resets serial across the API/rules and actual UI suites.
  for (const args of [['scripts/smoke.cjs', 'reports'], ['scripts/run.cjs', 'component-tests'], ['scripts/run.cjs', 'component-integration']]) {
    const result = spawnSync(process.execPath, args, { stdio: 'inherit', env: process.env, windowsHide: true });
    if (result.status !== 0) { process.exitCode = result.status ?? 1; return; }
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
