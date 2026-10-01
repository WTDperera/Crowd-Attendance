import { useEffect, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  getAttendancePerformancePerModule,
  getActiveSessionsCount,
  getEnrollmentEnabledModulesCount,
  getStudentCountPerModule,
  getTotalStudentsCount,
  getTotalModulesCount,
} from '../services/dashboardService'
import { useAuth } from '../context/AuthContext.jsx'

const STAT_CARDS = [
  { key: 'totalModules', label: 'All Modules', icon: '📚', accent: '#4f46e5' },
  { key: 'totalStudents', label: 'All Students', icon: '🎓', accent: '#0d9488' },
  { key: 'activeSessions', label: 'Active Sessions', icon: '🟢', accent: '#16a34a' },
  {
    key: 'enrollmentEnabled',
    label: 'Enrollment Enabled',
    icon: '🔐',
    accent: '#d97706',
  },
]

const ENROLLMENT_COLOR = '#4f46e5'

const getAttendanceColor = (value, completedSessions) => {
  if (completedSessions === 0) return 'transparent'
  if (value >= 80) return '#16a34a'
  if (value >= 60) return '#d97706'
  return '#dc2626'
}

function AttendanceTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) {
    return null
  }

  const row = payload[0].payload
  const code = row.code || row.moduleId || ''
  const name = row.name || row.moduleName || ''
  const title = name ? `${code} - ${name}` : code

  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip-title">{title}</p>
      {row.completedSessions === 0 ? (
        <p className="chart-tooltip-value" style={{ marginTop: 4, color: '#94a3b8' }}>
          No sessions yet
        </p>
      ) : (
        <>
          <p className="chart-tooltip-value">
            Attendance: <strong>{Math.round(row.percentage)}%</strong>
          </p>
          <p className="chart-tooltip-value">
            Present marks: <strong>{row.presentMarks}</strong>
          </p>
          <p className="chart-tooltip-value">
            Absent marks: <strong>{row.absentMarks}</strong>
          </p>
          <p className="chart-tooltip-value">
            Sessions: <strong>{row.completedSessions}</strong>
          </p>
          <p className="chart-tooltip-value">
            Enrolled: <strong>{row.enrolledCount}</strong>
          </p>
        </>
      )}
    </div>
  )
}

function EnrollmentTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) {
    return null
  }

  const row = payload[0].payload
  const name = row.moduleName || row.name || row.moduleId || 'Module'
  const count = row.count ?? 0
  const total = row.totalStudents ?? 0
  const pct = row.percentage ?? 0

  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip-title">{name}</p>
      <p className="chart-tooltip-value">
        {count} of {total} students ({pct}%)
      </p>
    </div>
  )
}

