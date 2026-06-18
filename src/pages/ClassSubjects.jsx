import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useNotification } from '../context/NotificationContext'

function ClassSubjects() {
  const { showToast } = useNotification()
  const [searchParams] = useSearchParams()

  const [classes, setClasses] = useState([])
  const [classStreams, setClassStreams] = useState([])
  const [subjects, setSubjects] = useState([])
  const [combinations, setCombinations] = useState([])
  const [combinationSubjects, setCombinationSubjects] = useState([])
  const [classCombinations, setClassCombinations] = useState([])

  const [selectedClassId, setSelectedClassId] = useState(searchParams.get('classId') || '')
  const [students, setStudents] = useState([])
  const [studentSubjects, setStudentSubjects] = useState({})
  const [studentCombinations, setStudentCombinations] = useState({}) // studentId -> combinationId
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savingStudentId, setSavingStudentId] = useState(null) // track which student is being saved
  const [excludedSubjects, setExcludedSubjects] = useState(new Set())

  const fetchLookups = useCallback(async () => {
    const [cRes, csRes, subRes, combRes, csSubRes, ccombRes] = await Promise.all([
      supabase.from('classes').select('*').order('sort_order'),
      supabase.from('class_streams').select('id, class_id'),
      supabase.from('subjects').select('*').order('subject_name'),
      supabase.from('combinations').select('*').order('name'),
      supabase.from('combination_subjects').select('*'),
      supabase.from('class_combinations').select('*'),
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
    setLoading(true)

    const streamIds = classStreams
      .filter((cs) => cs.class_id === classId)
      .map((cs) => cs.id)

    if (streamIds.length === 0) {
      setStudents([])
      setStudentSubjects({})
      setStudentCombinations({})
      setLoading(false)
      return
    }

    const { data: studData, error: studErr } = await supabase
      .from('students')
      .select('*')
      .in('class_stream_id', streamIds)
      .order('surname')
    if (studErr) console.error('fetchStudents error:', studErr)

    if (studData) setStudents(studData)

    const selectedClassForLoad = classes.find((c) => c.id === classId)
    const oLevelSubjectIds = selectedClassForLoad?.level === 'O_LEVEL'
      ? subjects
          .filter((s) => s.level === 'O_LEVEL')
          .map((s) => s.id)
      : []

    const ssMap = {}
    const scMap = {}
    if (studData && studData.length > 0) {
      const ids = studData.map((s) => s.id)

      if (oLevelSubjectIds.length > 0) {
        const { data: existingSubs } = await supabase
          .from('student_subjects')
          .select('student_id, subject_id')
          .in('student_id', ids)
          .in('subject_id', oLevelSubjectIds)

        const existingKeys = new Set((existingSubs || []).map((row) => `${row.student_id}:${row.subject_id}`))
        const missingSubs = []
        for (const student of studData) {
          for (const subjectId of oLevelSubjectIds) {
            const key = `${student.id}:${subjectId}`
            if (!existingKeys.has(key)) {
              missingSubs.push({ student_id: student.id, subject_id: subjectId })
            }
          }
        }

        if (missingSubs.length > 0) {
          const { error: insertErr } = await supabase
            .from('student_subjects')
            .upsert(missingSubs, { onConflict: 'student_id,subject_id' })
          if (insertErr) console.error('autoAssignOLevelSubjects error:', insertErr)
        }
      }

      // Fetch student subjects
      const { data: ssData } = await supabase
        .from('student_subjects')
        .select('*')
        .in('student_id', ids)
      if (ssData) {
        ssData.forEach((row) => {
          if (!ssMap[row.student_id]) ssMap[row.student_id] = []
          ssMap[row.student_id].push(row.subject_id)
        })
      }

      // Fetch student combinations (A-Level)
      const { data: scData } = await supabase
        .from('student_combinations')
        .select('student_id, combination_id')
        .in('student_id', ids)
      if (scData) {
        scData.forEach((row) => {
          scMap[row.student_id] = row.combination_id
        })
      }
    }
    setStudentSubjects(ssMap)
    setStudentCombinations(scMap)

    // Load excluded subjects for this class
    const { data: exclData } = await supabase
      .from('class_excluded_subjects')
      .select('subject_id')
      .eq('class_id', classId)
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

  // A-Level: get optional subjects for a specific student's combination
  const getStudentOptionalSubjects = (studentId) => {
    const combId = studentCombinations[studentId]
    if (!combId) return []
    return combinationSubjects
      .filter((cs) => cs.combination_id === combId)
      .map((cs) => subjects.find((s) => s.id === cs.subject_id))
      .filter((s) => s && s.subject_type !== 'COMPULSORY')
  }

  // A-Level: get all subjects (compulsory + optional) for a student's combination
  const getStudentComboSubjects = (studentId) => {
    const combId = studentCombinations[studentId]
    if (!combId) return []
    return combinationSubjects
      .filter((cs) => cs.combination_id === combId)
      .map((cs) => subjects.find((s) => s.id === cs.subject_id))
      .filter(Boolean)
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

  // A-Level: assign/change combination for a student
  const handleSetStudentCombination = async (studentId, newCombinationId) => {
    if (!newCombinationId) return
    setSavingStudentId(studentId)
    try {
      // 1. Upsert student_combinations
      const { error: combErr } = await supabase
        .from('student_combinations')
        .upsert(
          { student_id: studentId, combination_id: newCombinationId },
          { onConflict: 'student_id' }
        )
      if (combErr) throw combErr

      // 2. Remove all old A-Level subjects from this student
      const aLevelSubjectIds = subjects.filter((s) => s.level === 'A_LEVEL').map((s) => s.id)
      if (aLevelSubjectIds.length > 0) {
        await supabase
          .from('student_subjects')
          .delete()
          .eq('student_id', studentId)
          .in('subject_id', aLevelSubjectIds)
      }

      // 3. Insert ALL subjects from new combination (CORE, SUBSIDIARY, OPTIONAL)
      const allSubjectIds = combinationSubjects
        .filter((cs) => cs.combination_id === newCombinationId)
        .map((cs) => cs.subject_id)

      if (allSubjectIds.length > 0) {
        await supabase.from('student_subjects').upsert(
          allSubjectIds.map((subject_id) => ({ student_id: studentId, subject_id })),
          { onConflict: 'student_id,subject_id' }
        )
      }

      // Update local state
      setStudentCombinations((prev) => ({ ...prev, [studentId]: newCombinationId }))
      setStudentSubjects((prev) => ({ ...prev, [studentId]: allSubjectIds }))

      const combo = combinations.find((c) => c.id === newCombinationId)
      showToast(`Combination ${combo?.code || ''} imewekwa — masomo yote yamepelekwa`, 'success')
    } catch (err) {
      showToast('Failed to set combination: ' + (err.message || ''), 'error')
    } finally {
      setSavingStudentId(null)
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
          .insert({ student_id: studentId, subject_id: subjectId })
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

  const allClassSubjects = classLevel === 'O_LEVEL' ? getClassSubjects() : []
  const compulsorySubjects = displaySubjects.filter((s) => s?.subject_type === 'COMPULSORY')
  const optionalSubjects = displaySubjects.filter((s) => s?.subject_type !== 'COMPULSORY')
  const excludedCount = allClassSubjects.length - displaySubjects.length

  const classComboIds = getClassComboIds()

  // Available combos for this class
  const availableCombos = classLevel === 'A_LEVEL'
    ? combinations
    : []

  // Combos offered by this class (subset of availableCombos)
  const offeredCombos = combinations.filter((c) => classComboIds.includes(c.id))

  return (
    <div>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Class Subject Assignments</h1>
          <p className="text-gray-500 mt-1">
            {classLevel === 'A_LEVEL'
              ? 'Assign subject combinations (groups) to A-Level classes. Multiple combinations allowed per class.'
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
          </div>
        </div>
      )}

      {/* Empty states */}
      {!selectedClassId && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-sm text-gray-400">
          Select a class above to manage subject assignments
        </div>
      )}

      {selectedClassId && classLevel === 'O_LEVEL' && streamIdsForClass.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-sm text-gray-400">
          No streams configured for this class.{' '}
          {streamIdsForClass.length === 0 ? 'Click "Classes" in the sidebar to add streams.' : ''}
        </div>
      )}

      {selectedClassId && streamIdsForClass.length > 0 && loading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-3 border-gray-200 border-t-maroon-600 rounded-full animate-spin" />
        </div>
      )}

      {/* O-Level: no subjects assigned */}
      {selectedClassId && !loading && classLevel === 'O_LEVEL' && displaySubjects.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-sm text-gray-400">
          No O-Level subjects are currently available. Add subjects in Subject Management.
        </div>
      )}

      {/* A-Level: no combos selected for class */}
      {selectedClassId && !loading && classLevel === 'A_LEVEL' && getClassComboIds().length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-sm text-gray-400">
          Select one or more combinations above to assign them to students.
        </div>
      )}

      {/* A-Level: student combination & optional subjects grid */}
      {selectedClassId && !loading && classLevel === 'A_LEVEL' && offeredCombos.length > 0 && students.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-sm text-gray-400">
          No students enrolled in this class.
        </div>
      )}

      {selectedClassId && !loading && classLevel === 'A_LEVEL' && offeredCombos.length > 0 && students.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-800">Students — Combination &amp; Optional Subjects</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Assign each student a combination. Compulsory subjects are set automatically. You can add or remove OPTIONAL/ELECTIVE subjects per student.
              </p>
            </div>
            <span className="text-xs text-gray-400">{students.length} student(s)</span>
          </div>

          <div className="divide-y divide-gray-100">
            {students.map((student) => {
              const studentCombId = studentCombinations[student.id]
              const optionalSubs = getStudentOptionalSubjects(student.id)
              const allComboSubs = getStudentComboSubjects(student.id)
              const compulsorySubs = allComboSubs.filter((s) => s.subject_type === 'COMPULSORY')
              const isSavingThis = savingStudentId === student.id

              return (
                <div key={student.id} className="p-4 hover:bg-gray-50/50 transition">
                  {/* Student header row */}
                  <div className="flex items-start gap-4 flex-wrap">
                    {/* Student info */}
                    <div className="min-w-[180px]">
                      <p className="text-sm font-semibold text-gray-900">
                        {student.surname}, {student.first_name}
                      </p>
                      <p className="text-xs text-gray-400">{student.admission_number}</p>
                    </div>

                    {/* Combination selector */}
                    <div className="flex-1 min-w-[220px]">
                      <label className="block text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1">
                        Combination
                      </label>
                      <div className="flex items-center gap-2">
                        <select
                          value={studentCombId || ''}
                          onChange={(e) => handleSetStudentCombination(student.id, e.target.value)}
                          disabled={isSavingThis}
                          className={`flex-1 px-3 py-1.5 bg-white border rounded-lg text-sm outline-none transition ${
                            studentCombId
                              ? 'border-violet-300 text-violet-800 focus:border-violet-400 focus:ring-2 focus:ring-violet-500/10'
                              : 'border-gray-200 text-gray-500 focus:border-gray-400'
                          } disabled:opacity-50`}
                        >
                          <option value="">-- Select Combination --</option>
                          {offeredCombos.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.code} — {c.name}
                            </option>
                          ))}
                        </select>
                        {isSavingThis && (
                          <span className="w-4 h-4 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin flex-shrink-0" />
                        )}
                      </div>
                    </div>

                    {/* Compulsory subjects (locked) */}
                    {studentCombId && compulsorySubs.length > 0 && (
                      <div className="min-w-[200px]">
                        <label className="block text-[10px] font-medium text-blue-500 uppercase tracking-wider mb-1">
                          Compulsory (COMPULSORY)
                        </label>
                        <div className="flex flex-wrap gap-1">
                          {compulsorySubs.map((sub) => (
                            <span
                              key={sub.id}
                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-100"
                              title="Cannot be removed — compulsory subject"
                            >
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
                              {sub.subject_code}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Optional subjects row */}
                  {studentCombId && optionalSubs.length > 0 && (
                    <div className="mt-3 pl-4 border-l-2 border-amber-200">
                      <label className="block text-[10px] font-medium text-amber-600 uppercase tracking-wider mb-1.5">
                        Optional / Elective — click to add or remove
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {optionalSubs.map((sub) => {
                          const isAssigned = (studentSubjects[student.id] || []).includes(sub.id)
                          return (
                            <button
                              key={sub.id}
                              onClick={() => handleToggleSubject(student.id, sub.id, sub.subject_type, isAssigned)}
                              disabled={isSavingThis}
                              title={isAssigned ? 'Click to remove' : 'Click to add'}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition disabled:opacity-50 ${
                                isAssigned
                                  ? 'border-amber-400 bg-amber-50 text-amber-700 hover:bg-red-50 hover:border-red-300 hover:text-red-600'
                                  : 'border-gray-200 bg-white text-gray-500 hover:border-amber-300 hover:text-amber-600 hover:bg-amber-50'
                              }`}
                            >
                              {isAssigned ? (
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                              ) : (
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                              )}
                              {sub.subject_code}
                              <span className="opacity-60 font-normal">
                                {sub.subject_type === 'ELECTIVE' ? 'ELECTIVE' : 'OPT'}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* No combination yet */}
                  {!studentCombId && (
                    <p className="mt-2 text-xs text-amber-600">
                      ⚠️ No combination selected — choose one above
                    </p>
                  )}
                </div>
              )
            })}
          </div>

          <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
            <span className="text-xs text-gray-500">
              {students.length} student(s) &middot;
              <span className="text-violet-600 font-medium ml-1">
                {Object.keys(studentCombinations).filter(id => students.some(s => s.id === id)).length}
              </span> with combination &middot;
              <span className="text-amber-600 font-medium ml-1">
                {students.length - Object.keys(studentCombinations).filter(id => students.some(s => s.id === id)).length}
              </span> not assigned
            </span>
          </div>
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
                        {student.surname}, {student.first_name}
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
    </div>
  )
}

export default ClassSubjects
