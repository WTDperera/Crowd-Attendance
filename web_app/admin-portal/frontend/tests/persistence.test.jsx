import { afterAll, beforeAll, beforeEach, expect, test, vi } from 'vitest'
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { getDoc, doc } from 'firebase/firestore'
import { auth, db } from '../src/firebase/firebase'
import { AuthProvider } from '../src/context/AuthContext'
import AddStudent from '../src/pages/AddStudent'
import EditStudent from '../src/pages/EditStudent'
import StudentsList from '../src/pages/StudentsList'
import ModulesPage from '../src/pages/ModulesPage'
import LoginPage from '../src/pages/LoginPage'
import { loginWithBackend } from '../src/services/authService'

// Normal persistence cases use real services. The fault cases reject one SDK
// operation to simulate an outage; compensation, retry and all other writes are
// real. Dialog answers replace native prompts absent from jsdom.
const require = createRequire(import.meta.url)
const { assertEmulators } = require('../../../../qa/scripts/environment.cjs')
const { seed } = require('../../../../qa/scripts/fixtures.cjs')
let server, admin
const page = (node, path = '/') => render(<MemoryRouter initialEntries={[path]}><AuthProvider>{node}</AuthProvider></MemoryRouter>)
const change = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } })
const submit = () => fireEvent.submit(document.querySelector('form'))
beforeAll(async () => {
  await assertEmulators()
  const qa = require('../../server/qaConfig').getQaConfig()
  expect(qa.projectId).toBe('demo-crowd-attendance-qa')
  expect(import.meta.env.VITE_API_BASE_URL).toBe('http://127.0.0.1:5000')
  admin = require('../../server/firebaseAdmin')
  server = require('../../server/app').createApp().listen(5000, '127.0.0.1')
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject) })
  vi.spyOn(window, 'alert').mockImplementation(() => {})
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})
beforeEach(async () => {
  await signOut(auth); await seed()
  await signInWithEmailAndPassword(auth, 'lecturer.a@example.test', 'QA-only-Password-123!')
})
afterAll(async () => {
  await signOut(auth)
  if (server) await new Promise(resolve => server.close(resolve))
  await seed(); await admin?.admin.app().delete()
})
test('real account create, fresh list/edit mounts, Auth email update, deletion and missing-record refresh', async () => {
  let view = page(<AddStudent />)
  change('Registration Number', 'QA/P08/01'); change('Student Email', 'qa.p08.account@example.test'); change('Password', 'QA-only-Password-123!'); submit()
  await screen.findByText('Student account created successfully.')
  const created = await admin.auth.getUserByEmail('qa.p08.account@example.test')
  expect((await admin.db.doc(`students/${created.uid}`).get()).get('reg_no')).toBe('QA/P08/01')
  view.unmount(); view = page(<StudentsList />)
  await screen.findByText('QA/P08/01'); view.unmount()
  view = page(<Routes><Route path='/students/:id/edit' element={<EditStudent />} /><Route path='/students' element={<StudentsList />} /></Routes>, `/students/${created.uid}/edit`)
  await screen.findByLabelText('Student Email'); change('Student Email', 'qa.p08.updated@example.test'); submit()
  await screen.findByText('Student updated successfully.')
  expect((await admin.auth.getUser(created.uid)).email).toBe('qa.p08.updated@example.test')
  view.unmount(); view = page(<StudentsList />)
  await screen.findByText('qa.p08.updated@example.test')
  const row = screen.getByText('QA/P08/01').closest('tr'); fireEvent.click(row.querySelector('button'))
  await screen.findByText('Student deleted successfully.')
  await expect(admin.auth.getUser(created.uid)).rejects.toHaveProperty('code', 'auth/user-not-found')
  expect((await admin.db.doc(`students/${created.uid}`).get()).exists).toBe(false)
  view.unmount(); view = page(<Routes><Route path='/students/:id/edit' element={<EditStudent />} /></Routes>, `/students/${created.uid}/edit`)
  await screen.findByText('Student not found'); expect(document.querySelector('form')).toBeNull()
  view.unmount()
})
test('real module form persists create/change, fresh listener mount and deletion', async () => {
  let view = page(<ModulesPage />)
  await screen.findByText('QA101'); fireEvent.click(screen.getByRole('button', { name: 'Add Module' }))
  change('Module Code', 'QA808'); change('Module Name', 'QA P08 original'); change('Enrollment Password', 'QA-P08-pass'); change('Confirm Password', 'QA-P08-pass'); submit()
  await screen.findByText('QA808'); await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  const stored = await admin.db.doc('module_secrets/QA808').get(); const originalHash = stored.get('enrollment_password_hash')
  expect(originalHash).toMatch(/^[a-f0-9]{64}$/)
  expect(originalHash).toBe(createHash('sha256').update('QA-P08-pass').digest('hex'))
  view.unmount(); view = page(<ModulesPage />); const title = await screen.findByText('QA P08 original')
  fireEvent.click(title.closest('article').querySelector('button'))
  change('Module Name', 'QA P08 changed'); fireEvent.click(screen.getByLabelText('Enrollment Enabled')); submit()
  await screen.findByText('QA P08 changed'); await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  view.unmount(); view = page(<ModulesPage />); const fresh = await screen.findByText('QA P08 changed')
  const updated = (await getDoc(doc(db, 'modules', 'QA808'))).data()
  expect(updated.enrollment_enabled).toBe(false)
  expect((await admin.db.doc('module_secrets/QA808').get()).get('enrollment_password_hash')).toBe(originalHash)
  vi.spyOn(window, 'prompt').mockReturnValue('QA808'); fireEvent.click(fresh.closest('article').querySelectorAll('button')[1])
  await waitFor(() => expect(screen.queryByText('QA808')).toBeNull())
  expect((await admin.db.doc('modules/QA808').get()).exists).toBe(false)
  expect((await admin.db.doc('module_catalog/QA808').get()).exists).toBe(false)
  view.unmount()
})
test('real wrong-password login shows error; lecturer login waits for profile before routing', async () => {
  await signOut(auth)
  await expect(loginWithBackend('student.a@example.test', 'QA-only-Password-123!')).rejects.toThrow()
  const view = page(<Routes><Route path='/' element={<LoginPage />} /><Route path='/dashboard' element={<div>Verified portal access</div>} /></Routes>)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy())
  change('Email address', 'lecturer.a@example.test'); change('Password', 'wrong-Password-123!'); submit()
  await screen.findByText(/Invalid|incorrect|credentials/i); expect(auth.currentUser).toBeNull()
  change('Password', 'QA-only-Password-123!'); submit()
  await screen.findByText('Verified portal access'); expect(auth.currentUser.uid).toBe('qa-lecturer-a')
  view.unmount()
})

