import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import * as XLSX from 'xlsx'
import domtoimage from 'dom-to-image-more'
import jsPDF from 'jspdf'
import Modal from '../../components/Modal'
import { useNotification } from '../../context/NotificationContext'

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
    if (pct >= g.min_mark) return g
  }
  return grades[grades.length - 1] || null
}

function getPointsForAverage(avg, grades) {
  if (avg === null || avg === undefined) return null
  for (const g of grades) {
    if (avg >= g.min_mark) return g.points
  }
  return grades[grades.length - 1]?.points ?? null
}

function calcDivision(totalPoints, level) {
  if (totalPoints <= 0) return '0'
  if (level === 'A_LEVEL') {
    if (totalPoints >= 3 && totalPoints <= 9) return 'I'
    if (totalPoints >= 10 && totalPoints <= 12) return 'II'
    if (totalPoints >= 13 && totalPoints <= 17) return 'III'
    if (totalPoints >= 18 && totalPoints <= 19) return 'IV'
    return '0'
  }
  if (totalPoints >= 7 && totalPoints <= 17) return 'I'
  if (totalPoints >= 18 && totalPoints <= 21) return 'II'
  if (totalPoints >= 22 && totalPoints <= 25) return 'III'
  if (totalPoints >= 26 && totalPoints <= 33) return 'IV'
  return '0'
}

