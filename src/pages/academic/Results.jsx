import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import * as XLSX from 'xlsx'

const SCIENCE_SUBJECTS = ['BIO', 'CHEM', 'PHY', 'BIOS', 'BIO_O', 'CHEM_O', 'PHY_O']

function subjectHasPractical(subject, exam) {
  if (!exam?.has_practical) return false
  return subject?.has_practical || SCIENCE_SUBJECTS.includes(subject?.subject_code)
}

function getMarkPercentage(mark, hasPractical) {
  if (!mark || mark.is_absent) return null
  const theory = mark.marks_obtained ?? 0
  const practical = hasPractical ? (mark.practical_marks ?? 0) : 0
  const max = hasPractical ? 150 : 100
  return ((theory + practical) / max) * 100
}

function getGradeForPercentage(pct, grades) {
  if (pct === null || pct === undefined) return null
  for (const g of grades) {
    if (pct >= g.min_mark && pct <= g.max_mark) return g
  }
  return null
}

function getPointsForAverage(avg, grades) {
  if (avg === null || avg === undefined) return null
  for (const g of grades) {
    if (avg >= g.min_mark && avg <= g.max_mark) return g.points
  }
  return null
}

const DIVS = [
  { key: 'I', label: 'Division I' },
  { key: 'II', label: 'Division II' },
  { key: 'III', label: 'Division III' },
  { key: 'IV', label: 'Division IV' },
  { key: '0', label: 'Division 0' },
]

