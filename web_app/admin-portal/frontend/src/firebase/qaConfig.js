export const QA_PROJECT = 'demo-crowd-attendance-qa'

export function getQaConfig(env) {
  if (env.VITE_QA_MODE !== 'true') {
    if (env.MODE === 'qa' || env.VITE_QA_PROJECT_ID || env.VITE_QA_HOST ||
        (env.VITE_QA_MODE && env.VITE_QA_MODE !== 'false')) {
      throw new Error('QA requires explicit VITE_QA_MODE=true')
    }
    return null
  }
  if (env.VITE_QA_PROJECT_ID !== QA_PROJECT || env.VITE_QA_HOST !== '127.0.0.1' ||
      env.VITE_API_BASE_URL !== 'http://127.0.0.1:5000') {
    throw new Error('QA requires the demo project and local emulator/API endpoints')
  }
  return { projectId: QA_PROJECT, host: '127.0.0.1', apiKey: 'qa-emulator-key',
    appId: '1:1234567890:web:qa', authDomain: `${QA_PROJECT}.firebaseapp.com` }
}
