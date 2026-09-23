import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { deleteStudent, getStudents } from '../services/studentService'

const STATUS_OPTIONS = ['All', 'Active', 'Locked', 'Device Not Set']
const LOGIN_OPTIONS = ['All', 'Logged In', 'Never Logged In']
const PAGE_SIZE = 10

function StudentsList() {
  const [students, setStudents] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [loginFilter, setLoginFilter] = useState('All')
  const [page, setPage] = useState(1)
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const location = useLocation()

  useEffect(() => {
    if (location.state?.message) {
      setMessage(location.state.message)
    }
  }, [location.state])

  useEffect(() => {
    let isMounted = true

    const fetchStudents = async () => {
      try {
        const rows = await getStudents()
        if (isMounted) {
          setStudents(rows)
          setErrorMessage('')
        }
      } catch (error) {
        if (isMounted) {
          setStudents([])
          setErrorMessage(error.message)
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    fetchStudents()

    return () => {
      isMounted = false
    }
  }, [])

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

  const handleDelete = async (id) => {
    const shouldDelete = window.confirm('Delete this student account?')
    if (!shouldDelete) {
      return
    }

    setMessage('')
    setErrorMessage('')

    try {
      await deleteStudent(id)
      setStudents((prev) => prev.filter((student) => student.id !== id))
      setMessage('Student deleted successfully.')
    } catch (error) {
      setErrorMessage(error.message)
    }
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

      {errorMessage && <span className="field-error">{errorMessage}</span>}
      {message && <span className="helper-text">{message}</span>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Reg No</th>
              <th>Email</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan="4" className="empty-cell">
                  Loading...
                </td>
              </tr>
            )}
            {!isLoading && pagedStudents.map((student) => {
              const status = resolveStatus(student)

              return (
                <tr key={student.id}>
                  <td>{student.reg_no}</td>
                  <td>{student.email}</td>
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
                        state={{ student }}
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
            {!isLoading && pagedStudents.length === 0 && (
              <tr>
                <td colSpan="4" className="empty-cell">
                  {students.length === 0
                    ? 'No students found.'
                    : 'No students match your filters.'}
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
