import { beforeEach, expect, test, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import AddStudent from '../src/pages/AddStudent'
import EditStudent from '../src/pages/EditStudent'
import StudentsList from '../src/pages/StudentsList'
import LoginPage from '../src/pages/LoginPage'
import ModulesPage from '../src/pages/ModulesPage'
import ModuleFormModal from '../src/components/ModuleFormModal'
import * as students from '../src/services/studentService'
import * as modules from '../src/services/moduleService'
import { loginWithBackend } from '../src/services/authService'
import { signInWithCustomToken } from 'firebase/auth'

vi.mock('../src/services/studentService', () => ({ addStudent: vi.fn(), updateStudent: vi.fn(), getStudents: vi.fn(), deleteStudent: vi.fn() }))
vi.mock('../src/services/moduleService', () => ({ createModule: vi.fn(), updateModule: vi.fn(), deleteModule: vi.fn(), listenModules: vi.fn() }))
vi.mock('../src/services/authService', () => ({ loginWithBackend: vi.fn() }))
vi.mock('../src/context/AuthContext', () => ({ useAuth: () => ({ user: null, authLoading: false, clearAccessDeniedMessage: vi.fn() }) }))
vi.mock('../src/firebase/firebase', () => ({ auth: {} }))
vi.mock('firebase/auth', () => ({ signInWithCustomToken: vi.fn(), setPersistence: vi.fn(), browserLocalPersistence: {}, browserSessionPersistence: {} }))

const deferred = () => { let resolve, reject; const promise = new Promise((ok, no) => { resolve = ok; reject = no }); return { promise, resolve, reject } }
const renderPage = node => render(<MemoryRouter>{node}</MemoryRouter>)
const change = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } })
const fillStudent = () => { change('Registration Number', 'QA/UI/01'); change('Student Email', 'qa.ui@example.test'); change('Password', 'QA-only-Password-123!') }
const submit = () => fireEvent.submit(document.querySelector('form'))
beforeEach(() => { vi.clearAllMocks(); students.getStudents.mockResolvedValue([]) })

test('account form rejects invalid input before any request', () => {
  renderPage(<AddStudent />); change('Registration Number', ' '); change('Student Email', 'bad'); change('Password', 'short'); submit()
  expect(screen.getByText('Registration number is required.')).toBeTruthy()
  expect(screen.getByText('Enter a valid email address.')).toBeTruthy()
  expect(screen.getByText('Password must be at least 8 characters.')).toBeTruthy()
  expect(students.addStudent).not.toHaveBeenCalled()
})
test('account create suppresses duplicate submit and shows backend failure without success', async () => {
  const pending = deferred(); students.addStudent.mockReturnValue(pending.promise)
  renderPage(<AddStudent />); fillStudent(); submit(); submit()
  expect(students.addStudent).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('button', { name: 'Creating Student...' }).disabled).toBe(true)
  await act(async () => pending.reject(new Error('Profile persistence failed; account creation rolled back.')))
  expect(screen.getByText(/rolled back/)).toBeTruthy(); expect(screen.queryByText(/created successfully/)).toBeNull()
  students.addStudent.mockResolvedValue({ uid: 'qa-ui-created' }); submit()
  expect(await screen.findByText('Student account created successfully.')).toBeTruthy()
})
test('account creation requires a confirmed persisted identity', async () => {
  students.addStudent.mockResolvedValue({}); renderPage(<AddStudent />); fillStudent(); submit()
  expect(await screen.findByText(/creation could not be confirmed/)).toBeTruthy()
  expect(screen.queryByText(/created successfully/)).toBeNull()
})
test('account form safely disposes during a request', async () => {
  const pending = deferred(); students.addStudent.mockReturnValue(pending.promise)
  const view = renderPage(<AddStudent />); fillStudent(); submit(); view.unmount()
  await act(async () => pending.resolve({ uid: 'qa-ui-created' }))
  expect(document.body.textContent).not.toContain('created successfully')
})
test('edit opened by a fresh URL loads and saves without hook-order failure', async () => {
  students.getStudents.mockResolvedValue([{ id: 'qa-ui', reg_no: 'QA/UI/01', email: 'qa.ui@example.test' }])
  students.updateStudent.mockResolvedValue({ id: 'qa-ui' })
  render(<MemoryRouter initialEntries={['/students/qa-ui/edit']}><Routes>
    <Route path='/students/:id/edit' element={<EditStudent />} /><Route path='/students' element={<div>Fresh student list</div>} />
  </Routes></MemoryRouter>)
  expect(screen.getByText('Loading student...')).toBeTruthy()
  await screen.findByLabelText('Student Email'); change('Student Email', 'qa.changed@example.test'); submit(); submit()
  expect(students.updateStudent).toHaveBeenCalledTimes(1)
  expect(await screen.findByText('Fresh student list')).toBeTruthy()
})
test('missing student and load error remain visible without a writable form', async () => {
  students.getStudents.mockRejectedValue(new Error('Unable to fetch students.'))
  render(<MemoryRouter initialEntries={['/students/missing/edit']}><Routes><Route path='/students/:id/edit' element={<EditStudent />} /></Routes></MemoryRouter>)
  expect(await screen.findByText('Unable to fetch students.')).toBeTruthy()
  expect(screen.getByText('Student not found')).toBeTruthy(); expect(document.querySelector('form')).toBeNull()
})
test('student list keeps failed deletion available for retry and suppresses duplicates', async () => {
  students.getStudents.mockResolvedValue([{ id: 'qa-ui', reg_no: 'QA/UI/01', email: 'qa.ui@example.test' }])
  const pending = deferred(); students.deleteStudent.mockReturnValue(pending.promise); vi.spyOn(window, 'confirm').mockReturnValue(true)
  renderPage(<StudentsList />); const button = await screen.findByRole('button', { name: 'Delete' })
  fireEvent.click(button); fireEvent.click(button); expect(students.deleteStudent).toHaveBeenCalledTimes(1)
  await act(async () => pending.reject(new Error('Deletion pending; retry to finish.')))
  expect(screen.getByText('Deletion pending; retry to finish.')).toBeTruthy(); expect(screen.getByText('QA/UI/01')).toBeTruthy()
  students.deleteStudent.mockResolvedValue({ success: true }); fireEvent.click(button)
  await screen.findByText('Student deleted successfully.'); expect(screen.queryByText('QA/UI/01')).toBeNull()
})
test('login handles invalid credentials and one pending request', async () => {
  const pending = deferred(); loginWithBackend.mockReturnValue(pending.promise)
  renderPage(<LoginPage />); change('Email address', 'lecturer.a@example.test'); change('Password', 'wrong-Password'); submit(); submit()
  expect(loginWithBackend).toHaveBeenCalledTimes(1); expect(screen.getByRole('button', { name: 'Signing in...' }).disabled).toBe(true)
  await act(async () => pending.reject(new Error('Invalid email or password.')))
  expect(screen.getByText('Invalid email or password.')).toBeTruthy(); expect(signInWithCustomToken).not.toHaveBeenCalled()
})
test('disposed login never starts a Firebase session from a late response', async () => {
  const pending = deferred(); loginWithBackend.mockReturnValue(pending.promise)
  const view = renderPage(<LoginPage />); change('Email address', 'lecturer.a@example.test'); change('Password', 'QA-only-Password-123!'); submit(); view.unmount()
  await act(async () => pending.resolve({ token: 'unit-only-token' })); expect(signInWithCustomToken).not.toHaveBeenCalled()
})

