import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useModules } from '../context/ModulesContext.jsx'

function AddSession() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { modules, addSession } = useModules()
  const module = useMemo(
    () => modules.find((item) => item.id === id),
    [modules, id]
  )

  const [formData, setFormData] = useState({
    session_title: '',
    date: '',
    start_time: '',
    end_time: '',
    location: '',
    status: 'scheduled',
  })
  const [errors, setErrors] = useState({})

  if (!module) {
    return (
      <div className="card">
        <h4>Module not found</h4>
        <p className="helper-text">Return to the modules list to continue.</p>
        <button
          className="primary-button"
          type="button"
          onClick={() => navigate('/dashboard')}
        >
          Back to Modules
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

    if (!formData.session_title.trim()) {
      nextErrors.session_title = 'Session title is required.'
    }
    if (!formData.date) {
      nextErrors.date = 'Date is required.'
    }
    if (!formData.start_time) {
      nextErrors.start_time = 'Start time is required.'
    }
    if (!formData.end_time) {
      nextErrors.end_time = 'End time is required.'
    }
    if (!formData.location.trim()) {
      nextErrors.location = 'Location is required.'
    }

    if (formData.date && formData.start_time && formData.end_time) {
      const start = new Date(`${formData.date}T${formData.start_time}`)
      const end = new Date(`${formData.date}T${formData.end_time}`)
      if (start >= end) {
        nextErrors.end_time = 'End time must be after start time.'
      }
    }

    return nextErrors
  }

  const canSubmit = useMemo(() => {
    return (
      formData.session_title &&
      formData.date &&
      formData.start_time &&
      formData.end_time &&
      formData.location
    )
  }, [formData])

  const handleSubmit = (event) => {
    event.preventDefault()
    const nextErrors = validate()
    setErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) {
      return
    }

    const startTime = `${formData.date}T${formData.start_time}:00`
    const endTime = `${formData.date}T${formData.end_time}:00`

    addSession({
      id: `ses_${Date.now()}`,
      module_id: id,
      session_title: formData.session_title.trim(),
      start_time: startTime,
      end_time: endTime,
      location: formData.location.trim(),
      status: formData.status,
      created_at: new Date().toISOString(),
    })

    navigate(`/modules/${id}`)
  }

  return (
    <div className="card form-card">
      <div className="card-header">
        <h4>Add Session</h4>
        <span className="helper-text">{module.module_code}</span>
      </div>

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <div className="field-group">
          <label htmlFor="sessionTitle">Session Title</label>
          <input
            id="sessionTitle"
            type="text"
            name="session_title"
            placeholder="Week 1 Lecture"
            value={formData.session_title}
            onChange={handleChange}
          />
          {errors.session_title && (
            <span className="field-error">{errors.session_title}</span>
          )}
        </div>

        <div className="field-group">
          <label htmlFor="sessionDate">Date</label>
          <input
            id="sessionDate"
            type="date"
            name="date"
            value={formData.date}
            onChange={handleChange}
          />
          {errors.date && <span className="field-error">{errors.date}</span>}
        </div>

        <div className="field-row split">
          <div className="field-group">
            <label htmlFor="sessionStart">Start Time</label>
            <input
              id="sessionStart"
              type="time"
              name="start_time"
              value={formData.start_time}
              onChange={handleChange}
            />
            {errors.start_time && (
              <span className="field-error">{errors.start_time}</span>
            )}
          </div>
          <div className="field-group">
            <label htmlFor="sessionEnd">End Time</label>
            <input
              id="sessionEnd"
              type="time"
              name="end_time"
              value={formData.end_time}
              onChange={handleChange}
            />
            {errors.end_time && (
              <span className="field-error">{errors.end_time}</span>
            )}
          </div>
        </div>

        <div className="field-group">
          <label htmlFor="location">Location</label>
          <input
            id="location"
            type="text"
            name="location"
            placeholder="LT-01"
            value={formData.location}
            onChange={handleChange}
          />
          {errors.location && (
            <span className="field-error">{errors.location}</span>
          )}
        </div>

        <div className="field-group">
          <label htmlFor="status">Status</label>
          <select
            id="status"
            name="status"
            value={formData.status}
            onChange={handleChange}
          >
            <option value="scheduled">Scheduled</option>
            <option value="active">Active</option>
            <option value="ended">Ended</option>
          </select>
        </div>

        <button className="primary-button" type="submit" disabled={!canSubmit}>
          Save Session
        </button>
      </form>
    </div>
  )
}

export default AddSession
