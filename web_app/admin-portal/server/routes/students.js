const express = require('express');
const verifyFirebaseToken = require('../middleware/verifyFirebaseToken');
const { admin, auth, db } = require('../firebaseAdmin');

const router = express.Router();

router.post('/students', verifyFirebaseToken, async (req, res) => {
  const { email, password, reg_no } = req.body;

  if (!email || !password || !reg_no) {
    return res.status(400).json({ message: 'Email, password, and reg_no are required.' });
  }

  try {
    const userRecord = await auth.createUser({
      email,
      password,
    });

    const studentDoc = {
      email,
      reg_no,
      device_id: null,
      device_locked_at: null,
      last_login: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await db.collection('students').doc(userRecord.uid).set(studentDoc);

    return res.status(201).json({
      success: true,
      uid: userRecord.uid,
      student: {
        id: userRecord.uid,
        ...studentDoc,
      },
    });
  } catch (error) {
    const errorCode = error.code;
    const friendlyMessageMap = {
      'auth/email-already-exists': 'This email is already registered.',
      'auth/invalid-password': 'Password must be at least 6 characters.',
      'auth/invalid-email': 'Please enter a valid email address.',
    };

    return res.status(400).json({
      message:
        friendlyMessageMap[errorCode] ||
        'Unable to create the student account right now.',
    });
  }
});

module.exports = router;
