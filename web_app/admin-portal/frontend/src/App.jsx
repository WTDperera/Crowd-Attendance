import { Navigate, Route, Routes } from 'react-router-dom'
import './styles/auth.css'
import './styles/dashboard.css'
import DashboardLayout from './components/DashboardLayout.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { ModulesProvider } from './context/ModulesContext.jsx'
import { StudentsProvider } from './context/StudentsContext.jsx'
import AddStudent from './pages/AddStudent.jsx'
import AddModule from './pages/AddModule.jsx'
import AddSession from './pages/AddSession.jsx'
import EditStudent from './pages/EditStudent.jsx'
import EditModule from './pages/EditModule.jsx'
import EditSession from './pages/EditSession.jsx'
import LoginPage from './pages/LoginPage.jsx'
import ModuleDetailsPage from './pages/ModuleDetailsPage.jsx'
import DashboardHome from './pages/DashboardHome.jsx'
import ModulesPage from './pages/ModulesPage.jsx'
import RegisterPage from './pages/RegisterPage.jsx'
import SettingsPage from './pages/SettingsPage.jsx'
import StudentsList from './pages/StudentsList.jsx'

function App() {
  return (
    <AuthProvider>
      <StudentsProvider>
        <ModulesProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            <Route element={<ProtectedRoute />}>
              <Route element={<DashboardLayout />}>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<DashboardHome />} />
                <Route path="/modules" element={<ModulesPage />} />
                <Route path="/modules/new" element={<AddModule />} />
                <Route path="/modules/:id" element={<ModuleDetailsPage />} />
                <Route path="/modules/:id/edit" element={<EditModule />} />
                <Route
                  path="/modules/:id/sessions/new"
                  element={<AddSession />}
                />
                <Route
                  path="/modules/:id/sessions/:sid/edit"
                  element={<EditSession />}
                />
                <Route path="/students" element={<StudentsList />} />
                <Route path="/students/new" element={<AddStudent />} />
                <Route path="/students/:id/edit" element={<EditStudent />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Route>
            </Route>
          </Routes>
        </ModulesProvider>
      </StudentsProvider>
    </AuthProvider>
  )
}

export default App
