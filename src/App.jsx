import ForgotPassword from './pages/auth/ForgotPassword'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './routes/ProtectedRoute'
import RoleBasedRoute from './routes/RoleBasedRoute'
import MainLayout from './layouts/MainLayout'
import Landing from './pages/Landing'
import Login from './pages/auth/Login'
import AdminDashboard from './pages/admin/Dashboard'
import AdminClasses from './pages/admin/Classes'
import AdminSubjects from './pages/admin/Subjects'
import AdminUsers from './pages/admin/Users'
import SchoolSettings from './pages/admin/SchoolSettings'
import HeadmasterDashboard from './pages/headmaster/Dashboard'
import AcademicDashboard from './pages/academic/Dashboard'
import AcademicClasses from './pages/academic/Classes'
import AcademicSubjects from './pages/academic/Subjects'
import AcademicExams from './pages/academic/Exams'
import AcademicResults from './pages/academic/Results'
import ViewMarks from './pages/academic/ViewMarks'
import AcademicYears from './pages/academic/AcademicYears'
import EnterMarks from './pages/teacher/EnterMarks'
import MyStudents from './pages/teacher/MyStudents'
import Students from './pages/Students'
import Teachers from './pages/Teachers'
import ClassSubjects from './pages/ClassSubjects'
import TeacherDashboard from './pages/teacher/Dashboard'
import Profile from './pages/Profile'
import Notifications from './pages/Notifications'
import SendNotification from './pages/SendNotification'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
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
                  <Route path="users" element={<AdminUsers />} />
                  <Route path="teachers" element={<Teachers />} />
                  <Route path="classes" element={<AdminClasses />} />
                  <Route path="subjects" element={<AdminSubjects />} />
                  <Route path="students" element={<Students />} />
                  <Route path="class-subjects" element={<ClassSubjects />} />
                  <Route path="academic-years" element={<AcademicYears />} />
                  <Route path="school-settings" element={<SchoolSettings />} />
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
                  <Route path="results" element={<AcademicResults />} />
                  <Route path="view-marks" element={<ViewMarks />} />
                  <Route path="academic-years" element={<AcademicYears />} />
                  <Route path="enter-marks" element={<EnterMarks />} />
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
                  <Route path="enter-marks" element={<EnterMarks />} />
                  <Route path="students" element={<MyStudents />} />
                </Routes>
              </RoleBasedRoute>
            }
          />
          <Route path="profile" element={<Profile />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="send-notification" element={<SendNotification />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
