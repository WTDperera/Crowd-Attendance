import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../firebase/firebase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [lecturerProfile, setLecturerProfile] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [accessDeniedMessage, setAccessDeniedMessage] = useState('')

  useEffect(() => {
    let revision = 0
    let disposed = false
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      const currentRevision = ++revision
      const isCurrent = () => !disposed && revision === currentRevision
      setUser(null)
      setLecturerProfile(null)
      setAuthLoading(Boolean(nextUser))
      if (!nextUser) {
        setUser(null)
        setLecturerProfile(null)
        setAuthLoading(false)
        return
      }

      // This Firebase project is shared with lecturer_app and student_app,
      // so a valid sign-in only proves *someone* has an account here — not
      // that they're the lecturer this portal is for. Only grant access if
      // a lecturers/{uid} profile document exists for this account.
      try {
        const lecturerDoc = await getDoc(doc(db, 'lecturers', nextUser.uid))
        if (!isCurrent()) return

        if (!lecturerDoc.exists()) {
          setAccessDeniedMessage(
            'This account is not authorized to access the admin portal.'
          )
          setAuthLoading(false)
          // UI access remains denied even if sign-out fails (e.g. offline).
          await signOut(auth).catch(() => {})
          return
        }

        setLecturerProfile(lecturerDoc.data())
      } catch {
        if (!isCurrent()) return
        setAccessDeniedMessage(
          'Unable to verify lecturer access right now. Please try again.'
        )
        setAuthLoading(false)
        await signOut(auth).catch(() => {})
        return
      }

      setUser(nextUser)
      setAccessDeniedMessage('')
      setAuthLoading(false)
    })

    return () => { disposed = true; revision++; unsubscribe() }
  }, [])

  const logout = useCallback(() => signOut(auth), [])
  const clearAccessDeniedMessage = useCallback(() => setAccessDeniedMessage(''), [])

  const lecturerName =
  lecturerProfile?.fullName ||
  lecturerProfile?.name ||
  user?.displayName ||
  user?.email?.split('@')[0] ||
  ''

const value = useMemo(
  () => ({
    user,
    lecturerProfile,
    lecturerName,          // <-- new
    isAuthed: Boolean(user),
    authLoading,
    logout,
    accessDeniedMessage,
    clearAccessDeniedMessage,
  }),
  [user, lecturerProfile, lecturerName, authLoading, accessDeniedMessage, logout, clearAccessDeniedMessage]
)

  return <AuthContext.Provider value={value}>
    {children}
  </AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
