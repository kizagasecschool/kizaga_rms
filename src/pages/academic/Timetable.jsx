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

function addMinutes(timeStr, mins) {
  const [h, m] = timeStr.split(':').map(Number)
  const total = h * 60 + m + mins
  const hh = String(Math.floor(total / 60)).padStart(2, '0')
  const mm = String(total % 60).padStart(2, '0')
  return `${hh}:${mm}`
}

function fmt(t) { return t ? t.slice(0, 5) : '' }

export default function Timetable() {
  const { showToast } = useNotification()

  const [activeTab, setActiveTab] = useState('view')
  const [academicYears, setAcademicYears] = useState([])
  const [selectedYearId, setSelectedYearId] = useState('')
  const [classes, setClasses] = useState([])
  const [classStreams, setClassStreams] = useState([])
  const [selectedClassId, setSelectedClassId] = useState('')
  const [selectedStreamId, setSelectedStreamId] = useState('')

  // Periods
  const [periods, setPeriods] = useState([])

  // Bell schedule builder state
  const [bellStart, setBellStart] = useState('07:30')
  const [singleMin, setSingleMin] = useState(40)
  const [numPeriods, setNumPeriods] = useState(8)
  const [breaks, setBreaks] = useState([
    { after_period: 3, duration: 20, label: 'Morning Break' },
    { after_period: 6, duration: 40, label: 'Lunch Break' },
  ])
  const [buildingBell, setBuildingBell] = useState(false)

  // Allocations
  const [allocations, setAllocations] = useState([])
  const [teacherSubjects, setTeacherSubjects] = useState([])
  const [savingAlloc, setSavingAlloc] = useState(false)

  // Timetable entries
  const [entries, setEntries] = useState([])
  const [allEntries, setAllEntries] = useState([])
  const [loadingEntries, setLoadingEntries] = useState(false)

  // Edit cell
  const [editingCell, setEditingCell] = useState(null)
  const [cellSubjectId, setCellSubjectId] = useState('')
  const [cellTeacherId, setCellTeacherId] = useState('')
  const [savingCell, setSavingCell] = useState(false)

  // Generate
  const [genPreview, setGenPreview] = useState([])
  const [savingGen, setSavingGen] = useState(false)
  const [genErrors, setGenErrors] = useState([])

  // Teachers (for dropdown)
  const [teachers, setTeachers] = useState([])

  // Subject color map
  const subjectColorMap = {}
  const allEntriesForColor = [...entries, ...genPreview]
  const uniqueSubjectIds = [...new Set(allEntriesForColor.map(e => e.subject_id).filter(Boolean))]
  uniqueSubjectIds.forEach((id, i) => { subjectColorMap[id] = COLORS[i % COLORS.length] })

  useEffect(() => {
    Promise.all([
      supabase.from('academic_years').select('*').order('year_name', { ascending: false }).limit(10),
      supabase.from('classes').select('*').order('sort_order'),
      supabase.from('class_streams').select('*, streams(stream_name), classes(class_name)').order('class_id'),
      supabase.from('periods').select('*').order('period_number'),
      supabase.from('teachers').select('id, profiles(full_name)').eq('status', 'active'),
    ]).then(([yR, cR, csR, pR, tR]) => {
      if (yR.data) { setAcademicYears(yR.data); if (yR.data[0]) setSelectedYearId(yR.data[0].id) }
      if (cR.data) { setClasses(cR.data); if (cR.data[0]) setSelectedClassId(cR.data[0].id) }
      if (csR.data) setClassStreams(csR.data)
      if (pR.data) setPeriods(pR.data)
      if (tR.data) setTeachers(tR.data)
    })
  }, [])

  const streamsForClass = classStreams.filter(cs => cs.class_id === selectedClassId)

  useEffect(() => {
    if (streamsForClass.length > 0) {
      setSelectedStreamId(prev =>
        prev && streamsForClass.find(cs => cs.id === prev) ? prev : (streamsForClass[0]?.id || '')
      )
    } else {
      setSelectedStreamId('')
    }
  }, [selectedClassId])

  const effectiveStreamId = selectedStreamId || streamsForClass[0]?.id || ''

  const loadData = useCallback(async () => {
    if (!effectiveStreamId || !selectedYearId) return
    setLoadingEntries(true)
    try {
      const [{ data: ents }, { data: allE }, { data: ts }, { data: alloc }] = await Promise.all([
        supabase.from('timetable_entries')
          .select('id, period_id, day_of_week, is_double, subject_id, teacher_id, subjects(subject_name), teachers(profiles(full_name))')
          .eq('class_stream_id', effectiveStreamId)
          .eq('academic_year_id', selectedYearId),
        supabase.from('timetable_entries')
          .select('teacher_id, period_id, day_of_week, class_stream_id')
          .eq('academic_year_id', selectedYearId),
        supabase.from('teacher_subjects')
          .select('subject_id, teacher_id, subjects(subject_name), teachers(profiles(full_name))')
          .eq('class_stream_id', effectiveStreamId),
        supabase.from('timetable_allocations')
          .select('*')
          .eq('class_stream_id', effectiveStreamId)
          .eq('academic_year_id', selectedYearId),
      ])
      if (ents) setEntries(ents)
      if (allE) setAllEntries(allE)
      if (ts) setTeacherSubjects(ts)
      if (alloc) {
        // Merge teacher_subjects into allocations, filling gaps
        const allocMap = {}
        alloc.forEach(a => { allocMap[a.subject_id] = a })
        // Ensure all teacher_subjects have an entry
        const merged = (ts || []).map(ts_row => allocMap[ts_row.subject_id] || {
          subject_id: ts_row.subject_id,
          teacher_id: ts_row.teacher_id,
          subject_name: ts_row.subjects?.subject_name,
          teacher_name: ts_row.teachers?.profiles?.full_name,
          periods_per_week: 5,
          is_double: false,
          is_special: false,
        })
        setAllocations(merged)
      } else if (ts) {
        setAllocations((ts || []).map(t => ({
          subject_id: t.subject_id,
          teacher_id: t.teacher_id,
          subject_name: t.subjects?.subject_name,
          teacher_name: t.teachers?.profiles?.full_name,
          periods_per_week: 5,
          is_double: false,
          is_special: false,
        })))
      }
    } finally {
      setLoadingEntries(false)
    }
  }, [effectiveStreamId, selectedYearId])

  useEffect(() => {
    setEntries([])
    setGenPreview([])
    setGenErrors([])
    loadData()
  }, [loadData])

  // ── BELL SCHEDULE BUILDER ──
  const buildBellSchedule = async () => {
    setBuildingBell(true)
    try {
      // Generate period rows from settings
      const rows = []
      let currentTime = bellStart
      let periodNum = 1
      const breakMap = {}
      breaks.forEach(b => { breakMap[b.after_period] = b })

      for (let i = 1; i <= numPeriods; i++) {
        const startT = currentTime
        const endT = addMinutes(startT, singleMin)
        rows.push({ period_number: periodNum, start_time: startT, end_time: endT, is_break: false, label: `Period ${periodNum}` })
        currentTime = endT
        periodNum++

        if (breakMap[i]) {
          const brk = breakMap[i]
          const bStart = currentTime
          const bEnd = addMinutes(bStart, brk.duration)
          rows.push({ period_number: periodNum, start_time: bStart, end_time: bEnd, is_break: true, label: brk.label })
          currentTime = bEnd
          periodNum++
        }
      }

      // Delete all existing periods and re-insert
      await supabase.from('periods').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      const { data, error } = await supabase.from('periods').insert(rows).select()
      if (error) throw error
      const sorted = (data || []).sort((a, b) => a.period_number - b.period_number)
      setPeriods(sorted)
      showToast(`Bell schedule built — ${sorted.length} periods/breaks set`, 'success')
    } catch (err) {
      showToast('Failed: ' + (err.message || ''), 'error')
    } finally {
      setBuildingBell(false)
    }
  }

  // ── SAVE ALLOCATIONS ──
  const saveAllocations = async () => {
    if (!effectiveStreamId || !selectedYearId) return
    setSavingAlloc(true)
    try {
      const rows = allocations.map(a => ({
        academic_year_id: selectedYearId,
        class_stream_id: effectiveStreamId,
        subject_id: a.subject_id,
        teacher_id: a.teacher_id,
        subject_name: a.subject_name,
        teacher_name: a.teacher_name,
        periods_per_week: Number(a.periods_per_week) || 0,
        is_double: !!a.is_double,
        is_special: !!a.is_special,
      }))
      const { error } = await supabase.from('timetable_allocations').upsert(rows, {
        onConflict: 'academic_year_id,class_stream_id,subject_id'
      })
      if (error) throw error
      showToast('Allocations saved', 'success')
    } catch (err) {
      showToast('Failed: ' + (err.message || ''), 'error')
    } finally {
      setSavingAlloc(false)
    }
  }

  // ── AUTO-GENERATE ──
  const generate = async () => {
    const teachingPeriods = periods.filter(p => !p.is_break)
    const errors = []

    // Build teacher busy map from OTHER streams
    const teacherBusy = {}
    allEntries.filter(e => e.class_stream_id !== effectiveStreamId).forEach(e => {
      if (!e.teacher_id) return
      if (!teacherBusy[e.teacher_id]) teacherBusy[e.teacher_id] = new Set()
      teacherBusy[e.teacher_id].add(`${e.period_id}|${e.day_of_week}`)
    })

    // Get non-special allocations to auto-place
    const tasks = allocations
      .filter(a => !a.is_special && a.periods_per_week > 0)
      .map(a => ({
        ...a,
        remaining: Number(a.periods_per_week),
        // For double: need pairs of consecutive slots on same day
        isDouble: !!a.is_double,
      }))

    const totalRequired = tasks.reduce((s, t) => s + t.remaining, 0)
    const availableSlots = teachingPeriods.length * 5

    if (totalRequired > availableSlots) {
      errors.push(`Total periods required (${totalRequired}) exceeds available slots (${availableSlots}). Reduce periods per subject or add more teaching periods.`)
    }

    // Build ordered slots day by day (for consecutive double period detection)
    const slotsByDay = {}
    for (let d = 1; d <= 5; d++) {
      slotsByDay[d] = teachingPeriods.map(p => ({ period_id: p.id, day_of_week: d, period_number: p.period_number }))
    }

    // Shuffle days order for variety
    const dayOrder = shuffle([1, 2, 3, 4, 5])

    const result = []
    const usedSlots = new Set() // "period_id|day"
    const subjectDayCount = {}  // "subject_id|day" -> count
    const localTeacherBusy = { ...teacherBusy }

    const slotKey = (pid, d) => `${pid}|${d}`
    const isSlotFree = (pid, d) => !usedSlots.has(slotKey(pid, d))
    const isTeacherFree = (tid, pid, d) => !tid || !localTeacherBusy[tid]?.has(slotKey(pid, d))
    const markUsed = (pid, d, tid) => {
      usedSlots.add(slotKey(pid, d))
      if (tid) {
        if (!localTeacherBusy[tid]) localTeacherBusy[tid] = new Set()
        localTeacherBusy[tid].add(slotKey(pid, d))
      }
    }

    // Try to assign each task
    for (const task of tasks) {
      // Shuffle day order for each task for better distribution
      const days = shuffle([1, 2, 3, 4, 5])

      if (task.isDouble) {
        // Place as consecutive pairs
        const pairsNeeded = Math.ceil(task.remaining / 2)
        let placed = 0
        outer: for (let p = 0; p < pairsNeeded && placed < task.remaining; p++) {
          for (const d of days) {
            const daySlots = slotsByDay[d]
            for (let si = 0; si < daySlots.length - 1; si++) {
              const s1 = daySlots[si]
              const s2 = daySlots[si + 1]
              // Check consecutive teaching periods
              if (s1.period_number + 1 !== s2.period_number) continue
              if (!isSlotFree(s1.period_id, d)) continue
              if (!isSlotFree(s2.period_id, d)) continue
              if (!isTeacherFree(task.teacher_id, s1.period_id, d)) continue
              if (!isTeacherFree(task.teacher_id, s2.period_id, d)) continue
              const daySubKey = `${task.subject_id}|${d}`
              if ((subjectDayCount[daySubKey] || 0) >= 2) continue

              result.push({ period_id: s1.period_id, day_of_week: d, subject_id: task.subject_id, teacher_id: task.teacher_id, is_double: true, subjects: { subject_name: task.subject_name }, teachers: { profiles: { full_name: task.teacher_name } } })
              result.push({ period_id: s2.period_id, day_of_week: d, subject_id: task.subject_id, teacher_id: task.teacher_id, is_double: true, subjects: { subject_name: task.subject_name }, teachers: { profiles: { full_name: task.teacher_name } } })
              markUsed(s1.period_id, d, task.teacher_id)
              markUsed(s2.period_id, d, task.teacher_id)
              subjectDayCount[daySubKey] = (subjectDayCount[daySubKey] || 0) + 2
              placed += 2
              break outer
            }
          }
        }
        if (placed < task.remaining) {
          errors.push(`${task.subject_name}: could only place ${placed}/${task.remaining} double periods — not enough consecutive free slots.`)
        }
      } else {
        // Single periods
        let placed = 0
        for (let attempt = 0; attempt < task.remaining; attempt++) {
          let assigned = false
          for (const d of days) {
            const daySlots = shuffle(slotsByDay[d])
            for (const s of daySlots) {
              if (!isSlotFree(s.period_id, d)) continue
              if (!isTeacherFree(task.teacher_id, s.period_id, d)) continue
              const daySubKey = `${task.subject_id}|${d}`
              if ((subjectDayCount[daySubKey] || 0) >= 2) continue

              result.push({ period_id: s.period_id, day_of_week: d, subject_id: task.subject_id, teacher_id: task.teacher_id, is_double: false, subjects: { subject_name: task.subject_name }, teachers: { profiles: { full_name: task.teacher_name } } })
              markUsed(s.period_id, d, task.teacher_id)
              subjectDayCount[daySubKey] = (subjectDayCount[daySubKey] || 0) + 1
              assigned = true
              placed++
              break
            }
            if (assigned) break
          }
          if (!assigned) {
            errors.push(`${task.subject_name}: could only place ${placed}/${task.remaining} periods — not enough free slots or teacher clashes.`)
            break
          }
        }
      }
    }

    // Warn about special subjects
    const specials = allocations.filter(a => a.is_special && a.periods_per_week > 0)
    if (specials.length > 0) {
      errors.push(`Special subjects (${specials.map(s => s.subject_name).join(', ')}) are NOT auto-placed. Use the "Edit Manually" tab to place them.`)
    }

    setGenErrors(errors)
    setGenPreview(result)

    if (errors.length === 0) {
      showToast(`Generated ${result.length} periods — review then click Save`, 'success')
    } else {
      showToast(`Generated with ${errors.length} warning(s) — review below`, 'warning')
    }
  }

  const saveGenerated = async () => {
    if (!genPreview.length) return
    setSavingGen(true)
    try {
      await supabase.from('timetable_entries')
        .delete()
        .eq('class_stream_id', effectiveStreamId)
        .eq('academic_year_id', selectedYearId)

      const rows = genPreview.map(e => ({
        academic_year_id: selectedYearId,
        class_stream_id: effectiveStreamId,
        period_id: e.period_id,
        day_of_week: e.day_of_week,
        subject_id: e.subject_id || null,
        teacher_id: e.teacher_id || null,
        is_double: !!e.is_double,
      }))
      const { error } = await supabase.from('timetable_entries').insert(rows)
      if (error) throw error
      await loadData()
      setGenPreview([])
      setGenErrors([])
      setActiveTab('view')
      showToast(`Timetable saved — ${rows.length} periods`, 'success')
    } catch (err) {
      showToast('Failed: ' + (err.message || ''), 'error')
    } finally {
      setSavingGen(false)
    }
  }

  // ── EDIT CELL ──
  const openEditCell = (period, day) => {
    const key = `${period.id}|${day}`
    const existing = entryMap[key]
    setEditingCell({ period_id: period.id, day_of_week: day, label: `${period.label} — ${DAYS[day - 1]}` })
    setCellSubjectId(existing?.subject_id || '')
    setCellTeacherId(existing?.teacher_id || '')
  }

  const saveCell = async () => {
    if (!editingCell) return
    setSavingCell(true)
    try {
      const existing = entryMap[`${editingCell.period_id}|${editingCell.day_of_week}`]
      if (!cellSubjectId) {
        if (existing?.id) {
          const { error } = await supabase.from('timetable_entries').delete().eq('id', existing.id)
          if (error) throw error
        }
      } else {
        const alloc = allocations.find(a => a.subject_id === cellSubjectId)
        const { error } = await supabase.from('timetable_entries').upsert({
          academic_year_id: selectedYearId,
          class_stream_id: effectiveStreamId,
          period_id: editingCell.period_id,
          day_of_week: editingCell.day_of_week,
          subject_id: cellSubjectId || null,
          teacher_id: cellTeacherId || null,
          is_double: false,
        }, { onConflict: 'period_id,day_of_week,academic_year_id,class_stream_id' })
        if (error) throw error
      }
      await loadData()
      setEditingCell(null)
      showToast('Saved', 'success')
    } catch (err) {
      showToast('Failed: ' + (err.message || ''), 'error')
    } finally {
      setSavingCell(false)
    }
  }

  // Entry lookup maps
  const entryMap = {}
  entries.forEach(e => { entryMap[`${e.period_id}|${e.day_of_week}`] = e })
  const previewMap = {}
  genPreview.forEach(e => { previewMap[`${e.period_id}|${e.day_of_week}`] = e })

  const isTeacherBusyElsewhere = (teacherId, periodId, dayOfWeek) => {
    if (!teacherId) return false
    return allEntries.some(e =>
      e.teacher_id === teacherId &&
      e.period_id === periodId &&
      e.day_of_week === dayOfWeek &&
      e.class_stream_id !== effectiveStreamId
    )
  }

  // ── GRID ──
  const renderGrid = (map, editable = false) => (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse min-w-[600px]">
        <thead>
          <tr>
            <th className="border border-gray-200 bg-gray-50 px-3 py-2.5 text-left text-gray-600 font-semibold min-w-[120px]">Period</th>
            {DAYS.map((d, i) => (
              <th key={d} className="border border-gray-200 bg-gray-50 px-2 py-2.5 text-center text-gray-700 font-semibold min-w-[110px]">
                <span className="hidden md:inline">{d}</span>
                <span className="md:hidden">{DAY_SHORT[i]}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {periods.map(period => (
            <tr key={period.id}>
              <td className={`border border-gray-200 px-3 py-2 align-middle ${period.is_break ? 'bg-amber-50/60' : 'bg-white'}`}>
                <div className="font-semibold text-gray-700 leading-tight">
                  {period.is_break ? '☕ ' : ''}{period.label}
                </div>
                <div className="text-gray-400 text-xs">{fmt(period.start_time)} – {fmt(period.end_time)}</div>
              </td>
              {period.is_break ? (
                <td colSpan={5} className="border border-gray-200 bg-amber-50/40 text-center text-amber-700 italic text-xs py-2">
                  {period.label} · {fmt(period.start_time)} – {fmt(period.end_time)}
                </td>
              ) : (
                [1, 2, 3, 4, 5].map(day => {
                  const key = `${period.id}|${day}`
                  const entry = map[key]
                  const clash = entry?.teacher_id && isTeacherBusyElsewhere(entry.teacher_id, period.id, day)
                  const color = entry?.subject_id ? (subjectColorMap[entry.subject_id] || COLORS[0]) : ''
                  return (
                    <td
                      key={day}
                      onClick={editable ? () => openEditCell(period, day) : undefined}
                      className={`border border-gray-200 px-1.5 py-1.5 align-top ${editable ? 'cursor-pointer hover:bg-blue-50/30' : 'bg-white'}`}
                    >
                      {entry ? (
                        <div className={`rounded-lg px-2 py-1.5 border text-center ${color} ${clash ? 'ring-2 ring-red-400' : ''} ${entry.is_double ? 'border-l-4' : ''}`}>
                          <div className="font-semibold text-xs leading-tight">
                            {entry.subjects?.subject_name || '—'}
                          </div>
                          {entry.is_double && <div className="text-xs opacity-60">(double)</div>}
                          <div className="text-xs opacity-70 mt-0.5 leading-tight truncate max-w-[90px]">
                            {entry.teachers?.profiles?.full_name || ''}
                          </div>
                          {clash && <div className="text-red-600 text-xs font-bold">⚠ Clash</div>}
                        </div>
                      ) : (
                        editable
                          ? <div className="h-12 flex items-center justify-center text-gray-300 text-xl">+</div>
                          : <div className="h-12" />
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

  const currentStream = classStreams.find(cs => cs.id === effectiveStreamId)
  const currentClass = classes.find(c => c.id === selectedClassId)
  const currentYear = academicYears.find(y => y.id === selectedYearId)
  const classLabel = `${currentClass?.class_name || ''}${currentStream ? ` — ${currentStream.streams?.stream_name}` : ''}`

  const teachingPeriodCount = periods.filter(p => !p.is_break).length

  const tabs = [
    { key: 'view', label: '📅 View' },
    { key: 'allocations', label: '📋 Allocations' },
    { key: 'generate', label: '✨ Generate' },
    { key: 'edit', label: '✏️ Edit Manually' },
    { key: 'bell', label: '⚙️ Bell Schedule' },
  ]

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Timetable</h1>
        <p className="text-gray-500 mt-1">Configure allocations, auto-generate schedules, and manage the bell schedule</p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 bg-gray-100 p-1 rounded-xl mb-5">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => { setActiveTab(t.key); setEditingCell(null) }}
            className={`px-4 py-1.5 text-sm font-medium rounded-lg transition whitespace-nowrap ${activeTab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >{t.label}</button>
        ))}
      </div>

      {/* Class / Year Selector (all tabs except bell) */}
      {activeTab !== 'bell' && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Academic Year</label>
              <select value={selectedYearId} onChange={e => setSelectedYearId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500">
                {academicYears.map(y => <option key={y.id} value={y.id}>{y.year_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Class</label>
              <select value={selectedClassId} onChange={e => setSelectedClassId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500">
                {classes.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
              </select>
            </div>
            {streamsForClass.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Stream</label>
                <select value={selectedStreamId} onChange={e => setSelectedStreamId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500">
                  {streamsForClass.map(cs => <option key={cs.id} value={cs.id}>{cs.classes?.class_name} {cs.streams?.stream_name}</option>)}
                </select>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ────────── VIEW TAB ────────── */}
      {activeTab === 'view' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-800">{classLabel} — Timetable</h2>
              <p className="text-xs text-gray-400 mt-0.5">{currentYear?.year_name} · {entries.filter(e => !e.is_double).length + entries.filter(e => e.is_double).length} periods assigned</p>
            </div>
            <button onClick={() => window.print()} className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5">Print</button>
          </div>
          {loadingEntries
            ? <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-gray-200 border-t-maroon-600 rounded-full animate-spin" /></div>
            : entries.length === 0
              ? <div className="py-16 text-center text-sm text-gray-400">No timetable yet. Go to <strong>Allocations</strong> tab to set periods per subject, then <strong>Generate</strong> to create the schedule.</div>
              : renderGrid(entryMap, false)
          }
          {entries.length > 0 && (
            <div className="px-5 py-3 border-t border-gray-100 flex flex-wrap gap-2">
              {uniqueSubjectIds.map((sid, i) => {
                const e = entries.find(x => x.subject_id === sid)
                return e ? (
                  <span key={sid} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${COLORS[i % COLORS.length]}`}>
                    {e.subjects?.subject_name}
                  </span>
                ) : null
              })}
            </div>
          )}
        </div>
      )}

      {/* ────────── ALLOCATIONS TAB ────────── */}
      {activeTab === 'allocations' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-800">Subject Allocations — {classLabel}</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Set periods per week for each subject. Single = {singleMin} min, Double = {singleMin * 2} min.
              Mark <strong>Special</strong> for subjects like Religion or Debate that you will place manually.
            </p>
          </div>

          {loadingEntries ? (
            <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-gray-200 border-t-maroon-600 rounded-full animate-spin" /></div>
          ) : allocations.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">No subjects assigned to this class/stream yet. Assign teacher subjects first in the Class Subjects page.</div>
          ) : (
            <>
              {/* Summary bar */}
              <div className="px-5 py-3 bg-blue-50 border-b border-blue-100 flex flex-wrap gap-4 text-xs text-blue-700">
                <span>Available slots: <strong>{teachingPeriodCount * 5}</strong>/week ({teachingPeriodCount} periods/day × 5 days)</span>
                <span>Total allocated: <strong>{allocations.filter(a => !a.is_special).reduce((s, a) => s + Number(a.periods_per_week || 0), 0)}</strong> periods/week</span>
                <span className="text-amber-700">Special (manual): <strong>{allocations.filter(a => a.is_special).reduce((s, a) => s + Number(a.periods_per_week || 0), 0)}</strong></span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Subject</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Teacher</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Periods/Week</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Type</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Special?</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {allocations.map((a, i) => (
                      <tr key={a.subject_id} className={a.is_special ? 'bg-amber-50/40' : 'hover:bg-gray-50'}>
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {a.subject_name || a.subject_id}
                          {a.is_double && <span className="ml-2 text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">double</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-sm">{a.teacher_name || '—'}</td>
                        <td className="px-4 py-3 text-center">
                          <input
                            type="number" min="0" max="30"
                            value={a.periods_per_week}
                            onChange={e => setAllocations(prev => prev.map((x, j) => j === i ? { ...x, periods_per_week: Number(e.target.value) } : x))}
                            className="w-16 px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-maroon-500"
                          />
                          <span className="ml-1 text-xs text-gray-400">× {a.is_double ? singleMin * 2 : singleMin}min</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <select
                            value={a.is_double ? 'double' : 'single'}
                            onChange={e => setAllocations(prev => prev.map((x, j) => j === i ? { ...x, is_double: e.target.value === 'double' } : x))}
                            className="px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-maroon-500"
                          >
                            <option value="single">Single ({singleMin}min)</option>
                            <option value="double">Double ({singleMin * 2}min)</option>
                          </select>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <label className="inline-flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!!a.is_special}
                              onChange={e => setAllocations(prev => prev.map((x, j) => j === i ? { ...x, is_special: e.target.checked } : x))}
                              className="w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                            />
                            <span className={`text-xs ${a.is_special ? 'text-amber-700 font-medium' : 'text-gray-400'}`}>
                              {a.is_special ? 'Special' : 'Auto'}
                            </span>
                          </label>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
                <p className="text-xs text-gray-500">Special subjects (Religion, Debate, etc.) are skipped by auto-generate — place them manually using the Edit tab.</p>
                <button onClick={saveAllocations} disabled={savingAlloc}
                  className="px-5 py-2 bg-maroon-600 hover:bg-maroon-700 text-white text-sm font-semibold rounded-xl disabled:opacity-60 transition">
                  {savingAlloc ? 'Saving…' : 'Save Allocations'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ────────── GENERATE TAB ────────── */}
      {activeTab === 'generate' && (
        <div className="space-y-5">
          {/* Big Generate Card */}
          <div className="bg-gradient-to-br from-maroon-600 to-maroon-800 rounded-2xl p-6 text-white">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex-1">
                <h2 className="text-lg font-bold">Auto-Generate Timetable</h2>
                <p className="text-maroon-200 text-sm mt-1">
                  Generates a clash-free schedule for <strong>{classLabel}</strong> using the allocations you set.
                  Double periods are placed as consecutive slots. Special subjects are skipped.
                </p>
                <div className="mt-3 flex flex-wrap gap-3 text-xs text-maroon-200">
                  <span>📅 {teachingPeriodCount} teaching periods/day · 5 days = {teachingPeriodCount * 5} slots/week</span>
                  <span>📋 {allocations.filter(a => !a.is_special).reduce((s, a) => s + Number(a.periods_per_week || 0), 0)} periods allocated</span>
                  {allocations.filter(a => a.is_special).length > 0 && (
                    <span>⭐ {allocations.filter(a => a.is_special).length} special subjects (manual)</span>
                  )}
                </div>
              </div>
              <button
                onClick={generate}
                className="shrink-0 px-8 py-3.5 bg-white text-maroon-700 font-bold text-base rounded-xl hover:bg-maroon-50 transition shadow-lg active:scale-95"
              >
                ✨ Generate Timetable
              </button>
            </div>
          </div>

          {/* Warnings / Errors */}
          {genErrors.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-1">
              <p className="text-xs font-semibold text-amber-800 mb-1">Warnings:</p>
              {genErrors.map((e, i) => <p key={i} className="text-xs text-amber-700">⚠ {e}</p>)}
            </div>
          )}

          {/* Preview */}
          {genPreview.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-800">Preview — {genPreview.length} periods generated</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Review below. If satisfied, click Save. To try a different arrangement click Generate again.</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={generate}
                    className="px-4 py-2 text-sm border border-gray-300 text-gray-600 rounded-xl hover:bg-gray-50 transition">
                    Regenerate
                  </button>
                  <button onClick={saveGenerated} disabled={savingGen}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl disabled:opacity-60 transition">
                    {savingGen ? 'Saving…' : '✓ Save Timetable'}
                  </button>
                </div>
              </div>
              {renderGrid(previewMap, false)}
            </div>
          )}

          {genPreview.length === 0 && genErrors.length === 0 && (
            <div className="bg-white rounded-xl border border-dashed border-gray-300 py-14 text-center">
              <p className="text-sm text-gray-400">Click <strong>✨ Generate Timetable</strong> above to create the schedule.</p>
              <p className="text-xs text-gray-400 mt-1">Make sure you have set allocations first (see Allocations tab).</p>
            </div>
          )}
        </div>
      )}

      {/* ────────── EDIT MANUALLY TAB ────────── */}
      {activeTab === 'edit' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-700">
            Click any cell to assign a subject and teacher. Use this for special subjects (Religion, Debate, etc.) or manual corrections.
          </div>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-800">{classLabel} — Manual Edit</h2>
            </div>
            {loadingEntries
              ? <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-gray-200 border-t-maroon-600 rounded-full animate-spin" /></div>
              : renderGrid(entryMap, true)
            }
          </div>

          {/* Edit cell popup */}
          {editingCell && (
            <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setEditingCell(null)}>
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
                <h3 className="text-base font-semibold text-gray-900 mb-4">{editingCell.label}</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Subject</label>
                    <select value={cellSubjectId} onChange={e => {
                      setCellSubjectId(e.target.value)
                      const a = allocations.find(x => x.subject_id === e.target.value)
                      if (a) setCellTeacherId(a.teacher_id || '')
                    }}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500">
                      <option value="">— Clear cell —</option>
                      {allocations.map(a => <option key={a.subject_id} value={a.subject_id}>{a.subject_name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Teacher</label>
                    <select value={cellTeacherId} onChange={e => setCellTeacherId(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500">
                      <option value="">— None —</option>
                      {teachers.map(t => {
                        const busy = isTeacherBusyElsewhere(t.id, editingCell.period_id, editingCell.day_of_week)
                        return <option key={t.id} value={t.id}>{t.profiles?.full_name}{busy ? ' ⚠ Busy' : ''}</option>
                      })}
                    </select>
                    {cellTeacherId && isTeacherBusyElsewhere(cellTeacherId, editingCell.period_id, editingCell.day_of_week) && (
                      <p className="text-xs text-red-500 mt-1">⚠ This teacher is teaching another class at this time.</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button onClick={() => setEditingCell(null)} className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-xl text-gray-600 hover:bg-gray-50">Cancel</button>
                  <button onClick={saveCell} disabled={savingCell} className="flex-1 px-4 py-2 text-sm bg-maroon-600 hover:bg-maroon-700 text-white rounded-xl font-medium disabled:opacity-60">
                    {savingCell ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ────────── BELL SCHEDULE TAB ────────── */}
      {activeTab === 'bell' && (
        <div className="space-y-5">
          {/* Builder */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-800 mb-1">Bell Schedule Builder</h2>
            <p className="text-xs text-gray-500 mb-5">Set the school day structure and auto-calculate all period times.</p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">School Start Time</label>
                <input type="time" value={bellStart} onChange={e => setBellStart(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Single Period Duration (min)</label>
                <input type="number" min="20" max="120" value={singleMin} onChange={e => setSingleMin(Number(e.target.value))}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500" />
                <p className="text-xs text-gray-400 mt-1">Double = {singleMin * 2} min</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Teaching Periods Per Day</label>
                <input type="number" min="1" max="12" value={numPeriods} onChange={e => setNumPeriods(Number(e.target.value))}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500" />
              </div>
            </div>

            {/* Break configuration */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs font-medium text-gray-600">Breaks</label>
                <button
                  onClick={() => setBreaks(prev => [...prev, { after_period: numPeriods, duration: 20, label: 'Break' }])}
                  className="text-xs text-maroon-600 hover:text-maroon-700"
                >+ Add Break</button>
              </div>
              <div className="space-y-2">
                {breaks.map((b, i) => (
                  <div key={i} className="flex items-center gap-2 flex-wrap bg-amber-50 rounded-xl px-4 py-3">
                    <span className="text-xs text-gray-500">After period</span>
                    <input type="number" min="1" max={numPeriods - 1} value={b.after_period}
                      onChange={e => setBreaks(prev => prev.map((x, j) => j === i ? { ...x, after_period: Number(e.target.value) } : x))}
                      className="w-14 px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-amber-400" />
                    <input type="text" value={b.label} placeholder="Break name"
                      onChange={e => setBreaks(prev => prev.map((x, j) => j === i ? { ...x, label: e.target.value } : x))}
                      className="flex-1 min-w-[120px] px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                    <input type="number" min="5" max="120" value={b.duration}
                      onChange={e => setBreaks(prev => prev.map((x, j) => j === i ? { ...x, duration: Number(e.target.value) } : x))}
                      className="w-16 px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-amber-400" />
                    <span className="text-xs text-gray-500">min</span>
                    <button onClick={() => setBreaks(prev => prev.filter((_, j) => j !== i))}
                      className="text-red-400 hover:text-red-600 text-xs ml-auto">✕</button>
                  </div>
                ))}
              </div>
            </div>

            {/* Preview calculation */}
            <div className="bg-gray-50 rounded-xl p-4 mb-5">
              <p className="text-xs font-semibold text-gray-600 mb-2">Preview (calculated):</p>
              <div className="space-y-1">
                {(() => {
                  const rows = []
                  let cur = bellStart
                  const bMap = {}
                  breaks.forEach(b => { bMap[b.after_period] = b })
                  for (let i = 1; i <= numPeriods; i++) {
                    const end = addMinutes(cur, singleMin)
                    rows.push(<div key={`p${i}`} className="text-xs text-gray-600">Period {i}: {cur} – {end} ({singleMin}min)</div>)
                    cur = end
                    if (bMap[i]) {
                      const bEnd = addMinutes(cur, bMap[i].duration)
                      rows.push(<div key={`b${i}`} className="text-xs text-amber-600">☕ {bMap[i].label}: {cur} – {bEnd} ({bMap[i].duration}min)</div>)
                      cur = bEnd
                    }
                  }
                  return rows
                })()}
              </div>
            </div>

            <button onClick={buildBellSchedule} disabled={buildingBell}
              className="w-full py-3 bg-maroon-600 hover:bg-maroon-700 text-white font-bold rounded-xl text-sm disabled:opacity-60 transition">
              {buildingBell ? 'Building…' : '⚙️ Build Bell Schedule'}
            </button>
            <p className="text-xs text-gray-400 text-center mt-2">This overwrites the current bell schedule and affects all timetables.</p>
          </div>

          {/* Current schedule table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800">Current Bell Schedule</h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">#</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Label</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Start</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">End</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">Duration</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {periods.length === 0
                  ? <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">No bell schedule yet. Use the builder above.</td></tr>
                  : periods.map(p => {
                    const start = p.start_time?.slice(0, 5) || ''
                    const end = p.end_time?.slice(0, 5) || ''
                    const [sh, sm] = start.split(':').map(Number)
                    const [eh, em] = end.split(':').map(Number)
                    const dur = (eh * 60 + em) - (sh * 60 + sm)
                    return (
                      <tr key={p.id} className={p.is_break ? 'bg-amber-50/40' : 'hover:bg-gray-50'}>
                        <td className="px-4 py-3 text-gray-400 text-xs">{p.period_number}</td>
                        <td className="px-4 py-3 font-medium text-gray-800">{p.is_break ? '☕ ' : ''}{p.label}</td>
                        <td className="px-4 py-3 text-gray-600 font-mono">{start}</td>
                        <td className="px-4 py-3 text-gray-600 font-mono">{end}</td>
                        <td className="px-4 py-3 text-center text-gray-500">{dur}min</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${p.is_break ? 'bg-amber-100 text-amber-700' : 'bg-blue-50 text-blue-700'}`}>
                            {p.is_break ? 'Break' : 'Teaching'}
                          </span>
                        </td>
                      </tr>
                    )
                  })
                }
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
