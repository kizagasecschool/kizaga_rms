import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useNotification } from '../context/NotificationContext'

function subjectHasPractical(subject, exam) {
  return subject?.has_practical && exam?.has_practical
}

function smsSegments(text) {
  if (!text) return { chars: 0, segments: 0 }
  const chars = text.length
  if (chars <= 160) return { chars, segments: 1 }
  return { chars, segments: Math.ceil(chars / 153) }
}

export default function SendSMS() {
  const { profile } = useAuth()
  const { showToast } = useNotification()

  const [tab, setTab] = useState('results')

  const [classes, setClasses] = useState([])
  const [classStreams, setClassStreams] = useState([])
  const [classId, setClassId] = useState('')
  const [streamId, setStreamId] = useState('')
  const [schoolName, setSchoolName] = useState('')
  const [sending, setSending] = useState(false)
  const [sendProgress, setSendProgress] = useState(null) // { done, total }

  // Results tab
  const [exams, setExams] = useState([])
  const [examId, setExamId] = useState('')
  const [loadingResults, setLoadingResults] = useState(false)
  const [previewResults, setPreviewResults] = useState([])
  const [selectedResults, setSelectedResults] = useState([])

  // Compose tab
  const [recipients, setRecipients] = useState([])
  const [loadingRecipients, setLoadingRecipients] = useState(false)
  const [message, setMessage] = useState('')
  const [selectedRecipients, setSelectedRecipients] = useState([])

  const canSend = ['admin', 'headmaster', 'academic'].includes(profile?.role)

  useEffect(() => {
    Promise.all([
      supabase.from('classes').select('*').order('sort_order'),
      supabase.from('class_streams').select('id, class_id, streams(stream_name)').order('stream_id'),
      supabase.from('school_settings').select('school_name').limit(1),
    ]).then(([cRes, csRes, sRes]) => {
      if (cRes.data) setClasses(cRes.data)
      if (csRes.data) setClassStreams(csRes.data)
      if (sRes.data?.[0]?.school_name) setSchoolName(sRes.data[0].school_name)
    })
  }, [])

  const streamsForClass = classStreams.filter(cs => cs.class_id === classId)

  useEffect(() => {
    setStreamId('')
    setExams([])
    setExamId('')
    setPreviewResults([])
    setRecipients([])
    setSelectedResults([])
    setSelectedRecipients([])
    if (!classId) return
    supabase
      .from('exam_classes')
      .select('exam_id, exams!inner(*)')
      .eq('class_id', classId)
      .then(({ data }) => {
        if (data) {
          const seen = new Set()
          const unique = []
          data.forEach(r => { if (!seen.has(r.exam_id)) { seen.add(r.exam_id); unique.push(r.exams) } })
          setExams(unique.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)))
        }
      })
  }, [classId])

  useEffect(() => {
    setPreviewResults([])
    setRecipients([])
    setSelectedResults([])
    setSelectedRecipients([])
  }, [streamId])

  const normalizePhone = (raw) => {
    if (!raw) return null
    const digits = raw.replace(/[^0-9]/g, '')
    if (!digits) return null
    if (digits.length === 9) return '255' + digits
    if (digits.length === 10 && digits.startsWith('0')) return '255' + digits.slice(1)
    if (digits.startsWith('255') && digits.length === 12) return digits
    return digits
  }

  const buildResultsMessage = (student, subjectsWithMarks, resultRow, cls) => {
    const parts = [`Matokeo ya ${student.first_name} ${student.surname}`]
    if (cls) parts.push(`Darasa: ${cls}`)
    const subjList = subjectsWithMarks.slice(0, 10).map(s => `${s.subject_code}: ${s.pct !== null ? s.pct + '%' : 'ABS'}(${s.grade})`)
    parts.push(subjList.join(', '))
    if (resultRow?.average_marks != null) parts.push(`Wastani: ${resultRow.average_marks}%`)
    if (resultRow?.grade) parts.push(`Daraja: ${resultRow.grade}`)
    if (resultRow?.position) parts.push(`Nafsi: ${resultRow.position}`)
    if (schoolName) parts.push(`- ${schoolName}`)
    return parts.join('. ')
  }

  const studentFilter = async () => {
    let query = supabase.from('students')
      .select('id, first_name, middle_name, surname, parent_name, parent_phone, class_stream_id')
      .eq('class_id', classId)
      .eq('status', 'active')
      .order('surname')
    if (streamId) query = query.eq('class_stream_id', streamId)
    return query
  }

  const loadResultsRecipients = async () => {
    if (!classId || !examId) { showToast('Chagua darasa na mtihani', 'error'); return }
    setLoadingResults(true)
    try {
      const [{ data: students }, { data: marksData }, { data: subjectData }, { data: gradesData }, { data: resultsData }, clsRes] = await Promise.all([
        studentFilter(),
        supabase.from('marks').select('student_id, subject_id, marks_obtained, practical_marks, is_absent').eq('exam_id', examId),
        supabase.from('subjects').select('id, subject_name, subject_code, has_practical'),
        supabase.from('grades').select('*').order('min_mark', { ascending: false }),
        supabase.from('student_results').select('student_id, total_marks, average_marks, grade, position').eq('exam_id', examId),
        supabase.from('classes').select('class_name').eq('id', classId).single(),
      ])

      if (!students || students.length === 0) { showToast('Hakuna wanafunzi katika darasa hili', 'error'); return }

      const cls = clsRes?.data?.class_name || ''
      const selectedExam = exams.find(e => e.id === examId)
      const subjMap = {}
      ;(subjectData || []).forEach(s => { subjMap[s.id] = s })

      const preview = []
      students.forEach(st => {
        const phone = normalizePhone(st.parent_phone)
        if (!phone) return
        const studentMarks = (marksData || []).filter(m => m.student_id === st.id)
        const resultRow = (resultsData || []).find(r => r.student_id === st.id) || null

        const subjectsWithMarks = studentMarks.map(m => {
          const subj = subjMap[m.subject_id]
          if (!subj) return null
          const hp = subjectHasPractical(subj, selectedExam)
          const theory = m.marks_obtained || 0
          const practical = hp ? (m.practical_marks || 0) : 0
          const total = theory + practical
          const max = hp ? 150 : 100
          const pct = m.is_absent ? null : Math.round((total / max) * 100)
          const grade = m.is_absent ? 'ABS' : ((gradesData || []).find(g => pct >= g.min_mark)?.grade_letter || 'F')
          return { subject_name: subj.subject_name, subject_code: subj.subject_code, pct, grade }
        }).filter(Boolean)

        preview.push({
          name: `${st.first_name} ${st.middle_name ? st.middle_name + ' ' : ''}${st.surname}`.trim(),
          parent: st.parent_name || '-',
          phone,
          message: buildResultsMessage(st, subjectsWithMarks, resultRow, cls),
        })
      })

      setPreviewResults(preview)
      setSelectedResults([])
      const noPhone = (students || []).length - preview.length
      showToast(`${preview.length} mzazi(w) wamepakiwa${noPhone > 0 ? ` (${noPhone} hawana nambari)` : ''}`, 'success')
    } catch (err) {
      console.error(err)
      showToast('Imeshindwa kupakia data', 'error')
    } finally {
      setLoadingResults(false)
    }
  }

  const loadRecipients = async () => {
    if (!classId) { showToast('Chagua darasa kwanza', 'error'); return }
    setLoadingRecipients(true)
    try {
      const { data, error } = await studentFilter()
      if (error) throw error
      const list = (data || [])
        .map(s => ({
          id: s.id,
          phone: normalizePhone(s.parent_phone),
          name: s.parent_name || `${s.first_name} ${s.surname}`,
          student: `${s.first_name} ${s.surname}`,
        }))
        .filter(r => r.phone)
      setRecipients(list)
      setSelectedRecipients([])
      const noPhone = (data || []).length - list.length
      showToast(`${list.length} mzazi(w) wamepakiwa${noPhone > 0 ? ` (${noPhone} hawana nambari)` : ''}`, 'success')
    } catch (err) {
      console.error(err)
      showToast('Imeshindwa kupakia wazazi', 'error')
    } finally {
      setLoadingRecipients(false)
    }
  }

  const selectedCount = tab === 'results' ? selectedResults.length : selectedRecipients.length

  const toggleSelectAll = () => {
    if (tab === 'results') {
      setSelectedResults(selectedResults.length === previewResults.length ? [] : previewResults.map((_, i) => i))
    } else {
      setSelectedRecipients(selectedRecipients.length === recipients.length ? [] : recipients.map((_, i) => i))
    }
  }

  const toggleSelect = (idx) => {
    if (tab === 'results') {
      setSelectedResults(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx])
    } else {
      setSelectedRecipients(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx])
    }
  }

  const getSendList = () => {
    if (tab === 'results') {
      return selectedResults.length > 0 ? selectedResults.map(i => previewResults[i]) : previewResults
    }
    return selectedRecipients.length > 0 ? selectedRecipients.map(i => recipients[i]) : recipients
  }

  const handleSendMessages = async (recipientList, customMessage) => {
    if (!recipientList || recipientList.length === 0) { showToast('Hakuna wapokeaji', 'error'); return }
    if (tab === 'message' && !customMessage?.trim()) { showToast('Andika ujumbe kwanza', 'error'); return }
    setSending(true)
    setSendProgress({ done: 0, total: recipientList.length })
    let success = 0
    let fail = 0
    const errors = []
    try {
      if (tab === 'results') {
        // Each student gets a personalized message — send one by one
        for (let i = 0; i < recipientList.length; i++) {
          const r = recipientList[i]
          setSendProgress({ done: i, total: recipientList.length })
          try {
            const res = await fetch('/api/send-sms', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ recipients: [{ phone: r.phone }], message: r.message }),
            })
            const data = await res.json()
            if (res.ok) success++
            else { errors.push(data?.error || `HTTP ${res.status}`); fail++ }
          } catch (e) { errors.push(e.message); fail++ }
        }
      } else {
        // One message to all recipients in one batch request
        const res = await fetch('/api/send-sms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipients: recipientList.map(r => ({ phone: r.phone })),
            message: customMessage.trim(),
          }),
        })
        const result = await res.json()
        if (res.ok) { success = recipientList.length }
        else { errors.push(result.error || 'Failed'); fail = recipientList.length }
      }

      if (fail === 0) {
        showToast(`SMS ${success} zimetumwa`, 'success')
      } else {
        showToast(`Zimetumwa: ${success}, Zimeshindwa: ${fail}${errors[0] ? ' — ' + errors[0] : ''}`, 'warning')
      }
    } catch (err) {
      showToast('Imeshindwa kutuma: ' + (err.message || ''), 'error')
    } finally {
      setSending(false)
      setSendProgress(null)
    }
  }

  const { chars, segments } = smsSegments(message)

  if (!canSend) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
          <h2 className="text-lg font-semibold text-amber-800 mb-1">Hairuhusiwi</h2>
          <p className="text-sm text-amber-600">Ni Admin, Headmaster, na Academic Officer pekee wanaoruhusiwa kutuma SMS.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Tuma SMS kwa Wazazi</h1>
        <p className="text-sm text-gray-500 mt-1">Tuma matokeo ya mtihani au ujumbe kwa wazazi wa wanafunzi kupitia Beem Africa</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => { setTab('results'); setSelectedResults([]); setSelectedRecipients([]) }}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition ${tab === 'results' ? 'bg-white text-maroon-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}
        >
          Tuma Matokeo
        </button>
        <button
          onClick={() => { setTab('message'); setSelectedResults([]); setSelectedRecipients([]) }}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition ${tab === 'message' ? 'bg-white text-maroon-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}
        >
          Tunga Ujumbe
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          {/* Class */}
          <div className="flex-1 min-w-[140px]">
            <label className="block text-xs font-medium text-gray-600 mb-1">Darasa</label>
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-maroon-400 transition"
            >
              <option value="">Chagua darasa...</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
            </select>
          </div>

          {/* Stream */}
          {streamsForClass.length > 0 && (
            <div className="flex-1 min-w-[120px]">
              <label className="block text-xs font-medium text-gray-600 mb-1">Mkondo (optional)</label>
              <select
                value={streamId}
                onChange={(e) => setStreamId(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-maroon-400 transition"
              >
                <option value="">Wote</option>
                {streamsForClass.map(cs => (
                  <option key={cs.id} value={cs.id}>{cs.streams?.stream_name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Exam (results tab only) */}
          {tab === 'results' && (
            <div className="flex-1 min-w-[160px]">
              <label className="block text-xs font-medium text-gray-600 mb-1">Mtihani</label>
              <select
                value={examId}
                onChange={(e) => { setExamId(e.target.value); setPreviewResults([]) }}
                className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-maroon-400 transition"
              >
                <option value="">Chagua mtihani...</option>
                {exams.map(e => <option key={e.id} value={e.id}>{e.exam_name}</option>)}
              </select>
            </div>
          )}

          <button
            type="button"
            disabled={!classId || loadingRecipients || loadingResults || (tab === 'results' && !examId)}
            onClick={tab === 'results' ? loadResultsRecipients : loadRecipients}
            className="px-4 py-2.5 bg-maroon-600 text-white text-sm font-medium rounded-xl disabled:opacity-50 shrink-0 hover:bg-maroon-700 transition"
          >
            {loadingRecipients || loadingResults
              ? <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Inapakia...</span>
              : 'Pakia Wazazi'}
          </button>
        </div>
      </div>

      {/* Results Tab */}
      {tab === 'results' && previewResults.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800">
              Hakiki ya Ujumbe
              <span className="ml-2 text-xs font-normal text-gray-400">({previewResults.length} mzazi)</span>
            </h3>
            <button onClick={toggleSelectAll} className="text-xs text-maroon-600 hover:text-maroon-700 font-medium" type="button">
              {selectedResults.length === previewResults.length ? 'Ondoa Wote' : 'Chagua Wote'}
            </button>
          </div>
          <div className="max-h-72 overflow-y-auto space-y-2 mb-4">
            {previewResults.map((p, i) => {
              const seg = smsSegments(p.message)
              return (
                <label key={i} className={`flex items-start gap-3 text-xs rounded-xl p-3 border cursor-pointer transition ${selectedResults.includes(i) ? 'bg-maroon-50 border-maroon-200' : 'bg-gray-50 border-gray-100 hover:border-gray-200'}`}>
                  <input type="checkbox" checked={selectedResults.includes(i)} onChange={() => toggleSelect(i)} className="mt-0.5 rounded accent-maroon-600" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-800">{p.name}</span>
                      <span className="text-gray-400">· mzazi: {p.parent}</span>
                      <span className="ml-auto text-gray-400 font-mono">{p.phone}</span>
                    </div>
                    <p className="text-gray-500 break-words leading-relaxed">{p.message}</p>
                    <p className="text-gray-400 mt-1">{seg.chars} herufi · {seg.segments} SMS</p>
                  </div>
                </label>
              )
            })}
          </div>

          {sending && sendProgress && (
            <div className="mb-3">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Inatuma...</span>
                <span>{sendProgress.done}/{sendProgress.total}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5">
                <div
                  className="bg-maroon-600 h-1.5 rounded-full transition-all"
                  style={{ width: `${(sendProgress.done / sendProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          <button
            onClick={() => handleSendMessages(getSendList(), '')}
            disabled={sending}
            className="w-full px-4 py-2.5 bg-maroon-600 hover:bg-maroon-700 text-white text-sm font-medium rounded-xl disabled:opacity-50 transition flex items-center justify-center gap-2"
          >
            {sending && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {sending ? 'Inatuma...' : selectedCount > 0 ? `Tuma kwa Waliochaguliwa (${selectedCount})` : `Tuma kwa Wote (${previewResults.length})`}
          </button>
        </div>
      )}

      {tab === 'results' && previewResults.length === 0 && !loadingResults && classId && examId && (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-sm text-gray-400">
          Bonyeza "Pakia Wazazi" kupata orodha ya wapokeaji
        </div>
      )}

      {/* Compose Tab */}
      {tab === 'message' && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-5">
          {/* Recipients list */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">
                Wapokeaji
                {recipients.length > 0 && <span className="ml-1.5 text-xs text-gray-400">({recipients.length} wazazi wamepakiwa)</span>}
              </label>
              {recipients.length > 0 && (
                <button onClick={toggleSelectAll} className="text-xs text-maroon-600 hover:text-maroon-700 font-medium" type="button">
                  {selectedRecipients.length === recipients.length ? 'Ondoa Wote' : 'Chagua Wote'}
                </button>
              )}
            </div>

            {recipients.length === 0 ? (
              <p className="text-xs text-gray-400 py-3">Pakia wazazi kwanza kwa kuchagua darasa na kubonyeza "Pakia Wazazi"</p>
            ) : (
              <div className="max-h-52 overflow-y-auto border border-gray-100 rounded-xl divide-y divide-gray-50">
                {recipients.map((r, i) => (
                  <label key={i} className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer text-xs transition ${selectedRecipients.includes(i) ? 'bg-maroon-50' : 'hover:bg-gray-50'}`}>
                    <input type="checkbox" checked={selectedRecipients.includes(i)} onChange={() => toggleSelect(i)} className="rounded accent-maroon-600" />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-gray-800">{r.name}</span>
                      {r.student && r.student !== r.name && (
                        <span className="text-gray-400 ml-1.5">({r.student})</span>
                      )}
                    </div>
                    <span className="text-gray-400 font-mono shrink-0">{r.phone}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Message compose */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-gray-700">Ujumbe</label>
              <span className={`text-xs ${chars > 612 ? 'text-red-500' : 'text-gray-400'}`}>
                {chars}/612 herufi · {segments} SMS{segments > 1 ? ' (gharama ' + segments + 'x)' : ''}
              </span>
            </div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              maxLength={612}
              className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-maroon-400 focus:ring-4 focus:ring-maroon-500/10 transition resize-none"
              placeholder="Andika ujumbe kwa wazazi hapa..."
            />
          </div>

          {sending && sendProgress && (
            <div>
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Inatuma...</span>
                <span>{sendProgress.done}/{sendProgress.total}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5">
                <div className="bg-maroon-600 h-1.5 rounded-full transition-all" style={{ width: `${(sendProgress.done / sendProgress.total) * 100}%` }} />
              </div>
            </div>
          )}

          <button
            onClick={() => handleSendMessages(getSendList(), message)}
            disabled={sending || recipients.length === 0 || !message.trim()}
            className="w-full px-5 py-2.5 bg-maroon-600 hover:bg-maroon-700 text-white text-sm font-medium rounded-xl disabled:opacity-50 transition flex items-center justify-center gap-2"
          >
            {sending && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {sending ? 'Inatuma...' : selectedCount > 0 ? `Tuma kwa Waliochaguliwa (${selectedCount})` : recipients.length > 0 ? `Tuma kwa Wote (${recipients.length})` : 'Tuma'}
          </button>
        </div>
      )}
    </div>
  )
}
