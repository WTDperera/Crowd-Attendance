const {
  test,
  before,
  beforeEach,
  after
} = require('node:test');
const assert = require('node:assert/strict');
const {
  seed
} = require('../scripts/fixtures.cjs');
const {
  assertEmulators
} = require('../scripts/environment.cjs');
const {
  getQaConfig
} = require('../../web_app/admin-portal/server/qaConfig');
if (!getQaConfig()) throw Error('Local QA required');
const {
  db,
  admin
} = require('../../web_app/admin-portal/server/firebaseAdmin');
let server, base;
async function get(path, uid = 'qa-lecturer-a', body) {
  const token = await admin.auth().createCustomToken(uid);
  const exchange = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=qa-key', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      token,
      returnSecureToken: true
    })
  });
  const {
    idToken
  } = await exchange.json();
  const res = await fetch(base + path, {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  return {
    status: res.status,
    data: await res.json()
  };
}
before(async () => {
  await assertEmulators();
  server = require('../../web_app/admin-portal/server/app').createApp().listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
beforeEach(seed);
after(async () => {
  if (server) await new Promise(r => server.close(r));
  await seed();
  await admin.app().delete();
});
test('P07 profile counters cannot override class ledger', async () => {
  await db.doc('students/qa-student-a').update({
    'attendance_counts.QA101': 99
  });
  const {
    status,
    data
  } = await get('/api/modules/QA101/attendance-summary');
  assert.equal(status, 200);
  assert.equal(data.students.find(s => s.uid === 'qa-student-a').present_count, 1);
});
test('P07 zero-session owner export and exact 4/5 eligibility agree with stored classes', async () => {
  const zero = (await get('/api/attendance/export?moduleId=QA202', 'qa-lecturer-b')).data;
  assert.equal(zero.sessions.length, 0);
  assert.deepEqual(zero.matrix.map(r => [r.present, r.total, r.percentage, r.eligible]), [[0,0,0,false],[0,0,0,false],[0,0,0,false]]);
  for(let n=2;n<=5;n++) {
    await db.doc(`active_sessions/threshold-${n}`).set({module_id:'QA101',lecturer_id:'qa-lecturer-a',status:'completed',eligible_roster:{'qa-student-a':'QA001'}});
    if(n<5) await db.doc(`attendance_records/threshold-${n}`).set({session_id:`threshold-${n}`,student_uid:'qa-student-a',status:'present'});
  }
  const row=(await get('/api/attendance/module/QA101/summary')).data.summary_by_uid['qa-student-a'];
  assert.deepEqual([row.present,row.total,row.percentage,row.eligible],[4,5,80,true]);
  const own=(await get('/api/student/attendance-summary','qa-student-a')).data.modules[0].stats;
  assert.deepEqual([own.present,own.total,own.percentage,own.eligible],[4,5,80,true]);
});
test('P07 independent base ledger agrees across session, module, portal, dashboard, student and XLSX', async () => {
  const exported = (await get('/api/attendance/export?moduleId=QA101')).data;
  assert.deepEqual(Object.keys(exported).sort(), ['attendance_records', 'matrix', 'module', 'sessions', 'students']);
  assert.deepEqual(exported.matrix.map(r => r.session_values), [[1], [0], [0]]);
  assert.deepEqual(exported.matrix.map(r => [r.present, r.total, r.percentage, r.eligible]), [[1, 1, 100, true], [0, 1, 0, false], [0, 1, 0, false]]);
  const report = (await get('/api/attendance/session/qa-s1/report')).data;
  assert.deepEqual(report.records.map(r => r.final_status), ['present', 'absent', 'left_early']);
  assert.deepEqual(report.records.map(r => r.saved_status), ['Present', 'Absent', 'Left Early']);
  assert.deepEqual(report.totals, {
    total_students: 3,
    total_present: 1,
    total_excused: 0,
    total_absent: 2,
    attendance_percentage: 33.33
  });
  const summary = (await get('/api/attendance/module/QA101/summary')).data;
  assert.deepEqual(summary.students.map(s => s.present), [1, 0, 0]);
  assert.equal(summary.total_sessions, 1);
  const portal = (await get('/api/modules/QA101/attendance-summary')).data;
  assert.deepEqual(Object.keys(portal).sort(), ['activeSession', 'module', 'students']);
  assert.deepEqual(portal.students.map(s => s.present_count), [1, 0, 0]);
  const dashboard = (await get('/api/attendance/dashboard-summary')).data[0];
  assert.deepEqual([dashboard.presentMarks, dashboard.absentMarks, dashboard.percentage], [1, 2, 33.33]);
  const own = (await get('/api/student/attendance-summary', 'qa-student-a')).data;
  assert.deepEqual(own.modules.map(m => [m.stats.present, m.stats.total, m.stats.percentage, m.stats.eligible]), [[1, 1, 100, true], [0, 0, 0, false]]);
  assert(!JSON.stringify(own).includes('qa-student-b'));
  assert(!JSON.stringify(own).includes('QA002'));
  const XLSX = require('../../web_app/admin-portal/frontend/node_modules/xlsx-js-style');
  const {
    buildAttendanceWorkbook,
    buildSessionWorkbook
  } = await import('../../web_app/admin-portal/frontend/src/services/attendanceWorkbook.js');
  for (const [builder, data, name, cell, expected] of [[buildAttendanceWorkbook, exported, 'Attendance Matrix', 'F6', 100], [buildSessionWorkbook, report, 'Session Attendance', 'C14', 33.33]]) {
    const {
      workbook
    } = builder(data);
    const decoded = XLSX.read(XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx'
    }), {
      type: 'buffer',
      cellFormula: true
    });
    assert.equal(decoded.Sheets[name][cell].v, expected);
    assert(decoded.Sheets[name][cell].f);
  }
});
test('P07 real correction overrides stale absence in every report without rewriting evidence', async () => {
  const corrected = await get('/api/attendance/session/qa-s1/mark', 'qa-lecturer-a', {
    student_uid: 'qa-student-c',
    status: 'Excused'
  });
  assert.equal(corrected.status, 200);
  await db.doc('absence_record/stale-c').set({
    session_id: 'qa-s1',
    student_id: 'qa-student-c',
    status: 'Absent'
  });
  const exportData = (await get('/api/attendance/export?moduleId=QA101')).data;
  assert.deepEqual(exportData.matrix.map(r => r.session_values), [[1], [0], ['ex']]);
  const detail = (await get('/api/modules/QA101/students/qa-student-c/attendance-details')).data;
  assert.deepEqual(Object.keys(detail), ['records']);
  assert.deepEqual(detail.records.map(r => r.status), ['excused']);
  const own = (await get('/api/student/attendance-summary', 'qa-student-c')).data.modules[0];
  assert.deepEqual([own.stats.present, own.stats.total, own.stats.percentage], [1, 1, 100]);
  const summary = (await get('/api/attendance/module/QA101/summary')).data.summary_by_uid['qa-student-c'];
  assert.equal(summary.present, 1);
  const dashboard = (await get('/api/attendance/dashboard-summary')).data[0];
  assert.equal(dashboard.percentage, 66.67);
  const session = (await get('/api/attendance/session/qa-s1/report')).data;
  assert.equal(session.totals.total_excused, 1);
  assert.deepEqual(session.records.map(r => r.saved_status), ['Present', 'Absent', 'Excused']);
  assert.equal((await db.doc('absence_record/stale-c').get()).exists, true);
  assert.equal((await db.doc('attendance_records/qa-s1_qa-student-c').get()).get('scan_count'), 2);
});
test('P07 fixed roster controls denominators after enrollment and deletion, with N/A for later joiners', async () => {
  await db.doc('active_sessions/qa-s1').update({
    eligible_roster: {
      'qa-student-a': 'QA001',
      'qa-student-b': 'QA002'
    }
  });
  const b = (await db.doc('students/qa-student-b').get()).data();
  await db.doc('student_history/qa-student-b').set(b);
  await db.doc('students/qa-student-b').delete();
  const data = (await get('/api/attendance/export?moduleId=QA101')).data;
  assert.deepEqual(data.matrix.map(r => r.session_values), [[1], [0], [null]]);
  assert.deepEqual(data.matrix.map(r => r.total), [1, 1, 0]);
  assert.deepEqual((await get('/api/attendance/session/qa-s1/report')).data.totals, {
    total_students: 2,
    total_present: 1,
    total_excused: 0,
    total_absent: 1,
    attendance_percentage: 50
  });
  assert.equal((await get('/api/attendance/dashboard-summary')).data[0].percentage, 50);
});
test('P07 completed fixed-roster student history survives changed current enrollment', async () => {
  await db.doc('active_sessions/qa-s1').update({
    eligible_roster: {
      'qa-student-a': 'QA001',
      'qa-student-b': 'QA002',
      'qa-student-c': 'QA003'
    }
  });
  await db.doc('students/qa-student-a').update({
    enrolled_module_ids: ['QA202']
  });
  const modules = (await get('/api/student/attendance-summary', 'qa-student-a')).data.modules;
  const own = modules.find(m => m.module.module_code === 'QA101');
  assert(own);
  assert.equal(own.stats.present, 1);
  assert.equal(own.stats.total, 1);
  const exportData = (await get('/api/attendance/export?moduleId=QA101')).data;
  assert.equal(exportData.matrix.find(s => s.student_uid === 'qa-student-a').reg_no, 'QA001');
});
test('P07 legacy field aliases deduplicate once and conflicting evidence is flagged', async () => {
  await db.doc('active_sessions/legacy').set({
    module: 'QA101',
    lecturer_id: 'qa-lecturer-a',
    status: 'completed',
    started_at: admin.firestore.Timestamp.fromDate(new Date('2026-10-02T08:00Z'))
  });
  await db.doc('attendance_record/old').set({
    session_id: 'legacy',
    student_id: 'qa-student-a',
    status: 'Late'
  });
  await db.doc('attendance_records/duplicate').set({
    session_id: 'legacy',
    student_uid: 'qa-student-a',
    status: 'late'
  });
  await db.doc('attendance_record/conflict').set({
    session_id: 'qa-s1',
    student_id: 'qa-student-a',
    status: 'Absent'
  });
  const data = (await get('/api/attendance/export?moduleId=QA101')).data;
  assert.equal(data.sessions.length, 2);
  assert.deepEqual(data.matrix[0].session_values, [0, 1]);
  assert.equal(data.matrix[0].present, 1);
  assert.deepEqual(data.matrix[0].conflicts, ['qa-s1']);
  assert.equal((await get('/api/attendance/session/qa-s1/report')).data.records[0].saved_status, 'Conflict');
});
test('P07 active, pending and cancelled classes never enter final report counts', async () => {
  for (const status of ['pending', 'cancelled']) await db.doc('active_sessions/' + status).set({
    module_id: 'QA101',
    lecturer_id: 'qa-lecturer-a',
    status
  });
  await db.doc('attendance_record/provisional').set({
    session_id: 'qa-active',
    student_uid: 'qa-student-c',
    status: 'present'
  });
  assert.equal((await get('/api/attendance/export?moduleId=QA101')).data.sessions.length, 1);
  assert.equal((await get('/api/attendance/session/qa-active/report')).status, 409);
});
test('P07 invalid date filters refuse; colliding local dates retain both columns', async () => {
  for (const query of ['startDate=2026-02-30', 'startDate=2026-10-03&endDate=2026-10-02', 'startDate=bad']) assert.equal((await get('/api/attendance/export?moduleId=QA101&' + query)).status, 400);
  await db.doc('active_sessions/same-day').set({
    module_id: 'QA101',
    lecturer_id: 'qa-lecturer-a',
    status: 'completed',
    start_time: admin.firestore.Timestamp.fromDate(new Date('2026-10-02T05:00Z'))
  });
  assert.deepEqual((await get('/api/attendance/export?moduleId=QA101')).data.sessions.map(s => s.headerDate), ['02/10/2026', '02/10/2026 (2)']);
});
test('P07 report routes retain owner isolation and the student endpoint ignores spoofed UID', async () => {
  assert.equal((await get('/api/attendance/export?moduleId=QA101', 'qa-lecturer-b')).status, 403);
  assert.equal((await get('/api/attendance/module/QA101/summary', 'qa-student-a')).status, 403);
  assert.equal((await get('/api/student/attendance-summary', 'qa-lecturer-a')).status, 404);
  assert.equal((await fetch(base + '/api/student/attendance-summary')).status, 401);
  const own = (await get('/api/student/attendance-summary?uid=qa-student-a', 'qa-student-b')).data;
  assert.equal(own.modules[0].stats.present, 0);
  assert(!JSON.stringify(own).includes('QA001'));
  await db.doc('students/qa-student-b').update({
    lifecycle_status: 'deleting'
  });
  assert.equal((await get('/api/student/attendance-summary', 'qa-student-b')).status, 409);
});
test('P07 Asia/Colombo date range includes local midnight and excludes next midnight', async () => {
  for (const [id, time] of [['day-start', '2026-10-01T18:30:00Z'], ['day-end', '2026-10-02T18:30:00Z']]) await db.doc(`active_sessions/${id}`).set({
    module_id: 'QA101',
    lecturer_id: 'qa-lecturer-a',
    status: 'completed',
    start_time: admin.firestore.Timestamp.fromDate(new Date(time))
  });
  const {
    status,
    data
  } = await get('/api/attendance/export?moduleId=QA101&startDate=2026-10-02&endDate=2026-10-02');
  assert.equal(status, 200);
  assert(data.sessions.some(s => s.id === 'day-start'));
  assert(!data.sessions.some(s => s.id === 'day-end'));
});
