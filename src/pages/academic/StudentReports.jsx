import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import domtoimage from 'dom-to-image-more'
import jsPDF from 'jspdf'

const SCIENCE_SUBJECTS = ['BIO', 'CHEM', 'PHY', 'BIOS', 'BIO_O', 'CHEM_O', 'PHY_O']

function subjectHasPractical(subject, exam) {
  if (!exam?.has_practical) return false
  return subject?.has_practical || SCIENCE_SUBJECTS.includes(subject?.subject_code)
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

function getMarkTotal(mark, hp) {
  if (!mark || mark.is_absent) return { theory: null, practical: null, total: null }
  const theory = mark.marks_obtained ?? 0
  const practical = hp ? (mark.practical_marks ?? 0) : 0
  return { theory, practical, total: theory + practical }
}

function computeCombinedMark(mark, hp) {
  const t = getMarkTotal(mark, hp)
  const max = hp ? 150 : 100
  const pct = t.total != null ? (t.total / max) * 100 : null
  return { ...t, max, pct }
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

async function generatePDF(element, filename, orientation = 'p') {
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
  const pdf = new jsPDF(orientation, 'mm', 'a4')
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

const printStyles = `
  @media print {
    @page { margin: 12mm 8mm 16mm; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    html, body { overflow: visible !important; height: auto !important; }
    .no-print { display: none !important; }
    .print-only { display: block !important; }
    .print-area { overflow: visible !important; height: auto !important; }
    .print-area table { font-size: 9pt !important; }
    .print-area th, .print-area td { padding: 3pt 4pt !important; }
  }
`

function StudentReports() {
  const reportRef = useRef(null)
  const bulkContainerRef = useRef(null)

  const [generatingPDF, setGeneratingPDF] = useState(false)
  const [generatingBulkPDF, setGeneratingBulkPDF] = useState(false)

  const [mode, setMode] = useState('single')

  const [exams, setExams] = useState([])
  const [selectedExamId, setSelectedExamId] = useState('')
  const [selectedExam, setSelectedExam] = useState(null)
  const [selectedExam2Id, setSelectedExam2Id] = useState('')
  const [selectedExam2, setSelectedExam2] = useState(null)

  const [academicYears, setAcademicYears] = useState([])
  const [selectedYearId, setSelectedYearId] = useState('')
  const [selectedYear2Id, setSelectedYear2Id] = useState('')

  const [examClasses, setExamClasses] = useState([])
  const [classes, setClasses] = useState([])
  const [selectedClassId, setSelectedClassId] = useState('')

  const [subjects, setSubjects] = useState([])
  const [students, setStudents] = useState([])
  const [marks, setMarks] = useState([])
  const [marks2, setMarks2] = useState([])
  const [studentResults, setStudentResults] = useState([])
  const [grades, setGrades] = useState([])
  const [schoolInfo, setSchoolInfo] = useState(null)

  const [selectedStudent, setSelectedStudent] = useState(null)
  const [bulkStudents, setBulkStudents] = useState([])
  const [activeTab, setActiveTab] = useState('list')

  const [loading, setLoading] = useState(true)
  const [loadingData, setLoadingData] = useState(false)

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
      if (schRes.data && schRes.data.length > 0) setSchoolInfo(schRes.data[0])
      if (yRes.data) setAcademicYears(yRes.data)
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    if (!selectedExamId) { setSelectedExam(null); return }
    setSelectedExam(exams.find(e => e.id === selectedExamId) || null)
  }, [selectedExamId, exams])

  useEffect(() => {
    if (!selectedExam2Id) { setSelectedExam2(null); return }
    setSelectedExam2(exams.find(e => e.id === selectedExam2Id) || null)
  }, [selectedExam2Id, exams])

  const resetSelections = useCallback(() => {
    setSelectedClassId('')
    setSelectedStudent(null)
    setStudents([])
    setMarks([])
    setMarks2([])
    setStudentResults([])
    setGrades([])
    setActiveTab('list')
  }, [])

  const activeExamIds = useMemo(() => {
    if (mode === 'single') return selectedExamId ? [selectedExamId] : []
    const ids = []
    if (selectedExamId) ids.push(selectedExamId)
    if (selectedExam2Id) ids.push(selectedExam2Id)
    return ids
  }, [mode, selectedExamId, selectedExam2Id])

  const classIdsForExams = useMemo(() => {
    if (activeExamIds.length === 0) return []
    const sets = activeExamIds.map(eid =>
      new Set(examClasses.filter(ec => ec.exam_id === eid).map(ec => ec.class_id))
    )
    const common = classes.filter(c => sets.every(s => s.has(c.id)))
    return common.map(c => c.id)
  }, [activeExamIds, examClasses, classes])

  const filteredClasses = useMemo(() => {
    return classes.filter(c => classIdsForExams.includes(c.id))
  }, [classes, classIdsForExams])

  const selectedStudentResult = useMemo(() => {
    if (!selectedStudent) return null
    return studentResults.find(sr => sr.student_id === selectedStudent.id) || null
  }, [selectedStudent, studentResults])

  useEffect(() => {
    if (!selectedClassId || activeExamIds.length === 0) {
      setSubjects([])
      setStudents([])
      setMarks([])
      setMarks2([])
      setStudentResults([])
      setGrades([])
      setSelectedStudent(null)
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
        let loadedMarks2 = []
        let loadedResults = []

        if (assignedSubjects.length > 0) {
          const subjectIds = assignedSubjects.map(s => s.id)
          const queries = []
          for (const eid of activeExamIds) {
            queries.push(
              supabase.from('marks').select('*').eq('exam_id', eid).in('subject_id', subjectIds)
            )
            queries.push(
              supabase.from('student_results').select('*').eq('exam_id', eid)
            )
          }

          const res = await Promise.all(queries)
          const mData = []
          const srData = []
          for (let i = 0; i < activeExamIds.length; i++) {
            const marksIdx = i * 2
            const srIdx = i * 2 + 1
            if (res[marksIdx]?.data) mData.push(...res[marksIdx].data.map(m => ({ ...m, _exam_idx: i })))
            if (res[srIdx]?.data) srData.push(...res[srIdx].data)
          }

          loadedMarks = mData.filter(m => m._exam_idx === 0)
          loadedMarks2 = activeExamIds.length > 1 ? mData.filter(m => m._exam_idx === 1) : []
          loadedResults = srData

          const studentIdsFromMarks = [...new Set(mData.map(m => m.student_id))]

          if (studentIdsFromMarks.length > 0) {
            const { data: sData } = await supabase
              .from('students')
              .select('*')
              .in('id', studentIdsFromMarks)
              .order('surname')
            loadedStudents = sData || []
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
                loadedStudents = byJoin.map(s => { const { class_streams, ...rest } = s; return rest })
              }
            }
          }
        }

        setStudents(loadedStudents)
        setMarks(loadedMarks)
        setMarks2(loadedMarks2)
        setStudentResults(loadedResults)
      } catch (err) {
        console.error('Load data error:', err)
      } finally {
        setLoadingData(false)
      }
    }
    loadData()
  }, [selectedClassId, activeExamIds, classes])

  const markMap = useMemo(() => {
    const map = {}
    marks.forEach(m => { map[`${m.student_id}_${m.subject_id}`] = m })
    return map
  }, [marks])

  const markMap2 = useMemo(() => {
    const map = {}
    marks2.forEach(m => { map[`${m.student_id}_${m.subject_id}`] = m })
    return map
  }, [marks2])

  const sortedStudents = useMemo(() => {
    const resultMap = {}
    studentResults.forEach(sr => { resultMap[sr.student_id] = sr })

    const withRank = students.map(s => ({ ...s, result: resultMap[s.id] || null }))
      .filter(s => s.result?.position != null)
      .sort((a, b) => a.result.position - b.result.position)
    const withoutRank = students.map(s => ({ ...s, result: resultMap[s.id] || null }))
      .filter(s => !s.result?.position)
    return [...withRank, ...withoutRank]
  }, [students, studentResults])

  const isProcessed = mode === 'single'
    ? selectedExam && ['processed', 'published', 'locked'].includes(selectedExam.status)
    : selectedExam && selectedExam2
      && ['processed', 'published', 'locked'].includes(selectedExam.status)
      && ['processed', 'published', 'locked'].includes(selectedExam2.status)

  const handleViewReport = useCallback((student) => {
    setSelectedStudent(student)
    setActiveTab('report')
  }, [])

  const handleBack = useCallback(() => {
    setSelectedStudent(null)
    setActiveTab('list')
  }, [])

  const handleDownloadPDF = useCallback(async () => {
    if (!selectedStudent) return
    setGeneratingPDF(true)
    try {
      const name = `${selectedStudent.first_name} ${selectedStudent.middle_name || ''} ${selectedStudent.surname}`.replace(/\s+/g, ' ').trim()
      const filename = `${name.replace(/[^a-zA-Z0-9]/g, '_')}_report`
      await generatePDF(reportRef.current, filename)
    } catch (err) {
      console.error('PDF generation error:', err)
    } finally {
      setGeneratingPDF(false)
    }
  }, [selectedStudent])

  const handleDownloadClassPDF = useCallback(() => {
    const studentList = mode === 'single'
      ? sortedStudents.filter(s => s.result?.position != null)
      : sortedStudents
    if (studentList.length === 0) {
      alert('No students with results found for this class.')
      return
    }
    setGeneratingBulkPDF('Preparing...')
    setBulkStudents(studentList)
  }, [sortedStudents, mode])

  useEffect(() => {
    if (bulkStudents.length === 0 || generatingBulkPDF === false) return
    const run = async () => {
      try {
        for (let i = 0; i < bulkStudents.length; i++) {
          const student = bulkStudents[i]
          const name = `${student.first_name} ${student.middle_name || ''} ${student.surname}`.replace(/\s+/g, ' ').trim()
          const filename = `${name.replace(/[^a-zA-Z0-9]/g, '_')}_report`
          setGeneratingBulkPDF(`Generating ${i + 1} of ${bulkStudents.length}...`)
          await generatePDF(bulkContainerRef.current.children[i], filename)
        }
      } catch (err) {
        console.error('Bulk PDF generation error:', err)
      } finally {
        setGeneratingBulkPDF(false)
        setBulkStudents([])
      }
    }
    const timer = setTimeout(run, 500)
    return () => clearTimeout(timer)
  }, [bulkStudents, generatingBulkPDF])

  const combinedStudentData = useMemo(() => {
    if (mode !== 'combined' || !selectedStudent) return null
    const classLevel = classes.find(c => c.id === selectedClassId)?.level || 'O_LEVEL'

    const entries = subjects.map(subject => {
      const mark1 = markMap[`${selectedStudent.id}_${subject.id}`]
      const mark2 = markMap2[`${selectedStudent.id}_${subject.id}`]
      const hp1 = subjectHasPractical(subject, selectedExam)
      const hp2 = subjectHasPractical(subject, selectedExam2)
      const c1 = computeCombinedMark(mark1, hp1)
      const c2 = computeCombinedMark(mark2, hp2)
      const combinedTotal = (c1.total ?? 0) + (c2.total ?? 0)
      const combinedMax = c1.max + c2.max
      const pct = combinedMax > 0 ? (combinedTotal / combinedMax) * 100 : null
      const gradeObj = pct != null ? getGradeForPercentage(pct, grades) : null
      return {
        subject,
        exam1Total: c1.total, exam1Pct: c1.pct,
        exam2Total: c2.total, exam2Pct: c2.pct,
        combinedTotal, combinedPct: pct,
        gradeObj,
        isAbsent1: !mark1 || mark1.is_absent,
        isAbsent2: !mark2 || mark2.is_absent,
      }
    })

    const valid = entries.filter(e => e.combinedPct != null)
    const totalPct = valid.reduce((s, e) => s + e.combinedPct, 0)
    const avgPct = valid.length > 0 ? totalPct / valid.length : null
    const overallGrade = getGradeForPercentage(avgPct, grades)
    const totalMarks = entries.reduce((s, e) => s + (e.combinedTotal || 0), 0)

    // For A-Level: only COMPULSORY/PRINCIPAL subjects count toward division points
    const principalValid = classLevel === 'A_LEVEL'
      ? valid.filter(e => e.subject.subject_type !== 'ELECTIVE')
      : valid

    const allPoints = principalValid.map(e => e.gradeObj?.points || 0).filter(p => p > 0)
    allPoints.sort((a, b) => a - b)
    const bestN = classLevel === 'A_LEVEL' ? 3 : 7
    const bestPoints = allPoints.slice(0, bestN)
    const totalPoints = bestPoints.reduce((s, p) => s + p, 0)

    let division = '0'
    if (totalPoints > 0) {
      if (classLevel === 'A_LEVEL') {
        if (totalPoints >= 3 && totalPoints <= 9) division = 'I'
        else if (totalPoints >= 10 && totalPoints <= 12) division = 'II'
        else if (totalPoints >= 13 && totalPoints <= 17) division = 'III'
        else if (totalPoints >= 18 && totalPoints <= 19) division = 'IV'
      } else {
        if (totalPoints >= 7 && totalPoints <= 17) division = 'I'
        else if (totalPoints >= 18 && totalPoints <= 21) division = 'II'
        else if (totalPoints >= 22 && totalPoints <= 25) division = 'III'
        else if (totalPoints >= 26 && totalPoints <= 33) division = 'IV'
      }
    }

    return { entries, avgPct, gradeObj: overallGrade, pts: totalPoints, totalMarks, division, validCount: principalValid.length }
  }, [mode, selectedStudent, subjects, markMap, markMap2, selectedExam, selectedExam2, grades, classes, selectedClassId])

  const ReportCard = useCallback(({ student, isBulk }) => {
    const s = student
    const sr = mode === 'single' ? studentResults.find(r => r.student_id === s.id) || null : null

    return (
      <div
        className="bg-white border border-gray-200 overflow-hidden"
        style={{ fontFamily: 'Arial, sans-serif', pageBreakAfter: 'always' }}
      >
        <div className="px-6 pt-6 pb-3 border-b-2 border-gray-800 text-center">
          <div className="flex items-center justify-center gap-4 mb-2">
            {schoolInfo?.national_logo_url && (
              <img src={schoolInfo.national_logo_url} alt="" className="w-14 h-14 object-contain" crossOrigin="anonymous" />
            )}
            <div>
              <h1 className="text-lg font-bold uppercase text-gray-900 tracking-wide">
                {schoolInfo?.school_name || 'School Name'}
              </h1>
              <p className="text-xs text-gray-600">{schoolInfo?.address || ''}</p>
              {(schoolInfo?.region || schoolInfo?.district) && (
                <p className="text-xs text-gray-600">
                  {[schoolInfo?.region, schoolInfo?.district].filter(Boolean).join(' - ')}
                </p>
              )}
              <p className="text-xs text-gray-600">
                {schoolInfo?.phone ? `Tel: ${schoolInfo.phone}` : ''}
                {schoolInfo?.phone && schoolInfo?.email ? ' | ' : ''}
                {schoolInfo?.email || ''}
              </p>
            </div>
            {schoolInfo?.logo_url && (
              <img src={schoolInfo.logo_url} alt="" className="w-14 h-14 object-contain" crossOrigin="anonymous" />
            )}
          </div>
          <h2 className="text-base font-bold uppercase text-gray-800 tracking-wider">
            {mode === 'combined' ? 'Combined Report Card' : 'Student Report Card'}
          </h2>
          {mode === 'combined' && (
            <p className="text-xs text-gray-600">{selectedExam?.name} + {selectedExam2?.name}</p>
          )}
        </div>

        <div className="px-6 py-3 border-b border-gray-200">
          <table className="w-full text-xs">
            <tbody>
              <tr>
                <td className="py-0.5 w-36"><span className="font-semibold text-gray-700">Student Name:</span></td>
                <td className="py-0.5 w-52">
                  <span className="text-gray-900 font-medium">
                    {s.first_name} {s.middle_name || ''} {s.surname}
                  </span>
                </td>
                <td className="py-0.5 w-36"><span className="font-semibold text-gray-700">Admission No:</span></td>
                <td className="py-0.5">
                  <span className="text-gray-900 font-mono">{s.admission_number}</span>
                </td>
              </tr>
              <tr>
                <td className="py-0.5"><span className="font-semibold text-gray-700">Gender:</span></td>
                <td className="py-0.5"><span className="text-gray-900">{s.gender}</span></td>
                <td className="py-0.5"><span className="font-semibold text-gray-700">Class:</span></td>
                <td className="py-0.5">
                  <span className="text-gray-900">{classes.find(c => c.id === selectedClassId)?.class_name || ''}</span>
                </td>
              </tr>
              <tr>
                <td className="py-0.5"><span className="font-semibold text-gray-700">Date of Birth:</span></td>
                <td className="py-0.5">
                  <span className="text-gray-900">
                    {s.date_of_birth ? new Date(s.date_of_birth).toLocaleDateString('en-TZ') : '-'}
                  </span>
                </td>
                <td className="py-0.5"><span className="font-semibold text-gray-700">Exams:</span></td>
                <td className="py-0.5">
                  <span className="text-gray-900">
                    {mode === 'single'
                      ? (selectedExam?.name || '')
                      : `${selectedExam?.name || '?'} + ${selectedExam2?.name || '?'}`
                    }
                  </span>
                </td>
              </tr>
              {mode === 'single' && sr && (
                <tr>
                  <td className="py-0.5"><span className="font-semibold text-gray-700">Position:</span></td>
                  <td className="py-0.5">
                    <span className="text-gray-900 font-bold">
                      {sr.position ? `${sr.position} out of ${students.length}` : '-'}
                    </span>
                  </td>
                  <td className="py-0.5" />
                  <td className="py-0.5" />
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-3">
          <h3 className="text-xs font-bold text-gray-800 mb-2 uppercase tracking-wider">Subject Performance</h3>
          <table className="w-full text-xs border-collapse border border-gray-300">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-1.5 py-1.5 text-left text-[10px] font-bold text-gray-700 uppercase w-6">#</th>
                <th className="border border-gray-300 px-1.5 py-1.5 text-left text-[10px] font-bold text-gray-700 uppercase">Subject</th>
                {mode === 'combined' ? (
                  <>
                    <th className="border border-gray-300 px-1.5 py-1.5 text-center text-[10px] font-bold text-gray-700 uppercase w-14">
                      {selectedExam?.exam_type?.replace('_', ' ') || 'Exam 1'}
                    </th>
                    <th className="border border-gray-300 px-1.5 py-1.5 text-center text-[10px] font-bold text-gray-700 uppercase w-14">
                      {selectedExam2?.exam_type?.replace('_', ' ') || 'Exam 2'}
                    </th>
                  </>
                ) : selectedExam?.has_practical ? (
                  <>
                    <th className="border border-gray-300 px-1.5 py-1.5 text-center text-[10px] font-bold text-gray-700 uppercase w-12">Theory</th>
                    <th className="border border-gray-300 px-1.5 py-1.5 text-center text-[10px] font-bold text-gray-700 uppercase w-12">Practical</th>
                  </>
                ) : null}
                <th className="border border-gray-300 px-1.5 py-1.5 text-center text-[10px] font-bold text-gray-700 uppercase w-12">Marks</th>
                <th className="border border-gray-300 px-1.5 py-1.5 text-center text-[10px] font-bold text-gray-700 uppercase w-10">Grade</th>
                <th className="border border-gray-300 px-1.5 py-1.5 text-center text-[10px] font-bold text-gray-700 uppercase w-8">Pts</th>
                <th className="border border-gray-300 px-1.5 py-1.5 text-left text-[10px] font-bold text-gray-700 uppercase">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {mode === 'single' && subjects.map((subject, idx) => {
                const mark = markMap[`${s.id}_${subject.id}`]
                const hp = subjectHasPractical(subject, selectedExam)
                const theoryMark = mark?.marks_obtained ?? null
                const practicalMark = hp ? (mark?.practical_marks ?? null) : null
                const total = (theoryMark || 0) + (practicalMark || 0)
                const max = hp ? 150 : 100
                const pct = mark && !mark.is_absent ? (total / max) * 100 : null
                const gradeObj = getGradeForPercentage(pct, grades)
                const isAbsent = mark?.is_absent

                return (
                  <tr key={subject.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                    <td className="border border-gray-300 px-1.5 py-1.5 text-center text-gray-600">{idx + 1}</td>
                    <td className="border border-gray-300 px-1.5 py-1.5 font-medium text-gray-800">{subject.subject_name}</td>
                    {selectedExam?.has_practical && (
                      <>
                        <td className="border border-gray-300 px-1.5 py-1.5 text-center text-gray-700">
                          {isAbsent ? <span className="text-amber-500 text-[10px]">Abs</span> : theoryMark != null ? theoryMark : '-'}
                        </td>
                        <td className="border border-gray-300 px-1.5 py-1.5 text-center text-gray-700">
                          {isAbsent ? <span className="text-amber-500 text-[10px]">Abs</span> : practicalMark != null ? practicalMark : '-'}
                        </td>
                      </>
                    )}
                    <td className="border border-gray-300 px-1.5 py-1.5 text-center font-semibold text-gray-800">
                      {isAbsent ? <span className="text-amber-500 text-[10px]">Abs</span> : pct != null ? `${pct.toFixed(0)}%` : '-'}
                    </td>
                    <td className="border border-gray-300 px-1.5 py-1.5 text-center font-bold">
                      {isAbsent ? <span className="text-gray-400">-</span> : gradeObj ? (
                        <span className={`px-1 py-0.5 rounded text-[10px] font-bold ${
                          gradeObj.grade === 'A' ? 'bg-green-100 text-green-800' :
                          gradeObj.grade === 'B' ? 'bg-blue-100 text-blue-800' :
                          gradeObj.grade === 'C' ? 'bg-yellow-100 text-yellow-800' :
                          gradeObj.grade === 'D' ? 'bg-orange-100 text-orange-800' :
                          'bg-red-100 text-red-800'
                        }`}>{gradeObj.grade}</span>
                      ) : '-'}
                    </td>
                    <td className="border border-gray-300 px-1.5 py-1.5 text-center font-medium text-gray-700">
                      {isAbsent ? '-' : gradeObj?.points != null ? gradeObj.points : '-'}
                    </td>
                    <td className="border border-gray-300 px-1.5 py-1.5 text-gray-600 text-[10px]">
                      {isAbsent ? 'Absent' : gradeObj?.remarks || '-'}
                    </td>
                  </tr>
                )
              })}

              {mode === 'combined' && combinedStudentData?.entries.map((entry, idx) => {
                return (
                  <tr key={entry.subject.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                    <td className="border border-gray-300 px-1.5 py-1.5 text-center text-gray-600">{idx + 1}</td>
                    <td className="border border-gray-300 px-1.5 py-1.5 font-medium text-gray-800">{entry.subject.subject_name}</td>
                    <td className="border border-gray-300 px-1.5 py-1.5 text-center text-gray-700">
                      {entry.isAbsent1 ? <span className="text-amber-500 text-[10px]">Abs</span> : entry.exam1Total != null ? entry.exam1Total : '-'}
                    </td>
                    <td className="border border-gray-300 px-1.5 py-1.5 text-center text-gray-700">
                      {entry.isAbsent2 ? <span className="text-amber-500 text-[10px]">Abs</span> : entry.exam2Total != null ? entry.exam2Total : '-'}
                    </td>
                    <td className="border border-gray-300 px-1.5 py-1.5 text-center font-semibold text-gray-800">
                      {entry.combinedPct != null ? `${entry.combinedPct.toFixed(0)}%` : '-'}
                    </td>
                    <td className="border border-gray-300 px-1.5 py-1.5 text-center font-bold">
                      {entry.gradeObj ? (
                        <span className={`px-1 py-0.5 rounded text-[10px] font-bold ${
                          entry.gradeObj.grade === 'A' ? 'bg-green-100 text-green-800' :
                          entry.gradeObj.grade === 'B' ? 'bg-blue-100 text-blue-800' :
                          entry.gradeObj.grade === 'C' ? 'bg-yellow-100 text-yellow-800' :
                          entry.gradeObj.grade === 'D' ? 'bg-orange-100 text-orange-800' :
                          'bg-red-100 text-red-800'
                        }`}>{entry.gradeObj.grade}</span>
                      ) : '-'}
                    </td>
                    <td className="border border-gray-300 px-1.5 py-1.5 text-center font-medium text-gray-700">
                      {entry.gradeObj?.points != null ? entry.gradeObj.points : '-'}
                    </td>
                    <td className="border border-gray-300 px-1.5 py-1.5 text-gray-600 text-[10px]">
                      {entry.gradeObj?.remarks || '-'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="px-6 pb-3">
          {mode === 'single' && sr && (
            <div className="grid grid-cols-5 gap-2 mb-3">
              <div className="bg-gray-50 rounded p-2 text-center border border-gray-200">
                <div className="text-sm font-bold text-gray-900">{sr.total_marks ?? '-'}</div>
                <div className="text-[9px] text-gray-500 uppercase">Total</div>
              </div>
              <div className="bg-gray-50 rounded p-2 text-center border border-gray-200">
                <div className="text-sm font-bold text-gray-900">{sr.average_marks ?? '-'}</div>
                <div className="text-[9px] text-gray-500 uppercase">Average</div>
              </div>
              <div className="bg-gray-50 rounded p-2 text-center border border-gray-200">
                <div className="text-sm font-bold text-indigo-600">{sr.grade || '-'}</div>
                <div className="text-[9px] text-gray-500 uppercase">Grade</div>
              </div>
              <div className="bg-gray-50 rounded p-2 text-center border border-gray-200">
                <div className="text-sm font-bold text-purple-600">{(sr.division || '').replace('Division ', '') || '-'}</div>
                <div className="text-[9px] text-gray-500 uppercase">Division</div>
              </div>
                <div className="bg-gray-50 rounded p-2 text-center border border-gray-200">
                  <div className="text-sm font-bold text-gray-900">
                    {(() => { 
                      let totalPts = 0
                      subjects.forEach(subject => {
                        const mark = markMap[`${s.id}_${subject.id}`]
                        const hp = subjectHasPractical(subject, selectedExam)
                        const total = ((mark?.marks_obtained ?? 0) + (hp ? (mark?.practical_marks ?? 0) : 0))
                        const max = hp ? 150 : 100
                        const pct = mark && !mark.is_absent ? (total / max) * 100 : null
                        const g = getGradeForPercentage(pct, grades)
                        if (g) totalPts += g.points
                      })
                      return totalPts > 0 ? totalPts : '-'
                    })()}
                  </div>
                  <div className="text-[9px] text-gray-500 uppercase">Total Pts</div>
                </div>
            </div>
          )}
          {mode === 'combined' && combinedStudentData && (
            <div className="grid grid-cols-5 gap-2 mb-3">
              <div className="bg-gray-50 rounded p-2 text-center border border-gray-200">
                <div className="text-sm font-bold text-gray-900">{combinedStudentData.totalMarks.toFixed(0)}</div>
                <div className="text-[9px] text-gray-500 uppercase">Total</div>
              </div>
              <div className="bg-gray-50 rounded p-2 text-center border border-gray-200">
                <div className="text-sm font-bold text-gray-900">{combinedStudentData.avgPct != null ? `${combinedStudentData.avgPct.toFixed(1)}%` : '-'}</div>
                <div className="text-[9px] text-gray-500 uppercase">Average</div>
              </div>
              <div className="bg-gray-50 rounded p-2 text-center border border-gray-200">
                <div className="text-sm font-bold text-indigo-600">{combinedStudentData.gradeObj?.grade || '-'}</div>
                <div className="text-[9px] text-gray-500 uppercase">Grade</div>
              </div>
              <div className="bg-gray-50 rounded p-2 text-center border border-gray-200">
                <div className="text-sm font-bold text-purple-600">{combinedStudentData.division || '-'}</div>
                <div className="text-[9px] text-gray-500 uppercase">Division</div>
              </div>
              <div className="bg-gray-50 rounded p-2 text-center border border-gray-200">
                <div className="text-sm font-bold text-gray-900">{combinedStudentData.pts != null ? combinedStudentData.pts : '-'}</div>
                <div className="text-[9px] text-gray-500 uppercase">Total Pts</div>
              </div>
            </div>
          )}

          <div className="mb-2">
            <h4 className="text-[10px] font-bold text-gray-700 uppercase mb-1 tracking-wider">Grading Key</h4>
            <div className="flex flex-wrap gap-0.5">
              {grades.slice().reverse().map((g, idx) => (
                <span key={idx} className={`text-[8px] px-1.5 py-0.5 rounded font-medium ${
                  g.grade === 'A' ? 'bg-green-100 text-green-800' :
                  g.grade === 'B' ? 'bg-blue-100 text-blue-800' :
                  g.grade === 'C' ? 'bg-yellow-100 text-yellow-800' :
                  g.grade === 'D' ? 'bg-orange-100 text-orange-800' :
                  g.grade === 'E' ? 'bg-red-100 text-red-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {g.grade}: {g.min_mark}-{g.max_mark}%{g.points != null ? ` (${g.points}p)` : ''}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="px-6 pb-6 pt-2 border-t border-gray-200">
          <div className="grid grid-cols-3 gap-6">
            <div className="text-center">
              <div className="h-8" />
              <div className="border-t border-gray-400 pt-0.5">
                <p className="text-[10px] font-semibold text-gray-700">Class Teacher</p>
                <p className="text-[8px] text-gray-500">Signature & Date</p>
              </div>
            </div>
            <div className="text-center">
              <div className="h-8" />
              <div className="border-t border-gray-400 pt-0.5">
                <p className="text-[10px] font-semibold text-gray-700">Head of School</p>
                <p className="text-[8px] text-gray-500">Signature & Date</p>
              </div>
            </div>
            <div className="text-center">
              <div className="h-8" />
              <div className="border-t border-gray-400 pt-0.5">
                <p className="text-[10px] font-semibold text-gray-700">Headmaster</p>
                <p className="text-[8px] text-gray-500">Signature & Date</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }, [subjects, markMap, markMap2, studentResults, studentResults, grades, selectedExam, selectedExam2, selectedClassId, classes, schoolInfo, mode, students.length, combinedStudentData])

  if (loading) {
    return (
      <div className="no-print flex items-center justify-center py-20">
        <div className="w-8 h-8 border-3 border-gray-200 border-t-maroon-600 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      <style>{printStyles}</style>
      <div className="no-print mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Student Report Cards</h1>
        <p className="text-gray-500 mt-1">Generate and download individual PDF report cards for students</p>
      </div>

      <div className="no-print bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <div className="flex items-center gap-4 mb-4">
          <span className="text-sm font-medium text-gray-700">Report Type:</span>
          <div className="flex gap-2">
            <button
              onClick={() => { setMode('single'); resetSelections() }}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
                mode === 'single' ? 'bg-maroon-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Single Exam
            </button>
            <button
              onClick={() => { setMode('combined'); resetSelections() }}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
                mode === 'combined' ? 'bg-maroon-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Combined Report
            </button>
          </div>
          {mode === 'combined' && (
            <span className="text-xs text-gray-400">Select two exams to combine (e.g., Midterm + Terminal, Midterm + Annual)</span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {mode === 'single' ? 'Academic Year' : 'Exam 1 Year'}
            </label>
            <select
              value={selectedYearId}
              onChange={(e) => { setSelectedYearId(e.target.value); setSelectedExamId(''); resetSelections() }}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
            >
              <option value="">All Years</option>
              {academicYears.map((y) => (
                <option key={y.id} value={y.id}>{y.year_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {mode === 'single' ? 'Select Exam' : 'Select Exam 1'}
            </label>
            <select
              value={selectedExamId}
              onChange={(e) => { setSelectedExamId(e.target.value); resetSelections() }}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
            >
              <option value="">Choose an exam...</option>
              {(selectedYearId ? exams.filter(e => e.academic_year_id === selectedYearId) : exams).map((exam) => (
                <option key={exam.id} value={exam.id}>
                  {exam.name} ({exam.exam_type?.replace('_', ' ')})
                </option>
              ))}
            </select>
          </div>
          {mode === 'combined' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Exam 2 Year</label>
              <select
                value={selectedYear2Id}
                onChange={(e) => { setSelectedYear2Id(e.target.value); setSelectedExam2Id(''); resetSelections() }}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
              >
                <option value="">All Years</option>
                {academicYears.map((y) => (
                  <option key={y.id} value={y.id}>{y.year_name}</option>
                ))}
              </select>
            </div>
          )}
          {mode === 'single' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Class</label>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                disabled={activeExamIds.length === 0 || filteredClasses.length === 0}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500 disabled:bg-gray-50 disabled:text-gray-400"
              >
                <option value="">Choose a class...</option>
                {filteredClasses.map((c) => (
                  <option key={c.id} value={c.id}>{c.class_name}</option>
                ))}
              </select>
            </div>
          )}
          {mode === 'combined' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Exam 2</label>
                <select
                  value={selectedExam2Id}
                  onChange={(e) => { setSelectedExam2Id(e.target.value); resetSelections() }}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
                >
                  <option value="">Choose an exam...</option>
                  {(selectedYear2Id ? exams.filter(e => e.academic_year_id === selectedYear2Id && e.id !== selectedExamId) : exams.filter(e => e.id !== selectedExamId)).map((exam) => (
                    <option key={exam.id} value={exam.id}>
                      {exam.name} ({exam.exam_type?.replace('_', ' ')})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Class</label>
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  disabled={activeExamIds.length === 0 || filteredClasses.length === 0}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500 disabled:bg-gray-50 disabled:text-gray-400"
                >
                  <option value="">Choose a class...</option>
                  {filteredClasses.map((c) => (
                    <option key={c.id} value={c.id}>{c.class_name}</option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>
        {mode === 'combined' && selectedExam && selectedExam2 && (
          <div className="mt-3 flex items-center gap-3 text-sm text-gray-500">
            <span>Exam 1: <span className="font-medium text-gray-700">{selectedExam.name} ({selectedExam.status})</span></span>
            <span className="text-gray-300">|</span>
            <span>Exam 2: <span className="font-medium text-gray-700">{selectedExam2.name} ({selectedExam2.status})</span></span>
          </div>
        )}
        {mode === 'single' && selectedExam && (
          <div className="mt-3 flex items-center gap-3 text-sm text-gray-500">
            <span>Status: <span className="font-medium text-gray-700">{selectedExam.status?.replace('_', ' ')}</span></span>
            {selectedExam.has_practical && (
              <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-xs font-medium">Has Practical</span>
            )}
          </div>
        )}
      </div>

      {loadingData && (
        <div className="no-print flex items-center justify-center py-12">
          <div className="w-6 h-6 border-3 border-gray-200 border-t-maroon-600 rounded-full animate-spin" />
        </div>
      )}

      {!loadingData && selectedClassId && subjects.length > 0 && students.length > 0 && !isProcessed && (
        <div className="no-print bg-white rounded-xl border border-amber-200 p-10 text-center">
          <div className="w-14 h-14 mx-auto bg-amber-50 rounded-full flex items-center justify-center mb-4">
            <svg className="w-7 h-7 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Exam(s) Not Yet Processed</h3>
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            All selected exams must be processed before generating report cards.
          </p>
        </div>
      )}

      {!loadingData && selectedClassId && isProcessed && (
        <div>
          {activeTab === 'list' && (
            <div className="no-print bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-800">
                  Students - {students.length} total
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDownloadClassPDF}
                    disabled={sortedStudents.length === 0 || generatingBulkPDF !== false}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {generatingBulkPDF !== false ? (
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                      </svg>
                    )}
                    {generatingBulkPDF !== false ? generatingBulkPDF : `Download All (${sortedStudents.length})`}
                  </button>
                </div>
              </div>
              {students.length === 0 ? (
                <div className="p-10 text-center">
                  <p className="text-sm text-gray-500">No students found for this class.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">#</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Admission No</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Student Name</th>
                        <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Gender</th>
                        <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {sortedStudents.map((student, idx) => (
                        <tr key={student.id} className="hover:bg-gray-50 transition">
                          <td className="px-4 py-3 text-gray-500">{idx + 1}</td>
                          <td className="px-4 py-3 text-gray-700 font-mono text-xs">{student.admission_number}</td>
                          <td className="px-4 py-3">
                            <span className="font-medium text-gray-900">{student.first_name} {student.middle_name || ''} {student.surname}</span>
                          </td>
                          <td className="px-4 py-3 text-center text-gray-700">{student.gender === 'Male' ? 'M' : 'F'}</td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => handleViewReport(student)}
                              className="px-3 py-1.5 text-xs font-medium text-white bg-maroon-600 rounded-lg hover:bg-maroon-700 transition"
                            >
                              View Report
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'report' && selectedStudent && (
            <div>
              <div className="no-print flex items-center justify-between mb-4">
                <button
                  onClick={handleBack}
                  className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                  </svg>
                  Back to List
                </button>
                <button
                  onClick={handleDownloadPDF}
                  disabled={generatingPDF}
                  className="px-4 py-2 text-sm font-medium text-white bg-maroon-600 rounded-lg hover:bg-maroon-700 transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {generatingPDF ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                  )}
                  {generatingPDF ? 'Generating...' : 'Download PDF'}
                </button>
              </div>

              <div className="print-area" ref={reportRef}>
                <ReportCard student={selectedStudent} />
              </div>
            </div>
          )}

          {/* Bulk print container — hidden on screen, visible during print */}
          <div className="print-only" style={{ display: 'none' }} ref={bulkContainerRef}>
            {bulkStudents.map((student, idx) => (
              <ReportCard key={student.id} student={student} isBulk />
            ))}
          </div>
          {bulkStudents.length > 0 && (
            <style>{`
              .print-only { display: none !important; }
              @media print {
                .print-only { display: block !important; }
                .no-print { display: none !important; }
              }
            `}</style>
          )}
        </div>
      )}

      {!loadingData && selectedClassId && subjects.length === 0 && (
        <div className="no-print bg-white rounded-xl border border-gray-200 p-10 text-center">
          <p className="text-sm text-gray-500">No subjects found for this class.</p>
        </div>
      )}

      {!loadingData && selectedClassId && subjects.length > 0 && students.length === 0 && (
        <div className="no-print bg-white rounded-xl border border-gray-200 p-10 text-center">
          <p className="text-sm text-gray-500">No students found for this class.</p>
        </div>
      )}

      {!selectedClassId && !loading && (
        <div className="no-print bg-white rounded-xl border border-gray-200 p-10 text-center">
          <p className="text-sm text-gray-500">Select exam(s) and class to view students.</p>
        </div>
      )}
    </div>
  )
}

export default StudentReports
