const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, getDoc } = require('firebase/firestore');
const { initializeApp, deleteApp } = require('firebase/app');
const { getAuth, connectAuthEmulator, signInWithCustomToken, signOut } = require('firebase/auth');
const { assertEmulators } = require('../scripts/environment.cjs');
const { getQaConfig } = require('../../web_app/admin-portal/server/qaConfig');
const identities = require('../fixtures/identities.json');
const qa = getQaConfig();
if (!qa) throw new Error('Run using npm run smoke; live tests are forbidden');
const { auth, db, admin } = require('../../web_app/admin-portal/server/firebaseAdmin');
after(async () => { await admin.app().delete(); });

test('repeat seed leaves five auth users, two modules and expected baseline records', async () => {
  await assertEmulators();
  assert.equal((await auth.listUsers()).users.length, 5);
  assert.equal((await db.collection('modules').get()).size, 2);
  assert.equal((await db.collection('students').get()).size, 3);
  assert.equal((await db.collection('attendance_records').get()).size, 2);
  assert.equal((await db.doc('modules/QA101').get()).get('total_sessions'), 1);
  assert.equal((await db.doc('modules/QA202').get()).get('total_sessions'), 0);
});

test('actual rules harness allows owner module read and denies anonymous read', async () => {
  const env = await initializeTestEnvironment({ projectId: qa.projectId,
    firestore: { host: '127.0.0.1', port: 8080,
      rules: fs.readFileSync('../web_app/admin-portal/firestore.rules', 'utf8') } });
  try {
    const owner = env.authenticatedContext('qa-lecturer-a').firestore();
    await assertSucceeds(getDoc(doc(owner, 'modules/QA101')));
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'modules/QA101')));
  } finally { await env.cleanup(); }
});

test('API bootstrap logs in via Auth emulator; web SDK exchanges custom token locally', async () => {
  const { createApp } = require('../../web_app/admin-portal/server/app');
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const client = initializeApp({ projectId: qa.projectId, apiKey: 'qa-emulator-key' }, 'qa-smoke-web');
  const clientAuth = getAuth(client);
  connectAuthEmulator(clientAuth, 'http://127.0.0.1:9099', { disableWarnings: true });
  try {
    const denied = await fetch(`${base}/api/students`);
    assert.equal(denied.status, 401);
    const response = await fetch(`${base}/api/auth/login`, { method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: identities.lecturers[0].email, password: identities.password }) });
    assert.equal(response.status, 200);
    const body = await response.json();
    const signedIn = await signInWithCustomToken(clientAuth, body.token);
    assert.equal(signedIn.user.uid, 'qa-lecturer-a');
    const token = await signedIn.user.getIdToken();
    const listed = await fetch(`${base}/api/students`, { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(listed.status, 200);
    assert.equal((await listed.json()).students.length, 3);
  } finally {
    await signOut(clientAuth);
    await deleteApp(client);
    await new Promise(resolve => server.close(resolve));
  }
});
