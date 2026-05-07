const express = require('express');
const verifyFirebaseToken = require('../middleware/verifyFirebaseToken');
const { admin, auth, db } = require('../firebaseAdmin');

const router = express.Router();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.get('/students', verifyFirebaseToken, async (req, res) => {
  try {
    const snapshot = await db.collection('students').get();
    const students = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return res.json({ students });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to fetch students right now.' });
  }
});

router.post('/students', verifyFirebaseToken, async (req, res) => {
  const { email, password, reg_no, name } = req.body;

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
      name: name || '',
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

router.patch('/students/:uid', verifyFirebaseToken, async (req, res) => {
  const { uid } = req.params;
  const { reg_no, email } = req.body;

  if (reg_no === undefined && email === undefined) {
    return res.status(400).json({ message: 'No updates provided.' });
  }

  if (reg_no !== undefined && (!reg_no || typeof reg_no !== 'string')) {
    return res.status(400).json({ message: 'Registration number is required.' });
  }

  if (email !== undefined && (!email || !emailPattern.test(email))) {
    return res.status(400).json({ message: 'Please enter a valid email address.' });
  }

  try {
    if (email !== undefined) {
      await auth.updateUser(uid, { email });
    }

    const updates = {};
    if (reg_no !== undefined) {
      updates.reg_no = reg_no;
    }
    if (email !== undefined) {
      updates.email = email;
    }

    if (Object.keys(updates).length > 0) {
      await db.collection('students').doc(uid).set(updates, { merge: true });
    }

    const updatedDoc = await db.collection('students').doc(uid).get();
    if (!updatedDoc.exists) {
      return res.status(404).json({ message: 'Student record not found.' });
    }

    return res.json({
      success: true,
      student: {
        id: uid,
        ...updatedDoc.data(),
      },
    });
  } catch (error) {
    const errorCode = error.code;
    const friendlyMessageMap = {
      'auth/email-already-exists': 'This email is already registered.',
      'auth/invalid-email': 'Please enter a valid email address.',
      'auth/user-not-found': 'Student account not found.',
    };

    return res.status(400).json({
      message:
        friendlyMessageMap[errorCode] ||
        'Unable to update the student account right now.',
    });
  }
});

router.delete('/students/:uid', verifyFirebaseToken, async (req, res) => {
  const { uid } = req.params;

  try {
    await db.collection('students').doc(uid).delete();
    await auth.deleteUser(uid);

    return res.json({ success: true });
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      return res.status(404).json({ message: 'Student account not found.' });
    }

    return res.status(500).json({ message: 'Unable to delete the student right now.' });
  }
});

module.exports = router;
