/**
 * One-time setup script: creates the single lecturer account for this
 * admin portal.
 *
 * This app is designed for exactly one lecturer. Public self-registration
 * has been removed from the frontend on purpose — the only way to create
 * a lecturer account is by running this script directly against Firebase,
 * with access to the service account key.
 *
 * Usage (run from web_app/admin-portal/server):
 *   node scripts/createLecturer.js "you@example.com" "a-strong-password" "Your Full Name"
 *
 * Requires FIREBASE_SERVICE_ACCOUNT_PATH to be set (same as the server's
 * .env), since this uses the Admin SDK, not the public client SDK.
 */

require('dotenv').config();
const { auth, db, admin } = require('../firebaseAdmin');

async function createLecturer(email, password, fullName) {
  if (!email || !password || !fullName) {
    console.error(
      'Usage: node scripts/createLecturer.js <email> <password> <fullName>'
    );
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('Password must be at least 8 characters.');
    process.exit(1);
  }

  // Refuse to create a second lecturer account without an explicit
  // --allow-multiple flag, since this app assumes exactly one lecturer.
  const allowMultiple = process.argv.includes('--allow-multiple');
  const existingLecturers = await db.collection('lecturers').limit(1).get();
  if (!existingLecturers.empty && !allowMultiple) {
    console.error(
      'A lecturer account already exists. This app is designed for a ' +
        'single lecturer. Re-run with --allow-multiple if you really ' +
        'intend to create another one.'
    );
    process.exit(1);
  }

  try {
    const userRecord = await auth.createUser({
      email,
      password,
      displayName: fullName,
    });

    await db.collection('lecturers').doc(userRecord.uid).set({
      fullName,
      email,
      department: '',
      role: 'lecturer',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log('Lecturer account created successfully.');
    console.log(`  uid:   ${userRecord.uid}`);
    console.log(`  email: ${email}`);
  } catch (error) {
    console.error('Failed to create lecturer account:', error.message);
    process.exit(1);
  }

  process.exit(0);
}

const [, , email, password, ...nameParts] = process.argv;
const fullName = nameParts.filter((part) => part !== '--allow-multiple').join(' ');

createLecturer(email, password, fullName);