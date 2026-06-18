import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

function HeadmasterDashboard() {
  const { profile } = useAuth()
  const [stats, setStats] = useState({ students: 0, passRate: 0, activeExams: 0, avgPerformance: 0 })
  const [loading, setLoading] = useState(true)
  const [schoolInfo, setSchoolInfo] = useState(null)

  useEffect(() => {
    supabase.from('school_settings').select('logo_url, school_name').limit(1).then(({ data }) => {
      if (data?.[0]) setSchoolInfo(data[0])
    })
  }, [])

  useEffect(() => {
    const fetchStats = async () => {
      const [sRes, srRes, eRes, avgRes] = await Promise.all([
        supabase.from('students').select('*', { count: 'exact', head: true }),
        supabase.from('student_results').select('*', { count: 'exact', head: true }),
        supabase.from('exams').select('*', { count: 'exact', head: true }),
        supabase.from('student_results').select('average_marks'),
      ])

      const passed = avgRes.data?.filter((r) => r.average_marks >= 40).length ?? 0
      const totalResults = avgRes.data?.length ?? 0

      setStats({
        students: sRes.count ?? 0,
        passRate: totalResults > 0 ? Math.round((passed / totalResults) * 100) : 0,
        activeExams: eRes.count ?? 0,
        avgPerformance: totalResults > 0
          ? Math.round(avgRes.data.reduce((sum, r) => sum + (r.average_marks || 0), 0) / totalResults)
          : 0,
      })
      setLoading(false)
    }
    fetchStats()
  }, [])

  const cards = [
    { label: 'Total Students', value: stats.students, suffix: '', color: 'bg-gray-100 text-gray-600', icon: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z' },
    { label: 'Pass Rate', value: stats.passRate, suffix: '%', color: 'bg-gray-100 text-gray-600', icon: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
    { label: 'Avg Performance', value: stats.avgPerformance, suffix: '%', color: 'bg-gray-100 text-gray-600', icon: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625z' },
    { label: 'Exams Conducted', value: stats.activeExams, suffix: '', color: 'bg-gray-100 text-gray-600', icon: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5' },
  ]

  return (
    <div>
      <div className="mb-8 flex items-center gap-4">
        {schoolInfo?.logo_url && (
          <img src={schoolInfo.logo_url} alt="" className="w-14 h-14 object-contain shrink-0" crossOrigin="anonymous" />
        )}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Headmaster Dashboard</h1>
          <p className="text-gray-500 mt-1">Welcome, {profile?.full_name}. View school performance and reports.</p>
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
              {loading ? <span className="w-8 h-5 inline-block bg-gray-200 rounded animate-pulse" /> : `${stat.value}${stat.suffix}`}
            </p>
            <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Performance Overview</h2>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">Enrolled Students</span>
              <span className="text-sm font-semibold text-gray-900">{stats.students}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">Overall Pass Rate (≥40%)</span>
              <span className="text-sm font-semibold text-gray-900">{stats.passRate}%</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">Average Performance</span>
              <span className="text-sm font-semibold text-gray-900">{stats.avgPerformance}%</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-600">Exams Conducted</span>
              <span className="text-sm font-semibold text-gray-900">{stats.activeExams}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default HeadmasterDashboard
