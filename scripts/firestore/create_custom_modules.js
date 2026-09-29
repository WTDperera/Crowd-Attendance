import process from 'node:process';
import admin from 'firebase-admin';

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

// Customize lecturer_id later (or make these unique per module).
const PLACEHOLDER_LECTURER_UID = 'PLACEHOLDER_LECTURER_UID';

// Seed list (Document ID must be the module code).
const CUSTOM_MODULES = [
  {
    code: 'CS101',
    name: 'Computer Systems',
    lecturer_id: PLACEHOLDER_LECTURER_UID,
    total_sessions: 0,
    session_dates: [],
  },
  {
    code: 'SE202',
    name: 'Software Engineering',
    lecturer_id: PLACEHOLDER_LECTURER_UID,
    total_sessions: 0,
    session_dates: [],
  },
];

async function main() {
  const projectId = requireEnv('FIREBASE_PROJECT_ID');

  // Auth:
  // - Option A (recommended): set GOOGLE_APPLICATION_CREDENTIALS to a service-account JSON path
  // - Option B: run `gcloud auth application-default login` and set FIREBASE_PROJECT_ID
  admin.initializeApp({ projectId });

  const db = admin.firestore();

  for (const module of CUSTOM_MODULES) {
    const code = String(module.code).trim().toUpperCase();
    const moduleRef = db.collection('modules').doc(code);

    try {
      const action = await db.runTransaction(async (tx) => {
        const snap = await tx.get(moduleRef);
        if (snap.exists) {
          return 'skipped_exists';
        }

        tx.set(moduleRef, {
          name: String(module.name).trim(),
          code,
          lecturer_id: String(module.lecturer_id).trim(),
          total_sessions: 0,
          session_dates: [],
        });
        return 'created';
      });

      if (action === 'created') {
        console.log(`✅ Created module: ${code}`);
      } else {
        console.log(`⏭️  Skipped (already exists): ${code}`);
      }
    } catch (err) {
      console.error(`❌ Failed module ${code}:`, err?.message ?? err);
      process.exitCode = 1;
    }
  }
}

main().catch((err) => {
  console.error('Failed:', err?.message ?? err);
  process.exitCode = 1;
});
