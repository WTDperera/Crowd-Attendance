import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useModules } from '../context/ModulesContext.jsx'

function ModulesDashboard() {
  const navigate = useNavigate()
  const { deleteModule, getModulesWithStats } = useModules()
  const [search, setSearch] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('All')

  const modules = useMemo(() => getModulesWithStats(), [getModulesWithStats])

  const departments = useMemo(() => {
    const unique = Array.from(new Set(modules.map((item) => item.department)))
    return ['All', ...unique]
  }, [modules])

  const filteredModules = useMemo(() => {
    const query = search.trim().toLowerCase()

    return modules.filter((module) => {
      const matchesSearch =
        !query ||
        module.module_code.toLowerCase().includes(query) ||
        module.module_name.toLowerCase().includes(query)

      const matchesDepartment =
        departmentFilter === 'All' || module.department === departmentFilter

      return matchesSearch && matchesDepartment
    })
  }, [modules, search, departmentFilter])

  const formatDate = (value) => {
    if (!value) {
      return 'No sessions yet'
    }
    return new Date(value).toLocaleString()
  }

  const handleDelete = (id) => {
    const confirmed = window.confirm(
      'Delete this module and its sessions? This cannot be undone.'
    )
    if (confirmed) {
      deleteModule(id)
    }
  }

  return (
    <div className="dashboard-grid">
      <section className="card">
        <div className="card-header row">
          <div>
            <h4>Modules</h4>
            <span className="helper-text">
              Manage modules, sessions, and enrollments.
            </span>
          </div>
          <Link className="primary-button" to="/modules/new">
            Add Module
          </Link>
        </div>

        <div className="filters">
          <input
            type="search"
            placeholder="Search by module code or name"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            value={departmentFilter}
            onChange={(event) => setDepartmentFilter(event.target.value)}
          >
            {departments.map((department) => (
              <option key={department} value={department}>
                {department === 'All' ? 'All Departments' : department}
              </option>
            ))}
          </select>
        </div>

        <div className="module-grid">
          {filteredModules.map((module) => (
            <article key={module.id} className="module-card">
              <div className="module-header">
                <div>
                  <p className="module-code">{module.module_code}</p>
                  <h5>{module.module_name}</h5>
                </div>
                <span className="status-pill info">Level {module.level}</span>
              </div>

              <div className="module-meta">
                <p>
                  <span>Students</span>
                  <strong>{module.studentsCount}</strong>
                </p>
                <p>
                  <span>Sessions</span>
                  <strong>{module.sessionsCount}</strong>
                </p>
              </div>

              <p className="module-session">
                <span>Last session</span>
                <strong>
                  {module.lastSession
                    ? formatDate(module.lastSession.start_time)
                    : 'No sessions yet'}
                </strong>
              </p>

              <div className="card-actions">
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => navigate(`/modules/${module.id}`)}
                >
                  View
                </button>
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => navigate(`/modules/${module.id}/sessions/new`)}
                >
                  Add Session
                </button>
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => navigate(`/modules/${module.id}/edit`)}
                >
                  Edit
                </button>
                <button
                  className="ghost-button danger"
                  type="button"
                  onClick={() => handleDelete(module.id)}
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
          {filteredModules.length === 0 && (
            <div className="empty-state">
              <p>No modules match your search.</p>
              <Link className="text-link" to="/modules/new">
                Create a new module
              </Link>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

export default ModulesDashboard
