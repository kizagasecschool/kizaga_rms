import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

function TeacherDashboard() {
  const { profile } = useAuth()
  const [stats, setStats] = useState({ students: 0, subjects: 0, marks: 0, pending: 0 })
  const [loading, setLoading] = useState(true)
  const [schoolInfo, setSchoolInfo] = useState(null)

  useEffect(() => {
    supabase.from('school_settings').select('logo_url, school_name').limit(1).then(({ data }) => {
      if (data?.[0]) setSchoolInfo(data[0])
    })
  }, [])

  useEffect(() => {
    const fetchStats = async () => {
      const { data: teacher } = await supabase
        .from('teachers')
        .select('id')
        .eq('profile_id', profile?.id)
        .single()

      if (!teacher) {
        setLoading(false)
        return
      }

      const { data: assignments } = await supabase
        .from('teacher_subjects')
        .select('class_stream_id, subject_id')
        .eq('teacher_id', teacher.id)

      const classStreamIds = [...new Set(assignments?.map((a) => a.class_stream_id) || [])]
      const subjectIds = [...new Set(assignments?.map((a) => a.subject_id) || [])]

      const [sRes, subRes, mRes] = await Promise.all([
        classStreamIds.length > 0
          ? supabase.from('students').select('*', { count: 'exact', head: true }).in('class_stream_id', classStreamIds)
          : { count: 0 },
        subjectIds.length > 0
          ? supabase.from('subjects').select('*', { count: 'exact', head: true }).in('id', subjectIds)
          : { count: 0 },
        supabase.from('marks').select('*', { count: 'exact', head: true }).eq('entered_by', profile?.id),
      ])

      setStats({
        students: sRes.count ?? 0,
        subjects: subRes.count ?? 0,
        marks: mRes.count ?? 0,
        pending: 0,
      })
      setLoading(false)
    }
    fetchStats()
  }, [profile])

  const cards = [
    { label: 'My Students', value: stats.students, color: 'bg-gray-100 text-gray-600', icon: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z' },
    { label: 'My Subjects', value: stats.subjects, color: 'bg-gray-100 text-gray-600', icon: 'M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z' },
    { label: 'Results Entered', value: stats.marks, color: 'bg-gray-100 text-gray-600', icon: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
    { label: 'Pending Entries', value: stats.pending, color: 'bg-gray-100 text-gray-600', icon: 'M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z' },
  ]

  return (
    <div>
      <div className="mb-8 flex items-center gap-4">
        {schoolInfo?.logo_url && (
          <img src={schoolInfo.logo_url} alt="" className="w-14 h-14 object-contain shrink-0" crossOrigin="anonymous" />
        )}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Teacher Dashboard</h1>
          <p className="text-gray-500 mt-1">Welcome, {profile?.full_name}. Manage your classes and results.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {cards.map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-5 transition">
            <div className={`w-10 h-10 rounded-lg ${stat.color} flex items-center justify-center mb-3`}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d={stat.icon} />
              </svg>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {loading ? <span className="w-8 h-5 inline-block bg-gray-200 rounded animate-pulse" /> : stat.value}
            </p>
            <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {!loading && (
        <div className="mt-8">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Link
                to="/teacher/enter-marks"
                className="flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:border-maroon-300 hover:text-maroon-600 hover:bg-maroon-50/50 transition"
              >
                <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Enter Marks
              </Link>
            </div>
          </div>
        </div>
      )}

      {!loading && stats.students === 0 && (
        <div className="mt-8 bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm text-amber-700">
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
            <span className="font-medium">No assignments yet</span>
          </div>
          <p className="text-xs">You haven't been assigned any classes or subjects. Contact the admin or academic officer.</p>
        </div>
      )}
    </div>
  )
}

export default TeacherDashboard
