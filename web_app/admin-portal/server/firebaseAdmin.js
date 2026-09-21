const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

if (!serviceAccountPath) {
  throw new Error('FIREBASE_SERVICE_ACCOUNT_PATH is not set');
}

const resolvedPath = path.resolve(serviceAccountPath);
const serviceAccount = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));

if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const auth = admin.auth();
const db = admin.firestore();

module.exports = {
  admin,
  auth,
  db,
};
