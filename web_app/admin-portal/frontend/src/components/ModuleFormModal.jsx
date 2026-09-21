import { useEffect, useMemo, useState } from 'react'
import { sha256 } from '../utils/hash'

const buildInitialState = (initialValues) => ({
  code: initialValues?.code || '',
  name: initialValues?.name || '',
  enrollment_enabled:
    typeof initialValues?.enrollment_enabled === 'boolean'
      ? initialValues.enrollment_enabled
      : true,
  enrollment_password: '',
  confirm_password: '',
})

function ModuleFormModal({
  isOpen,
  mode,
  initialValues,
  lecturerId,
  lecturerName,
  onClose,
  onSubmit,
  isSubmitting = false,
}) {
  const isEdit = mode === 'edit'
  const [formData, setFormData] = useState(buildInitialState(initialValues))
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (!isOpen) {
      return
    }

    setFormData(buildInitialState(initialValues))
    setErrors({})
  }, [initialValues, isOpen])

  const normalizeCode = (value) => value.trim().toUpperCase()

  const validate = () => {
    const nextErrors = {}
    const trimmedCode = normalizeCode(formData.code)

    if (!trimmedCode) {
      nextErrors.code = 'Module code is required.'
    } else if (/\s/.test(formData.code)) {
      nextErrors.code = 'Module code cannot contain spaces.'
    } else if (!/^[A-Z0-9]+$/.test(trimmedCode)) {
      nextErrors.code = 'Use only letters and numbers in the module code.'
    }

    if (!formData.name.trim()) {
      nextErrors.name = 'Module name is required.'
    }

    if (!lecturerId) {
      nextErrors.lecturer_id = 'You must be signed in to create a module.'
    }

    const hasPassword = formData.enrollment_password.trim().length > 0
    const hasConfirm = formData.confirm_password.trim().length > 0

    if (!isEdit || hasPassword || hasConfirm) {
      if (!hasPassword) {
        nextErrors.enrollment_password = isEdit
          ? 'Enter a new password to reset.'
          : 'Enrollment password is required.'
      } else if (formData.enrollment_password.trim().length < 6) {
        nextErrors.enrollment_password =
          'Enrollment password must be at least 6 characters.'
      }

      if (!hasConfirm) {
        nextErrors.confirm_password = isEdit
          ? 'Confirm the new password.'
          : 'Confirm password is required.'
      } else if (
        formData.enrollment_password.trim() !==
        formData.confirm_password.trim()
      ) {
        nextErrors.confirm_password = 'Passwords do not match.'
      }
    }

    return nextErrors
  }

  const canSubmit = useMemo(() => {
    return (
      formData.code &&
      formData.name &&
      Boolean(lecturerId) &&
      !isSubmitting
    )
  }, [formData, lecturerId, isSubmitting])

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox'
        ? checked
        : name === 'code'
          ? value.toUpperCase()
          : value,
    }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const nextErrors = validate()
    setErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) {
      return
    }

    const payload = {
      code: normalizeCode(formData.code),
      name: formData.name.trim(),
      lecturer_id: lecturerId,
      enrollment_enabled: Boolean(formData.enrollment_enabled),
    }

    const passwordValue = formData.enrollment_password.trim()
    if (!isEdit || passwordValue) {
      payload.enrollment_password_hash = await sha256(passwordValue)
    }

    onSubmit(payload)
  }

  if (!isOpen) {
    return null
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card">
        <div className="modal-header">
          <div>
            <p className="modal-title">
              {isEdit ? 'Edit Module' : 'Add Module'}
            </p>
            <p className="helper-text">
              {isEdit
                ? 'Update the module details.'
                : 'Create a new module for attendance tracking.'}
            </p>
          </div>
          <button className="ghost-button" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="field-group">
            <label htmlFor="moduleCode">Module Code</label>
            <input
              id="moduleCode"
              type="text"
              name="code"
              placeholder="CS101"
              value={formData.code}
              onChange={handleChange}
              readOnly={isEdit}
            />
            {isEdit && (
              <span className="helper-text">
                Module code cannot be changed after creation.
              </span>
            )}
            {errors.code && <span className="field-error">{errors.code}</span>}
          </div>

          <div className="field-group">
            <label htmlFor="moduleName">Module Name</label>
            <input
              id="moduleName"
              type="text"
              name="name"
              placeholder="Computer Systems"
              value={formData.name}
              onChange={handleChange}
            />
            {errors.name && <span className="field-error">{errors.name}</span>}
          </div>

          <div className="field-group">
            <label htmlFor="lecturerId">Lecturer</label>
            <input
              id="lecturerId"
              type="text"
              value={
                lecturerName || (lecturerId ? 'Unnamed lecturer' : 'Not signed in')
              }
              readOnly
              disabled
            />
            <span className="helper-text">
              Automatically set to your signed-in account.
            </span>
            {errors.lecturer_id && (
              <span className="field-error">{errors.lecturer_id}</span>
            )}
          </div>

          <div className="field-group">
            <label htmlFor="enrollmentEnabled">Enrollment Enabled</label>
            <div className="checkbox-row">
              <input
                id="enrollmentEnabled"
                type="checkbox"
                name="enrollment_enabled"
                checked={Boolean(formData.enrollment_enabled)}
                onChange={handleChange}
              />
              <span className="helper-text">
                Allow students to enroll in this module.
              </span>
            </div>
          </div>

          <div className="field-group">
            <label htmlFor="enrollmentPassword">
              {isEdit ? 'New Enrollment Password' : 'Enrollment Password'}
            </label>
            <input
              id="enrollmentPassword"
              type="password"
              name="enrollment_password"
              placeholder={isEdit ? 'Enter new password' : 'Enter password'}
              value={formData.enrollment_password}
              onChange={handleChange}
            />
            {isEdit && (
              <span className="helper-text">
                Leave blank to keep the current password.
              </span>
            )}
            {errors.enrollment_password && (
              <span className="field-error">{errors.enrollment_password}</span>
            )}
          </div>

          <div className="field-group">
            <label htmlFor="confirmPassword">
              {isEdit ? 'Confirm New Password' : 'Confirm Password'}
            </label>
            <input
              id="confirmPassword"
              type="password"
              name="confirm_password"
              placeholder="Re-enter password"
              value={formData.confirm_password}
              onChange={handleChange}
            />
            {errors.confirm_password && (
              <span className="field-error">{errors.confirm_password}</span>
            )}
          </div>

          <button className="primary-button" type="submit" disabled={!canSubmit}>
            {isEdit ? 'Save Changes' : 'Create Module'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default ModuleFormModal