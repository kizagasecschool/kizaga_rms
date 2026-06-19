import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useNotification } from '../context/NotificationContext'

function subjectHasPractical(subject, exam) {
  return subject?.has_practical && exam?.has_practical
}

export default function SendSMS() {
  const { profile } = useAuth()
  const { showToast } = useNotification()

  const [tab, setTab] = useState('results')

  // Shared state
  const [classes, setClasses] = useState([])
  const [classId, setClassId] = useState('')
  const [schoolName, setSchoolName] = useState('')
  const [sending, setSending] = useState(false)

  // Results tab state
  const [exams, setExams] = useState([])
  const [examId, setExamId] = useState('')
  const [loadingResults, setLoadingResults] = useState(false)
  const [previewResults, setPreviewResults] = useState([])

  // Message tab state
  const [recipients, setRecipients] = useState([])
  const [loadingRecipients, setLoadingRecipients] = useState(false)
  const [message, setMessage] = useState('')

  const canSend = ['admin', 'headmaster', 'academic'].includes(profile?.role)

  useEffect(() => {
    Promise.all([
      supabase.from('classes').select('*').order('sort_order'),
      supabase.from('school_settings').select('school_name').limit(1),
    ]).then(([cRes, sRes]) => {
      if (cRes.data) setClasses(cRes.data)
      if (sRes.data?.[0]?.school_name) setSchoolName(sRes.data[0].school_name)
    })
  }, [])

  useEffect(() => {
    if (!classId) { setExams([]); setExamId(''); return }
    supabase
      .from('exam_classes')
      .select('exam_id, exams!inner(*)')
      .eq('class_id', classId)
      .then(({ data }) => {
        if (data) {
          const unique = []
          const seen = new Set()
          data.forEach(r => {
            if (!seen.has(r.exam_id)) {
              seen.add(r.exam_id)
              unique.push(r.exams)
            }
          })
          setExams(unique)
        }
      })
  }, [classId])

  const normalizePhone = (raw) => {
    if (!raw) return null
    const digits = raw.replace(/[^0-9]/g, '')
    if (!digits) return null
    if (digits.length === 9) return '255' + digits
    if (digits.length === 10 && digits.startsWith('0')) return '255' + digits.slice(1)
    return digits
  }

  const buildResultsMessage = (student, subjectsWithMarks, resultRow, cls) => {
    const parts = [`Matokeo ya ${student.first_name} ${student.surname}`]
    if (cls) parts.push(`Darasa la ${cls}`)
    const subjList = subjectsWithMarks.slice(0, 12).map(s => {
      let line = `${s.subject_name}: ${s.pct}% (${s.grade})`
      return line
    })
    parts.push(subjList.join(', '))
    if (resultRow) {
      parts.push(`Wastani: ${resultRow.average_marks}%`)
      if (resultRow.grade) parts.push(`Daraja: ${resultRow.grade}`)
    }
    if (schoolName) parts.push(`- ${schoolName}`)
    return parts.join('. ')
  }

  const loadResultsRecipients = async () => {
    if (!classId || !examId) {
      showToast('Chagua darasa na mtihani', 'error')
      return
    }
    setLoadingResults(true)
    try {
      const [{ data: students }, { data: marksData }, { data: subjectData }, { data: resultsData }, clsRes] = await Promise.all([
        supabase.from('students').select('id, first_name, middle_name, surname, parent_name, parent_phone').eq('class_id', classId).order('surname'),
        supabase.from('marks').select('student_id, subject_id, marks_obtained, practical_marks, is_absent').eq('exam_id', examId),
        supabase.from('subjects').select('id, subject_name, has_practical'),
        supabase.from('student_results').select('student_id, total_marks, average_marks, grade, position').eq('exam_id', examId),
        supabase.from('classes').select('class_name').eq('id', classId).single(),
      ])

      if (!students || students.length === 0) {
        showToast('Hakuna wanafunzi darasa hili', 'error')
        return
      }

      const cls = clsRes?.data?.class_name || ''
      const selectedExam = exams.find(e => e.id === examId)
      const subjects = subjectData || []
      const subjMap = {}
      subjects.forEach(s => { subjMap[s.id] = s })

      const list = []
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
          const pct = !m.is_absent ? Math.round((total / max) * 100) : null
          return {
            subject_name: subj.subject_name,
            marks: total,
            pct,
            grade: 'N/A',
          }
        }).filter(Boolean)

        const msg = buildResultsMessage(st, subjectsWithMarks, resultRow, cls)

        list.push({ phone, name: st.parent_name || `${st.first_name} ${st.surname}` })
        preview.push({
          name: `${st.first_name} ${st.middle_name || ''} ${st.surname}`.trim(),
          parent: st.parent_name || '-',
          phone,
          message: msg,
        })
      })

      setPreviewResults(preview)
      showToast(`Wazazi ${list.length} wamepakuliwa`, 'success')
    } catch (err) {
      console.error('Load results error:', err)
      showToast('Imeshindwa kupakia data', 'error')
    } finally {
      setLoadingResults(false)
    }
  }

  const loadRecipients = async () => {
    if (!classId) {
      showToast('Chagua darasa kwanza', 'error')
      return
    }
    setLoadingRecipients(true)
    try {
      const { data, error } = await supabase
        .from('students')
        .select('id, first_name, middle_name, surname, parent_name, parent_phone')
        .eq('class_id', classId)
        .order('surname')

      if (error) throw error

      const list = (data || [])
        .map(s => ({
          phone: normalizePhone(s.parent_phone),
          name: s.parent_name || `${s.first_name} ${s.surname}`,
        }))
        .filter(r => r.phone)

      setRecipients(list)
      showToast(`Wazazi ${list.length} wamepakuliwa`, 'success')
    } catch (err) {
      console.error('Load recipients error:', err)
      showToast('Imeshindwa kupakia wazazi', 'error')
    } finally {
      setLoadingRecipients(false)
    }
  }

  const handleSendMessages = async (recipientList, customMessage) => {
    if (!recipientList || recipientList.length === 0) {
      showToast('Hakuna wapokeaji', 'error')
      return
    }
    if (!customMessage && tab === 'message') {
      showToast('Tafadhali andika ujumbe', 'error')
      return
    }
    setSending(true)
    try {
      let successCount = 0
      let failCount = 0

      if (tab === 'message') {
        const body = {
          recipients: recipientList.map(r => ({ phone: r.phone, name: r.name })),
          message: customMessage.trim(),
        }
        const res = await fetch('/api/send-sms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const result = await res.json()
        if (!res.ok) throw new Error(result.error || 'Failed to send SMS')
        showToast(result.message || 'SMS zimetumwa', 'success')
      } else {
        for (let i = 0; i < previewResults.length; i++) {
          const p = previewResults[i]
          const body = {
            recipients: [{ phone: p.phone, name: p.name }],
            message: p.message,
          }
          try {
            const res = await fetch('/api/send-sms', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            })
            if (res.ok) successCount++
            else failCount++
          } catch {
            failCount++
          }
        }
        showToast(`Imekamilika: ${successCount} zilifanikiwa, ${failCount} zilishindwa`, failCount > 0 ? 'warning' : 'success')
      }
    } catch (err) {
      console.error('Send SMS error:', err)
      showToast('Imeshindwa kutuma SMS: ' + (err.message || ''), 'error')
    } finally {
      setSending(false)
    }
  }

  const handleSendCustom = (e) => {
    e.preventDefault()
    handleSendMessages(recipients, message)
  }

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
        <p className="text-sm text-gray-500 mt-1">Tuma matokeo ya mtihani au ujumbe kwa wazazi wa wanafunzi</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => setTab('results')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition ${tab === 'results' ? 'bg-white text-maroon-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}
        >
          Tuma Matokeo
        </button>
        <button
          onClick={() => setTab('message')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition ${tab === 'message' ? 'bg-white text-maroon-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}
        >
          Tuma Ujumbe
        </button>
      </div>

      {/* Shared: Class selector */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-4">
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Darasa</label>
            <select
              value={classId}
              onChange={(e) => { setClassId(e.target.value); setPreviewResults([]); setRecipients([]) }}
              className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none"
            >
              <option value="">Chagua darasa...</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.class_name}</option>
              ))}
            </select>
          </div>

          {tab === 'results' && (
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Mtihani</label>
              <select
                value={examId}
                onChange={(e) => { setExamId(e.target.value); setPreviewResults([]) }}
                className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none"
              >
                <option value="">Chagua mtihani...</option>
                {exams.map(e => (
                  <option key={e.id} value={e.id}>{e.exam_name}</option>
                ))}
              </select>
            </div>
          )}

          <button
            type="button"
            disabled={
              !classId || loadingRecipients || loadingResults ||
              (tab === 'results' && !examId)
            }
            onClick={tab === 'results' ? loadResultsRecipients : loadRecipients}
            className="px-4 py-2.5 bg-maroon-600 text-white text-sm font-medium rounded-xl disabled:opacity-50 shrink-0"
          >
            {loadingRecipients || loadingResults ? 'Inapakia...' : 'Pakia Wazazi'}
          </button>
        </div>
      </div>

      {/* Results Tab */}
      {tab === 'results' && (
        <>
          {previewResults.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-800">Hakiki ya Ujumbe ({previewResults.length} wazazi)</h3>
                <span className="text-xs text-gray-400">Ujumbe mmoja kwa kila mwanafunzi</span>
              </div>
              <div className="max-h-64 overflow-y-auto space-y-2 mb-4">
                {previewResults.slice(0, 10).map((p, i) => (
                  <div key={i} className="text-xs bg-gray-50 rounded-lg p-3 border border-gray-100">
                    <div className="font-medium text-gray-700 mb-1">{p.name} <span className="text-gray-400">({p.phone})</span></div>
                    <div className="text-gray-500 whitespace-pre-wrap break-words">{p.message}</div>
                  </div>
                ))}
                {previewResults.length > 10 && (
                  <p className="text-xs text-gray-400 text-center pt-1">...na wengine {previewResults.length - 10}</p>
                )}
              </div>
              <button
                onClick={() => handleSendMessages([], '')}
                disabled={sending}
                className="w-full px-4 py-2.5 bg-maroon-600 text-white text-sm font-medium rounded-xl disabled:opacity-50"
              >
                {sending ? 'Inatuma...' : `Tuma Matokeo kwa Wazazi ${previewResults.length}`}
              </button>
            </div>
          )}
        </>
      )}

      {/* Message Tab */}
      {tab === 'message' && (
        <form onSubmit={handleSendCustom} className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Wapokeaji</label>
            <div className="text-sm text-gray-600">{recipients.length} mzazi(w)</div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ujumbe</label>
            <textarea
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none"
              placeholder="Andika ujumbe kwa wazazi..."
              maxLength={612}
            />
            <p className="text-xs text-gray-400 mt-1 text-right">{message.length}/612</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={sending || recipients.length === 0}
              className="px-5 py-2.5 bg-maroon-600 text-white text-sm font-medium rounded-xl disabled:opacity-50"
            >
              {sending ? 'Inatuma...' : `Tuma SMS kwa ${recipients.length} wazazi`}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
