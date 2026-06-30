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
import ClassUpgrade from './pages/admin/ClassUpgrade'
import HeadmasterDashboard from './pages/headmaster/Dashboard'
import HeadmasterReports from './pages/headmaster/Reports'
import HeadmasterPerformance from './pages/headmaster/Performance'
import HeadmasterResults from './pages/headmaster/Results'
import AcademicDashboard from './pages/academic/Dashboard'
import AcademicClasses from './pages/academic/Classes'
import AcademicSubjects from './pages/academic/Subjects'
import AcademicExams from './pages/academic/Exams'
import AcademicResults from './pages/academic/Results'
import ViewMarks from './pages/academic/ViewMarks'
import AcademicYears from './pages/academic/AcademicYears'
import StudentReports from './pages/academic/StudentReports'
import EnterMarks from './pages/teacher/EnterMarks'
import MyStudents from './pages/teacher/MyStudents'
import Analysis from './pages/teacher/Analysis'
import Students from './pages/Students'
import Teachers from './pages/Teachers'
import ClassSubjects from './pages/ClassSubjects'
import TeacherDashboard from './pages/teacher/Dashboard'
import Profile from './pages/Profile'
import Notifications from './pages/Notifications'
import SendNotification from './pages/SendNotification'
import SendSMS from './pages/SendSMS'
import AdmissionForm from './pages/public/AdmissionForm'
import TrackApplication from './pages/public/TrackApplication'
import PublicResults from './pages/public/PublicResults'
import SchoolRules from './pages/public/SchoolRules'
import JoiningInstructions from './pages/public/JoiningInstructions'
import EventsAnnouncements from './pages/public/EventsAnnouncements'
import ManageEventsAnnouncements from './pages/admin/EventsAnnouncements'
import ManageJoiningInstructions from './pages/admin/ManageJoiningInstructions'
import ManageAdmissions from './pages/ManageAdmissions'
import ManageUniforms from './pages/ManageUniforms'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/" element={<Landing />} />
        <Route path="/apply" element={<AdmissionForm />} />
        <Route path="/results" element={<PublicResults />} />
        <Route path="/track-application" element={<TrackApplication />} />
        <Route path="/school-rules" element={<SchoolRules />} />
        <Route path="/events-announcements" element={<EventsAnnouncements />} />
        <Route path="/joining-instructions" element={<JoiningInstructions />} />
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
                  <Route path="class-upgrade" element={<ClassUpgrade />} />
                  <Route path="admissions" element={<ManageAdmissions />} />
                  <Route path="uniforms" element={<ManageUniforms />} />
                  <Route path="events-announcements" element={<ManageEventsAnnouncements />} />
                  <Route path="joining-instructions" element={<ManageJoiningInstructions />} />
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
                  <Route path="teachers" element={<Teachers />} />
                  <Route path="students" element={<Students />} />
                  <Route path="results" element={<HeadmasterResults />} />
                  <Route path="reports" element={<HeadmasterReports />} />
                  <Route path="performance" element={<HeadmasterPerformance />} />
                  <Route path="admissions" element={<ManageAdmissions />} />
                  <Route path="uniforms" element={<ManageUniforms />} />
                  <Route path="events-announcements" element={<ManageEventsAnnouncements />} />
                  <Route path="joining-instructions" element={<ManageJoiningInstructions />} />
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
                  <Route path="reports" element={<StudentReports />} />
                  <Route path="view-marks" element={<ViewMarks />} />
                  <Route path="academic-years" element={<AcademicYears />} />
                  <Route path="enter-marks" element={<EnterMarks />} />
                  <Route path="class-upgrade" element={<ClassUpgrade />} />
                  <Route path="admissions" element={<ManageAdmissions />} />
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
                  <Route path="analysis" element={<Analysis />} />
                  <Route path="results" element={<AcademicResults />} />
                </Routes>
              </RoleBasedRoute>
            }
          />
          <Route path="profile" element={<Profile />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="send-notification" element={<SendNotification />} />
          <Route path="send-sms" element={<SendSMS />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
