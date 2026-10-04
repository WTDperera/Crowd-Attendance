const { auth, db, admin } = require('../firebaseAdmin');
const { HttpError } = require('./moduleAccess');

async function requireStudent(uid, database = db, allowDeleting = false) {
  const [student, lecturer, journal] = await Promise.all([
    database.doc(`students/${uid}`).get(), database.doc(`lecturers/${uid}`).get(),
    database.doc(`student_deletions/${uid}`).get(),
  ]);
  if (lecturer.exists || (!student.exists && !(allowDeleting && journal.exists))) throw new HttpError(404, 'Student not found.');
  if (!allowDeleting && student.get('lifecycle_status') === 'deleting') throw new HttpError(409, 'Student deletion is pending.');
  return student;
}

async function createStudent(input, { authClient = auth, database = db } = {}) {
  const user = await authClient.createUser({ email: input.email, password: input.password });
  const profile = { uid: user.uid, email: user.email, reg_no: input.reg_no,
    device_id: null, device_locked_at: null, last_login: null, enrolled_module_ids: [], attendance_counts: {},
    createdAt: admin.firestore.FieldValue.serverTimestamp() };
  try {
    await database.doc(`students/${user.uid}`).create(profile);
  } catch (error) {
    await authClient.deleteUser(user.uid);
    throw error;
  }
  return user.uid;
}

async function updateStudent(uid, input) {
  const previous = await requireStudent(uid);
  const user = await auth.getUser(uid);
  if (input.email !== undefined) await auth.updateUser(uid, { email: input.email });
  try {
    // update refuses to invent a missing student profile.
    await previous.ref.update(input);
  } catch (error) {
    if (input.email !== undefined) await auth.updateUser(uid, { email: user.email });
    throw error;
  }
}

async function deleteStudent(uid, { authClient = auth } = {}) {
  await requireStudent(uid, db, true);
  const studentRef = db.doc(`students/${uid}`);
  const journalRef = db.doc(`student_deletions/${uid}`);
  // Persistent intent blocks enrollment/rules even if Auth disable fails.
  await db.runTransaction(async transaction => {
    const student = await transaction.get(studentRef);
    const journal = await transaction.get(journalRef);
    if (!journal.exists) transaction.create(journalRef, { uid, state: 'pending', startedAt: admin.firestore.FieldValue.serverTimestamp() });
    if (student.exists) transaction.update(studentRef, { lifecycle_status: 'deleting' });
  });
  try { await authClient.updateUser(uid, { disabled: true }); }
  catch (error) { if (error.code !== 'auth/user-not-found') throw error; }
  await db.runTransaction(async transaction => {
    const student = await transaction.get(studentRef);
    if (student.exists) {
      const data = student.data();
      const codes = [...new Set(data.enrolled_module_ids || [])];
      if (codes.length > 100) throw new HttpError(409, 'Student enrollment set exceeds the supported deletion transaction size.');
      const modules = await Promise.all(codes.map(code => transaction.get(db.doc(`modules/${code}`))));
      const enrollments = await transaction.get(studentRef.collection('enrollments'));
      transaction.set(db.doc(`student_history/${uid}`), { uid, reg_no: data.reg_no || '', email: data.email || '',
        name: data.name || data.full_name || '', enrolled_module_ids: codes,
        deletedAt: admin.firestore.FieldValue.serverTimestamp() });
      for (const module of modules) {
        if (module.exists) {
          const count = module.get('enrolled_count') ?? 0;
          if (!Number.isSafeInteger(count) || count < 1) throw new HttpError(409, 'Module enrollment count needs repair.');
          transaction.update(module.ref, { enrolled_count: count - 1 });
        }
      }
      enrollments.docs.forEach(enrollment => transaction.delete(enrollment.ref));
      transaction.delete(studentRef);
    }
    transaction.set(journalRef, { uid, state: 'profile_removed' }, { merge: true });
  });
  try { await authClient.deleteUser(uid); }
  catch (error) { if (error.code !== 'auth/user-not-found') throw error; }
  await journalRef.set({ state: 'completed', completedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
}

async function historicalStudentsForModule(code) {
  const snapshots = await Promise.all(['students', 'student_history'].map(collection =>
    db.collection(collection).where('enrolled_module_ids', 'array-contains', code).get()));
  const docs = new Map();
  snapshots.forEach(snapshot => snapshot.docs.forEach(doc => docs.set(doc.id, doc)));
  return { docs: [...docs.values()] };
}

module.exports = { requireStudent, createStudent, updateStudent, deleteStudent, historicalStudentsForModule };
