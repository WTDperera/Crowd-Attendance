import { beforeEach, expect, test, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { AuthProvider, useAuth } from '../src/context/AuthContext'
import { getDoc } from 'firebase/firestore'
import { onAuthStateChanged, signOut } from 'firebase/auth'

vi.mock('../src/firebase/firebase', () => ({ auth: {}, db: {} }))
vi.mock('firebase/firestore', () => ({ doc: vi.fn(), getDoc: vi.fn() }))
vi.mock('firebase/auth', () => ({ onAuthStateChanged: vi.fn(), signOut: vi.fn() }))
let notify; const unsubscribe = vi.fn()
const deferred = () => { let resolve; const promise = new Promise(ok => { resolve = ok }); return { promise, resolve } }
const allowed = { exists: () => true, data: () => ({ name: 'QA Lecturer' }) }
const View = () => { const state = useAuth(); return <div>{state.authLoading ? 'Verifying' : state.user?.uid || 'Denied'} {state.accessDeniedMessage}</div> }
beforeEach(() => { vi.clearAllMocks(); signOut.mockResolvedValue(); onAuthStateChanged.mockImplementation((_auth, callback) => { notify = callback; return unsubscribe }) })
test('auth shows loading until profile verification completes', async () => {
  const pending = deferred(); getDoc.mockReturnValue(pending.promise); render(<AuthProvider><View /></AuthProvider>)
  await act(async () => { void notify({ uid: 'qa-a' }) }); expect(screen.getByText('Verifying')).toBeTruthy()
  await act(async () => pending.resolve(allowed)); expect(screen.getByText('qa-a')).toBeTruthy()
})
test('late profile result cannot restore access after logout', async () => {
  const pending = deferred(); getDoc.mockReturnValue(pending.promise); render(<AuthProvider><View /></AuthProvider>)
  await act(async () => { void notify({ uid: 'qa-a' }) }); await act(async () => notify(null))
  await act(async () => pending.resolve(allowed)); expect(screen.getByText('Denied')).toBeTruthy()
})
test('old failed verification cannot sign out a newly verified identity', async () => {
  const pending = deferred(); getDoc.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(allowed)
  render(<AuthProvider><View /></AuthProvider>); await act(async () => { void notify({ uid: 'qa-a' }) }); await act(async () => notify({ uid: 'qa-b' }))
  await act(async () => pending.resolve({ exists: () => false })); expect(screen.getByText('qa-b')).toBeTruthy(); expect(signOut).not.toHaveBeenCalled()
})
test('profile read failure fails closed even if sign-out also fails', async () => {
  getDoc.mockRejectedValue(new Error('offline')); signOut.mockRejectedValue(new Error('offline'))
  render(<AuthProvider><View /></AuthProvider>); await act(async () => notify({ uid: 'qa-a' }))
  expect(screen.getByText(/Unable to verify lecturer access/)).toBeTruthy(); expect(screen.queryByText('qa-a')).toBeNull()
})
test('disposed provider ignores late denial and unsubscribes', async () => {
  const pending = deferred(); getDoc.mockReturnValue(pending.promise); const view = render(<AuthProvider><View /></AuthProvider>)
  await act(async () => { void notify({ uid: 'qa-a' }) }); view.unmount(); await act(async () => pending.resolve({ exists: () => false }))
  expect(unsubscribe).toHaveBeenCalledTimes(1); expect(signOut).not.toHaveBeenCalled()
})
