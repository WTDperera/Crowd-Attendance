const test = require('node:test');
const assert = require('node:assert/strict');
const { getQaConfig } = require('../../web_app/admin-portal/server/qaConfig');
const { qaEnvironment } = require('../scripts/environment.cjs');

test('QA refuses production project, remote host, missing emulator and credentials', () => {
  const good = qaEnvironment({});
  assert.equal(getQaConfig(good).projectId, 'demo-crowd-attendance-qa');
  for (const bad of [
    { GCLOUD_PROJECT: 'production' }, { FIREBASE_PROJECT_ID: 'production' },
    { FIRESTORE_EMULATOR_HOST: 'example.com:8080' }, { FIREBASE_AUTH_EMULATOR_HOST: '' },
    { QA_MODE: 'false' }, { QA_MODE: 'TRUE' }, { GOOGLE_APPLICATION_CREDENTIALS: 'do-not-read.json' },
    { FIREBASE_SERVICE_ACCOUNT_JSON: '{}' },
  ]) assert.throws(() => getQaConfig({ ...good, ...bad }));
  assert.throws(() => qaEnvironment({ GCLOUD_PROJECT: 'production' }));
  assert.throws(() => qaEnvironment({ VITE_API_BASE_URL: 'https://example.com' }));
});

test('frontend QA guard rejects missing, remote and mixed configuration', async () => {
  const { getQaConfig: frontendConfig } = await import('../../web_app/admin-portal/frontend/src/firebase/qaConfig.js');
  const env = qaEnvironment({});
  assert.equal(frontendConfig(env).projectId, env.GCLOUD_PROJECT);
  assert.throws(() => frontendConfig({ ...env, VITE_API_BASE_URL: 'https://example.com' }));
  assert.throws(() => frontendConfig({ ...env, VITE_QA_PROJECT_ID: 'production' }));
  assert.throws(() => frontendConfig({ MODE: 'qa' }));
});
