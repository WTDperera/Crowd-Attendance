const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, getDoc, getDocs, collection, query, where, orderBy, setDoc, updateDoc, writeBatch } = require('firebase/firestore');
const { initializeApp, deleteApp } = require('firebase/app');
const { getAuth, connectAuthEmulator, signInWithEmailAndPassword } = require('firebase/auth');
const { getQaConfig } = require('../../web_app/admin-portal/server/qaConfig');
const { seed } = require('../scripts/fixtures.cjs');
const { assertEmulators } = require('../scripts/environment.cjs');
const identities = require('../fixtures/identities.json');
const qa = getQaConfig();
if (!qa) throw new Error('P04 requires the guarded local QA launcher');
const { auth, db, admin } = require('../../web_app/admin-portal/server/firebaseAdmin');
let env, server, base;
const apps = [];
const tokens = new Map();
const store = uid => env.authenticatedContext(uid).firestore();
const call = async (uid, path, method = 'GET', body) => {
  if (uid && !tokens.has(uid)) {
    const person = [...identities.students, ...identities.lecturers].find(p => p.uid === uid);
    const app = initializeApp({ projectId: qa.projectId, apiKey: 'qa-emulator-key' }, `p04-${uid}-${apps.length}`);
    apps.push(app);
    const clientAuth = getAuth(app);
    connectAuthEmulator(clientAuth, 'http://127.0.0.1:9099', { disableWarnings: true });
    const signedIn = await signInWithEmailAndPassword(clientAuth, person.email, identities.password);
    tokens.set(uid, await signedIn.user.getIdToken());
  }
  return fetch(`${base}${path}`, { method, headers: { 'Content-Type': 'application/json',
    ...(uid ? { Authorization: `Bearer ${tokens.get(uid)}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body) });
};
before(async () => {
  await assertEmulators();
  env = await initializeTestEnvironment({ projectId: qa.projectId, firestore: { host: '127.0.0.1', port: 8080,
    rules: fs.readFileSync('../web_app/admin-portal/firestore.rules', 'utf8') } });
  server = require('../../web_app/admin-portal/server/app').createApp().listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
beforeEach(async () => { await seed(); tokens.clear(); });
after(async () => {
  await Promise.all(apps.map(deleteApp)); await env?.cleanup();
  if (server) await new Promise(resolve => server.close(resolve));
  await seed(); await admin.app().delete();
});

test('P04 other lecturer cannot fetch export/module/student report metadata', async () => {
  for (const path of ['/api/attendance/export?moduleId=QA101', '/api/modules/QA101/attendance-summary',
    '/api/modules/QA101/students/qa-student-a/attendance-details', '/api/attendance/sessions?moduleId=QA101',
    '/api/attendance/module/QA101/summary', '/api/attendance/session/qa-s1/report']) {
    const response = await call('qa-lecturer-b', path);
    const data = await response.json();
    console.log(`P04 ownership probe ${path}: ${response.status}`);
    assert.equal(response.status, 403);
    assert.deepEqual(Object.keys(data), ['message']);
  }
});

test('P04 lecturers list only their own modules and owner report contracts pass', async () => {
  const modules = await (await call('qa-lecturer-a', '/api/modules')).json();
  assert.deepEqual(modules.modules.map(m => m.id), ['QA101']);
  for (const path of ['/api/attendance/export?moduleId=QA101', '/api/modules/QA101/attendance-summary',
    '/api/modules/QA101/students/qa-student-a/attendance-details', '/api/attendance/sessions?moduleId=QA101']) {
    const response = await call('qa-lecturer-a', path);
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(JSON.stringify(data).includes('enrollment_password'), false);
    assert.equal(typeof data, 'object');
    if (path.includes('/export?')) {
      assert.deepEqual(Object.keys(data).sort(), ['attendance_records', 'matrix', 'module', 'sessions', 'students']);
      assert.equal(data.module.id, 'QA101');
      for (const key of ['sessions', 'students', 'attendance_records']) assert.equal(Array.isArray(data[key]), true);
      assert.equal(typeof data.matrix, 'object');
    } else if (path.endsWith('/attendance-summary')) {
      assert.deepEqual(Object.keys(data).sort(), ['activeSession', 'module', 'students']);
      assert.equal(data.module.id, 'QA101');
      assert.equal(Array.isArray(data.students), true);
    } else if (path.endsWith('/attendance-details')) {
      assert.deepEqual(Object.keys(data), ['records']);
      assert.equal(Array.isArray(data.records), true);
    } else {
      assert.deepEqual(Object.keys(data), ['sessions']);
      assert.equal(Array.isArray(data.sessions), true);
      assert.deepEqual(data.sessions.map(session => session.id).sort(), ['qa-active', 'qa-s1']);
      for (const session of data.sessions) {
        assert.deepEqual(Object.keys(session).sort(), ['ended_at', 'id', 'started_at', 'status', 'student_count', 'students_present', 'topic']);
        assert.equal(Array.isArray(session.students_present), true);
        assert.equal(typeof session.student_count, 'number');
      }
    }
  }
});

test('P04 permitted catalog and own enrollment queries expose no secrets; raw modules remain private', async () => {
  const student = store('qa-student-a');
  const catalog = await assertSucceeds(getDocs(query(collection(student, 'module_catalog'), orderBy('code'))));
  assert.equal(catalog.size, 2);
  for (const entry of catalog.docs) assert.equal(JSON.stringify(entry.data()).includes('password'), false);
  await assertSucceeds(getDocs(collection(student, 'students/qa-student-a/enrollments')));
  await assertFails(getDoc(doc(student, 'modules/QA101')));
  await assertFails(getDoc(doc(student, 'module_secrets/QA101')));
  await assertFails(getDoc(doc(store('qa-lecturer-a'), 'module_secrets/QA101')));
  await assertFails(getDocs(collection(env.unauthenticatedContext().firestore(), 'module_catalog')));
  await assertFails(getDocs(collection(student, 'students/qa-student-b/enrollments')));
});

test('P04 password enrollment is authenticated, enabled, atomic and idempotent under concurrency', async () => {
  const endpoint = '/api/student/modules/QA202/enroll';
  await db.doc('students/qa-student-a').update({ enrolled_module_ids: ['QA101'], attendance_counts: { QA101: 1 } });
  await db.doc('students/qa-student-a/enrollments/QA202').delete();
  await db.doc('modules/QA202').update({ enrolled_count: 2 });
  assert.equal((await call(null, endpoint, 'POST', { password: identities.enrollmentPassword })).status, 401);
  assert.equal((await call('qa-lecturer-a', endpoint, 'POST', { password: identities.enrollmentPassword })).status, 403);
  assert.equal((await call('qa-student-a', endpoint, 'POST', { password: 'wrong' })).status, 403);
  await db.doc('modules/QA202').update({ enrollment_enabled: false });
  assert.equal((await call('qa-student-a', endpoint, 'POST', { password: identities.enrollmentPassword })).status, 409);
  await db.doc('modules/QA202').update({ enrollment_enabled: true });
  await call('qa-student-a', '/api/student/modules/missing/enroll', 'POST', { password: identities.enrollmentPassword }).then(r => assert.equal(r.status, 404));
  // Obtain one token before parallel requests so the helper does not race sign-in.
  await call('qa-student-a', '/api/student/modules/QA202/enroll', 'POST', { password: '' }).then(r => assert.equal(r.status, 400));
  const replies = await Promise.all([0, 1].map(() => call('qa-student-a', endpoint, 'POST', { password: identities.enrollmentPassword })));
  for (const response of replies) assert.equal(response.status, 200);
  const bodies = await Promise.all(replies.map(r => r.json()));
  for (const body of bodies) {
    assert.deepEqual(Object.keys(body).sort(), ['code', 'enrolled', 'moduleId', 'success']);
    assert.equal(body.success, true);
    assert.equal(body.moduleId, 'QA202');
    assert.equal(body.code, 'QA202');
  }
  assert.deepEqual(bodies.map(b => b.enrolled).sort(), [false, true]);
  assert.equal((await db.doc('modules/QA202').get()).get('enrolled_count'), 3);
  assert.deepEqual((await db.doc('students/qa-student-a').get()).get('enrolled_module_ids'), ['QA101', 'QA202']);
  assert.equal((await db.doc('students/qa-student-a').get()).get('attendance_counts.QA101'), 1);
  assert.equal((await db.doc('students/qa-student-a').get()).get('attendance_counts.QA202'), 0);
  assert.equal((await db.doc('students/qa-student-a/enrollments/QA202').get()).get('code'), 'QA202');
  assert.equal((await call('qa-student-a', endpoint, 'POST', { password: 'wrong' })).status, 403);
});

test('P04 direct enrollment/catalog/module count bypass and privileged counter changes fail', async () => {
  const student = store('qa-student-a');
  await assertFails(setDoc(doc(student, 'students/qa-student-a/enrollments/QA202'), { code: 'QA202' }));
  await assertFails(updateDoc(doc(student, 'students/qa-student-a'), { enrolled_module_ids: [] }));
  await assertFails(updateDoc(doc(student, 'modules/QA101'), { enrolled_count: 99 }));
  await assertFails(updateDoc(doc(store('qa-lecturer-a'), 'modules/QA101'), { enrolled_count: 99 }));
  await assertFails(setDoc(doc(store('qa-lecturer-a'), 'module_catalog/QA101'), { name: 'injected' }));
  await assertFails(updateDoc(doc(store('qa-lecturer-b'), 'students/qa-student-a'),
    { attendance_counts: { QA101: 42, QA202: 0 }, attendance_module_id: 'QA101' }));
});

test('P04 student own current/legacy attendance queries pass and cross-student writes/queries fail', async () => {
  const student = store('qa-student-a');
  for (const field of ['student_uid', 'student_id']) {
    for (const moduleField of ['module_id', 'module_code']) {
      const own = query(collection(student, 'attendance_records'), where(field, '==', 'qa-student-a'), where(moduleField, '==', 'QA101'));
      assert.equal((await assertSucceeds(getDocs(own))).size, 1);
      await assertFails(getDocs(query(collection(student, 'attendance_records'), where(field, '==', 'qa-student-c'))));
    }
  }
  const absent = store('qa-student-b');
  await assertSucceeds(getDocs(query(collection(absent, 'absence_records'), where('student_uid', '==', 'qa-student-b'), where('module_id', '==', 'QA101'))));
  await assertFails(updateDoc(doc(student, 'attendance_records/qa-s1_qa-student-a'), { status: 'present' }));
  await assertFails(getDocs(collection(student, 'attendance_records')));
});

test('P04 owner nested/root attendance permissions pass; other lecturer denied', async () => {
  const owner = store('qa-lecturer-a');
  await assertSucceeds(getDocs(collection(owner, 'active_sessions/qa-active/attendance')));
  await assertFails(getDocs(collection(store('qa-lecturer-b'), 'active_sessions/qa-active/attendance')));
  const data = { student_uid: 'qa-student-a', student_id: 'qa-student-a', module_id: 'QA101', module_code: 'QA101',
    session_id: 'qa-active', reg_no: 'QA001', status: 'pending', scan_count: 1 };
  await assertSucceeds(setDoc(doc(owner, 'active_sessions/qa-active/attendance/QA001'), data));
  await assertSucceeds(setDoc(doc(owner, 'attendance_records/qa-access-mark'), data));
  await assertSucceeds(updateDoc(doc(owner, 'attendance_records/qa-access-mark'), { scan_count: 2 }));
  await assertFails(updateDoc(doc(owner, 'attendance_records/qa-access-mark'), { student_uid: 'qa-student-c' }));
  await assertFails(setDoc(doc(store('qa-lecturer-b'), 'active_sessions/qa-active/attendance/QA002'), { ...data, student_uid: 'qa-student-b' }));
});

test('P04 malformed API contracts and attempts to manage lecturer identities fail without mutation', async () => {
  assert.equal((await call('qa-lecturer-a', '/api/attendance/export?moduleId[x]=QA101')).status, 400);
  assert.equal((await call('qa-lecturer-a', '/api/students/qa-lecturer-b', 'PATCH', { email: 'changed@example.test' })).status, 404);
  assert.equal((await auth.getUser('qa-lecturer-b')).email, identities.lecturers[1].email);
  assert.equal((await db.doc('students/qa-lecturer-b').get()).exists, false);
  assert.equal((await call('qa-lecturer-a', '/api/students/qa-lecturer-b', 'DELETE')).status, 404);
  assert.equal((await auth.getUser('qa-lecturer-b')).uid, 'qa-lecturer-b');
});

test('P04 trusted module management publishes safe metadata and refuses bypass/rebinding/deletion of referenced data', async () => {
  const hash = require('node:crypto').createHash('sha256').update(identities.enrollmentPassword).digest('hex');
  const payload = { code: 'QA303', name: 'QA New Module', lecturer_id: 'qa-lecturer-a',
    enrollment_enabled: true, enrollment_password_hash: hash };
  assert.equal((await call('qa-student-a', '/api/modules', 'POST', payload)).status, 403);
  const created = await call('qa-lecturer-a', '/api/modules', 'POST', payload);
  assert.equal(created.status, 201);
  const data = await created.json();
  assert.equal(data.module.id, 'QA303');
  assert.equal(JSON.stringify(data).includes(hash), false);
  assert.equal((await db.doc('modules/QA303').get()).get('enrollment_password_hash'), undefined);
  assert.equal((await db.doc('module_secrets/QA303').get()).get('enrollment_password_hash'), hash);
  assert.equal((await call('qa-lecturer-a', '/api/modules', 'POST', payload)).status, 409);
  assert.equal((await call('qa-lecturer-b', '/api/modules/QA303', 'PATCH', { name: 'QA Intrusion', enrollment_enabled: true })).status, 403);
  assert.equal((await call('qa-lecturer-a', '/api/modules/QA303', 'PATCH', { name: 'QA Updated', enrollment_enabled: false })).status, 200);
  assert.equal((await db.doc('module_catalog/QA303').get()).get('name'), 'QA Updated');
  assert.equal((await call('qa-lecturer-a', '/api/modules/QA101', 'DELETE')).status, 409);
  assert.equal((await call('qa-lecturer-a', '/api/modules/QA303', 'DELETE')).status, 200);
  for (const path of ['modules', 'module_catalog', 'module_secrets']) assert.equal((await db.doc(`${path}/QA303`).get()).exists, false);
});

test('P04 owner-only counter context and module/catalog mirroring retain legitimate mobile writes', async () => {
  const owner = store('qa-lecturer-a');
  const ref = doc(owner, 'students/qa-student-a');
  await assertSucceeds(updateDoc(ref, { 'attendance_counts.QA101': 2, attendance_module_id: 'QA101' }));
  await assertFails(updateDoc(ref, { 'attendance_counts.QA202': 10, attendance_module_id: 'QA101' }));
  const batch = writeBatch(owner);
  batch.update(doc(owner, 'modules/QA101'), { total_sessions: 2, session_dates: [] });
  batch.update(doc(owner, 'module_catalog/QA101'), { total_sessions: 2, session_dates: [] });
  await assertSucceeds(batch.commit());
  await assertFails(updateDoc(doc(owner, 'module_catalog/QA101'), { total_sessions: 3 }));
  await assertFails(updateDoc(doc(store('qa-lecturer-b'), 'modules/QA101'), { total_sessions: 9 }));
  await assertFails(setDoc(doc(owner, 'active_sessions/qa-cross-module'), { lecturer_id: 'qa-lecturer-a', module_id: 'QA202' }));
});

test('P04 global lecturer student CRUD removes access and retains historical records, identity and counts', async () => {
  const created = await call('qa-lecturer-b', '/api/students', 'POST',
    { email: 'qa.crud@example.test', password: identities.password, reg_no: 'QACRUD' });
  assert.equal(created.status, 201);
  const data = await created.json();
  assert.equal(data.student.reg_no, 'QACRUD');
  assert.equal(data.student.id, data.uid);
  assert.equal((await call('qa-lecturer-a', `/api/students/${data.uid}`, 'PATCH', { reg_no: 'QAEDIT' })).status, 200);
  assert.equal((await call('qa-lecturer-a', `/api/students/${data.uid}`, 'PATCH', { device_id: 'reset' })).status, 400);
  assert.equal((await call('qa-lecturer-a', `/api/students/${data.uid}`, 'DELETE')).status, 200);
  await assert.rejects(auth.getUser(data.uid), { code: 'auth/user-not-found' });
  await call('qa-student-a', '/api/student/modules/QA101/enroll', 'POST', { password: identities.enrollmentPassword });
  assert.equal((await call('qa-lecturer-b', '/api/students/qa-student-a', 'DELETE')).status, 200);
  assert.equal((await db.doc('students/qa-student-a').get()).exists, false);
  assert.equal((await db.doc('student_history/qa-student-a').get()).get('reg_no'), 'QA001');
  assert.equal((await db.doc('attendance_records/qa-s1_qa-student-a').get()).exists, true);
  assert.equal((await db.doc('modules/QA101').get()).get('enrolled_count'), 2);
  assert.equal((await call('qa-lecturer-b', '/api/students/qa-student-a', 'DELETE')).status, 200);
  assert.equal((await db.doc('modules/QA101').get()).get('enrolled_count'), 2);
  assert.equal((await call('qa-student-a', '/api/student/modules/QA101/enroll', 'POST', { password: identities.enrollmentPassword })).status, 401);
  await assertFails(getDocs(collection(store('qa-student-a'), 'module_catalog')));
  const report = await (await call('qa-lecturer-a', '/api/attendance/export?moduleId=QA101')).json();
  assert.equal(JSON.stringify(report).includes('QA001'), true);
});

test('P04 injected create/delete partial failures are recoverable without orphan access or double count', async () => {
  const { createStudent, deleteStudent } = require('../../web_app/admin-portal/server/services/studentManagement');
  let failedUid;
  await assert.rejects(createStudent({ email: 'qa.failure@example.test', password: identities.password, reg_no: 'QAFAIL' }, {
    authClient: { createUser: async input => { const user = await auth.createUser(input); failedUid = user.uid; return user; },
      deleteUser: uid => auth.deleteUser(uid) },
    database: { doc: () => ({ create: async () => { throw new Error('Injected profile persistence failure'); } }) },
  }), /Injected/);
  await assert.rejects(auth.getUser(failedUid), { code: 'auth/user-not-found' });
  await assert.rejects(deleteStudent('qa-student-c', { authClient: {
    updateUser: (uid, input) => auth.updateUser(uid, input),
    deleteUser: async () => { throw new Error('Injected Auth deletion failure'); },
  } }), /Injected/);
  assert.equal((await db.doc('students/qa-student-c').get()).exists, false);
  assert.equal((await auth.getUser('qa-student-c')).disabled, true);
  assert.equal((await db.doc('student_deletions/qa-student-c').get()).get('state'), 'profile_removed');
  assert.equal((await db.doc('modules/QA101').get()).get('enrolled_count'), 2);
  await deleteStudent('qa-student-c');
  await assert.rejects(auth.getUser('qa-student-c'), { code: 'auth/user-not-found' });
  assert.equal((await db.doc('modules/QA101').get()).get('enrolled_count'), 2);
  assert.equal((await db.doc('absence_records/qa-s1_qa-student-c').get()).exists, true);
});
