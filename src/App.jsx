import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import ProtectedRoute from './routes/ProtectedRoute'
import RoleBasedRoute from './routes/RoleBasedRoute'
import MainLayout from './layouts/MainLayout'
import Login from './pages/auth/Login'
import AdminDashboard from './pages/admin/Dashboard'
import AdminClasses from './pages/admin/Classes'
import HeadmasterDashboard from './pages/headmaster/Dashboard'
import AcademicDashboard from './pages/academic/Dashboard'
import AcademicClasses from './pages/academic/Classes'
import TeacherDashboard from './pages/teacher/Dashboard'

function RootRedirect() {
  const { profile } = useAuth()
  if (!profile) return null
  const redirectMap = {
    admin: '/admin',
    headmaster: '/headmaster',
    academic: '/academic',
    teacher: '/teacher',
  }
  return <Navigate to={redirectMap[profile.role] || '/teacher'} replace />
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <RootRedirect />
            </ProtectedRoute>
          }
        />
        <Route
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route
            path="/admin/*"
            element={
              <RoleBasedRoute allowedRoles={['admin']}>
                <Routes>
                  <Route index element={<AdminDashboard />} />
                  <Route path="classes" element={<AdminClasses />} />
                </Routes>
              </RoleBasedRoute>
            }
          />
          <Route
            path="/headmaster/*"
            element={
              <RoleBasedRoute allowedRoles={['headmaster']}>
                <Routes>
                  <Route index element={<HeadmasterDashboard />} />
                </Routes>
              </RoleBasedRoute>
            }
          />
          <Route
            path="/academic/*"
            element={
              <RoleBasedRoute allowedRoles={['academic']}>
                <Routes>
                  <Route index element={<AcademicDashboard />} />
                  <Route path="classes" element={<AcademicClasses />} />
                </Routes>
              </RoleBasedRoute>
            }
          />
          <Route
            path="/teacher/*"
            element={
              <RoleBasedRoute allowedRoles={['teacher']}>
                <Routes>
                  <Route index element={<TeacherDashboard />} />
                </Routes>
              </RoleBasedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
