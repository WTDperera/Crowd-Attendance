import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { getStudents, updateStudent } from '../services/studentService'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function EditStudent() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [student, setStudent] = useState(location.state?.student || null)
  const [formData, setFormData] = useState({
    reg_no: location.state?.student?.reg_no || '',
    email: location.state?.student?.email || '',
  })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [isLoading, setIsLoading] = useState(!location.state?.student)

  useEffect(() => {
    let isMounted = true

    const loadStudent = async () => {
      if (student) {
        return
      }

      setIsLoading(true)
      try {
        const rows = await getStudents()
        const matched = rows.find((item) => item.id === id) || null
        if (isMounted) {
          setStudent(matched)
          setFormData({
            reg_no: matched?.reg_no || '',
            email: matched?.email || '',
          })
        }
      } catch (error) {
        if (isMounted) {
          setFormError(error.message)
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadStudent()

    return () => {
      isMounted = false
    }
  }, [id, student])

  if (isLoading) {
    return (
      <div className="card">
        <h4>Loading student...</h4>
      </div>
    )
  }

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

    if (!formData.reg_no.trim()) {
      nextErrors.reg_no = 'Registration number is required.'
    }

    if (!formData.email.trim()) {
      nextErrors.email = 'Email is required.'
    } else if (!emailPattern.test(formData.email)) {
      nextErrors.email = 'Enter a valid email address.'
    }

    return nextErrors
  }

  const canSubmit = useMemo(() => {
    return formData.email && formData.reg_no
  }, [formData.email, formData.reg_no])

  const handleSubmit = async (event) => {
    event.preventDefault()
    const nextErrors = validate()
    setErrors(nextErrors)
    setFormError('')

    if (Object.keys(nextErrors).length > 0) {
      return
    }

    try {
      await updateStudent(student.id, {
        email: formData.email,
        reg_no: formData.reg_no,
      })
      navigate('/students', {
        state: { message: 'Student updated successfully.' },
      })
    } catch (error) {
      setFormError(error.message)
    }
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
          <label htmlFor="editRegNo">Registration Number</label>
          <input
            id="editRegNo"
            type="text"
            name="reg_no"
            value={formData.reg_no}
            onChange={handleChange}
          />
          {errors.reg_no && (
            <span className="field-error">{errors.reg_no}</span>
          )}
        </div>

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

        {formError && <span className="field-error">{formError}</span>}

        <button className="primary-button" type="submit" disabled={!canSubmit}>
          Save Changes
        </button>
      </form>
    </div>
  )
}

export default EditStudent
