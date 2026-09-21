import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000',
})

// Delegates both password verification and the lecturer-access check to
// the backend (/api/auth/login), instead of calling Firebase Auth
// directly from the browser. On success, the backend returns a short-
// lived custom token that the caller should exchange for a real session
// via signInWithCustomToken(). Non-lecturers never receive a token.
export const loginWithBackend = async (email, password) => {
  try {
    const response = await api.post('/api/auth/login', { email, password })
    return response.data
  } catch (error) {
    const message =
      error?.response?.data?.message ||
      'Unable to sign in right now. Please try again.'
    throw new Error(message)
  }
}