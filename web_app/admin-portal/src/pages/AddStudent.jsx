import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStudents } from '../context/StudentsContext.jsx'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function AddStudent() {
  const navigate = useNavigate()
  const { addStudent } = useStudents()
  const [formData, setFormData] = useState({
    reg_no: '',
    email: '',
    password: '',
  })
  const [errors, setErrors] = useState({})
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

  const handleSubmit = (event) => {
    event.preventDefault()
    const nextErrors = validate()
    setErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) {
      return
    }

    const newStudent = {
      id: `stu_${Date.now()}`,
      reg_no: formData.reg_no,
      email: formData.email,
      device_id: null,
      device_locked_at: null,
      last_login: null,
    }

    console.log('New student credentials:', formData)
    addStudent(newStudent)
    navigate('/students')
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

        <button className="primary-button" type="submit" disabled={!canSubmit}>
          Create Student
        </button>
      </form>
    </div>
  )
}

export default AddStudent