function DivisionSummary({ summary, title }) {
  const { rows, totalBoys, totalGirls, grandTotal } = summary
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
      <div className="px-5 py-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Division</th>
              <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Boys</th>
              <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Girls</th>
              <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map(r => (
              <tr key={r.division} className="hover:bg-gray-50 transition">
                <td className="px-4 py-2 text-gray-700 font-medium">
                  {DIVS.find(d => d.key === r.division)?.label || `Division ${r.division}`}
                </td>
                <td className="px-4 py-2 text-center text-gray-900">{r.boys}</td>
                <td className="px-4 py-2 text-center text-gray-900">{r.girls}</td>
                <td className="px-4 py-2 text-center text-gray-900 font-medium">{r.total}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50 font-semibold border-t-2 border-gray-200">
              <td className="px-4 py-2.5 text-gray-800">Total</td>
              <td className="px-4 py-2.5 text-center text-gray-900">{totalBoys}</td>
              <td className="px-4 py-2.5 text-center text-gray-900">{totalGirls}</td>
              <td className="px-4 py-2.5 text-center text-gray-900">{grandTotal}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

function SubjectGradeMatrix({ subjects, matrix, grades, subjectAverages }) {
  const gradeKeys = grades.map(g => g.grade)
  if (!gradeKeys.length) return null

  const avgMap = {}
  subjectAverages.forEach(sa => { avgMap[sa.subject.id] = sa })

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
      <div className="px-4 py-2.5 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-800">Subject Grade Analysis</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-1.5 py-2 text-xs font-semibold text-gray-500 uppercase sticky left-0 bg-gray-50 z-10" style={{ minWidth: 55 }}>
                Subject
              </th>
              {gradeKeys.map(g => (
                <th key={g} className="text-center px-0.5 py-2 text-[10px] font-semibold text-gray-500 uppercase" colSpan={2} style={{ minWidth: 40 }}>
                  {g}
                </th>
              ))}
              <th className="text-center px-1.5 py-2 text-[10px] font-semibold text-gray-500 uppercase" style={{ minWidth: 35 }}>GPA</th>
              <th className="text-center px-1.5 py-2 text-[10px] font-semibold text-gray-500 uppercase" style={{ minWidth: 35 }}>Grade</th>
            </tr>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="px-1.5 py-0.5 sticky left-0 bg-gray-50/50 z-10" />
              {gradeKeys.map(g => (
                <React.Fragment key={g}>
                  <th className="text-center px-0.5 py-0.5 text-[9px] font-medium text-gray-400 uppercase">B</th>
                  <th className="text-center px-0.5 py-0.5 text-[9px] font-medium text-gray-400 uppercase">G</th>
                </React.Fragment>
              ))}
              <th className="px-1.5 py-0.5" colSpan={2} />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {matrix.map(sg => {
              const sa = avgMap[sg.subject.id]
              return (
                <tr key={sg.subject.id} className="hover:bg-gray-50 transition">
                  <td className="px-1.5 py-1.5 text-xs font-medium text-gray-800 sticky left-0 bg-white hover:bg-gray-50 z-10">
                    {sg.subject.subject_code}
                  </td>
                  {gradeKeys.map(g => {
                    const entry = sg.grades[g] || { boys: 0, girls: 0 }
                    return (
                      <React.Fragment key={g}>
                        <td className="px-0.5 py-1.5 text-center text-xs text-gray-900">{entry.boys || '-'}</td>
                        <td className="px-0.5 py-1.5 text-center text-xs text-gray-900">{entry.girls || '-'}</td>
                      </React.Fragment>
                    )
                  })}
                  <td className="px-1.5 py-1.5 text-center text-xs font-semibold text-gray-800">
                    {sa ? sa.avgPoints.toFixed(1) : '-'}
                  </td>
                  <td className="px-1.5 py-1.5 text-center text-xs font-semibold text-gray-800">
                    {sa?.grade || '-'}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50 font-semibold border-t-2 border-gray-200">
              <td className="px-1.5 py-2 text-xs text-gray-800 sticky left-0 bg-gray-50 z-10">TOTAL</td>
              {(() => {
                const totals = {}
                gradeKeys.forEach(g => { totals[g] = { boys: 0, girls: 0 } })
                matrix.forEach(sg => {
                  gradeKeys.forEach(g => {
                    const e = sg.grades[g]
                    if (e) { totals[g].boys += e.boys; totals[g].girls += e.girls }
                  })
                })
                return gradeKeys.flatMap(g => [
                  <td key={`${g}-b`} className="px-0.5 py-2 text-center text-xs text-gray-900">{totals[g].boys}</td>,
                  <td key={`${g}-g`} className="px-0.5 py-2 text-center text-xs text-gray-900">{totals[g].girls}</td>,
                ])
              })()}
              <td className="px-1.5 py-2 text-center text-xs text-gray-900">-</td>
              <td className="px-1.5 py-2 text-center text-xs text-gray-900">-</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

function Results() {
  const [searchParams] = useSearchParams()
  const examIdParam = searchParams.get('examId')

  const [exams, setExams] = useState([])
  const [selectedExamId, setSelectedExamId] = useState(examIdParam || '')
  const [selectedExam, setSelectedExam] = useState(null)

  const [academicYears, setAcademicYears] = useState([])
  const [selectedYearId, setSelectedYearId] = useState('')

  const [examClasses, setExamClasses] = useState([])
  const [classes, setClasses] = useState([])
  const [selectedClassId, setSelectedClassId] = useState('')

  const [subjects, setSubjects] = useState([])
  const [students, setStudents] = useState([])
  const [marks, setMarks] = useState([])
  const [studentResults, setStudentResults] = useState([])
  const [grades, setGrades] = useState([])
  const [schoolInfo, setSchoolInfo] = useState(null)

  const [loading, setLoading] = useState(true)
  const [loadingData, setLoadingData] = useState(false)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const [eRes, cRes, stRes, schRes, yRes] = await Promise.all([
        supabase.from('exams').select('*').order('created_at', { ascending: false }),
        supabase.from('classes').select('*').order('sort_order'),
        supabase.from('exam_classes').select('*'),
        supabase.from('school_settings').select('*').maybeSingle(),
        supabase.from('academic_years').select('*').order('year_name', { ascending: false }),
      ])
      if (eRes.data) setExams(eRes.data)
      if (cRes.data) setClasses(cRes.data)
      if (stRes.data) setExamClasses(stRes.data)
      if (schRes.data) {
        setSchoolInfo(schRes.data)
        document.title = schRes.data.school_name || 'Kizaga RMS'
      }
      if (yRes.data) setAcademicYears(yRes.data)
      setLoading(false)
    }
    load()
  }, [])

  const className = useMemo(() => classes.find(c => c.id === selectedClassId)?.class_name || '', [classes, selectedClassId])

  useEffect(() => {
    if (schoolInfo?.school_name && selectedExam && className) {
      document.title = `${selectedExam.name} - ${className} - ${schoolInfo.school_name}`
    } else if (schoolInfo?.school_name) {
      document.title = schoolInfo.school_name
    }
  }, [schoolInfo, selectedExam, className])

  useEffect(() => {
    if (!selectedExamId) { setSelectedExam(null); return }
    const exam = exams.find(e => e.id === selectedExamId)
    setSelectedExam(exam || null)
    setSelectedClassId('')
    setStudents([])
    setMarks([])
    setStudentResults([])
    setGrades([])
  }, [selectedExamId, exams])

  const classIdsForExam = useMemo(() => {
    if (!selectedExamId) return []
    return examClasses.filter(ec => ec.exam_id === selectedExamId).map(ec => ec.class_id)
  }, [selectedExamId, examClasses])

  const filteredClasses = useMemo(() => {
    return classes.filter(c => classIdsForExam.includes(c.id))
  }, [classes, classIdsForExam])

  useEffect(() => {
    if (!selectedExamId || !selectedClassId) {
      setSubjects([])
      setStudents([])
      setMarks([])
      setStudentResults([])
      setGrades([])
      return
    }
    const loadData = async () => {
      setLoadingData(true)
      try {
        const selectedClass = classes.find(c => c.id === selectedClassId)
        if (!selectedClass) return
        const classLevel = selectedClass.level || 'O_LEVEL'

        const [gRes, sRes, exclRes] = await Promise.all([
          supabase.from('grades').select('*').eq('level', classLevel).order('min_mark', { ascending: false }),
          supabase.from('subjects').select('*').eq('level', classLevel).order('subject_name'),
          supabase.from('class_excluded_subjects').select('subject_id').eq('class_id', selectedClassId),
        ])
        setGrades(gRes.data || [])
        const excludedIds = new Set((exclRes.data || []).map(r => r.subject_id))
        const assignedSubjects = (sRes.data || []).filter(s => !excludedIds.has(s.id))
        setSubjects(assignedSubjects)

        let loadedStudents = []
        let loadedMarks = []
        let loadedResults = []

        if (assignedSubjects.length > 0) {
          const subjectIds = assignedSubjects.map(s => s.id)
          const { data: mData } = await supabase
            .from('marks')
            .select('*')
            .eq('exam_id', selectedExamId)
            .in('subject_id', subjectIds)
          loadedMarks = mData || []

          const studentIdsFromMarks = [...new Set(loadedMarks.map(m => m.student_id))]

          if (studentIdsFromMarks.length > 0) {
            const [sRes, srRes] = await Promise.all([
              supabase.from('students').select('*').in('id', studentIdsFromMarks).order('surname'),
              supabase.from('student_results').select('*').eq('exam_id', selectedExamId).in('student_id', studentIdsFromMarks),
            ])
            loadedStudents = sRes.data || []
            loadedResults = srRes.data || []
          }

          if (loadedStudents.length === 0) {
            const { data: byClassId } = await supabase
              .from('students')
              .select('*')
              .eq('class_id', selectedClassId)
              .order('surname')
            if (byClassId?.length > 0) {
              loadedStudents = byClassId
            }
            if (loadedStudents.length === 0) {
              const { data: byJoin } = await supabase
                .from('students')
                .select('*, class_streams!inner(*)')
                .eq('class_streams.class_id', selectedClassId)
                .order('surname')
              if (byJoin?.length > 0) {
                loadedStudents = byJoin.map(s => { const { class_streams: _, ...rest } = s; return rest })
              }
            }
            if (loadedStudents.length > 0) {
              const { data: srRes } = await supabase
                .from('student_results')
                .select('*')
                .eq('exam_id', selectedExamId)
                .in('student_id', loadedStudents.map(s => s.id))
              loadedResults = srRes.data || []
            }
          }
        }

        setStudents(loadedStudents)
        setMarks(loadedMarks)
        setStudentResults(loadedResults)
      } catch (err) {
        console.error('Load data error:', err)
      } finally {
        setLoadingData(false)
      }
    }
    loadData()
  }, [selectedExamId, selectedClassId, classes])

  const markMap = useMemo(() => {
    const map = {}
    marks.forEach(m => { map[`${m.student_id}_${m.subject_id}`] = m })
    return map
  }, [marks])

  const resultsMap = useMemo(() => {
    const map = {}
    studentResults.forEach(sr => { map[sr.student_id] = sr })
    return map
  }, [studentResults])

  const studentsWithResults = useMemo(() => {
    return students.map(student => {
      const result = resultsMap[student.id] || null
      let totalPoints = 0, ptCount = 0
      subjects.forEach(subject => {
        const mark = markMap[`${student.id}_${subject.id}`]
        const hasPrac = subjectHasPractical(subject, selectedExam)
        const pct = getMarkPercentage(mark, hasPrac)
        if (pct !== null) {
          const gradeObj = getGradeForPercentage(pct, grades)
          if (gradeObj?.points != null) {
            totalPoints += gradeObj.points
            ptCount++
          }
        }
      })
      return { ...student, result, points: ptCount > 0 ? totalPoints : null }
    })
  }, [students, resultsMap, grades, subjects, markMap, selectedExam])

  const divisionSummary = useMemo(() => {
    const rows = DIVS.map(d => ({ division: d.key, boys: 0, girls: 0, total: 0 }))
    let totalBoys = 0, totalGirls = 0
    studentsWithResults.forEach(s => {
      const div = (s.result?.division || 'Division 0').replace('Division ', '')
      const row = rows.find(r => r.division === div)
      if (s.gender === 'Male') { if (row) row.boys++; totalBoys++ }
      else if (s.gender === 'Female') { if (row) row.girls++; totalGirls++ }
    })
    rows.forEach(r => { r.total = r.boys + r.girls })
    return { rows, totalBoys, totalGirls, grandTotal: totalBoys + totalGirls }
  }, [studentsWithResults])

  const subjectGradeMatrix = useMemo(() => {
    if (!grades.length) return []
    return subjects.map(subject => {
      const gradeCounts = {}
      grades.forEach(g => { gradeCounts[g.grade] = { boys: 0, girls: 0 } })
      studentsWithResults.forEach(student => {
        const mark = markMap[`${student.id}_${subject.id}`]
        const hasPrac = subjectHasPractical(subject, selectedExam)
        const pct = getMarkPercentage(mark, hasPrac)
        if (pct === null) return
        const gradeObj = getGradeForPercentage(pct, grades)
        if (!gradeObj) return
        if (student.gender === 'Male') gradeCounts[gradeObj.grade].boys++
        else gradeCounts[gradeObj.grade].girls++
      })
      return { subject, grades: gradeCounts }
    })
  }, [subjects, studentsWithResults, markMap, grades, selectedExam])

  const subjectAverages = useMemo(() => {
    if (!grades.length) return []
    return subjects.map(subject => {
      let totalPct = 0, count = 0, totalPoints = 0, ptCount = 0
      studentsWithResults.forEach(student => {
        const mark = markMap[`${student.id}_${subject.id}`]
        const hasPrac = subjectHasPractical(subject, selectedExam)
        const pct = getMarkPercentage(mark, hasPrac)
        if (pct !== null) {
          totalPct += pct
          count++
          const gradeObj = getGradeForPercentage(pct, grades)
          if (gradeObj && gradeObj.points != null) {
            totalPoints += gradeObj.points
            ptCount++
          }
        }
      })
      const avgPct = count > 0 ? totalPct / count : 0
      const avgPts = ptCount > 0 ? totalPoints / ptCount : 0
      const gradeObj = getGradeForPercentage(avgPct, grades)
      return { subject, avgPercentage: avgPct, avgPoints: avgPts, grade: gradeObj?.grade || '-' }
    })
  }, [subjects, studentsWithResults, markMap, grades, selectedExam])

  const sortedStudents = useMemo(() => {
    const withRank = studentsWithResults.filter(s => s.result?.position != null)
      .sort((a, b) => a.result.position - b.result.position)
    const withoutRank = studentsWithResults.filter(s => !s.result?.position)
    return [...withRank, ...withoutRank]
  }, [studentsWithResults])

  const topSet = useMemo(() => {
    const ids = sortedStudents.filter(s => s.result?.position != null).slice(0, 3).map(s => s.id)
    return new Set(ids)
  }, [sortedStudents])

  const bottomSet = useMemo(() => {
    const withPos = sortedStudents.filter(s => s.result?.position != null)
    const ids = withPos.slice(-3).map(s => s.id)
    return new Set(ids)
  }, [sortedStudents])

  const anyPractical = useMemo(() => {
    return subjects.some(s => subjectHasPractical(s, selectedExam))
  }, [subjects, selectedExam])

  const isProcessed = selectedExam && ['processed', 'published', 'locked'].includes(selectedExam.status)

  const handlePrint = useCallback(() => {
    window.print()
  }, [])

  const handleExportExcel = useCallback(() => {
    const selectedClass = classes.find(c => c.id === selectedClassId)
    const examName = selectedExam?.name || 'results'
    const className = selectedClass?.class_name || ''

    const headers = ['#', 'Student Name']
    subjects.forEach(s => {
      const hp = subjectHasPractical(s, selectedExam)
      if (hp) { headers.push(`${s.subject_code}(T)`, `${s.subject_code}(P)`) }
      else { headers.push(s.subject_code) }
    })
    headers.push('Avg', 'Grd', 'Pos', 'Div', 'Pts')

    const rows = sortedStudents.map(student => {
      const row = [
        student.result?.position || '-',
        `${student.first_name} ${student.surname}`,
      ]
      subjects.forEach(subject => {
        const mark = markMap[`${student.id}_${subject.id}`]
        const hp = subjectHasPractical(subject, selectedExam)
        if (mark?.is_absent) {
          if (hp) { row.push('Abs', 'Abs') } else { row.push('Abs') }
        } else if (mark) {
          if (hp) { row.push(mark.marks_obtained ?? '-', mark.practical_marks ?? '-') }
          else { row.push(mark.marks_obtained ?? '-') }
        } else {
          if (hp) { row.push('-', '-') } else { row.push('-') }
        }
      })
      row.push(student.result?.average_marks ?? '-')
      row.push(student.result?.grade ?? '-')
      row.push(student.result?.position ?? '-')
      row.push(student.result?.division ?? '-')
      row.push(student.points ?? '-')
      return row
    })

    const wsData = [
      [`${examName} - ${className}`],
      headers,
      ...rows,
    ]

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet(wsData)

    const mergeCols = headers.length
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: mergeCols - 1 } }]

    const colWidths = [{ wch: 4 }, { wch: 22 }]
    subjects.forEach(s => {
      if (subjectHasPractical(s, selectedExam)) { colWidths.push({ wch: 6 }, { wch: 6 }) }
      else { colWidths.push({ wch: 6 }) }
    })
    colWidths.push({ wch: 6 }, { wch: 5 }, { wch: 5 }, { wch: 5 }, { wch: 5 })
    ws['!cols'] = colWidths

    XLSX.utils.book_append_sheet(wb, ws, 'Results')
    XLSX.writeFile(wb, `${examName.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`)
  }, [sortedStudents, subjects, selectedExam, markMap, selectedClassId, classes])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-3 border-gray-200 border-t-maroon-600 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      <div className="no-print mb-6">
        <h1 className="text-2xl font-bold text-gray-900">View Results</h1>
        <p className="text-gray-500 mt-1">View entered marks by exam and class</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6 no-print">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Academic Year</label>
            <select
              value={selectedYearId}
              onChange={(e) => { setSelectedYearId(e.target.value); setSelectedExamId('') }}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
            >
              <option value="">All Years</option>
              {academicYears.map((y) => (
                <option key={y.id} value={y.id}>{y.year_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Exam</label>
            <select
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
            >
              <option value="">Choose an exam...</option>
              {(selectedYearId ? exams.filter(e => e.academic_year_id === selectedYearId) : exams).map((exam) => (
                <option key={exam.id} value={exam.id}>
                  {exam.name} ({exam.exam_type})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Class</label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              disabled={!selectedExamId || filteredClasses.length === 0}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500 disabled:bg-gray-50 disabled:text-gray-400"
            >
              <option value="">Choose a class...</option>
              {filteredClasses.map((c) => (
                <option key={c.id} value={c.id}>{c.class_name}</option>
              ))}
            </select>
          </div>
        </div>
        {selectedExam && (
          <div className="mt-3 flex items-center gap-3 text-sm text-gray-500">
            <span>Status: <span className="font-medium text-gray-700">{selectedExam.status?.replace('_', ' ')}</span></span>
            {selectedExam.has_practical && (
              <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-xs font-medium">Has Practical</span>
            )}
            <span className="text-gray-300">|</span>
            <span>{students.length} students, {subjects.length} subjects</span>
          </div>
        )}
      </div>

      {loadingData && (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-3 border-gray-200 border-t-maroon-600 rounded-full animate-spin" />
        </div>
      )}

      {!loadingData && selectedClassId && subjects.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
          </svg>
          <p className="text-sm text-gray-500">No subjects found for this class.</p>
        </div>
      )}

      {!loadingData && selectedClassId && subjects.length > 0 && students.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <p className="text-sm text-gray-500">No students found for this class.</p>
        </div>
      )}

      {!loadingData && selectedClassId && subjects.length > 0 && students.length > 0 && !isProcessed && (
        <div className="bg-white rounded-xl border border-amber-200 p-10 text-center">
          <div className="w-14 h-14 mx-auto bg-amber-50 rounded-full flex items-center justify-center mb-4">
            <svg className="w-7 h-7 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Exam Not Yet Processed</h3>
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            Results are not available until this exam has been processed. Go to the{' '}
            <a href="/academic/exams" className="text-maroon-600 font-medium hover:underline">Exams</a>{' '}
            page and click <strong>"Process Results"</strong> for this exam to generate the report.
          </p>
        </div>
      )}

      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 8mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          aside, nav, header, .no-print, .no-print * { display: none !important; }
          .print-area { margin: 0 !important; padding: 0 !important; width: 100% !important; }
          .print-area .overflow-x-auto { overflow: visible !important; }
          .print-area table { font-size: 7pt !important; width: 100% !important; border-collapse: collapse !important; }
          .print-area th, .print-area td { padding: 1.5pt 2.5pt !important; border: 1px solid #ccc !important; }
          .print-area th { background: #f3f4f6 !important; font-weight: 600 !important; }
          .print-area [class*="sticky"] { position: static !important; }
          .print-area .rounded-xl { border: 1px solid #e5e7eb !important; border-radius: 0 !important; box-shadow: none !important; }
          .print-area .bg-green-50\\/40, .print-area .bg-red-50\\/40 { background: transparent !important; }
          .print-area h3 { font-size: 9pt !important; }
          .print-area h2 { font-size: 11pt !important; }
          .print-area .school-header { border-bottom: 2px solid #000 !important; margin-bottom: 6mm !important; }
          .print-area .school-header h1 { font-size: 14pt !important; }
          .print-area .school-header img { width: 32pt !important; height: 32pt !important; }
          .print-area .school-header .flex { display: flex !important; justify-content: center !important; align-items: center !important; gap: 8pt !important; }
          .print-area .stats-grid { display: flex !important; gap: 4pt !important; }
          .print-area .stats-grid > div { flex: 1 !important; text-align: center !important; padding: 3pt !important; border: 1px solid #ddd !important; }
          .print-area .stats-grid > div div:first-child { font-size: 12pt !important; font-weight: 700 !important; }
          .print-area .stats-grid > div div:last-child { font-size: 7pt !important; }
          .print-area .div-summary-wrap { display: flex !important; justify-content: center !important; }
          .print-area .div-summary-wrap > div { width: 100% !important; max-width: 400px !important; }
          .print-area .no-break { break-inside: avoid !important; page-break-inside: avoid !important; }
        }
      `}</style>

      {!loadingData && selectedClassId && subjects.length > 0 && students.length > 0 && isProcessed && (
        <div className="print-area">
          {selectedExam && (
            <div className="flex items-center justify-between mb-1 no-print">
              <div />
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrint}
                  className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25a2.25 2.25 0 01-2.25-2.25V9.456c0-1.081.768-2.015 1.837-2.175a48.048 48.048 0 011.913-.247m12.025-.467c0 .607-.541 1.1-1.2 1.1h-1.5c-.663 0-1.2-.493-1.2-1.1 0-.607.537-1.1 1.2-1.1h1.5c.659 0 1.2.493 1.2 1.1zm-2.4 0c0-.303-.27-.55-.6-.55s-.6.247-.6.55c0 .303.27.55.6.55s.6-.247.6-.55zM12 7.5h1.5M6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                  </svg>
                  Print
                </button>
                <button
                  onClick={handleExportExcel}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  Export Excel
                </button>
              </div>
            </div>
          )}

          {(() => {
            const className = classes.find(c => c.id === selectedClassId)?.class_name || ''
            const today = new Date().toLocaleDateString('en-TZ', { day: 'numeric', month: 'long', year: 'numeric' })
            const boys = students.filter(s => s.gender === 'Male').length
            const girls = students.filter(s => s.gender === 'Female').length
            const present = students.filter(s => marks.some(m => m.student_id === s.id && !m.is_absent)).length
            const absent = students.length - present
            const avg = studentsWithResults.filter(s => s.result?.average_marks != null)
            const classAvg = avg.length ? avg.reduce((s, st) => s + st.result.average_marks, 0) / avg.length : 0
            const classGradeObj = getGradeForPercentage(classAvg, grades)
            const pts = studentsWithResults.filter(s => s.points != null)
            const classGpa = pts.length ? pts.reduce((s, st) => s + st.points, 0) / pts.length : 0

            return (
              <>

                {/* School Header */}
                <div className="school-header mb-6 pb-4 border-b-2 border-gray-800">
                  <div className="flex items-center justify-center gap-4">
                    {schoolInfo?.national_logo_url && (
                      <img src={schoolInfo.national_logo_url} alt="National Logo" className="w-12 h-12 sm:w-14 sm:h-14 object-contain shrink-0" />
                    )}
                    <div className="text-center">
                      <h1 className="text-lg sm:text-xl font-bold uppercase text-gray-900">
                        {schoolInfo?.school_name || 'School Name'}
                      </h1>
                      <p className="text-xs sm:text-sm text-gray-600">{schoolInfo?.address || ''}</p>
                      {(schoolInfo?.region || schoolInfo?.district) && (
                        <p className="text-xs sm:text-sm text-gray-600">
                          {[schoolInfo?.region, schoolInfo?.district].filter(Boolean).join(' - ')}
                        </p>
                      )}
                      <p className="text-xs sm:text-sm text-gray-600">
                        {schoolInfo?.phone ? `Tel: ${schoolInfo.phone}` : ''}
                        {schoolInfo?.phone && schoolInfo?.email ? ' | ' : ''}
                        {schoolInfo?.email || ''}
                      </p>
                    </div>
                    {schoolInfo?.logo_url && (
                      <img src={schoolInfo.logo_url} alt="School Logo" className="w-12 h-12 sm:w-14 sm:h-14 object-contain shrink-0" />
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-3 text-left max-w-lg mx-auto">
                    <div>
                      <p className="text-sm"><span className="font-semibold">Exam:</span> {selectedExam?.name}</p>
                      <p className="text-sm"><span className="font-semibold">Class:</span> {className}</p>
                    </div>
                    <div>
                      <p className="text-sm"><span className="font-semibold">Date:</span> {today}</p>
                      <p className="text-sm"><span className="font-semibold">Type:</span> {selectedExam?.exam_type?.replace('_', ' ')}</p>
                    </div>
                  </div>
                </div>

                {/* Division Summary - Centered */}
                <div className="flex justify-center mb-6 no-break">
                  <div className="w-full max-w-md">
                    <DivisionSummary summary={divisionSummary} title="Division Summary" />
                  </div>
                </div>

                {/* Student Results Table */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
                  <div className="px-5 py-3 border-b border-gray-100">
                    <h3 className="text-sm font-semibold text-gray-800">Student Results</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-50">
                          <th className="text-center px-2 py-3 text-xs font-semibold text-gray-500 uppercase w-10">#</th>
                          <th className="text-left px-2 py-3 text-xs font-semibold text-gray-500 uppercase sticky left-0 bg-gray-50 z-10" style={{ minWidth: 130 }}>
                            Student Name
                          </th>
                          {subjects.map((subject) => {
                            const hp = subjectHasPractical(subject, selectedExam)
                            return hp ? (
                              <th key={subject.id} className="text-center px-1 py-3 text-xs font-semibold text-gray-500 uppercase" colSpan={2} style={{ minWidth: 90 }}>
                                <div>{subject.subject_code}</div>
                              </th>
                            ) : (
                              <th key={subject.id} className="text-center px-2 py-3 text-xs font-semibold text-gray-500 uppercase" style={{ minWidth: 60 }}>
                                <div>{subject.subject_code}</div>
                              </th>
                            )
                          })}
                          <th className="text-center px-1.5 py-3 text-xs font-semibold text-gray-500 uppercase" style={{ minWidth: 40 }}>Avg</th>
                          <th className="text-center px-1.5 py-3 text-xs font-semibold text-gray-500 uppercase" style={{ minWidth: 35 }}>Grd</th>
                          <th className="text-center px-1.5 py-3 text-xs font-semibold text-gray-500 uppercase" style={{ minWidth: 35 }}>Pos</th>
                          <th className="text-center px-1.5 py-3 text-xs font-semibold text-gray-500 uppercase" style={{ minWidth: 35 }}>Div</th>
                          <th className="text-center px-1.5 py-3 text-xs font-semibold text-gray-500 uppercase" style={{ minWidth: 35 }}>Pts</th>
                        </tr>
                        {anyPractical && (
                          <tr className="border-b border-gray-100 bg-gray-50/50">
                            <th className="px-2 py-1" />
                            <th className="px-3 py-1" />
                            {subjects.map((subject) => {
                              const hp = subjectHasPractical(subject, selectedExam)
                              return hp ? (
                                <React.Fragment key={subject.id}>
                                  <th className="text-center px-1 py-1 text-[10px] font-medium text-gray-400 uppercase">T</th>
                                  <th className="text-center px-1 py-1 text-[10px] font-medium text-gray-400 uppercase">P</th>
                                </React.Fragment>
                              ) : (
                                <th key={subject.id} className="text-center px-2 py-1 text-[10px] font-medium text-gray-400 uppercase">Mks</th>
                              )
                            })}
                            <th className="px-2 py-1" colSpan={5} />
                          </tr>
                        )}
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {sortedStudents.map((student) => {
                          const isTop = topSet.has(student.id)
                          const isBottom = bottomSet.has(student.id)
                          const rowBg = isTop ? 'bg-green-50/40' : isBottom ? 'bg-red-50/40' : ''
                          return (
                            <tr key={student.id} className={`${rowBg} hover:bg-gray-50 transition`}>
                              <td className="px-2 py-2 text-center text-sm text-gray-500 font-medium">{student.result?.position || '-'}</td>
                              <td className={`px-2 py-2 text-sm text-gray-900 sticky left-0 z-10 ${isTop ? 'bg-green-50/60' : isBottom ? 'bg-red-50/60' : 'bg-white/95'}`}>
                                <span className="font-medium whitespace-nowrap">{student.first_name} {student.surname}</span>
                              </td>
                              {subjects.map((subject) => {
                                const mark = markMap[`${student.id}_${subject.id}`]
                                const hp = subjectHasPractical(subject, selectedExam)
                                if (hp) {
                                  return (
                                    <React.Fragment key={subject.id}>
                                      <td className="px-1 py-2 text-center text-sm">
                                        {mark?.is_absent ? (
                                        <span className="text-amber-500 text-xs font-medium">Abs</span>
                                      ) : mark ? (
                                        <span className="text-gray-700">{mark.marks_obtained ?? '-'}</span>
                                      ) : (
                                        <span className="text-gray-300">-</span>
                                      )}
                                    </td>
                                    <td className="px-1 py-2 text-center text-sm">
                                      {mark?.is_absent ? (
                                        <span className="text-amber-500 text-xs font-medium">Abs</span>
                                        ) : mark ? (
                                          <span className="text-gray-700">{mark.practical_marks ?? '-'}</span>
                                        ) : (
                                          <span className="text-gray-300">-</span>
                                        )}
                                      </td>
                                    </React.Fragment>
                                  )
                                }
                                return (
                                  <td key={subject.id} className="px-2 py-2 text-center text-sm">
                                    {mark?.is_absent ? (
                                      <span className="text-amber-500 text-xs font-medium">Abs</span>
                                    ) : mark ? (
                                      <span className="text-gray-700">{mark.marks_obtained ?? '-'}</span>
                                    ) : (
                                      <span className="text-gray-300">-</span>
                                    )}
                                  </td>
                                )
                              })}
                              <td className="px-2 py-2 text-center text-sm font-medium text-gray-800">
                                {student.result?.average_marks != null ? student.result.average_marks : '-'}
                              </td>
                              <td className="px-2 py-2 text-center text-sm font-semibold text-gray-800">
                                {student.result?.grade || '-'}
                              </td>
                              <td className="px-2 py-2 text-center text-sm text-gray-600">
                                {student.result?.position != null ? student.result.position : '-'}
                              </td>
                              <td className="px-2 py-2 text-center text-sm font-medium text-gray-800">
                                {student.result?.division || '-'}
                              </td>
                              <td className="px-2 py-2 text-center text-sm font-semibold text-gray-800">
                                {student.points != null ? student.points : '-'}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Student Statistics */}
                <div className="flex justify-center mb-6 no-break">
                  <div className="w-full max-w-xl">
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      <div className="px-5 py-3 border-b border-gray-100">
                        <h3 className="text-sm font-semibold text-gray-800">Student Statistics</h3>
                      </div>
                      <div className="stats-grid grid grid-cols-5 gap-4 p-5">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-gray-900">{students.length}</div>
                          <div className="text-xs text-gray-500 uppercase tracking-wide">Registered</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-600">{boys}</div>
                          <div className="text-xs text-gray-500 uppercase tracking-wide">Boys</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-pink-600">{girls}</div>
                          <div className="text-xs text-gray-500 uppercase tracking-wide">Girls</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-600">{present}</div>
                          <div className="text-xs text-gray-500 uppercase tracking-wide">Present</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-amber-600">{absent}</div>
                          <div className="text-xs text-gray-500 uppercase tracking-wide">Absentees</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Class Performance */}
                <div className="flex justify-center mb-6 no-break">
                  <div className="w-full max-w-xl">
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      <div className="px-5 py-3 border-b border-gray-100">
                        <h3 className="text-sm font-semibold text-gray-800">Class Performance Summary</h3>
                      </div>
                      <div className="grid grid-cols-3 gap-4 p-5 text-center">
                        <div>
                          <div className="text-2xl font-bold text-gray-900">{classAvg.toFixed(1)}</div>
                          <div className="text-xs text-gray-500 uppercase tracking-wide">Class Average</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-indigo-600">{classGradeObj?.grade || '-'}</div>
                          <div className="text-xs text-gray-500 uppercase tracking-wide">Class Grade</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-purple-600">{classGpa.toFixed(1)}</div>
                          <div className="text-xs text-gray-500 uppercase tracking-wide">Class GPA</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Subject Grade Analysis */}
                <SubjectGradeMatrix subjects={subjects} matrix={subjectGradeMatrix} grades={grades} subjectAverages={subjectAverages} />

                {/* Top & Bottom Students */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6 no-break">
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-gray-100 bg-green-50/40">
                      <h3 className="text-sm font-semibold text-green-800">Top 10 Students</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="text-center px-2 py-2 text-[10px] font-semibold text-gray-500 uppercase w-8">#</th>
                            <th className="text-left px-2 py-2 text-[10px] font-semibold text-gray-500 uppercase">Name</th>
                            <th className="text-center px-2 py-2 text-[10px] font-semibold text-gray-500 uppercase">Avg</th>
                            <th className="text-center px-2 py-2 text-[10px] font-semibold text-gray-500 uppercase">Grd</th>
                            <th className="text-center px-2 py-2 text-[10px] font-semibold text-gray-500 uppercase">Div</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {sortedStudents.filter(s => s.result?.position != null).slice(0, 10).map(s => (
                            <tr key={s.id} className="hover:bg-gray-50 transition">
                              <td className="px-2 py-1.5 text-center text-xs text-gray-500 font-medium">{s.result.position}</td>
                              <td className="px-2 py-1.5 text-xs text-gray-900 font-medium">{s.first_name} {s.surname}</td>
                              <td className="px-2 py-1.5 text-center text-xs text-gray-800">{s.result.average_marks}</td>
                              <td className="px-2 py-1.5 text-center text-xs font-semibold text-gray-800">{s.result.grade}</td>
                              <td className="px-2 py-1.5 text-center text-xs text-gray-800">{s.result.division}</td>
                            </tr>
                          ))}
                          {sortedStudents.filter(s => s.result?.position != null).length === 0 && (
                            <tr><td colSpan={5} className="px-2 py-4 text-center text-xs text-gray-400">No data</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-gray-100 bg-red-50/40">
                      <h3 className="text-sm font-semibold text-red-800">Bottom 10 Students</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="text-center px-2 py-2 text-[10px] font-semibold text-gray-500 uppercase w-8">#</th>
                            <th className="text-left px-2 py-2 text-[10px] font-semibold text-gray-500 uppercase">Name</th>
                            <th className="text-center px-2 py-2 text-[10px] font-semibold text-gray-500 uppercase">Avg</th>
                            <th className="text-center px-2 py-2 text-[10px] font-semibold text-gray-500 uppercase">Grd</th>
                            <th className="text-center px-2 py-2 text-[10px] font-semibold text-gray-500 uppercase">Div</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {sortedStudents.filter(s => s.result?.position != null).slice(-10).reverse().map(s => (
                            <tr key={s.id} className="hover:bg-gray-50 transition">
                              <td className="px-2 py-1.5 text-center text-xs text-gray-500 font-medium">{s.result.position}</td>
                              <td className="px-2 py-1.5 text-xs text-gray-900 font-medium">{s.first_name} {s.surname}</td>
                              <td className="px-2 py-1.5 text-center text-xs text-gray-800">{s.result.average_marks}</td>
                              <td className="px-2 py-1.5 text-center text-xs font-semibold text-gray-800">{s.result.grade}</td>
                              <td className="px-2 py-1.5 text-center text-xs text-gray-800">{s.result.division}</td>
                            </tr>
                          ))}
                          {sortedStudents.filter(s => s.result?.position != null).length === 0 && (
                            <tr><td colSpan={5} className="px-2 py-4 text-center text-xs text-gray-400">No data</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </>
            )
          })()}
        </div>
      )}

      {!selectedClassId && (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.25a8.25 8.25 0 0116.5 0 8.25 8.25 0 01-16.5 0zm0 0a8.232 8.232 0 011.5 4.5c0 1.853.475 3.596 1.304 5.102a8.233 8.233 0 014.848-2.104m8.348 2.104a8.25 8.25 0 001.348-4.5c0-1.606-.461-3.107-1.254-4.374M9.75 11.25a2.25 2.25 0 100-4.5 2.25 2.25 0 000 4.5z" />
          </svg>
          <p className="text-sm text-gray-500">Select an exam and class above to view entered marks.</p>
        </div>
      )}
    </div>
  )
}

export default Results