function DashboardPage() {
  const { user } = useAuth()
  const lecturerId = user?.uid || ''

  const [overview, setOverview] = useState({
    totalModules: 0,
    totalStudents: 0,
    activeSessions: 0,
    enrollmentEnabled: 0,
  })
  const [isOverviewLoading, setIsOverviewLoading] = useState(true)

  const [enrollmentRows, setEnrollmentRows] = useState([])
  const [isEnrollmentLoading, setIsEnrollmentLoading] = useState(true)
  const [enrollmentError, setEnrollmentError] = useState('')

  const [attendanceRows, setAttendanceRows] = useState([])
  const [isAttendanceLoading, setIsAttendanceLoading] = useState(true)
  const [attendanceError, setAttendanceError] = useState('')

  useEffect(() => {
    let isMounted = true

    const loadOverview = async () => {
      try {
        setIsOverviewLoading(true)
        const [modules, students, sessions, enabledModules] =
          await Promise.all([
            getTotalModulesCount(lecturerId),
            getTotalStudentsCount(lecturerId),
            getActiveSessionsCount(lecturerId),
            getEnrollmentEnabledModulesCount(lecturerId),
          ])

        if (!isMounted) {
          return
        }

        setOverview({
          totalModules: modules,
          totalStudents: students,
          activeSessions: sessions,
          enrollmentEnabled: enabledModules,
        })
      } catch (err) {
        if (!isMounted) {
          return
        }
        console.log('Unable to load overview.', err)
        setOverview({
          totalModules: 0,
          totalStudents: 0,
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
        setIsEnrollmentLoading(true)
        const data = await getStudentCountPerModule(lecturerId)
        if (!isMounted) {
          return
        }
        setEnrollmentRows(data)
        setEnrollmentError('')
      } catch (err) {
        if (!isMounted) {
          return
        }
        setEnrollmentRows([])
        setEnrollmentError(err?.message || 'Unable to load enrollment data.')
      } finally {
        if (isMounted) {
          setIsEnrollmentLoading(false)
        }
      }
    }

    const loadAttendance = async () => {
      try {
        setIsAttendanceLoading(true)
        const data = await getAttendancePerformancePerModule(lecturerId)
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
  }, [lecturerId])

  const hasEnrollmentRows = enrollmentRows.length > 0
  const hasAttendanceRows = attendanceRows.length > 0

  const renderEnrollmentLabel = (props) => {
    const { x, y, width, value } = props
    if (value === undefined || value === null) return null
    return (
      <text
        x={x + width / 2}
        y={y - 8}
        fill="#475569"
        textAnchor="middle"
        fontSize={12}
        fontWeight={600}
      >
        {`${value} student${value === 1 ? '' : 's'}`}
      </text>
    )
  }

  const renderAttendanceLabel = (props) => {
    const { x, y, width, index } = props
    const row = attendanceRows[index]
    if (!row) return null
    const isNoSessions = row.completedSessions === 0
    const text = isNoSessions ? 'No sessions yet' : `${Math.round(row.percentage)}%`
    return (
      <text
        x={x + width / 2}
        y={y - 8}
        fill={isNoSessions ? '#64748b' : '#334155'}
        textAnchor="middle"
        fontSize={isNoSessions ? 11 : 12}
        fontWeight={600}
      >
        {text}
      </text>
    )
  }

  return (
    <div className="dashboard-grid">
      <section className="card">
        <div className="card-header row">
          <div>
            <span className="eyebrow">Overview</span>
            <h4>Overview</h4>
            <span className="helper-text">
              Snapshot of your modules and sessions.
            </span>
          </div>
        </div>

        <div className="summary-grid">
          {STAT_CARDS.map((stat) => (
            <div className="stat-card" key={stat.key}>
              <div
                className="stat-icon"
                style={{ background: `${stat.accent}1a`, color: stat.accent }}
              >
                <span aria-hidden="true">{stat.icon}</span>
              </div>
              <div>
                <p className="stat-label">{stat.label}</p>
                <h3 className="stat-value">
                  {isOverviewLoading ? '—' : overview[stat.key]}
                </h3>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card chart-card">
        <div className="card-header row">
          <div>
            <span className="eyebrow">Enrollment</span>
            <h4>Student Enrollment per Module</h4>
            <span className="helper-text">
              Students enrolled in each module
            </span>
          </div>
        </div>

        {isEnrollmentLoading && (
          <p className="helper-text">Loading enrollment insights...</p>
        )}

        {!isEnrollmentLoading && enrollmentError && (
          <span className="status-pill danger">{enrollmentError}</span>
        )}

        {!isEnrollmentLoading && !enrollmentError && !hasEnrollmentRows && (
          <p className="empty-cell">No modules found for your account.</p>
        )}

        {!isEnrollmentLoading && !enrollmentError && hasEnrollmentRows && (
          <div
            className="chart-wrap"
            style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}
          >
            <div
              style={{
                minWidth:
                  enrollmentRows.length > 6
                    ? `${enrollmentRows.length * 80}px`
                    : '100%',
              }}
            >
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={enrollmentRows}
                  margin={{ top: 24, right: 16, left: 0, bottom: 8 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#e2e8f0"
                  />
                  <XAxis
                    dataKey="moduleId"
                    tick={{ fontSize: 12, fill: '#475569' }}
                    axisLine={{ stroke: '#e2e8f0' }}
                    tickLine={false}
                    interval={0}
                    angle={enrollmentRows.length > 5 ? -25 : 0}
                    textAnchor={enrollmentRows.length > 5 ? 'end' : 'middle'}
                    height={enrollmentRows.length > 5 ? 45 : 30}
                  />
                  <YAxis
                    allowDecimals={false}
                    domain={[0, (dataMax) => Math.max(dataMax + 2, 5)]}
                    tick={{ fontSize: 12, fill: '#475569' }}
                    axisLine={false}
                    tickLine={false}
                    width={48}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(79, 70, 229, 0.06)' }}
                    content={<EnrollmentTooltip />}
                  />
                  <Bar
                    dataKey="count"
                    fill={ENROLLMENT_COLOR}
                    radius={[6, 6, 0, 0]}
                    maxBarSize={56}
                  >
                    <LabelList dataKey="count" content={renderEnrollmentLabel} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </section>

      <section className="card chart-card">
        <div className="card-header row">
          <div>
            <span className="eyebrow">Attendance</span>
            <h4>Attendance Performance per Module</h4>
            <span className="helper-text">
              Attendance across completed sessions (present, late and excused count as present)
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
          <p className="empty-cell">No modules found for your account.</p>
        )}

        {!isAttendanceLoading && !attendanceError && hasAttendanceRows && (
          <div
            className="chart-wrap"
            style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}
          >
            <div
              style={{
                minWidth:
                  attendanceRows.length > 6
                    ? `${attendanceRows.length * 80}px`
                    : '100%',
              }}
            >
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={attendanceRows}
                  margin={{ top: 24, right: 16, left: 0, bottom: 8 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#e2e8f0"
                  />
                  <XAxis
                    dataKey="moduleId"
                    tick={{ fontSize: 12, fill: '#475569' }}
                    axisLine={{ stroke: '#e2e8f0' }}
                    tickLine={false}
                    interval={0}
                    angle={attendanceRows.length > 5 ? -25 : 0}
                    textAnchor={attendanceRows.length > 5 ? 'end' : 'middle'}
                    height={attendanceRows.length > 5 ? 45 : 30}
                  />
                  <YAxis
                    domain={[0, 100]}
                    ticks={[0, 20, 40, 60, 80, 100]}
                    tickFormatter={(value) => `${value}%`}
                    tick={{ fontSize: 12, fill: '#475569' }}
                    axisLine={false}
                    tickLine={false}
                    width={48}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(15, 23, 42, 0.04)' }}
                    content={<AttendanceTooltip />}
                  />
                  <ReferenceLine
                    y={80}
                    stroke="#16a34a"
                    strokeDasharray="4 4"
                  />
                  <Bar dataKey="percentage" radius={[6, 6, 0, 0]} maxBarSize={56}>
                    <LabelList
                      dataKey="percentage"
                      content={renderAttendanceLabel}
                    />
                    {attendanceRows.map((row) => (
                      <Cell
                        key={row.moduleId}
                        fill={getAttendanceColor(row.percentage, row.completedSessions)}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="chart-legend">
              <span>
                <i style={{ background: '#16a34a' }} /> 80%+
              </span>
              <span>
                <i style={{ background: '#d97706' }} /> 60–79%
              </span>
              <span>
                <i style={{ background: '#dc2626' }} /> Below 60%
              </span>
              <span>
                <i
                  style={{
                    width: 14,
                    height: 0,
                    borderTop: '2px dashed #16a34a',
                    borderRadius: 0,
                  }}
                />
                80% required
              </span>
            </div>
          </div>
        )}
      </section> 
    </div>
  )
}

export default DashboardPage
