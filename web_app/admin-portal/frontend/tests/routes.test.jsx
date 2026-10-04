import { expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from '../src/App'
vi.mock('../src/context/AuthContext', () => ({ AuthProvider: ({ children }) => children, useAuth: () => ({ user: { uid: 'qa-lecturer-a' }, authLoading: false }) }))
vi.mock('../src/components/DashboardLayout', async () => ({ default: (await import('react-router-dom')).Outlet }))
vi.mock('../src/pages/DashboardPage', () => ({ default: () => <div>Retained dashboard</div> }))
vi.mock('../src/pages/ModuleDetailsPage', () => ({ default: () => <div>Retained module report</div> }))
vi.mock('../src/pages/ModulesPage', () => ({ default: () => <div>Retained module management</div> }))
vi.mock('../src/pages/StudentsList', () => ({ default: () => <div>Retained student management</div> }))
vi.mock('../src/pages/AddStudent', () => ({ default: () => <div>Retained account creation</div> }))
vi.mock('../src/pages/EditStudent', () => ({ default: () => <div>Retained account editing</div> }))
vi.mock('../src/pages/SettingsPage', () => ({ default: () => <div>Settings</div> }))
vi.mock('../src/pages/LoginPage', () => ({ default: () => <div>Login</div> }))
vi.mock('../src/pages/ForgotPasswordPage', () => ({ default: () => <div>Password reset</div> }))
test.each(['/modules/QA101/sessions/new', '/modules/QA101/sessions/qa-s1/edit'])('mock session route %s is excluded', async path => {
  render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>)
  expect(await screen.findByText('Retained dashboard')).toBeTruthy()
  expect(screen.queryByText('Add Session')).toBeNull(); expect(screen.queryByText('Edit Session')).toBeNull()
})
test.each([
  ['/modules', 'Retained module management'], ['/modules/QA101', 'Retained module report'],
  ['/students', 'Retained student management'], ['/students/new', 'Retained account creation'],
  ['/students/qa-student-a/edit', 'Retained account editing'],
])('retained route %s remains mounted', (path, title) => {
  render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>); expect(screen.getByText(title)).toBeTruthy()
})