const modalProps = { mode: 'create', lecturerId: 'qa-lecturer-a', lecturerName: 'QA Lecturer', onClose: vi.fn(), isOpen: true }
const fillModule = () => { change('Module Code', 'QA808'); change('Module Name', 'QA UI module'); change('Enrollment Password', 'qa-pass'); change('Confirm Password', 'qa-pass') }
test('module form validates password and code before hashing or saving', () => {
  const save = vi.fn(); render(<ModuleFormModal {...modalProps} onSubmit={save} />)
  change('Module Code', 'BAD CODE'); change('Module Name', ' '); change('Enrollment Password', 'short'); change('Confirm Password', 'other'); submit()
  expect(screen.getByText('Module code cannot contain spaces.')).toBeTruthy(); expect(screen.getByText('Passwords do not match.')).toBeTruthy(); expect(save).not.toHaveBeenCalled()
})
test('module form awaits save, blocks duplicate hash/save, and presents retryable errors', async () => {
  const pending = deferred(); const save = vi.fn(() => pending.promise)
  render(<ModuleFormModal {...modalProps} onSubmit={save} />); fillModule(); submit(); submit()
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1))
  expect(save.mock.calls[0][0].enrollment_password_hash).toMatch(/^[a-f0-9]{64}$/)
  expect(screen.getByRole('button', { name: 'Close' }).disabled).toBe(true)
  await act(async () => pending.reject(new Error('Module could not be stored.')))
  expect(screen.getByText('Module could not be stored.')).toBeTruthy()
})
test('module dialog starts fresh on reopen and edit without password preserves its hash', async () => {
  const save = vi.fn(); const view = render(<ModuleFormModal {...modalProps} onSubmit={save} />); fillModule()
  view.rerender(<ModuleFormModal {...modalProps} isOpen={false} onSubmit={save} />)
  view.rerender(<ModuleFormModal {...modalProps} onSubmit={save} />); expect(screen.getByLabelText('Module Code').value).toBe('')
  view.rerender(<ModuleFormModal {...modalProps} mode='edit' initialValues={{ code: 'QA808', name: 'QA edit', enrollment_enabled: false }} onSubmit={save} />)
  submit(); await waitFor(() => expect(save).toHaveBeenCalledTimes(1))
  expect(save.mock.calls[0][0]).not.toHaveProperty('enrollment_password_hash')
  expect(save.mock.calls[0][0].enrollment_enabled).toBe(false)
})
test('module subscription displays loading/error and unsubscribes on disposal', async () => {
  let fail; const unsubscribe = vi.fn(); modules.listenModules.mockImplementation((_uid, _change, onError) => { fail = onError; return unsubscribe })
  const view = renderPage(<ModulesPage />); expect(screen.getByText('Loading modules...')).toBeTruthy()
  await act(async () => fail(new Error('Cannot load modules.'))); expect(screen.getByText('Cannot load modules.')).toBeTruthy()
  expect(screen.queryByText('Loading modules...')).toBeNull(); view.unmount(); expect(unsubscribe).toHaveBeenCalledTimes(1)
})
