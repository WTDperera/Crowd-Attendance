const { spawnSync } = require('node:child_process');
const { assertEmulators } = require('../scripts/environment.cjs');
(async () => {
  for (let attempt = 0; ; attempt++) {
    try { await assertEmulators(); break; }
    catch (error) {
      const transient = error.name === 'TimeoutError' || (error instanceof TypeError && error.message === 'fetch failed');
      if (!transient || attempt === 4) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  const result = spawnSync(process.execPath, ['--test', 'security/api.test.cjs'], { stdio: 'inherit', env: process.env, windowsHide: true });
  process.exitCode = result.status ?? 1;
})().catch(error => { console.error(error.message); process.exitCode = 1; });
