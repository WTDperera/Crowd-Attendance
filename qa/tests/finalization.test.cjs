const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { initializeTestEnvironment, assertFails } = require('@firebase/rules-unit-testing');
const { doc, updateDoc, setDoc, writeBatch, serverTimestamp } = require('firebase/firestore');
const { initializeApp, deleteApp } = require('firebase/app');
const { getAuth, connectAuthEmulator, signInWithEmailAndPassword } = require('firebase/auth');
const { getQaConfig } = require('../../web_app/admin-portal/server/qaConfig');
const { seed } = require('../scripts/fixtures.cjs');
const { assertEmulators } = require('../scripts/environment.cjs');
const qa = getQaConfig();
if (!qa) throw Error('Guarded local QA required');
const { db, admin } = require('../../web_app/admin-portal/server/firebaseAdmin');
let server, base, env;
const apps = [], tokens = {};
const sid = 'p06-session';
const recordId = uid => `${sid}.${Buffer.from(uid).toString('base64').replaceAll('+','-').replaceAll('/','_')}`;
async function call(uid, action, body = {}) {
  // A paused host can outlive a cached ID token. Use the SDK's normal refresh
  // behavior before each authenticated operation; server checks stay unchanged.
  tokens[uid] = await getAuth(apps[uid === 'qa-lecturer-a' ? 0 : 1]).currentUser.getIdToken();
  return fetch(`${base}/api/attendance/session/${sid}/${action}`, { method: 'POST', headers: {
    'Content-Type': 'application/json', Authorization: `Bearer ${tokens[uid]}` }, body: JSON.stringify(body) });
}
before(async () => {
  await assertEmulators(); await seed();
  env = await initializeTestEnvironment({ projectId: qa.projectId, firestore: {host:'127.0.0.1',port:8080,
    rules:fs.readFileSync('../web_app/admin-portal/firestore.rules','utf8')} });
  server = require('../../web_app/admin-portal/server/app').createApp().listen(0,'127.0.0.1');
  await new Promise(resolve => server.once('listening',resolve)); base = `http://127.0.0.1:${server.address().port}`;
  for (const [uid,email] of [['qa-lecturer-a','lecturer.a@example.test'],['qa-lecturer-b','lecturer.b@example.test']]) {
    const app = initializeApp({projectId:qa.projectId,apiKey:'qa-emulator-key'},`p06-${uid}`); apps.push(app);
    const auth = getAuth(app); connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});
    tokens[uid] = await (await signInWithEmailAndPassword(auth,email,'QA-only-Password-123!')).user.getIdToken();
  }
});
beforeEach(async () => {
  await seed();
  for (const [index,email] of ['lecturer.a@example.test','lecturer.b@example.test'].entries()) {
    const signedIn=await signInWithEmailAndPassword(getAuth(apps[index]),email,'QA-only-Password-123!');
    tokens[index===0?'qa-lecturer-a':'qa-lecturer-b']=await signedIn.user.getIdToken(true);
  }
  const roster = {'qa-student-a':'QA001','qa-student-b':'QA002','qa-student-c':'QA003'};
  await db.doc(`active_sessions/${sid}`).set({session_id:sid,lecturer_id:'qa-lecturer-a',module_id:'QA101',module_code:'QA101',
    status:'active',round_schema:2,eligible_roster:roster,active_round_id:null,rounds_started:3,scans_performed:3,
    student_count:2,students_present:['qa-student-a','qa-student-c'],started_at:admin.firestore.Timestamp.now()});
  for (const [uid,reg] of Object.entries(roster)) await db.doc(`active_sessions/${sid}/roster/${uid}`).set({student_uid:uid,reg_no:reg,module_id:'QA101'});
  for (let r=1;r<=3;r++) {
    await db.doc(`active_sessions/${sid}/rounds/r${r}`).set({round_id:`r${r}`,status:'completed',ordinal:r});
    for (const suffix of r===3?['a']:['a','c']) await db.doc(`active_sessions/${sid}/rounds/r${r}/observations/qa-student-${suffix}`).set({round_id:`r${r}`,student_uid:`qa-student-${suffix}`});
  }
  for (const suffix of ['a','c']) {
    const uid=`qa-student-${suffix}`, data={session_id:sid,student_uid:uid,student_id:uid,reg_no:roster[uid],module_id:'QA101',module_code:'QA101',
      status:'pending',round_schema:2,observed_round_ids:suffix==='a'?['r1','r2','r3']:['r1','r2'],scan_count:suffix==='a'?3:2};
    await db.doc(`attendance_records/${recordId(uid)}`).set(data);
    await db.doc(`active_sessions/${sid}/attendance/${uid}`).set(data);
    await db.doc(`students/${uid}`).update({'attendance_counts.QA101':admin.firestore.FieldValue.increment(1)});
  }
});
after(async()=>{await Promise.all(apps.map(deleteApp));await env?.cleanup();await new Promise(resolve=>server.close(resolve));await seed();await admin.app().delete();});
test('P06 completed correction keeps nested/root results in agreement',async()=>{
  assert.equal((await call('qa-lecturer-a','complete')).status,200);
  assert.equal((await call('qa-lecturer-a','mark',{student_uid:'qa-student-c',status:'Excused'})).status,200);
  assert.equal((await db.doc(`active_sessions/${sid}/attendance/qa-student-c`).get()).get('excused'),true);
});

