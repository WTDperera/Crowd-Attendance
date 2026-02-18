import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStudents } from '../context/StudentsContext.jsx'

const STATUS_OPTIONS = ['All', 'Active', 'Locked', 'Device Not Set']
const LOGIN_OPTIONS = ['All', 'Logged In', 'Never Logged In']
const PAGE_SIZE = 10

function StudentsList() {
  const { students, removeStudent } = useStudents()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [loginFilter, setLoginFilter] = useState('All')
  const [page, setPage] = useState(1)

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLowerCase()

    return students.filter((student) => {
      const matchesSearch =
        !query ||
        student.reg_no.toLowerCase().includes(query) ||
        student.email.toLowerCase().includes(query)

      const status = student.device_locked_at
        ? 'Locked'
        : student.device_id
        ? 'Active'
        : 'Device Not Set'

      const matchesStatus = statusFilter === 'All' || status === statusFilter

      const hasLogin = Boolean(student.last_login)
      const matchesLogin =
        loginFilter === 'All' ||
        (loginFilter === 'Logged In' && hasLogin) ||
        (loginFilter === 'Never Logged In' && !hasLogin)

      return matchesSearch && matchesStatus && matchesLogin
    })
  }, [students, search, statusFilter, loginFilter])

  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / PAGE_SIZE))
  const pagedStudents = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filteredStudents.slice(start, start + PAGE_SIZE)
  }, [filteredStudents, page])

  const handleDelete = (id) => {
    removeStudent(id)
  }

  const formatDate = (value) => {
    if (!value) {
      return '—'
    }
    return new Date(value).toLocaleString()
  }

  const resolveStatus = (student) => {
    if (student.device_locked_at) {
      return 'Locked'
    }
    if (!student.device_id) {
      return 'Device Not Set'
    }
    return 'Active'
  }

  return (
    <div className="card">
      <div className="card-header row">
        <div>
          <h4>Students</h4>
          <span className="helper-text">Manage registered devices and logins.</span>
        </div>
        <Link className="primary-button" to="/students/new">
          Add Student
        </Link>
      </div>

      <div className="filters">
        <input
          type="search"
          placeholder="Search by reg no or email"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            setPage(1)
          }}
        />
        <select
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value)
            setPage(1)
          }}
        >
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        <select
          value={loginFilter}
          onChange={(event) => {
            setLoginFilter(event.target.value)
            setPage(1)
          }}
        >
          {LOGIN_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Reg No</th>
              <th>Email</th>
              <th>Device ID</th>
              <th>Last Login</th>
              <th>Device Locked At</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pagedStudents.map((student) => {
              const status = resolveStatus(student)

              return (
                <tr key={student.id}>
                  <td>{student.reg_no}</td>
                  <td>{student.email}</td>
                  <td>{student.device_id || '—'}</td>
                  <td>{formatDate(student.last_login)}</td>
                  <td>{formatDate(student.device_locked_at)}</td>
                  <td>
                    <span
                      className={`status-pill ${
                        status === 'Locked'
                          ? 'danger'
                          : status === 'Device Not Set'
                          ? 'warning'
                          : 'success'
                      }`}
                    >
                      {status}
                    </span>
                  </td>
                  <td>
                    <div className="action-group">
                      <Link
                        className="text-link"
                        to={`/students/${student.id}/edit`}
                      >
                        Edit
                      </Link>
                      <button
                        className="text-link danger"
                        type="button"
                        onClick={() => handleDelete(student.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {pagedStudents.length === 0 && (
              <tr>
                <td colSpan="7" className="empty-cell">
                  No students match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <button
          type="button"
          className="ghost-button"
          onClick={() => setPage((prev) => Math.max(1, prev - 1))}
          disabled={page === 1}
        >
          Previous
        </button>
        <span>
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          className="ghost-button"
          onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
          disabled={page === totalPages}
        >
          Next
        </button>
      </div>
    </div>
  )
}

export default StudentsList
