import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useNotification } from '../context/NotificationContext'
import Modal from '../components/Modal'

function ClassSubjects() {
  const { showToast } = useNotification()
  const [searchParams] = useSearchParams()

  const [classes, setClasses] = useState([])
  const [classStreams, setClassStreams] = useState([])
  const [subjects, setSubjects] = useState([])
  const [combinations, setCombinations] = useState([])
  const [combinationSubjects, setCombinationSubjects] = useState([])
  const [classCombinations, setClassCombinations] = useState([])
  const [streamCombinations, setStreamCombinations] = useState([])

  const [selectedClassId, setSelectedClassId] = useState(searchParams.get('classId') || '')
  const [students, setStudents] = useState([])
  const [studentSubjects, setStudentSubjects] = useState({})
  const [studentCombinations, setStudentCombinations] = useState({}) // studentId -> combinationId
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savingStudentId, setSavingStudentId] = useState(null) // track which student is being saved
  const [excludedSubjects, setExcludedSubjects] = useState(new Set())
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false)
  const [bulkAssignSubectIds, setBulkAssignSubectIds] = useState(new Set())
  const [bulkAssignStudentIds, setBulkAssignStudentIds] = useState(new Set())
  const [bulkAssignMode, setBulkAssignMode] = useState('add') // 'add' or 'remove'
  const [bulkAssigning, setBulkAssigning] = useState(false)
  const loadIdRef = useRef(0)

  const fetchLookups = useCallback(async () => {
    const [cRes, csRes, subRes, combRes, csSubRes, ccombRes, scRes] = await Promise.all([
      supabase.from('classes').select('*').order('sort_order'),
      supabase.from('class_streams').select('id, class_id, stream_id, streams(stream_name)'),
      supabase.from('subjects').select('*').order('subject_name'),
      supabase.from('combinations').select('*').order('name'),
      supabase.from('combination_subjects').select('*'),
      supabase.from('class_combinations').select('*'),
      supabase.from('stream_combinations').select('*'),
    ])
    if (cRes.data) setClasses(cRes.data)
    if (csRes.data) setClassStreams(csRes.data)
    if (subRes.data) setSubjects(subRes.data)
    if (combRes.error) console.error('combinations fetch error:', combRes.error)
    if (combRes.data) setCombinations(combRes.data)
    if (csSubRes.error) console.error('combination_subjects fetch error:', csSubRes.error)
    if (csSubRes.data) setCombinationSubjects(csSubRes.data)
    if (ccombRes.error) console.error('class_combinations fetch error:', ccombRes.error)
    if (ccombRes.data) setClassCombinations(ccombRes.data)
    if (scRes.data) setStreamCombinations(scRes.data)
  }, [])

  useEffect(() => {
    fetchLookups()
  }, [fetchLookups])

  const selectedClass = classes.find((c) => c.id === selectedClassId)
  const classLevel = selectedClass?.level || ''

  const streamIdsForClass = classStreams
    .filter((cs) => cs.class_id === selectedClassId)
    .map((cs) => cs.id)

  const loadClassData = useCallback(async (classId) => {
    if (!classId) return
    const loadId = ++loadIdRef.current
    setLoading(true)

    const streamIds = classStreams
      .filter((cs) => cs.class_id === classId)
      .map((cs) => cs.id)

    // Fetch students by class_stream_id OR direct class_id
    let studData
    let studErr
    if (streamIds.length > 0) {
      const res = await supabase
        .from('students')
        .select('*')
        .or(`class_stream_id.in.(${streamIds.map(id => `"${id}"`).join(',')}),class_id.eq."${classId}"`)
        .order('surname')
        .limit(1000000)
      studData = res.data
      studErr = res.error
    } else {
      const res = await supabase
        .from('students')
        .select('*')
        .eq('class_id', classId)
        .order('surname')
        .limit(1000000)
      studData = res.data
      studErr = res.error
    }
    if (studErr) console.error('fetchStudents error:', studErr)

    if (studData) setStudents(studData.slice().sort((a, b) => {
      const gA = a.gender === 'Female' ? 0 : 1
      const gB = b.gender === 'Female' ? 0 : 1
      if (gA !== gB) return gA - gB
      const s = (a.first_name || '').localeCompare(b.first_name || '')
      return s !== 0 ? s : (a.surname || '').localeCompare(b.surname || '')
    }))

    // Auto-heal only COMPULSORY subjects — optional subjects removed by academic must stay removed
    const cls = classes.find((c) => c.id === classId)
    const oLevelCompulsoryIds = cls?.level === 'O_LEVEL'
      ? (await supabase.from('subjects').select('id').eq('level', 'O_LEVEL').eq('subject_type', 'COMPULSORY')).data?.map((s) => s.id) || []
      : []

    const ssMap = {}
    if (studData && studData.length > 0) {
      const ids = studData.map((s) => s.id)

      if (oLevelCompulsoryIds.length > 0) {
        const { data: existingSubs } = await supabase
          .from('student_subjects')
          .select('student_id, subject_id')
          .in('student_id', ids)
          .in('subject_id', oLevelCompulsoryIds)

        const existingKeys = new Set((existingSubs || []).map((row) => `${row.student_id}:${row.subject_id}`))
        const missingSubs = []
        for (const student of studData) {
          for (const subjectId of oLevelCompulsoryIds) {
            if (!existingKeys.has(`${student.id}:${subjectId}`)) {
              missingSubs.push({ student_id: student.id, subject_id: subjectId })
            }
          }
        }

        if (missingSubs.length > 0) {
          const { error: insertErr } = await supabase
            .from('student_subjects')
            .upsert(missingSubs, { onConflict: 'student_id,subject_id' })
          if (insertErr) console.error('autoAssignCompulsorySubjects error:', insertErr)
        }
      }

      // Fetch student subjects — paginate in 1000-row pages (server-side db-max-rows cap)
      let ssPage = 0
      while (true) {
        const { data: ssChunk } = await supabase
          .from('student_subjects')
          .select('student_id, subject_id')
          .in('student_id', ids)
          .range(ssPage * 1000, ssPage * 1000 + 999)
        if (!ssChunk || ssChunk.length === 0) break
        ssChunk.forEach((row) => {
          if (!ssMap[row.student_id]) ssMap[row.student_id] = []
          ssMap[row.student_id].push(row.subject_id)
        })
        if (ssChunk.length < 1000) break
        ssPage++
      }

      // Fetch student combinations (A-Level)
      const scMap = {}
      const { data: scData } = await supabase
        .from('student_combinations')
        .select('student_id, combination_id')
        .in('student_id', ids)
      if (scData) scData.forEach((row) => { scMap[row.student_id] = row.combination_id })
      setStudentCombinations(scMap)

    }
    if (loadId !== loadIdRef.current) return // stale call — skip

    setStudentSubjects(ssMap)

    // Load excluded subjects for this class
    const { data: exclData } = await supabase
      .from('class_excluded_subjects')
      .select('subject_id')
      .eq('class_id', classId)
    if (loadId !== loadIdRef.current) return
    setExcludedSubjects(new Set((exclData || []).map(r => r.subject_id)))

    setLoading(false)
  }, [classStreams, classes, subjects])

  useEffect(() => {
    if (selectedClassId) loadClassData(selectedClassId)
    else {
      setStudents([])
      setStudentSubjects({})
    }
  }, [selectedClassId, loadClassData])

  // O-Level: all O-Level subjects are available to every O-Level class.
  const getClassSubjects = () => {
    if (classLevel !== 'O_LEVEL') return []
    return subjects.filter((s) => s.level === 'O_LEVEL')
  }

  // All O-Level subjects (for optional per-student assignment UI)
  const getAvailableSubjects = () => {
    if (classLevel !== 'O_LEVEL') return []
    return subjects.filter((s) => s.level === 'O_LEVEL')
  }

  // A-Level: combinations assigned to class via class_combinations
  const getClassComboIds = () => {
    if (classLevel !== 'A_LEVEL') return []
    return classCombinations
      .filter((cc) => cc.class_id === selectedClassId)
      .map((cc) => cc.combination_id)
  }

  // A-Level: all subject IDs from all assigned combinations
  const getClassComboSubjectIds = () => {
    const comboIds = getClassComboIds()
    return combinationSubjects
      .filter((cs) => comboIds.includes(cs.combination_id))
      .map((cs) => cs.subject_id)
  }

  // The actual subjects to display in the O-Level grid (excluded subjects hidden)
  const displaySubjects = classLevel === 'O_LEVEL'
    ? getClassSubjects().filter(s => !excludedSubjects.has(s.id))
    : []

  const handleToggleExcludeSubject = async (subjectId) => {
    const isExcluded = excludedSubjects.has(subjectId)
    try {
      if (isExcluded) {
        await supabase
          .from('class_excluded_subjects')
          .delete()
          .eq('class_id', selectedClassId)
          .eq('subject_id', subjectId)
        setExcludedSubjects(prev => { const n = new Set(prev); n.delete(subjectId); return n })
        showToast('Subject enabled for this class', 'success')
      } else {
        await supabase
          .from('class_excluded_subjects')
          .insert({ class_id: selectedClassId, subject_id: subjectId })
        setExcludedSubjects(prev => { const n = new Set(prev); n.add(subjectId); return n })
        showToast('Subject locked for this class', 'success')
      }
    } catch (err) {
      showToast('Failed to update: ' + (err.message || ''), 'error')
    }
  }

  const handleToggleCombination = async (combinationId) => {
    setSaving(true)
    try {
      const exists = classCombinations.find((cc) => cc.class_id === selectedClassId && cc.combination_id === combinationId)
      if (exists) {
        await supabase.from('class_combinations').delete().eq('id', exists.id)
      } else {
        await supabase.from('class_combinations').insert({ class_id: selectedClassId, combination_id: combinationId })
      }
      const { data } = await supabase.from('class_combinations').select('*')
      if (data) setClassCombinations(data)
      showToast(exists ? 'Combination removed' : 'Combination added', 'success')
    } catch (err) {
      showToast('Failed to update combination. ' + (err.message || ''), 'error')
    } finally {
      setSaving(false)
    }
  }

  // A-Level: assign a combination to a stream and auto-update all students in it
  const handleSetStreamCombination = async (classStreamId, combinationId) => {
    if (!combinationId) return
    setSaving(true)
    try {
      const { error: scErr } = await supabase
        .from('stream_combinations')
        .upsert({ class_stream_id: classStreamId, combination_id: combinationId }, { onConflict: 'class_stream_id' })
      if (scErr) throw scErr

      const streamStudents = students.filter((s) => s.class_stream_id === classStreamId)
      if (streamStudents.length > 0) {
        const aLevelSubjectIds = subjects.filter((s) => s.level === 'A_LEVEL').map((s) => s.id)
        const newSubjectIds = combinationSubjects
          .filter((cs) => cs.combination_id === combinationId)
          .map((cs) => cs.subject_id)

        await supabase.from('student_combinations').upsert(
          streamStudents.map((s) => ({ student_id: s.id, combination_id: combinationId })),
          { onConflict: 'student_id' }
        )

        for (const student of streamStudents) {
          if (aLevelSubjectIds.length > 0) {
            await supabase.from('student_subjects').delete()
              .eq('student_id', student.id)
              .in('subject_id', aLevelSubjectIds)
          }
          if (newSubjectIds.length > 0) {
            await supabase.from('student_subjects').upsert(
              newSubjectIds.map((subject_id) => ({ student_id: student.id, subject_id })),
              { onConflict: 'student_id,subject_id' }
            )
          }
        }
      }

      setStreamCombinations((prev) => {
        const exists = prev.find((sc) => sc.class_stream_id === classStreamId)
        if (exists) return prev.map((sc) => sc.class_stream_id === classStreamId ? { ...sc, combination_id: combinationId } : sc)
        return [...prev, { class_stream_id: classStreamId, combination_id: combinationId }]
      })

      await loadClassData(selectedClassId)
      const combo = combinations.find((c) => c.id === combinationId)
      const suffix = streamStudents.length > 0 ? ` — ${streamStudents.length} student(s) updated` : ''
      showToast(`${combo?.code || 'Combination'} assigned to stream${suffix}`, 'success')
    } catch (err) {
      showToast('Failed: ' + (err.message || ''), 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleSubject = async (studentId, subjectId, subjectType, currentlyAssigned) => {
    if (subjectType === 'COMPULSORY') return

    setSavingStudentId(studentId)
    try {
      if (currentlyAssigned) {
        const { error } = await supabase
          .from('student_subjects')
          .delete()
          .eq('student_id', studentId)
          .eq('subject_id', subjectId)
        if (error) throw error

        setStudentSubjects((prev) => ({
          ...prev,
          [studentId]: (prev[studentId] || []).filter((id) => id !== subjectId),
        }))
        showToast('Optional subject removed', 'success')
      } else {
        const { error } = await supabase
          .from('student_subjects')
          .upsert({ student_id: studentId, subject_id: subjectId }, { onConflict: 'student_id,subject_id' })
        if (error) throw error

        setStudentSubjects((prev) => ({
          ...prev,
          [studentId]: [...(prev[studentId] || []), subjectId],
        }))
        showToast('Optional subject added', 'success')
      }
    } catch (err) {
      showToast('Failed to update: ' + (err.message || ''), 'error')
    } finally {
      setSavingStudentId(null)
    }
  }

  const handleBulkAssign = async () => {
    const subjectIds = [...bulkAssignSubectIds]
    const studentIds = [...bulkAssignStudentIds]
    if (subjectIds.length === 0 || studentIds.length === 0) {
      showToast('Select at least one subject and one student', 'error')
      return
    }
    setBulkAssigning(true)
    try {
      if (bulkAssignMode === 'add') {
        const rows = []
        for (const sid of studentIds) {
          for (const subId of subjectIds) {
            rows.push({ student_id: sid, subject_id: subId })
          }
        }
        const { error } = await supabase
          .from('student_subjects')
          .upsert(rows, { onConflict: 'student_id,subject_id', ignoreDuplicates: true })
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('student_subjects')
          .delete()
          .in('student_id', studentIds)
          .in('subject_id', subjectIds)
        if (error) throw error
      }
      setBulkAssignOpen(false)
      showToast(bulkAssignMode === 'add' ? 'Subjects added' : 'Subjects removed', 'success')
      // Reload all data from DB to ensure UI is in sync
      await loadClassData(selectedClassId)
    } catch (err) {
      showToast('Failed: ' + (err.message || ''), 'error')
    } finally {
      setBulkAssigning(false)
    }
  }

  const allClassSubjects = classLevel === 'O_LEVEL' ? getClassSubjects() : []
  const compulsorySubjects = displaySubjects.filter((s) => s?.subject_type === 'COMPULSORY')
  const optionalSubjects = displaySubjects.filter((s) => s?.subject_type !== 'COMPULSORY')
  const excludedCount = allClassSubjects.length - displaySubjects.length

  const classComboIds = getClassComboIds()

  // Available combos for this class
  const availableCombos = classLevel === 'A_LEVEL'
    ? combinations
    : []

  return (
    <>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Class Subject Assignments</h1>
          <p className="text-gray-500 mt-1">
            {classLevel === 'A_LEVEL'
              ? 'Assign a combination to each A-Level stream. Students enrolled in that stream automatically receive the combination subjects.'
              : 'Assign subjects to O-Level classes. All streams share the same subjects.'}
          </p>
        </div>
      </div>

      {/* Class selector */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
        <div className="p-4 sm:flex sm:items-start sm:gap-4">
          <div className="sm:w-64">
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Select Class</label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-maroon-400 focus:ring-4 focus:ring-maroon-500/10 transition"
            >
              <option value="">-- Select class --</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.class_name} ({c.level === 'O_LEVEL' ? 'O-Level' : 'A-Level'})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* A-Level: Combination selector */}
      {selectedClassId && classLevel === 'A_LEVEL' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <h2 className="text-sm font-semibold text-gray-800">Combinations for this Class</h2>
            <p className="text-xs text-gray-500 mt-0.5">Select which combinations this class offers. Students will be assigned all subjects from selected combinations.</p>
          </div>
          <div className="p-4">
            {availableCombos.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">
                No combinations found. Add combinations in Subject Management first.
              </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {availableCombos.map((combo) => {
                const isAssigned = classComboIds.includes(combo.id)
                const comboSubs = combinationSubjects
                  .filter((cs) => cs.combination_id === combo.id)
                  .map((cs) => subjects.find((s) => s.id === cs.subject_id))
                  .filter(Boolean)
                return (
                  <button
                    key={combo.id}
                    onClick={() => handleToggleCombination(combo.id)}
                    disabled={saving}
                    className={`text-left p-4 rounded-xl border-2 transition ${
                      isAssigned
                        ? 'border-maroon-500 bg-maroon-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-gray-900">{combo.code}</span>
                      <span className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                        isAssigned ? 'bg-maroon-600 border-maroon-600' : 'border-gray-300'
                      }`}>
                        {isAssigned && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        )}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mb-1.5">{combo.name}</p>
                    <div className="flex flex-wrap gap-1">
                      {comboSubs.map((sub) => (
                        <span key={sub.id} className="px-1.5 py-0.5 bg-white rounded text-[10px] font-medium text-gray-600 border border-gray-200">
                          {sub.subject_code}
                        </span>
                      ))}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* A-Level: Stream Combination Assignments */}
      {selectedClassId && classLevel === 'A_LEVEL' && streamIdsForClass.length > 0 && (
        <div className="space-y-4 mb-6">
          {streamIdsForClass.map((streamId) => {
            const sc = streamCombinations.find((s) => s.class_stream_id === streamId)
            const assignedCombId = sc?.combination_id || ''
            const streamInfo = classStreams.find((cs) => cs.id === streamId)
            const streamName = streamInfo?.streams?.stream_name || '—'
            const streamStudents = students.filter((s) => s.class_stream_id === streamId)
            const assignedCombo = combinations.find((c) => c.id === assignedCombId)
            const syncedCount = assignedCombId
              ? streamStudents.filter((s) => studentCombinations[s.id] === assignedCombId).length
              : 0
            const unsyncedCount = streamStudents.length - syncedCount

            return (
              <div key={streamId} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* Stream header + combo picker */}
                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-[140px]">
                    <p className="text-sm font-bold text-gray-900">Stream {streamName}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {streamStudents.length} student(s)
                      {assignedCombId && (
                        <>
                          {' · '}
                          <span className="text-emerald-600">{syncedCount} synced</span>
                          {unsyncedCount > 0 && (
                            <span className="text-amber-500 ml-1">{unsyncedCount} not assigned</span>
                          )}
                        </>
                      )}
                    </p>
                    {assignedCombId && unsyncedCount > 0 && (
                      <button
                        onClick={() => handleSetStreamCombination(streamId, assignedCombId)}
                        disabled={saving}
                        className="mt-1 inline-flex items-center gap-1 px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium rounded-lg transition disabled:opacity-50"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                        </svg>
                        Sync {unsyncedCount} student(s)
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={assignedCombId}
                      onChange={(e) => e.target.value && handleSetStreamCombination(streamId, e.target.value)}
                      disabled={saving}
                      className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-maroon-400 focus:ring-2 focus:ring-maroon-500/10 transition disabled:opacity-50"
                    >
                      <option value="">— Select combination —</option>
                      {combinations.map((c) => (
                        <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                      ))}
                    </select>
                    {assignedCombo && (
                      <span className="text-xs font-semibold text-violet-700 bg-violet-50 border border-violet-200 px-2.5 py-1 rounded-full whitespace-nowrap">
                        {assignedCombo.code}
                      </span>
                    )}
                  </div>
                </div>

                {/* Student list */}
                {streamStudents.length === 0 ? (
                  <p className="px-4 py-4 text-xs text-gray-400 text-center">No students enrolled in this stream.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left px-4 py-2 font-medium text-gray-400 w-8">#</th>
                          <th className="text-left px-4 py-2 font-medium text-gray-500">Student</th>
                          <th className="text-left px-4 py-2 font-medium text-gray-500">Adm. No.</th>
                          <th className="text-left px-4 py-2 font-medium text-gray-500">Assigned Combination</th>
                          <th className="text-left px-4 py-2 font-medium text-gray-500">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {streamStudents.map((student, idx) => {
                          const studentComboId = studentCombinations[student.id]
                          const studentCombo = combinations.find((c) => c.id === studentComboId)

                          let statusBadge
                          if (!assignedCombId) {
                            statusBadge = <span className="text-gray-300">—</span>
                          } else if (!studentComboId) {
                            statusBadge = (
                              <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200 font-medium">
                                Not assigned
                              </span>
                            )
                          } else if (studentComboId === assignedCombId) {
                            statusBadge = (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
                                ✓ Synced
                              </span>
                            )
                          } else {
                            statusBadge = (
                              <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200 font-medium">
                                ⚠ Mismatch
                              </span>
                            )
                          }

                          return (
                            <tr key={student.id} className="hover:bg-gray-50/60 transition">
                              <td className="px-4 py-2.5 text-gray-300">{idx + 1}</td>
                              <td className="px-4 py-2.5 font-medium text-gray-800">
                                {[student.first_name, student.middle_name, student.surname].filter(Boolean).join(' ')}
                              </td>
                              <td className="px-4 py-2.5 text-gray-500 font-mono">{student.admission_number}</td>
                              <td className="px-4 py-2.5 text-gray-600">
                                {studentCombo ? (
                                  <span className="font-medium">{studentCombo.code}</span>
                                ) : (
                                  <span className="text-gray-300">—</span>
                                )}
                              </td>
                              <td className="px-4 py-2.5">{statusBadge}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* O-Level: Subject summary with lock/unlock */}
      {selectedClassId && classLevel === 'O_LEVEL' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-800">Subjects for this Class</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Click the lock icon to exclude a subject from this class entirely. Excluded subjects won't appear in marks entry or results.
              </p>
            </div>
            <span className="text-xs text-gray-400">
              {students.length} student(s) &middot; {compulsorySubjects.length} compulsory &middot; {optionalSubjects.length} optional
              {excludedCount > 0 && <span className="text-red-500 font-medium ml-1">&middot; {excludedCount} locked</span>}
            </span>
          </div>
          <div className="p-4">
            {getAvailableSubjects().length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">
                No O-Level subjects found. Add subjects in Subject Management first.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {getAvailableSubjects().map((sub) => {
                const isExcluded = excludedSubjects.has(sub.id)
                return (
                  <div
                    key={sub.id}
                    className={`group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition ${
                      isExcluded
                        ? 'border-gray-200 bg-gray-50 text-gray-400'
                        : sub.subject_type === 'COMPULSORY'
                          ? 'border-blue-200 bg-blue-50 text-blue-700'
                          : 'border-amber-200 bg-amber-50 text-amber-700'
                    }`}
                  >
                    <span className={`w-4 h-4 rounded-full shrink-0 ${isExcluded ? 'bg-gray-300' : sub.subject_type === 'COMPULSORY' ? 'bg-blue-500' : 'bg-amber-500'}`} />
                    <span className={isExcluded ? 'line-through' : ''}>
                      {sub.subject_name}
                    </span>
                    <span className="text-xs opacity-60">({sub.subject_code})</span>
                    <button
                      onClick={() => handleToggleExcludeSubject(sub.id)}
                      title={isExcluded ? 'Enable this subject for the class' : 'Lock/exclude this subject for the class'}
                      className={`ml-1 p-1 rounded transition ${
                        isExcluded
                          ? 'text-red-500 hover:bg-red-50'
                          : 'text-gray-400 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100'
                      }`}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        {isExcluded ? (
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                        )}
                      </svg>
                    </button>
                  </div>
                )
              })}
            </div>
            {students.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-2">
                <button
                  onClick={async () => {
                    setBulkAssignSubectIds(new Set())
                    setBulkAssignStudentIds(new Set(students.map((s) => s.id)))
                    setBulkAssignMode('add')
                    setBulkAssignOpen(true)
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium rounded-lg transition"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Bulk Assign Optional
                </button>
                <button
                  onClick={async () => {
                    if (!selectedClassId || students.length === 0) return
                    setLoading(true)
                    try {
                      const { data: allSubs } = await supabase
                        .from('subjects')
                        .select('*')
                        .eq('level', 'O_LEVEL')
                      if (!allSubs || allSubs.length === 0) {
                        showToast('No O-Level subjects found', 'error')
                        return
                      }
                      // Fetch all students directly from DB
                      const streamIds2 = classStreams
                        .filter((cs) => cs.class_id === selectedClassId)
                        .map((cs) => cs.id)
                      let allStudents
                      if (streamIds2.length > 0) {
                        const res = await supabase
                          .from('students')
                          .select('*')
                          .or(`class_stream_id.in.(${streamIds2.map(id => `"${id}"`).join(',')}),class_id.eq."${selectedClassId}"`)
                          .limit(1000000)
                        allStudents = res.data
                      } else {
                        const res = await supabase
                          .from('students')
                          .select('*')
                          .eq('class_id', selectedClassId)
                          .limit(1000000)
                        allStudents = res.data
                      }
                      if (!allStudents || allStudents.length === 0) {
                        showToast('No students found', 'error')
                        return
                      }
                      const allSubIds = allSubs.map((s) => s.id)
                      const rows = []
                      for (const sid of allStudents.map((s) => s.id)) {
                        for (const subId of allSubIds) {
                          rows.push({ student_id: sid, subject_id: subId })
                        }
                      }
                      const CHUNK = 500
                      for (let i = 0; i < rows.length; i += CHUNK) {
                        const { error } = await supabase
                          .from('student_subjects')
                          .upsert(rows.slice(i, i + CHUNK), { onConflict: 'student_id,subject_id' })
                        if (error) throw error
                      }

                      // Directly update local state to avoid stale data from loadClassData
                      const newSsMap = { ...studentSubjects }
                      for (const sid of allStudents.map((s) => s.id)) {
                        newSsMap[sid] = [...(new Set([...(newSsMap[sid] || []), ...allSubIds]))]
                      }
                      setStudentSubjects(newSsMap)

                      showToast(`All ${allSubs.length} subjects assigned to ${allStudents.length} students`, 'success')
                      await loadClassData(selectedClassId)
                    } catch (err) {
                      showToast('Failed: ' + (err.message || ''), 'error')
                    } finally {
                      setLoading(false)
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg transition"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  Assign All to All
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty states */}
      {!selectedClassId && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-sm text-gray-400">
          Select a class above to manage subject assignments
        </div>
      )}

      {selectedClassId && !loading && classLevel === 'O_LEVEL' && streamIdsForClass.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-sm text-gray-400">
          No streams configured for this class.{' '}
          Click "Classes" in the sidebar to add streams.
        </div>
      )}

      {selectedClassId && loading && classLevel === 'O_LEVEL' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden animate-pulse">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-3 py-3 min-w-[140px]">
                    <div className="h-3 w-16 bg-gray-200 rounded" />
                  </th>
                  {[1,2,3,4,5].map((i) => (
                    <th key={i} className="text-center px-1.5 py-3 min-w-[80px]">
                      <div className="h-3 w-10 bg-gray-200 rounded mx-auto" />
                      <div className="h-4 w-14 bg-gray-200 rounded mx-auto mt-1" />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[1,2,3,4].map((row) => (
                  <tr key={row}>
                    <td className="px-4 py-3">
                      <div className="h-3 w-28 bg-gray-200 rounded mb-1.5" />
                      <div className="h-2.5 w-20 bg-gray-100 rounded" />
                    </td>
                    {[1,2,3,4,5].map((col) => (
                      <td key={col} className="text-center px-2 py-3">
                        <div className="w-7 h-7 bg-gray-200 rounded-full mx-auto" />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
            <div className="h-3 w-72 bg-gray-200 rounded" />
          </div>
        </div>
      )}

      {/* O-Level: no subjects assigned */}
      {selectedClassId && !loading && classLevel === 'O_LEVEL' && displaySubjects.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-sm text-gray-400">
          No O-Level subjects are currently available. Add subjects in Subject Management.
        </div>
      )}

      {/* O-Level: Student-Subject grid */}
      {selectedClassId && !loading && classLevel === 'O_LEVEL' && displaySubjects.length > 0 && students.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-sm text-gray-400">
          No students enrolled in this class.
        </div>
      )}

      {selectedClassId && !loading && classLevel === 'O_LEVEL' && displaySubjects.length > 0 && students.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Toolbar */}
          <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50/50">
            <span className="text-xs text-gray-500">{students.length} student(s)</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10 min-w-[140px]">
                    Student
                  </th>
                  {displaySubjects.map((sub) => (
                    <th key={sub.id} className="text-center px-1.5 py-3 text-xs min-w-[80px]">
                      <div className="font-semibold text-gray-700">{sub.subject_code}</div>
                      <div className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium mt-0.5 ${
                        sub.subject_type === 'COMPULSORY' ? 'bg-blue-50 text-blue-600' :
                        sub.subject_type === 'OPTIONAL' ? 'bg-amber-50 text-amber-600' :
                        'bg-purple-50 text-purple-600'
                      }`}>
                        {sub.subject_type}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {students.map((student) => (
                  <tr key={student.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-2.5 sticky left-0 bg-white z-10 border-r border-gray-100">
                      <p className="text-sm font-medium text-gray-900">
                        {[student.first_name, student.middle_name, student.surname].filter(Boolean).join(' ')}
                      </p>
                      <p className="text-xs text-gray-400">{student.admission_number}</p>
                    </td>
                    {displaySubjects.map((sub) => {
                      const isAssigned = (studentSubjects[student.id] || []).includes(sub.id)
                      const isCompulsory = sub.subject_type === 'COMPULSORY'
                      return (
                        <td key={sub.id} className="text-center px-2 py-2.5">
                          {isCompulsory ? (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-50 text-blue-500 cursor-not-allowed" title="Compulsory — cannot be removed">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                              </svg>
                            </span>
                          ) : isAssigned ? (
                            <button
                              onClick={() => handleToggleSubject(student.id, sub.id, sub.subject_type, isAssigned)}
                              disabled={savingStudentId === student.id}
                              className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-red-50 text-red-500 hover:bg-red-100 transition disabled:opacity-50"
                              title="Remove optional subject"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleToggleSubject(student.id, sub.id, sub.subject_type, isAssigned)}
                              disabled={savingStudentId === student.id}
                              className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-50 text-emerald-500 hover:bg-emerald-100 transition disabled:opacity-50"
                              title="Add optional subject"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                              </svg>
                            </button>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
            <span className="text-xs text-gray-500">
              {students.length} student(s) across {streamIdsForClass.length} stream(s) &middot;
              <span className="text-blue-600 font-medium ml-1">{compulsorySubjects.length} compulsory</span> (locked) &middot;
              <span className="text-amber-600 font-medium ml-1">{optionalSubjects.length} optional</span> (add/remove per student)
              {excludedCount > 0 && <span className="text-red-500 font-medium ml-1">&middot; {excludedCount} excluded</span>}
            </span>
          </div>
        </div>
      )}

      {/* Bulk Assign Optional Subjects Modal */}
      <Modal isOpen={bulkAssignOpen} onClose={() => setBulkAssignOpen(false)} title="Bulk Assign Optional Subjects" className="max-w-xl">
        <div className="space-y-4">
          {/* Mode toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setBulkAssignMode('add')}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium border transition ${
                bulkAssignMode === 'add'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                  : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              + Add to students
            </button>
            <button
              onClick={() => setBulkAssignMode('remove')}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium border transition ${
                bulkAssignMode === 'remove'
                  ? 'bg-red-50 border-red-300 text-red-700'
                  : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              − Remove from students
            </button>
          </div>

          {/* Subject selection */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Select Optional Subjects</label>
            <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1">
              {optionalSubjects.map((sub) => (
                <label key={sub.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={bulkAssignSubectIds.has(sub.id)}
                    onChange={() => {
                      setBulkAssignSubectIds((prev) => {
                        const next = new Set(prev)
                        if (next.has(sub.id)) next.delete(sub.id)
                        else next.add(sub.id)
                        return next
                      })
                    }}
                    className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                  />
                  <span className="font-medium text-gray-800">{sub.subject_name}</span>
                  <span className="text-xs text-gray-400">({sub.subject_code})</span>
                </label>
              ))}
              {optionalSubjects.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">No optional subjects available</p>
              )}
            </div>
          </div>

          {/* Student selection */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Select Students</label>
            <div className="flex items-center gap-2 mb-2">
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={bulkAssignStudentIds.size === students.length}
                  onChange={() => {
                    if (bulkAssignStudentIds.size === students.length) {
                      setBulkAssignStudentIds(new Set())
                    } else {
                      setBulkAssignStudentIds(new Set(students.map((s) => s.id)))
                    }
                  }}
                  className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                />
                <span className="font-medium">Select All</span>
              </label>
              <span className="text-xs text-gray-400">({bulkAssignStudentIds.size} of {students.length} selected)</span>
            </div>
            <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1">
              {students.map((student) => (
                <label key={student.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={bulkAssignStudentIds.has(student.id)}
                    onChange={() => {
                      setBulkAssignStudentIds((prev) => {
                        const next = new Set(prev)
                        if (next.has(student.id)) next.delete(student.id)
                        else next.add(student.id)
                        return next
                      })
                    }}
                    className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                  />
                  <span className="text-gray-800">{[student.first_name, student.middle_name, student.surname].filter(Boolean).join(' ')}</span>
                  <span className="text-xs text-gray-400">({student.admission_number})</span>
                </label>
              ))}
            </div>
          </div>

          {/* Action */}
          <button
            onClick={handleBulkAssign}
            disabled={bulkAssigning || bulkAssignSubectIds.size === 0 || bulkAssignStudentIds.size === 0}
            className={`w-full py-2.5 rounded-xl text-sm font-semibold text-white transition flex items-center justify-center gap-2 ${
              bulkAssignMode === 'add'
                ? 'bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300'
                : 'bg-red-600 hover:bg-red-700 disabled:bg-red-300'
            }`}
          >
            {bulkAssigning && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {bulkAssignMode === 'add'
              ? `Add ${bulkAssignSubectIds.size} subject(s) to ${bulkAssignStudentIds.size} student(s)`
              : `Remove ${bulkAssignSubectIds.size} subject(s) from ${bulkAssignStudentIds.size} student(s)`}
          </button>
        </div>
      </Modal>
    </>
  )
}

export default ClassSubjects
