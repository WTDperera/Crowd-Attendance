import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useModules } from '../context/ModulesContext.jsx'

function AddModule() {
  const navigate = useNavigate()
  const { modules, addModule } = useModules()
  const [formData, setFormData] = useState({
    module_code: '',
    module_name: '',
    department: '',
    level: '',
    semester: '',
  })
  const [errors, setErrors] = useState({})

  const handleChange = (event) => {
    const { name, value } = event.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const validate = () => {
    const nextErrors = {}

    if (!formData.module_code.trim()) {
      nextErrors.module_code = 'Module code is required.'
    } else if (
      modules.some(
        (module) =>
          module.module_code.toLowerCase() ===
          formData.module_code.trim().toLowerCase()
      )
    ) {
      nextErrors.module_code = 'Module code must be unique.'
    }

    if (!formData.module_name.trim()) {
      nextErrors.module_name = 'Module name is required.'
    }

    if (!formData.department.trim()) {
      nextErrors.department = 'Department is required.'
    }

    if (!formData.level.trim()) {
      nextErrors.level = 'Level is required.'
    }

    if (!formData.semester.trim()) {
      nextErrors.semester = 'Semester is required.'
    }

    return nextErrors
  }

  const canSubmit = useMemo(() => {
    return (
      formData.module_code &&
      formData.module_name &&
      formData.department &&
      formData.level &&
      formData.semester
    )
  }, [formData])

  const handleSubmit = (event) => {
    event.preventDefault()
    const nextErrors = validate()
    setErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) {
      return
    }

    addModule({
      id: `mod_${Date.now()}`,
      module_code: formData.module_code.trim(),
      module_name: formData.module_name.trim(),
      department: formData.department.trim(),
      level: formData.level.trim(),
      semester: formData.semester.trim(),
      created_at: new Date().toISOString(),
    })

    navigate('/dashboard')
  }

  return (
    <div className="card form-card">
      <div className="card-header">
        <h4>Add Module</h4>
        <span className="helper-text">Create a new module for attendance.</span>
      </div>

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <div className="field-group">
          <label htmlFor="moduleCode">Module Code</label>
          <input
            id="moduleCode"
            type="text"
            name="module_code"
            placeholder="EGT1234"
            value={formData.module_code}
            onChange={handleChange}
          />
          {errors.module_code && (
            <span className="field-error">{errors.module_code}</span>
          )}
        </div>

        <div className="field-group">
          <label htmlFor="moduleName">Module Name</label>
          <input
            id="moduleName"
            type="text"
            name="module_name"
            placeholder="Software Engineering"
            value={formData.module_name}
            onChange={handleChange}
          />
          {errors.module_name && (
            <span className="field-error">{errors.module_name}</span>
          )}
        </div>

        <div className="field-group">
          <label htmlFor="department">Department</label>
          <input
            id="department"
            type="text"
            name="department"
            placeholder="ENG"
            value={formData.department}
            onChange={handleChange}
          />
          {errors.department && (
            <span className="field-error">{errors.department}</span>
          )}
        </div>

        <div className="field-group">
          <label htmlFor="level">Level</label>
          <input
            id="level"
            type="text"
            name="level"
            placeholder="2"
            value={formData.level}
            onChange={handleChange}
          />
          {errors.level && <span className="field-error">{errors.level}</span>}
        </div>

        <div className="field-group">
          <label htmlFor="semester">Semester</label>
          <input
            id="semester"
            type="text"
            name="semester"
            placeholder="1"
            value={formData.semester}
            onChange={handleChange}
          />
          {errors.semester && (
            <span className="field-error">{errors.semester}</span>
          )}
        </div>

        <button className="primary-button" type="submit" disabled={!canSubmit}>
          Create Module
        </button>
      </form>
    </div>
  )
}

export default AddModule
