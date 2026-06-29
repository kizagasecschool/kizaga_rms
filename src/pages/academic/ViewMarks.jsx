import React, { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { sortSubjectsByNectaCode } from '../../lib/subjectUtils'

const SCIENCE_SUBJECTS = ['BIO', 'CHEM', 'PHY', 'BIOS', 'BIO_O', 'CHEM_O', 'PHY_O']

function subjectHasPractical(subject, exam) {
  if (!exam?.has_practical) return false
  return subject?.has_practical || SCIENCE_SUBJECTS.includes(subject?.subject_code)
}

function ViewMarks() {
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

  const [loading, setLoading] = useState(true)
  const [loadingData, setLoadingData] = useState(false)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const [eRes, cRes, stRes, yRes] = await Promise.all([
        supabase.from('exams').select('*').order('created_at', { ascending: false }),
        supabase.from('classes').select('*').order('sort_order'),
        supabase.from('exam_classes').select('*'),
        supabase.from('academic_years').select('*').order('year_name', { ascending: false }),
      ])
      if (eRes.data) setExams(eRes.data)
      if (cRes.data) setClasses(cRes.data)
      if (stRes.data) setExamClasses(stRes.data)
      if (yRes.data) setAcademicYears(yRes.data)
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    if (!selectedExamId) { setSelectedExam(null); return }
    const exam = exams.find(e => e.id === selectedExamId)
    setSelectedExam(exam || null)
    setSelectedClassId('')
    setStudents([])
    setMarks([])
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
      return
    }
    const loadData = async () => {
      setLoadingData(true)
      try {
        const selectedClass = classes.find(c => c.id === selectedClassId)
        const classLevel = selectedClass?.level || 'O_LEVEL'

        const [sRes, exclRes] = await Promise.all([
          supabase.from('subjects').select('*').eq('level', classLevel).order('subject_name'),
          supabase.from('class_excluded_subjects').select('subject_id').eq('class_id', selectedClassId),
        ])
        const excludedIds = new Set((exclRes.data || []).map(r => r.subject_id))
        const assignedSubjects = sortSubjectsByNectaCode(
          (sRes.data || []).filter(s => !excludedIds.has(s.id)),
          classLevel
        )
        setSubjects(assignedSubjects)

        let loadedStudents = []
        let loadedMarks = []

        if (assignedSubjects.length > 0) {
          const { data: mData } = await supabase
            .from('marks')
            .select('*')
            .eq('exam_id', selectedExamId)
            .in('subject_id', assignedSubjects.map(s => s.id))
          loadedMarks = mData || []

          const studentIdsFromMarks = [...new Set(loadedMarks.map(m => m.student_id))]

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

        setStudents(loadedStudents.slice().sort((a, b) => {
          const gA = a.gender === 'Female' ? 0 : 1
          const gB = b.gender === 'Female' ? 0 : 1
          if (gA !== gB) return gA - gB
          const s = (a.surname || '').localeCompare(b.surname || '')
          return s !== 0 ? s : (a.first_name || '').localeCompare(b.first_name || '')
        }))
        setMarks(loadedMarks)
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

  const anyPractical = useMemo(() => {
    return subjects.some(s => subjectHasPractical(s, selectedExam))
  }, [subjects, selectedExam])

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
        <h1 className="text-2xl font-bold text-gray-900">View Marks</h1>
        <p className="text-gray-500 mt-1">View entered marks by exam and class</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
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

      {!loadingData && selectedClassId && subjects.length > 0 && students.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase sticky left-0 bg-gray-50 z-10" style={{ minWidth: 130 }}>
                    Student
                  </th>
                  {subjects.map((subject) => {
                    const hp = subjectHasPractical(subject, selectedExam)
                    return hp ? (
                      <th key={subject.id} className="text-center px-1.5 py-3 text-xs font-semibold text-gray-500 uppercase" colSpan={2} style={{ minWidth: 85 }}>
                        <div>{subject.subject_code}</div>
                        <div className="text-[10px] font-normal text-gray-400 truncate max-w-[80px]">{subject.subject_name}</div>
                      </th>
                    ) : (
                      <th key={subject.id} className="text-center px-2 py-3 text-xs font-semibold text-gray-500 uppercase" style={{ minWidth: 70 }}>
                        <div>{subject.subject_code}</div>
                        <div className="text-[10px] font-normal text-gray-400 truncate max-w-[65px]">{subject.subject_name}</div>
                      </th>
                    )
                  })}
                </tr>
                {anyPractical && (
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="px-4 py-1.5 sticky left-0 bg-gray-50/50 z-10" />
                    {subjects.map((subject) => subjectHasPractical(subject, selectedExam) ? (
                      <React.Fragment key={subject.id}>
                        <th className="text-center px-2 py-1.5 text-[10px] font-medium text-gray-400 uppercase">Theory</th>
                        <th className="text-center px-2 py-1.5 text-[10px] font-medium text-gray-400 uppercase">Pract</th>
                      </React.Fragment>
                    ) : (
                      <th key={subject.id} className="text-center px-2 py-1.5 text-[10px] font-medium text-gray-400 uppercase" colSpan={1}>Marks</th>
                    ))}
                  </tr>
                )}
              </thead>
              <tbody className="divide-y divide-gray-100">
                {students.map((student) => (
                  <tr key={student.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-2.5 text-sm text-gray-900 sticky left-0 bg-white hover:bg-gray-50 z-10">
                      <span className="font-medium">{[student.first_name, student.middle_name, student.surname].filter(Boolean).join(' ')}</span>
                    </td>
                    {subjects.map((subject) => {
                      const mark = markMap[`${student.id}_${subject.id}`]
                      const hp = subjectHasPractical(subject, selectedExam)
                      if (hp) {
                        return (
                          <React.Fragment key={subject.id}>
                            <td className="px-2 py-2.5 text-center text-sm">
                              {mark?.is_absent ? (
                                <span className="text-amber-500 text-xs font-medium">Abs</span>
                              ) : mark ? (
                                <span className="text-gray-700">{mark.marks_obtained ?? '-'}</span>
                              ) : (
                                <span className="text-gray-300">-</span>
                              )}
                            </td>
                            <td className="px-2 py-2.5 text-center text-sm">
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
                        <td key={subject.id} className="px-3 py-2.5 text-center text-sm">
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
                  </tr>
                ))}
              </tbody>
            </table>
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

export default ViewMarks
