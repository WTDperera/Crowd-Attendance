const { auth, db } = require('../firebaseAdmin');

const verifyFirebaseToken = async (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ message: 'Missing or invalid token.' });
  }

  try {
    const decodedToken = await auth.verifyIdToken(token);
    req.user = decodedToken;
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Unauthorized.' });
  }
};

// This Firebase project is shared by the web admin-portal, lecturer_app,
// and student_app, so a valid ID token alone (verifyFirebaseToken above)
// only proves *someone* is signed in — it could just as easily be a
// student's account. Every admin-portal route that reads or writes
// lecturer-only data must also run this, which additionally checks that
// the caller has a lecturers/{uid} profile document.
const requireLecturer = async (req, res, next) => {
  if (!req.user?.uid) {
    return res.status(401).json({ message: 'Unauthorized.' });
  }

  try {
    const lecturerDoc = await db.collection('lecturers').doc(req.user.uid).get();
    if (!lecturerDoc.exists) {
      return res.status(403).json({ message: 'Lecturer access required.' });
    }
    req.lecturer = { uid: req.user.uid, ...lecturerDoc.data() };
    return next();
  } catch (error) {
    return res.status(500).json({ message: 'Unable to verify lecturer access.' });
  }
};

module.exports = verifyFirebaseToken;
module.exports.requireLecturer = requireLecturer;