const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { assertEmulators } = require('../scripts/environment.cjs');
const { seed } = require('../scripts/fixtures.cjs');
const { initializeApp, deleteApp } = require('firebase/app');
const { getAuth, connectAuthEmulator, signInWithEmailAndPassword } = require('firebase/auth');
const identities = require('../fixtures/identities.json');
let server, base, app, token, db, admin;
before(async () => {
  await assertEmulators(); await seed();
  ({ db, admin } = require('../../web_app/admin-portal/server/firebaseAdmin'));
  app = initializeApp({ projectId: 'demo-crowd-attendance-qa', apiKey: 'qa-emulator-key' }, 'p10-security');
  const auth = getAuth(app); connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const user = await signInWithEmailAndPassword(auth, identities.lecturers[0].email, identities.password);
  token = await user.user.getIdToken();
  server = require('../../web_app/admin-portal/server/app').createApp().listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  if (app) await deleteApp(app);
  if (admin) { await seed(); await admin.app().delete(); }
});
async function request(path, body, options = {}) {
  return fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options.headers },
    body: options.raw ?? JSON.stringify(body), signal: AbortSignal.timeout(15000) });
}
async function rejected(response, status) {
  assert.equal(response.status, status);
  assert.match(response.headers.get('content-type'), /application\/json/);
  const text = await response.text();
  assert.deepEqual(Object.keys(JSON.parse(text)), ['message']);
  assert.doesNotMatch(text, /SyntaxError|node_modules|at \w+\s*\(|QA-only|injected-marker/);
}
test('P10 malformed and oversized JSON return safe JSON without parser traces or payload echo', async () => {
  await rejected(await request('/api/auth/login', null, { raw: '{"password":"injected-marker",' }), 400);
  await rejected(await request('/api/auth/login', { email: 'x'.repeat(110000), password: 'injected-marker' }), 413);
  await rejected(await request('/api/auth/login', null, { raw: 'null' }), 400);
});
test('P10 login rejects objects, arrays, unexpected fields and bounded invalid values before Auth', async () => {
  for (const body of [{ email: {}, password: {} }, [], { email: 'x'.repeat(400), password: 'test' },
    { email: identities.lecturers[0].email, password: identities.password, returnSecureToken: false }]) {
    await rejected(await request('/api/auth/login', body), 400);
  }
});
test('P10 encoded Firestore path injection and duplicate query values are rejected', async () => {
  await rejected(await fetch(base + '/api/attendance/session/qa-s1%2Fattendance%2FQA001/report', {
    headers: { Authorization: `Bearer ${token}` } }), 400);
  await rejected(await fetch(base + '/api/attendance/export?moduleId=QA101&moduleId=QA202', {
    headers: { Authorization: `Bearer ${token}` } }), 400);
});
test('P10 mass assignment and malformed correction cannot mutate ledger or create users', async () => {
  const before = (await db.doc('active_sessions/qa-s1').get()).data();
  for (const body of [[], { student_uid: 'qa-student-a', status: 'Present', scan_count: 999 },
    { student_uid: {}, status: 'Present' }, { student_uid: 'qa-student-a', status: 'Excused', reason: 'x'.repeat(501) }]) {
    await rejected(await request('/api/attendance/session/qa-s1/mark', body), 400);
  }
  await rejected(await request('/api/students', { email: 'injected@example.test', password: identities.password,
    reg_no: 'QA999', role: 'lecturer', attendance_counts: { QA101: 999 } }), 400);
  assert.deepEqual((await db.doc('active_sessions/qa-s1').get()).data(), before);
  assert.equal((await db.collection('students').get()).size, 3);
  assert.equal((await db.collection('lecturers').get()).size, 2);
  await rejected(await request('/api/attendance/session/qa-active/complete', { beforeCommit: 'injected-marker', total_sessions: 999 }), 400);
  assert.equal((await db.doc('active_sessions/qa-active').get()).get('status'), 'active');
});
test('P10 unexpected storage errors return a generic message without internal exception text', async () => {
  const original = db.runTransaction;
  db.runTransaction = async () => { throw Error('injected-marker internal storage credentials'); };
  try { await rejected(await request('/api/attendance/session/qa-active/complete', {}), 500); }
  finally { db.runTransaction = original; }
});
test('P10 denied CORS origin receives no permission and invalid bearer cannot read data', async () => {
  const response = await fetch(base + '/api/students', { headers: { Origin: 'https://untrusted.invalid', Authorization: 'Bearer invalid' } });
  assert.equal(response.headers.get('access-control-allow-origin'), null);
  await rejected(response, 401);
});
