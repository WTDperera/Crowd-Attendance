const {
  assertEmulators
} = require('./environment.cjs');
const {
  seed
} = require('./fixtures.cjs');
(async () => {
  await assertEmulators();
  await seed();
  const {
    db,
    admin
  } = require('../../web_app/admin-portal/server/firebaseAdmin');
  const {
    correctAttendance
  } = require('../../web_app/admin-portal/server/services/sessionFinalization');
  await correctAttendance({
    sessionId: 'qa-s1',
    actor: 'qa-lecturer-a',
    correction: {
      uid: 'qa-student-c',
      status: 'Excused'
    }
  });
  await db.doc('absence_record/p07-stale').set({
    session_id: 'qa-s1',
    student_id: 'qa-student-c',
    module_id: 'QA101',
    status: 'Absent'
  });
  await db.doc('students/qa-student-c').update({
    'attendance_counts.QA101': 99
  });
  console.log('P07 synthetic corrected fixture ready, with deliberate stale absence/counter.');
  await admin.app().delete();
})().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
