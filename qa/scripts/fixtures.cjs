const { createHash } = require('node:crypto');
const { getQaConfig } = require('../../web_app/admin-portal/server/qaConfig');
const { assertEmulators } = require('./environment.cjs');
const identities = require('../fixtures/identities.json');

async function reset() {
  const qa = getQaConfig();
  if (!qa) throw new Error('Reset requires explicit QA mode');
  await assertEmulators();
  for (const url of [
    `http://${qa.authHost}/emulator/v1/projects/${qa.projectId}/accounts`,
    `http://${qa.firestoreHost}/emulator/v1/projects/${qa.projectId}/databases/(default)/documents`,
  ]) {
    const response = await fetch(url, { method: 'DELETE', signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`QA reset failed (${response.status}); rerun before using fixture`);
  }
}

async function seed() {
  await reset();
  const { auth, db, admin } = require('../../web_app/admin-portal/server/firebaseAdmin');
  for (const person of [...identities.lecturers, ...identities.students]) {
    await auth.createUser({ uid: person.uid, email: person.email, password: identities.password, displayName: person.name });
  }
  const start = admin.firestore.Timestamp.fromDate(new Date('2026-10-02T03:30:00Z'));
  const { provisionLecturerProfile } = require('../../web_app/admin-portal/server/services/lecturerProvisioning');
  for (const lecturer of identities.lecturers) {
    await provisionLecturerProfile({ auth, db, admin }, lecturer.uid, { fullName: lecturer.name });
  }
  const end = admin.firestore.Timestamp.fromDate(new Date('2026-10-02T04:30:00Z'));
  const hash = createHash('sha256').update(identities.enrollmentPassword).digest('hex');
  const batch = db.batch();
  const { catalogData } = require('../../web_app/admin-portal/server/services/enrollmentService');
  for (const [i, code] of ['QA101', 'QA202'].entries()) {
    const data = { code, module_id: code, name: `QA Module ${code}`,
      lecturer_id: identities.lecturers[i].uid, enrollment_enabled: true,
      enrolled_count: 3, total_sessions: i === 0 ? 1 : 0, session_dates: i === 0 ? [start] : [] };
    batch.set(db.doc(`modules/${code}`), data);
    batch.set(db.doc(`module_catalog/${code}`), catalogData(code, data));
    batch.set(db.doc(`module_secrets/${code}`), { enrollment_password_hash: hash });
  }
  for (const student of identities.students) {
    batch.set(db.doc(`students/${student.uid}`), { ...student, enrolled_module_ids: ['QA101', 'QA202'],
      attendance_counts: { QA101: student.uid === 'qa-student-a' ? 1 : 0, QA202: 0 } });
    for (const code of ['QA101', 'QA202']) batch.set(db.doc(`students/${student.uid}/enrollments/${code}`),
      { moduleId: code, code, name: `QA Module ${code}`, enrolledAt: start });
  }
  const session = { lecturer_id: 'qa-lecturer-a', module_id: 'QA101', module_code: 'QA101',
    module: 'QA101', start_time: start, started_at: start, created_at: start,
    end_time: end, ended_at: end, session_topic: 'Synthetic QA fixture', total_students: 3 };
  batch.set(db.doc('active_sessions/qa-s1'), { ...session, session_id: 'qa-s1', status: 'completed',
    completed_at: end, scans_performed: 3, students_present: ['qa-student-a'], student_count: 1 });
  batch.set(db.doc('active_sessions/qa-active'), { ...session, session_id: 'qa-active', status: 'active',
    scans_performed: 0, students_present: [], student_count: 0 });
  for (const [index, student] of identities.students.entries()) {
    if (index !== 1) {
      const record = { student_uid: student.uid, student_id: student.uid, reg_no: student.reg_no,
        session_id: 'qa-s1', module_id: 'QA101', module_code: 'QA101', date: '2026-10-02',
        timestamp: start, marked_at: start, scan_count: index === 0 ? 3 : 2,
        status: index === 0 ? 'present' : 'left_early', rssi: -50 };
      batch.set(db.doc(`attendance_records/qa-s1_${student.uid}`), record);
      batch.set(db.doc(`active_sessions/qa-s1/attendance/${student.reg_no}`), record);
    }
    if (index !== 0) batch.set(db.doc(`absence_records/qa-s1_${student.uid}`), {
      student_uid: student.uid, module_id: 'QA101', session_id: 'qa-s1', date: '2026-10-02', timestamp: end, status: 'Absent' });
  }
  // Marker written last in the batch; readiness is checked by smoke tests.
  batch.set(db.doc('qa_metadata/bootstrap'), { fixtureVersion: 1, synthetic: true, projectId: getQaConfig().projectId });
  await batch.commit();
}

if (require.main === module) {
  const action = process.argv[2];
  if (!['seed', 'reset'].includes(action) || process.argv.length !== 3) throw new Error('Expected seed or reset only');
  (action === 'seed' ? seed() : reset()).then(async () => {
    console.log(`QA ${action} complete (local demo project only).`);
    if (action === 'seed') await require('../../web_app/admin-portal/server/firebaseAdmin').admin.app().delete();
  }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
module.exports = { seed, reset };
