import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import Modal from '../../components/Modal'
import { useNotification } from '../../context/NotificationContext'

const LEVELS = ['O_LEVEL', 'A_LEVEL']
const SUBJECT_TYPES = ['COMPULSORY', 'OPTIONAL', 'ELECTIVE']
const ROLES = ['CORE', 'SUBSIDIARY', 'OPTIONAL']

const subjectTypeLabel = (type, level) => {
  if (level === 'A_LEVEL') {
    switch (type) {
      case 'COMPULSORY': return 'Principal'
      case 'ELECTIVE':   return 'Subsidiary'
      case 'OPTIONAL':   return 'Optional'
      default: return type
    }
  }
  switch (type) {
    case 'COMPULSORY': return 'Compulsory'
    case 'OPTIONAL':   return 'Optional'
    case 'ELECTIVE':   return 'Elective'
    default: return type
  }
}

const subjectTypeColor = (type, level) => {
  if (level === 'A_LEVEL') {
    switch (type) {
      case 'COMPULSORY': return 'bg-emerald-50 text-emerald-700'
      case 'ELECTIVE':   return 'bg-violet-50 text-violet-700'
      case 'OPTIONAL':   return 'bg-amber-50 text-amber-700'
      default: return 'bg-gray-100 text-gray-600'
    }
  }
  switch (type) {
    case 'COMPULSORY': return 'bg-rose-50 text-rose-700'
    case 'OPTIONAL':   return 'bg-teal-50 text-teal-700'
    case 'ELECTIVE':   return 'bg-gray-100 text-gray-600'
    default: return 'bg-gray-100 text-gray-600'
  }
}

