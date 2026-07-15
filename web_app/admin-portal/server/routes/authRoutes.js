const express = require('express');
const { auth, db } = require('../firebaseAdmin');

const router = express.Router();

const FIREBASE_WEB_API_KEY = process.env.FIREBASE_WEB_API_KEY;

const IDENTITY_TOOLKIT_ERROR_MESSAGES = {
  EMAIL_NOT_FOUND: 'No account found for this email.',
  INVALID_PASSWORD: 'Incorrect password.',
  INVALID_LOGIN_CREDENTIALS: 'Incorrect email or password.',
  USER_DISABLED: 'This account has been disabled.',
  TOO_MANY_ATTEMPTS_TRY_LATER: 'Too many attempts. Try again later.',
  INVALID_EMAIL: 'Please enter a valid email address.',
  MISSING_PASSWORD: 'Password is required.',
};

/**
 * POST /api/auth/login
 *
 * This Firebase project is shared by the web admin-portal, lecturer_app,
 * and student_app — so a student's email/password are perfectly valid
 * Firebase credentials too. Verifying the password client-side and then
 * checking "is this a lecturer" afterwards (as the frontend previously
 * did) still means a non-lecturer briefly holds a real signed-in session
 * before being kicked out.
 *
 * This endpoint makes the backend the sole source of truth for login:
 *   1. Verify the email/password against Firebase's Identity Toolkit
 *      REST API directly from the server (the same mechanism the client
 *      SDK uses under the hood).
 *   2. Only if that succeeds, check whether the resulting uid has a
 *      lecturers/{uid} profile document.
 *   3. Only if BOTH checks pass, mint a short-lived custom token for the
 *      frontend to exchange for a real session via
 *      signInWithCustomToken(). Non-lecturers never receive a token, so
 *      the frontend never gets a Firebase Auth session for them at all.
 */
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res
      .status(400)
      .json({ message: 'Email and password are required.' });
  }

  if (!FIREBASE_WEB_API_KEY) {
    console.error(
      'FIREBASE_WEB_API_KEY is not configured on the server (see .env.example).'
    );
    return res
      .status(500)
      .json({ message: 'Server is not configured for login right now.' });
  }

  let uid;

  try {
    const verifyResponse = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_WEB_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
      }
    );

    const verifyData = await verifyResponse.json();

    if (!verifyResponse.ok) {
      const errorCode = verifyData?.error?.message || '';
      const friendlyMessage =
        IDENTITY_TOOLKIT_ERROR_MESSAGES[errorCode] ||
        'Incorrect email or password.';
      return res.status(401).json({ message: friendlyMessage });
    }

    uid = verifyData.localId;
  } catch (error) {
    return res.status(502).json({
      message: 'Unable to reach the authentication service right now.',
    });
  }

  try {
    const lecturerDoc = await db.collection('lecturers').doc(uid).get();

    if (!lecturerDoc.exists) {
      return res.status(403).json({
        message: 'This account is not authorized to access the admin portal.',
      });
    }

    const customToken = await auth.createCustomToken(uid);

    return res.json({
      token: customToken,
      lecturer: {
        uid,
        ...lecturerDoc.data(),
      },
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: 'Unable to complete sign-in right now.' });
  }
});

module.exports = router;