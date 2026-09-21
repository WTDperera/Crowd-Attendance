import {useAuth} from '../context/AuthContext'

function ModuleCard({ 
  module,  
  onOpen, 
  onEdit, 
  onDelete 
}) 

{
  
  
  const { user , lecturerProfile } = useAuth()

  const lecturerName = lecturerProfile?.fullName

  
  const handleOpen = () => {
    if (onOpen) {
      onOpen(module)
    }
  }

  const handleEdit = (event) => {
    event.stopPropagation()
    if (onEdit) {
      onEdit(module)
    }
  }

  const handleDelete = (event) => {
    event.stopPropagation()
    if (onDelete) {
      onDelete(module)
    }
  }

  return (
    <article className="module-card clickable" onClick={handleOpen}>
      <div className="module-header">
        <div>
          <p className="module-code">{module.code || module.id}</p>
          <h5>{module.name || 'Untitled Module'}</h5>
        </div>
        {typeof module.enrollment_enabled === 'boolean' && (
          <span
            className={`status-pill ${module.enrollment_enabled ? 'success' : 'danger'}`}
          >
            {module.enrollment_enabled ? 'Enrollment On' : 'Enrollment Off'}
          </span>
        )}
      </div>

      <div className="module-meta">
        <p>
          Lecturer
          <strong>{lecturerName ||  '—'}</strong>
        </p>
        <p>
          Sessions
          <strong>{Number(module.total_sessions || 0)}</strong>
        </p>
      </div>

      <div className="card-actions">
        <button className="ghost-button" type="button" onClick={handleEdit}>
          Edit
        </button>
        <button
          className="ghost-button danger"
          type="button"
          onClick={handleDelete}
        >
          Delete
        </button>
      </div>
    </article>
  )
}

export default ModuleCard