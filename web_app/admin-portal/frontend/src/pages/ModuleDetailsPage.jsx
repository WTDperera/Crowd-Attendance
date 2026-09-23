import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getModuleById } from '../services/moduleService'
import { getStudentsEnrolledInModule } from '../services/studentService'
import { downloadAttendanceExcel } from '../services/attendanceExportService'
import AttendanceExportModal from '../components/AttendanceExportModal'
import { useAuth } from '../context/AuthContext.jsx'

function ModuleDetailsPage() {
  const { moduleId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const lecturerId = user?.uid || ''
  const [moduleData, setModuleData] = useState(null)
  const [students, setStudents] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [search, setSearch] = useState('')
  const [isExportModalOpen, setIsExportModalOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [exportMessage, setExportMessage] = useState({ type: '', text: '' })
  const moduleKey = decodeURIComponent(moduleId || '').trim().toUpperCase()

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

    fetchModule().then(subscribeStudents)

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
        text: 'Attendance records downloaded successfully!',
      })
      setIsExportModalOpen(false)

      // Clear success message after 3 seconds
      setTimeout(() => {
        setExportMessage({ type: '', text: '' })
      }, 3000)
    } catch (error) {
      setExportMessage({
        type: 'error',
        text: error.message || 'Failed to download attendance records.',
      })
    } finally {
      setIsExporting(false)
    }
  }

  const totalSessions = Number(moduleData?.total_sessions || 0)
  const fallbackKey = (moduleData?.code || moduleKey || '').trim().toUpperCase()
  const firstStudent = students[0]
  const firstStudentFlatAttendance = firstStudent
    ? firstStudent[`attendance_counts.${moduleKey}`]
    : undefined
  const firstStudentFlatAbsence = firstStudent
    ? firstStudent[`absence_counts.${moduleKey}`]
    : undefined

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
      <section className="card">
        <div className="card-header row">
          <div>
            <h4>Debug</h4>
            <span className="helper-text">Temporary diagnostics for attendance.</span>
          </div>
        </div>
        <p className="helper-text">moduleKey: {moduleKey || '—'}</p>
        <p className="helper-text">
          attendance_counts keys:{' '}
          {firstStudent
            ? Object.keys(firstStudent.attendance_counts || {}).join(', ') || '—'
            : '—'}
        </p>
        <p className="helper-text">
          attendance_counts.{moduleKey}:{' '}
          {firstStudentFlatAttendance ?? '—'}
        </p>
        <p className="helper-text">
          absence_counts keys:{' '}
          {firstStudent
            ? Object.keys(firstStudent.absence_counts || {}).join(', ') || '—'
            : '—'}
        </p>
        <p className="helper-text">
          absence_counts.{moduleKey}:{' '}
          {firstStudentFlatAbsence ?? '—'}
        </p>
        <pre className="code-block">
          {firstStudent ? JSON.stringify(firstStudent, null, 2) : 'No student data'}
        </pre>
      </section>

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
              title="Download attendance records as Excel file"
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
            <p className="meta-value">{moduleData.lecturer_id || '—'}</p>
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

      <section className="card">
        <div className="card-header row">
          <div>
            <h4>Enrolled Students</h4>
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
                const primaryValue = getCount(student, 'attendance_counts', moduleKey)
                const keyToUse = primaryValue !== 0 ? moduleKey : fallbackKey
                const presentCount = getCount(student, 'attendance_counts', keyToUse)
                const absentCount = getCount(student, 'absence_counts', keyToUse)
                const total = presentCount + absentCount
                const percentage =
                  total === 0
                    ? 0
                    : Math.round((presentCount / total) * 100)
                return (
                  <tr key={student.uid || student.id}>
                    <td>{student.reg_no || '—'}</td>
                    <td>{student.email || '—'}</td>
                    <td>{presentCount}</td>
                    <td>{absentCount}</td>
                    <td>{total}</td>
                    <td>
                      <span className="status-pill info">{percentage}%</span>
                    </td>
                  </tr>
                )
              })}
              {filteredStudents.length === 0 && (
                <tr>
                  <td colSpan="6" className="empty-cell">
                    {students.length === 0
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

      <AttendanceExportModal
        isOpen={isExportModalOpen}
        moduleName={moduleData?.name}
        moduleId={moduleKey}
        onClose={() => setIsExportModalOpen(false)}
        onExport={handleExport}
        isLoading={isExporting}
      />
    </div>
  )
}

export default ModuleDetailsPage