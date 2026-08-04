import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function TeacherPerformance() {
  const [loading, setLoading] = useState(true)
  const [exams, setExams] = useState([])
  const [selectedExamId, setSelectedExamId] = useState('')
  const [academicYears, setAcademicYears] = useState([])
  const [selectedYearId, setSelectedYearId] = useState('')
  const [rows, setRows] = useState([])
  const [loadingRows, setLoadingRows] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase.from('academic_years').select('*').order('year_name', { ascending: false }).limit(10),
      supabase.from('exams')
        .select('id, name, academic_year_id, start_date, created_at, status')
        .order('created_at', { ascending: false })
        .limit(200),
    ]).then(([yRes, eRes]) => {
      if (yRes.data) setAcademicYears(yRes.data)
      if (eRes.data) setExams(eRes.data)
      setLoading(false)
    })
  }, [])

  const filteredExams = selectedYearId
    ? exams.filter(e => e.academic_year_id === selectedYearId)
    : exams

  useEffect(() => {
    if (!selectedExamId) { setRows([]); return }
    const load = async () => {
      setLoadingRows(true)
      try {
        const [{ data: teachers }, { data: assignments }, { data: marks }] = await Promise.all([
          supabase.from('teachers').select('id, employee_number, profiles(full_name)').eq('status', 'active'),
          supabase.from('teacher_subjects').select('teacher_id, subject_id, class_stream_id, subjects(subject_name), class_streams(classes(class_name))'),
          supabase.from('marks').select('teacher_id, student_id, subject_id, marks_obtained, is_absent').eq('exam_id', selectedExamId),
        ])

        const marksByTeacher = {}
        ;(marks || []).forEach(m => {
          if (!m.teacher_id) return
          if (!marksByTeacher[m.teacher_id]) marksByTeacher[m.teacher_id] = []
          marksByTeacher[m.teacher_id].push(m)
        })

        const result = (teachers || []).map(t => {
          const ta = (assignments || []).filter(a => a.teacher_id === t.id)
          const subjects = [...new Set(ta.map(a => a.subjects?.subject_name).filter(Boolean))].sort()
          const classes = [...new Set(ta.map(a => a.class_streams?.classes?.class_name).filter(Boolean))].sort()
          const myMarks = marksByTeacher[t.id] || []
          const entered = myMarks.length
          const avg = entered > 0
            ? Math.round(myMarks.filter(m => !m.is_absent && m.marks_obtained != null).reduce((s, m) => s + m.marks_obtained, 0) /
                Math.max(1, myMarks.filter(m => !m.is_absent && m.marks_obtained != null).length))
            : null
          return {
            id: t.id,
            name: t.profiles?.full_name || '—',
            empNo: t.employee_number || '—',
            subjects,
            classes,
            entered,
            avg,
          }
        }).sort((a, b) => a.name.localeCompare(b.name))

        setRows(result)
      } catch (err) {
        console.error('TeacherPerformance load error:', err)
      } finally {
        setLoadingRows(false)
      }
    }
    load()
  }, [selectedExamId])

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="w-8 h-8 border-2 border-gray-200 border-t-maroon-600 rounded-full animate-spin" />
    </div>
  )

  const selectedExam = exams.find(e => e.id === selectedExamId)
  const totalEntered = rows.filter(r => r.entered > 0).length

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Teacher Performance</h1>
        <p className="text-gray-500 mt-1">View which teachers have entered marks and their students' average performance</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Academic Year</label>
            <select
              value={selectedYearId}
              onChange={e => { setSelectedYearId(e.target.value); setSelectedExamId('') }}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500"
            >
              <option value="">All Years</option>
              {academicYears.map(y => <option key={y.id} value={y.id}>{y.year_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Exam</label>
            <select
              value={selectedExamId}
              onChange={e => setSelectedExamId(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500"
            >
              <option value="">Select exam...</option>
              {filteredExams.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {!selectedExamId && (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342" />
          </svg>
          <p className="text-sm text-gray-500">Select an exam to view teacher performance data.</p>
        </div>
      )}

      {loadingRows && (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-gray-200 border-t-maroon-600 rounded-full animate-spin" />
        </div>
      )}

      {!loadingRows && selectedExamId && rows.length > 0 && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-2xl font-bold text-gray-900">{rows.length}</p>
              <p className="text-xs text-gray-500 mt-1">Total Teachers</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-2xl font-bold text-emerald-600">{totalEntered}</p>
              <p className="text-xs text-gray-500 mt-1">Marks Entered</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-2xl font-bold text-red-500">{rows.length - totalEntered}</p>
              <p className="text-xs text-gray-500 mt-1">Not Yet Entered</p>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-800">
                {selectedExam?.name} — Teacher Mark Entry Status
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Teacher</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">TSC No.</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Subjects</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Classes</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Marks Entered</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Avg Mark</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map(r => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{r.name}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{r.empNo}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{r.subjects.join(', ') || '—'}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{r.classes.join(', ') || '—'}</td>
                      <td className="px-4 py-3 text-center text-gray-700">{r.entered > 0 ? r.entered : '—'}</td>
                      <td className="px-4 py-3 text-center text-gray-700">
                        {r.avg != null ? `${r.avg}%` : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {r.entered > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-50 text-emerald-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Entered
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-amber-50 text-amber-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                            Pending
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
