import { Link } from 'react-router-dom'

function DashboardPage() {
  return (
    <div className="dashboard-shell">
      <div className="dashboard-card">
        <h2>Dashboard</h2>
        <p>Admin dashboard placeholder. Integrations will arrive next.</p>
        <Link className="text-link" to="/login">
          Back to login
        </Link>
      </div>
    </div>
  )
}

export default DashboardPage
