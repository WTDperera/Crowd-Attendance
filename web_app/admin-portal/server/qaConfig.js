const QA_PROJECT = 'demo-crowd-attendance-qa';

function getQaConfig(env = process.env) {
  const emulatorHint = env.FIREBASE_AUTH_EMULATOR_HOST || env.FIRESTORE_EMULATOR_HOST;
  if (env.QA_MODE !== 'true') {
    if (emulatorHint || (env.QA_MODE && env.QA_MODE !== 'false') || env.GCLOUD_PROJECT === QA_PROJECT) {
      throw new Error('QA requires explicit QA_MODE=true; refusing mixed configuration.');
    }
    return null;
  }
  if (env.GCLOUD_PROJECT !== QA_PROJECT ||
      (env.GOOGLE_CLOUD_PROJECT && env.GOOGLE_CLOUD_PROJECT !== QA_PROJECT) ||
      (env.FIREBASE_PROJECT_ID && env.FIREBASE_PROJECT_ID !== QA_PROJECT) ||
      env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099' ||
      env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080') {
    throw new Error('QA accepts only demo-crowd-attendance-qa on loopback Auth 9099 / Firestore 8080.');
  }
  if (env.FIREBASE_SERVICE_ACCOUNT_JSON || env.FIREBASE_SERVICE_ACCOUNT_PATH || env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error('QA rejects service account credentials.');
  }
  return Object.freeze({ projectId: QA_PROJECT, authHost: '127.0.0.1:9099', firestoreHost: '127.0.0.1:8080' });
}

module.exports = { QA_PROJECT, getQaConfig };
