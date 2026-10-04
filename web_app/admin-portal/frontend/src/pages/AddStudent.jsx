import { useMemo, useState } from 'react'
import useSubmission from '../hooks/useSubmission'
import { addStudent as addStudentRequest } from '../services/studentService'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function AddStudent() {
  const submission = useSubmission()
  const [formData, setFormData] = useState({
    reg_no: '',
    email: '',
    password: '',
  })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [formSuccess, setFormSuccess] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const handleChange = (event) => {
    const { name, value } = event.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const validate = () => {
    const nextErrors = {}

    if (!formData.reg_no.trim()) {
      nextErrors.reg_no = 'Registration number is required.'
    }

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
    return formData.reg_no && formData.email && formData.password
  }, [formData])

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (submission.busy) return
    const nextErrors = validate()
    setErrors(nextErrors)
    setFormError('')
    setFormSuccess('')

    if (Object.keys(nextErrors).length > 0) {
      return
    }

    if (!submission.begin()) return
    try {
      const response = await addStudentRequest(formData)
      if (!response.uid && !response.student?.id) throw new Error('Account creation could not be confirmed. Refresh the student list before retrying.')
      if (!submission.isMounted()) return
      setFormSuccess('Student account created successfully.')
      setFormData({ reg_no: '', email: '', password: '' })
    } catch (error) {
      if (submission.isMounted()) setFormError(error.message)
    } finally {
      submission.end()
    }
  }

  return (
    <div className="card form-card">
      <div className="card-header">
        <h4>Add Student</h4>
        <span className="helper-text">
          Provide credentials to share with the student.
        </span>
      </div>

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <div className="field-group">
          <label htmlFor="regNo">Registration Number</label>
          <input
            id="regNo"
            type="text"
            name="reg_no"
            placeholder="EG/2022/5289"
            value={formData.reg_no}
            onChange={handleChange}
          />
          {errors.reg_no && (
            <span className="field-error">{errors.reg_no}</span>
          )}
        </div>

        <div className="field-group">
          <label htmlFor="studentEmail">Student Email</label>
          <input
            id="studentEmail"
            type="email"
            name="email"
            placeholder="student@domain.com"
            value={formData.email}
            onChange={handleChange}
          />
          {errors.email && <span className="field-error">{errors.email}</span>}
        </div>

        <div className="field-group">
          <label htmlFor="studentPassword">Password</label>
          <div className="field-inline">
            <input
              id="studentPassword"
              type={showPassword ? 'text' : 'password'}
              name="password"
              placeholder="Create a one-time password"
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

        <p className="helper-text">
          Share the credentials securely. Students cannot self-register.
        </p>

        {formError && <span className="field-error">{formError}</span>}
        {formSuccess && <span className="helper-text">{formSuccess}</span>}

        <button className="primary-button" type="submit" disabled={!canSubmit || submission.busy}>
          {submission.busy ? 'Creating Student...' : 'Create Student'}
        </button>
      </form>
    </div>
  )
}

export default AddStudent
