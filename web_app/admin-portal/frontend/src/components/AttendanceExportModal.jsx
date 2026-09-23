import { useState } from 'react'
import '../styles/attendanceExportModal.css'

function AttendanceExportModal({
  isOpen,
  moduleName,
  moduleId,
  onClose,
  onExport,
  isLoading = false,
}) {
  const [exportType, setExportType] = useState('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [error, setError] = useState('')

  const handleExport = () => {
    setError('')

    // Validate date range if custom date range is selected
    if (exportType === 'dateRange') {
      if (!startDate) {
        setError('Start date is required.')
        return
      }
      if (!endDate) {
        setError('End date is required.')
        return
      }
      if (new Date(startDate) > new Date(endDate)) {
        setError('Start date must be before end date.')
        return
      }
    }

    onExport({
      exportType,
      startDate: exportType === 'dateRange' ? startDate : null,
      endDate: exportType === 'dateRange' ? endDate : null,
    })
  }

  const handleClose = () => {
    setExportType('all')
    setStartDate('')
    setEndDate('')
    setError('')
    onClose()
  }

  if (!isOpen) {
    return null
  }

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Download Attendance Records</h3>
          <button
            className="modal-close-btn"
            onClick={handleClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <p className="form-label">Module</p>
            <p className="module-info">{moduleName || moduleId}</p>
          </div>

          <div className="form-group">
            <p className="form-label">Select Records</p>
            <div className="radio-group">
              <label className="radio-label">
                <input
                  type="radio"
                  value="all"
                  checked={exportType === 'all'}
                  onChange={(e) => {
                    setExportType(e.target.value)
                    setError('')
                  }}
                />
                All Records
              </label>
              <label className="radio-label">
                <input
                  type="radio"
                  value="dateRange"
                  checked={exportType === 'dateRange'}
                  onChange={(e) => {
                    setExportType(e.target.value)
                    setError('')
                  }}
                />
                Custom Date Range
              </label>
            </div>
          </div>

          {exportType === 'dateRange' && (
            <div className="date-range-group">
              <div className="form-group">
                <label htmlFor="startDate" className="form-label">
                  Start Date
                </label>
                <input
                  type="date"
                  id="startDate"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value)
                    setError('')
                  }}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label htmlFor="endDate" className="form-label">
                  End Date
                </label>
                <input
                  type="date"
                  id="endDate"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value)
                    setError('')
                  }}
                  className="form-input"
                />
              </div>
            </div>
          )}

          {error && <div className="error-message">{error}</div>}
        </div>

        <div className="modal-footer">
          <button
            className="secondary-button"
            onClick={handleClose}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            className="primary-button"
            onClick={handleExport}
            disabled={isLoading}
          >
            {isLoading ? 'Generating...' : 'Download Excel'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default AttendanceExportModal
