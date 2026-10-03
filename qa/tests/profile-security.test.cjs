const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, getDoc, setDoc, updateDoc, deleteDoc, deleteField, serverTimestamp, Timestamp } = require('firebase/firestore');
const { initializeApp, deleteApp } = require('firebase/app');
const { getAuth, connectAuthEmulator, signInWithEmailAndPassword, signOut } = require('firebase/auth');
const { getQaConfig } = require('../../web_app/admin-portal/server/qaConfig');
const { assertEmulators } = require('../scripts/environment.cjs');
const identities = require('../fixtures/identities.json');
const { seed } = require('../scripts/fixtures.cjs');
const qa = getQaConfig();
if (!qa) throw new Error('P03 tests require the guarded local QA launcher');
const { db, admin } = require('../../web_app/admin-portal/server/firebaseAdmin');
let env;
before(async () => {
  await assertEmulators();
  env = await initializeTestEnvironment({ projectId: qa.projectId, firestore: {
    host: '127.0.0.1', port: 8080, rules: fs.readFileSync('../web_app/admin-portal/firestore.rules', 'utf8'),
  } });
});
beforeEach(async () => { await seed(); });
after(async () => { await env?.cleanup(); await seed(); await admin.app().delete(); });
const client = uid => env.authenticatedContext(uid).firestore();

