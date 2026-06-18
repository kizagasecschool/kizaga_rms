import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { useNotification } from '../../context/NotificationContext'

function EnterMarks() {
  const { profile } = useAuth()
  const { showToast } = useNotification()
  const role = profile?.role

  const [loading, setLoading] = useState(true)
  const [teacherId, setTeacherId] = useState(null)
  const [teacherAssignments, setTeacherAssignments] = useState([])
  const [examClassesMap, setExamClassesMap] = useState({})

  const [exams, setExams] = useState([])
  const [selectedExamId, setSelectedExamId] = useState('')
  const [selectedExam, setSelectedExam] = useState(null)
  const [selectedSubjectId, setSelectedSubjectId] = useState('')
  const [selectedStreamId, setSelectedStreamId] = useState('')

  const [subjectOptions, setSubjectOptions] = useState([])
  const [streamOptions, setStreamOptions] = useState([])
  const [selectedSubject, setSelectedSubject] = useState(null)

  const [students, setStudents] = useState([])
  const [marksData, setMarksData] = useState({})
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [noAssignMsg, setNoAssignMsg] = useState('')

  // ------- Warn on refresh/close with unsaved changes -------
  useEffect(() => {
    if (!hasChanges) return
    const handler = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [hasChanges])

  const [classes, setClasses] = useState([])
  const [streams, setStreams] = useState([])

  const isAcademic = role === 'academic' || role === 'admin'

  // ------- Load classes & streams for labels -------
  useEffect(() => {
    const load = async () => {
      const [cRes, sRes] = await Promise.all([
        supabase.from('classes').select('*').order('sort_order'),
        supabase.from('streams').select('*').order('stream_name'),
      ])
      if (cRes.data) setClasses(cRes.data)
      if (sRes.data) setStreams(sRes.data)
    }
    load()
  }, [])

  // ------- Load teacher & assignments -------
  useEffect(() => {
    const init = async () => {
      setLoading(true)
      try {
        if (!isAcademic) {
          const { data: teacher } = await supabase
            .from('teachers')
            .select('id')
            .eq('profile_id', profile?.id)
            .single()
          if (teacher) {
            setTeacherId(teacher.id)
            const { data: assignments } = await supabase
              .from('teacher_subjects')
              .select('*, class_streams!inner(*, classes!inner(*)), subjects!inner(*)')
              .eq('teacher_id', teacher.id)
            setTeacherAssignments(assignments || [])
          }
        }
      } catch (err) {
        console.error('Init error:', err)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [profile, isAcademic])

  // ------- Load exams -------
  useEffect(() => {
    if (!teacherId && !isAcademic) return
    const fetchExams = async () => {
      setLoading(true)
      try {
        let query = supabase
          .from('exams')
          .select('*, academic_years!inner(year_name), terms!inner(term_name)')
          .eq('status', 'entering_marks')

        if (!isAcademic) {
          const classIds = [...new Set(teacherAssignments.map(a => a.class_streams?.class_id).filter(Boolean))]
          if (classIds.length === 0) { setLoading(false); return }
          const { data: ec } = await supabase
            .from('exam_classes')
            .select('exam_id')
            .in('class_id', classIds)
          const examIds = [...new Set((ec || []).map(r => r.exam_id))]
          if (examIds.length === 0) { setExams([]); setLoading(false); return }
          query = query.in('id', examIds)
        }

        const { data } = await query.order('created_at', { ascending: false })
        setExams(data || [])

        if (data && data.length > 0) {
          const examIds = data.map(e => e.id)
          const { data: ecData } = await supabase
            .from('exam_classes')
            .select('exam_id, class_id')
            .in('exam_id', examIds)
          const map = {}
          ;(ecData || []).forEach(r => {
            if (!map[r.exam_id]) map[r.exam_id] = []
            map[r.exam_id].push(r.class_id)
          })
          setExamClassesMap(map)
        }
      } catch (err) {
        console.error('Fetch exams error:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchExams()
  }, [teacherId, teacherAssignments, isAcademic])

  // ------- When exam changes, load subjects -------
  useEffect(() => {
    setSelectedSubjectId('')
    setSelectedStreamId('')
    setStudents([])
    setMarksData({})
    setSubjectOptions([])
    setStreamOptions([])
    setSelectedSubject(null)
    setSelectedExam(null)
    if (!selectedExamId) return

    const exam = exams.find(e => e.id === selectedExamId)
    setSelectedExam(exam || null)

    const classIds = examClassesMap[selectedExamId] || []
    if (classIds.length === 0) return

    const loadSubjects = async () => {
      try {
        if (!isAcademic) {
          const subMap = new Map()
          teacherAssignments
            .filter(a => classIds.includes(a.class_streams?.class_id))
            .forEach(a => {
              if (a.subjects && !subMap.has(a.subjects.id)) subMap.set(a.subjects.id, a.subjects)
            })
          setSubjectOptions([...subMap.values()])
        } else {
          const examLevels = [...new Set(classes
            .filter(c => classIds.includes(c.id))
            .map(c => c.level)
            .filter(Boolean))]
          if (examLevels.length === 0) return
          const { data: subs } = await supabase
            .from('subjects')
            .select('*')
            .in('level', examLevels)
            .order('subject_name')
          setSubjectOptions(subs || [])
        }
      } catch (err) {
        console.error('Load subjects error:', err)
      }
    }
    loadSubjects()
  }, [selectedExamId, exams, examClassesMap, teacherAssignments, isAcademic, classes])

  // ------- When subject changes, load streams -------
  useEffect(() => {
    setSelectedStreamId('')
    setStudents([])
    setMarksData({})
    setStreamOptions([])
    setSelectedSubject(null)
    if (!selectedExamId || !selectedSubjectId) return

    const sub = subjectOptions.find(s => s.id === selectedSubjectId)
    setSelectedSubject(sub || null)

    const classIds = examClassesMap[selectedExamId] || []
    if (classIds.length === 0) return

    const loadStreams = async () => {
      try {
        if (!isAcademic) {
          const streamSet = new Map()
          teacherAssignments
            .filter(a => a.subject_id === selectedSubjectId && classIds.includes(a.class_streams?.class_id))
            .forEach(a => {
              if (a.class_streams && !streamSet.has(a.class_streams.id)) {
                streamSet.set(a.class_streams.id, a.class_streams)
              }
            })
          setStreamOptions([...streamSet.values()])
        } else {
          let streamQuery = supabase
            .from('class_streams')
            .select('*, classes(*), streams(*)')
            .in('class_id', classIds)
            .order('class_id')

          if (sub?.level) {
            streamQuery = streamQuery.eq('classes.level', sub.level)
          }

          const { data: cs } = await streamQuery
          setStreamOptions(cs || [])
        }
      } catch (err) {
        console.error('Load streams error:', err)
      }
    }
    loadStreams()
  }, [selectedSubjectId, selectedExamId, examClassesMap, subjectOptions, teacherAssignments, isAcademic])

  // ------- When stream changes, load students & marks -------
  useEffect(() => {
    setStudents([])
    setMarksData({})
    setHasChanges(false)
    if (!selectedExamId || !selectedSubjectId || !selectedStreamId) return

    const loadStudentsAndMarks = async () => {
      setLoading(true)
      setNoAssignMsg('')
      try {
        // Check if subject is excluded for this class
        const { data: csRow } = await supabase
          .from('class_streams')
          .select('class_id')
          .eq('id', selectedStreamId)
          .single()
        if (csRow?.class_id) {
          const { data: excl } = await supabase
            .from('class_excluded_subjects')
            .select('id')
            .eq('class_id', csRow.class_id)
            .eq('subject_id', selectedSubjectId)
            .maybeSingle()
          if (excl) {
            setNoAssignMsg('This subject is locked/excluded for this class. Enable it in Class Subjects.')
            setStudents([])
            setMarksData({})
            setLoading(false)
            return
          }
        }

        const [ssRes, mRes] = await Promise.all([
          supabase.from('student_subjects').select('student_id').eq('subject_id', selectedSubjectId),
          supabase.from('marks').select('*').eq('exam_id', selectedExamId).eq('subject_id', selectedSubjectId),
        ])

        const assignedIds = (ssRes.data || []).map(r => r.student_id)

        if (assignedIds.length === 0) {
          const { count } = await supabase
            .from('student_subjects')
            .select('*', { count: 'exact', head: true })
            .limit(1)
          if (count > 0) {
            setStudents([])
            setMarksData({})
            setNoAssignMsg('No students have been assigned to this subject.')
            return
          }
        }

        const { data: studs } = await supabase
          .from('students')
          .select('*')
          .eq('class_stream_id', selectedStreamId)
          .eq('status', 'active')
          .in('id', assignedIds)
          .order('surname')

        setStudents(studs || [])

        const map = {}
        ;(mRes.data || []).forEach(m => { map[m.student_id] = m })
        setMarksData(map)
      } catch (err) {
        console.error('Load students/marks error:', err)
      } finally {
        setLoading(false)
      }
    }
    loadStudentsAndMarks()
  }, [selectedStreamId, selectedSubjectId, selectedExamId])

  // ------- Helpers -------
  const getStreamLabel = (cs) => {
    const cls = classes.find(c => c.id === cs.class_id)
    const str = streams.find(s => s.id === cs.stream_id)
    if (cls && str) return `${cls.class_name} - ${str.stream_name}`
    if (cls) return cls.class_name
    return 'Unknown'
  }

  const selectedStream = streamOptions.find(s => s.id === selectedStreamId)
  const contextClass = selectedStream ? classes.find(c => c.id === selectedStream.class_id) : null
  const contextStr = selectedExam && selectedSubject && selectedStream
    ? `${contextClass?.class_name || '?'} ${streams.find(s => s.id === selectedStream.stream_id)?.stream_name || ''} › ${selectedSubject.subject_name} › ${selectedExam.name}`
    : ''

  const updateMark = (studentId, field, value) => {
    setMarksData(prev => {
      const current = prev[studentId] || { student_id: studentId }
      return { ...prev, [studentId]: { ...current, [field]: value } }
    })
    setHasChanges(true)
  }

  const showPractical = selectedExam?.has_practical && selectedSubject?.has_practical

  const handleSave = async () => {
    const errors = []
    for (const s of students) {
      const m = marksData[s.id] || {}
      if (m.is_absent) continue
      const raw = parseFloat(m.marks_obtained)
      if (!isNaN(raw) && (raw < 0 || raw > 100)) {
        errors.push(`${s.first_name} ${s.surname}: Theory mark ${raw} is invalid (0-100)`)
      }
      if (showPractical) {
        const p = parseFloat(m.practical_marks)
        if (!isNaN(p) && (p < 0 || p > 50)) {
          errors.push(`${s.first_name} ${s.surname}: Practical mark ${p} is invalid (0-50)`)
        }
      }
    }
    if (errors.length > 0) {
      showToast(errors.join('\n'), 'error')
      setSaving(false)
      return
    }

    setSaving(true)
    try {
      const toUpsert = students
        .filter(s => {
          const m = marksData[s.id] || {}
          const hasTheory = m.marks_obtained !== '' && m.marks_obtained != null
          const hasPractical = showPractical && m.practical_marks !== '' && m.practical_marks != null
          return m.id || hasTheory || hasPractical || m.is_absent
        })
        .map(s => {
        const m = marksData[s.id] || {}
        const raw = parseFloat(m.marks_obtained)
        return {
          student_id: s.id,
          subject_id: selectedSubjectId,
          exam_id: selectedExamId,
          marks_obtained: m.is_absent ? 0 : (isNaN(raw) ? 0 : Math.min(Math.max(raw, 0), 100)),
          is_absent: m.is_absent || false,
          entered_by: profile.id,
          ...(showPractical ? {
            practical_marks: m.is_absent ? null : (() => {
              const p = parseFloat(m.practical_marks)
              return isNaN(p) ? null : Math.min(Math.max(p, 0), 50)
            })()
          } : {}),
          id: m.id || crypto.randomUUID(),
        }
      })

      const { error } = await supabase
        .from('marks')
        .upsert(toUpsert, { onConflict: ['student_id', 'subject_id', 'exam_id'] })
      if (error) throw error

      const { data: freshMarks } = await supabase
        .from('marks')
        .select('*')
        .eq('exam_id', selectedExamId)
        .eq('subject_id', selectedSubjectId)
      const map = {}
      ;(freshMarks || []).forEach(m => { map[m.student_id] = m })
      setMarksData(map)
      setHasChanges(false)
      showToast('Marks saved successfully', 'success')
    } catch (err) {
      console.error('Save error:', err)
      showToast('Failed to save. ' + (err.message || ''), 'error')
    } finally {
      setSaving(false)
    }
  }

  const enteredCount = useMemo(() =>
    students.filter(s => { const m = marksData[s.id]; return m && m.id && !m.is_absent }).length,
    [students, marksData]
  )
  const absentCount = useMemo(() =>
    students.filter(s => { const m = marksData[s.id]; return m && m.is_absent }).length,
    [students, marksData]
  )

  const formatExamLabel = (exam) => {
    const y = exam.academic_years?.year_name || ''
    const t = exam.terms?.term_name || ''
    return `${exam.name} (${t} ${y})`
  }

  const Placeholder = ({ title, msg }) => (
    <div className="bg-white rounded-xl border border-gray-200 p-8 sm:p-10 text-center">
      <svg className="w-10 h-10 sm:w-12 sm:h-12 text-gray-200 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
      </svg>
      <h3 className="text-sm font-semibold text-gray-700 mb-1">{title}</h3>
      <p className="text-xs text-gray-400">{msg}</p>
    </div>
  )

  if (loading && !selectedExamId && !selectedStreamId) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-3 border-gray-200 border-t-maroon-600 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Enter Marks</h1>
        {contextStr && (
          <p className="text-sm text-maroon-600 font-medium mt-1.5 truncate">{contextStr}</p>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 mb-6">
        <div className="space-y-3 sm:space-y-0 sm:grid sm:grid-cols-3 sm:gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Examination</label>
            <select
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
              className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-maroon-400 focus:ring-4 focus:ring-maroon-500/10 transition"
            >
              <option value="">-- Select Exam --</option>
              {exams.length === 0 && <option value="" disabled>No exams in mark entry stage</option>}
              {exams.map(exam => (
                <option key={exam.id} value={exam.id}>{formatExamLabel(exam)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Subject</label>
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              disabled={!selectedExamId}
              className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-maroon-400 focus:ring-4 focus:ring-maroon-500/10 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">-- Select Subject --</option>
              {subjectOptions.map(sub => (
                <option key={sub.id} value={sub.id}>{sub.subject_name} ({sub.subject_code})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Class Stream</label>
            <select
              value={selectedStreamId}
              onChange={(e) => setSelectedStreamId(e.target.value)}
              disabled={!selectedSubjectId}
              className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-maroon-400 focus:ring-4 focus:ring-maroon-500/10 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">-- Select Stream --</option>
              {streamOptions.map(cs => (
                <option key={cs.id} value={cs.id}>{getStreamLabel(cs)}</option>
              ))}
            </select>
          </div>
        </div>

        {selectedExam && (
          <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-3 text-xs text-gray-500">
            <span>Type: {selectedExam.exam_type}</span>
            {selectedExam.has_practical && <span className="text-blue-600 font-medium">Has Practical</span>}
            {selectedSubject?.has_practical && <span className="text-amber-600 font-medium">Subject has Practical</span>}
          </div>
        )}
      </div>

      {/* No stream selected */}
      {!selectedStreamId && <Placeholder title="Select filters above" msg="Choose an exam, subject, and class stream to begin entering marks." />}

      {selectedStreamId && loading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-3 border-gray-200 border-t-maroon-600 rounded-full animate-spin" />
        </div>
      )}

      {selectedStreamId && !loading && students.length === 0 && (
        <Placeholder title="No students found" msg="There are no active students in this class stream." />
      )}

      {/* Marks Entry */}
      {selectedStreamId && !loading && students.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Summary bar */}
          <div className="px-4 sm:px-5 py-3 bg-gray-50 border-b border-gray-100 flex flex-wrap items-center gap-2 justify-between">
            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
              <span className="font-medium text-gray-700">{students.length} students</span>
              {enteredCount > 0 && <span className="text-emerald-600">{enteredCount} entered</span>}
              {absentCount > 0 && <span className="text-red-500">{absentCount} absent</span>}
              {hasChanges && <span className="text-amber-600 font-medium">Unsaved</span>}
            </div>
            <div className="flex items-center gap-2">
              {hasChanges && (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 bg-maroon-600 text-white text-sm font-medium rounded-lg hover:bg-maroon-700 disabled:opacity-50 transition flex items-center gap-2"
                >
                  {saving ? (
                    <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</>
                  ) : (
                    <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>Save</>
                  )}
                </button>
              )}
            </div>
          </div>

          {noAssignMsg ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <svg className="w-12 h-12 text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <p className="text-sm text-gray-500">{noAssignMsg}</p>
              <p className="text-xs text-gray-400 mt-1">Assign students to this subject first in the Students or Class Subjects page.</p>
            </div>
          ) : (
          /* Table: same on mobile & desktop */
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-2 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-8">#</th>
                  <th className="text-left px-2 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider min-w-[120px]">Student Name</th>
                  <th className="text-left px-2 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-16">Adm No</th>
                  <th className="text-center px-2 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider min-w-[80px]">
                    Theory <span className="text-[10px] font-normal text-gray-400">(100)</span>
                    {showPractical && <span className="block text-[10px] font-normal text-gray-400">marks</span>}
                  </th>
                  {showPractical && (
                    <th className="text-center px-2 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider min-w-[80px]">
                      Pract <span className="text-[10px] font-normal text-gray-400">(50)</span>
                      <span className="block text-[10px] font-normal text-gray-400">prac</span>
                    </th>
                  )}
                  <th className="text-center px-2 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-14">Absent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {students.map((s, idx) => {
                  const m = marksData[s.id] || {}
                  const isAbsent = m.is_absent || false
                  return (
                    <tr key={s.id} className={`hover:bg-gray-50 transition ${isAbsent ? 'bg-red-50/30' : ''}`}>
                      <td className="px-3 py-2 text-xs text-gray-400 align-middle">{idx + 1}</td>
                      <td className="px-3 py-2 align-middle">
                        <p className="text-sm font-medium text-gray-900 whitespace-nowrap">
                          {[s.surname, s.first_name, s.middle_name].filter(Boolean).join(' ')}
                        </p>
                      </td>
                      <td className="px-3 py-2 align-middle">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">{s.admission_number}</span>
                      </td>
                      <td className="px-3 py-2 text-center align-middle">
                        {isAbsent ? (
                          <span className="inline-flex items-center justify-center w-full py-1.5 text-xs font-bold text-red-500 tracking-wider">ABS</span>
                        ) : (
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step="0.5"
                            inputMode="decimal"
                            value={m.marks_obtained != null ? m.marks_obtained : ''}
                            onChange={(e) => updateMark(s.id, 'marks_obtained', e.target.value)}
                            className="w-full max-w-[80px] sm:max-w-[90px] mx-auto py-2 sm:py-1.5 px-2 text-center text-sm bg-white border border-gray-200 rounded-lg outline-none focus:border-maroon-400 focus:ring-4 focus:ring-maroon-500/10 transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            placeholder="--"
                          />
                        )}
                      </td>
                      {showPractical && (
                        <td className="px-3 py-2 text-center align-middle">
                          {isAbsent ? (
                            <span className="inline-flex items-center justify-center w-full py-1.5 text-xs font-bold text-red-500 tracking-wider">ABS</span>
                          ) : (
                            <input
                              type="number"
                              min={0}
                              max={50}
                              step="0.5"
                              inputMode="decimal"
                              value={m.practical_marks != null ? m.practical_marks : ''}
                              onChange={(e) => updateMark(s.id, 'practical_marks', e.target.value)}
                              className="w-full max-w-[80px] sm:max-w-[90px] mx-auto py-2 sm:py-1.5 px-2 text-center text-sm bg-white border border-gray-200 rounded-lg outline-none focus:border-maroon-400 focus:ring-4 focus:ring-maroon-500/10 transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              placeholder="--"
                            />
                          )}
                        </td>
                      )}
                      <td className="px-3 py-2 text-center align-middle">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isAbsent}
                            onChange={(e) => {
                              const checked = e.target.checked
                              setMarksData(prev => {
                                const cur = prev[s.id] || { student_id: s.id }
                                return { ...prev, [s.id]: { ...cur, is_absent: checked, ...(checked ? { marks_obtained: '', practical_marks: '' } : {}) } }
                              })
                              setHasChanges(true)
                            }}
                            className="sr-only peer"
                          />
                          <div className="w-10 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-maroon-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-400" />
                        </label>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          )}
          <div className="px-4 sm:px-5 py-3 bg-gray-50 border-t border-gray-100 flex flex-wrap items-center gap-3 justify-between">
            <span className="text-xs text-gray-500">
              {enteredCount + absentCount} of {students.length} students
            </span>
            <button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className="w-full sm:w-auto px-5 py-2.5 bg-maroon-600 text-white text-sm font-medium rounded-lg hover:bg-maroon-700 disabled:opacity-50 transition flex items-center justify-center gap-2"
            >
              {saving ? (
                <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</>
              ) : (
                <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>Save All Marks</>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default EnterMarks
