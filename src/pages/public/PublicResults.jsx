import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

const SCIENCE_CODES = ['BIO', 'CHEM', 'PHY', 'BIOS', 'BIO_O', 'CHEM_O', 'PHY_O']

function hasPractical(subject, exam) {
  if (!exam?.has_practical) return false
  return subject?.has_practical || SCIENCE_CODES.includes(subject?.subject_code)
}

function getPct(mark, hp) {
  if (!mark || mark.is_absent) return null
  const theory = mark.marks_obtained ?? 0
  const practical = hp ? (mark.practical_marks ?? 0) : 0
  return ((theory + practical) / (hp ? 150 : 100)) * 100
}

function getGrade(pct, grades) {
  if (pct === null || pct === undefined) return null
  for (const g of grades) { if (pct >= g.min_mark) return g }
  return grades[grades.length - 1] || null
}

function calcDivision(points, level) {
  if (!points || points <= 0) return '0'
  if (level === 'A_LEVEL') {
    if (points <= 9) return 'I'
    if (points <= 12) return 'II'
    if (points <= 17) return 'III'
    if (points <= 19) return 'IV'
    return '0'
  }
  if (points <= 17) return 'I'
  if (points <= 21) return 'II'
  if (points <= 25) return 'III'
  if (points <= 33) return 'IV'
  return '0'
}

function divColor(div) {
  if (div === 'I') return 'text-emerald-700 bg-emerald-50 border-emerald-200'
  if (div === 'II') return 'text-blue-700 bg-blue-50 border-blue-200'
  if (div === 'III') return 'text-amber-700 bg-amber-50 border-amber-200'
  if (div === 'IV') return 'text-orange-700 bg-orange-50 border-orange-200'
  return 'text-red-700 bg-red-50 border-red-200'
}

function gradeColor(g) {
  if (!g) return 'text-gray-400'
  const pts = g.points ?? g
  if (pts <= 2) return 'text-emerald-700 font-semibold'
  if (pts <= 4) return 'text-blue-700 font-semibold'
  if (pts <= 6) return 'text-amber-700 font-semibold'
  return 'text-red-600'
}

async function fetchExamResults(student, examId, grades, subjects) {
  const { data: marks } = await supabase
    .from('marks')
    .select('*')
    .eq('exam_id', examId)
    .eq('student_id', student.id)

  const { data: resultRow } = await supabase
    .from('student_results')
    .select('*')
    .eq('exam_id', examId)
    .eq('student_id', student.id)
    .maybeSingle()

  const rows = (subjects || []).map(subj => {
    const mark = (marks || []).find(m => m.subject_id === subj.id)
    if (!mark) return null
    const hp = hasPractical(subj, null) // exam practical flag checked separately
    const pct = getPct(mark, hp)
    const gradeObj = pct !== null ? getGrade(pct, grades) : null
    return {
      subjectId: subj.id,
      subjectName: subj.subject_name,
      subjectCode: subj.subject_code,
      theory: mark.marks_obtained,
      practical: mark.practical_marks,
      hp,
      pct,
      isAbsent: mark.is_absent,
      grade: gradeObj,
    }
  }).filter(Boolean)

  const totalPoints = rows.reduce((sum, r) => sum + (r.grade?.points ?? 0), 0)

  return {
    rows,
    resultRow,
    totalPoints,
  }
}

