const router = require('express').Router();
const verifyFirebaseToken = require('../middleware/verifyFirebaseToken');
const { requireLecturer } = verifyFirebaseToken;
const { db, admin } = require('../firebaseAdmin');
const { HttpError, moduleId, requireModuleOwner, respondError } = require('../services/moduleAccess');
const { catalogData } = require('../services/enrollmentService');

function fields(body, uid, creating) {
  const allowed = creating ? ['code', 'name', 'lecturer_id', 'enrollment_enabled', 'enrollment_password_hash']
    : ['name', 'lecturer_id', 'enrollment_enabled', 'enrollment_password_hash'];
  if (!body || Array.isArray(body) || Object.keys(body).some(key => !allowed.includes(key))) throw new HttpError(400, 'Unsupported module fields.');
  if (body.lecturer_id !== undefined && body.lecturer_id !== uid) throw new HttpError(403, 'Module owner cannot be reassigned.');
  if (typeof body.name !== 'string' || !body.name.trim() || typeof body.enrollment_enabled !== 'boolean') throw new HttpError(400, 'Module name and enrollment_enabled are required.');
  if ((creating || body.enrollment_password_hash !== undefined)
    && (typeof body.enrollment_password_hash !== 'string' || !/^[a-fA-F0-9]{64}$/.test(body.enrollment_password_hash))) {
    throw new HttpError(400, 'A valid enrollment password hash is required.');
  }
}

router.post('/modules', verifyFirebaseToken, requireLecturer, async (req, res) => {
  try {
    fields(req.body, req.user.uid, true);
    const code = moduleId(req.body.code);
    const data = { code, module_id: code, name: req.body.name.trim(), lecturer_id: req.user.uid,
      enrollment_enabled: req.body.enrollment_enabled, enrolled_count: 0, total_sessions: 0, session_dates: [] };
    await db.runTransaction(async transaction => {
      const ref = db.doc(`modules/${code}`);
      if ((await transaction.get(ref)).exists) throw new HttpError(409, 'Module already exists.');
      transaction.create(ref, data);
      transaction.set(db.doc(`module_catalog/${code}`), catalogData(code, data));
      transaction.set(db.doc(`module_secrets/${code}`), { enrollment_password_hash: req.body.enrollment_password_hash.toLowerCase(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    });
    res.status(201).json({ success: true, module: { id: code, ...data } });
  } catch (error) { respondError(res, error); }
});

router.patch('/modules/:moduleId', verifyFirebaseToken, requireLecturer, requireModuleOwner(req => req.params.moduleId), async (req, res) => {
  try {
    fields(req.body, req.user.uid, false);
    await db.runTransaction(async transaction => {
      const ref = req.moduleDoc.ref;
      const current = await transaction.get(ref);
      const secret = await transaction.get(db.doc(`module_secrets/${ref.id}`));
      if (!current.exists) throw new HttpError(404, 'Module not found.');
      if (current.get('lecturer_id') !== req.user.uid) throw new HttpError(403, 'Module owner access required.');
      const data = { ...current.data(), name: req.body.name.trim(), enrollment_enabled: req.body.enrollment_enabled };
      const hash = req.body.enrollment_password_hash || secret.get('enrollment_password_hash') || data.enrollment_password_hash;
      if (typeof hash !== 'string' || !/^[a-fA-F0-9]{64}$/.test(hash)) throw new HttpError(409, 'Enrollment is not configured.');
      delete data.enrollment_password_hash; delete data.enrollment_password_updated_at;
      transaction.set(ref, data);
      transaction.set(db.doc(`module_catalog/${ref.id}`), catalogData(ref.id, data));
      transaction.set(db.doc(`module_secrets/${ref.id}`), { enrollment_password_hash: hash.toLowerCase(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    });
    res.json({ success: true });
  } catch (error) { respondError(res, error); }
});

router.delete('/modules/:moduleId', verifyFirebaseToken, requireLecturer, requireModuleOwner(req => req.params.moduleId), async (req, res) => {
  try {
    await db.runTransaction(async transaction => {
      const ref = req.moduleDoc.ref;
      const current = await transaction.get(ref);
      if (!current.exists) throw new HttpError(404, 'Module not found.');
      if (current.get('lecturer_id') !== req.user.uid) throw new HttpError(403, 'Module owner access required.');
      const code = current.get('code') || ref.id;
      const references = await Promise.all([
        transaction.get(db.collection('active_sessions').where('module_id', '==', ref.id).limit(1)),
        transaction.get(db.collection('active_sessions').where('module_code', '==', code).limit(1)),
        transaction.get(db.collection('students').where('enrolled_module_ids', 'array-contains', code).limit(1)),
        transaction.get(db.collection('student_history').where('enrolled_module_ids', 'array-contains', code).limit(1)),
      ]);
      if (references.some(snapshot => !snapshot.empty)) throw new HttpError(409, 'Referenced modules cannot be deleted.');
      transaction.delete(ref); transaction.delete(db.doc(`module_catalog/${ref.id}`)); transaction.delete(db.doc(`module_secrets/${ref.id}`));
    });
    res.json({ success: true });
  } catch (error) { respondError(res, error); }
});

module.exports = router;
