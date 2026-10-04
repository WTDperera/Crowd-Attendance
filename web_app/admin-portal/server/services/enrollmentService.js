const { createHash, timingSafeEqual } = require('node:crypto');
const { db, admin } = require('../firebaseAdmin');
const { HttpError, findModule } = require('./moduleAccess');

function catalogData(id, data) {
  // Explicit projection: never spread a module/secret document here.
  return { code: data.code || id, name: data.name || '', lecturer_id: data.lecturer_id,
    enrollment_enabled: data.enrollment_enabled === true, total_sessions: data.total_sessions || 0,
    session_dates: data.session_dates || [] };
}

async function enroll(uid, value, password) {
  if (typeof password !== 'string' || !password || password.length > 1024) throw new HttpError(400, 'Password is required.');
  const module = await findModule(value);
  return db.runTransaction(async transaction => {
    const moduleRef = module.ref;
    const studentRef = db.doc(`students/${uid}`);
    const [current, student, lecturer, secret] = await Promise.all([
      transaction.get(moduleRef), transaction.get(studentRef), transaction.get(db.doc(`lecturers/${uid}`)),
      transaction.get(db.doc(`module_secrets/${module.id}`)),
    ]);
    if (!student.exists || lecturer.exists || student.get('lifecycle_status') === 'deleting') throw new HttpError(403, 'Student access required.');
    if (!current.exists) throw new HttpError(404, 'Module not found.');
    const data = current.data();
    if (data.enrollment_enabled !== true) throw new HttpError(409, 'Enrollment is not enabled for this module.');
    // Legacy root hashes stay server-readable only; new module management
    // moves them to the denied secret collection. No live migration is run.
    const hash = secret.get('enrollment_password_hash') || data.enrollment_password_hash;
    if (typeof hash !== 'string' || !/^[a-fA-F0-9]{64}$/.test(hash)) throw new HttpError(409, 'Enrollment is not configured for this module.');
    const provided = createHash('sha256').update(password).digest();
    if (!timingSafeEqual(provided, Buffer.from(hash, 'hex'))) throw new HttpError(403, 'Wrong enrollment password.');
    const code = data.code || module.id;
    const enrollmentRef = studentRef.collection('enrollments').doc(code);
    const enrollment = await transaction.get(enrollmentRef);
    const studentData = student.data();
    const enrolled = studentData.enrolled_module_ids || [];
    if (!Array.isArray(enrolled) || !enrolled.every(item => typeof item === 'string')) throw new HttpError(409, 'Student enrollment data needs repair.');
    const alreadyEnrolled = enrolled.includes(code);
    const count = data.enrolled_count ?? 0;
    if (!Number.isSafeInteger(count) || count < 0) throw new HttpError(409, 'Module enrollment count needs repair.');
    if (!alreadyEnrolled) {
      const counts = studentData.attendance_counts || {};
      transaction.update(studentRef, { enrolled_module_ids: admin.firestore.FieldValue.arrayUnion(code),
        attendance_counts: { ...counts, [code]: counts[code] ?? 0 } });
      transaction.update(moduleRef, { enrolled_count: count + 1 });
    }
    // Recover a missing optional enrollment document without double counting.
    if (!enrollment.exists) transaction.set(enrollmentRef, { moduleId: module.id, code, name: data.name || '',
      enrolledAt: admin.firestore.FieldValue.serverTimestamp() });
    return { success: true, moduleId: module.id, code, enrolled: !alreadyEnrolled };
  });
}

module.exports = { catalogData, enroll };
