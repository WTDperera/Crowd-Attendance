import process from 'node:process';
import admin from 'firebase-admin';

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

  const moduleIdsArg = process.argv.slice(2);
  const moduleIds = (moduleIdsArg.length > 0
    ? moduleIdsArg
    : ['CS101', 'SE202'])
    .map((m) => String(m).trim().toUpperCase())
    .filter(Boolean);

  if (moduleIds.length === 0) {
    throw new Error('No module IDs provided');
  }

  const db = admin.firestore();
  const studentsSnap = await db.collection('students').get();

  console.log(`Found ${studentsSnap.size} student documents.`);
  console.log(`Enrolling every student into: ${JSON.stringify(moduleIds)}`);

  let success = 0;
  let failure = 0;

  for (const doc of studentsSnap.docs) {
    try {
      await db.collection('students').doc(doc.id).update({
        enrolled_module_ids: moduleIds,
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      });
      success += 1;
      console.log(`✅ Updated student ${doc.id}`);
    } catch (err) {
      failure += 1;
      console.error(`❌ Failed student ${doc.id}:`, err?.message ?? err);
    }
  }

  console.log('Done.');
  console.log({ success, failure, total: studentsSnap.size });
}

main().catch((err) => {
  console.error('Failed:', err?.message ?? err);
  process.exitCode = 1;
});
