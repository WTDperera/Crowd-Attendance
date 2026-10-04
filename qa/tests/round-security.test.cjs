const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, getDoc, getDocs, collection, setDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp } = require('firebase/firestore');
const { getQaConfig } = require('../../web_app/admin-portal/server/qaConfig');
const { seed } = require('../scripts/fixtures.cjs');
const { assertEmulators } = require('../scripts/environment.cjs');
if (!getQaConfig()) throw Error('Guarded local QA launcher required.');
const { db, admin } = require('../../web_app/admin-portal/server/firebaseAdmin');
let env;
const path = 'active_sessions/qa-round-session';
const client = uid => env.authenticatedContext(uid).firestore();
const observation = () => ({ session_id: 'qa-round-session', round_id: 'r1', student_uid: 'qa-student-a',
  student_id: 'qa-student-a', reg_no: 'QA001', module_id: 'QA101', module_code: 'QA101', rssi: -50, observed_at: serverTimestamp() });
before(async () => {
  await assertEmulators();
  env = await initializeTestEnvironment({ projectId: getQaConfig().projectId, firestore: { host: '127.0.0.1', port: 8080,
    rules: fs.readFileSync('../web_app/admin-portal/firestore.rules', 'utf8') } });
});
beforeEach(async () => {
  await seed();
  await db.doc(path).set({ session_id: 'qa-round-session', lecturer_id: 'qa-lecturer-a', module_id: 'QA101', module_code: 'QA101',
    round_schema: 2, eligible_roster: { 'qa-student-a': 'QA001' }, status: 'active', rounds_started: 1, active_round_id: 'r1', scans_performed: 0 });
  await db.doc(`${path}/rounds/r1`).set({ round_id: 'r1', ordinal: 1, status: 'open', started_at: admin.firestore.Timestamp.now() });
  await db.doc(`${path}/roster/qa-student-a`).set({ student_uid: 'qa-student-a', reg_no: 'QA001', module_id: 'QA101', captured_at: admin.firestore.Timestamp.now() });
});
after(async () => { await env?.cleanup(); await seed(); await admin.app().delete(); });

test('P05 round metadata is owner-only; observation identity is immutable and student own read works', async () => {
  const owner = client('qa-lecturer-a');
  await assertSucceeds(getDocs(collection(owner, `${path}/rounds`)));
  for (const uid of ['qa-lecturer-b', 'qa-student-a']) await assertFails(getDocs(collection(client(uid), `${path}/rounds`)));
  const ref = doc(owner, `${path}/rounds/r1/observations/qa-student-a`);
  await assertSucceeds(setDoc(ref, observation()));
  await assertSucceeds(getDoc(doc(client('qa-student-a'), ref.path)));
  await assertFails(getDoc(doc(client('qa-student-b'), ref.path)));
  await assertFails(updateDoc(ref, { rssi: -30 }));
  await assertFails(deleteDoc(ref));
});
test('P05 wrong tuple identity, roster registration and non-roster student cannot be written', async () => {
  const owner = client('qa-lecturer-a');
  const ref = doc(owner, `${path}/rounds/r1/observations/qa-student-a`);
  for (const patch of [{ round_id: 'r2' }, { session_id: 'qa-active' }, { reg_no: 'QA003' }, { student_uid: 'qa-student-c' }]) {
    await assertFails(setDoc(ref, { ...observation(), ...patch }));
  }
  await assertFails(setDoc(doc(owner, `${path}/rounds/r1/observations/qa-student-b`), {
    ...observation(), student_uid: 'qa-student-b', student_id: 'qa-student-b', reg_no: 'QA002' }));
  await assertFails(setDoc(doc(client('qa-lecturer-b'), ref.path), observation()));
});
test('P05 roster and round schema cannot be rebound; direct completion/count shortcuts fail', async () => {
  const owner = client('qa-lecturer-a');
  await assertFails(updateDoc(doc(owner, path), { eligible_roster: {} }));
  await assertFails(updateDoc(doc(owner, path), { round_schema: 1 }));
  await assertFails(updateDoc(doc(owner, path), { scans_performed: 100 }));
  await assertFails(updateDoc(doc(owner, `${path}/rounds/r1`), { status: 'completed', finished_at: serverTimestamp() }));
});
test('P05 atomic completion counts once and rejects round reopening/late new evidence', async () => {
  const owner = client('qa-lecturer-a');
  const batch = writeBatch(owner);
  batch.update(doc(owner, `${path}/rounds/r1`), { status: 'completed', finished_at: serverTimestamp() });
  batch.update(doc(owner, path), { active_round_id: null, scans_performed: 1 });
  await assertSucceeds(batch.commit());
  await assertFails(updateDoc(doc(owner, path), { scans_performed: 2 }));
  await assertFails(updateDoc(doc(owner, `${path}/rounds/r1`), { status: 'open' }));
  await assertFails(setDoc(doc(owner, `${path}/rounds/r1/observations/qa-student-a`), observation()));
  assert.equal((await db.doc(path).get()).get('scans_performed'), 1);
});
test('P05 cancelled diagnostics survive; cancellation cannot count as a completed round', async () => {
  const owner = client('qa-lecturer-a');
  await assertSucceeds(setDoc(doc(owner, `${path}/rounds/r1/observations/qa-student-a`), observation()));
  const batch = writeBatch(owner);
  batch.update(doc(owner, `${path}/rounds/r1`), { status: 'cancelled', finished_at: serverTimestamp() });
  batch.update(doc(owner, path), { active_round_id: null });
  await assertSucceeds(batch.commit());
  await assertSucceeds(getDoc(doc(owner, `${path}/rounds/r1/observations/qa-student-a`)));
  await assertFails(deleteDoc(doc(owner, `${path}/rounds/r1`)));
  assert.equal((await db.doc(path).get()).get('scans_performed'), 0);
});

test('P05 first round is created atomically with its parent pointer', async () => {
  await db.doc(`${path}/rounds/r1`).delete();
  await db.doc(path).update({ active_round_id: null, rounds_started: 0 });
  const owner = client('qa-lecturer-a');
  const batch = writeBatch(owner);
  batch.set(doc(owner, `${path}/rounds/r1`), { round_id: 'r1', ordinal: 1, status: 'open', started_at: serverTimestamp() });
  batch.update(doc(owner, path), { active_round_id: 'r1', rounds_started: 1 });
  await assertSucceeds(batch.commit());
});

test('P05 roster proof is fixed at creation; a later snapshot entry cannot bypass enrollment', async () => {
  const owner = client('qa-lecturer-a');
  await assertFails(setDoc(doc(owner, `${path}/roster/qa-student-b`), {
    student_uid: 'qa-student-b', reg_no: 'QA002', module_id: 'QA101', captured_at: serverTimestamp() }));
  await assertFails(updateDoc(doc(owner, `${path}/roster/qa-student-a`), { reg_no: 'QA003' }));
  await db.doc('students/qa-student-a').update({ enrolled_module_ids: ['QA202'] });
  await assertSucceeds(setDoc(doc(owner, `${path}/rounds/r1/observations/qa-student-a`), observation()));
});
