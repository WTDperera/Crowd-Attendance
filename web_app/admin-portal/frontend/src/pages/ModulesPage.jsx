import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getModules } from '../services/moduleService'

function ModulesPage() {
  const navigate = useNavigate()
  const [modules, setModules] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let isMounted = true

    const fetchModules = async () => {
      try {
        const rows = await getModules()
        if (isMounted) {
          setModules(rows)
          setErrorMessage('')
        }
      } catch (error) {
        if (isMounted) {
          setModules([])
          setErrorMessage(error.message)
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    fetchModules()

    return () => {
      isMounted = false
    }
  }, [])

  return (
    <div className="card">
      <div className="card-header row">
        <div>
          <h4>Modules</h4>
          <span className="helper-text">View academic modules by semester.</span>
        </div>
      </div>

      {errorMessage && <span className="field-error">{errorMessage}</span>}

      <div className="module-grid">
        {isLoading && (
          <div className="empty-state">
            <p>Loading...</p>
          </div>
        )}
        {!isLoading && modules.map((module) => {
          const targetId = module.module_id || module.id
          return (
          <article
            key={module.id}
            className="module-card clickable"
            onClick={() => navigate(`/modules/${targetId}`)}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                navigate(`/modules/${targetId}`)
              }
            }}
          >
            <div className="module-header">
              <div>
                <p className="module-code">{module.module_code}</p>
                <h5>{module.module_name}</h5>
              </div>
              <span className="status-pill info">Level {module.level}</span>
            </div>

            <div className="module-meta">
              <p>
                <span>Department</span>
                <strong>{module.department || '—'}</strong>
              </p>
              <p>
                <span>Semester</span>
                <strong>{module.semester || '—'}</strong>
              </p>
            </div>

            <div className="card-actions">
              <button className="ghost-button" type="button" aria-label="View module details">
                View Details
              </button>
            </div>
          </article>
        )})}
        {!isLoading && modules.length === 0 && (
          <div className="empty-state">
            <p>No modules available.</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default ModulesPage
