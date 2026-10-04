const { spawnSync } = require('node:child_process');
const { assertEmulators } = require('./environment.cjs');
const { seed } = require('./fixtures.cjs');

(async () => {
  await assertEmulators();
  await seed();
  await seed(); // Repeated setup must produce the same synthetic identities/records.
  const result = spawnSync(process.execPath, ['--test', '--test-concurrency=1',
    'tests/config.test.cjs', 'tests/emulator.test.cjs',
    ...(['security', 'access'].includes(process.argv[2]) ? ['tests/profile-security.test.cjs'] : []),
    ...(process.argv[2] === 'access' ? ['tests/enrollment-access.test.cjs'] : [])],
    { stdio: 'inherit', env: process.env, windowsHide: true });
  await require('../../web_app/admin-portal/server/firebaseAdmin').admin.app().delete();
  process.exitCode = result.status ?? 1;
})().catch(error => { console.error(error.message); process.exitCode = 1; });
