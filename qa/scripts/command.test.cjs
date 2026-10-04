const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const path=require('node:path');
const {command,requireFiles,root,testCount}=require('./command.cjs');
test('P11 failed child and success without tests cannot pass a required suite',async()=>{
  await assert.rejects(command('canary-fail',process.execPath,['-e','process.exit(7)']),/failed/);
  await assert.rejects(command('canary-empty',process.execPath,['-e','console.log("empty")'],{tests:'node'}),/no passing test/);
  await assert.rejects(command('canary-timeout',process.execPath,['-e','setInterval(()=>{},1000)'],{timeout:150}),/failed/);
  const result=require('../artifacts/p11/canary-timeout.json');
  assert.equal(result.timedOut,true);assert.equal(result.passed,false);
});
test('P11 required empty/missing files and unknown/hardware categories fail',()=>{
  assert.throws(()=>requireFiles([]),/empty/);assert.throws(()=>requireFiles(['qa/no-such-suite.test.cjs']),/missing/);
  for(const name of ['no-such-suite','hardware']){
    const r=spawnSync(process.execPath,['scripts/suites.cjs',name],{cwd:path.join(root,'qa'),encoding:'utf8',windowsHide:true});
    assert.equal(r.status,1);
  }
});
test('P11 zero test counts remain zero and real tool result formats are recognized',()=>{
  assert.equal(testCount('ℹ tests 0','node'),0);assert.equal(testCount('ℹ tests 3','node'),3);
  assert.equal(testCount('Tests 25 passed (25)','vitest'),25);assert.equal(testCount('  2 passed (12s)','playwright'),2);
  assert.equal(testCount('00:01 +11: All tests passed!','flutter'),11);
  assert.equal(testCount('00:01 +0: (tearDownAll)\n00:01 +1: All tests passed!','flutter-drive'),0);
  assert.equal(testCount('00:01 +1: (tearDownAll)\n00:01 +2: All tests passed!','flutter-drive'),1);
});
test('P11 malicious category flags are refused before starting emulator CLI',()=>{
  const r=spawnSync(process.execPath,['scripts/run.cjs','p11-node','api&echo injected'],{cwd:path.join(root,'qa'),encoding:'utf8',windowsHide:true});
  assert.equal(r.status,1);assert.match(r.stderr,/fixed P11 category/);
});
