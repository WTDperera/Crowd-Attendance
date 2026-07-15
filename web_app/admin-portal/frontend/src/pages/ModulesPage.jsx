import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ModuleCard from '../components/ModuleCard.jsx'
import ModuleFormModal from '../components/ModuleFormModal.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import {
  createModule,
  deleteModule,
  listenModules,
  updateModule,
} from '../services/moduleService'

function ModulesPage() {
  const navigate = useNavigate()
  const { user, lecturerProfile } = useAuth()
  const lecturerId = user?.uid || ''
  const lecturerName = lecturerProfile?.fullName || ''
  const [modules, setModules] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [search, setSearch] = useState('')
  const [activeModal, setActiveModal] = useState(null)
  const [selectedModule, setSelectedModule] = useState(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    setIsLoading(true)

    const unsubscribe = listenModules(
      lecturerId,
      (rows) => {
        setModules(rows)
        setErrorMessage('')
        setIsLoading(false)
      },
      (error) => {
        setModules([])
        setErrorMessage(error.message)
        setIsLoading(false)
      }
    )

    return () => unsubscribe()
  }, [lecturerId])

  const filteredModules = useMemo(() => {
    const query = search.trim().toLowerCase()

    if (!query) {
      return modules
    }

    return modules.filter((module) => {
      const code = (module.code || module.id || '').toLowerCase()
      const name = (module.name || '').toLowerCase()
      return code.includes(query) || name.includes(query)
    })
  }, [modules, search])

  const closeModal = () => {
    setActiveModal(null)
    setSelectedModule(null)
  }

  const openCreateModal = () => {
    setSelectedModule(null)
    setActiveModal('create')
  }

  const openEditModal = (module) => {
    setSelectedModule(module)
    setActiveModal('edit')
  }

  const handleCreate = async (payload) => {
    if (!lecturerId) {
      window.alert('You must be signed in to create a module.')
      return
    }

    setIsSaving(true)
    setErrorMessage('')

    try {
      await createModule({ ...payload, lecturer_id: lecturerId })
      window.alert('Module created successfully.')
      closeModal()
    } catch (error) {
      setErrorMessage(error.message)
      window.alert(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleUpdate = async (payload) => {
    if (!selectedModule) {
      return
    }

    setIsSaving(true)
    setErrorMessage('')

    try {
      await updateModule(selectedModule.code || selectedModule.id, payload, lecturerId)
      window.alert('Module updated successfully.')
      closeModal()
    } catch (error) {
      setErrorMessage(error.message)
      window.alert(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (module) => {
    const code = (module.code || module.id || '').trim().toUpperCase()
    if (!code) {
      window.alert('Module code is missing.')
      return
    }

    const confirmation = window.prompt(
      `Type ${code} to confirm deletion. Existing attendance records will remain.`
    )

    if (!confirmation) {
      return
    }

    if (confirmation.trim().toUpperCase() !== code) {
      window.alert('Module code did not match. Deletion canceled.')
      return
    }

    setErrorMessage('')

    try {
      await deleteModule(code, lecturerId)
      window.alert('Module deleted successfully.')
    } catch (error) {
      setErrorMessage(error.message)
      window.alert(error.message)
    }
  }

  const openDetails = (module) => {
    const code = (module.code || module.id || '').trim()
    if (code) {
      navigate(`/modules/${code}`)
    }
  }

  return (
    <div className="card">
      <div className="card-header row">
        <div>
          <h4>Modules</h4>
          <span className="helper-text">
            Manage modules in Firestore. Attendance records are preserved on delete.
          </span>
        </div>
        <button className="primary-button" type="button" onClick={openCreateModal}>
          Add Module
        </button>
      </div>

      <div className="filters">
        <input
          type="search"
          placeholder="Search by code or name"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {errorMessage && <span className="field-error">{errorMessage}</span>}

      <div className="module-grid">
        {isLoading && (
          <div className="empty-state">Loading modules...</div>
        )}
        {!isLoading && filteredModules.map((module) => (
          <ModuleCard
            key={module.id}
            module={module}
            onOpen={openDetails}
            onEdit={openEditModal}
            onDelete={handleDelete}
          />
        ))}
        {!isLoading && filteredModules.length === 0 && (
          <div className="empty-state">
            {modules.length === 0
              ? 'No modules found.'
              : 'No modules match your search.'}
          </div>
        )}
      </div>

      <ModuleFormModal
        isOpen={activeModal === 'create'}
        mode="create"
        lecturerId={lecturerId}
        lecturerName={lecturerName}
        onClose={closeModal}
        onSubmit={handleCreate}
        isSubmitting={isSaving}
      />
      <ModuleFormModal
        isOpen={activeModal === 'edit'}
        mode="edit"
        initialValues={selectedModule}
        lecturerId={selectedModule?.lecturer_id || lecturerId}
        lecturerName={lecturerName}
        onClose={closeModal}
        onSubmit={handleUpdate}
        isSubmitting={isSaving}
      />
    </div>
  )
}

export default ModulesPage