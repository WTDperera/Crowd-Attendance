const { getQaConfig, QA_PROJECT } = require('../../web_app/admin-portal/server/qaConfig');

function qaEnvironment(source = process.env) {
  const required = { QA_MODE: 'true', GCLOUD_PROJECT: QA_PROJECT,
    GOOGLE_CLOUD_PROJECT: QA_PROJECT, FIREBASE_PROJECT_ID: QA_PROJECT,
    FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099', FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
    VITE_QA_MODE: 'true', VITE_QA_PROJECT_ID: QA_PROJECT, VITE_QA_HOST: '127.0.0.1',
    VITE_API_BASE_URL: 'http://127.0.0.1:5000' };
  for (const [key, value] of Object.entries(required)) {
    if (source[key] && source[key] !== value) throw new Error(`Refusing conflicting ${key}`);
  }
  const env = { ...source, ...required, FIREBASE_CLI_DISABLE_UPDATE_CHECK: 'true' };
  getQaConfig(env);
  return env;
}

async function assertEmulators() {
  const qa = getQaConfig();
  if (!qa) throw new Error('Explicit QA environment required');
  // Both probes are read-only; perform these before any reset/seed write.
  const urls = [
    `http://${qa.authHost}/emulator/v1/projects/${qa.projectId}/config`,
    `http://${qa.firestoreHost}/v1/projects/${qa.projectId}/databases/(default)/documents/qa_metadata/bootstrap`,
  ];
  for (const url of urls) {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok && !(url.includes('/documents/') && [403, 404].includes(response.status))) {
      throw new Error(`Emulator probe failed (${response.status}); no fallback allowed`);
    }
  }
}
module.exports = { qaEnvironment, assertEmulators };
