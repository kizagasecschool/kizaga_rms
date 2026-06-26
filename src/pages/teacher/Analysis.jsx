import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

function Analysis() {
  const { profile } = useAuth()
  const printRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [teacherId, setTeacherId] = useState(null)
  const [exams, setExams] = useState([])
  const [selectedExamId, setSelectedExamId] = useState('')
  const [selectedExam, setSelectedExam] = useState(null)
  const [selectedSubjectId, setSelectedSubjectId] = useState('')
  const [gradesConfig, setGradesConfig] = useState([])
  const [subjectAnalysis, setSubjectAnalysis] = useState([])
  const [analyzing, setAnalyzing] = useState(false)
  const [expandedStreams, setExpandedStreams] = useState({})

  const handlePrint = () => {
    setExpandedStreams(Object.fromEntries(filteredAnalysis.map(sa => [sa.classStream.id, true])))
    const s = document.createElement('style')
    s.id = '__print'
    s.textContent = `
      @page { size: A4 landscape; margin: 10mm }
      @media print {
        .no-print { display: none !important }
        .hidden { display: block !important }
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: #fff }
        table { border-collapse: collapse; width: 100% }
        th, td { border: 1px solid #000 !important; padding: 4px 6px; font-size: 10px }
        th { background: #e5e7eb !important; -webkit-print-color-adjust: exact; print-color-adjust: exact }
      }
    `
    document.head.appendChild(s)
    setTimeout(() => { window.print(); document.head.removeChild(s) }, 100)
  }

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

  const doAnalysis = async (examId, examObj) => {
    if (!examId || !teacherId) return
    setAnalyzing(true)
    try {
      const { data: assignments } = await supabase
        .from('teacher_subjects')
        .select('*, class_streams!inner(class_id, classes!inner(id, class_name, level, sort_order), streams!inner(stream_name)), subjects!inner(*)')
        .eq('teacher_id', teacherId)

      if (!assignments || assignments.length === 0) return
      const examHasPractical = examObj?.has_practical === true

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
      const processedGroups = new Set()

      for (const assignment of myAssignments) {
        const { subject_id, class_stream_id, subjects, class_streams } = assignment
        const level = class_streams.classes.level
        const isOLevel = level !== 'A_LEVEL'
        const classId = class_streams.class_id

        // O-Level: deduplicate by class+subject (teacher may be assigned to multiple streams of same class)
        const groupKey = isOLevel ? `${classId}_${subject_id}` : `${class_stream_id}_${subject_id}`
        if (processedGroups.has(groupKey)) continue
        processedGroups.add(groupKey)

        const grades = gradeMap[level] || []
        const hasPractical = subjects.has_practical && examHasPractical
        const maxMarks = hasPractical ? 150 : 100

        const studentsQuery = isOLevel
          ? supabase.from('students').select('id, first_name, surname, gender').eq('class_id', classId).eq('status', 'active')
          : supabase.from('students').select('id, first_name, surname, gender').eq('class_stream_id', class_stream_id).eq('status', 'active')

        const { data: students } = await studentsQuery

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
        let totalPoints = 0, ptCount = 0
        const gradeDist = {}
        grades.forEach(g => { gradeDist[g.grade] = { boys: 0, girls: 0, total: 0 } })
        const studentDetails = []

        students.forEach(s => {
          const fullName = `${s.first_name} ${s.surname}`.trim()
          const mark = markMap[s.id]
          const isAbsent = !mark || mark.is_absent
          const m = parseFloat(mark?.marks_obtained) || 0
          const p = parseFloat(mark?.practical_marks) || 0
          const total = m + p
          const pct = isAbsent ? null : total / maxMarks * 100
          const gradeObj = pct != null ? grades.find(g => pct >= g.min_mark && pct <= g.max_mark) : null

          studentDetails.push({
            fullName, gender: s.gender,
            marksObtained: m, practicalMarks: p, total, pct,
            grade: gradeObj?.grade || '-', points: gradeObj?.points ?? 0,
            isAbsent,
          })

          if (isAbsent) return
          totalMarks += total
          markCount++
          if (s.gender === 'Male') { maleTotal += total; maleCount++ }
          else { femaleTotal += total; femaleCount++ }
          if (gradeObj) {
            gradeDist[gradeObj.grade].total++
            if (s.gender === 'Male') gradeDist[gradeObj.grade].boys++
            else gradeDist[gradeObj.grade].girls++
          }
          if (gradeObj && gradeObj.points != null) { totalPoints += gradeObj.points; ptCount++ }
        })

        const overallAvg = markCount > 0 ? (totalMarks / maxMarks / markCount * 100) : 0
        const gpa = ptCount > 0 ? (totalPoints / ptCount) : 0
        const avgGradeObj = overallAvg > 0 ? grades.find(g => overallAvg >= g.min_mark && overallAvg <= g.max_mark) : null

        results.push({
          subject: subjects,
          hasPractical,
          classStream: class_streams,
          label: isOLevel
            ? class_streams.classes.class_name
            : `${class_streams.classes.class_name} - ${class_streams.streams.stream_name}`,
          level,
          overallAvg,
          avgGrade: avgGradeObj?.grade || '-',
          avgPoints: gpa,
          gradeDist,
          maleAvg: maleCount > 0 ? (maleTotal / maxMarks / maleCount * 100) : 0,
          femaleAvg: femaleCount > 0 ? (femaleTotal / maxMarks / femaleCount * 100) : 0,
          maleCount,
          femaleCount,
          totalStudents: markCount,
          absentStudents: students.length - markCount,
          totalEnrolled: students.length,
          students: studentDetails,
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
    setSelectedSubjectId('')
    if (!selectedExamId) { setSubjectAnalysis([]); return }
    const exam = exams.find(e => e.id === selectedExamId)
    setSelectedExam(exam || null)
    doAnalysis(selectedExamId, exam)
  }, [selectedExamId])

  const subjectOptions = useMemo(() => {
    const map = {}
    subjectAnalysis.forEach(sa => {
      const id = sa.subject.id
      if (!map[id]) {
        map[id] = { ...sa.subject, streams: [], totalEnrolled: 0, totalPresent: 0, totalAbsent: 0 }
      }
      map[id].streams.push(sa)
      map[id].totalEnrolled += sa.totalEnrolled
      map[id].totalPresent += sa.totalStudents
      map[id].totalAbsent += sa.absentStudents
    })
    return Object.values(map)
  }, [subjectAnalysis])

  const selectedSubjectData = useMemo(() => {
    if (!selectedSubjectId) return null
    return subjectOptions.find(s => s.id === selectedSubjectId) || null
  }, [selectedSubjectId, subjectOptions])

  const filteredAnalysis = useMemo(() => {
    if (!selectedSubjectData) return []
    return selectedSubjectData.streams
  }, [selectedSubjectData])

  const gradeKeys = useMemo(() => {
    const set = new Set()
    filteredAnalysis.forEach(sa => {
      Object.keys(sa.gradeDist).forEach(g => set.add(g))
    })
    return [...set].sort()
  }, [filteredAnalysis])

  const combinedStats = useMemo(() => {
    if (filteredAnalysis.length === 0) return null
    let totalEnrolled = 0, totalPresent = 0, totalAbsent = 0
    let maleCount = 0, femaleCount = 0
    let weightedAvg = 0, weightedMaleAvg = 0, weightedFemaleAvg = 0, weightedGpa = 0

    filteredAnalysis.forEach(sa => {
      totalEnrolled += sa.totalEnrolled
      totalPresent += sa.totalStudents
      totalAbsent += sa.absentStudents
      maleCount += sa.maleCount
      femaleCount += sa.femaleCount
      weightedAvg += sa.overallAvg * sa.totalStudents
      weightedMaleAvg += sa.maleAvg * sa.maleCount
      weightedFemaleAvg += sa.femaleAvg * sa.femaleCount
      weightedGpa += sa.avgPoints * sa.totalStudents
    })

    const overallAvg = totalPresent > 0 ? weightedAvg / totalPresent : 0
    const maleAvg = maleCount > 0 ? weightedMaleAvg / maleCount : 0
    const femaleAvg = femaleCount > 0 ? weightedFemaleAvg / femaleCount : 0
    const gpa = totalPresent > 0 ? weightedGpa / totalPresent : 0

    const level = filteredAnalysis[0]?.level
    const levelGrades = gradesConfig.filter(g => g.level === level).sort((a, b) => b.min_mark - a.min_mark)
    const overallGrade = levelGrades.find(g => overallAvg >= g.min_mark)?.grade || '-'

    return { totalEnrolled, totalPresent, totalAbsent, maleCount, femaleCount, overallAvg, maleAvg, femaleAvg, gpa, overallGrade }
  }, [filteredAnalysis, gradesConfig])

  const formatExam = (exam) => {
    if (!exam) return ''
    const y = exam.academic_years?.year_name || ''
    const t = exam.terms?.term_name || ''
    return `${exam.name || exam.exam_name} (${t} ${y})`
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
      <div className="mb-6 no-print">
        <h1 className="text-2xl font-bold text-gray-900">Subject Analysis</h1>
        <p className="text-gray-500 mt-1">Analyze grade distribution, averages, and GPA by subject and stream</p>
      </div>

      {/* Exam Selector */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6 no-print">
        <label className="block text-sm font-medium text-gray-700 mb-1">Select Exam</label>
        <div className="flex items-center gap-3">
          <select
            value={selectedExamId}
            onChange={(e) => setSelectedExamId(e.target.value)}
            className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
          >
            <option value="">Choose an exam...</option>
            {exams.length === 0 && <option value="" disabled>No exams available</option>}
            {exams.map((exam) => (
              <option key={exam.id} value={exam.id}>
                {formatExam(exam)}
              </option>
            ))}
          </select>
          {selectedSubjectData && (
            <button onClick={handlePrint} className="px-4 py-2.5 bg-maroon-600 text-white text-sm font-medium rounded-lg hover:bg-maroon-700 transition flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
              Print
            </button>
          )}
        </div>
        {selectedExam && (
          <div className="mt-3 text-sm text-gray-500">
            <span className="font-medium text-gray-700">{selectedExam.exam_type?.replace('_', ' ')}</span>
            <span className="mx-2">|</span>
            {!selectedSubjectId && <span>{subjectOptions.length} subject{subjectOptions.length !== 1 ? 's' : ''}</span>}
            {selectedSubjectData && <span>{filteredAnalysis.length} stream{filteredAnalysis.length !== 1 ? 's' : ''}</span>}
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

      {/* Subject Selection Grid */}
      {!analyzing && subjectAnalysis.length > 0 && !selectedSubjectId && (
        <div className="no-print">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Select a subject to view detailed analysis</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {subjectOptions.map((subj) => (
              <button key={subj.id} onClick={() => setSelectedSubjectId(subj.id)} className="bg-white rounded-xl border border-gray-200 p-5 text-left hover:border-maroon-400 hover:shadow-md transition text-center">
                <h3 className="text-base font-bold text-gray-900">{subj.subject_name}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{subj.subject_code}</p>
                <div className="mt-3 flex items-center justify-center gap-4 text-xs text-gray-600">
                  <span><strong className="text-gray-900">{subj.totalEnrolled}</strong> Enrolled</span>
                  <span><strong className="text-gray-900">{subj.streams.length}</strong> Stream{subj.streams.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="mt-2 flex items-center justify-center gap-2 flex-wrap">
                  {subj.streams.map(st => (
                    <span key={st.classStream.id} className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600">{st.label}</span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Detailed Subject View */}
      {!analyzing && selectedSubjectData && (
        <div ref={printRef}>
          {/* Subject Header */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
            <div className="bg-gray-900 text-white px-5 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold">{selectedSubjectData.subject_name} ({selectedSubjectData.subject_code})</h2>
                  <p className="text-sm text-gray-300 mt-0.5">{formatExam(selectedExam)} — {selectedSubjectData.streams[0]?.level === 'O_LEVEL' ? 'O-Level' : 'A-Level'}</p>
                </div>
                <button onClick={() => setSelectedSubjectId('')} className="text-sm text-gray-300 hover:text-white transition flex items-center gap-1 no-print">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M11 17l-5-5m0 0l5-5m-5 5h12" /></svg>
                  Back
                </button>
              </div>
            </div>

            {/* Summary Cards */}
            {combinedStats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-gray-200">
                {[
                  { label: 'Enrolled', value: combinedStats.totalEnrolled, cls: '' },
                  { label: 'Present', value: combinedStats.totalPresent, cls: '' },
                  { label: 'Boys', value: combinedStats.maleCount, cls: 'text-blue-600' },
                  { label: 'Girls', value: combinedStats.femaleCount, cls: 'text-pink-600' },
                  { label: 'Absent', value: combinedStats.totalAbsent, cls: 'text-red-600' },
                  { label: 'Class Avg', value: `${combinedStats.overallAvg.toFixed(1)}%`, cls: '' },
                  { label: 'Boys Avg', value: `${combinedStats.maleAvg.toFixed(1)}%`, cls: 'text-blue-600' },
                  { label: 'Girls Avg', value: `${combinedStats.femaleAvg.toFixed(1)}%`, cls: 'text-pink-600' },
                ].map((item, i) => (
                  <div key={i} className="bg-white px-4 py-3 text-center">
                    <p className={`text-lg font-bold ${item.cls}`}>{item.value}</p>
                    <p className="text-xs text-gray-500">{item.label}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Stream Summary Table */}
            <div className="p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Stream Performance Summary</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border border-gray-300">
                  <thead>
                    <tr className="bg-gray-100 border-b border-gray-300">
                      <th className="border-r border-gray-300 px-3 py-2 text-xs font-semibold text-gray-600 uppercase text-left">Stream</th>
                      <th className="border-r border-gray-300 px-3 py-2 text-xs font-semibold text-gray-600 uppercase">Enrolled</th>
                      <th className="border-r border-gray-300 px-3 py-2 text-xs font-semibold text-gray-600 uppercase">Present</th>
                      <th className="border-r border-gray-300 px-3 py-2 text-xs font-semibold text-gray-600 uppercase">Boys</th>
                      <th className="border-r border-gray-300 px-3 py-2 text-xs font-semibold text-gray-600 uppercase">Girls</th>
                      <th className="border-r border-gray-300 px-3 py-2 text-xs font-semibold text-gray-600 uppercase">Absent</th>
                      <th className="border-r border-gray-300 px-3 py-2 text-xs font-semibold text-gray-600 uppercase">Avg %</th>
                      <th className="border-r border-gray-300 px-3 py-2 text-xs font-semibold text-gray-600 uppercase">Grade</th>
                      <th className="px-3 py-2 text-xs font-semibold text-gray-600 uppercase">GPA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredAnalysis.map(sa => (
                      <tr key={sa.classStream.id} className="hover:bg-gray-50">
                        <td className="border-r border-gray-200 px-3 py-2 font-medium text-gray-800">{sa.label}</td>
                        <td className="border-r border-gray-200 px-3 py-2 text-center">{sa.totalEnrolled}</td>
                        <td className="border-r border-gray-200 px-3 py-2 text-center">{sa.totalStudents}</td>
                        <td className="border-r border-gray-200 px-3 py-2 text-center">{sa.maleCount}</td>
                        <td className="border-r border-gray-200 px-3 py-2 text-center">{sa.femaleCount}</td>
                        <td className="border-r border-gray-200 px-3 py-2 text-center text-red-600">{sa.absentStudents}</td>
                        <td className="border-r border-gray-200 px-3 py-2 text-center font-medium">{sa.overallAvg.toFixed(1)}</td>
                        <td className="border-r border-gray-200 px-3 py-2 text-center font-medium">{sa.avgGrade}</td>
                        <td className="px-3 py-2 text-center font-medium">{sa.avgPoints.toFixed(1)}</td>
                      </tr>
                    ))}
                    {combinedStats && (
                      <tr className="bg-gray-50 font-bold">
                        <td className="border-r border-gray-300 px-3 py-2 text-gray-900">Total / Average</td>
                        <td className="border-r border-gray-300 px-3 py-2 text-center">{combinedStats.totalEnrolled}</td>
                        <td className="border-r border-gray-300 px-3 py-2 text-center">{combinedStats.totalPresent}</td>
                        <td className="border-r border-gray-300 px-3 py-2 text-center">{combinedStats.maleCount}</td>
                        <td className="border-r border-gray-300 px-3 py-2 text-center">{combinedStats.femaleCount}</td>
                        <td className="border-r border-gray-300 px-3 py-2 text-center text-red-600">{combinedStats.totalAbsent}</td>
                        <td className="border-r border-gray-300 px-3 py-2 text-center">{combinedStats.overallAvg.toFixed(1)}</td>
                        <td className="border-r border-gray-300 px-3 py-2 text-center">{combinedStats.overallGrade}</td>
                        <td className="px-3 py-2 text-center">{combinedStats.gpa.toFixed(1)}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Student Details */}
            <div className="px-5 pb-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Student Scores</h3>
              {filteredAnalysis.map(sa => {
                const isOpen = expandedStreams[sa.classStream.id]
                return (
                  <div key={sa.classStream.id} className="mb-3 border border-gray-200 rounded-lg overflow-hidden">
                    <button onClick={() => setExpandedStreams(p => ({ ...p, [sa.classStream.id]: !isOpen }))} className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 hover:bg-gray-100 transition text-sm font-medium text-gray-700">
                      <span>{sa.label} — <span className="font-normal text-gray-500">{sa.totalStudents} students</span></span>
                      <svg className={`w-4 h-4 transition ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    <div className={`overflow-x-auto ${isOpen ? '' : 'hidden'}`}>
                      <table className="w-full text-xs border-t border-gray-200">
                        <thead>
                          <tr className="bg-gray-100 border-b border-gray-200">
                            <th className="border-r border-gray-200 px-3 py-2 font-semibold text-gray-600 text-left">#</th>
                            <th className="border-r border-gray-200 px-3 py-2 font-semibold text-gray-600 text-left">Student Name</th>
                            <th className="border-r border-gray-200 px-3 py-2 font-semibold text-gray-600">Gender</th>
                            <th className="border-r border-gray-200 px-3 py-2 font-semibold text-gray-600">Marks</th>
                            {sa.hasPractical && <th className="border-r border-gray-200 px-3 py-2 font-semibold text-gray-600">Practical</th>}
                            <th className="border-r border-gray-200 px-3 py-2 font-semibold text-gray-600">{sa.hasPractical ? 'Total (150)' : 'Total (100)'}</th>
                            <th className="border-r border-gray-200 px-3 py-2 font-semibold text-gray-600">%</th>
                            <th className="border-r border-gray-200 px-3 py-2 font-semibold text-gray-600">Grade</th>
                            <th className="px-3 py-2 font-semibold text-gray-600">Points</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {sa.students.map((sd, i) => (
                            <tr key={i} className={`hover:bg-gray-50 ${sd.isAbsent ? 'text-red-500 bg-red-50' : ''}`}>
                              <td className="border-r border-gray-100 px-3 py-1.5 text-gray-400">{i + 1}</td>
                              <td className="border-r border-gray-100 px-3 py-1.5 font-medium text-gray-800">{sd.fullName}</td>
                              <td className="border-r border-gray-100 px-3 py-1.5 text-center">{sd.gender === 'Male' ? 'M' : 'F'}</td>
                              <td className="border-r border-gray-100 px-3 py-1.5 text-center">{sd.isAbsent ? 'Abs' : sd.marksObtained.toFixed(0)}</td>
                              {sa.hasPractical && <td className="border-r border-gray-100 px-3 py-1.5 text-center">{sd.isAbsent ? '-' : sd.practicalMarks.toFixed(0)}</td>}
                              <td className="border-r border-gray-100 px-3 py-1.5 text-center font-medium">{sd.isAbsent ? '-' : sd.total.toFixed(0)}</td>
                              <td className="border-r border-gray-100 px-3 py-1.5 text-center">{sd.isAbsent ? '-' : sd.pct.toFixed(1)}</td>
                              <td className="border-r border-gray-100 px-3 py-1.5 text-center font-medium">{sd.isAbsent ? '-' : sd.grade}</td>
                              <td className="px-3 py-1.5 text-center font-medium">{sd.isAbsent ? '-' : sd.points}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Grade Distribution */}
            <div className="px-5 pb-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Grade Distribution</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border border-gray-300">
                  <thead>
                    <tr className="bg-gray-100 border-b border-gray-300">
                      <th className="border-r border-gray-300 px-3 py-2 text-xs font-semibold text-gray-600 uppercase">Grade</th>
                      <th className="border-r border-gray-300 px-3 py-2 text-xs font-semibold text-gray-600 uppercase">Boys</th>
                      <th className="border-r border-gray-300 px-3 py-2 text-xs font-semibold text-gray-600 uppercase">Girls</th>
                      <th className="px-3 py-2 text-xs font-semibold text-gray-600 uppercase">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {gradeKeys.map(g => {
                      let totalBoys = 0, totalGirls = 0
                      filteredAnalysis.forEach(sa => {
                        const d = sa.gradeDist[g]
                        if (d) { totalBoys += d.boys; totalGirls += d.girls }
                      })
                      if (totalBoys === 0 && totalGirls === 0) return null
                      return (
                        <tr key={g} className="hover:bg-gray-50">
                          <td className="border-r border-gray-200 px-3 py-2 font-semibold text-gray-800">{g}</td>
                          <td className="border-r border-gray-200 px-3 py-2 text-center">{totalBoys || '-'}</td>
                          <td className="border-r border-gray-200 px-3 py-2 text-center">{totalGirls || '-'}</td>
                          <td className="px-3 py-2 text-center font-medium">{totalBoys + totalGirls || '-'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Averages by Gender */}
            {combinedStats && (
              <div className="px-5 pb-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Subject Average by Gender</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-blue-50 rounded-xl p-4 text-center border border-blue-100">
                    <p className="text-xs text-blue-600 font-medium uppercase tracking-wide mb-1">Boys Average</p>
                    <p className="text-2xl font-bold text-blue-700">{combinedStats.maleAvg.toFixed(1)}%</p>
                  </div>
                  <div className="bg-pink-50 rounded-xl p-4 text-center border border-pink-100">
                    <p className="text-xs text-pink-600 font-medium uppercase tracking-wide mb-1">Girls Average</p>
                    <p className="text-2xl font-bold text-pink-700">{combinedStats.femaleAvg.toFixed(1)}%</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4 text-center border border-gray-200">
                    <p className="text-xs text-gray-600 font-medium uppercase tracking-wide mb-1">Overall Average</p>
                    <p className="text-2xl font-bold text-gray-800">{combinedStats.overallAvg.toFixed(1)}%</p>
                  </div>
                </div>
              </div>
            )}

            {/* GPA Summary */}
            {combinedStats && (
              <div className="px-5 pb-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Grade & GPA Summary</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-purple-50 rounded-xl p-4 text-center border border-purple-100">
                    <p className="text-xs text-purple-600 font-medium uppercase tracking-wide mb-1">Subject Avg</p>
                    <p className="text-xl font-bold text-purple-700">{combinedStats.overallAvg.toFixed(1)}%</p>
                  </div>
                  <div className="bg-emerald-50 rounded-xl p-4 text-center border border-emerald-100">
                    <p className="text-xs text-emerald-600 font-medium uppercase tracking-wide mb-1">Overall Grade</p>
                    <p className="text-xl font-bold text-emerald-700">{combinedStats.overallGrade}</p>
                  </div>
                  <div className="bg-amber-50 rounded-xl p-4 text-center border border-amber-100">
                    <p className="text-xs text-amber-600 font-medium uppercase tracking-wide mb-1">GPA (Points)</p>
                    <p className="text-xl font-bold text-amber-700">{combinedStats.gpa.toFixed(1)}</p>
                  </div>
                  <div className="bg-indigo-50 rounded-xl p-4 text-center border border-indigo-100">
                    <p className="text-xs text-indigo-600 font-medium uppercase tracking-wide mb-1">Level</p>
                    <p className="text-xl font-bold text-indigo-700">{filteredAnalysis[0]?.level === 'O_LEVEL' ? 'O-Level' : 'A-Level'}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default Analysis
