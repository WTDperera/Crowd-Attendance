const { seed } = require('./fixtures.cjs');
const { assertEmulators } = require('./environment.cjs');

(async () => {
  await assertEmulators();
  await seed();
  const { db, admin } = require('../../web_app/admin-portal/server/firebaseAdmin');
  const { catalogData } = require('../../web_app/admin-portal/server/services/enrollmentService');
  const batch = db.batch();
  batch.update(db.doc('students/qa-student-a'), { enrolled_module_ids: ['QA101'], attendance_counts: { QA101: 1 } });
  batch.delete(db.doc('students/qa-student-a/enrollments/QA202'));
  batch.update(db.doc('modules/QA202'), { enrolled_count: 2 });
  const disabled = { code: 'QA303', module_id: 'QA303', name: 'QA Disabled Module', lecturer_id: 'qa-lecturer-b',
    enrollment_enabled: false, enrolled_count: 0, total_sessions: 0, session_dates: [] };
  batch.set(db.doc('modules/QA303'), disabled);
  batch.set(db.doc('module_catalog/QA303'), catalogData('QA303', disabled));
  // Disabled state is checked before secret lookup; no password needed here.
  await batch.commit();
  console.log('P04 local mobile fixture ready: QA202 not enrolled by A; QA303 disabled.');
  await admin.app().delete();
})().catch(error => { console.error(error.message); process.exitCode = 1; });
