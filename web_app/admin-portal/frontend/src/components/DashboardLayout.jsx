import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import Sidebar from './Sidebar.jsx'

const pageTitles = {
  '/dashboard': 'Dashboard',
  '/modules': 'Modules',
  '/modules/new': 'Add Module',
  '/students': 'Students',
  '/students/new': 'Add Student',
  '/settings': 'Settings',
}

function DashboardLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { logout } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const currentTitle =
    pageTitles[location.pathname] ||
    (location.pathname.startsWith('/modules/')
      ? location.pathname.includes('/sessions/')
        ? location.pathname.endsWith('/new')
          ? 'Add Session'
          : 'Edit Session'
        : location.pathname.endsWith('/edit')
        ? 'Edit Module'
        : 'Module Details'
      : location.pathname.startsWith('/students/')
      ? location.pathname.endsWith('/new')
        ? 'Add Student'
        : 'Edit Student'
      : 'Dashboard')

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const closeSidebar = () => setSidebarOpen(false)

  return (
    <div className="dashboard-layout">
      <Sidebar
        isOpen={sidebarOpen}
        onNavigate={closeSidebar}
        onLogout={handleLogout}
      />

      <div className="dashboard-content">
        <header className="topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="icon-button"
              aria-label="Toggle navigation"
              onClick={() => setSidebarOpen((prev) => !prev)}
            >
              <span className="icon-line" />
              <span className="icon-line" />
              <span className="icon-line" />
            </button>
            <div>
              <p className="page-title">{currentTitle}</p>
              <p className="page-subtitle">Crowd Verified Time Attendance System</p>
            </div>
          </div>
          <span className="role-badge">Lecturer Admin</span>
        </header>

        <main className="dashboard-main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default DashboardLayout
