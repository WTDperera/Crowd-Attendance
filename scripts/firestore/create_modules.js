import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import admin from 'firebase-admin';

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

async function loadSeed(seedPath) {
  const raw = await fs.readFile(seedPath, 'utf8');
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) throw new Error('Seed file must be a JSON array');
  for (const item of data) {
    if (!item?.code || !item?.name) {
      throw new Error('Each seed item must contain { code, name }');
    }
  }
  return data;
}

async function main() {
  const projectId = requireEnv('FIREBASE_PROJECT_ID');

  // Auth:
  // - Option A (recommended): set GOOGLE_APPLICATION_CREDENTIALS to a service-account JSON path
  // - Option B: run `gcloud auth application-default login` and set FIREBASE_PROJECT_ID
  admin.initializeApp({ projectId });

  const seedArg = process.argv[2] ?? 'modules.seed.json';
  const seedPath = path.isAbsolute(seedArg)
    ? seedArg
    : path.join(process.cwd(), seedArg);

  const seed = await loadSeed(seedPath);
  const db = admin.firestore();

  const results = [];
  for (const item of seed) {
    const code = String(item.code).trim().toUpperCase();
    const name = String(item.name).trim();
    if (!code) throw new Error('Invalid module code');
    if (!name) throw new Error(`Invalid module name for code ${code}`);

    const moduleRef = db.collection('modules').doc(code); // docId == moduleId

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(moduleRef);
      if (!snap.exists) {
        tx.set(moduleRef, {
          code,
          name,
          total_sessions: 0,
          session_dates: [],
          created_at: admin.firestore.FieldValue.serverTimestamp(),
          updated_at: admin.firestore.FieldValue.serverTimestamp(),
        });
        results.push({ code, action: 'created' });
        return;
      }

      // Idempotent: only keep metadata fresh; do NOT reset counters.
      const existing = snap.data() ?? {};
      const patch = {
        code,
        name,
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      };

      // Ensure required fields exist if older docs are missing them.
      if (typeof existing.total_sessions !== 'number') patch.total_sessions = 0;
      if (!Array.isArray(existing.session_dates)) patch.session_dates = [];

      tx.set(moduleRef, patch, { merge: true });
      results.push({ code, action: 'updated' });
    });
  }

  const created = results.filter((r) => r.action === 'created').length;
  const updated = results.filter((r) => r.action === 'updated').length;

  console.log('Done. modules seed applied.');
  console.log({ created, updated, total: results.length });
}

main().catch((err) => {
  console.error('Failed:', err?.message ?? err);
  process.exitCode = 1;
});
