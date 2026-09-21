import { useEffect, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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

const getAttendanceColor = (value) => {
  if (value >= 80) return '#16a34a'
  if (value >= 50) return '#d97706'
  return '#dc2626'
}

function ChartTooltip({ active, payload, label, valueLabel }) {
  if (!active || !payload || !payload.length) {
    return null
  }

  const row = payload[0].payload

  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip-title">{label}</p>
      {row.moduleName && <p className="chart-tooltip-sub">{row.moduleName}</p>}
      <p className="chart-tooltip-value">
        {valueLabel}: <strong>{row.percentage}%</strong>
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
              Share of your total students enrolled in each module.
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
          <p className="empty-cell">No module enrollments to display yet.</p>
        )}

        {!isEnrollmentLoading && !enrollmentError && hasEnrollmentRows && (
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={enrollmentRows}
                margin={{ top: 8, right: 8, left: -12, bottom: 8 }}
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
                />
                <YAxis
                  domain={[0, 100]}
                  tickFormatter={(value) => `${value}%`}
                  tick={{ fontSize: 12, fill: '#475569' }}
                  axisLine={false}
                  tickLine={false}
                  width={44}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(79, 70, 229, 0.06)' }}
                  content={<ChartTooltip valueLabel="Enrolled" />}
                />
                <Bar
                  dataKey="percentage"
                  fill={ENROLLMENT_COLOR}
                  radius={[6, 6, 0, 0]}
                  maxBarSize={48}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="card chart-card">
        <div className="card-header row">
          <div>
            <span className="eyebrow">Attendance</span>
            <h4>Attendance Performance per Module</h4>
            <span className="helper-text">
              Average attendance percentage per module you teach.
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
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={attendanceRows}
                margin={{ top: 8, right: 8, left: -12, bottom: 8 }}
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
                />
                <YAxis
                  domain={[0, 100]}
                  tickFormatter={(value) => `${value}%`}
                  tick={{ fontSize: 12, fill: '#475569' }}
                  axisLine={false}
                  tickLine={false}
                  width={44}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(15, 23, 42, 0.04)' }}
                  content={<ChartTooltip valueLabel="Attendance" />}
                />
                <Bar dataKey="percentage" radius={[6, 6, 0, 0]} maxBarSize={48}>
                  {attendanceRows.map((row) => (
                    <Cell
                      key={row.moduleId}
                      fill={getAttendanceColor(row.percentage)}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="chart-legend">
              <span>
                <i style={{ background: '#16a34a' }} /> 75%+
              </span>
              <span>
                <i style={{ background: '#d97706' }} /> 60–75%
              </span>
              <span>
                <i style={{ background: '#dc2626' }} /> Below 50%
              </span>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

export default DashboardPage