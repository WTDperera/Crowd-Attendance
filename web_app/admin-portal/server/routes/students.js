const router = require('express').Router();
const verifyFirebaseToken = require('../middleware/verifyFirebaseToken');
const { requireLecturer } = verifyFirebaseToken;
const { db } = require('../firebaseAdmin');
const { createStudent, updateStudent, deleteStudent } = require('../services/studentManagement');
const { HttpError, respondError } = require('../services/moduleAccess');
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(body, creating) {
  const allowed = creating ? ['email', 'password', 'reg_no'] : ['email', 'reg_no'];
  if (!body || Array.isArray(body) || Object.keys(body).some(key => !allowed.includes(key))) throw new HttpError(400, 'Unsupported student fields.');
  if ((creating || body.email !== undefined) && (typeof body.email !== 'string' || !emailPattern.test(body.email))) throw new HttpError(400, 'A valid email is required.');
  if ((creating || body.reg_no !== undefined) && (typeof body.reg_no !== 'string' || !body.reg_no.trim())) throw new HttpError(400, 'Registration number is required.');
  if (creating && (typeof body.password !== 'string' || body.password.length < 6)) throw new HttpError(400, 'Password must be at least 6 characters.');
  if (!creating && !Object.keys(body).length) throw new HttpError(400, 'No updates provided.');
}
function error(res, error) {
  if (['auth/email-already-exists', 'auth/invalid-email', 'auth/invalid-password'].includes(error.code)) {
    return res.status(400).json({ message: 'Invalid or already registered account details.' });
  }
  if (error.code === 'auth/user-not-found') return res.status(404).json({ message: 'Student account not found.' });
  return respondError(res, error);
}

router.get('/students', verifyFirebaseToken, requireLecturer, async (req, res) => {
  try {
    const snapshot = await db.collection('students').get();
    res.json({ students: snapshot.docs.filter(doc => doc.get('lifecycle_status') !== 'deleting')
      .map(doc => ({ ...doc.data(), id: doc.id })) });
  } catch (failure) { error(res, failure); }
});
router.post('/students', verifyFirebaseToken, requireLecturer, async (req, res) => {
  try {
    validate(req.body, true);
    const uid = await createStudent(req.body);
    const profile = await db.doc(`students/${uid}`).get();
    res.status(201).json({ success: true, uid, student: { ...profile.data(), id: uid } });
  } catch (failure) { error(res, failure); }
});
router.patch('/students/:uid', verifyFirebaseToken, requireLecturer, async (req, res) => {
  try {
    validate(req.body, false);
    await updateStudent(req.params.uid, req.body);
    const profile = await db.doc(`students/${req.params.uid}`).get();
    res.json({ success: true, student: { ...profile.data(), id: profile.id } });
  } catch (failure) { error(res, failure); }
});
router.delete('/students/:uid', verifyFirebaseToken, requireLecturer, async (req, res) => {
  try {
    await deleteStudent(req.params.uid);
    res.json({ success: true });
  } catch (failure) { error(res, failure); }
});
module.exports = router;
