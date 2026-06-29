import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { useNotification } from '../../context/NotificationContext'
import { sortSubjectsByNectaCode } from '../../lib/subjectUtils'

const Placeholder = ({ title, msg }) => (
  <div className="bg-white rounded-xl border border-gray-200 p-8 sm:p-10 text-center">
    <svg className="w-10 h-10 sm:w-12 sm:h-12 text-gray-200 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
    </svg>
    <h3 className="text-sm font-semibold text-gray-700 mb-1">{title}</h3>
    <p className="text-xs text-gray-400">{msg}</p>
  </div>
)

const SkeletonBlock = ({ className }) => (
  <div className={`bg-gray-200 rounded-lg animate-pulse ${className}`} />
)

const FilterSkeleton = () => (
  <div className="animate-pulse space-y-6">
    <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
      <div className="space-y-3 sm:space-y-0 sm:grid sm:grid-cols-3 sm:gap-4">
        {[1, 2, 3].map(i => (
          <div key={i}>
            <SkeletonBlock className="h-3 w-16 mb-1.5" />
            <SkeletonBlock className="h-[42px] w-full rounded-xl" />
          </div>
        ))}
      </div>
    </div>
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 sm:px-5 py-3">
        <SkeletonBlock className="h-4 w-32" />
      </div>
      <div className="px-4 sm:px-5 pb-4 space-y-3">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="flex items-center gap-3">
            <SkeletonBlock className="h-4 w-6 rounded" />
            <SkeletonBlock className="h-5 flex-1 rounded" />
            <SkeletonBlock className="h-5 w-16 rounded" />
            <SkeletonBlock className="h-9 w-20 rounded-lg" />
            <SkeletonBlock className="h-6 w-10 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  </div>
)

