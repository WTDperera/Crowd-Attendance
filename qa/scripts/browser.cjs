const { command, requireFiles, root } = require('./command.cjs');
const path = require('node:path');
const { services } = require('./owned.cjs');
(async()=>{
  if(!['accessibility','visual','journey'].includes(process.argv[2]) || process.argv.length!==3) throw Error('Unknown browser suite');
  requireFiles(['qa/browser/lecturer.spec.cjs','qa/browser/baselines/login-win32.png','qa/browser/baselines/add-student-win32.png']);
  if(process.platform!=='win32') throw Error('Reviewed screenshots require Windows; no automatic baseline update');
  if(!require('../../web_app/admin-portal/server/qaConfig').getQaConfig()) throw Error('Explicit QA environment required');
  await require('./suites.cjs').readiness();
  if(process.argv[2]!=='journey') {
    await require('./fixtures.cjs').seed();
    const {db,admin}=require('../../web_app/admin-portal/server/firebaseAdmin');
    // The standalone visual case opens the first class. Use the completed
    // base fixture, not its intentionally empty active placeholder. The full
    // journey never seeds/replaces the Android-created ledger.
    await db.doc('active_sessions/qa-active').delete();
    await admin.app().delete();
  }
  await services(()=>command('playwright',process.execPath,[path.join(root,'qa/node_modules/@playwright/test/cli.js'),'test',
    ...(process.argv[2]==='journey'?[]:['--grep','stable core screens'])],{cwd:path.join(root,'qa'),tests:'playwright'}),true,process.argv[2]!=='journey');
})().catch(error=>{console.error(error.message);process.exitCode=1;});
