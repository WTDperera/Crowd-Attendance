function AuthLayout({ children }) {
  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-brand">
          <p className="auth-overline">Crowd Verified Time Attendance System</p>
          <h1 className="auth-title">Admin Portal</h1>
        </div>
        {children}
      </div>
    </div>
  )
}

export default AuthLayout
