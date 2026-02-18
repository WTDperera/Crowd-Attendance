import { useMemo } from 'react'
import { useStudents } from '../context/StudentsContext.jsx'

function DashboardHome() {
  const { students } = useStudents()

  const summary = useMemo(() => {
    const total = students.length
    const activeDevices = students.filter((student) => student.device_id).length
    const lockedDevices = students.filter(
      (student) => student.device_locked_at
    ).length
    const now = Date.now()
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000
    const recentLogins = students.filter((student) => {
      if (!student.last_login) {
        return false
      }
      return now - new Date(student.last_login).getTime() <= sevenDaysMs
    }).length

    return { total, activeDevices, lockedDevices, recentLogins }
  }, [students])

  const recentLogins = useMemo(() => {
    return students
      .filter((student) => student.last_login)
      .sort(
        (a, b) =>
          new Date(b.last_login).getTime() - new Date(a.last_login).getTime()
      )
      .slice(0, 5)
  }, [students])

  const attentionList = useMemo(() => {
    return students
      .filter(
        (student) => student.device_locked_at || student.device_id === null
      )
      .slice(0, 5)
  }, [students])

  const formatDate = (value) => {
    if (!value) {
      return '—'
    }
    return new Date(value).toLocaleString()
  }

  return (
    <div className="dashboard-grid">
      <section className="summary-grid">
        <div className="summary-card">
          <p>Total Students</p>
          <h3>{summary.total}</h3>
        </div>
        <div className="summary-card">
          <p>Active Devices</p>
          <h3>{summary.activeDevices}</h3>
        </div>
        <div className="summary-card">
          <p>Locked Devices</p>
          <h3>{summary.lockedDevices}</h3>
        </div>
        <div className="summary-card">
          <p>Logged In Recently</p>
          <h3>{summary.recentLogins}</h3>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <h4>Recent Logins</h4>
          <span className="helper-text">Latest 5 logins</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Reg No</th>
                <th>Email</th>
                <th>Last Login</th>
              </tr>
            </thead>
            <tbody>
              {recentLogins.map((student) => (
                <tr key={student.id}>
                  <td>{student.reg_no}</td>
                  <td>{student.email}</td>
                  <td>{formatDate(student.last_login)}</td>
                </tr>
              ))}
              {recentLogins.length === 0 && (
                <tr>
                  <td colSpan="3" className="empty-cell">
                    No recent logins yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <h4>Attention Needed</h4>
          <span className="helper-text">Locked or missing devices</span>
        </div>
        <ul className="attention-list">
          {attentionList.map((student) => (
            <li key={student.id}>
              <div>
                <p className="attention-title">{student.reg_no}</p>
                <p className="attention-meta">{student.email}</p>
              </div>
              <span className="status-pill warning">
                {student.device_locked_at ? 'Locked' : 'Device Not Set'}
              </span>
            </li>
          ))}
          {attentionList.length === 0 && (
            <li className="empty-cell">No attention needed right now.</li>
          )}
        </ul>
      </section>
    </div>
  )
}

export default DashboardHome
