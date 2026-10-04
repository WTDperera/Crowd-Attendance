const { assertEmulators } = require('./environment.cjs');
(async () => {
  await assertEmulators();
  const { db, admin } = require('../../web_app/admin-portal/server/firebaseAdmin');
  const ledger = await db.collection('active_sessions').where('topic', '==', 'P09 Android simulated ledger').get();
  if (ledger.size !== 1 || ledger.docs[0].get('status') !== 'completed') throw new Error('A single completed P09 Android ledger is required; no seed fallback');
  const profile = db.doc('students/qa-student-a'), enrollment = profile.collection('enrollments').doc('QA202');
  const module = db.doc('modules/QA202');
  await db.runTransaction(async tx => {
    const [student, existing, owned] = await tx.getAll(profile, enrollment, module);
    if (!student.exists || owned.get('lecturer_id') !== 'qa-lecturer-b') throw new Error('Unexpected fixture identity/module');
    tx.update(profile, { enrolled_module_ids: student.get('enrolled_module_ids').filter(id => id !== 'QA202') });
    if (existing.exists) {
      tx.delete(enrollment);
      tx.update(module, { enrolled_count: owned.get('enrolled_count') - 1 });
      tx.update(db.doc('module_catalog/QA202'), { enrolled_count: owned.get('enrolled_count') - 1 });
    }
  });
  console.log('P09 student enrollment ready; Android class and browser correction retained.');
  await admin.app().delete();
})().catch(error => { console.error(error.message); process.exitCode = 1; });
