import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { signInWithEmailAndPassword } from 'firebase/auth'
import AuthLayout from '../components/AuthLayout.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { auth } from '../firebase/firebase'



const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function LoginPage() {
  const navigate = useNavigate()
  const { user, authLoading } = useAuth()
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    remember: false,
  })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const validate = () => {
    const nextErrors = {}

    if (!formData.email.trim()) {
      nextErrors.email = 'Email is required.'
    } else if (!emailPattern.test(formData.email)) {
      nextErrors.email = 'Enter a valid email address.'
    }

    if (!formData.password) {
      nextErrors.password = 'Password is required.'
    } else if (formData.password.length < 8) {
      nextErrors.password = 'Password must be at least 8 characters.'
    }

    return nextErrors
  }

  const canSubmit = useMemo(() => {
    return formData.email && formData.password
  }, [formData.email, formData.password])

  const handleSubmit = async (event) => {
    event.preventDefault()
    const nextErrors = validate()
    setErrors(nextErrors)
    setFormError('')

    if (Object.keys(nextErrors).length > 0) {
      return
    }

    try {
      await signInWithEmailAndPassword(auth, formData.email, formData.password)
      navigate('/dashboard')
    } catch (error) {
      const errorCode = error?.code
      const friendlyMessageMap = {
        'auth/user-not-found': 'No account found for this email.',
        'auth/wrong-password': 'Incorrect password.',
        'auth/invalid-email': 'Invalid email address.',
        'auth/too-many-requests': 'Too many attempts. Try again later.',
      }
      setFormError(
        friendlyMessageMap[errorCode] ||
          'Unable to sign in right now. Please try again.'
      )
    }
  }

  useEffect(() => {
    if (!authLoading && user) {
      navigate('/dashboard')
    }
  }, [authLoading, user, navigate])

  return (
    <AuthLayout>
      <div className="auth-header">
        <h2>Welcome back</h2>
        <p>Sign in to manage attendance and approvals.</p>
      </div>

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <div className="field-group">
          <label htmlFor="email">Email address</label>
          <input
            id="email"
            type="email"
            name="email"
            placeholder="admin@domain.com"
            value={formData.email}
            onChange={handleChange}
          />
          {errors.email && <span className="field-error">{errors.email}</span>}
        </div>

        <div className="field-group">
          <label htmlFor="password">Password</label>
          <div className="field-inline">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              name="password"
              placeholder="Enter your password"
              value={formData.password}
              onChange={handleChange}
            />
            <button
              type="button"
              className="ghost-button"
              onClick={() => setShowPassword((prev) => !prev)}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          {errors.password && (
            <span className="field-error">{errors.password}</span>
          )}
        </div>

        <div className="field-row">
          <label className="checkbox">
            <input
              type="checkbox"
              name="remember"
              checked={formData.remember}
              onChange={handleChange}
            />
            Remember me
          </label>
          <Link className="text-link" to="/forgot-password">
            Forgot password?
          </Link>
        </div>

        {formError && <span className="field-error">{formError}</span>}
        <button className="primary-button" type="submit" disabled={!canSubmit}>
          Sign in
        </button>
      </form>

      <p className="auth-footer">
        Don&apos;t have an admin account?{' '}
        <Link className="text-link" to="/register">
          Register
        </Link>
      </p>
    </AuthLayout>
  )
}

export default LoginPage
