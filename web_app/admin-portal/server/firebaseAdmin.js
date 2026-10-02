const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const { getQaConfig } = require('./qaConfig');

const qa = getQaConfig();
let options;
if (qa) {
  options = { projectId: qa.projectId };
} else {
  let serviceAccount;
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  } else {
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    if (!serviceAccountPath) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_SERVICE_ACCOUNT_JSON is not set');
    }
    serviceAccount = JSON.parse(fs.readFileSync(path.resolve(serviceAccountPath), 'utf8'));
  }
  options = { credential: admin.credential.cert(serviceAccount) };
}
if (admin.apps.length === 0) admin.initializeApp(options);
if (qa && admin.app().options.projectId !== qa.projectId) {
  throw new Error('Existing Firebase app does not match isolated QA project.');
}
module.exports = { admin, auth: admin.auth(), db: admin.firestore() };
