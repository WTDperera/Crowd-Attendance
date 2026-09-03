import { NavLink } from 'react-router-dom'

function Sidebar({ isOpen, onNavigate, onLogout }) {
  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-header">
        <p className="sidebar-title">Crowd Verified</p>
        <span className="sidebar-subtitle">Admin Portal</span>
      </div>
      <nav className="sidebar-nav">
        <NavLink to="/dashboard" onClick={onNavigate}>
          Dashboard
        </NavLink>
        <NavLink to="/modules/new" onClick={onNavigate}>
          Add Module
        </NavLink>
        <NavLink to="/students" onClick={onNavigate}>
          Students
        </NavLink>
        <NavLink to="/settings" onClick={onNavigate}>
          Settings
        </NavLink>
        <button className="sidebar-logout" type="button" onClick={onLogout}>
          Logout
        </button>
      </nav>
    </aside>
  )
}

export default Sidebar
