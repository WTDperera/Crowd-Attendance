const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { performance } = require('node:perf_hooks');
const { spawnSync } = require('node:child_process');
const { qaEnvironment, assertEmulators } = require('../scripts/environment.cjs');
const { seed } = require('../scripts/fixtures.cjs');
const { initializeApp, deleteApp } = require('firebase/app');
const { getAuth, connectAuthEmulator, signInWithEmailAndPassword } = require('firebase/auth');
const identities = require('../fixtures/identities.json');
// No arbitrary target, user count, duration or credentials can be submitted.
if (process.argv.length !== 2) throw Error('P10 load accepts no arguments.');
qaEnvironment();
if (!require('../../web_app/admin-portal/server/qaConfig').getQaConfig()) throw Error('Explicit QA environment required');
let server, base, db, admin;
const apps = [], tokens = {}, samples = [];
const sid = 'p10-load-session';
const { idFor } = require('../../web_app/admin-portal/server/services/sessionFinalization');
const phase = { value: 'setup' };
function safeTarget(url) {
  const parsed = new URL(url);
  if (parsed.origin !== base || parsed.hostname !== '127.0.0.1' || parsed.protocol !== 'http:') throw Error('Refusing non-owned API target');
}
async function start() {
  server = require('../../web_app/admin-portal/server/app').createApp().listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
}
async function call(uid, endpoint, method = 'GET', body, expected = 200) {
  const url = base + endpoint; safeTarget(url); const begin = performance.now();
  let status = 'network_error';
  try {
    const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens[uid]}` },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000) });
    status = response.status; const data = await response.json();
    assert.equal(status, expected); return data;
  } catch (error) {
    if (!(expected === 'network_error' && error instanceof TypeError && error.message === 'fetch failed')) throw error;
  } finally { samples.push({ phase: phase.value, endpoint, status, expected, ms: +(performance.now() - begin).toFixed(2) }); }
}
async function bounded(total, concurrency, task) {
  let next = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => { while (next < total) { const index = next++; await task(index); } }));
}
async function prepare() {
  const roster = Object.fromEntries(identities.students.map(s => [s.uid, s.reg_no]));
  await db.doc(`active_sessions/${sid}`).set({ session_id: sid, lecturer_id: 'qa-lecturer-a', module_id: 'QA101', module_code: 'QA101',
    status: 'active', round_schema: 2, eligible_roster: roster, active_round_id: null, rounds_started: 2, scans_performed: 2,
    students_present: [], student_count: 0, started_at: admin.firestore.Timestamp.now() });
  for (const [uid, reg] of Object.entries(roster)) await db.doc(`active_sessions/${sid}/roster/${uid}`).set({ student_uid: uid, reg_no: reg, module_id: 'QA101' });
  for (let round = 1; round <= 2; round++) {
    await db.doc(`active_sessions/${sid}/rounds/r${round}`).set({ round_id: `r${round}`, ordinal: round, status: 'completed' });
    for (const uid of round === 1 ? ['qa-student-a', 'qa-student-c'] : ['qa-student-a']) {
      await db.doc(`active_sessions/${sid}/rounds/r${round}/observations/${uid}`).set({ round_id: `r${round}`, student_uid: uid });
    }
  }
  // Reopen enrollment for A to verify competing API retries increment once.
  await db.doc('students/qa-student-a').update({ enrolled_module_ids: ['QA101'], attendance_counts: { QA101: 1, QA202: 0 } });
  await db.doc('students/qa-student-a/enrollments/QA202').delete();
  await db.doc('modules/QA202').update({ enrolled_count: 2 });
}
async function reconcile(corrected) {
  const session = (await db.doc(`active_sessions/${sid}`).get()).data();
  assert.equal(session.status, 'completed'); assert.equal(session.student_count, corrected ? 2 : 1);
  assert.deepEqual(session.students_present, corrected ? ['qa-student-a', 'qa-student-b'] : ['qa-student-a']);
  assert.equal((await db.doc('modules/QA101').get()).get('total_sessions'), 2);
  assert.equal((await db.doc('module_catalog/QA101').get()).get('total_sessions'), 2);
  assert.equal((await db.doc('modules/QA202').get()).get('enrolled_count'), 3);
  assert.equal((await db.collectionGroup('observations').get()).size, 3);
  const expected = ['present', corrected ? 'excused' : 'absent', 'left_early'];
  for (const [index, uid] of identities.students.map(s => s.uid).entries()) {
    const row = (await db.doc(`attendance_records/${idFor(sid, uid)}`).get()).data();
    assert.equal(row.final_status, expected[index]); assert.equal(row.scan_count, [2, 0, 1][index]);
    assert.deepEqual((await db.doc(`active_sessions/${sid}/attendance/${uid}`).get()).data(), row);
    const credit = index === 0 || (index === 1 && corrected);
    assert.equal((await db.doc(`absence_records/${sid}_${uid}`).get()).exists, !credit);
    const student = (await db.doc(`students/${uid}`).get()).data();
    assert.equal(student.attendance_counts.QA101, Number(index === 0) + Number(credit));
    assert.equal(student.absence_counts.QA101, Number(index !== 0) + Number(!credit));
  }
  assert.equal((await db.collection(`active_sessions/${sid}/corrections`).get()).size, corrected ? 1 : 0);
  assert.equal((await admin.auth().listUsers()).users.length, 5);
  assert.equal((await db.collection('students').get()).size, 3);
  const report = await call('qa-lecturer-a', `/api/attendance/session/${sid}/report`);
  assert.equal(report.records.length, 3);
  return { status: session.status, studentCount: session.student_count, classTotal: 2, observations: 3, outcomes: expected, authUsers: 5, corrections: corrected ? 1 : 0 };
}
(async () => {
  const started = performance.now();
  for (let attempt = 0; ; attempt++) {
    try { await assertEmulators(); break; } catch (error) {
      if (attempt === 4 || !(error.name === 'TimeoutError' || (error instanceof TypeError && error.message === 'fetch failed'))) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  await seed(); ({ db, admin } = require('../../web_app/admin-portal/server/firebaseAdmin'));
  for (const person of [identities.lecturers[0], identities.students[0]]) {
    const app = initializeApp({ projectId: 'demo-crowd-attendance-qa', apiKey: 'qa-emulator-key' }, `p10-${person.uid}`); apps.push(app);
    const auth = getAuth(app); connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    tokens[person.uid] = await (await signInWithEmailAndPassword(auth, person.email, identities.password)).user.getIdToken();
  }
  await start(); assert.throws(() => safeTarget('https://example.com')); assert.throws(() => safeTarget('http://127.0.0.1:5000'));
  await prepare();
  phase.value = 'mixed-load'; const loadStart = performance.now();
  await bounded(120, 6, index => index % 3 === 0
    ? call('qa-student-a', '/api/student/modules/QA202/enroll', 'POST', { password: identities.enrollmentPassword })
    : call('qa-lecturer-a', index % 3 === 1 ? '/api/attendance/export?moduleId=QA101' : '/api/students'));
  const loadMs = performance.now() - loadStart;
  const { finalizeSession, correctAttendance } = require('../../web_app/admin-portal/server/services/sessionFinalization');
  phase.value = 'failed-commit';
  await assert.rejects(finalizeSession({ sessionId: sid, actor: 'qa-lecturer-a', beforeCommit: tx => tx.update(db.doc('p10_fault/missing'), { reject: true }) }));
  assert.equal((await db.doc(`active_sessions/${sid}`).get()).get('status'), 'active');
  assert.equal((await db.doc('modules/QA101').get()).get('total_sessions'), 1);
  assert.equal((await db.collection(`active_sessions/${sid}/attendance`).get()).size, 0);
  phase.value = 'completion-retries';
  await bounded(6, 3, () => call('qa-lecturer-a', `/api/attendance/session/${sid}/complete`, 'POST', {}));
  const beforeFault = await reconcile(false);
  phase.value = 'lost-ack';
  await assert.rejects(correctAttendance({ sessionId: sid, actor: 'qa-lecturer-a', correction: { uid: 'qa-student-b', status: 'Excused', reason: 'Synthetic P10 recovery' },
    afterCommit: () => { throw Error('Simulated lost acknowledgement'); } }), /lost acknowledgement/);
  phase.value = 'api-outage';
  await new Promise(resolve => server.close(resolve));
  await bounded(3, 1, () => call('qa-lecturer-a', '/api/students', 'GET', undefined, 'network_error'));
  await start();
  phase.value = 'soak'; const soakStart = performance.now();
  // 30 seconds, four sequential operations every two seconds; no unbounded loop.
  for (let tick = 0; tick < 15; tick++) {
    await call('qa-lecturer-a', `/api/attendance/session/${sid}/mark`, 'POST', { student_uid: 'qa-student-b', status: 'Excused', reason: 'Synthetic P10 recovery' });
    await call('qa-lecturer-a', `/api/attendance/session/${sid}/complete`, 'POST', {});
    await call('qa-student-a', '/api/student/modules/QA202/enroll', 'POST', { password: identities.enrollmentPassword });
    await call('qa-lecturer-a', '/api/attendance/export?moduleId=QA101');
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  const soakMs = performance.now() - soakStart;
  const afterFault = await reconcile(true);
  const summarize = rows => {
    const sorted = rows.map(r => r.ms).sort((a,b) => a-b); const q = p => sorted[Math.max(0, Math.ceil(sorted.length*p)-1)];
    return { requests: rows.length, statuses: Object.fromEntries([...new Set(rows.map(r => r.status))].map(s => [s, rows.filter(r => r.status === s).length])),
      unexpected: rows.filter(r => r.status !== r.expected).length, latencyMs: { min: sorted[0], p50: q(.5), p95: q(.95), p99: q(.99), max: sorted.at(-1) } };
  };
  const report = { observedAt: new Date().toISOString(), baseline: spawnSync('git', ['rev-parse', 'HEAD'], {encoding:'utf8',windowsHide:true}).stdout.trim(),
    fixture: 'synthetic base v1 + P10 two-round fixed roster', environment: { platform: os.platform(), release: os.release(), arch: os.arch(),
      cpu: os.cpus()[0].model, logicalCpus: os.cpus().length, totalMemoryGiB: +(os.totalmem()/2**30).toFixed(2), node: process.version,
      java: spawnSync('java', ['-version'], {encoding:'utf8',windowsHide:true}).stderr.split('\n')[0], project: 'demo-crowd-attendance-qa', concurrency: 6 },
    totalMs: +(performance.now()-started).toFixed(2), loadMs: +loadMs.toFixed(2), loadRequestsPerSecond: +(120/(loadMs/1000)).toFixed(2), soakMs: +soakMs.toFixed(2),
    faults: ['one rejected atomic commit, no partial state', 'one committed correction with lost acknowledgement', 'owned API stopped for three failed reads then restarted'],
    beforeFault, afterFault, summary: summarize(samples), phases: Object.fromEntries([...new Set(samples.map(r=>r.phase))].map(p=>[p,summarize(samples.filter(r=>r.phase===p))])), samples };
  assert.equal(report.summary.unexpected, 0);
  fs.mkdirSync(path.resolve('artifacts/p10'), {recursive:true}); fs.writeFileSync(path.resolve('artifacts/p10/load.json'), JSON.stringify(report,null,2));
  console.log(JSON.stringify({ loadMs: report.loadMs, soakMs: report.soakMs, summary: report.summary, reconciliation: afterFault }));
})().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(async () => {
  if (server?.listening) await new Promise(resolve => server.close(resolve));
  await Promise.all(apps.map(deleteApp));
  if (admin) { await seed(); await admin.app().delete(); }
});
