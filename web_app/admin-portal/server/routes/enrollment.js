const router = require('express').Router();
const verifyFirebaseToken = require('../middleware/verifyFirebaseToken');
const { db } = require('../firebaseAdmin');
const { enroll } = require('../services/enrollmentService');
const { HttpError, respondError } = require('../services/moduleAccess');

router.post('/student/modules/:moduleId/enroll', verifyFirebaseToken, async (req, res) => {
  try {
    if (!req.body || Array.isArray(req.body) || Object.keys(req.body).some(key => key !== 'password')) {
      throw new HttpError(400, 'Only the enrollment password may be submitted.');
    }
    // Reject nonstudents before disclosing module/secret state.
    const [student, lecturer] = await Promise.all([
      db.doc(`students/${req.user.uid}`).get(), db.doc(`lecturers/${req.user.uid}`).get(),
    ]);
    if (!student.exists || lecturer.exists || student.get('lifecycle_status') === 'deleting') throw new HttpError(403, 'Student access required.');
    res.json(await enroll(req.user.uid, req.params.moduleId, req.body.password));
  } catch (error) { respondError(res, error); }
});

module.exports = router;