test('P03 student cannot create own lecturer profile or gain API/portal access', async () => {
  const ref = doc(client('qa-student-a'), 'lecturers/qa-student-a');
  const attempt = setDoc(ref, { uid: 'qa-student-a', role: 'lecturer', fullName: 'Forged Lecturer' });
  // Reproduce the complete baseline exploit before asserting denial. Every test
  // starts with a fresh seed; the finally also removes a forged profile.
  try {
    const outcome = await Promise.allSettled([attempt]);
    if (outcome[0].status === 'fulfilled') {
      const { createApp } = require('../../web_app/admin-portal/server/app');
      const server = createApp().listen(0, '127.0.0.1');
      await new Promise(resolve => server.once('listening', resolve));
      try {
        const response = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/login`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: identities.students[0].email, password: identities.password }),
        });
        assert.equal(response.status, 200);
        assert.equal(typeof (await response.json()).token, 'string');
        console.log('REPRODUCED: student-created lecturer profile yields portal custom token (HTTP 200).');
      } finally { await new Promise(resolve => server.close(resolve)); }
    }
    await assertFails(attempt);
  } finally { await db.doc('lecturers/qa-student-a').delete(); }
});

test('P03 anonymous, student and lecturer cannot provision/delete lecturer profiles', async () => {
  for (const store of [env.unauthenticatedContext().firestore(), client('qa-student-a'), client('qa-lecturer-a')]) {
    await assertFails(setDoc(doc(store, 'lecturers/qa-unprovisioned'), { role: 'lecturer' }));
    await assertFails(deleteDoc(doc(store, 'lecturers/qa-lecturer-a')));
  }
});

test('P03 legitimate lecturer presentation updates pass; identity/role and unknown fields fail', async () => {
  const ref = doc(client('qa-lecturer-a'), 'lecturers/qa-lecturer-a');
  await assertSucceeds(updateDoc(ref, { name: 'QA Updated Name', fullName: 'QA Updated Name', department: 'QA Department' }));
  for (const patch of [{ uid: 'qa-lecturer-b' }, { email: 'other@example.test' }, { role: 'admin' },
    { createdAt: serverTimestamp() }, { lecturer_id: 'qa-lecturer-b' }, { unknown: true }, { department: 1 },
    { email: deleteField() }, { uid: deleteField() }]) {
    await assertFails(updateDoc(ref, patch));
  }
  await assertFails(updateDoc(doc(client('qa-lecturer-b'), 'lecturers/qa-lecturer-a'), { name: 'Other owner' }));
});

test('P03 students cannot edit protected identity, counters, enrollment or delete profiles', async () => {
  const ref = doc(client('qa-student-a'), 'students/qa-student-a');
  for (const patch of [{ uid: 'qa-student-b' }, { email: 'other@example.test' }, { reg_no: 'QA999' },
    { role: 'lecturer' }, { name: 'Unapproved' }, { attendance_counts: { QA101: 99 } },
    { absence_counts: { QA101: 99 } }, { enrolled_module_ids: [] }, { lecturer_id: 'qa-lecturer-a' }, { unknown: true },
    { reg_no: deleteField() }, { email: deleteField() }]) {
    await assertFails(updateDoc(ref, patch));
  }
  await assertFails(deleteDoc(ref));
  await assertFails(setDoc(ref, { device_id: 'qa-overwrite', device_locked_at: serverTimestamp() }));
  await assertFails(setDoc(doc(client('qa-student-a'), 'students/qa-new'), { reg_no: 'QA999' }));
  await assertFails(getDoc(doc(client('qa-student-b'), 'students/qa-student-a')));
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'students/qa-student-a')));
  await assertSucceeds(getDoc(ref));
});

test('P03 first binding accepts absent/null/empty legacy state, then locks fields and server timestamps', async () => {
  for (const collection of ['students', 'lecturers']) {
    for (const [index, prior] of [undefined, null, ''].entries()) {
      const uid = `qa-bind-${collection}-${index}`;
      const initial = { uid, email: `${uid}@example.test` };
      if (prior !== undefined) initial.device_id = prior;
      await db.doc(`${collection}/${uid}`).set(initial);
      const ref = doc(client(uid), `${collection}/${uid}`);
      for (const patch of [{ device_id: '', device_locked_at: serverTimestamp() }, { device_id: '   ', device_locked_at: serverTimestamp() },
        { device_id: 'qa-device', device_locked_at: Timestamp.fromMillis(1) },
        { device_id: 'qa-device' }, { device_id: 1, device_locked_at: serverTimestamp() }]) {
        await assertFails(updateDoc(ref, patch));
      }
      const binding = { device_id: 'qa-device', device_locked_at: serverTimestamp() };
      if (collection === 'lecturers') Object.assign(binding, { device_model: 'QA Emulator', last_login: serverTimestamp() });
      await assertSucceeds(setDoc(ref, binding, { merge: true }));
      await assertSucceeds(updateDoc(ref, { last_login: serverTimestamp() }));
      for (const patch of [{ device_id: 'replacement' }, { device_id: null }, { device_locked_at: serverTimestamp() },
        { device_model: 'replacement' }, { last_login: Timestamp.fromMillis(1) }]) {
        await assertFails(updateDoc(ref, patch));
      }
      await db.doc(`${collection}/${uid}`).delete();
    }
  }
});

test('P03 concurrent first binding allows one winner and rejects replacement', async () => {
  const uid = 'qa-concurrent-binding';
  await db.doc(`students/${uid}`).set({ uid, device_id: null });
  const results = await Promise.allSettled(['device-a', 'device-b'].map(device_id =>
    updateDoc(doc(client(uid), `students/${uid}`), { device_id, device_locked_at: serverTimestamp() })));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(results.filter(r => r.status === 'rejected' && r.reason.code === 'permission-denied').length, 1);
  await db.doc(`students/${uid}`).delete();
});

test('P03 trusted provisioning refuses students/overwrites and creates one profile atomically', async () => {
  const { auth } = require('../../web_app/admin-portal/server/firebaseAdmin');
  const { provisionLecturerProfile } = require('../../web_app/admin-portal/server/services/lecturerProvisioning');
  const provision = (uid, fullName = 'QA Provisioned Lecturer') =>
    provisionLecturerProfile({ auth, db, admin }, uid, { fullName });
  await assert.rejects(provision('qa-student-a'), /student account/);
  await assert.rejects(provision('qa-lecturer-a'), /already provisioned/);
  await assert.rejects(provision('qa-lecturer-a', ''), /valid strings/);
  await assert.rejects(provision('qa-missing-auth'), { code: 'auth/user-not-found' });
  const uid = 'qa-provisioned-new';
  await auth.createUser({ uid, email: 'qa.provisioned@example.test', password: identities.password });
  const outcomes = await Promise.allSettled([provision(uid), provision(uid)]);
  assert.equal(outcomes.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(outcomes.filter(result => result.status === 'rejected').length, 1);
  const profile = await db.doc(`lecturers/${uid}`).get();
  assert.equal(profile.get('uid'), uid);
  assert.equal(profile.get('role'), 'lecturer');
  assert.equal(profile.get('email'), 'qa.provisioned@example.test');
  await assertSucceeds(getDoc(doc(client(uid), `lecturers/${uid}`)));
  await assertFails(updateDoc(doc(client(uid), `lecturers/${uid}`), { role: 'admin' }));
  await auth.updateUser(uid, { disabled: true });
  await assert.rejects(provision(uid), /enabled Auth account/);
});

test('P03 lecturers retain student reads/counter updates but cannot change identity/binding directly', async () => {
  const ref = doc(client('qa-lecturer-a'), 'students/qa-student-c');
  await assertSucceeds(getDoc(ref));
  await assertSucceeds(updateDoc(ref, { 'attendance_counts.QA101': 0 }));
  for (const patch of [{ email: 'other@example.test' }, { reg_no: 'QA999' }, { device_id: 'reset' },
    { enrolled_module_ids: [] }, { uid: 'other' }, { role: 'lecturer' }]) await assertFails(updateDoc(ref, patch));
  await assertFails(deleteDoc(ref));
});

test('P03 student cannot use self-owned lecturer resources; lecturer ownership cannot be rebound', async () => {
  const student = client('qa-student-a');
  await assertFails(setDoc(doc(student, 'modules/qa-forged'), { lecturer_id: 'qa-student-a' }));
  await assertFails(setDoc(doc(student, 'active_sessions/qa-forged'), { lecturer_id: 'qa-student-a' }));
  await assertFails(updateDoc(doc(client('qa-lecturer-a'), 'modules/QA101'), { lecturer_id: 'qa-lecturer-b' }));
  await assertFails(updateDoc(doc(client('qa-lecturer-a'), 'active_sessions/qa-active'), { lecturer_id: 'qa-lecturer-b' }));
});

test('P03 actual Auth tokens: anonymous/student denied, both provisioned lecturers allowed; forged profile is not mintable', async () => {
  const { createApp } = require('../../web_app/admin-portal/server/app');
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const app = initializeApp({ projectId: qa.projectId, apiKey: 'qa-emulator-key' }, 'qa-p03-auth');
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const login = person => fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: person.email, password: identities.password }) });
  try {
    assert.equal((await fetch(`${base}/api/students`)).status, 401);
    assert.equal((await fetch(`${base}/api/students`, { headers: { Authorization: 'Bearer invalid' } })).status, 401);
    const signedIn = await signInWithEmailAndPassword(auth, identities.students[0].email, identities.password);
    const token = await signedIn.user.getIdToken();
    assert.equal((await fetch(`${base}/api/students`, { headers: { Authorization: `Bearer ${token}` } })).status, 403);
    for (const [method, path, body] of [
      ['POST', '/api/students', { email: 'qa.unwanted@example.test', password: identities.password, reg_no: 'QA999' }],
      ['PATCH', '/api/students/qa-student-b', { reg_no: 'QA999' }],
      ['DELETE', '/api/students/qa-student-b', undefined],
    ]) {
      assert.equal((await fetch(`${base}${path}`, { method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined })).status, 403);
    }
    const denied = await login(identities.students[0]);
    assert.equal(denied.status, 403);
    assert.equal((await denied.json()).token, undefined);
    for (const person of identities.lecturers) {
      assert.equal((await login(person)).status, 200);
      const lecturer = await signInWithEmailAndPassword(auth, person.email, identities.password);
      const lecturerToken = await lecturer.user.getIdToken();
      const response = await fetch(`${base}/api/students`, { headers: { Authorization: `Bearer ${lecturerToken}` } });
      assert.equal(response.status, 200);
      assert.equal((await response.json()).students.length, 3);
    }
  } finally {
    await signOut(auth); await deleteApp(app); await new Promise(resolve => server.close(resolve));
  }
});
