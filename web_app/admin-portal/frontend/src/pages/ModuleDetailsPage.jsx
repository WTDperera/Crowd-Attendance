import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getModuleById } from '../services/moduleService'
import { getStudentsEnrolledInModule } from '../services/studentService'
import {
  downloadAttendanceExcel,
  downloadSessionExcel,
} from '../services/attendanceExportService'
import {
  getModuleAttendanceSummary,
  getModuleSessions,
  getSessionReport,
  markStudentAttendance,
} from '../services/moduleAttendanceService'
import AttendanceExportModal from '../components/AttendanceExportModal'
import { useAuth } from '../context/AuthContext.jsx'

function ModuleDetailsPage() {
  const { moduleId } = useParams()
  const navigate = useNavigate()
  const { user, lecturerProfile } = useAuth()
  const lecturerId = user?.uid || ''
  const [moduleData, setModuleData] = useState(null)
  const [students, setStudents] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [search, setSearch] = useState('')

  // Computed module attendance summary from completed sessions
  const [attendanceSummary, setAttendanceSummary] = useState(null)
  const [isLoadingSummary, setIsLoadingSummary] = useState(true)

  // Sessions state
  const [sessions, setSessions] = useState([])
  const [isLoadingSessions, setIsLoadingSessions] = useState(true)
  const [downloadingSessionId, setDownloadingSessionId] = useState(null)

  // Session attendance management modal state
  const [activeSessionModal, setActiveSessionModal] = useState(null)
  const [sessionReportData, setSessionReportData] = useState(null)
  const [isLoadingReport, setIsLoadingReport] = useState(false)
  const [sessionSearch, setSessionSearch] = useState('')
  const [pendingChanges, setPendingChanges] = useState({})
  const [isSavingAttendance, setIsSavingAttendance] = useState(false)
  const [saveErrorMessage, setSaveErrorMessage] = useState('')

  // Module matrix export modal state
  const [isExportModalOpen, setIsExportModalOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [exportMessage, setExportMessage] = useState({ type: '', text: '' })
  const moduleKey = decodeURIComponent(moduleId || '').trim().toUpperCase()

  const lecturerName =
    lecturerProfile?.fullName ||
    lecturerProfile?.name ||
    user?.displayName ||
    user?.email?.split('@')[0] ||
    ''

  const getCount = (student, prefix, key) => {
    const mapVal = student?.[prefix]?.[key]
    if (mapVal != null) {
      return Number(mapVal)
    }

    const flatVal = student?.[`${prefix}.${key}`]
    if (flatVal != null) {
      return Number(flatVal)
    }

    return 0
  }

  const fetchSessions = async () => {
    try {
      setIsLoadingSessions(true)
      const data = await getModuleSessions(moduleKey)
      setSessions(data)
    } catch (err) {
      console.error('Failed to load sessions:', err)
    } finally {
      setIsLoadingSessions(false)
    }
  }

  const fetchSummary = async () => {
    try {
      setIsLoadingSummary(true)
      const data = await getModuleAttendanceSummary(moduleKey)
      setAttendanceSummary(data)
    } catch (err) {
      console.error('Failed to load module attendance summary:', err)
    } finally {
      setIsLoadingSummary(false)
    }
  }

  useEffect(() => {
    let isMounted = true
    let unsubscribeStudents

    const fetchModule = async () => {
      setIsLoading(true)
      setErrorMessage('')

      try {
        const response = await getModuleById(moduleKey, lecturerId)

        if (isMounted) {
          setModuleData(response)
          setStudents([])
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(error.message)
          setModuleData(null)
          setStudents([])
        }
      }
    }

    const subscribeStudents = () => {
      unsubscribeStudents = getStudentsEnrolledInModule(
        moduleKey,
        (rows) => {
          if (isMounted) {
            setStudents(rows)
            setIsLoading(false)
          }
        },
        (error) => {
          if (isMounted) {
            setErrorMessage(error.message)
            setStudents([])
            setIsLoading(false)
          }
        }
      )
    }

    fetchModule().then(() => {
      subscribeStudents()
      fetchSessions()
      fetchSummary()
    })

    return () => {
      isMounted = false
      if (typeof unsubscribeStudents === 'function') {
        unsubscribeStudents()
      }
    }
  }, [moduleKey, lecturerId])

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLowerCase()

    if (!query) {
      return students
    }

    return students.filter((student) => {
      const regNo = (student.reg_no || '').toLowerCase()
      const email = (student.email || '').toLowerCase()
      return regNo.includes(query) || email.includes(query)
    })
  }, [students, search])

  const handleExportClick = () => {
    setExportMessage({ type: '', text: '' })
    setIsExportModalOpen(true)
  }

  const handleExport = async (options) => {
    setIsExporting(true)
    setExportMessage({ type: '', text: '' })

    try {
      await downloadAttendanceExcel(
        moduleKey,
        options.startDate,
        options.endDate
      )
      setExportMessage({
        type: 'success',
        text: 'Attendance matrix downloaded successfully!',
      })
      setIsExportModalOpen(false)

      setTimeout(() => {
        setExportMessage({ type: '', text: '' })
      }, 3000)
    } catch (error) {
      setExportMessage({
        type: 'error',
        text: error.message || 'Failed to download attendance matrix.',
      })
    } finally {
      setIsExporting(false)
    }
  }

  const handleDownloadSession = async (sessionId) => {
    setDownloadingSessionId(sessionId)
    setExportMessage({ type: '', text: '' })

    try {
      await downloadSessionExcel(sessionId)
      setExportMessage({
        type: 'success',
        text: 'Session report downloaded successfully!',
      })
      setTimeout(() => {
        setExportMessage({ type: '', text: '' })
      }, 3000)
    } catch (error) {
      setExportMessage({
        type: 'error',
        text: error.message || 'Failed to download session report.',
      })
    } finally {
      setDownloadingSessionId(null)
    }
  }

  const getStudentSavedCategory = (st) => {
    if (!st) return 'Absent'
    if (st.saved_status) return st.saved_status
    if (st.status === 1) {
      return st.marked_late ? 'Late' : 'Present'
    }
    if (st.status === 'ex') {
      return 'Excused'
    }
    return 'Absent'
  }

  const handleOpenSessionModal = async (session) => {
    setActiveSessionModal(session)
    setSessionReportData(null)
    setIsLoadingReport(true)
    setSessionSearch('')
    setPendingChanges({})
    setSaveErrorMessage('')

    try {
      const data = await getSessionReport(session.id)
      setSessionReportData(data)
    } catch (err) {
      window.alert(err.message || 'Unable to load session report.')
      setActiveSessionModal(null)
    } finally {
      setIsLoadingReport(false)
    }
  }

  const handleCloseSessionModal = () => {
    setActiveSessionModal(null)
    setSessionReportData(null)
    setSessionSearch('')
    setPendingChanges({})
    setSaveErrorMessage('')
  }

  const handleCloseSessionModalWithCheck = () => {
    if (Object.keys(pendingChanges).length > 0) {
      const confirmed = window.confirm('You have unsaved changes. Save or discard?')
      if (!confirmed) return
    }
    handleCloseSessionModal()
  }

  const handleDownloadSessionWithCheck = (sessionId) => {
    if (Object.keys(pendingChanges).length > 0) {
      const confirmed = window.confirm(
        'You have unsaved changes. Save or discard?'
      )
      if (!confirmed) return
    }
    handleDownloadSession(sessionId)
  }

  const handleStageStatusChange = (studentUid, newStatus) => {
    const studentRec = sessionReportData?.records?.find(
      (r) => r.student_uid === studentUid
    )
    if (!studentRec) return

    const originalSaved = getStudentSavedCategory(studentRec)

    setPendingChanges((prev) => {
      const next = { ...prev }
      if (originalSaved === newStatus) {
        delete next[studentUid]
      } else {
        next[studentUid] = newStatus
      }
      return next
    })
  }

  const handleDiscardChanges = () => {
    setPendingChanges({})
    setSaveErrorMessage('')
  }

  const handleSavePendingAttendance = async () => {
    if (!activeSessionModal) return
    const entries = Object.entries(pendingChanges)
    if (entries.length === 0) return

    setIsSavingAttendance(true)
    setSaveErrorMessage('')
    const remainingPending = {}
    const errors = []

    for (const [studentUid, newStatus] of entries) {
      try {
        await markStudentAttendance(activeSessionModal.id, studentUid, newStatus)
      } catch (err) {
        remainingPending[studentUid] = newStatus
        const studentRec = sessionReportData?.records?.find(
          (r) => r.student_uid === studentUid
        )
        const identifier = studentRec?.reg_no || studentUid
        errors.push(`${identifier}: ${err.message || 'Marking failed'}`)
      }
    }

    setPendingChanges(remainingPending)
    setIsSavingAttendance(false)

    // Reload fresh data from server
    try {
      const freshData = await getSessionReport(activeSessionModal.id)
      setSessionReportData(freshData)
      fetchSessions()
      fetchSummary()
    } catch (err) {
      console.error('Error refreshing session report:', err)
    }

    if (errors.length > 0) {
      const errorText = `Failed to save ${errors.length} student(s):\n${errors.join('\n')}`
      setSaveErrorMessage(errorText)
      window.alert(`Some changes could not be saved:\n\n${errors.join('\n')}`)
    } else {
      setExportMessage({
        type: 'success',
        text: `Saved attendance changes successfully!`,
      })
      setTimeout(() => {
        setExportMessage({ type: '', text: '' })
      }, 3000)
    }
  }

  const liveSessionStats = useMemo(() => {
    if (!sessionReportData?.records) {
      return {
        total_students: 0,
        total_present: 0,
        total_absent: 0,
        total_excused: 0,
        attendance_percentage: 0,
      }
    }

    let presents = 0
    let absents = 0
    let excused = 0

    sessionReportData.records.forEach((st) => {
      const effectiveCategory =
        pendingChanges[st.student_uid] !== undefined
          ? pendingChanges[st.student_uid]
          : getStudentSavedCategory(st)

      if (effectiveCategory === 'Present' || effectiveCategory === 'Late') {
        presents++
      } else if (effectiveCategory === 'Excused') {
        excused++
      } else {
        absents++
      }
    })

    const total = sessionReportData.records.length
    const rate =
      total > 0 ? Math.round(((presents + excused) / total) * 10000) / 100 : 0

    return {
      total_students: total,
      total_present: presents,
      total_absent: absents,
      total_excused: excused,
      attendance_percentage: rate,
    }
  }, [sessionReportData, pendingChanges])

  const filteredSessionRecords = useMemo(() => {
    if (!sessionReportData?.records) return []
    const q = sessionSearch.trim().toLowerCase()
    const sorted = [...sessionReportData.records].sort((a, b) =>
      (a.reg_no || '').localeCompare(b.reg_no || '', undefined, {
        numeric: true,
        sensitivity: 'base',
      })
    )
    if (!q) return sorted
    return sorted.filter((r) => {
      const regNo = (r.reg_no || '').toLowerCase()
      return regNo.includes(q)
    })
  }, [sessionReportData, sessionSearch])

  const totalSessions = sessions.length || Number(moduleData?.total_sessions || 0)
  const fallbackKey = (moduleData?.code || moduleKey || '').trim().toUpperCase()

  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return '—'
    try {
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) return dateStr
      return d.toLocaleDateString('en-US', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    } catch {
      return dateStr
    }
  }

  const formatTimeDisplay = (dateStr) => {
    if (!dateStr) return ''
    try {
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) return ''
      return d.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      })
    } catch {
      return ''
    }
  }

  if (isLoading) {
    return (
      <div className="card">
        <h4>Loading module...</h4>
      </div>
    )
  }

  if (!moduleData) {
    return (
      <div className="card">
        <h4>Module not found</h4>
        <p className="helper-text">Return to modules list to continue.</p>
        <button
          className="primary-button"
          type="button"
          onClick={() => navigate('/modules')}
        >
          Back to Modules
        </button>
        {errorMessage && <p className="field-error">{errorMessage}</p>}
      </div>
    )
  }

  return (
    <div className="dashboard-grid">
      <section className="card module-detail">
        <div className="module-detail-header">
          <div>
            <p className="module-code">{moduleData.code}</p>
            <h4>{moduleData.name}</h4>
          </div>
          <div className="button-group">
            <button
              className="primary-button"
              type="button"
              onClick={handleExportClick}
              title="Download full module attendance matrix as Excel file"
            >
              📥 Download Attendance Excel
            </button>
            <button
              className="ghost-button"
              type="button"
              onClick={() => navigate('/modules')}
            >
              Back to Modules
            </button>
          </div>
        </div>
        <div className="module-meta-grid">
          <div>
            <p className="meta-label">Lecturer</p>
            <p className="meta-value">{moduleData.lecturer_name || lecturerName || '—'}</p>
          </div>
          <div>
            <p className="meta-label">Total Sessions</p>
            <p className="meta-value">{totalSessions}</p>
          </div>
          <div>
            <p className="meta-label">Enrollment</p>
            <p className="meta-value">
              {moduleData.enrollment_enabled ? 'Enabled' : 'Disabled'}
            </p>
          </div>
        </div>
      </section>

      {/* SESSIONS SECTION */}
      <section className="card">
        <div className="card-header row">
          <div>
            <h4>Sessions</h4>
            <span className="helper-text">
              All active and completed sessions recorded for this module.
            </span>
            <p className="helper-text">Create attendance sessions in the lecturer Android app.</p>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date &amp; Time</th>
                <th>Topic</th>
                <th>Status</th>
                <th>Attendees</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingSessions && (
                <tr>
                  <td colSpan="5" className="empty-cell">
                    Loading sessions...
                  </td>
                </tr>
              )}
              {!isLoadingSessions &&
                sessions.map((session) => {
                  const dateStr = formatDateDisplay(session.started_at)
                  const timeStr = formatTimeDisplay(session.started_at)

                  return (
                    <tr key={session.id}>
                      <td>
                        <strong>{dateStr}</strong>
                        {timeStr && (
                          <span
                            className="helper-text"
                            style={{ display: 'block', fontSize: '0.8rem' }}
                          >
                            {timeStr}
                          </span>
                        )}
                      </td>
                      <td>{session.topic || 'Lecture'}</td>
                      <td>
                        <span
                          className={`status-pill ${
                            session.status === 'completed' ? 'info' : 'success'
                          }`}
                        >
                          {session.status || 'completed'}
                        </span>
                      </td>
                      <td>{session.student_count || 0}</td>
                      <td>
                        <div className="button-group" style={{ gap: '8px' }}>
                          <button
                            type="button"
                            className="ghost-button"
                            style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                            onClick={() => handleDownloadSession(session.id)}
                            disabled={downloadingSessionId === session.id}
                            title="Download single session attendance report as Excel"
                          >
                            {downloadingSessionId === session.id
                              ? 'Exporting...'
                              : '📥 Report'}
                          </button>
                          <button
                            type="button"
                            className="primary-button"
                            style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                            onClick={() => handleOpenSessionModal(session)}
                            title="Manually mark or edit student attendance"
                          >
                            ✏️ Mark
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              {!isLoadingSessions && sessions.length === 0 && (
                <tr>
                  <td colSpan="5" className="empty-cell">
                    No sessions recorded for this module yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ENROLLED STUDENTS SECTION */}
      <section className="card">
        <div className="card-header row">
          <div>
            <h4>
              Enrolled Students
              {isLoadingSummary && (
                <span
                  className="helper-text"
                  style={{ fontSize: '0.8rem', marginLeft: '8px', fontWeight: 'normal' }}
                >
                  (Refreshing...)
                </span>
              )}
            </h4>
            <span className="helper-text">
              Attendance totals for enrolled students.
            </span>
          </div>
          <button
            className="ghost-button"
            type="button"
            onClick={handleExportClick}
            title="Download attendance records as Excel file"
          >
            📥 Overall Matrix Export
          </button>
        </div>

        {errorMessage && <span className="field-error">{errorMessage}</span>}

        <div className="filters">
          <input
            type="search"
            placeholder="Search by reg no or email"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Reg No</th>
                <th>Email</th>
                <th>Present</th>
                <th>Absent</th>
                <th>Total</th>
                <th>Attendance %</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((student) => {
                const studentUid = student.uid || student.id
                const stats = attendanceSummary?.summary_by_uid?.[studentUid]
                const totalSessions = attendanceSummary?.total_sessions ?? 0

                const presentCount = stats ? stats.present : 0
                const absentCount = stats ? stats.absent : totalSessions
                const total = stats ? stats.total : totalSessions
                const percentage = stats ? Number(stats.percentage).toFixed(2) : '0.00'
                const isCellLoading = isLoadingSummary && !attendanceSummary

                return (
                  <tr key={studentUid}>
                    <td>{student.reg_no || '—'}</td>
                    <td>{student.email || '—'}</td>
                    <td>{isCellLoading ? '...' : presentCount}</td>
                    <td>{isCellLoading ? '...' : absentCount}</td>
                    <td>{isCellLoading ? '...' : total}</td>
                    <td>
                      <span className="status-pill info">
                        {isCellLoading ? '...' : `${percentage}%`}
                      </span>
                    </td>
                  </tr>
                )
              })}
              {filteredStudents.length === 0 && (
                <tr>
                  <td colSpan="6" className="empty-cell">
                    {isLoading
                      ? 'Loading enrolled students...'
                      : students.length === 0
                      ? 'No students enrolled.'
                      : 'No students match your filters.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {exportMessage.text && (
        <section className={`card export-message ${exportMessage.type}`}>
          <p>{exportMessage.text}</p>
        </section>
      )}

      {/* OVERALL ATTENDANCE EXCEL MODAL */}
      <AttendanceExportModal
        isOpen={isExportModalOpen}
        moduleName={moduleData?.name}
        moduleId={moduleKey}
        onClose={() => setIsExportModalOpen(false)}
        onExport={handleExport}
        isLoading={isExporting}
      />

      {/* MANUAL SESSION ATTENDANCE EDIT MODAL */}
      {activeSessionModal && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleCloseSessionModalWithCheck()
            }
          }}
        >
          <div
            className="modal-card"
            style={{ width: 'min(980px, 95vw)', maxHeight: '90vh' }}
          >
            <div className="modal-header">
              <div>
                <p className="modal-title">
                  Session Attendance: {activeSessionModal.topic || 'Lecture'}
                </p>
                <p className="helper-text">
                  Date: {formatDateDisplay(activeSessionModal.started_at)} | Module:{' '}
                  {moduleData.code}
                </p>
              </div>
              <div
                className="button-group"
                style={{ alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}
              >
                <button
                  type="button"
                  className="primary-button"
                  onClick={handleSavePendingAttendance}
                  disabled={Object.keys(pendingChanges).length === 0 || isSavingAttendance}
                  title="Save attendance changes to server"
                  style={{ padding: '6px 14px', fontSize: '0.85rem' }}
                >
                  {isSavingAttendance
                    ? 'Saving...'
                    : `Save changes${
                        Object.keys(pendingChanges).length > 0
                          ? ` (${Object.keys(pendingChanges).length})`
                          : ''
                      }`}
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={handleDiscardChanges}
                  disabled={Object.keys(pendingChanges).length === 0 || isSavingAttendance}
                  title="Discard unsaved changes"
                  style={{ padding: '6px 14px', fontSize: '0.85rem' }}
                >
                  Discard
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => handleDownloadSessionWithCheck(activeSessionModal.id)}
                  disabled={downloadingSessionId === activeSessionModal.id || isSavingAttendance}
                  title="Download session Excel report (uses saved data)"
                  style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                >
                  {downloadingSessionId === activeSessionModal.id
                    ? 'Exporting...'
                    : '📥 Download Report'}
                </button>
                <button
                  className="ghost-button"
                  type="button"
                  onClick={handleCloseSessionModalWithCheck}
                  disabled={isSavingAttendance}
                  style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                >
                  Close
                </button>
              </div>
            </div>

            {saveErrorMessage && (
              <div
                style={{
                  padding: '8px 12px',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '6px',
                  color: '#991b1b',
                  fontSize: '0.85rem',
                  whiteSpace: 'pre-line',
                }}
              >
                {saveErrorMessage}
              </div>
            )}

            {isLoadingReport && (
              <div className="empty-state">Loading student attendance...</div>
            )}

            {!isLoadingReport && sessionReportData && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  overflow: 'hidden',
                }}
              >
                {/* Stats row - live values */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                    gap: '12px',
                  }}
                >
                  <div
                    style={{
                      background: '#f8fafc',
                      padding: '10px',
                      borderRadius: '8px',
                      textAlign: 'center',
                    }}
                  >
                    <span className="helper-text">Enrolled</span>
                    <h4 style={{ margin: '4px 0 0' }}>
                      {liveSessionStats.total_students}
                    </h4>
                  </div>
                  <div
                    style={{
                      background: '#f0fdf4',
                      padding: '10px',
                      borderRadius: '8px',
                      textAlign: 'center',
                    }}
                  >
                    <span
                      className="helper-text"
                      style={{ color: '#16a34a' }}
                    >
                      Present
                    </span>
                    <h4 style={{ margin: '4px 0 0', color: '#16a34a' }}>
                      {liveSessionStats.total_present}
                    </h4>
                  </div>
                  <div
                    style={{
                      background: '#fef2f2',
                      padding: '10px',
                      borderRadius: '8px',
                      textAlign: 'center',
                    }}
                  >
                    <span
                      className="helper-text"
                      style={{ color: '#dc2626' }}
                    >
                      Absent
                    </span>
                    <h4 style={{ margin: '4px 0 0', color: '#dc2626' }}>
                      {liveSessionStats.total_absent}
                    </h4>
                  </div>
                  <div
                    style={{
                      background: '#eff6ff',
                      padding: '10px',
                      borderRadius: '8px',
                      textAlign: 'center',
                    }}
                  >
                    <span
                      className="helper-text"
                      style={{ color: '#2563eb' }}
                    >
                      Excused
                    </span>
                    <h4 style={{ margin: '4px 0 0', color: '#2563eb' }}>
                      {liveSessionStats.total_excused}
                    </h4>
                  </div>
                  <div
                    style={{
                      background: '#faf5ff',
                      padding: '10px',
                      borderRadius: '8px',
                      textAlign: 'center',
                    }}
                  >
                    <span
                      className="helper-text"
                      style={{ color: '#9333ea' }}
                    >
                      Rate
                    </span>
                    <h4 style={{ margin: '4px 0 0', color: '#9333ea' }}>
                      {liveSessionStats.attendance_percentage}%
                    </h4>
                  </div>
                </div>

                {/* Filter input */}
                <div className="filters" style={{ margin: 0 }}>
                  <input
                    type="search"
                    placeholder="Filter by reg no"
                    value={sessionSearch}
                    onChange={(e) => setSessionSearch(e.target.value)}
                  />
                </div>

                {/* Students list */}
                <div
                  className="table-wrap"
                  style={{ maxHeight: '45vh', overflowY: 'auto' }}
                >
                  <table>
                    <thead>
                      <tr>
                        <th>No</th>
                        <th>Student Number</th>
                        <th>Status</th>
                        <th>Time Marked</th>
                        <th>Mark / Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSessionRecords.map((st, idx) => {
                        const studentUid = st.student_uid
                        const isPending = pendingChanges[studentUid] !== undefined
                        const effectiveCategory = isPending
                          ? pendingChanges[studentUid]
                          : getStudentSavedCategory(st)

                        const statusBadge =
                          effectiveCategory === 'Present' || effectiveCategory === 'Late'
                            ? 'success'
                            : effectiveCategory === 'Excused'
                            ? 'info'
                            : 'danger'

                        return (
                          <tr key={studentUid}>
                            <td>{idx + 1}</td>
                            <td>
                              <strong>{st.reg_no}</strong>
                            </td>
                            <td>
                              <span className={`status-pill ${statusBadge}`}>
                                {effectiveCategory}
                              </span>
                              {isPending && (
                                <span
                                  className="unsaved-marker"
                                  style={{
                                    marginLeft: '6px',
                                    fontSize: '0.7rem',
                                    padding: '2px 5px',
                                    borderRadius: '4px',
                                    background: '#fef3c7',
                                    color: '#b45309',
                                    fontWeight: '600',
                                    display: 'inline-block',
                                  }}
                                  title="Unsaved change"
                                >
                                  • unsaved
                                </span>
                              )}
                            </td>
                            <td>{isPending ? 'Pending save' : st.time_marked}</td>
                            <td>
                              <div
                                className="button-group"
                                style={{ gap: '6px' }}
                              >
                                <button
                                  type="button"
                                  className="ghost-button"
                                  style={{
                                    padding: '4px 8px',
                                    fontSize: '0.8rem',
                                    fontWeight:
                                      effectiveCategory === 'Present' ? '700' : '400',
                                    borderColor:
                                      effectiveCategory === 'Present'
                                        ? (isPending ? '#d97706' : '#16a34a')
                                        : undefined,
                                    backgroundColor:
                                      effectiveCategory === 'Present' ? '#f0fdf4' : undefined,
                                  }}
                                  disabled={isSavingAttendance}
                                  onClick={() =>
                                    handleStageStatusChange(studentUid, 'Present')
                                  }
                                >
                                  Present
                                </button>
                                <button
                                  type="button"
                                  className="ghost-button"
                                  style={{
                                    padding: '4px 8px',
                                    fontSize: '0.8rem',
                                    fontWeight:
                                      effectiveCategory === 'Late' ? '700' : '400',
                                    borderColor:
                                      effectiveCategory === 'Late'
                                        ? (isPending ? '#d97706' : '#16a34a')
                                        : undefined,
                                    backgroundColor:
                                      effectiveCategory === 'Late' ? '#f0fdf4' : undefined,
                                  }}
                                  disabled={isSavingAttendance}
                                  onClick={() =>
                                    handleStageStatusChange(studentUid, 'Late')
                                  }
                                >
                                  Late
                                </button>
                                <button
                                  type="button"
                                  className="ghost-button"
                                  style={{
                                    padding: '4px 8px',
                                    fontSize: '0.8rem',
                                    fontWeight:
                                      effectiveCategory === 'Excused' ? '700' : '400',
                                    borderColor:
                                      effectiveCategory === 'Excused'
                                        ? (isPending ? '#d97706' : '#2563eb')
                                        : undefined,
                                    backgroundColor:
                                      effectiveCategory === 'Excused' ? '#eff6ff' : undefined,
                                  }}
                                  disabled={isSavingAttendance}
                                  onClick={() =>
                                    handleStageStatusChange(studentUid, 'Excused')
                                  }
                                >
                                  Excused
                                </button>
                                <button
                                  type="button"
                                  className="ghost-button danger"
                                  style={{
                                    padding: '4px 8px',
                                    fontSize: '0.8rem',
                                    fontWeight:
                                      effectiveCategory === 'Absent' ? '700' : '400',
                                    borderColor:
                                      effectiveCategory === 'Absent'
                                        ? (isPending ? '#d97706' : '#dc2626')
                                        : undefined,
                                    backgroundColor:
                                      effectiveCategory === 'Absent' ? '#fef2f2' : undefined,
                                  }}
                                  disabled={isSavingAttendance}
                                  onClick={() =>
                                    handleStageStatusChange(studentUid, 'Absent')
                                  }
                                >
                                  Absent
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                      {filteredSessionRecords.length === 0 && (
                        <tr>
                          <td colSpan="5" className="empty-cell">
                            No students match your filter.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default ModuleDetailsPage