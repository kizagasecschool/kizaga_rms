import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import Modal from '../../components/Modal'
import { useNotification } from '../../context/NotificationContext'
import { useAuth } from '../../context/AuthContext'

const EXAM_TYPES = ['WEEKLY','MONTHLY','MIDTERM_1','TERMINAL','MIDTERM_2','ANNUAL','SERIES_1','SERIES_2','SERIES_3','MOCK','PRE_NATIONAL']
const STATUS_OPTIONS = ['draft','entering_marks','processed','published','locked']

const STATUS_META = {
  draft:          { label: 'Draft',          color: 'bg-gray-100 text-gray-600',     dot: 'bg-gray-400' },
  entering_marks: { label: 'Entering Marks', color: 'bg-amber-50 text-amber-700',    dot: 'bg-amber-500' },
  processed:      { label: 'Processed',      color: 'bg-blue-50 text-blue-700',      dot: 'bg-blue-500' },
  published:      { label: 'Published',      color: 'bg-emerald-50 text-emerald-700',dot: 'bg-emerald-500' },
  locked:         { label: 'Locked',         color: 'bg-rose-50 text-rose-700',      dot: 'bg-rose-500' },
}

function StatusBadge({ status }) {
  const m = STATUS_META[status] || STATUS_META.draft
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${m.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  )
}

function InfoRow({ icon, label, value }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="text-gray-400 mt-0.5 shrink-0">{icon}</span>
      <div>
        <span className="text-gray-500 text-xs">{label}</span>
        <p className="text-gray-800 font-medium leading-tight">{value || '-'}</p>
      </div>
    </div>
  )
}