const TableSkeleton = () => (
  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden animate-pulse">
    <div className="px-4 sm:px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-3">
      <SkeletonBlock className="h-4 w-24" />
      <SkeletonBlock className="h-4 w-20" />
      <SkeletonBlock className="h-4 w-16" />
    </div>
    <div className="divide-y divide-gray-100 px-4 sm:px-5 py-2">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="flex items-center gap-3 py-2.5">
          <SkeletonBlock className="h-4 w-6 rounded" />
          <SkeletonBlock className="h-5 flex-1 rounded" />
          <SkeletonBlock className="h-5 w-16 rounded" />
          <SkeletonBlock className="h-9 w-20 rounded-lg" />
          <SkeletonBlock className="h-6 w-10 rounded-full" />
        </div>
      ))}
    </div>
    <div className="px-4 sm:px-5 py-3 bg-gray-50 border-t border-gray-100">
      <SkeletonBlock className="h-4 w-40" />
    </div>
  </div>
)

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
          const level = examLevels[0] || 'O_LEVEL'
          setSubjectOptions(sortSubjectsByNectaCode(subs || [], level))
        }
      } catch (err) {
        console.error('Load subjects error:', err)
      }
    }
    loadSubjects()
  }, [selectedExamId, exams, examClassesMap, teacherAssignments, isAcademic, classes])

  // ------- When subject changes, load class/stream options -------
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

    const buildOptions = (classStreamRows) => {
      // For O-Level classes → one synthetic class-wide entry per class
      // For A-Level classes → individual stream rows
      const seen = new Set()
      const opts = []
      classStreamRows.forEach(cs => {
        const cls = classes.find(c => c.id === cs.class_id) || cs.classes
        const isOLevel = cls?.level !== 'A_LEVEL'
        if (isOLevel) {
          if (!seen.has(cs.class_id)) {
            seen.add(cs.class_id)
            opts.push({ id: `__class__${cs.class_id}`, class_id: cs.class_id, _isOLevel: true })
          }
        } else {
          opts.push(cs)
        }
      })
      return opts
    }

    const loadOptions = async () => {
      try {
        let rows = []
        if (!isAcademic) {
          teacherAssignments
            .filter(a => a.subject_id === selectedSubjectId && classIds.includes(a.class_streams?.class_id))
            .forEach(a => { if (a.class_streams) rows.push(a.class_streams) })
        } else {
          let q = supabase.from('class_streams').select('*, classes(*), streams(*)').in('class_id', classIds).order('class_id')
          if (sub?.level) q = q.eq('classes.level', sub.level)
          const { data: cs } = await q
          rows = cs || []
        }
        const opts = buildOptions(rows)
        setStreamOptions(opts)
        // Auto-select when there is only one option
        if (opts.length === 1) setSelectedStreamId(opts[0].id)
      } catch (err) {
        console.error('Load class/stream options error:', err)
      }
    }
    loadOptions()
  }, [selectedSubjectId, selectedExamId, examClassesMap, subjectOptions, teacherAssignments, isAcademic, classes])

  // ------- When stream changes, load students & marks -------
  useEffect(() => {
    setStudents([])
    setMarksData({})
    setHasChanges(false)
    if (!selectedExamId || !selectedSubjectId || !selectedStreamId) return

    const isClassWide = selectedStreamId.startsWith('__class__')
    const classWideClassId = isClassWide ? selectedStreamId.replace('__class__', '') : null

    const loadStudentsAndMarks = async () => {
      setLoading(true)
      setNoAssignMsg('')
      try {
        // Determine class_id and stream IDs
        let classId
        let streamIds = []

        if (isClassWide) {
          classId = classWideClassId
          // A-Level "whole class" needs stream IDs; O-Level will query by class_id directly
          streamIds = streamOptions.filter(cs => cs.class_id === classWideClassId && !cs._isOLevel).map(cs => cs.id)
          if (streamIds.length === 0 && classes.find(c => c.id === classWideClassId)?.level === 'A_LEVEL') {
            const { data: csRows } = await supabase.from('class_streams').select('id').eq('class_id', classWideClassId)
            streamIds = (csRows || []).map(r => r.id)
          }
        } else {
          const { data: csRow } = await supabase.from('class_streams').select('class_id').eq('id', selectedStreamId).single()
          classId = csRow?.class_id
          streamIds = [selectedStreamId]
        }

        // Check if subject is excluded for this class
        if (classId) {
          const { data: excl } = await supabase
            .from('class_excluded_subjects')
            .select('id')
            .eq('class_id', classId)
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

        const isOLevel = classes.find(c => c.id === classId)?.level !== 'A_LEVEL'

        const mRes = await supabase
          .from('marks')
          .select('*')
          .eq('exam_id', selectedExamId)
          .eq('subject_id', selectedSubjectId)
          .limit(500)

        let studsQuery = supabase.from('students').select('*').eq('status', 'active')

        if (isClassWide && isOLevel) {
          // O-Level: all students in the class take all O-Level subjects — filter by class_id only
          studsQuery = studsQuery.eq('class_id', classId)
        } else {
          // A-Level / individual stream: filter by stream then by subject assignment
          studsQuery = studsQuery.in('class_stream_id', streamIds)
          // Fetch student IDs in these streams to keep the subject assignment filter small
          const streamStudentIds = streamIds.length > 0
            ? ((await supabase.from('students').select('id').in('class_stream_id', streamIds).eq('status', 'active').limit(500)).data || []).map(r => r.id)
            : []
          const { data: ssRows } = streamStudentIds.length > 0
            ? await supabase.from('student_subjects').select('student_id').eq('subject_id', selectedSubjectId).in('student_id', streamStudentIds)
            : { data: [] }
          const assignedIds = (ssRows || []).map(r => r.student_id)
          if (assignedIds.length === 0) {
            const { count } = await supabase
              .from('student_subjects').select('*', { count: 'exact', head: true })
              .eq('subject_id', selectedSubjectId).limit(1)
            if (count > 0) {
              setStudents([])
              setMarksData({})
              setNoAssignMsg('No students have been assigned to this subject.')
              setLoading(false)
              return
            }
          } else {
            studsQuery = studsQuery.in('id', assignedIds)
          }
        }

        const { data: studs } = await studsQuery

        // Sort: girls (Female) first alphabetically, then boys alphabetically
        const sorted = (studs || []).slice().sort((a, b) => {
          const gA = a.gender === 'Female' ? 0 : 1
          const gB = b.gender === 'Female' ? 0 : 1
          if (gA !== gB) return gA - gB
          const s1 = (a.first_name || '').localeCompare(b.first_name || '')
          if (s1 !== 0) return s1
          const s2 = (a.middle_name || '').localeCompare(b.middle_name || '')
          return s2 !== 0 ? s2 : (a.surname || '').localeCompare(b.surname || '')
        })
        setStudents(sorted)

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
  }, [selectedStreamId, selectedSubjectId, selectedExamId, streamOptions])

  // ------- Helpers -------
  const getStreamLabel = (cs) => {
    const cls = classes.find(c => c.id === cs.class_id)
    const str = streams.find(s => s.id === cs.stream_id)
    if (cls && str) return `${cls.class_name} - ${str.stream_name}`
    if (cls) return cls.class_name
    return 'Unknown'
  }

  const isClassWide = selectedStreamId.startsWith('__class__')
  const classWideClassId = isClassWide ? selectedStreamId.replace('__class__', '') : null
  const selectedStream = isClassWide ? null : streamOptions.find(s => s.id === selectedStreamId)
  const contextClass = isClassWide
    ? classes.find(c => c.id === classWideClassId)
    : selectedStream ? classes.find(c => c.id === selectedStream.class_id) : null
  const contextIsOLevel = contextClass?.level !== 'A_LEVEL'
  const contextStr = selectedExam && selectedSubject && (isClassWide || selectedStream)
    ? isClassWide
      ? contextIsOLevel
        ? `${contextClass?.class_name || '?'} › ${selectedSubject.subject_name} › ${selectedExam.name}`
        : `${contextClass?.class_name || '?'} (All Streams) › ${selectedSubject.subject_name} › ${selectedExam.name}`
      : `${contextClass?.class_name || '?'} ${streams.find(s => s.id === selectedStream.stream_id)?.stream_name || ''} › ${selectedSubject.subject_name} › ${selectedExam.name}`
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

  if (loading && !selectedExamId && !selectedStreamId) {
    return (
      <div>
        <div className="mb-6">
          <SkeletonBlock className="h-7 w-36 mb-2" />
        </div>
        <FilterSkeleton />
      </div>
    )
  }

  return (
    <div className={hasChanges ? 'pb-24 md:pb-0' : ''}>
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
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              {selectedSubject?.level === 'O_LEVEL' ? 'Class' : 'Class / Stream'}
            </label>
            <select
              value={selectedStreamId}
              onChange={(e) => setSelectedStreamId(e.target.value)}
              disabled={!selectedSubjectId}
              className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-maroon-400 focus:ring-4 focus:ring-maroon-500/10 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">
                {selectedSubject?.level === 'O_LEVEL' ? '-- Select Class --' : '-- Select Stream --'}
              </option>
              {streamOptions.map(opt => (
                <option key={opt.id} value={opt.id}>
                  {opt._isOLevel
                    ? classes.find(c => c.id === opt.class_id)?.class_name || '?'
                    : getStreamLabel(opt)
                  }
                </option>
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

      {/* No class/stream selected */}
      {!selectedStreamId && <Placeholder title="Select filters above" msg="Choose an exam, subject, and class to begin entering marks." />}

      {selectedStreamId && loading && <TableSkeleton />}

      {selectedStreamId && !loading && (
        <>
          {noAssignMsg ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <svg className="w-12 h-12 text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <p className="text-sm text-gray-500">{noAssignMsg}</p>
              <p className="text-xs text-gray-400 mt-1">Assign students to this subject first in the Students or Class Subjects page.</p>
            </div>
          ) : students.length === 0 ? (
            <Placeholder title="No students found" msg="There are no active students in this class stream." />
          ) : (
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

            {/* ── Mobile card layout (phones) ── */}
            <div className="md:hidden divide-y divide-gray-100">
              {students.map((s, idx) => {
                const m = marksData[s.id] || {}
                const isAbsent = m.is_absent || false
                return (
                  <div key={s.id} className={`px-4 py-4 ${isAbsent ? 'bg-red-50/40' : ''}`}>
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] text-gray-400 mb-0.5 font-medium tracking-wide">#{idx + 1}</p>
                        <p className={`text-sm font-semibold leading-snug ${isAbsent ? 'text-red-600 line-through' : 'text-gray-900'}`}>
                          {[s.first_name, s.middle_name, s.surname].filter(Boolean).join(' ')}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-xs text-gray-500">Absent</span>
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
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-maroon-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-400" />
                        </label>
                      </div>
                    </div>
                    {isAbsent ? (
                      <div className="flex items-center justify-center py-2.5 rounded-xl bg-red-100/60 border border-red-200/60">
                        <span className="text-sm font-bold text-red-500 tracking-widest">ABSENT</span>
                      </div>
                    ) : (
                      <div className={`grid gap-3 ${showPractical ? 'grid-cols-2' : 'grid-cols-1'}`}>
                        <div>
                          <label className="text-xs font-medium text-gray-500 block mb-1.5">
                            Theory <span className="font-normal text-gray-400">(0 – 100)</span>
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step="0.5"
                            inputMode="decimal"
                            value={m.marks_obtained != null ? m.marks_obtained : ''}
                            onChange={(e) => updateMark(s.id, 'marks_obtained', e.target.value)}
                            className="w-full h-14 text-center text-2xl font-semibold bg-white border-2 border-gray-200 rounded-xl outline-none focus:border-maroon-400 focus:ring-4 focus:ring-maroon-500/10 transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            placeholder="—"
                          />
                        </div>
                        {showPractical && (
                          <div>
                            <label className="text-xs font-medium text-gray-500 block mb-1.5">
                              Practical <span className="font-normal text-gray-400">(0 – 50)</span>
                            </label>
                            <input
                              type="number"
                              min={0}
                              max={50}
                              step="0.5"
                              inputMode="decimal"
                              value={m.practical_marks != null ? m.practical_marks : ''}
                              onChange={(e) => updateMark(s.id, 'practical_marks', e.target.value)}
                              className="w-full h-14 text-center text-2xl font-semibold bg-white border-2 border-gray-200 rounded-xl outline-none focus:border-maroon-400 focus:ring-4 focus:ring-maroon-500/10 transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              placeholder="—"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* ── Desktop table layout ── */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left px-2 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-8">#</th>
                    <th className="text-left px-2 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider min-w-[120px]">Student Name</th>
                  <th className="text-center px-2 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider min-w-[80px]">
                    Theory <span className="text-[10px] font-normal text-gray-400">(100)</span>
                    {showPractical && <span className="block text-[10px] font-normal text-gray-400">marks</span>}
                  </th>
                  {showPractical && (
                    <th className="text-center px-2 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider min-w-[90px]">
                      Practical <span className="text-[10px] font-normal text-gray-400">(50)</span>
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
                          {[s.first_name, s.middle_name, s.surname].filter(Boolean).join(' ')}
                        </p>
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
                            className="w-full max-w-[100px] mx-auto py-2 px-2 text-center text-sm bg-white border border-gray-200 rounded-lg outline-none focus:border-maroon-400 focus:ring-4 focus:ring-maroon-500/10 transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
                              className="w-full max-w-[100px] mx-auto py-2 px-2 text-center text-sm bg-white border border-gray-200 rounded-lg outline-none focus:border-maroon-400 focus:ring-4 focus:ring-maroon-500/10 transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
            </div>{/* end desktop table */}
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
    </>
  )}

      {/* Sticky save bar — mobile only, shown when there are unsaved changes */}
      {hasChanges && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 p-3 bg-white/95 backdrop-blur-sm border-t border-gray-200 shadow-lg">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-4 bg-maroon-600 text-white font-bold rounded-xl text-base flex items-center justify-center gap-2 active:bg-maroon-700 transition disabled:opacity-50"
          >
            {saving ? (
              <><span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</>
            ) : (
              <><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg> Save All Marks</>
            )}
          </button>
        </div>
      )}
    </div>
  )
}

export default EnterMarks
