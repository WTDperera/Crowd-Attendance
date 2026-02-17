import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useModules } from '../context/ModulesContext.jsx'

function EditModule() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { modules, updateModule } = useModules()

  const module = useMemo(
    () => modules.find((item) => item.id === id),
    [modules, id]
  )

  const [formData, setFormData] = useState({
    module_code: module?.module_code || '',
    module_name: module?.module_name || '',
    department: module?.department || '',
    level: module?.level || '',
    semester: module?.semester || '',
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

    if (!formData.module_code.trim()) {
      nextErrors.module_code = 'Module code is required.'
    } else if (
      modules.some(
        (item) =>
          item.id !== module.id &&
          item.module_code.toLowerCase() ===
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

    updateModule(module.id, {
      module_code: formData.module_code.trim(),
      module_name: formData.module_name.trim(),
      department: formData.department.trim(),
      level: formData.level.trim(),
      semester: formData.semester.trim(),
    })

    navigate(`/modules/${module.id}`)
  }

  return (
    <div className="card form-card">
      <div className="card-header">
        <h4>Edit Module</h4>
        <span className="helper-text">Update module information.</span>
      </div>

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <div className="field-group">
          <label htmlFor="moduleCode">Module Code</label>
          <input
            id="moduleCode"
            type="text"
            name="module_code"
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
            value={formData.semester}
            onChange={handleChange}
          />
          {errors.semester && (
            <span className="field-error">{errors.semester}</span>
          )}
        </div>

        <button className="primary-button" type="submit" disabled={!canSubmit}>
          Save Changes
        </button>
      </form>
    </div>
  )
}

export default EditModule
