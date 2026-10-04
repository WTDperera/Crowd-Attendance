const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const fs = require('node:fs');
const XLSX = require('../../web_app/admin-portal/frontend/node_modules/xlsx-js-style');
const { assertEmulators } = require('../scripts/environment.cjs');
const { db, auth, admin } = require('../../web_app/admin-portal/server/firebaseAdmin');

test.beforeAll(async () => { await assertEmulators(); });
test.afterAll(async () => { await admin.app().delete(); });
test.beforeEach(async ({ context }) => {
  // Browser traffic is restricted to the explicit local QA targets. No remote
  // Firebase, analytics, font CDN or production fallback is permitted.
  await context.route('**/*', route => {
    const target = new URL(route.request().url());
    return ['127.0.0.1', 'localhost'].includes(target.hostname) && ['5173', '5000', '8080', '9099'].includes(target.port)
      ? route.continue() : route.abort('blockedbyclient');
  });
});
async function login(page) {
  await page.goto('/');
  await page.getByLabel('Email address').fill('lecturer.a@example.test');
  await page.getByLabel('Password', { exact: true }).fill('QA-only-Password-123!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}
async function axe(page, name) {
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  fs.writeFileSync(test.info().outputPath(`axe-${name}.json`), JSON.stringify({ violations: result.violations, incomplete: result.incomplete }, null, 2));
  await test.info().attach(`axe-${name}`, { body: JSON.stringify({ violations: result.violations, incomplete: result.incomplete }, null, 2), contentType: 'application/json' });
  expect.soft(result.violations, `${name}: automatic WCAG A/AA findings`).toEqual([]);
}

test('stable core screens: accessibility checks and reviewed visual baselines', async ({ page }) => {
  await page.goto('/'); await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  await axe(page, 'login');
  await expect(page).toHaveScreenshot('login.png', { animations: 'disabled', maxDiffPixels: 0 });
  await login(page); await axe(page, 'dashboard');
  await page.goto('/students'); await expect(page.getByText('QA003', { exact: true })).toBeVisible(); await axe(page, 'students');
  await page.goto('/students/new'); await expect(page.getByLabel('Registration Number')).toBeVisible(); await axe(page, 'add-student');
  await expect(page).toHaveScreenshot('add-student.png', { animations: 'disabled', maxDiffPixels: 0 });
  await page.goto('/modules'); await expect(page.getByText('QA101', { exact: true })).toBeVisible(); await axe(page, 'modules');
  await page.getByRole('button', { name: 'Add Module', exact: true }).click(); await expect(page.getByRole('dialog')).toBeVisible(); await axe(page, 'module-form');
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
  await page.goto('/modules/QA101'); await expect(page.getByRole('heading', { name: 'Sessions', exact: true })).toBeVisible(); await axe(page, 'module-details');
  await page.getByRole('button', { name: /Mark$/ }).first().click();
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Excused', exact: true }).last()).toBeVisible(); await axe(page, 'session-attendance');
});

test('actual lecturer journey: Android ledger correction, refresh, Excel download and account CRUD', async ({ page }) => {
  const sessions = await db.collection('active_sessions').where('topic', '==', 'P09 Android simulated ledger').get();
  expect(sessions.size, 'Run the lecturer Android journey before this cross-client scenario').toBe(1);
  const root = sessions.docs[0].ref;
  expect(sessions.docs[0].get('status')).toBe('completed');
  expect((await root.collection('rounds').get()).size).toBe(3);
  await page.goto('/'); await page.getByLabel('Email address').fill('lecturer.a@example.test');
  await page.getByLabel('Password', { exact: true }).fill('Wrong-password-123!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByText(/Invalid|incorrect|credentials/i)).toBeVisible(); await expect(page).toHaveURL(/\/$/);
  await login(page);
  await page.goto('/modules/QA101');
  const sessionRow = page.getByRole('row').filter({ hasText: 'P09 Android simulated ledger' });
  await expect(sessionRow).toContainText('completed'); await sessionRow.getByRole('button', { name: /Mark$/ }).click();
  const studentRow = page.locator('.modal-card').getByRole('row').filter({ has: page.getByText('QA003', { exact: true }) });
  // Establish the same saved starting state on reruns, using the actual UI.
  // Earlier failed test attempts may already have committed the correction.
  if ((await root.collection('attendance').doc('qa-student-c').get()).get('final_status') !== 'absent') {
    await studentRow.getByRole('button', { name: 'Absent', exact: true }).click();
    await page.getByRole('button', { name: /Save changes \(1\)/ }).click();
    await expect.poll(async () => (await root.collection('attendance').doc('qa-student-c').get()).get('final_status')).toBe('absent');
    await expect(page.getByRole('button', { name: 'Save changes', exact: true })).toBeDisabled();
  }
  // Correction is staged in the UI and must reach actual storage before success.
  await studentRow.getByRole('button', { name: 'Excused', exact: true }).click();
  await page.getByRole('button', { name: /Save changes \(1\)/ }).click();
  await expect(page.getByRole('button', { name: 'Save changes', exact: true })).toBeDisabled();
  await expect.poll(async () => (await root.collection('attendance').doc('qa-student-c').get()).get('final_status')).toBe('excused');
  expect((await root.collection('attendance').doc('qa-student-c').get()).get('scan_count')).toBe(2);
  await page.reload(); await sessionRow.getByRole('button', { name: /Mark$/ }).click();
  await expect(studentRow.locator('.status-pill')).toHaveText('Excused');
  await expect(page.getByText('66.67%', { exact: true })).toBeVisible();
  const downloadWait = page.waitForEvent('download');
  await page.getByRole('button', { name: /Download Report/ }).click();
  const download = await downloadWait;
  const target = test.info().outputPath('synthetic-session.xlsx'); await download.saveAs(target);
  const workbook = XLSX.read(fs.readFileSync(target), { type: 'buffer', cellFormula: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  expect(rows.find(row => row[1] === 'QA001')[2]).toBe(1);
  expect(rows.find(row => row[1] === 'QA002')[2]).toBe(0);
  expect(rows.find(row => row[1] === 'QA003')[2]).toBe('ex');
  expect(rows.find(row => row[0] === 'Attendance %')[2]).toBe(66.67);
  expect(Object.values(sheet).filter(cell => cell?.f).length).toBeGreaterThan(0);
  await page.goto('/students/new');
  await page.getByLabel('Registration Number').fill('QA/P09/01');
  await page.getByLabel('Student Email').fill('qa.p09.account@example.test');
  await page.getByLabel('Password', { exact: true }).fill('QA-only-Password-123!');
  await page.getByRole('button', { name: /Create Student/ }).click();
  await expect(page.getByText('Student account created successfully.')).toBeVisible();
  const created = await auth.getUserByEmail('qa.p09.account@example.test');
  await page.goto(`/students/${created.uid}/edit`);
  await expect(page.getByLabel('Student Email')).toHaveValue('qa.p09.account@example.test');
  await page.getByLabel('Student Email').fill('qa.p09.updated@example.test');
  await page.getByRole('button', { name: /Save Changes/i }).click();
  await expect(page.getByText('Student updated successfully.')).toBeVisible();
  await page.reload(); await expect(page.getByText('qa.p09.updated@example.test', { exact: true })).toBeVisible();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('row').filter({ hasText: 'QA/P09/01' }).getByRole('button', { name: /Delete/ }).click();
  await expect(page.getByText('Student deleted successfully.')).toBeVisible();
  await expect(auth.getUser(created.uid)).rejects.toHaveProperty('code', 'auth/user-not-found');
  expect((await db.doc(`students/${created.uid}`).get()).exists).toBe(false);
});
