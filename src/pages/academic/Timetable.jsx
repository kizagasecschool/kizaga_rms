import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useNotification } from '../../context/NotificationContext'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

const COLORS = [
  'bg-blue-100 text-blue-800 border-blue-200',
  'bg-emerald-100 text-emerald-800 border-emerald-200',
  'bg-purple-100 text-purple-800 border-purple-200',
  'bg-amber-100 text-amber-800 border-amber-200',
  'bg-rose-100 text-rose-800 border-rose-200',
  'bg-cyan-100 text-cyan-800 border-cyan-200',
  'bg-orange-100 text-orange-800 border-orange-200',
  'bg-indigo-100 text-indigo-800 border-indigo-200',
  'bg-teal-100 text-teal-800 border-teal-200',
  'bg-pink-100 text-pink-800 border-pink-200',
  'bg-lime-100 text-lime-800 border-lime-200',
  'bg-sky-100 text-sky-800 border-sky-200',
]

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function fmt(t) {
  if (!t) return ''
  return t.slice(0, 5)
}

export default function Timetable() {
  const { showToast } = useNotification()

  const [activeTab, setActiveTab] = useState('view')
  const [academicYears, setAcademicYears] = useState([])
  const [selectedYearId, setSelectedYearId] = useState('')
  const [classes, setClasses] = useState([])
  const [classStreams, setClassStreams] = useState([])
  const [selectedClassId, setSelectedClassId] = useState('')
  const [selectedStreamId, setSelectedStreamId] = useState('')

  const [periods, setPeriods] = useState([])
  const [periodDraft, setPeriodDraft] = useState([])
  const [savingPeriods, setSavingPeriods] = useState(false)

  const [entries, setEntries] = useState([])
  const [allEntries, setAllEntries] = useState([])
  const [teacherSubjects, setTeacherSubjects] = useState([])
  const [teachers, setTeachers] = useState([])
  const [allSubjects, setAllSubjects] = useState([])
  const [loadingEntries, setLoadingEntries] = useState(false)

  // Edit mode
  const [editingCell, setEditingCell] = useState(null)
  const [cellSubjectId, setCellSubjectId] = useState('')
  const [cellTeacherId, setCellTeacherId] = useState('')
  const [savingCell, setSavingCell] = useState(false)

  // Generate mode
  const [genConfig, setGenConfig] = useState({})
  const [genPreview, setGenPreview] = useState([])
  const [savingGen, setSavingGen] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase.from('academic_years').select('*').order('year_name', { ascending: false }).limit(10),
      supabase.from('classes').select('*').order('sort_order'),
      supabase.from('class_streams').select('*, streams(stream_name), classes(class_name)').order('class_id'),
      supabase.from('periods').select('*').order('period_number'),
      supabase.from('subjects').select('id, subject_name').order('subject_name'),
      supabase.from('teachers').select('id, profiles(full_name)').eq('status', 'active'),
    ]).then(([yR, cR, csR, pR, subR, tR]) => {
      if (yR.data) { setAcademicYears(yR.data); if (yR.data[0]) setSelectedYearId(yR.data[0].id) }
      if (cR.data) { setClasses(cR.data); if (cR.data[0]) setSelectedClassId(cR.data[0].id) }
      if (csR.data) setClassStreams(csR.data)
      if (pR.data) { setPeriods(pR.data); setPeriodDraft(pR.data.map(p => ({ ...p }))) }
      if (subR.data) setAllSubjects(subR.data)
      if (tR.data) setTeachers(tR.data)
    })
  }, [])

  const streamsForClass = classStreams.filter(cs => cs.class_id === selectedClassId)

  useEffect(() => {
    if (streamsForClass.length > 0) {
      setSelectedStreamId(prev => {
        if (prev && streamsForClass.find(cs => cs.id === prev)) return prev
        return streamsForClass[0]?.id || ''
      })
    } else {
      setSelectedStreamId('')
    }
  }, [selectedClassId])

  const loadEntries = useCallback(async () => {
    const streamId = selectedStreamId || (streamsForClass[0]?.id)
    if (!streamId || !selectedYearId) return
    setLoadingEntries(true)
    try {
      const [{ data: ents }, { data: allE }, { data: ts }] = await Promise.all([
        supabase.from('timetable_entries')
          .select('id, period_id, day_of_week, subject_id, teacher_id, subjects(subject_name), teachers(profiles(full_name))')
          .eq('class_stream_id', streamId)
          .eq('academic_year_id', selectedYearId),
        supabase.from('timetable_entries')
          .select('teacher_id, period_id, day_of_week, class_stream_id')
          .eq('academic_year_id', selectedYearId),
        supabase.from('teacher_subjects')
          .select('subject_id, teacher_id, subjects(subject_name), teachers(profiles(full_name))')
          .eq('class_stream_id', streamId),
      ])
      if (ents) setEntries(ents)
      if (allE) setAllEntries(allE)
      if (ts) {
        setTeacherSubjects(ts)
        setGenConfig(prev => {
          const cfg = { ...prev }
          ts.forEach(s => { if (!cfg[s.subject_id]) cfg[s.subject_id] = 5 })
          return cfg
        })
      }
    } finally {
      setLoadingEntries(false)
    }
  }, [selectedStreamId, selectedYearId, selectedClassId])

  useEffect(() => {
    setEntries([])
    setGenPreview([])
    loadEntries()
  }, [loadEntries])

  // Build lookup: { "period_id|day": entry }
  const entryMap = {}
  entries.forEach(e => { entryMap[`${e.period_id}|${e.day_of_week}`] = e })

  // Build preview map for generate tab
  const previewMap = {}
  genPreview.forEach(e => { previewMap[`${e.period_id}|${e.day_of_week}`] = e })

  // Subject color map (index-based)
  const subjectColorMap = {}
  const uniqueSubjects = [...new Set([...entries, ...genPreview].map(e => e.subject_id).filter(Boolean))]
  uniqueSubjects.forEach((id, i) => { subjectColorMap[id] = COLORS[i % COLORS.length] })

  // Teacher clash check
  const isTeacherBusy = (teacherId, periodId, dayOfWeek, excludeStreamId) => {
    if (!teacherId) return false
    return allEntries.some(e =>
      e.teacher_id === teacherId &&
      e.period_id === periodId &&
      e.day_of_week === dayOfWeek &&
      e.class_stream_id !== excludeStreamId
    )
  }

  // ── SAVE CELL (Edit mode) ──
  const saveCell = async () => {
    if (!editingCell) return
    const streamId = selectedStreamId || streamsForClass[0]?.id
    setSavingCell(true)
    try {
      const existing = entryMap[`${editingCell.period_id}|${editingCell.day_of_week}`]
      if (!cellSubjectId && !cellTeacherId) {
        // Clear cell
        if (existing?.id) {
          const { error } = await supabase.from('timetable_entries').delete().eq('id', existing.id)
          if (error) throw error
        }
      } else {
        const row = {
          academic_year_id: selectedYearId,
          class_stream_id: streamId,
          period_id: editingCell.period_id,
          day_of_week: editingCell.day_of_week,
          subject_id: cellSubjectId || null,
          teacher_id: cellTeacherId || null,
        }
        const { error } = await supabase.from('timetable_entries').upsert(row, {
          onConflict: 'period_id,day_of_week,academic_year_id,class_stream_id'
        })
        if (error) throw error
      }
      await loadEntries()
      setEditingCell(null)
      showToast('Cell saved', 'success')
    } catch (err) {
      showToast('Failed to save: ' + (err.message || ''), 'error')
    } finally {
      setSavingCell(false)
    }
  }

  const openEditCell = (period, day) => {
    const key = `${period.id}|${day}`
    const existing = entryMap[key]
    setEditingCell({ period_id: period.id, day_of_week: day, label: `${period.label} — ${DAYS[day - 1]}` })
    setCellSubjectId(existing?.subject_id || '')
    setCellTeacherId(existing?.teacher_id || '')
  }

  // ── AUTO-GENERATE ──
  const generate = () => {
    const streamId = selectedStreamId || streamsForClass[0]?.id
    const teachingPeriods = periods.filter(p => !p.is_break)

    // Build all slots
    const slots = []
    for (const p of teachingPeriods) {
      for (let d = 1; d <= 5; d++) {
        slots.push({ period_id: p.id, day_of_week: d })
      }
    }
    const shuffled = shuffle(slots)

    // Build teacher busy map from allEntries (other streams)
    const teacherBusy = {}
    allEntries.filter(e => e.class_stream_id !== streamId).forEach(e => {
      if (!e.teacher_id) return
      if (!teacherBusy[e.teacher_id]) teacherBusy[e.teacher_id] = new Set()
      teacherBusy[e.teacher_id].add(`${e.period_id}|${e.day_of_week}`)
    })

    // Build tasks
    const tasks = teacherSubjects
      .filter(ts => genConfig[ts.subject_id] > 0)
      .map(ts => ({
        subject_id: ts.subject_id,
        teacher_id: ts.teacher_id,
        subjectName: ts.subjects?.subject_name,
        teacherName: ts.teachers?.profiles?.full_name,
        remaining: Number(genConfig[ts.subject_id]) || 0,
      }))
      .filter(t => t.remaining > 0)

    const result = []
    const usedSlots = new Set()
    const subjectDayCount = {}
    let taskIdx = 0

    for (const slot of shuffled) {
      if (usedSlots.has(`${slot.period_id}|${slot.day_of_week}`)) continue

      // Try each task starting from current position
      let assigned = false
      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[(taskIdx + i) % tasks.length]
        if (task.remaining <= 0) continue

        const slotKey = `${slot.period_id}|${slot.day_of_week}`

        // Teacher clash check
        if (task.teacher_id && teacherBusy[task.teacher_id]?.has(slotKey)) continue

        // Limit same subject to max 2× per day
        const dayKey = `${task.subject_id}|${slot.day_of_week}`
        if ((subjectDayCount[dayKey] || 0) >= 2) continue

        // Assign
        result.push({
          period_id: slot.period_id,
          day_of_week: slot.day_of_week,
          subject_id: task.subject_id,
          teacher_id: task.teacher_id,
          subjects: { subject_name: task.subjectName },
          teachers: { profiles: { full_name: task.teacherName } },
        })
        usedSlots.add(slotKey)
        task.remaining--
        if (task.teacher_id) {
          if (!teacherBusy[task.teacher_id]) teacherBusy[task.teacher_id] = new Set()
          teacherBusy[task.teacher_id].add(slotKey)
        }
        subjectDayCount[dayKey] = (subjectDayCount[dayKey] || 0) + 1
        assigned = true
        taskIdx = (taskIdx + 1) % tasks.length
        break
      }
    }

    const unfinished = tasks.filter(t => t.remaining > 0)
    if (unfinished.length > 0) {
      showToast(`Could not fit all periods — ${unfinished.map(t => `${t.subjectName} (${t.remaining} left)`).join(', ')}. Reduce periods or add more time slots.`, 'warning')
    } else {
      showToast('Timetable generated — review below then click Save', 'success')
    }

    setGenPreview(result)
  }

  const saveGenerated = async () => {
    const streamId = selectedStreamId || streamsForClass[0]?.id
    if (!genPreview.length) return
    setSavingGen(true)
    try {
      // Delete existing entries for this stream+year first
      await supabase.from('timetable_entries')
        .delete()
        .eq('class_stream_id', streamId)
        .eq('academic_year_id', selectedYearId)

      const rows = genPreview.map(e => ({
        academic_year_id: selectedYearId,
        class_stream_id: streamId,
        period_id: e.period_id,
        day_of_week: e.day_of_week,
        subject_id: e.subject_id || null,
        teacher_id: e.teacher_id || null,
      }))
      const { error } = await supabase.from('timetable_entries').insert(rows)
      if (error) throw error
      await loadEntries()
      setGenPreview([])
      setActiveTab('view')
      showToast(`Timetable saved — ${rows.length} periods assigned`, 'success')
    } catch (err) {
      showToast('Failed to save: ' + (err.message || ''), 'error')
    } finally {
      setSavingGen(false)
    }
  }

  // ── PERIODS MANAGEMENT ──
  const savePeriods = async () => {
    setSavingPeriods(true)
    try {
      for (const p of periodDraft) {
        if (p.id) {
          const { error } = await supabase.from('periods').update({
            start_time: p.start_time,
            end_time: p.end_time,
            is_break: p.is_break,
            label: p.label,
          }).eq('id', p.id)
          if (error) throw error
        }
      }
      const { data } = await supabase.from('periods').select('*').order('period_number')
      if (data) { setPeriods(data); setPeriodDraft(data.map(p => ({ ...p }))) }
      showToast('Bell schedule saved', 'success')
    } catch (err) {
      showToast('Failed to save: ' + (err.message || ''), 'error')
    } finally {
      setSavingPeriods(false)
    }
  }

  const addPeriod = () => {
    const maxNum = Math.max(0, ...periodDraft.map(p => p.period_number))
    setPeriodDraft(prev => [...prev, {
      id: null, period_number: maxNum + 1, start_time: '', end_time: '', is_break: false, label: `Period ${maxNum}`
    }])
  }

  const addPeriodToDB = async (draft) => {
    const { data, error } = await supabase.from('periods').insert({
      period_number: draft.period_number,
      start_time: draft.start_time,
      end_time: draft.end_time,
      is_break: draft.is_break,
      label: draft.label,
    }).select().single()
    if (error) { showToast('Failed: ' + error.message, 'error'); return }
    const { data: all } = await supabase.from('periods').select('*').order('period_number')
    if (all) { setPeriods(all); setPeriodDraft(all.map(p => ({ ...p }))) }
    showToast('Period added', 'success')
  }

  // ── GRID RENDER ──
  const renderGrid = (map, subColorMap, showClash = false) => {
    const streamId = selectedStreamId || streamsForClass[0]?.id
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className="border border-gray-200 bg-gray-50 px-3 py-2.5 text-left text-gray-600 font-semibold w-28">Period</th>
              {DAYS.map((d, i) => (
                <th key={d} className="border border-gray-200 bg-gray-50 px-3 py-2.5 text-center text-gray-700 font-semibold">
                  <span className="hidden sm:inline">{d}</span>
                  <span className="sm:hidden">{DAY_SHORT[i]}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {periods.map(period => (
              <tr key={period.id} className={period.is_break ? 'bg-gray-50/70' : 'hover:bg-gray-50/30'}>
                <td className="border border-gray-200 px-3 py-2.5 align-top whitespace-nowrap">
                  <div className="font-semibold text-gray-700">{period.label}</div>
                  <div className="text-gray-400">{fmt(period.start_time)} – {fmt(period.end_time)}</div>
                </td>
                {period.is_break ? (
                  <td colSpan={5} className="border border-gray-200 px-3 py-2 text-center text-gray-400 italic text-xs bg-gray-100/60">
                    {period.label}
                  </td>
                ) : (
                  [1, 2, 3, 4, 5].map(day => {
                    const key = `${period.id}|${day}`
                    const entry = map[key]
                    const clash = showClash && entry?.teacher_id && isTeacherBusy(entry.teacher_id, period.id, day, streamId)
                    const color = entry?.subject_id ? subColorMap[entry.subject_id] || COLORS[0] : ''
                    return (
                      <td
                        key={day}
                        onClick={activeTab === 'edit' ? () => openEditCell(period, day) : undefined}
                        className={`border border-gray-200 px-2 py-2 align-top min-w-[110px] ${activeTab === 'edit' ? 'cursor-pointer hover:bg-maroon-50/50' : ''}`}
                      >
                        {entry ? (
                          <div className={`rounded-lg px-2 py-1.5 border text-center ${color} ${clash ? 'ring-2 ring-red-400' : ''}`}>
                            <div className="font-semibold text-xs leading-tight">
                              {entry.subjects?.subject_name || '—'}
                            </div>
                            <div className="text-xs opacity-70 mt-0.5 leading-tight">
                              {entry.teachers?.profiles?.full_name || ''}
                            </div>
                            {clash && <div className="text-red-600 text-xs font-bold mt-0.5">⚠ Clash</div>}
                          </div>
                        ) : (
                          activeTab === 'edit' ? (
                            <div className="h-10 flex items-center justify-center text-gray-300 hover:text-gray-400 transition text-lg">+</div>
                          ) : (
                            <div className="h-10" />
                          )
                        )}
                      </td>
                    )
                  })
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  const currentStream = classStreams.find(cs => cs.id === (selectedStreamId || streamsForClass[0]?.id))
  const currentClass = classes.find(c => c.id === selectedClassId)
  const currentYear = academicYears.find(y => y.id === selectedYearId)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Timetable</h1>
        <p className="text-gray-500 mt-1">Manage and auto-generate class schedules without period clashes</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6 flex-wrap">
        {[
          { key: 'view', label: 'View Timetable' },
          { key: 'edit', label: 'Edit Manually' },
          { key: 'generate', label: 'Auto-Generate' },
          { key: 'periods', label: 'Bell Schedule' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => { setActiveTab(t.key); setEditingCell(null); setGenPreview([]) }}
            className={`px-4 py-1.5 text-sm font-medium rounded-lg transition ${activeTab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >{t.label}</button>
        ))}
      </div>

      {/* ── CLASS / YEAR SELECTOR (all tabs except periods) ── */}
      {activeTab !== 'periods' && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Academic Year</label>
              <select value={selectedYearId} onChange={e => setSelectedYearId(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500">
                {academicYears.map(y => <option key={y.id} value={y.id}>{y.year_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Class</label>
              <select value={selectedClassId} onChange={e => setSelectedClassId(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500">
                {classes.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
              </select>
            </div>
            {streamsForClass.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Stream</label>
                <select value={selectedStreamId} onChange={e => setSelectedStreamId(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500">
                  {streamsForClass.map(cs => <option key={cs.id} value={cs.id}>{cs.classes?.class_name} {cs.streams?.stream_name}</option>)}
                </select>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── VIEW TAB ── */}
      {activeTab === 'view' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-800">
                {currentClass?.class_name}{currentStream ? ` — Stream ${currentStream.streams?.stream_name}` : ''} Timetable
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">{currentYear?.year_name}</p>
            </div>
            <button
              onClick={() => window.print()}
              className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 transition"
            >Print</button>
          </div>
          {loadingEntries ? (
            <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-gray-200 border-t-maroon-600 rounded-full animate-spin" /></div>
          ) : (
            renderGrid(entryMap, subjectColorMap)
          )}
          {/* Legend */}
          {entries.length > 0 && (
            <div className="px-5 py-3 border-t border-gray-100 flex flex-wrap gap-2">
              {[...new Set(entries.map(e => e.subject_id).filter(Boolean))].map((sid, i) => {
                const subj = entries.find(e => e.subject_id === sid)
                return (
                  <span key={sid} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${COLORS[i % COLORS.length]}`}>
                    {subj?.subjects?.subject_name}
                  </span>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── EDIT TAB ── */}
      {activeTab === 'edit' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-700">
            Click any cell to assign a subject and teacher. Click an existing cell to change or clear it.
          </div>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-800">
                {currentClass?.class_name}{currentStream ? ` — Stream ${currentStream.streams?.stream_name}` : ''}
              </h2>
            </div>
            {loadingEntries ? (
              <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-gray-200 border-t-maroon-600 rounded-full animate-spin" /></div>
            ) : (
              renderGrid(entryMap, subjectColorMap, true)
            )}
          </div>

          {/* Edit cell modal */}
          {editingCell && (
            <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setEditingCell(null)}>
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
                <h3 className="text-base font-semibold text-gray-900 mb-4">{editingCell.label}</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Subject</label>
                    <select value={cellSubjectId} onChange={e => {
                      setCellSubjectId(e.target.value)
                      const ts = teacherSubjects.find(t => t.subject_id === e.target.value)
                      if (ts) setCellTeacherId(ts.teacher_id)
                    }}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500">
                      <option value="">— Clear —</option>
                      {teacherSubjects.map(ts => (
                        <option key={ts.subject_id} value={ts.subject_id}>{ts.subjects?.subject_name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Teacher</label>
                    <select value={cellTeacherId} onChange={e => setCellTeacherId(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500">
                      <option value="">— None —</option>
                      {teachers.map(t => {
                        const busy = isTeacherBusy(t.id, editingCell.period_id, editingCell.day_of_week, selectedStreamId || streamsForClass[0]?.id)
                        return (
                          <option key={t.id} value={t.id}>
                            {t.profiles?.full_name}{busy ? ' ⚠ Busy' : ''}
                          </option>
                        )
                      })}
                    </select>
                    {cellTeacherId && isTeacherBusy(cellTeacherId, editingCell.period_id, editingCell.day_of_week, selectedStreamId || streamsForClass[0]?.id) && (
                      <p className="text-xs text-red-500 mt-1">⚠ This teacher is already assigned to another class at this time.</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button onClick={() => setEditingCell(null)} className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-xl text-gray-600 hover:bg-gray-50 transition">Cancel</button>
                  <button onClick={saveCell} disabled={savingCell} className="flex-1 px-4 py-2 text-sm bg-maroon-600 hover:bg-maroon-700 text-white rounded-xl font-medium disabled:opacity-60 transition">
                    {savingCell ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── GENERATE TAB ── */}
      {activeTab === 'generate' && (
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-800 mb-1">Periods Per Week Per Subject</h2>
            <p className="text-xs text-gray-500 mb-4">Set how many periods each subject gets per week. The generator will place them across the week without teacher clashes.</p>
            {teacherSubjects.length === 0 ? (
              <p className="text-sm text-gray-400">No subjects assigned to this class/stream. Assign teacher subjects first.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {teacherSubjects.map(ts => (
                  <div key={ts.subject_id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-800 truncate">{ts.subjects?.subject_name}</div>
                      <div className="text-xs text-gray-400 truncate">{ts.teachers?.profiles?.full_name}</div>
                    </div>
                    <input
                      type="number" min="0" max="20"
                      value={genConfig[ts.subject_id] ?? 5}
                      onChange={e => setGenConfig(prev => ({ ...prev, [ts.subject_id]: Number(e.target.value) }))}
                      className="w-14 px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-maroon-500"
                    />
                    <span className="text-xs text-gray-400">pw</span>
                  </div>
                ))}
              </div>
            )}

            {teacherSubjects.length > 0 && (
              <div className="mt-5 flex items-center gap-3">
                <button
                  onClick={generate}
                  className="px-5 py-2.5 bg-maroon-600 hover:bg-maroon-700 text-white text-sm font-semibold rounded-xl transition"
                >Generate Timetable</button>
                <span className="text-xs text-gray-400">
                  Total: {Object.entries(genConfig).reduce((sum, [sid, v]) => {
                    return teacherSubjects.find(t => t.subject_id === sid) ? sum + Number(v) : sum
                  }, 0)} periods/week across {periods.filter(p => !p.is_break).length * 5} available slots
                </span>
              </div>
            )}
          </div>

          {genPreview.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-gray-800">Generated Preview</h2>
                  <p className="text-xs text-gray-400 mt-0.5">{genPreview.length} periods assigned — review for clashes before saving</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={generate} className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-gray-600">Regenerate</button>
                  <button onClick={saveGenerated} disabled={savingGen}
                    className="text-xs px-4 py-1.5 bg-maroon-600 hover:bg-maroon-700 text-white rounded-lg font-medium disabled:opacity-60 transition">
                    {savingGen ? 'Saving…' : 'Save Timetable'}
                  </button>
                </div>
              </div>
              {renderGrid(previewMap, subjectColorMap, true)}
            </div>
          )}
        </div>
      )}

      {/* ── BELL SCHEDULE TAB ── */}
      {activeTab === 'periods' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-800">Bell Schedule</h2>
              <p className="text-xs text-gray-400 mt-0.5">Define the school's daily period times. Changes affect all timetables.</p>
            </div>
            <button onClick={addPeriod} className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-gray-600">+ Add Period</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">#</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Label</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Start</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">End</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Break?</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {periodDraft.map((p, i) => (
                  <tr key={p.id || i} className={p.is_break ? 'bg-gray-50' : 'hover:bg-gray-50'}>
                    <td className="px-4 py-3 text-gray-400 text-xs">{p.period_number}</td>
                    <td className="px-4 py-3">
                      <input value={p.label || ''} onChange={e => setPeriodDraft(prev => prev.map((x, j) => j === i ? { ...x, label: e.target.value } : x))}
                        className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500" />
                    </td>
                    <td className="px-4 py-3">
                      <input type="time" value={p.start_time?.slice(0, 5) || ''} onChange={e => setPeriodDraft(prev => prev.map((x, j) => j === i ? { ...x, start_time: e.target.value } : x))}
                        className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500" />
                    </td>
                    <td className="px-4 py-3">
                      <input type="time" value={p.end_time?.slice(0, 5) || ''} onChange={e => setPeriodDraft(prev => prev.map((x, j) => j === i ? { ...x, end_time: e.target.value } : x))}
                        className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500" />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input type="checkbox" checked={!!p.is_break} onChange={e => setPeriodDraft(prev => prev.map((x, j) => j === i ? { ...x, is_break: e.target.checked } : x))}
                        className="w-4 h-4 rounded border-gray-300 text-maroon-600 focus:ring-maroon-500 cursor-pointer" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-4 border-t border-gray-100 bg-gray-50 flex justify-end">
            <button onClick={savePeriods} disabled={savingPeriods}
              className="px-5 py-2 bg-maroon-600 hover:bg-maroon-700 text-white text-sm font-semibold rounded-xl disabled:opacity-60 transition">
              {savingPeriods ? 'Saving…' : 'Save Bell Schedule'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