async function assertLedger(expected=['present','absent','left_early']) {
  const session=(await db.doc(`active_sessions/${sid}`).get()).data();
  assert.equal(session.status,'completed');
  assert.equal((await db.doc('modules/QA101').get()).get('total_sessions'),2);
  assert.equal((await db.doc('module_catalog/QA101').get()).get('total_sessions'),2);
  const creditedUids=[];
  for (const [i,suffix] of ['a','b','c'].entries()) {
    const uid=`qa-student-${suffix}`, root=(await db.doc(`attendance_records/${recordId(uid)}`).get()).data();
    const nested=(await db.doc(`active_sessions/${sid}/attendance/${uid}`).get()).data();
    assert.equal(root.final_status,expected[i]); assert.deepEqual(nested,root);
    const credit=['present','excused'].includes(expected[i]);
    if(credit) creditedUids.push(uid);
    assert.equal((await db.doc(`absence_records/${sid}_${uid}`).get()).exists,!credit);
    const student=(await db.doc(`students/${uid}`).get()).data();
    assert.equal(student.attendance_counts.QA101,(suffix==='a'?1:0)+Number(credit));
    assert.equal(student.absence_counts.QA101,(suffix==='a'?0:1)+Number(!credit));
    assert.equal(student.attendance_counts.QA202,0);
  }
  assert.deepEqual(session.students_present,creditedUids);assert.equal(session.student_count,creditedUids.length);
  const evidence=await db.collectionGroup('observations').get();assert.equal(evidence.size,5);
}
test('P06 concurrent close and retries commit one class and all fixed-roster outcomes',async()=>{
  // Later enrollment changes must not remove B or C from this class.
  await db.doc('students/qa-student-c').update({enrolled_module_ids:['QA202']});
  const responses=await Promise.all(Array.from({length:4},()=>call('qa-lecturer-a','complete')));
  for(const response of responses) assert.equal(response.status,200);
  await assertLedger();
  assert.equal((await call('qa-lecturer-a','complete')).status,200);await assertLedger();
});
test('P06 failed queued commit leaves active state; retry twice and lost acknowledgement have no drift',async()=>{
  const {finalizeSession}=require('../../web_app/admin-portal/server/services/sessionFinalization');
  await assert.rejects(finalizeSession({sessionId:sid,actor:'qa-lecturer-a',beforeCommit:tx=>{
    tx.update(db.doc('p06_nonexistent/reject'),{value:1});
  }}));
  assert.equal((await db.doc(`active_sessions/${sid}`).get()).get('status'),'active');
  assert.equal((await db.doc('modules/QA101').get()).get('total_sessions'),1);
  assert.equal((await db.doc(`attendance_records/${recordId('qa-student-c')}`).get()).get('status'),'pending');
  assert.equal((await db.collection('absence_records').where('session_id','==',sid).get()).size,0);
  await assert.rejects(finalizeSession({sessionId:sid,actor:'qa-lecturer-a',afterCommit:()=>{throw Error('lost acknowledgement');}}));
  await assertLedger();
  for(let n=0;n<2;n++) await finalizeSession({sessionId:sid,actor:'qa-lecturer-a'});
  await assertLedger();
});
test('P06 zero/open rounds refuse completion without increments; empty completed round yields all absent',async()=>{
  await db.doc(`active_sessions/${sid}`).update({active_round_id:'r3'});
  assert.equal((await call('qa-lecturer-a','complete')).status,409);
  await db.doc(`active_sessions/${sid}`).update({active_round_id:null});
  for(let r=1;r<=3;r++) await db.doc(`active_sessions/${sid}/rounds/r${r}`).update({status:'cancelled'});
  assert.equal((await call('qa-lecturer-a','complete')).status,409);
  await db.doc(`active_sessions/${sid}/rounds/r4`).set({status:'completed'});
  assert.equal((await call('qa-lecturer-a','complete')).status,200);await assertLedger(['absent','absent','absent']);
});
test('P06 correction transitions, concurrent repeats, failure and close retry preserve round evidence/counters',async()=>{
  assert.equal((await call('qa-lecturer-a','complete')).status,200);
  const {correctAttendance}=require('../../web_app/admin-portal/server/services/sessionFinalization');
  await assert.rejects(correctAttendance({sessionId:sid,actor:'qa-lecturer-a',correction:{uid:'qa-student-c',status:'excused'},
    beforeCommit:tx=>tx.update(db.doc('p06_nonexistent/reject'),{value:1})}));await assertLedger();
  for(const status of ['excused','present','absent','excused','absent']) {
    const responses=await Promise.all(Array.from({length:3},()=>call('qa-lecturer-a','mark',{student_uid:'qa-student-c',status,reason:'Synthetic review'})));
    for(const response of responses) assert.equal(response.status,200);
    await assertLedger(['present','absent',status]);
    assert.equal((await call('qa-lecturer-a','complete')).status,200);await assertLedger(['present','absent',status]);
  }
  assert.equal((await db.collection(`active_sessions/${sid}/corrections`).get()).size,5);
  const beforeRepeat=(await db.doc(`attendance_records/${recordId('qa-student-c')}`).get()).data();
  assert.equal((await call('qa-lecturer-a','mark',{student_uid:'qa-student-c',status:'Absent'})).status,200);
  assert.deepEqual((await db.doc(`attendance_records/${recordId('qa-student-c')}`).get()).data(),beforeRepeat);
});
test('P06 only owner correction of completed eligible evidence succeeds; direct closed writes fail',async()=>{
  assert.equal((await call('qa-lecturer-a','mark',{student_uid:'qa-student-c',status:'Excused'})).status,409);
  assert.equal((await call('qa-lecturer-b','complete')).status,403);
  assert.equal((await call('qa-lecturer-a','complete')).status,200);
  assert.equal((await call('qa-lecturer-b','mark',{student_uid:'qa-student-c',status:'Excused'})).status,403);
  assert.equal((await call('qa-lecturer-a','mark',{student_uid:'missing',status:'Excused'})).status,409);
  assert.equal((await call('qa-lecturer-a','mark',{student_uid:['qa-student-c'],status:'Excused'})).status,400);
  const owner=env.authenticatedContext('qa-lecturer-a').firestore();
  await assertFails(updateDoc(doc(owner,`active_sessions/${sid}`),{status:'active'}));
  await assertFails(updateDoc(doc(owner,`attendance_records/${recordId('qa-student-a')}`),{scan_count:99}));
  await assertFails(updateDoc(doc(owner,`active_sessions/${sid}/attendance/qa-student-a`),{status:'absent'}));
  await assertFails(setDoc(doc(owner,`absence_records/${sid}_qa-student-a`),{session_id:sid,student_uid:'qa-student-a',module_id:'QA101'}));
  await assertFails(updateDoc(doc(owner,'students/qa-student-a'),{'attendance_counts.QA101':99,attendance_module_id:'QA101',attendance_session_id:sid}));
  await assertLedger();
});
test('P06 seeded correction sequences agree with independent contribution ledger',async()=>{
  assert.equal((await call('qa-lecturer-a','complete')).status,200);
  const {correctAttendance,outcome}=require('../../web_app/admin-portal/server/services/sessionFinalization');
  const lookup=['absent','left_early','left_early','left_early','left_early','left_early','left_early','present'];
  let random=606;
  for(let i=0;i<64;i++) {
    random=(Math.imul(random,1664525)+1013904223)>>>0;
    const mask=random%8, seen=['r1','r2','r3'].filter((_,bit)=>mask&(1<<bit));
    assert.equal(outcome([...seen,...seen,'cancelled'],new Set(['r1','r2','r3'])),lookup[mask]);
  }
  const statuses=['present','absent','excused'];
  for(let i=0;i<12;i++) {
    random=(Math.imul(random,1664525)+1013904223)>>>0;
    const status=statuses[random%3];
    await correctAttendance({sessionId:sid,actor:'qa-lecturer-a',correction:{uid:'qa-student-c',status,reason:'Seed 606'}});
    await assertLedger(['present','absent',status]);
  }
});
test('P06 deleted profile remains an eligible historical result without recreating access',async()=>{
  await db.doc('students/qa-student-b').delete();
  assert.equal((await call('qa-lecturer-a','complete')).status,200);
  assert.equal((await db.doc('students/qa-student-b').get()).exists,false);
  const historical=(await db.doc(`active_sessions/${sid}/attendance/qa-student-b`).get()).data();
  assert.equal(historical.reg_no,'QA002');assert.equal(historical.final_status,'absent');
  assert.equal((await call('qa-lecturer-a','mark',{student_uid:'qa-student-b',status:'Excused'})).status,200);
  assert.equal((await db.doc('students/qa-student-b').get()).exists,false);
  assert.equal((await db.doc(`active_sessions/${sid}`).get()).get('student_count'),2);
});
test('P06 legacy aliases reconcile existing evidence; conflicting records and oversized rosters fail closed',async()=>{
  assert.equal((await call('qa-lecturer-a','complete')).status,200);
  await db.doc(`attendance_records/${recordId('qa-student-c')}`).update({student_uid:admin.firestore.FieldValue.delete()});
  assert.equal((await call('qa-lecturer-a','mark',{student_uid:'qa-student-c',status:'Excused'})).status,200);
  await db.doc('attendance_records/p06-conflicting').set({session_id:sid,student_id:'qa-student-c',status:'absent'});
  assert.equal((await call('qa-lecturer-a','mark',{student_uid:'qa-student-c',status:'Present'})).status,409);
  await db.doc(`active_sessions/${sid}`).update({status:'active',eligible_roster:Object.fromEntries(Array.from({length:51},(_,i)=>[`synthetic-${i}`,`QA${i}`]))});
  assert.equal((await call('qa-lecturer-a','complete')).status,409);
  assert.equal((await db.doc('modules/QA101').get()).get('total_sessions'),2);
});
test('P06 new-round race cannot cross atomic class completion',async()=>{
  const {finalizeSession}=require('../../web_app/admin-portal/server/services/sessionFinalization');
  let release, notify;
  const ready=new Promise(resolve=>{notify=resolve;}), gate=new Promise(resolve=>{release=resolve;});
  const closing=finalizeSession({sessionId:sid,actor:'qa-lecturer-a',beforeCommit:async()=>{notify();await gate;}});
  await ready;
  const owner=env.authenticatedContext('qa-lecturer-a').firestore(), batch=writeBatch(owner);
  batch.update(doc(owner,`active_sessions/${sid}`),{active_round_id:'r4',rounds_started:4});
  batch.set(doc(owner,`active_sessions/${sid}/rounds/r4`),{round_id:'r4',ordinal:4,status:'open',started_at:serverTimestamp()});
  const racing=assertFails(batch.commit());
  release();await closing;await racing;
  assert.equal((await db.doc(`active_sessions/${sid}/rounds/r4`).get()).exists,false);
  await assertLedger();
});
