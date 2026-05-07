import { useEffect, useMemo, useState } from 'react'
import {
  getAttendancePerformancePerModule,
  getActiveSessionsCount,
  getEnrollmentEnabledModulesCount,
  getStudentCountPerModule,
  getTotalLecturersCount,
  getTotalModulesCount,
} from '../services/dashboardService'

const ENROLLMENT_COLORS = [
  '#4F46E5',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#06B6D4',
  '#8B5CF6',
  '#EC4899',
  '#22C55E',
]

const getColorForModule = (moduleId) => {
  let hash = 0
  for (let index = 0; index < moduleId.length; index += 1) {
    hash = (hash * 31 + moduleId.charCodeAt(index)) % 1000
  }

  return ENROLLMENT_COLORS[hash % ENROLLMENT_COLORS.length]
}

const EnrollmentFixedBars = ({ rows }) => {
  const maxCount = Math.max(...rows.map((row) => row.count), 0)

  return (
    <div style={{ display: 'grid', gap: '14px' }}>
      {rows.map((row) => {
        const fillPercent = maxCount === 0 ? 0 : (row.count / maxCount) * 100
        const color = getColorForModule(row.moduleId)

        return (
          <div
            key={row.moduleId}
            style={{
              display: 'grid',
              gridTemplateColumns: '120px minmax(140px, 1fr) auto',
              gap: '14px',
              alignItems: 'center',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontWeight: 700 }}>{row.moduleId}</p>
              {row.moduleName ? (
                <p
                  style={{
                    margin: '4px 0 0',
                    fontSize: '0.8rem',
                    color: '#64748b',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={row.moduleName}
                >
                  {row.moduleName}
                </p>
              ) : null}
            </div>
            <div
              style={{
                width: '220px',
                height: '14px',
                borderRadius: '999px',
                background: '#e5e7eb',
                overflow: 'hidden',
              }}
              aria-hidden="true"
            >
              <div
                style={{
                  height: '100%',
                  width: `${fillPercent}%`,
                  borderRadius: '999px',
                  background: color,
                }}
              />
            </div>
            <div style={{ textAlign: 'right', minWidth: '90px' }}>
              <span style={{ fontWeight: 700 }}>{row.count}</span>
              <span style={{ marginLeft: '6px', color: '#64748b' }}>
                {`${Math.round(fillPercent)}%`}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function DashboardPage() {
  const [overview, setOverview] = useState({
    totalModules: 0,
    totalLecturers: 0,
    activeSessions: 0,
    enrollmentEnabled: 0,
  })
  const [isOverviewLoading, setIsOverviewLoading] = useState(true)
  const [rows, setRows] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [attendanceRows, setAttendanceRows] = useState([])
  const [isAttendanceLoading, setIsAttendanceLoading] = useState(true)
  const [attendanceError, setAttendanceError] = useState('')

  useEffect(() => {
    let isMounted = true

    const loadOverview = async () => {
      try {
        setIsOverviewLoading(true)
        const [modules, lecturers, sessions, enabledModules] =
          await Promise.all([
            getTotalModulesCount(),
            getTotalLecturersCount(),
            getActiveSessionsCount(),
            getEnrollmentEnabledModulesCount(),
          ])

        if (!isMounted) {
          return
        }

        setOverview({
          totalModules: modules,
          totalLecturers: lecturers,
          activeSessions: sessions,
          enrollmentEnabled: enabledModules,
        })
      } catch (err) {
        if (!isMounted) {
          return
        }
        console.log('Unable to load system overview.', err)
        setOverview({
          totalModules: 0,
          totalLecturers: 0,
          activeSessions: 0,
          enrollmentEnabled: 0,
        })
      } finally {
        if (isMounted) {
          setIsOverviewLoading(false)
        }
      }
    }

    const loadEnrollment = async () => {
      try {
        setIsLoading(true)
        const data = await getStudentCountPerModule()
        if (!isMounted) {
          return
        }
        setRows(data)
        setError('')
      } catch (err) {
        if (!isMounted) {
          return
        }
        setRows([])
        setError(err?.message || 'Unable to load enrollment data.')
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    const loadAttendance = async () => {
      try {
        setIsAttendanceLoading(true)
        const data = await getAttendancePerformancePerModule()
        if (!isMounted) {
          return
        }
        setAttendanceRows(data)
        setAttendanceError('')
      } catch (err) {
        if (!isMounted) {
          return
        }
        setAttendanceRows([])
        setAttendanceError(err?.message || 'Unable to load attendance data.')
      } finally {
        if (isMounted) {
          setIsAttendanceLoading(false)
        }
      }
    }

    loadOverview()
    loadEnrollment()
    loadAttendance()

    return () => {
      isMounted = false
    }
  }, [])

  const hasRows = rows.length > 0
  const hasAttendanceRows = attendanceRows.length > 0

  const getAttendanceColor = (value) => {
    if (value >= 80) {
      return '#22c55e'
    }
    if (value >= 50) {
      return '#f59e0b'
    }
    return '#ef4444'
  }

  return (
    <div className="dashboard-grid">
      <section className="card">
        <div className="card-header row">
          <div>
            <h4>System Overview</h4>
            <span className="helper-text">Snapshot of core admin metrics.</span>
          </div>
        </div>
        <div className="summary-grid">
          <div className="summary-card">
            <p>📚 Total Modules</p>
            <h3>{isOverviewLoading ? 'Loading...' : overview.totalModules}</h3>
          </div>
          <div className="summary-card">
            <p>👨‍🏫 Total Lecturers</p>
            <h3>
              {isOverviewLoading ? 'Loading...' : overview.totalLecturers}
            </h3>
          </div>
          <div className="summary-card">
            <p>🟢 Active Sessions</p>
            <h3>{isOverviewLoading ? 'Loading...' : overview.activeSessions}</h3>
          </div>
          <div className="summary-card">
            <p>🔐 Enrollment Enabled</p>
            <h3>
              {isOverviewLoading ? 'Loading...' : overview.enrollmentEnabled}
            </h3>
          </div>
        </div>
      </section>
      <section className="card">
        <div className="card-header row">
          <div>
            <h4>Student Enrollment per Module</h4>
            <span className="helper-text">
              Total number of students enrolled in each module.
            </span>
          </div>
        </div>

        {isLoading && (
          <p className="helper-text">Loading enrollment insights...</p>
        )}

        {!isLoading && error && (
          <span className="status-pill danger">{error}</span>
        )}

        {!isLoading && !error && !hasRows && (
          <p className="empty-cell">No module enrollments to display yet.</p>
        )}

        {!isLoading && !error && hasRows && (
          <EnrollmentFixedBars rows={rows} />
        )}
      </section>

      <section className="card">
        <div className="card-header row">
          <div>
            <h4>Attendance Performance per Module</h4>
            <span className="helper-text">
              Average attendance percentage per module.
            </span>
          </div>
        </div>

        {isAttendanceLoading && (
          <p className="helper-text">Loading attendance performance...</p>
        )}

        {!isAttendanceLoading && attendanceError && (
          <span className="status-pill danger">{attendanceError}</span>
        )}

        {!isAttendanceLoading && !attendanceError && !hasAttendanceRows && (
          <p className="empty-cell">No attendance data available yet.</p>
        )}

        {!isAttendanceLoading && !attendanceError && hasAttendanceRows && (
          <div style={{ display: 'grid', gap: '14px' }}>
            {attendanceRows.map((row) => (
              <div
                key={`${row.moduleId}-attendance`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '120px minmax(160px, 1fr) auto',
                  gap: '14px',
                  alignItems: 'center',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 700 }}>{row.moduleId}</p>
                  {row.moduleName ? (
                    <p
                      style={{
                        margin: '4px 0 0',
                        fontSize: '0.8rem',
                        color: '#64748b',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={row.moduleName}
                    >
                      {row.moduleName}
                    </p>
                  ) : null}
                </div>
                <div
                  style={{
                    width: '220px',
                    height: '14px',
                    borderRadius: '999px',
                    background: '#e5e7eb',
                    overflow: 'hidden',
                  }}
                  aria-hidden="true"
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${row.percentage}%`,
                      borderRadius: '999px',
                      background: getAttendanceColor(row.percentage),
                    }}
                  />
                </div>
                <div style={{ textAlign: 'right', minWidth: '70px' }}>
                  <span style={{ fontWeight: 700 }}>{row.percentage}%</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

export default DashboardPage
