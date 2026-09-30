import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { sendPasswordResetEmail } from 'firebase/auth'
import AuthLayout from '../components/AuthLayout.jsx'
import { auth } from '../firebase/firebase'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleChange = (event) => {
    setEmail(event.target.value)
    if (errors.email) {
      setErrors({})
    }
    if (formError) {
      setFormError('')
    }
  }

  const validate = () => {
    const nextErrors = {}
    const trimmedEmail = email.trim()

    if (!trimmedEmail) {
      nextErrors.email = 'Email is required.'
    } else if (!emailPattern.test(trimmedEmail)) {
      nextErrors.email = 'Enter a valid email address.'
    }

    return nextErrors
  }

  const canSubmit = useMemo(() => {
    return Boolean(email.trim())
  }, [email])

  const handleSubmit = async (event) => {
    event.preventDefault()
    const nextErrors = validate()
    setErrors(nextErrors)
    setFormError('')
    setSuccessMessage('')

    if (Object.keys(nextErrors).length > 0) {
      return
    }

    setIsSubmitting(true)

    try {
      await sendPasswordResetEmail(auth, email.trim())
      setSuccessMessage('If an account exists, a reset link has been sent.')
    } catch (error) {
      const errorCode = error?.code || ''

      // Always show generic success for user-not-found so it doesn't reveal which emails exist
      if (errorCode === 'auth/user-not-found') {
        setSuccessMessage('If an account exists, a reset link has been sent.')
      } else if (errorCode === 'auth/invalid-email') {
        setErrors({ email: 'Enter a valid email address.' })
      } else if (errorCode === 'auth/too-many-requests') {
        setFormError('Too many attempts. Please try again later.')
      } else if (errorCode === 'auth/network-request-failed') {
        setFormError('Network error. Please check your internet connection.')
      } else {
        setFormError(
          'Unable to send password reset email. Please try again later.'
        )
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthLayout>
      <div className="auth-header">
        <h2>Reset password</h2>
        <p>Enter your email to receive password reset instructions.</p>
      </div>

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <div className="field-group">
          <label htmlFor="email">Email address</label>
          <input
            id="email"
            type="email"
            name="email"
            placeholder="admin@domain.com"
            value={email}
            onChange={handleChange}
            disabled={isSubmitting}
          />
          {errors.email && <span className="field-error">{errors.email}</span>}
        </div>

        {formError && <span className="field-error">{formError}</span>}
        {successMessage && <div className="field-success">{successMessage}</div>}

        <button
          className="primary-button"
          type="submit"
          disabled={!canSubmit || isSubmitting}
        >
          {isSubmitting ? 'Sending...' : 'Send reset link'}
        </button>

        <div className="auth-footer">
          <Link className="text-link" to="/">
            Back to Sign In
          </Link>
        </div>
      </form>
    </AuthLayout>
  )
}

export default ForgotPassword