const DIVS = [
  { key: 'I', label: 'I' },
  { key: 'II', label: 'II' },
  { key: 'III', label: 'III' },
  { key: 'IV', label: 'IV' },
  { key: '0', label: '0' },
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
                  {DIVS.find(d => d.key === r.division)?.label || r.division}
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
              <th className="text-center px-1.5 py-2 text-[10px] font-semibold text-gray-500 uppercase" style={{ minWidth: 24 }}>PSN</th>
              <th className="text-center px-1.5 py-2 text-[10px] font-semibold text-gray-500 uppercase" style={{ minWidth: 35 }}>GPA</th>
              <th className="text-center px-1.5 py-2 text-[10px] font-semibold text-gray-500 uppercase" style={{ minWidth: 35 }}>Grade</th>
              <th className="text-center px-1.5 py-2 text-[10px] font-semibold text-gray-500 uppercase" style={{ minWidth: 80 }}>Remarks</th>
            </tr>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="px-1.5 py-0.5 sticky left-0 bg-gray-50/50 z-10" />
              {gradeKeys.map(g => (
                <React.Fragment key={g}>
                  <th className="text-center px-0.5 py-0.5 text-[9px] font-medium text-gray-400 uppercase">B</th>
                  <th className="text-center px-0.5 py-0.5 text-[9px] font-medium text-gray-400 uppercase">G</th>
                </React.Fragment>
              ))}
              <th className="px-1.5 py-0.5" colSpan={4} />
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
                  <td className="px-1.5 py-1.5 text-center text-xs text-gray-500 font-medium">
                    {sa?.position || '-'}
                  </td>
                  <td className="px-1.5 py-1.5 text-center text-xs font-semibold text-gray-800">
                    {sa ? sa.avgPoints.toFixed(1) : '-'}
                  </td>
                  <td className="px-1.5 py-1.5 text-center text-xs font-semibold text-gray-800">
                    {sa?.grade || '-'}
                  </td>
                  <td className="px-1.5 py-1.5 text-center text-xs text-gray-600">
                    {sa?.remarks || '-'}
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

function injectHexColors(doc) {
  const s = doc.createElement('style')
  s.textContent = `
    :root {
      --color-gray-50: #f9fafb; --color-gray-100: #f3f4f6;
      --color-gray-200: #e5e7eb; --color-gray-300: #d1d5db;
      --color-gray-400: #9ca3af; --color-gray-500: #6b7280;
      --color-gray-600: #4b5563; --color-gray-700: #374151;
      --color-gray-800: #1f2937; --color-gray-900: #111827;
      --color-green-50: #f0fdf4; --color-green-100: #dcfce7;
      --color-green-200: #bbf7d0; --color-green-300: #86efac;
      --color-green-400: #4ade80; --color-green-500: #22c55e;
      --color-green-600: #16a34a; --color-green-700: #15803d;
      --color-green-800: #166534; --color-green-900: #14532d;
      --color-blue-50: #eff6ff; --color-blue-100: #dbeafe;
      --color-blue-200: #bfdbfe; --color-blue-300: #93c5fd;
      --color-blue-400: #60a5fa; --color-blue-500: #3b82f6;
      --color-blue-600: #2563eb; --color-blue-700: #1d4ed8;
      --color-blue-800: #1e40af; --color-blue-900: #1e3a8a;
      --color-red-50: #fef2f2; --color-red-100: #fee2e2;
      --color-red-200: #fecaca; --color-red-300: #fca5a5;
      --color-red-400: #f87171; --color-red-500: #ef4444;
      --color-red-600: #dc2626; --color-red-700: #b91c1c;
      --color-red-800: #991b1b; --color-red-900: #7f1d1d;
      --color-amber-50: #fffbeb; --color-amber-100: #fef3c7;
      --color-amber-200: #fde68a; --color-amber-300: #fcd34d;
      --color-amber-400: #fbbf24; --color-amber-500: #f59e0b;
      --color-amber-600: #d97706; --color-amber-700: #b45309;
      --color-amber-800: #92400e; --color-amber-900: #78350f;
      --color-indigo-50: #eef2ff; --color-indigo-100: #e0e7ff;
      --color-indigo-200: #c7d2fe; --color-indigo-300: #a5b4fc;
      --color-indigo-400: #818cf8; --color-indigo-500: #6366f1;
      --color-indigo-600: #4f46e5; --color-indigo-700: #4338ca;
      --color-indigo-800: #3730a3; --color-indigo-900: #312e81;
      --color-purple-50: #faf5ff; --color-purple-100: #f3e8ff;
      --color-purple-200: #e9d5ff; --color-purple-300: #d8b4fe;
      --color-purple-400: #c084fc; --color-purple-500: #a855f7;
      --color-purple-600: #9333ea; --color-purple-700: #7e22ce;
      --color-purple-800: #6b21a8; --color-purple-900: #581c87;
      --color-emerald-50: #ecfdf5; --color-emerald-100: #d1fae5;
      --color-emerald-200: #a7f3d0; --color-emerald-300: #6ee7b7;
      --color-emerald-400: #34d399; --color-emerald-500: #10b981;
      --color-emerald-600: #059669; --color-emerald-700: #047857;
      --color-emerald-800: #065f46; --color-emerald-900: #064e3b;
      --color-maroon-50: #fdf2f3; --color-maroon-100: #fde8e9;
      --color-maroon-200: #fbd0d4; --color-maroon-300: #f7a9b0;
      --color-maroon-400: #f27a86; --color-maroon-500: #e84c5c;
      --color-maroon-600: #b91c3b; --color-maroon-700: #99152e;
      --color-maroon-800: #7a1224; --color-maroon-900: #3f0d12;
    }
  `
  doc.head.appendChild(s)
}

async function generatePDF(element, filename) {
  const canvas = await domtoimage.toCanvas(element, {
    scale: 2,
    bgcolor: '#ffffff',
    style: {
      overflow: 'visible',
      height: 'auto',
      width: element.scrollWidth + 'px',
    },
    onclone: (node) => {
      const doc = node.ownerDocument
      injectHexColors(doc)
      const imgs = doc.querySelectorAll('img')
      imgs.forEach(img => { img.crossOrigin = 'anonymous' })
    },
  })
  const imgData = canvas.toDataURL('image/jpeg', 0.95)
  const pdf = new jsPDF('l', 'mm', 'a4')
  const pdfWidth = pdf.internal.pageSize.getWidth()
  const pdfHeight = pdf.internal.pageSize.getHeight()
  const margin = 8
  const usableWidth = pdfWidth - margin * 2
  const usableHeight = pdfHeight - margin * 2
  const canvasWidth = canvas.width
  const canvasHeight = canvas.height
  const ratio = usableWidth / canvasWidth
  const scaledHeight = canvasHeight * ratio
  let heightLeft = scaledHeight
  let position = margin
  pdf.addImage(imgData, 'JPEG', margin, position, usableWidth, scaledHeight)
  heightLeft -= usableHeight
  while (heightLeft > 0) {
    position = margin - (usableHeight * Math.ceil((scaledHeight - heightLeft) / usableHeight))
    pdf.addPage()
    pdf.addImage(imgData, 'JPEG', margin, position, usableWidth, scaledHeight)
    heightLeft -= usableHeight
  }
  pdf.save(`${filename}.pdf`)
}

function Results() {
  const { showToast } = useNotification()
  const [searchParams] = useSearchParams()
  const examIdParam = searchParams.get('examId')

  const printRef = useRef(null)
  const [generatingPDF, setGeneratingPDF] = useState(false)

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
  const [reprocessConfirm, setReprocessConfirm] = useState(false)
  const [reprocessing, setReprocessing] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const [eRes, cRes, stRes, schRes, yRes] = await Promise.all([
        supabase.from('exams').select('*').order('created_at', { ascending: false }),
        supabase.from('classes').select('*').order('sort_order'),
        supabase.from('exam_classes').select('*'),
        supabase.from('school_settings').select('*').limit(1),
        supabase.from('academic_years').select('*').order('year_name', { ascending: false }),
      ])
      if (eRes.data) setExams(eRes.data)
      if (cRes.data) setClasses(cRes.data)
      if (stRes.data) setExamClasses(stRes.data)
      if (schRes.data && schRes.data.length > 0) {
        setSchoolInfo(schRes.data[0])
        document.title = schRes.data[0].school_name || 'Kizaga RMS'
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

          // First, find students in the selected class (handling streams)
          const { data: byJoin } = await supabase
            .from('students')
            .select('*, class_streams!inner(*)')
            .eq('class_streams.class_id', selectedClassId)
            .order('surname')
          
          let classStudents = []
          if (byJoin?.length > 0) {
            classStudents = byJoin.map(s => { const { class_streams: _, ...rest } = s; return rest })
          }

          if (classStudents.length > 0) {
            const classStudentIds = classStudents.map(s => s.id)
            const { data: mData } = await supabase
              .from('marks')
              .select('*')
              .eq('exam_id', selectedExamId)
              .in('subject_id', subjectIds)
              .in('student_id', classStudentIds)
            loadedMarks = mData || []
            loadedStudents = classStudents

            const srRes = await supabase
              .from('student_results')
              .select('*')
              .eq('exam_id', selectedExamId)
              .in('student_id', classStudentIds)
            loadedResults = srRes.data || []
          }

          // Fallback: no students found via class — pull from marks directly
          if (loadedStudents.length === 0) {
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
  }, [selectedExamId, selectedClassId, classes, reloadToken])

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

  const classLevel = useMemo(() => {
    const cls = classes.find(c => c.id === selectedClassId)
    return cls?.level || 'O_LEVEL'
  }, [classes, selectedClassId])

  const studentsWithResults = useMemo(() => {
    const BEST_N = classLevel === 'A_LEVEL' ? 3 : 7
    return students.map(student => {
      const result = resultsMap[student.id] || null
      const allPoints = []
      subjects.forEach(subject => {
        if (classLevel === 'A_LEVEL' && subject.subject_type === 'ELECTIVE') return
        const mark = markMap[`${student.id}_${subject.id}`]
        const hasPrac = subjectHasPractical(subject, selectedExam)
        const pct = getMarkPercentage(mark, hasPrac)
        if (pct !== null) {
          const gradeObj = getGradeForPercentage(pct, grades)
          if (gradeObj?.points != null) {
            allPoints.push(gradeObj.points)
          }
        }
      })
      allPoints.sort((a, b) => a - b)
      const bestPoints = allPoints.slice(0, BEST_N)
      const totalPoints = bestPoints.reduce((s, p) => s + p, 0)
      const points = bestPoints.length > 0 ? totalPoints : null
      const division = points ? calcDivision(points, classLevel) : '0'
      return { ...student, result, points, division }
    })
  }, [students, resultsMap, grades, subjects, markMap, selectedExam, classLevel])

  const divisionSummary = useMemo(() => {
    const rows = DIVS.map(d => ({ division: d.key, boys: 0, girls: 0, total: 0 }))
    let totalBoys = 0, totalGirls = 0
    studentsWithResults.forEach(s => {
      const div = s.division || (s.result?.division || 'Division 0').replace('Division ', '')
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
    const withAvg = subjects.map(subject => {
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
      return { subject, avgPercentage: avgPct, avgPoints: avgPts, grade: gradeObj?.grade || '-', remarks: gradeObj?.remarks || '-' }
    })
    const sorted = [...withAvg].sort((a, b) => a.avgPoints - b.avgPoints || b.avgPercentage - a.avgPercentage)
    sorted.forEach((s, i) => s.position = i + 1)
    return withAvg
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
  const canReprocess = selectedExam && ['processed', 'published'].includes(selectedExam.status)

  const handleReprocess = useCallback(async () => {
    if (!selectedExam) return
    setReprocessing(true)
    try {
      const { error } = await supabase.rpc('process_exam', { p_exam_id: selectedExam.id })
      if (error) throw error
      setReprocessConfirm(false)
      setReloadToken(t => t + 1)
      showToast('Results reprocessed successfully', 'success')
    } catch (err) {
      console.error('Reprocess error:', err)
      showToast('Failed to reprocess. ' + (err.message || ''), 'error')
    } finally {
      setReprocessing(false)
    }
  }, [selectedExam, showToast])

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
        `${student.first_name} ${student.middle_name || ''} ${student.surname}`.replace(/\s+/g, ' ').trim(),
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
      row.push((student.result?.division || '').replace('Division ', '') || '-')
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

  const handleDownloadPDF = useCallback(async () => {
    setGeneratingPDF(true)
    try {
      const selectedClass = classes.find(c => c.id === selectedClassId)
      const examName = selectedExam?.name || 'results'
      const className = selectedClass?.class_name || ''
      const filename = `${examName.replace(/[^a-zA-Z0-9]/g, '_')}_${className.replace(/[^a-zA-Z0-9]/g, '_')}_results`
      await generatePDF(printRef.current, filename)
    } catch (err) {
      console.error('PDF generation error:', err)
      showToast('Failed to generate PDF. ' + (err.message || ''), 'error')
    } finally {
      setGeneratingPDF(false)
    }
  }, [selectedExam, selectedClassId, classes, showToast])

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
        <h1 className="text-3xl font-bold text-gray-900">View Results</h1>
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
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <span>Status: <span className="font-medium text-gray-700">{selectedExam.status?.replace('_', ' ')}</span></span>
              {selectedExam.has_practical && (
                <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-xs font-medium">Has Practical</span>
              )}
              <span className="text-gray-300">|</span>
              <span>{students.length} students, {subjects.length} subjects</span>
            </div>
            {canReprocess && selectedClassId && (
              <button
                type="button"
                disabled={reprocessing || loadingData}
                onClick={() => setReprocessConfirm(true)}
                className="px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition disabled:opacity-50"
              >
                {reprocessing ? 'Reprocessing...' : 'Reprocess Results'}
              </button>
            )}
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
          @page { size: A4 landscape; margin: 12mm 8mm 16mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          body, html, #root, .h-screen, main, .overflow-y-auto, .overflow-x-auto { height: auto !important; min-height: 0 !important; overflow: visible !important; }
          aside, nav, header, .no-print, .no-print * { display: none !important; }
          .print-area { margin: 0 !important; padding: 0 !important; width: 100% !important; }
          .print-area .overflow-x-auto { overflow: visible !important; display: block !important; }
          .print-area .overflow-hidden { overflow: visible !important; }
          .print-area .grid-cols-1 > div { overflow: visible !important; }
          .print-area .grid-cols-1 > div > div { overflow: visible !important; }
          .print-area table { font-size: 5.5pt !important; width: 100% !important; border-collapse: collapse !important; page-break-inside: auto !important; }
          .print-area thead { display: table-header-group !important; }
          .print-area tbody { display: table-row-group !important; }
          .print-area tr { page-break-inside: avoid !important; }
          .print-area th, .print-area td { padding: 0.5pt 1.5pt !important; border: 1px solid #ccc !important; min-width: 0 !important; }
          .print-area th { background: #f3f4f6 !important; font-weight: 600 !important; }
          .print-area [class*="sticky"] { position: static !important; }
          .print-area .rounded-xl { border: 1px solid #e5e7eb !important; border-radius: 0 !important; box-shadow: none !important; }
          .print-area .bg-green-50\\/40, .print-area .bg-red-50\\/40 { background: transparent !important; }
          .print-area h3 { font-size: 8pt !important; }
          .print-area h2 { font-size: 10pt !important; }
          .print-area .school-header { border-bottom: 2px solid #000 !important; margin-bottom: 3mm !important; }
          .print-area .school-header h1 { font-size: 16pt !important; }
          .print-area .school-header p { font-size: 9pt !important; }
          .print-area .school-header img { width: 20pt !important; height: 20pt !important; }
          .print-area .school-header .flex { display: flex !important; justify-content: center !important; align-items: center !important; gap: 4pt !important; }
          .print-area .school-header > div:last-child { margin-top: 2pt !important; padding-top: 2pt !important; }
          .print-area .stats-grid { display: flex !important; gap: 2pt !important; }
          .print-area .stats-grid > div { flex: 1 !important; text-align: center !important; padding: 1.5pt !important; border: 1px solid #ddd !important; }
          .print-area .stats-grid > div div:first-child { font-size: 9pt !important; font-weight: 700 !important; }
          .print-area .stats-grid > div div:last-child { font-size: 5.5pt !important; }
          .print-area .div-summary-wrap { display: flex !important; justify-content: center !important; }
          .print-area .div-summary-wrap > div { width: 100% !important; max-width: 400px !important; }
          .print-area .no-break { break-inside: avoid !important; page-break-inside: avoid !important; }

          .print-area .grid-cols-1 { display: block !important; }
          .print-area .grid-cols-1 > div { display: inline-block !important; width: calc(50% - 6pt) !important; vertical-align: top !important; }
          .print-area .grid-cols-1 > div:first-child { margin-right: 12pt !important; }
        }
      `}</style>

      <Modal
        isOpen={reprocessConfirm}
        onClose={reprocessing ? null : () => setReprocessConfirm(false)}
        title={reprocessing ? 'Reprocessing...' : 'Reprocess Results'}
      >
        {reprocessing ? (
          <div className="text-center py-6">
            <div className="w-10 h-10 border-3 border-gray-200 border-t-maroon-600 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-gray-600">Recalculating grades, divisions, and rankings...</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-600 mb-6">
              This will recalculate grades, divisions, and rankings for all students in{' '}
              <strong>{selectedExam?.name}</strong>. Use this if divisions or points look incorrect.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setReprocessConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReprocess}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition"
              >
                Reprocess Now
              </button>
            </div>
          </>
        )}
      </Modal>

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
                <button
                  onClick={handleDownloadPDF}
                  disabled={generatingPDF}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {generatingPDF ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                  )}
                  {generatingPDF ? 'Generating...' : 'Download PDF'}
                </button>
              </div>
            </div>
          )}

          <div ref={printRef}>
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
            const classGpa = pts.length ? pts.reduce((s, st) => s + (st.points / 7), 0) / pts.length : 0

            return (
              <>

                {/* School Header */}
                <div className="school-header mb-6 border-b-2 border-gray-800 pb-4">
                  <div className="flex items-start justify-between">
                    <div className="w-16 shrink-0 pt-1">
                      {schoolInfo?.national_logo_url && (
                        <img src={schoolInfo.national_logo_url} alt="" className="w-14 h-14 object-contain" />
                      )}
                    </div>
                    <div className="text-center flex-1 px-4">
                      <h1 className="text-xl font-bold uppercase text-gray-900 tracking-wide">
                        {schoolInfo?.school_name || 'School Name'}
                      </h1>
                      <p className="text-sm font-semibold text-gray-800 mt-1">
                        {selectedExam?.name?.toUpperCase() || '...'} EXAMINATION RESULTS
                      </p>
                      <p className="text-xs text-gray-600 mt-0.5">{schoolInfo?.address || ''}</p>
                      {(schoolInfo?.region || schoolInfo?.district) && (
                        <p className="text-xs text-gray-600">
                          {[schoolInfo?.region, schoolInfo?.district].filter(Boolean).join(' - ')}
                        </p>
                      )}
                      <div className="flex items-center justify-center gap-3 text-xs text-gray-600 mt-0.5">
                        {schoolInfo?.phone && <span>Tel: {schoolInfo.phone}</span>}
                        {schoolInfo?.phone && schoolInfo?.email && <span className="text-gray-300">|</span>}
                        {schoolInfo?.email && <span>{schoolInfo.email}</span>}
                      </div>
                    </div>
                    <div className="w-16 shrink-0 pt-1 flex justify-end">
                      {schoolInfo?.logo_url && (
                        <img src={schoolInfo.logo_url} alt="" className="w-14 h-14 object-contain" />
                      )}
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-300">
                    <div className="flex items-center justify-center gap-8 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-700">Class:</span>
                        <span className="text-gray-900">{className}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-700">Date:</span>
                        <span className="text-gray-900">{today}</span>
                      </div>
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
                                <span className="font-medium whitespace-nowrap">{student.first_name} {student.middle_name} {student.surname}</span>
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
                                {(student.result?.division || '').replace('Division ', '') || '-'}
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
                              <td className="px-2 py-1.5 text-xs text-gray-900 font-medium">{s.first_name} {s.middle_name} {s.surname}</td>
                              <td className="px-2 py-1.5 text-center text-xs text-gray-800">{s.result.average_marks}</td>
                              <td className="px-2 py-1.5 text-center text-xs font-semibold text-gray-800">{s.result.grade}</td>
                              <td className="px-2 py-1.5 text-center text-xs text-gray-800">{(s.result.division || '').replace('Division ', '') || '-'}</td>
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
                              <td className="px-2 py-1.5 text-xs text-gray-900 font-medium">{s.first_name} {s.middle_name} {s.surname}</td>
                              <td className="px-2 py-1.5 text-center text-xs text-gray-800">{s.result.average_marks}</td>
                              <td className="px-2 py-1.5 text-center text-xs font-semibold text-gray-800">{s.result.grade}</td>
                              <td className="px-2 py-1.5 text-center text-xs text-gray-800">{(s.result.division || '').replace('Division ', '') || '-'}</td>
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
