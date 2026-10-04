const { spawnSync } = require('node:child_process');
const { command, root, requireFiles } = require('./command.cjs');
const { services } = require('./owned.cjs');
const path = require('node:path');
const fs = require('node:fs');
const qa=path.join(root,'qa');
const flutter=process.env.QA_FLUTTER_BIN || (fs.existsSync('C:/sdk/flutter/bin/flutter.bat')?'C:/sdk/flutter/bin/flutter.bat':'flutter.bat');
const sdk=process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || path.join(process.env.LOCALAPPDATA || '', 'Android/Sdk');
const adb=path.join(sdk,'platform-tools/adb.exe');
const serial='emulator-5580';
const defines=['--dart-define=QA_MODE=true','--dart-define=QA_PROJECT_ID=demo-crowd-attendance-qa','--dart-define=QA_EMULATOR_HOST=10.0.2.2'];
async function drive(app,target) {
  requireFiles([`${app}/integration_test/${target}.dart`,`${app}/test_driver/qa_bootstrap.dart`]);
  await command(`${app}-${target}`,flutter,['drive','--no-pub','--driver=test_driver/qa_bootstrap.dart',`--target=integration_test/${target}.dart`,'-d',serial,...defines],{cwd:path.join(root,app),tests:'flutter-drive',timeout:900000});
}
const fixture=async action=>{
  for(const name of ['com.example.student_app','com.example.lecturer_app']) {
    const result=spawnSync(adb,['-s',serial,'shell','am','force-stop',name],{windowsHide:true,stdio:'ignore'});
    if(result.status!==0)throw Error('Cannot stop QA app listeners before fixture reset');
  }
  await command(`fixture-${action}`,process.execPath,['scripts/run.cjs',action],{cwd:qa});
};
(async()=>{
  const mode=process.argv[2]; if(!['widget','mobile','e2e'].includes(mode)||process.argv.length!==3)throw Error('Unknown Android suite');
  if(process.env.QA_ANDROID_SERIAL && process.env.QA_ANDROID_SERIAL!==serial)throw Error('Only dedicated QA emulator-5580 is accepted');
  if(!require('../../web_app/admin-portal/server/qaConfig').getQaConfig())throw Error('Explicit QA environment required');
  const probe=spawnSync(adb,['devices'],{encoding:'utf8',windowsHide:true});
  if(probe.status!==0 || !/^emulator-5580\s+device\s*$/m.test(probe.stdout))throw Error('Dedicated QA Android emulator unavailable; no desktop fallback');
  await services(async()=>{
    try {
      if(mode==='e2e') {
        await fixture('seed'); await drive('lecturer_app','journey_test');
        await command('browser-journey',process.execPath,['scripts/browser.cjs','journey'],{cwd:qa,tests:'node'});
        await fixture('p09-student-fixture'); await drive('student_app','journey_test');
      } else if(mode==='widget') {
        await fixture('p04-fixture'); await drive('student_app','ui_components_test');
        await fixture('p04-fixture'); await drive('lecturer_app','ui_components_test');
      } else {
        await fixture('p04-fixture'); await drive('student_app','enrollment_access_test');
        await fixture('seed'); await drive('lecturer_app','session_access_test');
        await fixture('p04-fixture'); await drive('lecturer_app','round_persistence_test');
      }
    } finally {
      let restoreError;
      for(const name of ['com.example.student_app','com.example.lecturer_app']) spawnSync(adb,['-s',serial,'shell','am','force-stop',name],{windowsHide:true,stdio:'ignore'});
      for(const app of ['student_app','lecturer_app']) {
        try { await command(`restore-${app}`,flutter,['build','apk','--debug','--no-pub','-t','lib/main.dart',...defines],{cwd:path.join(root,app),timeout:900000}); }
        catch(error) { restoreError ||= error; }
      }
      if(restoreError)throw restoreError;
    }
  });
})().catch(error=>{console.error(error.message);process.exitCode=1;});
