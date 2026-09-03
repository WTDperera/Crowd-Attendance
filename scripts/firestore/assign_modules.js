import process from 'node:process';
import admin from 'firebase-admin';

// Edit this list to control which modules are assigned.
const TARGET_MODULES = ['CS101', 'SE202'];

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

async function main() {
  const projectId = requireEnv('FIREBASE_PROJECT_ID');

  // Auth:
  // - Option A (recommended): set GOOGLE_APPLICATION_CREDENTIALS to a service-account JSON path
  // - Option B: run `gcloud auth application-default login` and set FIREBASE_PROJECT_ID
  admin.initializeApp({ projectId });

  const moduleIds = TARGET_MODULES.map((m) => String(m).trim().toUpperCase()).filter(Boolean);
  if (moduleIds.length === 0) {
    throw new Error('TARGET_MODULES is empty');
  }

  const db = admin.firestore();
  const studentsSnap = await db.collection('students').get();

  console.log(`Found ${studentsSnap.size} student documents.`);
  console.log(`Assigning enrolled_module_ids = ${JSON.stringify(moduleIds)}`);

  let success = 0;
  let failure = 0;

  for (const doc of studentsSnap.docs) {
    const data = doc.data() ?? {};
    const email = typeof data.email === 'string' ? data.email : '(no email field)';

    try {
      await db.collection('students').doc(doc.id).update({
        enrolled_module_ids: moduleIds,
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      });

      success += 1;
      console.log(`✅ Updated: ${email}`);
    } catch (err) {
      failure += 1;
      console.error(`❌ Failed: ${email}`, err?.message ?? err);
    }
  }

  console.log('Done.');
  console.log({ success, failure, total: studentsSnap.size });
}

main().catch((err) => {
  console.error('Failed:', err?.message ?? err);
  process.exitCode = 1;
});