function AcademicExams() {
  const { showToast } = useNotification()
  const { profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [exams, setExams] = useState([])
  const [classes, setClasses] = useState([])
  const [academicYears, setAcademicYears] = useState([])
  const [terms, setTerms] = useState([])
  const [examClasses, setExamClasses] = useState([])
  const [schoolInfo, setSchoolInfo] = useState(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingExam, setEditingExam] = useState(null)
  const [formData, setFormData] = useState({})
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [processConfirm, setProcessConfirm] = useState(null)
  const [processing, setProcessing] = useState(false)
  const [processProgress, setProcessProgress] = useState('')
  const [reopenConfirm, setReopenConfirm] = useState(null)
  const [reopening, setReopening] = useState(false)

  const [attendanceModal, setAttendanceModal] = useState(null)
  const [printingAttendance, setPrintingAttendance] = useState(false)

  const fetchExams = useCallback(async () => {
    const { data } = await supabase
      .from('exams')
      .select('*, term:term_id(id,term_name), academic_year:academic_year_id(id,year_name)')
      .order('created_at', { ascending: false })
      .limit(500)
    if (data) setExams(data)
  }, [])

  const fetchClasses   = useCallback(async () => { const { data } = await supabase.from('classes').select('*').order('sort_order').limit(50); if (data) setClasses(data) }, [])
  const fetchYears     = useCallback(async () => { const { data } = await supabase.from('academic_years').select('*').order('year_name', { ascending: false }).limit(20); if (data) setAcademicYears(data) }, [])
  const fetchTerms     = useCallback(async () => { const { data } = await supabase.from('terms').select('*').order('term_name').limit(20); if (data) setTerms(data) }, [])
  const fetchExamClasses = useCallback(async () => {
    const PAGE = 1000
    let from = 0
    const all = []
    while (true) {
      const { data } = await supabase.from('exam_classes').select('*').range(from, from + PAGE - 1)
      if (!data || !data.length) break
      all.push(...data)
      if (data.length < PAGE) break
      from += PAGE
    }
    setExamClasses(all)
  }, [])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      await Promise.all([fetchExams(), fetchClasses(), fetchYears(), fetchTerms(), fetchExamClasses()])
      const { data: sch } = await supabase.from('school_settings').select('*').limit(1)
      if (sch?.[0]) setSchoolInfo(sch[0])
      setLoading(false)
    }
    load()
  }, [fetchExams, fetchClasses, fetchYears, fetchTerms, fetchExamClasses])

  const getExamClasses = (examId) => {
    const ids = examClasses.filter(ec => ec.exam_id === examId).map(ec => ec.class_id)
    return classes.filter(c => ids.includes(c.id))
  }

  const openCreate = () => {
    setEditingExam(null)
    const activeYear = academicYears.find(y => y.is_active)
    const activeTerm = terms.find(t => t.is_active)
    setFormData({ name:'', exam_type:'MONTHLY', term_id: activeTerm?.id||'', academic_year_id: activeYear?.id||'', start_date:'', end_date:'', has_practical: false, status:'draft', class_ids:[] })
    setModalOpen(true)
  }

  const openEdit = (exam) => {
    setEditingExam(exam)
    const assigned = examClasses.filter(ec => ec.exam_id === exam.id).map(ec => ec.class_id)
    setFormData({ name: exam.name, exam_type: exam.exam_type, term_id: exam.term_id, academic_year_id: exam.academic_year_id, start_date: exam.start_date||'', end_date: exam.end_date||'', has_practical: exam.has_practical||false, status: exam.status, class_ids: assigned })
    setModalOpen(true)
  }

  const toggleClass = (id) => setFormData(p => {
    const ids = p.class_ids || []
    return { ...p, class_ids: ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id] }
  })

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = { name: formData.name, exam_type: formData.exam_type, term_id: formData.term_id, academic_year_id: formData.academic_year_id, start_date: formData.start_date||null, end_date: formData.end_date||null, has_practical: formData.has_practical, status: formData.status }
      if (editingExam) {
        const { error } = await supabase.from('exams').update(payload).eq('id', editingExam.id)
        if (error) throw error
        await syncExamClasses(editingExam.id)
      } else {
        const { data, error } = await supabase.from('exams').insert(payload).select('id').single()
        if (error) throw error
        await syncExamClasses(data.id)
        supabase.rpc('notify_exam_teachers', { p_exam_id: data.id, p_sender_id: profile.id, p_title: `New Exam: ${formData.name}`, p_message: `A new ${formData.exam_type} exam "${formData.name}" has been created.`, p_type: 'exam_created', p_link: '/academic/exams' })
      }
      await fetchExams(); await fetchExamClasses()
      setModalOpen(false)
      showToast(editingExam ? 'Exam updated' : 'Exam created', 'success')
    } catch (err) { showToast('Failed to save. ' + (err.message||''), 'error') }
    finally { setSaving(false) }
  }

  const syncExamClasses = async (examId) => {
    const sel = formData.class_ids || []
    const existing = examClasses.filter(ec => ec.exam_id === examId).map(ec => ec.class_id)
    const toRemove = existing.filter(id => !sel.includes(id))
    const toAdd = sel.filter(id => !existing.includes(id))
    if (toRemove.length) await supabase.from('exam_classes').delete().eq('exam_id', examId).in('class_id', toRemove)
    if (toAdd.length) await supabase.from('exam_classes').insert(toAdd.map(classId => ({ exam_id: examId, class_id: classId })))
  }

  const handleDelete = async (id) => {
    try {
      const { error } = await supabase.from('exams').delete().eq('id', id)
      if (error) throw error
      await fetchExams(); await fetchExamClasses()
      setDeleteConfirm(null)
      showToast('Exam deleted', 'success')
    } catch (err) { showToast('Failed to delete. ' + (err.message||''), 'error') }
  }

  const handleTransition = async (examId, newStatus) => {
    setSaving(true)
    try {
      const { error } = await supabase.from('exams').update({ status: newStatus }).eq('id', examId)
      if (error) throw error
      await fetchExams()
      showToast(`Status changed to ${newStatus.replace(/_/g,' ')}`, 'success')
    } catch (err) { showToast('Failed. ' + (err.message||''), 'error') }
    finally { setSaving(false) }
  }

  const handleReopen = async (exam) => {
    setReopening(true)
    try {
      const { error } = await supabase.from('exams').update({ status: 'entering_marks' }).eq('id', exam.id)
      if (error) throw error
      await fetchExams()
      setReopenConfirm(null)
      showToast(`"${exam.name}" re-opened for mark entry`, 'success')
    } catch (err) {
      showToast('Failed to re-open. ' + (err.message || ''), 'error')
    } finally {
      setReopening(false)
    }
  }

  const executeProcess = async (exam, reprocess = false) => {
    setProcessing(true)
    setProcessProgress(reprocess ? 'Reprocessing results...' : 'Processing results...')
    try {
      const { error: pe } = await supabase.rpc('process_exam', { p_exam_id: exam.id })
      if (pe) throw pe
      if (!reprocess) {
        const { error: te } = await supabase.from('exams').update({ status: 'processed' }).eq('id', exam.id)
        if (te) throw te
        supabase.rpc('notify_exam_teachers', { p_exam_id: exam.id, p_sender_id: profile.id, p_title: `Results Processed: ${exam.name}`, p_message: `Results for "${exam.name}" are now available.`, p_type: 'results_processed', p_link: '/academic/exams' })
      }
      await fetchExams(); setProcessConfirm(null)
      showToast(reprocess ? 'Reprocessed successfully' : 'Processed successfully', 'success')
    } catch (err) { showToast(`Failed. ${err.message||''}`, 'error') }
    finally { setProcessing(false); setProcessProgress('') }
  }

  const getNextStatuses = (current) => {
    switch (current) {
      case 'draft': return [{ status:'entering_marks', label:'Open for Marks', color:'bg-amber-600 hover:bg-amber-700' }]
      case 'entering_marks': return [{ status:'processed', label:'Process Results', color:'bg-blue-600 hover:bg-blue-700' }]
      case 'processed': return [{ status:'published', label:'Publish', color:'bg-emerald-600 hover:bg-emerald-700' }]
      case 'published': return [{ status:'locked', label:'Lock', color:'bg-rose-600 hover:bg-rose-700' }]
      default: return []
    }
  }

  const handlePrintAttendance = async (exam, classId) => {
    setPrintingAttendance(true)
    try {
      const selectedClass = classes.find(c => c.id === classId)
      const isALevel = selectedClass?.level === 'A_LEVEL'

      // Pre-fetch logo as base64 so it prints reliably in popup window
      const logoBase64 = await fetchImageAsBase64(schoolInfo?.logo_url)

      if (isALevel) {
        // Fetch all class_streams for this class, joining streams table for the name
        const { data: classStreamsData, error: csErr } = await supabase
          .from('class_streams')
          .select('id, stream:stream_id(id, stream_name)')
          .eq('class_id', classId)

        if (csErr) throw csErr
        const classStreamsList = classStreamsData || []

        // Fetch all stream_combinations + combination_subjects in parallel
        // combinations table uses 'name' and 'code' columns (not 'combination_name')
        const [scRes, combSubRes] = await Promise.all([
          supabase.from('stream_combinations').select('class_stream_id, combination_id, combination:combination_id(id, name, code)'),
          supabase.from('combination_subjects').select('combination_id, subject_role, subject_id, subject:subject_id(id, subject_name, subject_code)'),
        ])

        const scRows = scRes.data || []
        const combSubRows = combSubRes.data || []

        const streamGroups = []

        for (const cs of classStreamsList) {
          const streamLetter = cs.stream?.stream_name || ''

          // Find this class_stream's combination via stream_combinations
          let combinationId = null
          let combinationCode = null
          const scRow = scRows.find(r => r.class_stream_id === cs.id)
          if (scRow?.combination) {
            combinationId = scRow.combination.id
            combinationCode = scRow.combination.code || scRow.combination.name
          } else {
            // Fallback: find combination from any student in this stream via student_combinations
            const { data: stuCombo } = await supabase
              .from('student_combinations')
              .select('combination_id, combination:combination_id(id, name, code)')
              .eq('student_id',
                (await supabase.from('students').select('id').eq('class_stream_id', cs.id).eq('status','active').limit(1))
                  .data?.[0]?.id
              )
              .limit(1)
              .single()
            if (stuCombo?.combination) {
              combinationId = stuCombo.combination.id
              combinationCode = stuCombo.combination.code || stuCombo.combination.name
            }
          }

          if (!combinationId) continue

          // Build subjects list for this combination
          const subjects = combSubRows
            .filter(r => r.combination_id === combinationId && r.subject)
            .map(r => ({ ...r.subject, subject_role: r.subject_role }))
            .sort((a, b) => {
              const roleOrder = { CORE: 0, SUBSIDIARY: 1, OPTIONAL: 2 }
              const ro = (roleOrder[a.subject_role] ?? 3) - (roleOrder[b.subject_role] ?? 3)
              return ro !== 0 ? ro : (a.subject_name||'').localeCompare(b.subject_name||'')
            })

          // Get students in this stream
          const { data: stuData } = await supabase
            .from('students')
            .select('id, first_name, middle_name, surname, gender')
            .eq('class_stream_id', cs.id)
            .eq('status', 'active')

          const students = (stuData || []).sort((a, b) => {
            const gA = a.gender === 'Female' ? 0 : 1
            const gB = b.gender === 'Female' ? 0 : 1
            if (gA !== gB) return gA - gB
            const s1 = (a.first_name||'').localeCompare(b.first_name||'')
            if (s1 !== 0) return s1
            const s2 = (a.middle_name||'').localeCompare(b.middle_name||'')
            return s2 !== 0 ? s2 : (a.surname||'').localeCompare(b.surname||'')
          })

          if (subjects.length > 0 && students.length > 0) {
            streamGroups.push({
              streamName: `Stream ${streamLetter}${combinationCode ? ` – ${combinationCode}` : ''}`,
              combinationCode,
              subjects,
              students,
            })
          }
        }

        if (streamGroups.length === 0) {
          showToast('No streams with students found. Check that streams have combinations and students assigned.', 'error')
          return
        }

        openAttendancePrintWindow({ exam, selectedClass, streamGroups, schoolInfo, logoBase64, isALevel: true })
      } else {
        // O-Level: all students in class, all class subjects minus excluded
        const { data: stuData } = await supabase
          .from('students').select('*').eq('class_id', classId).eq('status', 'active').limit(200)
        const students = (stuData || []).sort((a, b) => {
          const gA = a.gender === 'Female' ? 0 : 1
          const gB = b.gender === 'Female' ? 0 : 1
          if (gA !== gB) return gA - gB
          const s = (a.surname||'').localeCompare(b.surname||'')
          return s !== 0 ? s : (a.first_name||'').localeCompare(b.first_name||'')
        })

        const [{ data: subjectsData }, { data: excludedData }] = await Promise.all([
          supabase.from('subjects').select('*').eq('level', 'O_LEVEL').order('subject_name'),
          supabase.from('class_excluded_subjects').select('subject_id').eq('class_id', classId),
        ])
        const excludedIds = new Set((excludedData||[]).map(r => r.subject_id))
        const subjects = (subjectsData||[]).filter(s => !excludedIds.has(s.id))

        openAttendancePrintWindow({ exam, selectedClass, students, subjects, schoolInfo, logoBase64, isALevel: false })
      }
    } catch (err) {
      console.error('Attendance error:', err)
      showToast('Failed to generate attendance sheet', 'error')
    } finally {
      setPrintingAttendance(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-3 border-gray-200 border-t-maroon-600 rounded-full animate-spin" />
      </div>
    )
  }

  const statusCounts = STATUS_OPTIONS.reduce((acc, s) => {
    acc[s] = exams.filter(e => e.status === s).length
    return acc
  }, {})

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Exam Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">Create, manage and track exam workflows</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 bg-maroon-600 text-white text-sm font-semibold rounded-xl hover:bg-maroon-700 transition shadow-sm">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
          Create Exam
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8">
        {STATUS_OPTIONS.map(s => {
          const m = STATUS_META[s]
          return (
            <div key={s} className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-3">
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${m.dot}`} />
              <div>
                <p className="text-xs text-gray-500">{m.label}</p>
                <p className="text-xl font-bold text-gray-900 leading-tight">{statusCounts[s]}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Exam cards */}
      {exams.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 py-20 text-center">
          <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
          </svg>
          <p className="text-gray-400 text-sm">No exams yet. Click "Create Exam" to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {exams.map(exam => {
            const examClassList = getExamClasses(exam.id)
            const nextStatuses = getNextStatuses(exam.status)
            return (
              <div key={exam.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow flex flex-col">
                {/* Card top */}
                <div className="px-5 pt-5 pb-4 border-b border-gray-100">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <h2 className="text-base font-bold text-gray-900 leading-snug truncate" title={exam.name}>{exam.name}</h2>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded">
                          {exam.exam_type.replace(/_/g,' ')}
                        </span>
                        {exam.has_practical && (
                          <span className="px-2 py-0.5 bg-violet-50 text-violet-700 text-xs font-medium rounded">Practical</span>
                        )}
                        <StatusBadge status={exam.status} />
                      </div>
                    </div>
                  </div>

                  {/* Info grid */}
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                    <InfoRow
                      icon={<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5" /></svg>}
                      label="Dates"
                      value={exam.start_date ? `${exam.start_date}${exam.end_date ? ` – ${exam.end_date}` : ''}` : 'Not set'}
                    />
                    <InfoRow
                      icon={<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg>}
                      label="Term / Year"
                      value={`${exam.term?.term_name || '-'} / ${exam.academic_year?.year_name || '-'}`}
                    />
                    <div className="col-span-2">
                      <InfoRow
                        icon={<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21" /></svg>}
                        label="Classes"
                        value={examClassList.length > 0 ? examClassList.map(c => c.class_name).join(', ') : 'No classes assigned'}
                      />
                    </div>
                  </div>
                </div>

                {/* Card actions */}
                <div className="px-5 py-3.5 flex items-center gap-2 flex-wrap">
                  {/* View marks */}
                  <Link
                    to={`/academic/view-marks?examId=${exam.id}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-maroon-700 bg-maroon-50 hover:bg-maroon-100 rounded-lg transition"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    View Marks
                  </Link>

                  {/* Attendance */}
                  {examClassList.length > 0 && (
                    <button
                      onClick={() => setAttendanceModal({ exam, classId: examClassList.length === 1 ? examClassList[0].id : '' })}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" /></svg>
                      Attendance
                    </button>
                  )}

                  {/* Workflow buttons */}
                  {nextStatuses.map(action => (
                    <button
                      key={action.status}
                      disabled={saving || processing}
                      onClick={() => action.status === 'processed' ? setProcessConfirm({ exam, reprocess: false }) : handleTransition(exam.id, action.status)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white rounded-lg transition disabled:opacity-50 ${action.color}`}
                    >
                      {action.label}
                    </button>
                  ))}

                  {/* Reprocess */}
                  {['processed','published'].includes(exam.status) && (
                    <button
                      disabled={saving || processing}
                      onClick={() => setProcessConfirm({ exam, reprocess: true })}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 rounded-lg transition disabled:opacity-50"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
                      Reprocess
                    </button>
                  )}

                  {/* Re-open for mark entry */}
                  {['processed','published'].includes(exam.status) && (
                    <button
                      disabled={saving || processing || reopening}
                      onClick={() => setReopenConfirm(exam)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition disabled:opacity-50"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg>
                      Re-open for Marks
                    </button>
                  )}

                  {/* Spacer */}
                  <div className="flex-1" />

                  {/* Edit / Delete */}
                  {exam.status !== 'locked' && (
                    <>
                      <button onClick={() => openEdit(exam)} className="p-1.5 text-gray-400 hover:text-maroon-600 hover:bg-maroon-50 rounded-lg transition" title="Edit">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg>
                      </button>
                      <button onClick={() => setDeleteConfirm({ id: exam.id, name: exam.name })} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition" title="Delete">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ─── Create / Edit Modal ─── */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingExam ? 'Edit Exam' : 'Create Exam'} className="max-w-2xl">
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Exam Name *</label>
            <input required value={formData.name||''} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Form 4 Terminal Exam 2026"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Exam Type</label>
              <select value={formData.exam_type||'MONTHLY'} onChange={e => setFormData({...formData, exam_type: e.target.value})}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500">
                {EXAM_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select value={formData.status||'draft'} onChange={e => setFormData({...formData, status: e.target.value})}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500">
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Academic Year *</label>
              <select required value={formData.academic_year_id||''} onChange={e => setFormData({...formData, academic_year_id: e.target.value})}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500">
                <option value="">Select year</option>
                {academicYears.map(y => <option key={y.id} value={y.id}>{y.year_name}{y.is_active?' (Active)':''}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Term *</label>
              <select required value={formData.term_id||''} onChange={e => setFormData({...formData, term_id: e.target.value})}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500">
                <option value="">Select term</option>
                {terms.filter(t => !formData.academic_year_id || t.academic_year_id === formData.academic_year_id)
                  .map(t => <option key={t.id} value={t.id}>{t.term_name}{t.is_active?' (Active)':''}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input type="date" value={formData.start_date||''} onChange={e => setFormData({...formData, start_date: e.target.value})}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input type="date" value={formData.end_date||''} onChange={e => setFormData({...formData, end_date: e.target.value})}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500" />
            </div>
          </div>
          <label className="flex items-center gap-3 p-3.5 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-50 transition">
            <input type="checkbox" checked={formData.has_practical||false} onChange={e => setFormData({...formData, has_practical: e.target.checked})}
              className="w-4 h-4 rounded border-gray-300 text-maroon-600 focus:ring-maroon-500" />
            <div>
              <span className="text-sm font-semibold text-gray-900">Has Practical Exams</span>
              <p className="text-xs text-gray-500 mt-0.5">Enables separate practical marks for science subjects (max 150)</p>
            </div>
          </label>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Target Classes</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-44 overflow-y-auto p-2 border border-gray-200 rounded-xl bg-gray-50">
              {classes.map(c => {
                const checked = (formData.class_ids||[]).includes(c.id)
                return (
                  <label key={c.id} className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm cursor-pointer transition ${checked ? 'bg-maroon-50 border-maroon-300 text-maroon-800' : 'bg-white border-gray-200 hover:border-gray-300'}`}>
                    <input type="checkbox" checked={checked} onChange={() => toggleClass(c.id)} className="w-4 h-4 rounded border-gray-300 text-maroon-600 focus:ring-maroon-500" />
                    <span className="font-medium">{c.class_name}</span>
                    <span className="text-xs text-gray-400 ml-auto">{c.level === 'A_LEVEL' ? 'A' : 'O'}</span>
                  </label>
                )
              })}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition">Cancel</button>
            <button type="submit" disabled={saving} className="px-5 py-2 text-sm font-semibold text-white bg-maroon-600 rounded-lg hover:bg-maroon-700 disabled:opacity-50 transition">
              {saving ? 'Saving...' : editingExam ? 'Update Exam' : 'Create Exam'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ─── Attendance modal (class selector) ─── */}
      <Modal isOpen={!!attendanceModal} onClose={() => setAttendanceModal(null)} title="Download Attendance Sheet">
        {attendanceModal && (() => {
          const examClsList = getExamClasses(attendanceModal.exam.id)
          return (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">Select the class to generate attendance sheets. One sheet will be printed <strong>per subject</strong>, sorted alphabetically by student name.</p>
              {examClsList.length > 1 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Class</label>
                  <div className="grid grid-cols-2 gap-2">
                    {examClsList.map(c => (
                      <label key={c.id} className={`flex items-center gap-2 px-4 py-3 rounded-xl border cursor-pointer transition ${attendanceModal.classId === c.id ? 'bg-indigo-50 border-indigo-300 text-indigo-800' : 'border-gray-200 hover:border-gray-300 bg-white'}`}>
                        <input type="radio" name="att-class" value={c.id} checked={attendanceModal.classId === c.id} onChange={() => setAttendanceModal(p => ({...p, classId: c.id}))} className="text-indigo-600" />
                        <span className="text-sm font-semibold">{c.class_name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setAttendanceModal(null)} className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition">Cancel</button>
                <button
                  disabled={!attendanceModal.classId || printingAttendance}
                  onClick={async () => {
                    await handlePrintAttendance(attendanceModal.exam, attendanceModal.classId)
                    setAttendanceModal(null)
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition"
                >
                  {printingAttendance ? (
                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Preparing...</>
                  ) : (
                    <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" /></svg>Print Attendance</>
                  )}
                </button>
              </div>
            </div>
          )
        })()}
      </Modal>

      {/* ─── Delete confirm ─── */}
      <Modal isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete Exam">
        <p className="text-sm text-gray-600 mb-6">Delete <strong>{deleteConfirm?.name}</strong>? This will permanently remove all marks and results. This cannot be undone.</p>
        <div className="flex justify-end gap-3">
          <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition">Cancel</button>
          <button onClick={() => handleDelete(deleteConfirm.id)} className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 transition">Delete</button>
        </div>
      </Modal>

      {/* ─── Re-open for mark entry confirm ─── */}
      <Modal
        isOpen={!!reopenConfirm}
        onClose={reopening ? null : () => setReopenConfirm(null)}
        title="Re-open Exam for Mark Entry"
      >
        {reopening ? (
          <div className="text-center py-8">
            <div className="w-10 h-10 border-4 border-gray-200 border-t-amber-500 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm font-medium text-gray-700">Re-opening exam…</p>
          </div>
        ) : (
          <>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 flex gap-3">
              <svg className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
              <div className="text-sm text-amber-800 space-y-1.5">
                <p className="font-semibold">This will move the exam back to "Entering Marks" status.</p>
                <ul className="list-disc list-inside space-y-1 text-amber-700">
                  <li>Teachers will be able to edit and correct marks again.</li>
                  <li>The previously processed results will remain visible but will be <strong>outdated</strong> until you re-process after corrections.</li>
                  <li>After fixing the marks, go to <strong>Reprocess</strong> to recalculate grades and rankings.</li>
                </ul>
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 space-y-2 mb-5">
              <div className="flex justify-between text-sm"><span className="text-gray-500">Exam</span><span className="font-semibold text-gray-900">{reopenConfirm?.name}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-500">Current Status</span><span className="font-semibold text-gray-900 capitalize">{reopenConfirm?.status?.replace(/_/g,' ')}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-500">New Status</span><span className="font-semibold text-amber-700">Entering Marks</span></div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setReopenConfirm(null)} className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition">Cancel</button>
              <button onClick={() => handleReopen(reopenConfirm)} className="px-5 py-2 text-sm font-semibold text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition">
                Re-open for Mark Entry
              </button>
            </div>
          </>
        )}
      </Modal>

      {/* ─── Process confirm ─── */}
      <Modal
        isOpen={!!processConfirm}
        onClose={processing ? null : () => setProcessConfirm(null)}
        title={processing ? (processConfirm?.reprocess ? 'Reprocessing...' : 'Processing...') : (processConfirm?.reprocess ? 'Reprocess Results' : 'Process Results')}
      >
        {processing ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 border-4 border-gray-200 border-t-maroon-600 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm font-medium text-gray-700">{processProgress}</p>
            <p className="text-xs text-gray-400 mt-1">Calculating grades, divisions and rankings…</p>
          </div>
        ) : (
          <>
            {/* Main warning */}
            {!processConfirm?.reprocess && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 flex gap-3">
                <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
                <div className="text-sm text-red-800 space-y-1">
                  <p className="font-semibold">Before you proceed — please read carefully:</p>
                  <ul className="list-disc list-inside space-y-1 text-red-700">
                    <li>After processing, <strong>teachers will no longer be able to edit or enter marks</strong> for this exam.</li>
                    <li>Make sure all marks have been entered and verified before processing.</li>
                    <li>If a mistake is found after processing, use <strong>"Re-open for Marks"</strong> on the exam card to allow corrections, then re-process.</li>
                  </ul>
                </div>
              </div>
            )}
            {processConfirm?.reprocess && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 flex gap-3">
                <svg className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
                <p className="text-sm text-amber-800">This will recalculate all grades, divisions and rankings using current marks. Exam status will not change.</p>
              </div>
            )}
            <div className="bg-gray-50 rounded-xl p-4 space-y-2 mb-5">
              <div className="flex justify-between text-sm"><span className="text-gray-500">Exam</span><span className="font-semibold text-gray-900">{processConfirm?.exam?.name}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-500">Type</span><span className="font-semibold text-gray-900">{processConfirm?.exam?.exam_type?.replace(/_/g,' ')}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-500">Classes</span><span className="font-semibold text-gray-900">{getExamClasses(processConfirm?.exam?.id||'').map(c=>c.class_name).join(', ')||'-'}</span></div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setProcessConfirm(null)} className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition">Cancel</button>
              <button onClick={() => executeProcess(processConfirm.exam, processConfirm.reprocess)} className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition">
                {processConfirm?.reprocess ? 'Reprocess Now' : 'Yes, Process Now'}
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}

async function fetchImageAsBase64(url) {
  if (!url) return null
  try {
    const res = await fetch(url)
    const blob = await res.blob()
    return await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

function buildSheet({ logoBase64, schoolName, addressLine, exam, className, streamLabel, subject, students }) {
  const rows = students.map((s, i) => {
    const fullName = [s.first_name, s.middle_name, s.surname].filter(Boolean).join(' ')
    return `
      <tr>
        <td style="border:1px solid #555;padding:7px 10px;text-align:center;font-size:11px;">${i + 1}</td>
        <td style="border:1px solid #555;padding:7px 10px;font-size:11px;text-transform:uppercase;">${fullName}</td>
        <td style="border:1px solid #555;padding:7px 10px;"></td>
        <td style="border:1px solid #555;padding:7px 10px;text-align:center;"></td>
      </tr>`
  }).join('')

  const roleTag = subject.subject_role ? ` <span style="font-size:9px;color:#666;">(${subject.subject_role})</span>` : ''

  const logoHtml = logoBase64
    ? `<img src="${logoBase64}" alt="logo" style="width:72px;height:72px;object-fit:contain;display:block;margin:0 auto 6px;" />`
    : ''

  return `
    <div class="sheet">
      <div style="text-align:center;padding-bottom:10px;margin-bottom:12px;border-bottom:2.5px double #000;">
        ${logoHtml}
        <div style="font-size:16px;font-weight:bold;letter-spacing:1.5px;margin-bottom:2px;">${schoolName}</div>
        ${addressLine ? `<div style="font-size:10px;color:#444;margin-bottom:4px;">${addressLine}</div>` : ''}
        <div style="font-size:13px;font-weight:bold;text-decoration:underline;letter-spacing:0.5px;">EXAMINATION ATTENDANCE SHEET</div>
      </div>

      <table style="width:100%;border-collapse:collapse;margin-bottom:12px;font-size:11px;border:1px solid #999;">
        <tr style="background:#f0f0f0;">
          <td style="padding:5px 10px;width:50%;border-right:1px solid #999;"><strong>EXAM NAME:</strong> ${exam.name.toUpperCase()}</td>
          <td style="padding:5px 10px;"><strong>CLASS:</strong> ${className}</td>
        </tr>
        <tr>
          <td style="padding:5px 10px;border-right:1px solid #999;border-top:1px solid #999;"><strong>SUBJECT:</strong> ${subject.subject_name.toUpperCase()}${roleTag}</td>
          <td style="padding:5px 10px;border-top:1px solid #999;"><strong>DATE:</strong> ___________________________</td>
        </tr>
        ${streamLabel ? `
        <tr style="background:#f0f0f0;">
          <td style="padding:5px 10px;border-right:1px solid #999;border-top:1px solid #999;"><strong>STREAM / COMBINATION:</strong> ${streamLabel}</td>
          <td style="padding:5px 10px;border-top:1px solid #999;"><strong>TOTAL CANDIDATES:</strong> ${students.length}</td>
        </tr>` : `
        <tr style="background:#f0f0f0;">
          <td colspan="2" style="padding:5px 10px;border-top:1px solid #999;"><strong>TOTAL CANDIDATES:</strong> ${students.length}</td>
        </tr>`}
        <tr>
          <td style="padding:5px 10px;border-right:1px solid #999;border-top:1px solid #999;"><strong>SUPERVISOR 1:</strong> _________________________________</td>
          <td style="padding:5px 10px;border-top:1px solid #999;"><strong>SIGNATURE:</strong> ___________________</td>
        </tr>
        <tr style="background:#f0f0f0;">
          <td style="padding:5px 10px;border-right:1px solid #999;border-top:1px solid #999;"><strong>SUPERVISOR 2:</strong> _________________________________</td>
          <td style="padding:5px 10px;border-top:1px solid #999;"><strong>SIGNATURE:</strong> ___________________</td>
        </tr>
        <tr>
          <td style="padding:5px 10px;border-right:1px solid #999;border-top:1px solid #999;"><strong>SUPERVISOR 3:</strong> _________________________________</td>
          <td style="padding:5px 10px;border-top:1px solid #999;"><strong>SIGNATURE:</strong> ___________________</td>
        </tr>
      </table>

      <table style="width:100%;border-collapse:collapse;font-size:11px;">
        <thead>
          <tr style="background:#222;color:#fff;">
            <th style="border:1px solid #333;padding:8px 10px;text-align:center;width:45px;">NO.</th>
            <th style="border:1px solid #333;padding:8px 10px;text-align:left;">FULL NAME</th>
            <th style="border:1px solid #333;padding:8px 10px;text-align:center;width:150px;">SIGNATURE</th>
            <th style="border:1px solid #333;padding:8px 10px;text-align:center;width:75px;">SCORE</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>

      <div style="margin-top:18px;display:flex;justify-content:space-between;font-size:10px;color:#444;">
        <div>Examiner's Signature: _______________________________</div>
        <div>Date Collected: _______________________________</div>
      </div>
      <div style="margin-top:6px;text-align:center;font-size:9px;color:#aaa;border-top:1px solid #ddd;padding-top:4px;">
        Kizaga RMS &nbsp;|&nbsp; Printed: ${new Date().toLocaleDateString('en-GB')}
      </div>
    </div>`
}

function openAttendancePrintWindow({ exam, selectedClass, students, subjects, streamGroups, schoolInfo, logoBase64, isALevel }) {
  const schoolName = (schoolInfo?.school_name || 'SCHOOL NAME').toUpperCase()
  const addressLine = [schoolInfo?.address, schoolInfo?.region, schoolInfo?.district].filter(Boolean).join(' | ')
  const className = (selectedClass?.class_name || '').toUpperCase()

  let sheets = ''

  if (isALevel && streamGroups?.length > 0) {
    for (const { streamName, subjects: streamSubjects, students: streamStudents } of streamGroups) {
      for (const subject of streamSubjects) {
        sheets += buildSheet({ logoBase64, schoolName, addressLine, exam, className, streamLabel: streamName, subject, students: streamStudents })
      }
    }
  } else {
    for (const subject of (subjects || [])) {
      sheets += buildSheet({ logoBase64, schoolName, addressLine, exam, className, streamLabel: null, subject, students: students || [] })
    }
  }

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Attendance – ${exam.name}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: Arial, sans-serif; background:#fff; }
    .sheet { width:210mm; min-height:297mm; padding:14mm 16mm; page-break-after:always; }
    @page { size: A4 portrait; margin: 0; }
    @media print { body { margin:0; } .sheet { page-break-after: always; } }
  </style>
</head>
<body>
  ${sheets}
  <script>window.onload = function(){ window.focus(); window.print(); }<\/script>
</body>
</html>`

  const w = window.open('', '_blank', 'width=900,height=750')
  if (!w) { alert('Please allow popups for this site to print attendance sheets.'); return }
  w.document.open()
  w.document.write(html)
  w.document.close()
}

export default AcademicExams
