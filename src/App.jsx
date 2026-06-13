import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './routes/ProtectedRoute'
import RoleBasedRoute from './routes/RoleBasedRoute'
import MainLayout from './layouts/MainLayout'
import Landing from './pages/Landing'
import Login from './pages/auth/Login'
import AdminDashboard from './pages/admin/Dashboard'
import AdminClasses from './pages/admin/Classes'
import AdminSubjects from './pages/admin/Subjects'
import HeadmasterDashboard from './pages/headmaster/Dashboard'
import AcademicDashboard from './pages/academic/Dashboard'
import AcademicClasses from './pages/academic/Classes'
import AcademicSubjects from './pages/academic/Subjects'
import AcademicExams from './pages/academic/Exams'
import Students from './pages/Students'
import Teachers from './pages/Teachers'
import ClassSubjects from './pages/ClassSubjects'
import TeacherDashboard from './pages/teacher/Dashboard'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Landing />} />
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
                  <Route path="teachers" element={<Teachers />} />
                  <Route path="classes" element={<AdminClasses />} />
                  <Route path="subjects" element={<AdminSubjects />} />
                  <Route path="students" element={<Students />} />
                  <Route path="class-subjects" element={<ClassSubjects />} />
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
                  <Route path="teachers" element={<Teachers />} />
                  <Route path="classes" element={<AcademicClasses />} />
                  <Route path="subjects" element={<AcademicSubjects />} />
                  <Route path="students" element={<Students />} />
                  <Route path="class-subjects" element={<ClassSubjects />} />
                  <Route path="exams" element={<AcademicExams />} />
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