function AcademicSubjects() {
  const { showToast } = useNotification()
  const [activeLevel, setActiveLevel] = useState('O_LEVEL')
  const [aLevelSubTab, setALevelSubTab] = useState('subjects')
  const [loading, setLoading] = useState(true)

  const [subjects, setSubjects] = useState([])
  const [combinations, setCombinations] = useState([])
  const [combinationSubjects, setCombinationSubjects] = useState([])

  const [subjectModalOpen, setSubjectModalOpen] = useState(false)
  const [comboModalOpen, setComboModalOpen] = useState(false)
  const [comboSubjectsModalOpen, setComboSubjectsModalOpen] = useState(false)
  const [editingSubject, setEditingSubject] = useState(null)
  const [editingCombo, setEditingCombo] = useState(null)
  const [selectedCombo, setSelectedCombo] = useState(null)
  const [formData, setFormData] = useState({})
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  const fetchSubjects = useCallback(async () => {
    const { data } = await supabase.from('subjects').select('*').order('subject_name')
    if (data) setSubjects(data)
  }, [])

  const fetchCombinations = useCallback(async () => {
    const { data } = await supabase.from('combinations').select('*').order('name')
    if (data) setCombinations(data)
  }, [])

  const fetchCombinationSubjects = useCallback(async () => {
    const { data } = await supabase.from('combination_subjects').select('*')
    if (data) setCombinationSubjects(data)
  }, [])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      await Promise.all([fetchSubjects(), fetchCombinations(), fetchCombinationSubjects()])
      setLoading(false)
    }
    load()
  }, [fetchSubjects, fetchCombinations, fetchCombinationSubjects])

  const oLevelSubjects = subjects.filter((s) => s.level === 'O_LEVEL')
  const aLevelSubjects = subjects.filter((s) => s.level === 'A_LEVEL')

  const openSubjectCreate = () => {
    setEditingSubject(null)
    setFormData({
      subject_code: '',
      subject_name: '',
      level: activeLevel,
      subject_type: 'COMPULSORY',
    })
    setSubjectModalOpen(true)
  }

  const openSubjectEdit = (subject) => {
    setEditingSubject(subject)
    setFormData({
      subject_code: subject.subject_code,
      subject_name: subject.subject_name,
      level: subject.level,
      subject_type: subject.subject_type,
    })
    setSubjectModalOpen(true)
  }

  const handleSaveSubject = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const code = formData.subject_code.toUpperCase()

      // Client-side duplicate check
      const duplicate = subjects.find(
        (s) => s.subject_code === code && s.level === formData.level && s.id !== editingSubject?.id
      )
      if (duplicate) {
        showToast(`Subject code "${code}" already exists at this level. Choose a different code.`, 'error')
        return
      }

      const payload = {
        subject_code: code,
        subject_name: formData.subject_name,
        level: formData.level,
        subject_type: formData.subject_type,
        curriculum: null,
      }
      if (editingSubject) {
        const { error } = await supabase.from('subjects').update(payload).eq('id', editingSubject.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('subjects').insert(payload)
        if (error) throw error
      }
      await fetchSubjects()
      setSubjectModalOpen(false)
      showToast(editingSubject ? 'Subject updated successfully' : 'Subject created successfully', 'success')
    } catch (err) {
      console.error('Save error:', err)
      const msg = err?.code === '23505'
        ? `Subject code "${formData.subject_code.toUpperCase()}" already exists at this level. Choose a different code.`
        : (err.message || 'Unknown error')
      showToast('Failed to save. ' + msg, 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteSubject = async (id) => {
    try {
      const { error } = await supabase.from('subjects').delete().eq('id', id)
      if (error) throw error
      await fetchSubjects()
      setDeleteConfirm(null)
      showToast('Subject deleted successfully', 'success')
    } catch (err) {
      console.error('Delete error:', err)
      showToast('Failed to delete. ' + (err.message || ''), 'error')
    }
  }

  const comboName = (combo) => combo?.name || combo?.combination_name || ''
  const comboDesc = (combo) => combo?.description || ''

  const openComboCreate = () => {
    setEditingCombo(null)
    setFormData({ code: '', name: '', description: '' })
    setComboModalOpen(true)
  }

  const openComboEdit = (combo) => {
    setEditingCombo(combo)
    setFormData({ code: combo.code || '', name: combo.name || combo.combination_name || '', description: combo.description || '' })
    setComboModalOpen(true)
  }

  const handleSaveCombo = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        code: formData.code.toUpperCase(),
        name: formData.name,
      }
      if (editingCombo) {
        const { error } = await supabase
          .from('combinations')
          .update(payload)
          .eq('id', editingCombo.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('combinations')
          .insert(payload)
        if (error) throw error
      }
      await fetchCombinations()
      setComboModalOpen(false)
      showToast(editingCombo ? 'Combination updated successfully' : 'Combination created successfully', 'success')
    } catch (err) {
      console.error('Save error:', err)
      showToast('Failed to save. ' + (err.message || ''), 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteCombo = async (id) => {
    try {
      const { error } = await supabase.from('combinations').delete().eq('id', id)
      if (error) throw error
      await fetchCombinations()
      await fetchCombinationSubjects()
      setDeleteConfirm(null)
      showToast('Combination deleted successfully', 'success')
    } catch (err) {
      console.error('Delete error:', err)
      showToast('Failed to delete. ' + (err.message || ''), 'error')
    }
  }

  const subjectTypeToRole = (type) => {
    if (type === 'COMPULSORY') return 'CORE'
    if (type === 'ELECTIVE') return 'SUBSIDIARY'
    return 'OPTIONAL'
  }

  const roleStyle = (role) => {
    if (role === 'CORE') return { label: 'Principal', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
    if (role === 'SUBSIDIARY') return { label: 'Subsidiary', cls: 'bg-violet-50 text-violet-700 border-violet-200' }
    return { label: 'Optional', cls: 'bg-amber-50 text-amber-700 border-amber-200' }
  }

  const openComboSubjects = (combo) => {
    setSelectedCombo(combo)
    setComboSubjectsModalOpen(true)
  }

  const getAssignedSubjects = (comboId) => {
    return combinationSubjects.filter((cs) => cs.combination_id === comboId)
  }

  const getAssignedSubjectIds = (comboId) => {
    return getAssignedSubjects(comboId).map((cs) => cs.subject_id)
  }

  const toggleComboSubject = async (comboId, subjectId, role) => {
    setSaving(true)
    try {
      const existing = combinationSubjects.find(
        (cs) => cs.combination_id === comboId && cs.subject_id === subjectId
      )
      if (existing) {
        const { error } = await supabase
          .from('combination_subjects')
          .delete()
          .eq('id', existing.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('combination_subjects')
          .insert({ combination_id: comboId, subject_id: subjectId, subject_role: role })
        if (error) throw error
      }
      await fetchCombinationSubjects()
      showToast(existing ? 'Subject removed from combination' : 'Subject added to combination', 'success')
    } catch (err) {
      console.error('Save error:', err)
      const msg = err?.code === '23505'
        ? `Subject code "${formData.subject_code.toUpperCase()}" already exists`
        : err.message || 'Unknown error'
      showToast('Failed to save. ' + msg, 'error')
    } finally {
      setSaving(false)
    }
  }

  const updateComboSubjectRole = async (comboId, subjectId, newRole) => {
    setSaving(true)
    try {
      const existing = combinationSubjects.find(
        (cs) => cs.combination_id === comboId && cs.subject_id === subjectId
      )
      if (existing) {
        const { error } = await supabase
          .from('combination_subjects')
          .update({ subject_role: newRole })
          .eq('id', existing.id)
        if (error) throw error
        await fetchCombinationSubjects()
        showToast('Subject role updated', 'success')
      }
    } catch (err) {
      console.error('Update role error:', err)
      showToast('Failed to update subject role.', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-3 border-gray-200 border-t-maroon-600 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Subject Management</h1>
        <p className="text-gray-500 mt-1">Manage O-Level subjects and A-Level subject combinations</p>
      </div>

      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        {LEVELS.map((l) => (
          <button
            key={l}
            onClick={() => setActiveLevel(l)}
            className={`px-5 py-2 text-sm font-medium rounded-md transition ${
              activeLevel === l
                ? 'bg-white text-maroon-700 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {l === 'O_LEVEL' ? 'O-Level Subjects' : 'A-Level'}
          </button>
        ))}
      </div>

      {activeLevel === 'O_LEVEL' && (
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <p className="text-sm text-gray-500">{oLevelSubjects.length} O-Level subject(s)</p>
            <button
              onClick={openSubjectCreate}
              className="px-4 py-2 bg-maroon-600 text-white text-sm font-medium rounded-lg hover:bg-maroon-700 transition"
            >
              + Add Subject
            </button>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Code</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Subject Name</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {oLevelSubjects.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-10 text-center text-sm text-gray-400">
                      No O-Level subjects found. Click "+ Add Subject" to create one.
                    </td>
                  </tr>
                )}
                {oLevelSubjects.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50 transition">
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                        {s.subject_code}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-sm font-medium text-gray-900">{s.subject_name}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${subjectTypeColor(s.subject_type, 'O_LEVEL')}`}>
                        {subjectTypeLabel(s.subject_type, 'O_LEVEL')}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openSubjectEdit(s)} title="Edit subject" className="p-1.5 rounded-lg text-maroon-600 hover:bg-maroon-50 hover:text-maroon-800 transition">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button onClick={() => setDeleteConfirm({ type: 'subject', id: s.id, name: s.subject_name })} title="Delete subject" className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 hover:text-red-700 transition">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}

      {activeLevel === 'A_LEVEL' && (
        <div>
          {/* A-Level sub-tabs */}
          <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
            {[
              { key: 'subjects', label: 'A-Level Subjects' },
              { key: 'combinations', label: 'Combinations' },
            ].map((sub) => (
              <button
                key={sub.key}
                onClick={() => setALevelSubTab(sub.key)}
                className={`px-5 py-2 text-sm font-medium rounded-md transition ${
                  aLevelSubTab === sub.key
                    ? 'bg-white text-maroon-700 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {sub.label}
              </button>
            ))}
          </div>

          {/* ── A-Level Subjects list ── */}
          {aLevelSubTab === 'subjects' && (
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <p className="text-sm text-gray-500">{aLevelSubjects.length} A-Level subject(s)</p>
                <button
                  onClick={openSubjectCreate}
                  className="px-4 py-2 bg-maroon-600 text-white text-sm font-medium rounded-lg hover:bg-maroon-700 transition"
                >
                  + Add A-Level Subject
                </button>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Code</th>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Subject Name</th>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                        <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {aLevelSubjects.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-5 py-10 text-center text-sm text-gray-400">
                            No A-Level subjects yet. Click &ldquo;+ Add A-Level Subject&rdquo; to create one.
                          </td>
                        </tr>
                      )}
                      {aLevelSubjects.map((s) => (
                        <tr key={s.id} className="hover:bg-gray-50 transition">
                          <td className="px-5 py-3.5">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 font-mono">
                              {s.subject_code}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-sm font-medium text-gray-900">{s.subject_name}</td>
                          <td className="px-5 py-3.5">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${subjectTypeColor(s.subject_type, 'A_LEVEL')}`}>
                              {subjectTypeLabel(s.subject_type, 'A_LEVEL')}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => openSubjectEdit(s)} title="Edit subject" className="p-1.5 rounded-lg text-maroon-600 hover:bg-maroon-50 hover:text-maroon-800 transition">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                              </button>
                              <button onClick={() => setDeleteConfirm({ type: 'subject', id: s.id, name: s.subject_name })} title="Delete subject" className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 hover:text-red-700 transition">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── Combinations grid ── */}
          {aLevelSubTab === 'combinations' && (
          <div>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <p className="text-sm text-gray-500">{combinations.length} combination(s)</p>
            <button
              onClick={openComboCreate}
              className="px-4 py-2 bg-maroon-600 text-white text-sm font-medium rounded-lg hover:bg-maroon-700 transition"
            >
              + Add Combination
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {combinations.length === 0 && (
              <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-10 text-center text-sm text-gray-400">
                No combinations found. Click "+ Add Combination" to create one.
              </div>
            )}
            {combinations.map((combo) => {
              const assigned = getAssignedSubjects(combo.id)
              const core = assigned.filter((cs) => cs.subject_role === 'CORE')
              const subsidiary = assigned.filter((cs) => cs.subject_role === 'SUBSIDIARY')
              const optional = assigned.filter((cs) => cs.subject_role === 'OPTIONAL')

              const getSubject = (id) => subjects.find((s) => s.id === id)

              return (
                <div key={combo.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-sm transition">
                  <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        {combo.code && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-maroon-50 text-maroon-700">{combo.code}</span>
                        )}
                        <h3 className="text-base font-semibold text-gray-900">{comboName(combo)}</h3>
                      </div>
                      {comboDesc(combo) && (
                        <p className="text-xs text-gray-500 mt-0.5">{comboDesc(combo)}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => openComboSubjects(combo)}
                        className="px-3 py-1.5 text-xs font-medium text-maroon-600 bg-maroon-50 rounded-lg hover:bg-maroon-100 transition"
                        title="Manage subjects"
                      >
                        Subjects
                      </button>
                      <button
                        onClick={() => openComboEdit(combo)}
                        className="p-1.5 text-gray-400 hover:text-maroon-600 hover:bg-gray-100 rounded-lg transition"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setDeleteConfirm({ type: 'combination', id: combo.id, name: comboName(combo) })}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className="px-5 py-3 space-y-3">
                    <div>
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Core Subjects (3)</span>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {core.length === 0 && <span className="text-xs text-gray-400">None assigned</span>}
                        {core.map((cs) => {
                          const sub = getSubject(cs.subject_id)
                          return sub ? (
                            <span key={cs.id} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700">
                              {sub.subject_code}
                            </span>
                          ) : null
                        })}
                      </div>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Subsidiary</span>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {subsidiary.length === 0 && <span className="text-xs text-gray-400">None assigned</span>}
                        {subsidiary.map((cs) => {
                          const sub = getSubject(cs.subject_id)
                          return sub ? (
                            <span key={cs.id} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-violet-50 text-violet-700">
                              {sub.subject_code}
                            </span>
                          ) : null
                        })}
                      </div>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Optional</span>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {optional.length === 0 && <span className="text-xs text-gray-400">None assigned</span>}
                        {optional.map((cs) => {
                          const sub = getSubject(cs.subject_id)
                          return sub ? (
                            <span key={cs.id} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                              {sub.subject_code}
                            </span>
                          ) : null
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="px-5 py-2.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-xs text-gray-500">{assigned.length} subject(s) total</span>
                    <span className="text-xs text-gray-400">
                      {comboDesc(combo)?.split('–')[0]?.trim() || combo.name || ''}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
          </div>
          )}
        </div>
      )}

      <Modal
        isOpen={subjectModalOpen}
        onClose={() => setSubjectModalOpen(false)}
        title={editingSubject ? 'Edit Subject' : 'Add Subject'}
      >
        <form onSubmit={handleSaveSubject} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subject Code</label>
              <input
                type="text"
                required
                maxLength={6}
                value={formData.subject_code || ''}
                onChange={(e) => setFormData({ ...formData, subject_code: e.target.value })}
                className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 transition ${
                  subjects.find(s => s.subject_code === (formData.subject_code || '').toUpperCase() && s.level === formData.level && s.id !== editingSubject?.id)
                    ? 'border-red-400 focus:ring-red-500 focus:border-red-500 bg-red-50'
                    : 'border-gray-300 focus:ring-maroon-500 focus:border-maroon-500'
                }`}
                placeholder="e.g. PHY"
              />
              {subjects.find(s => s.subject_code === (formData.subject_code || '').toUpperCase() && s.level === formData.level && s.id !== editingSubject?.id) && (
                <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
                  Code &ldquo;{(formData.subject_code || '').toUpperCase()}&rdquo; is already used at this level
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subject Name</label>
              <input
                type="text"
                required
                value={formData.subject_name || ''}
                onChange={(e) => setFormData({ ...formData, subject_name: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
                placeholder="e.g. Physics"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              value={formData.subject_type || 'COMPULSORY'}
              onChange={(e) => setFormData({ ...formData, subject_type: e.target.value })}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
            >
              {SUBJECT_TYPES.map((t) => (
                <option key={t} value={t}>{subjectTypeLabel(t, formData.level)}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setSubjectModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !!subjects.find(s => s.subject_code === (formData.subject_code || '').toUpperCase() && s.level === formData.level && s.id !== editingSubject?.id)}
              className="px-4 py-2 text-sm font-medium text-white bg-maroon-600 rounded-lg hover:bg-maroon-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {saving ? 'Saving...' : editingSubject ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={comboModalOpen}
        onClose={() => setComboModalOpen(false)}
        title={editingCombo ? 'Edit Combination' : 'Add Combination'}
      >
        <form onSubmit={handleSaveCombo} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
              <input
                type="text"
                required
                maxLength={3}
                value={formData.code || ''}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
                placeholder="e.g. PCB"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                required
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
                placeholder="e.g. Physics, Chemistry, Biology"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setComboModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-maroon-600 rounded-lg hover:bg-maroon-700 disabled:opacity-50 transition"
            >
              {saving ? 'Saving...' : editingCombo ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={comboSubjectsModalOpen}
        onClose={() => setComboSubjectsModalOpen(false)}
        title={`Subjects — ${comboName(selectedCombo) || ''}`}
      >
        <p className="text-xs text-gray-500 mb-4">
          The role of each subject is set automatically from how it was registered (Principal / Subsidiary / Optional).
        </p>
        {aLevelSubjects.length === 0 && (
          <p className="text-sm text-gray-400 py-4 text-center">
            No A-Level subjects found. Add A-Level subjects first.
          </p>
        )}
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {aLevelSubjects.map((sub) => {
            const assigned = getAssignedSubjectIds(selectedCombo?.id || '')
            const isAssigned = assigned.includes(sub.id)
            const role = subjectTypeToRole(sub.subject_type)
            const { label, cls } = roleStyle(role)

            return (
              <div
                key={sub.id}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition ${
                  isAssigned
                    ? 'bg-maroon-50 border-maroon-200'
                    : 'bg-gray-50 border-gray-100 hover:border-gray-200'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{sub.subject_name}</p>
                  <p className="text-xs text-gray-500 font-mono">{sub.subject_code}</p>
                </div>
                <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${cls}`}>
                  {label}
                </span>
                {isAssigned ? (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => toggleComboSubject(selectedCombo.id, sub.id, role)}
                    className="px-2.5 py-1 text-xs font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100 transition disabled:opacity-50"
                  >
                    Remove
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => toggleComboSubject(selectedCombo.id, sub.id, role)}
                    className="px-2.5 py-1 text-xs font-medium text-maroon-600 bg-maroon-50 rounded-md hover:bg-maroon-100 transition disabled:opacity-50"
                  >
                    Add
                  </button>
                )}
              </div>
            )
          })}
        </div>
        <div className="flex justify-end pt-4">
          <button
            type="button"
            onClick={() => setComboSubjectsModalOpen(false)}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            Done
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Confirm Delete"
      >
        <p className="text-sm text-gray-600 mb-6">
          Are you sure you want to delete <strong>{deleteConfirm?.name}</strong>?
          {deleteConfirm?.type === 'combination' && (
            <span className="block mt-1 text-xs text-amber-600">
              This will also remove all subject assignments for this combination.
            </span>
          )}
          This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={() => setDeleteConfirm(null)}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (deleteConfirm.type === 'subject') handleDeleteSubject(deleteConfirm.id)
              else if (deleteConfirm.type === 'combination') handleDeleteCombo(deleteConfirm.id)
            }}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition"
          >
            Delete
          </button>
        </div>
      </Modal>
    </div>
  )
}

export default AcademicSubjects
