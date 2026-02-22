import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  getModuleAttendanceSummary,
  getStudentAttendanceDetails,
} from '../services/moduleAttendanceService'

function ModuleDetailsPage() {
  const { id: moduleId } = useParams()
  const navigate = useNavigate()
  const [moduleData, setModuleData] = useState(null)
  const [activeSession, setActiveSession] = useState(null)
  const [students, setStudents] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [search, setSearch] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [detailStudent, setDetailStudent] = useState(null)
  const [detailRecords, setDetailRecords] = useState([])
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [detailsError, setDetailsError] = useState('')

  useEffect(() => {
    let isMounted = true

    const fetchSummary = async () => {
      setIsLoading(true)
      setErrorMessage('')

      try {
        const response = await getModuleAttendanceSummary(
          moduleId,
          fromDate || undefined,
          toDate || undefined
        )

        if (isMounted) {
          setModuleData(response.module)
          setActiveSession(response.activeSession)
          setStudents(response.students || [])
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(error.message)
          setModuleData(null)
          setActiveSession(null)
          setStudents([])
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    fetchSummary()

    return () => {
      isMounted = false
    }
  }, [moduleId, fromDate, toDate])

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLowerCase()

    if (!query) {
      return students
    }

    return students.filter((student) => {
      return (
        (student.reg_no || '').toLowerCase().includes(query) ||
        (student.email || '').toLowerCase().includes(query)
      )
    })
  }, [students, search])

  const openDetails = async (student) => {
    setDetailStudent(student)
    setDetailsError('')
    setDetailsLoading(true)

    try {
      const records = await getStudentAttendanceDetails(moduleId, student.uid)
      setDetailRecords(records)
    } catch (error) {
      setDetailsError(error.message)
      setDetailRecords([])
    } finally {
      setDetailsLoading(false)
    }
  }

  const closeDetails = () => {
    setDetailStudent(null)
    setDetailRecords([])
    setDetailsError('')
    setDetailsLoading(false)
  }

  const resolveStatus = (student) => {
    if (student.total === 0) {
      return { label: 'No Records', tone: 'warning' }
    }

    if (student.percentage < 80) {
      return { label: 'Below 80%', tone: 'danger' }
    }

    return { label: 'On Track', tone: 'success' }
  }

  const formatDate = (value) => {
    if (!value) {
      return '—'
    }

    return new Date(value).toLocaleString()
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
        <p className="helper-text">
          Return to modules list to continue.
        </p>
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
            <p className="module-code">{moduleData.module_code}</p>
            <h4>{moduleData.module_name}</h4>
          </div>
        </div>
        <div className="module-meta-grid">
          <div>
            <p className="meta-label">Department</p>
            <p className="meta-value">{moduleData.department || '—'}</p>
          </div>
          <div>
            <p className="meta-label">Level</p>
            <p className="meta-value">{moduleData.level || '—'}</p>
          </div>
          <div>
            <p className="meta-label">Semester</p>
            <p className="meta-value">{moduleData.semester || '—'}</p>
          </div>
        </div>
      </section>

      {activeSession && (
        <section className="card">
          <div className="card-header row">
            <div>
              <h4>Active Session</h4>
              <span className="helper-text">Live attendance is running.</span>
            </div>
            <span className="status-pill info">Active</span>
          </div>
          <div className="module-meta-grid">
            <div>
              <p className="meta-label">Topic</p>
              <p className="meta-value">{activeSession.topic || '—'}</p>
            </div>
            <div>
              <p className="meta-label">Started</p>
              <p className="meta-value">{formatDate(activeSession.started_at)}</p>
            </div>
            <div>
              <p className="meta-label">Students Present</p>
              <p className="meta-value">{activeSession.student_count}</p>
            </div>
          </div>
        </section>
      )}

      <section className="card">
        <div className="card-header row">
          <div>
            <h4>Students & Attendance</h4>
            <span className="helper-text">
              Attendance totals for enrolled students.
            </span>
          </div>
        </div>

        {errorMessage && <span className="field-error">{errorMessage}</span>}

        <div className="filters">
          <input
            type="search"
            placeholder="Search by reg no or email"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <input
            type="date"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
          />
          <input
            type="date"
            value={toDate}
            onChange={(event) => setToDate(event.target.value)}
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
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((student) => {
                const status = resolveStatus(student)
                return (
                  <tr key={student.uid}>
                    <td>{student.reg_no}</td>
                    <td>{student.email}</td>
                    <td>{student.presentCount}</td>
                    <td>{student.absentCount}</td>
                    <td>{student.total}</td>
                    <td>{student.percentage}%</td>
                    <td>
                      <span className={`status-pill ${status.tone}`}>
                        {status.label}
                      </span>
                    </td>
                    <td>
                      <button
                        className="text-link"
                        type="button"
                        onClick={() => openDetails(student)}
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                )
              })}
              {filteredStudents.length === 0 && (
                <tr>
                  <td colSpan="8" className="empty-cell">
                    No students match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {detailStudent && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <p className="modal-title">Attendance Details</p>
                <p className="helper-text">
                  {detailStudent.reg_no} • {detailStudent.email}
                </p>
              </div>
              <button className="ghost-button" type="button" onClick={closeDetails}>
                Close
              </button>
            </div>

            {detailsError && <span className="field-error">{detailsError}</span>}

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Session</th>
                    <th>Status</th>
                    <th>Recorded</th>
                  </tr>
                </thead>
                <tbody>
                  {detailsLoading && (
                    <tr>
                      <td colSpan="4" className="empty-cell">
                        Loading details...
                      </td>
                    </tr>
                  )}
                  {!detailsLoading && detailRecords.map((record) => (
                    <tr key={record.id}>
                      <td>{record.date || '—'}</td>
                      <td>{record.session_id || '—'}</td>
                      <td>
                        <span
                          className={`status-pill ${
                            record.status === 'Absent' ? 'danger' : 'success'
                          }`}
                        >
                          {record.status}
                        </span>
                      </td>
                      <td>{formatDate(record.timestamp)}</td>
                    </tr>
                  ))}
                  {!detailsLoading && detailRecords.length === 0 && (
                    <tr>
                      <td colSpan="4" className="empty-cell">
                        No attendance records.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ModuleDetailsPage
