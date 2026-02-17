import { createContext, useContext, useMemo, useState } from 'react'

const AuthContext = createContext(null)
const AUTH_KEY = 'admin_auth'

export function AuthProvider({ children }) {
  const [isAuthed, setIsAuthed] = useState(
    () => localStorage.getItem(AUTH_KEY) === 'true'
  )

  const login = () => {
    localStorage.setItem(AUTH_KEY, 'true')
    setIsAuthed(true)
  }

  const logout = () => {
    localStorage.removeItem(AUTH_KEY)
    setIsAuthed(false)
  }

  const value = useMemo(() => ({ isAuthed, login, logout }), [isAuthed])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
