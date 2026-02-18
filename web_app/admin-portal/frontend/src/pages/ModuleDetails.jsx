import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useModules } from '../context/ModulesContext.jsx'

function ModuleDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { modules, sessions, enrollments, deleteSession } = useModules()

  const module = useMemo(
    () => modules.find((item) => item.id === id),
    [modules, id]
  )

  const moduleSessions = useMemo(() => {
    return sessions
      .filter((session) => session.module_id === id)
      .sort(
        (a, b) =>
          new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      )
  }, [sessions, id])

  const studentsCount = useMemo(() => {
    const enrollment = enrollments.find((item) => item.module_id === id)
    return enrollment ? enrollment.student_ids.length : 0
  }, [enrollments, id])

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

  const handleDeleteSession = (sessionId) => {
    const confirmed = window.confirm('Delete this session?')
    if (confirmed) {
      deleteSession(sessionId)
    }
  }

  const formatDate = (value) => new Date(value).toLocaleString()

  return (
    <div className="dashboard-grid">
      <section className="card module-detail">
        <div className="module-detail-header">
          <div>
            <p className="module-code">{module.module_code}</p>
            <h4>{module.module_name}</h4>
          </div>
          <Link className="primary-button" to={`/modules/${module.id}/edit`}>
            Edit Module
          </Link>
        </div>
        <div className="module-meta-grid">
          <div>
            <p className="meta-label">Department</p>
            <p className="meta-value">{module.department}</p>
          </div>
          <div>
            <p className="meta-label">Level</p>
            <p className="meta-value">{module.level}</p>
          </div>
          <div>
            <p className="meta-label">Semester</p>
            <p className="meta-value">{module.semester}</p>
          </div>
          <div>
            <p className="meta-label">Created</p>
            <p className="meta-value">{formatDate(module.created_at)}</p>
          </div>
        </div>
      </section>

      <section className="summary-grid">
        <div className="summary-card">
          <p>Students Enrolled</p>
          <h3>{studentsCount}</h3>
        </div>
        <div className="summary-card">
          <p>Total Sessions</p>
          <h3>{moduleSessions.length}</h3>
        </div>
      </section>

      <section className="card">
        <div className="card-header row">
          <div>
            <h4>Sessions</h4>
            <span className="helper-text">All sessions for this module.</span>
          </div>
          <Link
            className="primary-button"
            to={`/modules/${module.id}/sessions/new`}
          >
            Add Session
          </Link>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Start</th>
                <th>End</th>
                <th>Location</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {moduleSessions.map((session) => (
                <tr key={session.id}>
                  <td>{session.session_title}</td>
                  <td>{formatDate(session.start_time)}</td>
                  <td>{formatDate(session.end_time)}</td>
                  <td>{session.location}</td>
                  <td>
                    <span
                      className={`status-pill ${
                        session.status === 'active'
                          ? 'success'
                          : session.status === 'ended'
                          ? 'warning'
                          : 'info'
                      }`}
                    >
                      {session.status}
                    </span>
                  </td>
                  <td>
                    <div className="action-group">
                      <Link
                        className="text-link"
                        to={`/modules/${module.id}/sessions/${session.id}/edit`}
                      >
                        Edit
                      </Link>
                      <button
                        className="text-link danger"
                        type="button"
                        onClick={() => handleDeleteSession(session.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {moduleSessions.length === 0 && (
                <tr>
                  <td colSpan="6" className="empty-cell">
                    No sessions created for this module.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

export default ModuleDetails
