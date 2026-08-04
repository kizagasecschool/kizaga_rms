import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { useNotification } from '../../context/NotificationContext'

const STATUS_OPTIONS = [
  { value: 'present', label: 'Present', color: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
  { value: 'absent', label: 'Absent', color: 'bg-red-100 text-red-700 border-red-300' },
  { value: 'late', label: 'Late', color: 'bg-amber-100 text-amber-700 border-amber-300' },
  { value: 'excused', label: 'Excused', color: 'bg-blue-100 text-blue-700 border-blue-300' },
]

const today = new Date().toISOString().slice(0, 10)

export default function Attendance() {
  const { profile } = useAuth()
  const { showToast } = useNotification()
  const isAcademic = ['admin', 'academic'].includes(profile?.role)

  const [classes, setClasses] = useState([])
  const [classStreams, setClassStreams] = useState([])
  const [selectedClassId, setSelectedClassId] = useState('')
  const [selectedStreamId, setSelectedStreamId] = useState('')
  const [selectedDate, setSelectedDate] = useState(today)

  const [students, setStudents] = useState([])
  const [attendance, setAttendance] = useState({}) // { studentId: { status, notes } }
  const [existing, setExisting] = useState({})    // what was already in DB
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [saving, setSaving] = useState(false)
  const [viewMode, setViewMode] = useState('entry') // 'entry' | 'summary'

  // Summary
  const [summaryClassId, setSummaryClassId] = useState('')
  const [summaryMonth, setSummaryMonth] = useState(today.slice(0, 7))
  const [summaryData, setSummaryData] = useState([])
  const [loadingSummary, setLoadingSummary] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase.from('classes').select('*').order('sort_order'),
      supabase.from('class_streams').select('*, streams(stream_name), classes(class_name)').order('stream_id'),
    ]).then(([cRes, csRes]) => {
      if (cRes.data) setClasses(cRes.data)
      if (csRes.data) setClassStreams(csRes.data)
    })
  }, [])

  const streamsForClass = classStreams.filter(cs => cs.class_id === selectedClassId)

  const loadStudents = useCallback(async () => {
    if (!selectedClassId) return
    setLoadingStudents(true)
    try {
      let q = supabase.from('students').select('id, first_name, middle_name, surname, gender, admission_number')
        .eq('class_id', selectedClassId).eq('status', 'active')
      if (selectedStreamId) q = q.eq('class_stream_id', selectedStreamId)
      const { data: studs } = await q

      if (!studs) return
      studs.sort((a, b) => {
        const gA = a.gender === 'Female' ? 0 : 1
        const gB = b.gender === 'Female' ? 0 : 1
        if (gA !== gB) return gA - gB
        return (a.first_name || '').localeCompare(b.first_name || '')
      })
      setStudents(studs)

      // Load existing attendance
      const { data: att } = await supabase
        .from('attendance')
        .select('student_id, status, notes')
        .in('student_id', studs.map(s => s.id))
        .eq('date', selectedDate)

      const attMap = {}
      ;(att || []).forEach(a => { attMap[a.student_id] = { status: a.status, notes: a.notes || '' } })
      setExisting(attMap)
      // Pre-fill unsaved state from existing
      const init = {}
      studs.forEach(s => {
        init[s.id] = attMap[s.id] ? { ...attMap[s.id] } : { status: 'present', notes: '' }
      })
      setAttendance(init)
    } finally {
      setLoadingStudents(false)
    }
  }, [selectedClassId, selectedStreamId, selectedDate])

  useEffect(() => {
    setStudents([])
    setAttendance({})
    setExisting({})
    if (selectedClassId) loadStudents()
  }, [selectedClassId, selectedStreamId, selectedDate, loadStudents])

  const setStatus = (studentId, status) => {
    setAttendance(prev => ({ ...prev, [studentId]: { ...prev[studentId], status } }))
  }

  const setAllStatus = (status) => {
    setAttendance(prev => {
      const next = { ...prev }
      students.forEach(s => { next[s.id] = { ...next[s.id], status } })
      return next
    })
  }

  const handleSave = async () => {
    if (!students.length) return
    setSaving(true)
    try {
      const rows = students.map(s => ({
        student_id: s.id,
        date: selectedDate,
        status: attendance[s.id]?.status || 'present',
        notes: attendance[s.id]?.notes || null,
      }))
      const { error } = await supabase.from('attendance').upsert(rows, { onConflict: 'student_id,date' })
      if (error) throw error
      setExisting(Object.fromEntries(rows.map(r => [r.student_id, { status: r.status, notes: r.notes || '' }])))
      showToast(`Attendance saved for ${rows.length} students`, 'success')
    } catch (err) {
      showToast('Failed to save: ' + (err.message || ''), 'error')
    } finally {
      setSaving(false)
    }
  }

  const loadSummary = useCallback(async () => {
    if (!summaryClassId || !summaryMonth) return
    setLoadingSummary(true)
    try {
      const from = `${summaryMonth}-01`
      const toDate = new Date(summaryMonth + '-01')
      toDate.setMonth(toDate.getMonth() + 1)
      toDate.setDate(toDate.getDate() - 1)
      const to = toDate.toISOString().slice(0, 10)

      const [{ data: studs }, { data: att }] = await Promise.all([
        supabase.from('students').select('id, first_name, middle_name, surname, gender')
          .eq('class_id', summaryClassId).eq('status', 'active'),
        supabase.from('attendance').select('student_id, date, status')
          .gte('date', from).lte('date', to),
      ])

      const studIds = new Set((studs || []).map(s => s.id))
      const filteredAtt = (att || []).filter(a => studIds.has(a.student_id))

      const byStudent = {}
      filteredAtt.forEach(a => {
        if (!byStudent[a.student_id]) byStudent[a.student_id] = { present: 0, absent: 0, late: 0, excused: 0 }
        const st = a.status || 'present'
        byStudent[a.student_id][st] = (byStudent[a.student_id][st] || 0) + 1
      })

      const data = (studs || []).map(s => ({
        ...s,
        ...{ present: 0, absent: 0, late: 0, excused: 0 },
        ...(byStudent[s.id] || {}),
      })).sort((a, b) => {
        const gA = a.gender === 'Female' ? 0 : 1
        const gB = b.gender === 'Female' ? 0 : 1
        if (gA !== gB) return gA - gB
        return (a.first_name || '').localeCompare(b.first_name || '')
      })

      setSummaryData(data)
    } finally {
      setLoadingSummary(false)
    }
  }, [summaryClassId, summaryMonth])

  useEffect(() => {
    if (viewMode === 'summary') loadSummary()
  }, [viewMode, loadSummary])

  const presentCount = students.filter(s => attendance[s.id]?.status === 'present').length
  const absentCount = students.filter(s => attendance[s.id]?.status === 'absent').length
  const lateCount = students.filter(s => attendance[s.id]?.status === 'late').length

  const selectedClass = classes.find(c => c.id === selectedClassId)

  return (
    <div>
      <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Daily Attendance</h1>
          <p className="text-gray-500 mt-1">Record and review student attendance by class</p>
        </div>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          <button
            onClick={() => setViewMode('entry')}
            className={`px-4 py-1.5 text-sm font-medium rounded-lg transition ${viewMode === 'entry' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >Enter Attendance</button>
          <button
            onClick={() => setViewMode('summary')}
            className={`px-4 py-1.5 text-sm font-medium rounded-lg transition ${viewMode === 'summary' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >Monthly Summary</button>
        </div>
      </div>

      {/* ── ENTRY MODE ── */}
      {viewMode === 'entry' && (
        <div className="space-y-5">
          {/* Filters */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Class</label>
                <select
                  value={selectedClassId}
                  onChange={e => { setSelectedClassId(e.target.value); setSelectedStreamId('') }}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500"
                >
                  <option value="">Select class...</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
                </select>
              </div>
              {streamsForClass.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Stream (optional)</label>
                  <select
                    value={selectedStreamId}
                    onChange={e => setSelectedStreamId(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500"
                  >
                    <option value="">All Streams</option>
                    {streamsForClass.map(cs => (
                      <option key={cs.id} value={cs.id}>{cs.streams?.stream_name || cs.id}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Date</label>
                <input
                  type="date"
                  value={selectedDate}
                  max={today}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500"
                />
              </div>
            </div>
          </div>

          {!selectedClassId ? (
            <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
              <p className="text-sm text-gray-500">Select a class to start entering attendance.</p>
            </div>
          ) : loadingStudents ? (
            <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-gray-200 border-t-maroon-600 rounded-full animate-spin" /></div>
          ) : students.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
              <p className="text-sm text-gray-500">No active students in this class.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Header with counts + bulk actions */}
              <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-center gap-3 justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-semibold text-gray-800">
                    {selectedClass?.class_name} — {selectedDate}
                  </span>
                  <span className="text-xs text-emerald-600 font-medium">✓ {presentCount} Present</span>
                  <span className="text-xs text-red-500 font-medium">✗ {absentCount} Absent</span>
                  {lateCount > 0 && <span className="text-xs text-amber-600 font-medium">⏱ {lateCount} Late</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 mr-1">Mark all:</span>
                  {STATUS_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setAllStatus(opt.value)}
                      className={`px-2.5 py-1 text-xs font-medium rounded border transition ${opt.color}`}
                    >{opt.label}</button>
                  ))}
                </div>
              </div>

              {/* Student list */}
              <div className="divide-y divide-gray-100">
                {students.map((s, idx) => {
                  const att = attendance[s.id] || { status: 'present', notes: '' }
                  const hasExisting = !!existing[s.id]
                  return (
                    <div key={s.id} className="px-5 py-3 flex items-center gap-3 flex-wrap">
                      <span className="text-xs text-gray-400 w-6 text-right shrink-0">{idx + 1}</span>
                      <div className="flex-1 min-w-40">
                        <span className="text-sm font-medium text-gray-900">
                          {[s.first_name, s.middle_name, s.surname].filter(Boolean).join(' ')}
                        </span>
                        <span className="ml-2 text-xs text-gray-400">{s.admission_number}</span>
                        {hasExisting && <span className="ml-2 text-xs text-blue-400 italic">saved</span>}
                      </div>
                      <div className="flex gap-1.5">
                        {STATUS_OPTIONS.map(opt => (
                          <button
                            key={opt.value}
                            onClick={() => setStatus(s.id, opt.value)}
                            className={`px-2.5 py-1 text-xs font-medium rounded border transition ${att.status === opt.value ? opt.color : 'border-gray-200 text-gray-400 hover:border-gray-300'}`}
                          >{opt.label}</button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Footer */}
              <div className="px-5 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
                <span className="text-xs text-gray-500">{students.length} student(s)</span>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-2 bg-maroon-600 hover:bg-maroon-700 disabled:opacity-60 text-white text-sm font-semibold px-5 py-2 rounded-lg transition"
                >
                  {saving ? (
                    <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Saving…</>
                  ) : 'Save Attendance'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── SUMMARY MODE ── */}
      {viewMode === 'summary' && (
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Class</label>
                <select
                  value={summaryClassId}
                  onChange={e => setSummaryClassId(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500"
                >
                  <option value="">Select class...</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Month</label>
                <input
                  type="month"
                  value={summaryMonth}
                  onChange={e => setSummaryMonth(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500"
                />
              </div>
            </div>
          </div>

          {!summaryClassId ? (
            <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
              <p className="text-sm text-gray-500">Select a class and month to view the attendance summary.</p>
            </div>
          ) : loadingSummary ? (
            <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-gray-200 border-t-maroon-600 rounded-full animate-spin" /></div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-800">
                  {classes.find(c => c.id === summaryClassId)?.class_name} — {summaryMonth}
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">#</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Student</th>
                      <th className="text-center px-3 py-3 text-xs font-semibold text-emerald-600 uppercase">Present</th>
                      <th className="text-center px-3 py-3 text-xs font-semibold text-red-500 uppercase">Absent</th>
                      <th className="text-center px-3 py-3 text-xs font-semibold text-amber-600 uppercase">Late</th>
                      <th className="text-center px-3 py-3 text-xs font-semibold text-blue-500 uppercase">Excused</th>
                      <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Total Days</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {summaryData.length === 0 ? (
                      <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">No attendance records for this period.</td></tr>
                    ) : summaryData.map((s, i) => {
                      const total = s.present + s.absent + s.late + s.excused
                      return (
                        <tr key={s.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-xs text-gray-400">{i + 1}</td>
                          <td className="px-4 py-3 font-medium text-gray-900">
                            {[s.first_name, s.middle_name, s.surname].filter(Boolean).join(' ')}
                          </td>
                          <td className="px-3 py-3 text-center font-medium text-emerald-600">{s.present || 0}</td>
                          <td className="px-3 py-3 text-center font-medium text-red-500">{s.absent || 0}</td>
                          <td className="px-3 py-3 text-center font-medium text-amber-600">{s.late || 0}</td>
                          <td className="px-3 py-3 text-center font-medium text-blue-500">{s.excused || 0}</td>
                          <td className="px-3 py-3 text-center text-gray-500">{total}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