export default function PublicResults() {
  const [schoolInfo, setSchoolInfo] = useState(null)
  const [step, setStep] = useState('lookup') // lookup | select | results | compare

  // Lookup
  const [admNo, setAdmNo] = useState('')
  const [looking, setLooking] = useState(false)
  const [lookupError, setLookupError] = useState('')

  // Student + exams
  const [student, setStudent] = useState(null)
  const [exams, setExams] = useState([])
  const [grades, setGrades] = useState([])
  const [subjects, setSubjects] = useState([])

  // Single view
  const [examId, setExamId] = useState('')
  const [exam, setExam] = useState(null)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState(null)

  // Compare
  const [compareExamId, setCompareExamId] = useState('')
  const [compareExam, setCompareExam] = useState(null)
  const [loadingCompare, setLoadingCompare] = useState(false)
  const [compareResults, setCompareResults] = useState(null)

  useEffect(() => {
    supabase.from('school_settings').select('logo_url, school_name').limit(1).then(({ data }) => {
      if (data?.[0]) setSchoolInfo(data[0])
    })
    supabase.from('grades').select('*').order('min_mark', { ascending: false }).then(({ data }) => {
      if (data) setGrades(data)
    })
  }, [])

  const handleLookup = async (e) => {
    e.preventDefault()
    if (!admNo.trim()) return
    setLooking(true)
    setLookupError('')
    try {
      const { data: studentData, error } = await supabase
        .from('students')
        .select('id, first_name, middle_name, surname, gender, class_id, class_stream_id, admission_number, classes(class_name, level)')
        .ilike('admission_number', admNo.trim())
        .maybeSingle()

      if (error) throw error
      if (!studentData) {
        setLookupError('Namba ya udahili haikupatikana. Tafadhali angalia namba uliyoingiza.')
        return
      }

      // Fetch exams for this student's class
      const { data: examClasses } = await supabase
        .from('exam_classes')
        .select('exam_id, exams!inner(*)')
        .eq('class_id', studentData.class_id)

      const seen = new Set()
      const uniqueExams = []
      ;(examClasses || []).forEach(ec => {
        if (!seen.has(ec.exam_id)) {
          seen.add(ec.exam_id)
          uniqueExams.push(ec.exams)
        }
      })
      uniqueExams.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

      // Fetch subjects for this class
      const { data: classSubjData } = await supabase
        .from('class_subjects')
        .select('subject_id, subjects(*)')
        .eq('class_id', studentData.class_id)

      const subjList = (classSubjData || []).map(cs => cs.subjects).filter(Boolean)

      setStudent(studentData)
      setExams(uniqueExams)
      setSubjects(subjList)
      setStep('select')
    } catch (err) {
      setLookupError('Hitilafu imetokea. Jaribu tena.')
      console.error(err)
    } finally {
      setLooking(false)
    }
  }

  const handleViewResults = async (e) => {
    e?.preventDefault()
    if (!examId) return
    const selectedExam = exams.find(ex => ex.id === examId)
    setExam(selectedExam)
    setLoading(true)
    setResults(null)
    setCompareResults(null)
    setCompareExamId('')
    setCompareExam(null)

    // Re-check practical per exam
    const examSubjects = subjects.map(s => ({
      ...s,
      hp: hasPractical(s, selectedExam),
    }))

    try {
      const { data: marks } = await supabase
        .from('marks')
        .select('*')
        .eq('exam_id', examId)
        .eq('student_id', student.id)

      const { data: resultRow } = await supabase
        .from('student_results')
        .select('*')
        .eq('exam_id', examId)
        .eq('student_id', student.id)
        .maybeSingle()

      const rows = examSubjects.map(subj => {
        const mark = (marks || []).find(m => m.subject_id === subj.id)
        if (!mark) return null
        const pct = getPct(mark, subj.hp)
        const gradeObj = pct !== null ? getGrade(pct, grades) : null
        return {
          subjectId: subj.id,
          subjectName: subj.subject_name,
          subjectCode: subj.subject_code,
          theory: mark.marks_obtained,
          practical: mark.practical_marks,
          hp: subj.hp,
          pct,
          isAbsent: mark.is_absent,
          grade: gradeObj,
        }
      }).filter(Boolean)

      const totalPoints = rows.reduce((sum, r) => sum + (r.grade?.points ?? 0), 0)

      setResults({ rows, resultRow, totalPoints })
      setStep('results')
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleCompare = async () => {
    if (!compareExamId) return
    const selExam = exams.find(ex => ex.id === compareExamId)
    setCompareExam(selExam)
    setLoadingCompare(true)

    const examSubjects = subjects.map(s => ({
      ...s,
      hp: hasPractical(s, selExam),
    }))

    try {
      const { data: marks } = await supabase
        .from('marks')
        .select('*')
        .eq('exam_id', compareExamId)
        .eq('student_id', student.id)

      const { data: resultRow } = await supabase
        .from('student_results')
        .select('*')
        .eq('exam_id', compareExamId)
        .eq('student_id', student.id)
        .maybeSingle()

      const rows = examSubjects.map(subj => {
        const mark = (marks || []).find(m => m.subject_id === subj.id)
        if (!mark) return null
        const pct = getPct(mark, subj.hp)
        const gradeObj = pct !== null ? getGrade(pct, grades) : null
        return {
          subjectId: subj.id,
          subjectName: subj.subject_name,
          subjectCode: subj.subject_code,
          theory: mark.marks_obtained,
          practical: mark.practical_marks,
          hp: subj.hp,
          pct,
          isAbsent: mark.is_absent,
          grade: gradeObj,
        }
      }).filter(Boolean)

      const totalPoints = rows.reduce((sum, r) => sum + (r.grade?.points ?? 0), 0)
      setCompareResults({ rows, resultRow, totalPoints })
      setStep('compare')
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingCompare(false)
    }
  }

  const resetAll = () => {
    setStep('lookup')
    setAdmNo('')
    setStudent(null)
    setExams([])
    setExamId('')
    setExam(null)
    setResults(null)
    setCompareExamId('')
    setCompareExam(null)
    setCompareResults(null)
    setLookupError('')
  }

  const studentName = student
    ? [student.first_name, student.middle_name, student.surname].filter(Boolean).join(' ')
    : ''

  const examLevel = student?.classes?.level || 'O_LEVEL'
  const division = results ? calcDivision(results.totalPoints, examLevel) : null
  const compareDivision = compareResults ? calcDivision(compareResults.totalPoints, examLevel) : null

  // Diff helper
  const pctDiff = (a, b) => {
    if (a === null || b === null) return null
    return a - b
  }

  const allSubjectIds = results
    ? [...new Set([...results.rows.map(r => r.subjectId), ...(compareResults?.rows.map(r => r.subjectId) || [])])]
    : []

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2.5 shrink-0">
            {schoolInfo?.logo_url ? (
              <img src={schoolInfo.logo_url} alt="" className="w-8 h-8 object-contain" crossOrigin="anonymous" />
            ) : (
              <svg viewBox="0 0 36 36" className="w-8 h-8 shrink-0">
                <rect width="36" height="36" rx="8" fill="#801818"/>
                <text x="18" y="23" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="700" fontFamily="Inter">K</text>
              </svg>
            )}
            <span className="text-sm font-bold text-gray-900 hidden sm:block">{schoolInfo?.school_name || 'Kizaga Secondary School'}</span>
          </Link>

          <div className="flex items-center gap-2 text-sm text-gray-500">
            <svg className="w-4 h-4 text-maroon-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V19.5a2.25 2.25 0 002.25 2.25h.75" />
            </svg>
            <span className="font-medium text-gray-700">Angalia Matokeo</span>
          </div>

          <Link to="/" className="text-xs text-maroon-600 hover:text-maroon-700 font-medium flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75" />
            </svg>
            <span className="hidden sm:inline">Nyumbani</span>
          </Link>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">

        {/* ===== STEP 1: LOOKUP ===== */}
        {step === 'lookup' && (
          <div className="max-w-md mx-auto">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-maroon-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-maroon-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 15.75l-2.489-2.489m0 0a3.375 3.375 0 10-4.773-4.773 3.375 3.375 0 004.774 4.774zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Angalia Matokeo ya Mwanafunzi</h1>
              <p className="text-sm text-gray-500 mt-2">Ingiza namba ya udahili (admission number) ya mwanafunzi ili uone matokeo yake ya mitihani.</p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <form onSubmit={handleLookup} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Namba ya Udahili (Admission Number)</label>
                  <input
                    type="text"
                    value={admNo}
                    onChange={e => { setAdmNo(e.target.value); setLookupError('') }}
                    placeholder="Mfano: S001 au KSS/2025/001"
                    required
                    autoFocus
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm outline-none focus:border-maroon-500 focus:ring-4 focus:ring-maroon-500/10 transition font-mono"
                  />
                  {lookupError && (
                    <p className="mt-2 text-sm text-red-600 flex items-center gap-1.5">
                      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                      </svg>
                      {lookupError}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={looking || !admNo.trim()}
                  className="w-full py-3 bg-maroon-600 hover:bg-maroon-700 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition flex items-center justify-center gap-2"
                >
                  {looking ? (
                    <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Inatafuta...</>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                      </svg>
                      Tafuta Mwanafunzi
                    </>
                  )}
                </button>
              </form>

              <div className="mt-5 pt-4 border-t border-gray-100 text-center">
                <p className="text-xs text-gray-400">Matokeo yanapatikana tu kwa wanafunzi walioandikishwa rasmi.</p>
              </div>
            </div>
          </div>
        )}

        {/* ===== STEP 2: SELECT EXAM ===== */}
        {step === 'select' && student && (
          <div className="max-w-lg mx-auto">
            {/* Student card */}
            <div className="bg-maroon-700 text-white rounded-2xl p-5 mb-6 flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center shrink-0 text-lg font-bold">
                {student.first_name?.[0]}{student.surname?.[0]}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-lg leading-tight">{studentName}</p>
                <p className="text-maroon-200 text-sm">{student.classes?.class_name} &middot; {student.admission_number}</p>
              </div>
              <button onClick={resetAll} className="p-2 rounded-lg hover:bg-white/20 transition" title="Tafuta tena">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Chagua Mtihani Unaotaka Kuona</h2>

              {exams.length === 0 ? (
                <div className="text-center py-8 text-sm text-gray-400">
                  Hakuna matokeo ya mtihani yaliyopatikana kwa mwanafunzi huyu.
                </div>
              ) : (
                <form onSubmit={handleViewResults} className="space-y-4">
                  <div className="space-y-2">
                    {exams.map(ex => (
                      <label
                        key={ex.id}
                        className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition ${
                          examId === ex.id
                            ? 'bg-maroon-50 border-maroon-300'
                            : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="exam"
                          value={ex.id}
                          checked={examId === ex.id}
                          onChange={() => setExamId(ex.id)}
                          className="accent-maroon-600"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-800">{ex.exam_name}</p>
                          {ex.academic_year && <p className="text-xs text-gray-400 mt-0.5">{ex.academic_year}</p>}
                        </div>
                        {examId === ex.id && (
                          <svg className="w-5 h-5 text-maroon-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                      </label>
                    ))}
                  </div>

                  <button
                    type="submit"
                    disabled={!examId || loading}
                    className="w-full py-3 bg-maroon-600 hover:bg-maroon-700 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Inapakia...</>
                    ) : 'Ona Matokeo'}
                  </button>
                </form>
              )}
            </div>
          </div>
        )}

        {/* ===== STEP 3: RESULTS ===== */}
        {(step === 'results' || step === 'compare') && results && (
          <div>
            {/* Top bar */}
            <div className="flex items-center gap-3 mb-5 flex-wrap">
              <button
                onClick={() => { setStep('select'); setResults(null); setCompareResults(null); setCompareExamId(''); }}
                className="flex items-center gap-1.5 text-sm text-maroon-600 hover:text-maroon-700 font-medium"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                </svg>
                Rudi Nyuma
              </button>
              <button
                onClick={resetAll}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 font-medium ml-auto"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                Tafuta Mwanafunzi Mwingine
              </button>
            </div>

            {/* Student + Exam header */}
            <div className="bg-gradient-to-r from-maroon-800 to-maroon-700 text-white rounded-2xl p-5 mb-5">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center shrink-0 text-lg font-bold">
                  {student.first_name?.[0]}{student.surname?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-xl">{studentName}</p>
                  <p className="text-maroon-200 text-sm">{student.classes?.class_name} &middot; {student.admission_number}</p>
                  <p className="text-maroon-100 text-sm mt-1 font-medium">{exam?.exam_name}</p>
                </div>
                {division && (
                  <div className="text-center shrink-0">
                    <div className="text-xs text-maroon-200 mb-1">Daraja</div>
                    <div className="text-3xl font-black">{division}</div>
                  </div>
                )}
              </div>

              {/* Summary pills */}
              <div className="mt-4 flex flex-wrap gap-2">
                {results.resultRow?.average_marks != null && (
                  <span className="px-3 py-1 bg-white/15 rounded-full text-xs font-medium">
                    Wastani: {Number(results.resultRow.average_marks).toFixed(1)}%
                  </span>
                )}
                {results.resultRow?.position && (
                  <span className="px-3 py-1 bg-white/15 rounded-full text-xs font-medium">
                    Nafasi: {results.resultRow.position}
                  </span>
                )}
                <span className="px-3 py-1 bg-white/15 rounded-full text-xs font-medium">
                  Pointi: {results.totalPoints}
                </span>
              </div>
            </div>

            {/* ===== COMPARISON MODE ===== */}
            {step === 'compare' && compareResults ? (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold text-gray-900">Ulinganisho wa Mitihani</h3>
                  <button
                    onClick={() => { setStep('results'); setCompareResults(null); setCompareExamId('') }}
                    className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Funga Ulinganisho
                  </button>
                </div>

                {/* Comparison summary cards */}
                <div className="grid grid-cols-2 gap-3 mb-5">
                  {[
                    { label: exam?.exam_name, res: results, div: division },
                    { label: compareExam?.exam_name, res: compareResults, div: compareDivision },
                  ].map((item, idx) => {
                    const avgA = results.resultRow?.average_marks
                    const avgB = compareResults.resultRow?.average_marks
                    const diff = idx === 1 && avgA != null && avgB != null ? avgB - avgA : null
                    return (
                      <div key={idx} className="bg-white rounded-xl border border-gray-200 p-4">
                        <p className="text-xs text-gray-500 mb-2 truncate font-medium">{item.label}</p>
                        <div className="flex items-end justify-between">
                          <div>
                            <p className="text-2xl font-black text-gray-900">{item.div}</p>
                            <p className="text-xs text-gray-400">Daraja</p>
                          </div>
                          <div className="text-right">
                            {item.res.resultRow?.average_marks != null && (
                              <>
                                <p className="text-lg font-bold text-gray-700">{Number(item.res.resultRow.average_marks).toFixed(1)}%</p>
                                {diff !== null && (
                                  <p className={`text-xs font-semibold flex items-center gap-0.5 justify-end ${diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                                    {diff > 0 ? '↑' : diff < 0 ? '↓' : '→'}
                                    {diff !== 0 ? ` ${Math.abs(diff).toFixed(1)}%` : ' Sawa'}
                                  </p>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Overall trend */}
                {(() => {
                  const avgA = results.resultRow?.average_marks
                  const avgB = compareResults.resultRow?.average_marks
                  if (avgA == null || avgB == null) return null
                  const diff = avgB - avgA
                  const rose = diff > 0
                  const same = diff === 0
                  return (
                    <div className={`rounded-xl border p-4 mb-5 flex items-center gap-3 ${rose ? 'bg-emerald-50 border-emerald-200' : same ? 'bg-gray-50 border-gray-200' : 'bg-red-50 border-red-200'}`}>
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl shrink-0 ${rose ? 'bg-emerald-100' : same ? 'bg-gray-100' : 'bg-red-100'}`}>
                        {rose ? '📈' : same ? '➡️' : '📉'}
                      </div>
                      <div>
                        <p className={`text-sm font-semibold ${rose ? 'text-emerald-800' : same ? 'text-gray-700' : 'text-red-800'}`}>
                          {rose
                            ? `Hongera! ${studentName.split(' ')[0]} amepanda kwa ${Math.abs(diff).toFixed(1)}%`
                            : same
                            ? `Matokeo ni sawa na mtihani uliopita`
                            : `${studentName.split(' ')[0]} ameshuka kwa ${Math.abs(diff).toFixed(1)}%`}
                        </p>
                        <p className={`text-xs mt-0.5 ${rose ? 'text-emerald-600' : same ? 'text-gray-500' : 'text-red-600'}`}>
                          {exam?.exam_name}: {Number(avgA).toFixed(1)}% → {compareExam?.exam_name}: {Number(avgB).toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  )
                })()}

                {/* Subject-by-subject comparison table */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-5">
                  <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                    <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 text-xs font-semibold text-gray-500 uppercase">
                      <span>Somo</span>
                      <span className="text-center w-16 truncate">{exam?.exam_name?.split(' ').slice(0, 2).join(' ')}</span>
                      <span className="text-center w-16 truncate">{compareExam?.exam_name?.split(' ').slice(0, 2).join(' ')}</span>
                      <span className="text-center w-10">Mwelekeo</span>
                    </div>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {allSubjectIds.map(sid => {
                      const rowA = results.rows.find(r => r.subjectId === sid)
                      const rowB = compareResults.rows.find(r => r.subjectId === sid)
                      const name = rowA?.subjectName || rowB?.subjectName || sid
                      const diff = pctDiff(rowB?.pct ?? null, rowA?.pct ?? null)
                      const trend = diff === null ? null : diff > 1 ? 'up' : diff < -1 ? 'down' : 'same'
                      return (
                        <div key={sid} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 px-4 py-2.5 items-center hover:bg-gray-50 transition">
                          <span className="text-sm text-gray-700 truncate">{name}</span>
                          <div className="w-16 text-center">
                            {rowA ? (
                              rowA.isAbsent ? (
                                <span className="text-xs text-gray-400">ABS</span>
                              ) : (
                                <span className={`text-sm font-medium ${gradeColor(rowA.grade)}`}>{rowA.grade?.grade_letter || '-'}</span>
                              )
                            ) : <span className="text-gray-300">—</span>}
                          </div>
                          <div className="w-16 text-center">
                            {rowB ? (
                              rowB.isAbsent ? (
                                <span className="text-xs text-gray-400">ABS</span>
                              ) : (
                                <span className={`text-sm font-medium ${gradeColor(rowB.grade)}`}>{rowB.grade?.grade_letter || '-'}</span>
                              )
                            ) : <span className="text-gray-300">—</span>}
                          </div>
                          <div className="w-10 text-center text-base">
                            {trend === 'up' ? (
                              <span className="text-emerald-600" title={`+${diff?.toFixed(1)}%`}>↑</span>
                            ) : trend === 'down' ? (
                              <span className="text-red-500" title={`${diff?.toFixed(1)}%`}>↓</span>
                            ) : trend === 'same' ? (
                              <span className="text-gray-400">→</span>
                            ) : <span className="text-gray-200">—</span>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            ) : (
              /* ===== SINGLE RESULTS TABLE ===== */
              <div>
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-5">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Somo</th>
                          <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Alama</th>
                          <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase">%</th>
                          <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Daraja</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {results.rows.map(row => (
                          <tr key={row.subjectId} className="hover:bg-gray-50 transition">
                            <td className="px-4 py-3 text-gray-800 font-medium">{row.subjectName}</td>
                            <td className="px-3 py-3 text-center text-gray-600">
                              {row.isAbsent ? (
                                <span className="text-xs text-red-500 font-medium">ABS</span>
                              ) : (
                                <span>
                                  {row.theory ?? '-'}
                                  {row.hp && row.practical != null ? <span className="text-gray-400"> +{row.practical}</span> : ''}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-3 text-center text-gray-600">
                              {row.pct !== null ? `${row.pct.toFixed(1)}%` : '—'}
                            </td>
                            <td className="px-3 py-3 text-center">
                              <span className={`font-bold text-base ${gradeColor(row.grade)}`}>
                                {row.isAbsent ? 'ABS' : (row.grade?.grade_letter || '—')}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Summary */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                  {[
                    { label: 'Wastani', value: results.resultRow?.average_marks != null ? `${Number(results.resultRow.average_marks).toFixed(1)}%` : '—' },
                    { label: 'Nafasi', value: results.resultRow?.position ?? '—' },
                    { label: 'Pointi', value: results.totalPoints },
                    { label: 'Daraja', value: division },
                  ].map(item => (
                    <div key={item.label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                      <p className="text-xs text-gray-500 mb-1">{item.label}</p>
                      <p className={`text-2xl font-black ${item.label === 'Daraja' ? divColor(division).split(' ')[0] : 'text-gray-900'}`}>{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ===== COMPARE PANEL ===== */}
            {step === 'results' && exams.length > 1 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4 text-maroon-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                  </svg>
                  Linganisha na Mtihani Mwingine
                </h3>
                <p className="text-xs text-gray-500 mb-3">Chagua mtihani mwingine kulinganisha matokeo na kuona mwelekeo wa mtoto wako.</p>
                <div className="flex gap-2">
                  <select
                    value={compareExamId}
                    onChange={e => setCompareExamId(e.target.value)}
                    className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-maroon-400 transition"
                  >
                    <option value="">Chagua mtihani...</option>
                    {exams.filter(ex => ex.id !== examId).map(ex => (
                      <option key={ex.id} value={ex.id}>{ex.exam_name}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleCompare}
                    disabled={!compareExamId || loadingCompare}
                    className="px-4 py-2.5 bg-maroon-600 hover:bg-maroon-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition flex items-center gap-1.5"
                  >
                    {loadingCompare ? (
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : 'Linganisha'}
                  </button>
                </div>
              </div>
            )}

            {step === 'compare' && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <button
                  onClick={resetAll}
                  className="w-full py-2.5 border border-maroon-300 text-maroon-600 hover:bg-maroon-50 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                  Tafuta Mwanafunzi Mwingine
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
