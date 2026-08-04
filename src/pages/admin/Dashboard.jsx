import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import StudentsByClassTable from '../../components/StudentsByClassTable'

function AdminDashboard() {
  const { profile } = useAuth()
  const [stats, setStats] = useState({ students: 0, teachers: 0, classes: 0, subjects: 0 })
  const [loading, setLoading] = useState(true)
  const [schoolInfo, setSchoolInfo] = useState(null)

  useEffect(() => {
    supabase.from('school_settings').select('logo_url, school_name').limit(1).then(({ data }) => {
      if (data?.[0]) {
        setSchoolInfo(data[0])
        document.title = data[0].school_name || 'Kizaga RMS'
      }
    })
  }, [])

  useEffect(() => {
    const fetchStats = async () => {
      const [sRes, tRes, cRes, subRes] = await Promise.all([
        supabase.from('students').select('*', { count: 'exact', head: true }),
        supabase.from('teachers').select('*', { count: 'exact', head: true }),
        supabase.from('classes').select('*', { count: 'exact', head: true }),
        supabase.from('subjects').select('*', { count: 'exact', head: true }),
      ])
      setStats({
        students: sRes.count ?? 0,
        teachers: tRes.count ?? 0,
        classes: cRes.count ?? 0,
        subjects: subRes.count ?? 0,
      })
      setLoading(false)
    }
    fetchStats()
  }, [])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const cards = [
    { label: 'Total Students', value: stats.students, color: 'bg-blue-50 text-blue-600', icon: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z' },
    { label: 'Teachers', value: stats.teachers, color: 'bg-emerald-50 text-emerald-600', icon: 'M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342' },
    { label: 'Classes', value: stats.classes, color: 'bg-purple-50 text-purple-600', icon: 'M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21' },
    { label: 'Subjects', value: stats.subjects, color: 'bg-amber-50 text-amber-600', icon: 'M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z' },
  ]

  return (
    <div>
      {/* Welcome banner */}
      <div className="mb-8 rounded-2xl bg-gradient-to-r from-gray-800 to-gray-900 p-6 text-white flex items-center gap-5 shadow-lg">
        {schoolInfo?.logo_url && (
          <img src={schoolInfo.logo_url} alt="School logo" className="w-16 h-16 rounded-xl object-contain bg-white/10 p-1 flex-shrink-0" />
        )}
        <div>
          <p className="text-sm text-gray-300">{greeting}</p>
          <h1 className="text-2xl font-bold">{profile?.full_name}</h1>
          <p className="text-gray-400 text-sm mt-0.5">System Administrator — full access</p>
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

      <div className="mt-8">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Students by Class</h2>
          <StudentsByClassTable />
        </div>
      </div>
    </div>
  )
}

export default AdminDashboard
