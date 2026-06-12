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
  const [curricula, setCurricula] = useState([])
  const [combinations, setCombinations] = useState([])
  const [combinationSubjects, setCombinationSubjects] = useState([])
  const [subjectAssignments, setSubjectAssignments] = useState([])
  const [classCurricula, setClassCurricula] = useState([])
  const [classCombinations, setClassCombinations] = useState([])

  const [selectedClassId, setSelectedClassId] = useState(searchParams.get('classId') || '')
  const [students, setStudents] = useState([])
  const [studentSubjects, setStudentSubjects] = useState({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [assigningAll, setAssigningAll] = useState(false)
  const [changingCurriculum, setChangingCurriculum] = useState(false)

  const fetchLookups = useCallback(async () => {
    const [cRes, csRes, subRes, curRes, combRes, csSubRes, saRes, ccRes, ccombRes] = await Promise.all([
      supabase.from('classes').select('*').order('sort_order'),
      supabase.from('class_streams').select('id, class_id'),
      supabase.from('subjects').select('*').order('subject_name'),
      supabase.from('curricula').select('*').order('name'),
      supabase.from('combinations').select('*').order('name'),
      supabase.from('combination_subjects').select('*'),
      supabase.from('subject_assignments').select('*'),
      supabase.from('class_curricula').select('*'),
      supabase.from('class_combinations').select('*'),
    ])
    if (cRes.data) setClasses(cRes.data)
    if (csRes.data) setClassStreams(csRes.data)
    if (subRes.data) setSubjects(subRes.data)
    if (curRes.data) setCurricula(curRes.data)
    if (combRes.data) setCombinations(combRes.data)
    if (csSubRes.data) setCombinationSubjects(csSubRes.data)
    if (saRes.data) setSubjectAssignments(saRes.data)
    if (ccRes.data) setClassCurricula(ccRes.data)
    if (ccombRes.data) setClassCombinations(ccombRes.data)
  }, [])

  useEffect(() => {
    fetchLookups()
  }, [fetchLookups])

  const selectedClass = classes.find((c) => c.id === selectedClassId)
  const classLevel = selectedClass?.level || ''
  const classCurriculumRel = classCurricula.find((cc) => cc.class_id === selectedClassId)
  const classCurriculum = classCurriculumRel
    ? curricula.find((c) => c.id === classCurriculumRel.curriculum_id)
    : null

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
      setLoading(false)
      return
    }

    const { data: studData } = await supabase
      .from('students')
      .select('*')
      .in('class_stream_id', streamIds)
      .order('surname')

    if (studData) setStudents(studData)

    const ssMap = {}
    if (studData && studData.length > 0) {
      const ids = studData.map((s) => s.id)
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
    }
    setStudentSubjects(ssMap)
    setLoading(false)
  }, [classStreams])

  useEffect(() => {
    if (selectedClassId) loadClassData(selectedClassId)
    else {
      setStudents([])
      setStudentSubjects({})
    }
  }, [selectedClassId, loadClassData])

  // O-Level: subjects assigned to class via subject_assignments
  const getClassSubjects = () => {
    if (classLevel !== 'O_LEVEL') return []
    return subjectAssignments
      .filter((sa) => sa.class_id === selectedClassId)
      .map((sa) => subjects.find((s) => s.id === sa.subject_id))
      .filter(Boolean)
  }

  // A-Level: combinations assigned to class via class_combinations
  const getClassComboIds = () => {
    if (classLevel !== 'A_LEVEL') return []
    return classCombinations
      .filter((cc) => cc.class_id === selectedClassId)
      .map((cc) => cc.combination_id)
  }

  const getClassCombos = () => {
    const comboIds = getClassComboIds()
    return combinations.filter((c) => comboIds.includes(c.id))
  }

  // A-Level: all subject IDs from all assigned combinations
  const getClassComboSubjectIds = () => {
    const comboIds = getClassComboIds()
    return combinationSubjects
      .filter((cs) => comboIds.includes(cs.combination_id))
      .map((cs) => cs.subject_id)
  }

  const getClassComboSubjects = () => {
    const subjIds = getClassComboSubjectIds()
    return subjects.filter((s) => subjIds.includes(s.id))
  }

  // The actual subjects to display in the grid
  const displaySubjects = classLevel === 'O_LEVEL' ? getClassSubjects() : getClassComboSubjects()

  const handleSetCurriculum = async (curriculumId) => {
    setSaving(true)
    try {
      if (curriculumId) {
        if (classCurriculumRel) {
          await supabase.from('class_curricula').update({ curriculum_id: curriculumId }).eq('class_id', selectedClassId)
        } else {
          await supabase.from('class_curricula').insert({ class_id: selectedClassId, curriculum_id: curriculumId })
        }
        showToast('Curriculum set for class', 'success')
      } else {
        if (classCurriculumRel) {
          await supabase.from('class_curricula').delete().eq('class_id', selectedClassId)
          showToast('Curriculum removed for class', 'success')
        }
      }
      const { data } = await supabase.from('class_curricula').select('*')
      if (data) setClassCurricula(data)
      setChangingCurriculum(false)
    } catch (err) {
      showToast('Failed to set curriculum. ' + (err.message || ''), 'error')
    } finally {
      setSaving(false)
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

  const handleAssignAll = async () => {
    if (students.length === 0 || displaySubjects.length === 0) return
    setAssigningAll(true)
    try {
      let inserted = 0
      for (const student of students) {
        const existing = studentSubjects[student.id] || []
        const toAdd = displaySubjects
          .filter((sub) => !existing.includes(sub.id))
          .map((sub) => ({ student_id: student.id, subject_id: sub.id }))

        if (toAdd.length > 0) {
          const { error } = await supabase.from('student_subjects').insert(toAdd)
          if (error && !error.message.includes('duplicate key')) {
            console.error('Insert error:', error)
          } else {
            inserted += toAdd.length
          }
        }
      }
      await loadClassData(selectedClassId)
      showToast(`Assigned ${inserted} subject(s) to class`, 'success')
    } catch (err) {
      showToast('Failed to assign subjects. ' + (err.message || ''), 'error')
    } finally {
      setAssigningAll(false)
    }
  }

  const handleToggleSubject = async (studentId, subjectId, subjectType, currentlyAssigned) => {
    if (subjectType === 'COMPULSORY') return

    setSaving(true)
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
      } else {
        const { error } = await supabase
          .from('student_subjects')
          .insert({ student_id: studentId, subject_id: subjectId })
        if (error) throw error

        setStudentSubjects((prev) => ({
          ...prev,
          [studentId]: [...(prev[studentId] || []), subjectId],
        }))
      }
    } catch (err) {
      showToast('Failed to update. ' + (err.message || ''), 'error')
    } finally {
      setSaving(false)
    }
  }

  const compulsorySubjects = displaySubjects.filter((s) => s?.subject_type === 'COMPULSORY')
  const optionalSubjects = displaySubjects.filter((s) => s?.subject_type !== 'COMPULSORY')

  const availableCurricula = curricula.filter((c) => c.level === classLevel)
  const classComboIds = getClassComboIds()

  // Available combos for this class's curriculum
  const availableCombos = classCurriculum
    ? combinations.filter((c) => c.curriculum_id === classCurriculum.id)
    : []

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

      {/* Class & Curriculum selector */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
        <div className="p-4 space-y-4 sm:space-y-0 sm:flex sm:items-start sm:gap-4">
          <div className="sm:w-64">
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Select Class</label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 transition"
            >
              <option value="">-- Select class --</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.class_name} ({c.level === 'O_LEVEL' ? 'O-Level' : 'A-Level'})
                </option>
              ))}
            </select>
          </div>

          {selectedClassId && classLevel && (
            <div className="sm:w-72">
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Curriculum <span className="text-gray-400">({classLevel === 'O_LEVEL' ? 'O-Level' : 'A-Level'})</span>
              </label>
              {classCurriculum && !changingCurriculum ? (
                <div className="flex items-center gap-2">
                  <span className="px-3 py-2.5 bg-indigo-50 text-indigo-700 text-sm font-medium rounded-xl border border-indigo-200">
                    {classCurriculum.name}
                  </span>
                  <button
                    onClick={() => setChangingCurriculum(true)}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium transition"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <select
                    value=""
                    onChange={(e) => e.target.value && handleSetCurriculum(e.target.value)}
                    className="flex-1 px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 transition"
                  >
                    <option value="">{changingCurriculum ? '-- Change curriculum --' : '-- Select curriculum --'}</option>
                    {availableCurricula.map((cu) => (
                      <option key={cu.id} value={cu.id}>{cu.name}</option>
                    ))}
                  </select>
                  {changingCurriculum && (
                    <button
                      onClick={() => setChangingCurriculum(false)}
                      className="text-xs text-gray-400 hover:text-gray-600 transition"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {selectedClassId && displaySubjects.length > 0 && students.length > 0 && (
            <div className="sm:pt-5 sm:ml-auto flex items-center gap-3">
              <button
                onClick={handleAssignAll}
                disabled={assigningAll}
                className="px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition flex items-center gap-2"
              >
                {assigningAll ? (
                  <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Assigning...</>
                ) : (
                  <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Assign All to Students</>
                )}
              </button>
              <span className="text-xs text-gray-400">
                {students.length} student(s) &middot; {compulsorySubjects.length} compulsory &middot; {optionalSubjects.length} optional
              </span>
            </div>
          )}
        </div>
      </div>

      {/* A-Level: Combination selector */}
      {selectedClassId && classLevel === 'A_LEVEL' && classCurriculum && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <h2 className="text-sm font-semibold text-gray-800">Combinations for this Class</h2>
            <p className="text-xs text-gray-500 mt-0.5">Select which combinations this class offers. Students will be assigned all subjects from selected combinations.</p>
          </div>
          <div className="p-4">
            {availableCombos.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">
                No combinations found for the {classCurriculum.name} curriculum.
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
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-gray-900">{combo.code}</span>
                      <span className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                        isAssigned ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'
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

      {/* Empty states */}
      {!selectedClassId && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-sm text-gray-400">
          Select a class above to manage subject assignments
        </div>
      )}

      {selectedClassId && !classCurriculum && availableCurricula.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-sm text-gray-400">
          Select a curriculum for this class to continue.
        </div>
      )}

      {selectedClassId && classLevel === 'O_LEVEL' && classCurriculum && streamIdsForClass.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-sm text-gray-400">
          No streams configured for this class.{' '}
          {streamIdsForClass.length === 0 ? 'Click "Classes" in the sidebar to add streams.' : ''}
        </div>
      )}

      {selectedClassId && classCurriculum && streamIdsForClass.length > 0 && loading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-3 border-gray-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      )}

      {/* O-Level: no subjects assigned */}
      {selectedClassId && !loading && classLevel === 'O_LEVEL' && classCurriculum && displaySubjects.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-sm text-gray-400">
          No subjects assigned to this class. Manage subject assignments in Subject Management.
        </div>
      )}

      {/* A-Level: no combos selected */}
      {selectedClassId && !loading && classLevel === 'A_LEVEL' && classCurriculum && getClassComboIds().length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-sm text-gray-400">
          Select at least one combination above.
        </div>
      )}

      {/* Student-Subject grid (both O-Level and A-Level) */}
      {selectedClassId && !loading && classCurriculum && displaySubjects.length > 0 && students.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-sm text-gray-400">
          No students enrolled in this class.
        </div>
      )}

      {selectedClassId && !loading && classCurriculum && displaySubjects.length > 0 && students.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10 min-w-[200px]">
                    Student
                  </th>
                  {displaySubjects.map((sub) => (
                    <th key={sub.id} className="text-center px-2 py-3 text-xs min-w-[100px]">
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
                              disabled={saving}
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
                              disabled={saving}
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
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

export default ClassSubjects
