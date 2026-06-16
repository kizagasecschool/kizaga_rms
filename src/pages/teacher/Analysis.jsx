import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

const COLORS = ['bg-blue-100 text-blue-700', 'bg-emerald-100 text-emerald-700', 'bg-amber-100 text-amber-700', 'bg-purple-100 text-purple-700', 'bg-rose-100 text-rose-700', 'bg-cyan-100 text-cyan-700', 'bg-orange-100 text-orange-700', 'bg-indigo-100 text-indigo-700', 'bg-teal-100 text-teal-700', 'bg-pink-100 text-pink-700']

function Analysis() {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [teacherId, setTeacherId] = useState(null)
  const [exams, setExams] = useState([])
  const [selectedExamId, setSelectedExamId] = useState('')
  const [selectedExam, setSelectedExam] = useState(null)
  const [gradesConfig, setGradesConfig] = useState([])
  const [subjectAnalysis, setSubjectAnalysis] = useState([])
  const [analyzing, setAnalyzing] = useState(false)

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      try {
        const { data: teacher } = await supabase
          .from('teachers')
          .select('id')
          .eq('profile_id', profile?.id)
          .single()
        if (!teacher) { setLoading(false); return }
        setTeacherId(teacher.id)

        const { data: assignments } = await supabase
          .from('teacher_subjects')
          .select('class_stream_id, subject_id, class_streams!inner(class_id, classes!inner(id, class_name, level))')
          .eq('teacher_id', teacher.id)

        if (!assignments || assignments.length === 0) { setLoading(false); return }

        const classIds = [...new Set(assignments.map(a => a.class_streams.class_id))]
        const { data: ec } = await supabase
          .from('exam_classes')
          .select('exam_id')
          .in('class_id', classIds)
        const examIds = [...new Set((ec || []).map(r => r.exam_id))]
        if (examIds.length === 0) { setLoading(false); return }

        const { data: examData } = await supabase
          .from('exams')
          .select('*, academic_years!inner(year_name), terms!inner(term_name)')
          .in('id', examIds)
          .order('created_at', { ascending: false })
        setExams(examData || [])
      } catch (err) {
        console.error('Init error:', err)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [profile])

  const doAnalysis = async (examId) => {
    if (!examId || !teacherId) return
    setAnalyzing(true)
    try {
      const { data: assignments } = await supabase
        .from('teacher_subjects')
        .select('*, class_streams!inner(class_id, classes!inner(id, class_name, level, sort_order), streams!inner(stream_name)), subjects!inner(*)')
        .eq('teacher_id', teacherId)

      if (!assignments || assignments.length === 0) return

      const { data: ec } = await supabase
        .from('exam_classes')
        .select('class_id')
        .eq('exam_id', examId)
      const examClassIds = new Set((ec || []).map(r => r.class_id))

      const myAssignments = assignments.filter(a => examClassIds.has(a.class_streams.class_id))
      if (myAssignments.length === 0) { setSubjectAnalysis([]); return }

      const classLevels = [...new Set(myAssignments.map(a => a.class_streams.classes.level))]
      const { data: gRes } = await supabase
        .from('grades')
        .select('*')
        .in('level', classLevels)
        .order('min_mark', { ascending: false })
      const allGrades = gRes || []
      setGradesConfig(allGrades)

      const gradeMap = {}
      allGrades.forEach(g => {
        if (!gradeMap[g.level]) gradeMap[g.level] = []
        gradeMap[g.level].push(g)
      })

      const results = []
      for (const assignment of myAssignments) {
        const { subject_id, class_stream_id, subjects, class_streams } = assignment
        const level = class_streams.classes.level
        const grades = gradeMap[level] || []

        const { data: students } = await supabase
          .from('students')
          .select('id, first_name, surname, gender')
          .eq('class_stream_id', class_stream_id)
          .eq('status', 'active')

        if (!students || students.length === 0) continue

        const studentIds = students.map(s => s.id)

        const { data: marks } = await supabase
          .from('marks')
          .select('*')
          .eq('exam_id', examId)
          .eq('subject_id', subject_id)
          .in('student_id', studentIds)

        const markMap = {}
        ;(marks || []).forEach(m => { markMap[m.student_id] = m })

        let totalMarks = 0, markCount = 0
        let maleTotal = 0, maleCount = 0
        let femaleTotal = 0, femaleCount = 0
        const gradeDist = {}
        grades.forEach(g => { gradeDist[g.grade] = { boys: 0, girls: 0, total: 0 } })

        students.forEach(s => {
          const mark = markMap[s.id]
          if (!mark || mark.is_absent) return
          const m = parseFloat(mark.marks_obtained) || 0
          const p = parseFloat(mark.practical_marks) || 0
          const total = m + p

          totalMarks += total
          markCount++

          if (s.gender === 'Male') { maleTotal += total; maleCount++ }
          else { femaleTotal += total; femaleCount++ }

          const gradeObj = grades.find(g => total >= g.min_mark && total <= g.max_mark)
          if (gradeObj) {
            gradeDist[gradeObj.grade].total++
            if (s.gender === 'Male') gradeDist[gradeObj.grade].boys++
            else gradeDist[gradeObj.grade].girls++
          }
        })

        const overallAvg = markCount > 0 ? (totalMarks / markCount) : 0
        const gradeObj = grades.find(g => overallAvg >= g.min_mark && overallAvg <= g.max_mark)

        let totalPoints = 0, ptCount = 0
        students.forEach(s => {
          const mark = markMap[s.id]
          if (!mark || mark.is_absent) return
          const m = parseFloat(mark.marks_obtained) || 0
          const p = parseFloat(mark.practical_marks) || 0
          const total = m + p
          const g = grades.find(g => total >= g.min_mark && total <= g.max_mark)
          if (g && g.points != null) { totalPoints += g.points; ptCount++ }
        })
        const gpa = ptCount > 0 ? (totalPoints / ptCount) : 0

        results.push({
          subject,
          classStream: class_streams,
          label: `${class_streams.classes.class_name} - ${class_streams.streams.stream_name}`,
          level,
          overallAvg,
          avgGrade: gradeObj?.grade || '-',
          avgPoints: gpa,
          gradeDist,
          maleAvg: maleCount > 0 ? (maleTotal / maleCount) : 0,
          femaleAvg: femaleCount > 0 ? (femaleTotal / femaleCount) : 0,
          maleCount,
          femaleCount,
          totalStudents: markCount,
          absentStudents: students.length - markCount,
          totalEnrolled: students.length,
        })
      }
      setSubjectAnalysis(results)
    } catch (err) {
      console.error('Analysis error:', err)
    } finally {
      setAnalyzing(false)
    }
  }

  useEffect(() => {
    if (!selectedExamId) { setSubjectAnalysis([]); return }
    const exam = exams.find(e => e.id === selectedExamId)
    setSelectedExam(exam || null)
    doAnalysis(selectedExamId)
  }, [selectedExamId])

  const gradeKeys = useMemo(() => {
    const set = new Set()
    subjectAnalysis.forEach(sa => {
      Object.keys(sa.gradeDist).forEach(g => set.add(g))
    })
    return [...set]
  }, [subjectAnalysis])

  const formatExam = (exam) => {
    if (!exam) return ''
    const y = exam.academic_years?.year_name || ''
    const t = exam.terms?.term_name || ''
    return `${exam.exam_name} (${t} ${y})`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-3 border-gray-200 border-t-maroon-600 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Subject Analysis</h1>
        <p className="text-gray-500 mt-1">Analyze grade distribution, averages, and GPA by subject and gender</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Select Exam</label>
          <select
            value={selectedExamId}
            onChange={(e) => setSelectedExamId(e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
          >
            <option value="">Choose an exam...</option>
            {exams.length === 0 && <option value="" disabled>No exams available</option>}
            {exams.map((exam) => (
              <option key={exam.id} value={exam.id}>
                {formatExam(exam)}
              </option>
            ))}
          </select>
        </div>
        {selectedExam && (
          <div className="mt-3 flex items-center gap-3 text-sm text-gray-500">
            <span>Type: <span className="font-medium text-gray-700">{selectedExam.exam_type?.replace('_', ' ')}</span></span>
            <span className="text-gray-300">|</span>
            <span>{subjectAnalysis.length} subject{subjectAnalysis.length !== 1 ? 's' : ''} analyzed</span>
          </div>
        )}
      </div>

      {analyzing && (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-3 border-gray-200 border-t-maroon-600 rounded-full animate-spin" />
        </div>
      )}

      {!analyzing && selectedExamId && subjectAnalysis.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
          </svg>
          <p className="text-sm text-gray-500">No subjects found for this exam.</p>
        </div>
      )}

      {!selectedExamId && (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
          </svg>
          <p className="text-sm text-gray-500">Select an exam above to view subject analysis.</p>
        </div>
      )}

      {!analyzing && subjectAnalysis.map((sa, idx) => (
        <div key={`${sa.subject.id}-${sa.classStream.id}`} className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
          <div className={`px-5 py-4 border-b border-gray-200 ${COLORS[idx % COLORS.length]} flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2`}>
            <div>
              <h2 className="text-sm font-bold">{sa.subject.subject_name} ({sa.subject.subject_code})</h2>
              <p className="text-xs opacity-75">{sa.label}</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-medium">
              <span>Avg: <strong>{sa.overallAvg.toFixed(1)}%</strong></span>
              <span>Grade: <strong>{sa.avgGrade}</strong></span>
              <span>GPA: <strong>{sa.avgPoints.toFixed(1)}</strong></span>
            </div>
          </div>

          <div className="p-5 space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-gray-900">{sa.totalEnrolled}</p>
                <p className="text-xs text-gray-500">Enrolled</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-gray-900">{sa.totalStudents}</p>
                <p className="text-xs text-gray-500">Present</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-blue-600">{sa.maleCount}</p>
                <p className="text-xs text-gray-500">Boys</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-pink-600">{sa.femaleCount}</p>
                <p className="text-xs text-gray-500">Girls</p>
              </div>
            </div>

            {/* Grade Distribution by Gender */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Grade Distribution by Gender</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Grade</th>
                      <th className="text-center px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Boys</th>
                      <th className="text-center px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Girls</th>
                      <th className="text-center px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {gradeKeys.map(g => {
                      const d = sa.gradeDist[g]
                      if (!d) return null
                      return (
                        <tr key={g} className="hover:bg-gray-50 transition">
                          <td className="px-3 py-2 font-semibold text-gray-800">{g}</td>
                          <td className="px-3 py-2 text-center text-gray-900">{d.boys || '-'}</td>
                          <td className="px-3 py-2 text-center text-gray-900">{d.girls || '-'}</td>
                          <td className="px-3 py-2 text-center text-gray-900 font-medium">{d.total || '-'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Average by Gender */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Subject Average by Gender</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-blue-50 rounded-xl p-4 text-center border border-blue-100">
                  <p className="text-xs text-blue-600 font-medium uppercase tracking-wide mb-1">Boys Average</p>
                  <p className="text-2xl font-bold text-blue-700">{sa.maleAvg.toFixed(1)}%</p>
                </div>
                <div className="bg-pink-50 rounded-xl p-4 text-center border border-pink-100">
                  <p className="text-xs text-pink-600 font-medium uppercase tracking-wide mb-1">Girls Average</p>
                  <p className="text-2xl font-bold text-pink-700">{sa.femaleAvg.toFixed(1)}%</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 text-center border border-gray-200">
                  <p className="text-xs text-gray-600 font-medium uppercase tracking-wide mb-1">Overall Average</p>
                  <p className="text-2xl font-bold text-gray-800">{sa.overallAvg.toFixed(1)}%</p>
                </div>
              </div>
            </div>

            {/* Grade & GPA Summary */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Grade & GPA Summary</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-purple-50 rounded-xl p-4 text-center border border-purple-100">
                  <p className="text-xs text-purple-600 font-medium uppercase tracking-wide mb-1">Subject Avg</p>
                  <p className="text-xl font-bold text-purple-700">{sa.overallAvg.toFixed(1)}%</p>
                </div>
                <div className="bg-emerald-50 rounded-xl p-4 text-center border border-emerald-100">
                  <p className="text-xs text-emerald-600 font-medium uppercase tracking-wide mb-1">Grade</p>
                  <p className="text-xl font-bold text-emerald-700">{sa.avgGrade}</p>
                </div>
                <div className="bg-amber-50 rounded-xl p-4 text-center border border-amber-100">
                  <p className="text-xs text-amber-600 font-medium uppercase tracking-wide mb-1">GPA (Points)</p>
                  <p className="text-xl font-bold text-amber-700">{sa.avgPoints.toFixed(1)}</p>
                </div>
                <div className="bg-indigo-50 rounded-xl p-4 text-center border border-indigo-100">
                  <p className="text-xs text-indigo-600 font-medium uppercase tracking-wide mb-1">Level</p>
                  <p className="text-xl font-bold text-indigo-700">{sa.level === 'O_LEVEL' ? 'O-Level' : 'A-Level'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default Analysis