test('real account UI recovers a failed profile create with Auth rollback and one successful retry', async () => {
  const { DocumentReference } = require('../../server/node_modules/@google-cloud/firestore')
  const failure = vi.spyOn(DocumentReference.prototype, 'create').mockRejectedValueOnce(new Error('Injected P08 profile outage'))
  const view = page(<AddStudent />)
  try {
    change('Registration Number', 'QA/P08/FAULT'); change('Student Email', 'qa.p08.failure@example.test'); change('Password', 'QA-only-Password-123!'); submit()
    await screen.findByText('Unable to complete this operation right now.')
    expect(screen.queryByText('Student account created successfully.')).toBeNull()
    await expect(admin.auth.getUserByEmail('qa.p08.failure@example.test')).rejects.toHaveProperty('code', 'auth/user-not-found')
    expect((await admin.db.collection('students').get()).size).toBe(3)
    submit(); await screen.findByText('Student account created successfully.')
    expect((await admin.auth.listUsers()).users.filter(u => u.email === 'qa.p08.failure@example.test')).toHaveLength(1)
    expect((await admin.db.collection('students').get()).size).toBe(4)
  } finally { failure.mockRestore(); view.unmount() }
})
test('real deletion UI retries after profile removal/Auth failure without losing history or decrementing twice', async () => {
  const view = page(<StudentsList />)
  await screen.findByText('QA003')
  const button = screen.getByText('QA003').closest('tr').querySelector('button')
  const failure = vi.spyOn(admin.auth, 'deleteUser').mockRejectedValueOnce(new Error('Injected P08 Auth deletion outage'))
  try {
    fireEvent.click(button); await screen.findByText('Unable to complete this operation right now.')
    expect(screen.queryByText('Student deleted successfully.')).toBeNull()
    expect((await admin.auth.getUser('qa-student-c')).disabled).toBe(true)
    expect((await admin.db.doc('students/qa-student-c').get()).exists).toBe(false)
    expect((await admin.db.doc('student_deletions/qa-student-c').get()).get('state')).toBe('profile_removed')
    expect((await admin.db.doc('modules/QA101').get()).get('enrolled_count')).toBe(2)
    fireEvent.click(button); await screen.findByText('Student deleted successfully.')
    await expect(admin.auth.getUser('qa-student-c')).rejects.toHaveProperty('code', 'auth/user-not-found')
    expect((await admin.db.doc('modules/QA101').get()).get('enrolled_count')).toBe(2)
    expect((await admin.db.doc('student_history/qa-student-c').get()).exists).toBe(true)
    expect((await admin.db.doc('attendance_records/qa-s1_qa-student-c').get()).exists).toBe(true)
    expect((await admin.db.doc('absence_records/qa-s1_qa-student-c').get()).exists).toBe(true)
  } finally { failure.mockRestore(); view.unmount() }
})
