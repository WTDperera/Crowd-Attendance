const fs = require('node:fs');
const path = require('node:path');
const { root, command, requireFiles } = require('./command.cjs');
const qa = path.join(root, 'qa');
const run = (action, ...args) => command([action,...args].join('-'), process.execPath, ['scripts/run.cjs', action, ...args], { cwd: qa,
  tests: ['smoke','components','p10-security','p11-node','p11-browser','p11-mobile'].includes(action)?'node':undefined,
  timeout:action==='p11-mobile'?3300000:600000 });
const frontend = path.join(root, 'web_app/admin-portal/frontend');
const nodeFiles = files => command('node-tests', process.execPath, ['--test', '--test-reporter=spec', '--test-concurrency=1', ...files], { cwd: qa, tests: 'node' });
const groups = {
  api: ['profile-security', 'enrollment-access', 'finalization', 'report'].map(f => `tests/${f}.test.cjs`).concat('security/api.test.cjs'),
  rules: ['profile-security', 'enrollment-access', 'round-security'].map(f => `tests/${f}.test.cjs`),
  rounds: ['round-security', 'finalization'].map(f => `tests/${f}.test.cjs`),
  integration: ['emulator', 'report'].map(f => `tests/${f}.test.cjs`),
};
const flutter = process.env.QA_FLUTTER_BIN || (process.platform === 'win32' ? (fs.existsSync('C:/sdk/flutter/bin/flutter.bat')?'C:/sdk/flutter/bin/flutter.bat':'flutter.bat') : 'flutter');
const defines = ['--dart-define=QA_MODE=true','--dart-define=QA_PROJECT_ID=demo-crowd-attendance-qa','--dart-define=QA_EMULATOR_HOST=10.0.2.2'];
async function flutterCall(label, app, args, tests) { return command(label, flutter, args, { cwd: path.join(root, app), tests }); }
async function readiness() {
  const { assertEmulators } = require('./environment.cjs');
  for (let attempt = 0; ; attempt++) {
    try { await assertEmulators(); return; } catch (error) {
      if (attempt === 4 || !(error.name === 'TimeoutError' || (error instanceof TypeError && error.message === 'fetch failed'))) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}
async function inner(group) {
  if (!groups[group]) throw Error('Unknown emulator suite');
  const files = groups[group]; requireFiles(files.map(f => `qa/${f}`));
  await readiness(); await require('./fixtures.cjs').seed();
  await require('../../web_app/admin-portal/server/firebaseAdmin').admin.app().delete();
  await nodeFiles(files);
}
async function main(name) {
  if (process.argv.length !== 3) throw Error('Exactly one named suite is required; arbitrary flags are not accepted');
  if (name?.startsWith('inner-')) return inner(name.slice(6));
  if (groups[name]) return run('p11-node', name);
  switch (name) {
    case 'static': {
      const files = ['qa/scripts/command.cjs','qa/scripts/suites.cjs','qa/scripts/run.cjs','qa/scripts/owned.cjs','qa/scripts/mobile.cjs','qa/scripts/browser.cjs','qa/scripts/validate-workflow.cjs',
        ...fs.readdirSync(path.join(root,'web_app/admin-portal/server/routes')).filter(f=>f.endsWith('.js')).map(f=>`web_app/admin-portal/server/routes/${f}`)];
      requireFiles(files);
      for (const [i,file] of files.entries()) await command(`syntax-${i}`,process.execPath,['--check',path.join(root,file)]);
      await command('focused-eslint',process.execPath,['node_modules/eslint/bin/eslint.js','tests','src/firebase/firebase.js','src/firebase/qaConfig.js','src/hooks/useSubmission.js','src/App.jsx','src/components/ProtectedRoute.jsx','src/components/ModuleFormModal.jsx'],{cwd:frontend});
      return;
    }
    case 'static-full':
      await command('full-eslint',process.execPath,['node_modules/eslint/bin/eslint.js','.'],{cwd:frontend});
      for (const app of ['student_app','lecturer_app']) await flutterCall(`analyze-${app}`,app,['analyze','--no-pub']);
      return;
    case 'build':
      await command('web-build',process.execPath,['node_modules/vite/bin/vite.js','build'],{cwd:frontend}); await run('build-web'); return;
    case 'build-android':
      for (const app of ['student_app','lecturer_app']) await flutterCall(`apk-${app}`,app,['build','apk','--debug','--no-pub','-t','lib/main.dart',...defines]); return;
    case 'unit-web': {
      const files = ['tests/config.test.cjs','tests/report-policy.test.cjs','tests/workbook.test.cjs','scripts/command.test.cjs']; requireFiles(files.map(f=>`qa/${f}`)); await nodeFiles(files); return;
    }
    case 'unit-mobile':
      requireFiles(['lecturer_app/test/round_domain_test.dart','lecturer_app/test/detection_gate_test.dart']);
      await flutterCall('lecturer-unit','lecturer_app',['test','--no-pub','test/round_domain_test.dart','test/detection_gate_test.dart'],'flutter'); return;
    case 'unit': await main('unit-web'); await main('unit-mobile'); return;
    case 'component':
      requireFiles(['web_app/admin-portal/frontend/tests/auth.test.jsx','web_app/admin-portal/frontend/tests/components.test.jsx','web_app/admin-portal/frontend/tests/routes.test.jsx']);
      await command('react-components',process.execPath,['node_modules/vitest/vitest.mjs','run','--config','vitest.config.js'],{cwd:frontend,tests:'vitest'}); return;
    case 'widget': return run('p11-mobile','widget');
    case 'mobile': return run('p11-mobile','mobile');
    case 'e2e': return run('p11-mobile','e2e');
    case 'accessibility': case 'visual': return run('p11-browser',name);
    case 'smoke': requireFiles(['qa/tests/config.test.cjs','qa/tests/emulator.test.cjs']); return run('smoke');
    case 'regression':
      requireFiles(['config','emulator','profile-security','enrollment-access','round-security','finalization','report-policy','workbook','report'].map(f=>`qa/tests/${f}.test.cjs`)
        .concat(['qa/security/api.test.cjs',...['components','auth','routes','persistence'].map(f=>`web_app/admin-portal/frontend/tests/${f}.test.jsx`)]));
      await run('components'); await run('p10-security'); return;
    case 'performance': {
      requireFiles(['qa/load/run.cjs']);
      const artifact='qa/artifacts/p10/load.json'; fs.rmSync(path.join(root,artifact),{force:true});
      await run('p10-load'); requireFiles([artifact]);
      const report=JSON.parse(fs.readFileSync(path.join(root,artifact),'utf8'));
      if(!(report.summary?.requests>0) || report.summary.unexpected!==0)throw Error('Performance suite produced no successful request/reconciliation result');
      return;
    }
    case 'security':
      requireFiles(['qa/security/scan.cjs','qa/security/review.cjs','qa/security/harness.test.cjs','qa/security/api.test.cjs','qa/security/dispositions.json','qa/security/tools.json']);
      for (const mode of ['secrets','dependencies']) {
        const artifact=`qa/artifacts/p10/${mode}.json`; fs.rmSync(path.join(root,artifact),{force:true});
        await command(`scan-${mode}`,process.execPath,['security/scan.cjs',mode],{cwd:qa,accepted:[0,1]}); requireFiles([artifact]);
      }
      await command('security-review',process.execPath,['security/review.cjs'],{cwd:qa});
      await command('security-harness',process.execPath,['--test','--test-reporter=spec','security/harness.test.cjs'],{cwd:qa,tests:'node'});
      // The negative review canary restores scan inputs but leaves its rejected
      // review artifact. Revalidate restored inputs and leave a positive review.
      await command('security-review',process.execPath,['security/review.cjs'],{cwd:qa});
      await run('p10-security'); return;
    case 'property':
      requireFiles(['lecturer_app/test/round_domain_test.dart']);
      await flutterCall('round-replay-property','lecturer_app',['test','--no-pub','test/round_domain_test.dart','--plain-name','seeded replay permutations preserve round evidence and missed rounds'],'flutter'); return;
    case 'hardware': throw Error('Physical BLE/native permission/UAT checks require P12 authorization and actual devices. No automated pass is available.');
    case 'workflow': return command('actionlint',process.execPath,['scripts/validate-workflow.cjs'],{cwd:qa});
    default: throw Error('Unknown suite name');
  }
}
if (require.main === module) main(process.argv[2]).catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { groups, main, readiness };
