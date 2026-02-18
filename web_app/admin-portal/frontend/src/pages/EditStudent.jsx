import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStudents } from '../context/StudentsContext.jsx'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function EditStudent() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { students, updateStudent } = useStudents()

  const student = useMemo(
    () => students.find((item) => item.id === id),
    [students, id]
  )

  const [formData, setFormData] = useState({
    email: student?.email || '',
    password: '',
  })
  const [errors, setErrors] = useState({})
  const [showPassword, setShowPassword] = useState(false)

  if (!student) {
    return (
      <div className="card">
        <h4>Student not found</h4>
        <p className="helper-text">Return to the students list to continue.</p>
        <button
          className="primary-button"
          type="button"
          onClick={() => navigate('/students')}
        >
          Back to Students
        </button>
      </div>
    )
  }

  const handleChange = (event) => {
    const { name, value } = event.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const validate = () => {
    const nextErrors = {}

    if (!formData.email.trim()) {
      nextErrors.email = 'Email is required.'
    } else if (!emailPattern.test(formData.email)) {
      nextErrors.email = 'Enter a valid email address.'
    }

    if (formData.password && formData.password.length < 8) {
      nextErrors.password = 'Password must be at least 8 characters.'
    }

    return nextErrors
  }

  const canSubmit = useMemo(() => formData.email, [formData.email])

  const handleSubmit = (event) => {
    event.preventDefault()
    const nextErrors = validate()
    setErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) {
      return
    }

    updateStudent(student.id, { email: formData.email })
    console.log('Updated student credentials:', {
      id: student.id,
      email: formData.email,
      password: formData.password || '(unchanged)',
    })
    navigate('/students')
  }

  return (
    <div className="card form-card">
      <div className="card-header">
        <h4>Edit Student</h4>
        <span className="helper-text">Update admin-managed credentials.</span>
      </div>

      <div className="student-meta">
        <div>
          <p className="meta-label">Registration Number</p>
          <p className="meta-value">{student.reg_no}</p>
        </div>
        <div>
          <p className="meta-label">Device ID</p>
          <p className="meta-value">{student.device_id || 'Not set'}</p>
        </div>
      </div>

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <div className="field-group">
          <label htmlFor="editEmail">Student Email</label>
          <input
            id="editEmail"
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
          />
          {errors.email && <span className="field-error">{errors.email}</span>}
        </div>

        <div className="field-group">
          <label htmlFor="editPassword">New Password (optional)</label>
          <div className="field-inline">
            <input
              id="editPassword"
              type={showPassword ? 'text' : 'password'}
              name="password"
              placeholder="Set a new password"
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

        <button className="primary-button" type="submit" disabled={!canSubmit}>
          Save Changes
        </button>
      </form>
    </div>
  )
}

export default EditStudent
