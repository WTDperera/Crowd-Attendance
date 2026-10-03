// Server/Admin-only operation. Never expose this through a public route.
// The lecturer document is the shared trusted role registry for rules/API.
async function provisionLecturerProfile({ auth, db, admin }, uid, { fullName, department = '' }) {
  if (typeof fullName !== 'string' || !fullName.trim() || typeof department !== 'string') {
    throw new Error('Lecturer name and department must be valid strings.');
  }
  const user = await auth.getUser(uid);
  if (user.disabled || !user.email) throw new Error('An enabled Auth account with email is required.');
  const profile = {
    uid: user.uid, email: user.email, fullName: fullName.trim(), name: fullName.trim(),
    department, role: 'lecturer', createdAt: admin.firestore.FieldValue.serverTimestamp(),
    device_id: null, device_locked_at: null, last_login: null,
  };
  await db.runTransaction(async transaction => {
    const student = await transaction.get(db.doc(`students/${user.uid}`));
    const lecturer = await transaction.get(db.doc(`lecturers/${user.uid}`));
    if (student.exists) throw new Error('A student account cannot be provisioned as a lecturer.');
    if (lecturer.exists) throw new Error('Lecturer already provisioned; refusing to overwrite identity or binding.');
    transaction.create(db.doc(`lecturers/${user.uid}`), profile);
  });
  return user.uid;
}

module.exports = { provisionLecturerProfile };
