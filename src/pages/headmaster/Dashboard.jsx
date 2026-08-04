import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import StudentsByClassTable from '../../components/StudentsByClassTable'

function HeadmasterDashboard() {
  const { profile } = useAuth()
  const [stats, setStats] = useState({ students: 0, passRate: 0, activeExams: 0, avgPerformance: 0 })
  const [loading, setLoading] = useState(true)
  const [schoolInfo, setSchoolInfo] = useState(null)
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState('')
  const [downloadingStudents, setDownloadingStudents] = useState(false)
  const [downloadStudentsError, setDownloadStudentsError] = useState('')

  useEffect(() => {
    supabase.from('school_settings').select('logo_url, school_name').limit(1).then(({ data }) => {
      if (data?.[0]) setSchoolInfo(data[0])
    })
  }, [])

  useEffect(() => {
    const fetchStats = async () => {
      const [sRes, eRes, avgRes] = await Promise.all([
        supabase.from('students').select('*', { count: 'exact', head: true }).eq('status', 'active'),
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

  const downloadTeachersCSV = async () => {
    setDownloading(true)
    setDownloadError('')
    try {
      const { data, error } = await supabase
        .from('teachers')
        .select('employee_number, phone, profiles(full_name, email), teacher_subjects(subjects(subject_name), class_streams(classes(class_name, level)))')
        .eq('status', 'active')
        .order('employee_number')

      if (error) throw error

      const rows = (data || []).map(t => {
        const name = t.profiles?.full_name || ''
        const email = t.profiles?.email || ''
        const phone = t.phone || ''
        const empNo = t.employee_number || ''

        const subjectSet = new Set()
        const classSet = new Set()
        t.teacher_subjects?.forEach(ts => {
          if (ts.subjects?.subject_name) subjectSet.add(ts.subjects.subject_name)
          if (ts.class_streams?.classes?.class_name) {
            const lvl = ts.class_streams.classes.level === 'O_LEVEL' ? 'O-Level' : 'A-Level'
            classSet.add(`${ts.class_streams.classes.class_name} (${lvl})`)
          }
        })

        const subjects = Array.from(subjectSet).sort().join('; ') || 'Not assigned'
        const classes = Array.from(classSet).sort().join('; ') || 'Not assigned'

        return [name, email, phone, empNo, subjects, classes]
      })

      const header = ['Full Name', 'Email', 'Phone', 'TSC No.', 'Subjects', 'Classes/Forms']
      const csv = [header, ...rows]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\r\n')

      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `teachers_${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      setDownloadError(err.message || 'Download failed')
    } finally {
      setDownloading(false)
    }
  }

  const downloadStudentsCSV = async () => {
    setDownloadingStudents(true)
    setDownloadStudentsError('')
    try {
      const allRows = []
      let from = 0
      const PAGE = 1000
      while (true) {
        const { data, error } = await supabase
          .from('students')
          .select('first_name, middle_name, surname, sex, date_of_birth, class_streams(classes(class_name, level), stream_name)')
          .eq('status', 'active')
          .range(from, from + PAGE - 1)
        if (error) throw error
        if (data) allRows.push(...data)
        if (!data || data.length < PAGE) break
        from += PAGE
      }

      allRows.sort((a, b) => {
        const na = `${a.first_name} ${a.middle_name || ''} ${a.surname}`.trim()
        const nb = `${b.first_name} ${b.middle_name || ''} ${b.surname}`.trim()
        return na.localeCompare(nb)
      })

      const header = ['Full Name', 'Sex', 'Date of Birth', 'Class', 'Level']
      const rows = allRows.map(s => {
        const name = [s.first_name, s.middle_name, s.surname].filter(Boolean).join(' ')
        const cls = s.class_streams?.classes?.class_name || ''
        const stream = s.class_streams?.stream_name || ''
        const level = s.class_streams?.classes?.level === 'O_LEVEL' ? 'O-Level' : s.class_streams?.classes?.level === 'A_LEVEL' ? 'A-Level' : ''
        const classLabel = stream ? `${cls} ${stream}` : cls
        return [name, s.sex || '', s.date_of_birth || '', classLabel, level]
      })

      const csv = [header, ...rows]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\r\n')

      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `students_${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      setDownloadStudentsError(err.message || 'Download failed')
    } finally {
      setDownloadingStudents(false)
    }
  }

  const cards = [
    { label: 'Total Students', value: stats.students, suffix: '', color: 'bg-gray-100 text-gray-600', icon: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z' },
    { label: 'Pass Rate', value: stats.passRate, suffix: '%', color: 'bg-gray-100 text-gray-600', icon: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
    { label: 'Avg Performance', value: stats.avgPerformance, suffix: '%', color: 'bg-gray-100 text-gray-600', icon: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625z' },
    { label: 'Exams Conducted', value: stats.activeExams, suffix: '', color: 'bg-gray-100 text-gray-600', icon: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5' },
  ]

  return (
    <div className="space-y-6">

      <div className="flex items-center gap-4">
        {schoolInfo?.logo_url && (
          <img src={schoolInfo.logo_url} alt="" className="w-14 h-14 object-contain shrink-0" crossOrigin="anonymous" />
        )}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Headmaster Dashboard</h1>
          <p className="text-gray-500 mt-1">Welcome, {profile?.full_name}. Overview of school performance.</p>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {cards.map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-5 transition">
            <div className={`w-10 h-10 rounded-lg ${stat.color} flex items-center justify-center mb-3`}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d={stat.icon} />
              </svg>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {loading
                ? <span className="w-8 h-5 inline-block bg-gray-200 rounded animate-pulse" />
                : `${stat.value}${stat.suffix}`
              }
            </p>
            <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* ── Teachers Report Download ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-50 rounded-lg flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m.75 12l3 3m0 0l3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Teachers Report</h2>
              <p className="text-sm text-gray-500 mt-0.5">All teachers with email, phone, subjects and classes — CSV</p>
            </div>
          </div>

          <button
            onClick={downloadTeachersCSV}
            disabled={downloading}
            className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors shrink-0"
          >
            {downloading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Downloading…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                Download CSV
              </>
            )}
          </button>
        </div>

        {downloadError && (
          <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-2">{downloadError}</p>
        )}
      </div>

      {/* ── Students Report Download ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m.75 12l3 3m0 0l3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Students Report</h2>
              <p className="text-sm text-gray-500 mt-0.5">All active students with name, sex, date of birth and class — CSV</p>
            </div>
          </div>

          <button
            onClick={downloadStudentsCSV}
            disabled={downloadingStudents}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors shrink-0"
          >
            {downloadingStudents ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Downloading…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                Download CSV
              </>
            )}
          </button>
        </div>

        {downloadStudentsError && (
          <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-2">{downloadStudentsError}</p>
        )}
      </div>

      {/* ── Students by Class ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 bg-maroon-50 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-maroon-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
          </div>
          <h2 className="text-base font-semibold text-gray-900">Students by Class</h2>
        </div>
        <StudentsByClassTable />
      </div>

    </div>
  )
}

export default HeadmasterDashboard
