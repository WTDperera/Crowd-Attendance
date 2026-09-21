import { createContext, useContext, useEffect, useMemo, useState } from 'react'
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
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
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

        if (!lecturerDoc.exists()) {
          await signOut(auth)
          setUser(null)
          setLecturerProfile(null)
          setAccessDeniedMessage(
            'This account is not authorized to access the admin portal.'
          )
          setAuthLoading(false)
          return
        }

        setLecturerProfile(lecturerDoc.data())
      } catch {
        await signOut(auth)
        setUser(null)
        setLecturerProfile(null)
        setAccessDeniedMessage(
          'Unable to verify lecturer access right now. Please try again.'
        )
        setAuthLoading(false)
        return
      }

      setUser(nextUser)
      setAccessDeniedMessage('')
      setAuthLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const logout = () => signOut(auth)
  const clearAccessDeniedMessage = () => setAccessDeniedMessage('')

  const value = useMemo(
    () => ({
      user,
      lecturerProfile,
      isAuthed: Boolean(user),
      authLoading,
      logout,
      accessDeniedMessage,
      clearAccessDeniedMessage,
    }),
    [user, lecturerProfile, authLoading, accessDeniedMessage]
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